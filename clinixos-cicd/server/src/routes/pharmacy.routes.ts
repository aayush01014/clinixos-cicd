import { Router, Response } from 'express';
import { queryAll, queryOne, runQuery } from '../database/db';
import { authenticateToken, AuthRequest, requireRoles, logAuditEvent } from '../middleware/auth';
import { broadcastMessage } from '../websocket';

const router = Router();

// GET /api/pharmacy/inventory (List all medications, with low-stock flags - FR-05.3)
router.get('/inventory', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { q, category, low_stock } = req.query;

  try {
    let sql = 'SELECT * FROM medications WHERE 1=1';
    const params: any[] = [];

    if (q && typeof q === 'string') {
      const term = `%${q.trim()}%`;
      sql += ' AND (name LIKE ? OR barcode LIKE ? OR generic_name LIKE ?)';
      params.push(term, term, term);
    }
    if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }
    if (low_stock === 'true') {
      sql += ' AND stock_count <= min_threshold';
    }

    sql += ' ORDER BY stock_count ASC, name ASC';
    const medications = await queryAll<any>(sql, params);

    // Compute critical stock counts
    const criticalCount = medications.filter((m) => m.stock_count <= m.min_threshold).length;

    return res.json({
      success: true,
      criticalCount,
      count: medications.length,
      data: medications.map((m) => ({
        ...m,
        is_critical: m.stock_count <= m.min_threshold
      }))
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to retrieve pharmacy inventory.' });
  }
});

// GET /api/pharmacy/barcode/:code (Hardware Barcode Scanner Lookup - Section 3.2)
router.get('/barcode/:code', authenticateToken, async (req: AuthRequest, res: Response) => {
  const barcode = req.params.code;

  try {
    const medication = await queryOne<any>('SELECT * FROM medications WHERE barcode = ?', [barcode]);
    if (!medication) {
      return res.status(404).json({ success: false, error: `No medication cataloged with barcode [${barcode}].` });
    }

    return res.json({
      success: true,
      data: {
        ...medication,
        is_critical: medication.stock_count <= medication.min_threshold
      }
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Error scanning barcode.' });
  }
});

// POST /api/pharmacy/dispense (Fulfill prescription & auto-decrement stock - FR-05.1 & BR-02)
router.post('/dispense', authenticateToken, requireRoles(['Pharmacist', 'Admin']), async (req: AuthRequest, res: Response) => {
  const { prescription_id } = req.body;

  if (!prescription_id) {
    return res.status(400).json({ success: false, error: 'Prescription ID is required for fulfillment.' });
  }

  try {
    const rx = await queryOne<any>(
      `SELECT pr.*, d.license_number
       FROM prescriptions pr
       JOIN doctors d ON pr.doctor_id = d.id
       WHERE pr.id = ?`,
      [prescription_id]
    );

    if (!rx) {
      return res.status(404).json({ success: false, error: 'Prescription not found.' });
    }

    if (rx.status === 'Dispensed') {
      return res.status(400).json({ success: false, error: 'This prescription has already been dispensed.' });
    }

    // BR-02: Doctor license verification
    if (!rx.license_number) {
      return res.status(400).json({
        success: false,
        error: 'Business Rule Violation (BR-02): Cannot dispense prescription without verified doctor signature and active license.'
      });
    }

    // Get prescription items
    const items = await queryAll<any>('SELECT * FROM prescription_items WHERE prescription_id = ?', [prescription_id]);
    if (items.length === 0) {
      return res.status(400).json({ success: false, error: 'Prescription contains no medication items.' });
    }

    // Verify sufficient stock for all items
    for (const item of items) {
      const med = await queryOne<any>('SELECT * FROM medications WHERE id = ?', [item.medication_id]);
      if (!med) {
        return res.status(400).json({ success: false, error: `Medication item ID ${item.medication_id} does not exist.` });
      }
      if (med.stock_count < item.quantity) {
        return res.status(400).json({
          success: false,
          error: `Insufficient stock for ${med.name}. Required: ${item.quantity}, Current: ${med.stock_count}. Please reorder.`
        });
      }
    }

    // Decrement stock and log adjustments (FR-05.1 & FR-05.4)
    const lowStockAlerts: any[] = [];
    let totalMedicationCost = 0;

    for (const item of items) {
      const med = await queryOne<any>('SELECT * FROM medications WHERE id = ?', [item.medication_id]);
      const newStock = med.stock_count - item.quantity;
      totalMedicationCost += med.unit_price * item.quantity;

      await runQuery('UPDATE medications SET stock_count = ? WHERE id = ?', [newStock, item.medication_id]);

      // Audit log (FR-05.4)
      await runQuery(
        `INSERT INTO audit_logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)`,
        [
          req.user?.id || null,
          'MEDICATION_DISPENSED',
          `Pharmacist dispensed ${item.quantity} of ${med.name} (ID: ${med.id}). New stock: ${newStock}`,
          req.ip || '127.0.0.1'
        ]
      );

      // Check if dropped below threshold (FR-05.3)
      if (newStock <= med.min_threshold) {
        lowStockAlerts.push({
          medicationId: med.id,
          name: med.name,
          currentStock: newStock,
          minThreshold: med.min_threshold
        });
      }
    }

    // Mark prescription as Dispensed
    await runQuery('UPDATE prescriptions SET status = "Dispensed" WHERE id = ?', [prescription_id]);

    // Update associated bill with pharmacy costs if bill exists
    if (rx.appointment_id) {
      const existingBill = await queryOne<any>('SELECT * FROM bills WHERE appointment_id = ?', [rx.appointment_id]);
      if (existingBill) {
        const newTotal = existingBill.total_amount + totalMedicationCost;
        await runQuery('UPDATE bills SET total_amount = ? WHERE id = ?', [newTotal, existingBill.id]);
      }
    }

    // Broadcast low stock alerts via WebSocket
    if (lowStockAlerts.length > 0) {
      broadcastMessage('PHARMACY_STOCK_ALERT', {
        alerts: lowStockAlerts,
        message: 'CRITICAL: Pharmacy items have fallen below safety reorder threshold!'
      });
    }

    return res.json({
      success: true,
      message: 'Prescription verified, medications dispensed, and inventory decremented successfully.',
      prescription_id,
      lowStockAlerts
    });
  } catch (err: any) {
    console.error('[ClinixOS Pharmacy] Dispense error:', err);
    return res.status(500).json({ success: false, error: 'Error fulfilling prescription.' });
  }
});

// PATCH /api/pharmacy/inventory/:id (Update stock or custom thresholds - FR-05.2, FR-05.4)
router.patch('/inventory/:id', authenticateToken, requireRoles(['Pharmacist', 'Admin']), async (req: AuthRequest, res: Response) => {
  const medId = req.params.id;
  const { stock_adjustment, min_threshold, unit_price } = req.body;

  try {
    const med = await queryOne<any>('SELECT * FROM medications WHERE id = ?', [medId]);
    if (!med) {
      return res.status(404).json({ success: false, error: 'Medication not found.' });
    }

    let updatedStock = med.stock_count;
    if (typeof stock_adjustment === 'number') {
      updatedStock += stock_adjustment;
      if (updatedStock < 0) updatedStock = 0;
    }

    const updatedThreshold = typeof min_threshold === 'number' ? min_threshold : med.min_threshold;
    const updatedPrice = typeof unit_price === 'number' ? unit_price : med.unit_price;

    await runQuery(
      `UPDATE medications SET stock_count = ?, min_threshold = ?, unit_price = ? WHERE id = ?`,
      [updatedStock, updatedThreshold, updatedPrice, medId]
    );

    // Audit log (FR-05.4)
    await runQuery(
      `INSERT INTO audit_logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)`,
      [
        req.user?.id || null,
        'INVENTORY_RESTOCK_ADJUSTMENT',
        `Medication ${med.name} stock adjusted by ${stock_adjustment || 0}. New count: ${updatedStock}, Threshold: ${updatedThreshold}`,
        req.ip || '127.0.0.1'
      ]
    );

    return res.json({
      success: true,
      message: `Inventory for ${med.name} updated successfully.`,
      medication: {
        id: Number(medId),
        stock_count: updatedStock,
        min_threshold: updatedThreshold,
        unit_price: updatedPrice
      }
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Error adjusting inventory.' });
  }
});

export default router;
