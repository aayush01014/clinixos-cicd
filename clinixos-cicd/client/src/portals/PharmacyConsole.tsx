import React, { useState, useEffect } from 'react';
import { Medication, Prescription, UserRole } from '../types';
import { api } from '../services/api';
import { wsClient } from '../services/websocket';
import { Pill, Barcode, AlertTriangle, CheckCircle, Search, RefreshCw, PlusCircle, Check } from 'lucide-react';

interface PharmacyConsoleProps {
  currentRole: UserRole;
}

export const PharmacyConsole: React.FC<PharmacyConsoleProps> = () => {
  const [medications, setMedications] = useState<Medication[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [scannedMed, setScannedMed] = useState<Medication | null>(null);
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [showCriticalOnly, setShowCriticalOnly] = useState(false);
  const [adjustingMed, setAdjustingMed] = useState<Medication | null>(null);
  const [adjustQuantity, setAdjustQuantity] = useState<number | string>('');
  const [customThreshold, setCustomThreshold] = useState<number | string>('');
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; isError: boolean } | null>(null);

  useEffect(() => {
    loadInventory();
    loadPrescriptions();

    // Listen to real-time low-stock alerts
    const unsubscribe = wsClient.subscribe('PHARMACY_STOCK_ALERT', (payload) => {
      console.log('[Pharmacy WS] Stock alert received:', payload);
      loadInventory();
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const loadInventory = async () => {
    try {
      const res = await api.getInventory();
      if (res.success) {
        setMedications(res.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadPrescriptions = async () => {
    try {
      const res = await api.getPrescriptions({ status: 'Issued' });
      if (res.success) {
        setPrescriptions(res.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Barcode Scanner Simulator (SRS Section 3.2 USB Keyboard Wedge)
  const handleBarcodeScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput) return;
    setFeedbackMsg(null);

    try {
      const res = await api.scanBarcode(barcodeInput.trim());
      if (res.success) {
        setScannedMed(res.data);
        setFeedbackMsg({ text: `Barcode Verified: ${res.data.name} (${res.data.stock_count} units in inventory)`, isError: false });
      }
    } catch (err: any) {
      setFeedbackMsg({ text: err.message || 'Barcode not found in pharmacy database.', isError: true });
    }
  };

  // Dispense & Decrement Prescription (FR-05.1 & BR-02)
  const handleDispense = async (rxId: number) => {
    setFeedbackMsg(null);

    try {
      const res = await api.dispensePrescription(rxId);
      if (res.success) {
        setFeedbackMsg({
          text: `Prescription RX-${rxId} fulfilled! Inventory decremented automatically.`,
          isError: false
        });
        loadInventory();
        loadPrescriptions();
      }
    } catch (err: any) {
      setFeedbackMsg({ text: err.message || 'Dispensing failed.', isError: true });
    }
  };

  // Adjust stock & custom threshold (FR-05.2, FR-05.4)
  const handleSaveStockAdjustment = async () => {
    if (!adjustingMed) return;

    try {
      const res = await api.adjustInventory(adjustingMed.id, {
        stock_adjustment: Number(adjustQuantity),
        min_threshold: Number(customThreshold)
      });

      if (res.success) {
        setFeedbackMsg({ text: `Inventory for ${adjustingMed.name} updated.`, isError: false });
        setAdjustingMed(null);
        loadInventory();
      }
    } catch (err: any) {
      setFeedbackMsg({ text: err.message, isError: true });
    }
  };

  const categories = ['ALL', ...Array.from(new Set(medications.map((m) => m.category)))];

  const filteredMeds = medications.filter((m) => {
    const matchesCat = filterCategory === 'ALL' || m.category === filterCategory;
    const matchesCrit = !showCriticalOnly || m.is_critical;
    return matchesCat && matchesCrit;
  });

  const criticalCount = medications.filter((m) => m.is_critical).length;

  return (
    <div style={{ maxWidth: 1440, margin: '0 auto', padding: '24px' }}>
      {/* Top Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 12 }}>
            <Pill size={28} color="#06b6d4" /> Pharmacy Inventory &amp; Barcode Dispensing
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: 4 }}>
            Automated threshold monitoring, stock auto-decrement upon fulfillment, and barcode scanning.
          </p>
        </div>

        {criticalCount > 0 && (
          <div className="glass-panel" style={{ padding: '12px 20px', border: '1px solid #f43f5e', background: 'rgba(244, 63, 94, 0.12)', display: 'flex', alignItems: 'center', gap: 14 }}>
            <AlertTriangle size={24} color="#f43f5e" />
            <div>
              <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0f172a' }}>
                {criticalCount} Critical Low-Stock Items
              </div>
              <div style={{ fontSize: '0.75rem', color: '#fda4af' }}>
                Stock below configured safety reorder thresholds.
              </div>
            </div>
          </div>
        )}
      </div>

      {feedbackMsg && (
        <div
          style={{
            padding: '12px 18px',
            marginBottom: 20,
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: feedbackMsg.isError ? 'rgba(244, 63, 94, 0.2)' : 'rgba(16, 185, 129, 0.2)',
            border: `1px solid ${feedbackMsg.isError ? '#f43f5e' : '#10b981'}`,
            color: feedbackMsg.isError ? '#fda4af' : '#6ee7b7',
            fontSize: '0.88rem'
          }}
        >
          {feedbackMsg.isError ? <AlertTriangle size={18} /> : <CheckCircle size={18} />}
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* Barcode Scanner Wedge & Fast Lookup (SRS Section 3.2) */}
      <div className="glass-panel" style={{ padding: 20, marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <form onSubmit={handleBarcodeScan} style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, maxWidth: 600 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Barcode size={20} style={{ position: 'absolute', left: 14, top: 12, color: '#06b6d4' }} />
            <input
              type="text"
              className="glass-input"
              style={{ paddingLeft: 42, fontFamily: 'var(--font-mono)' }}
              placeholder="Scan medication barcode (e.g. 890103001001 or 890103002001)..."
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
            />
          </div>
          <button type="submit" className="glass-btn">
            <Search size={16} /> Scan Lookup
          </button>
        </form>

        {scannedMed && (
          <div style={{ padding: '10px 16px', background: 'rgba(6, 182, 212, 0.15)', border: '1px solid var(--cyan-accent)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 14 }}>
            <div>
              <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.92rem' }}>{scannedMed.name}</div>
              <div style={{ fontSize: '0.72rem', color: '#38bdf8' }}>
                Stock: {scannedMed.stock_count} units • Min: {scannedMed.min_threshold} • ${scannedMed.unit_price}
              </div>
            </div>
            <button
              onClick={() => {
                setAdjustingMed(scannedMed);
                setCustomThreshold(scannedMed.min_threshold);
              }}
              className="glass-btn glass-btn-secondary"
              style={{ fontSize: '0.75rem', padding: '4px 10px' }}
            >
              Adjust Stock
            </button>
          </div>
        )}
      </div>

      {/* Main Grid: Pending Doctor Prescriptions Queue (Left) & Live Inventory Catalog (Right) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: 24 }}>
        {/* PENDING PRESCRIPTIONS DISPENSING QUEUE */}
        <div className="glass-panel" style={{ padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>
              Prescription Dispensing Queue
            </h2>
            <span className="badge badge-cleaning">{prescriptions.length} Awaiting Dispense</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxHeight: 520, overflowY: 'auto' }}>
            {prescriptions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-dim)', fontSize: '0.85rem' }}>
                No pending prescriptions currently waiting in queue.
              </div>
            ) : (
              prescriptions.map((rx) => (
                <div
                  key={rx.id}
                  style={{
                    padding: 16,
                    borderRadius: 12,
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid var(--border-glass)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div>
                      <span style={{ fontSize: '0.92rem', fontWeight: 800, color: '#38bdf8' }}>RX-{rx.id}</span>
                      <div style={{ fontSize: '0.78rem', color: '#0f172a', fontWeight: 600 }}>
                        {rx.patient_first ? `${rx.patient_first} ${rx.patient_last}` : 'Patient File'} (PID: {rx.patient_pid})
                      </div>
                    </div>
                    <span className="badge badge-cleaning">Awaiting Dispense</span>
                  </div>

                  <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: 10 }}>
                    Diagnosis: <span style={{ color: '#0f172a', fontWeight: 600 }}>{rx.diagnosis}</span>
                  </div>

                  {/* Items */}
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '8px 0', fontSize: '0.75rem', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {rx.items?.map((item: any, i: number) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
                        <span>• {item.medication_name} ({item.dosage})</span>
                        <span style={{ color: '#0f172a', fontWeight: 600 }}>Qty: {item.quantity}</span>
                      </div>
                    ))}
                  </div>

                  <div style={{ fontSize: '0.7rem', color: '#38bdf8', fontFamily: 'var(--font-mono)', marginBottom: 12 }}>
                    {rx.doctor_signature || 'Electronically verified signature'}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDispense(rx.id)}
                    className="glass-btn"
                    style={{ width: '100%', justifyContent: 'center', padding: '8px 12px', fontSize: '0.82rem' }}
                  >
                    <CheckCircle size={16} /> Fulfill &amp; Auto-Decrement Stock
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* PHARMACY INVENTORY TABLE */}
        <div className="glass-panel" style={{ padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>
              Medication Formularies &amp; Thresholds
            </h2>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                onClick={() => setShowCriticalOnly(!showCriticalOnly)}
                className={`glass-btn ${showCriticalOnly ? 'glass-btn-danger' : 'glass-btn-secondary'}`}
                style={{ padding: '6px 10px', fontSize: '0.75rem' }}
              >
                <AlertTriangle size={14} /> Low Stock Only
              </button>
            </div>
          </div>

          <div style={{ maxHeight: 520, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-glass)', color: 'var(--text-dim)' }}>
                  <th style={{ padding: '8px 10px' }}>Medication</th>
                  <th style={{ padding: '8px 10px' }}>Barcode</th>
                  <th style={{ padding: '8px 10px' }}>Stock</th>
                  <th style={{ padding: '8px 10px' }}>Threshold</th>
                  <th style={{ padding: '8px 10px' }}>Price</th>
                  <th style={{ padding: '8px 10px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredMeds.map((m) => (
                  <tr
                    key={m.id}
                    style={{
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      background: m.is_critical ? 'rgba(244, 63, 94, 0.08)' : 'transparent'
                    }}
                  >
                    <td style={{ padding: '10px 10px' }}>
                      <div style={{ fontWeight: 700, color: '#0f172a' }}>{m.name}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>{m.generic_name || m.category}</div>
                    </td>
                    <td style={{ padding: '10px 10px', fontFamily: 'var(--font-mono)', color: 'var(--cyan-accent)' }}>
                      {m.barcode}
                    </td>
                    <td style={{ padding: '10px 10px' }}>
                      <span
                        style={{
                          fontWeight: 800,
                          color: m.is_critical ? '#f43f5e' : '#34d399'
                        }}
                      >
                        {m.stock_count} units
                      </span>
                    </td>
                    <td style={{ padding: '10px 10px', color: 'var(--text-muted)' }}>
                      {m.min_threshold}
                    </td>
                    <td style={{ padding: '10px 10px', color: '#0f172a', fontWeight: 600 }}>
                      ${m.unit_price.toFixed(2)}
                    </td>
                    <td style={{ padding: '10px 10px' }}>
                      <button
                        onClick={() => {
                          setAdjustingMed(m);
                          setCustomThreshold(m.min_threshold);
                        }}
                        className="glass-btn glass-btn-secondary"
                        style={{ padding: '4px 8px', fontSize: '0.72rem' }}
                      >
                        Adjust
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Adjust Inventory Modal (FR-05.2, FR-05.4) */}
      {adjustingMed && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div className="glass-modal" style={{ width: '100%', maxWidth: 440, padding: 24 }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', marginBottom: 14 }}>
              Adjust Inventory: {adjustingMed.name}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                  Add / Restock Units (+):
                </label>
                <input
                  type="number"
                  className="glass-input"
                  value={adjustQuantity}
                  onChange={(e) => setAdjustQuantity(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                  Safety Alert Threshold:
                </label>
                <input
                  type="number"
                  className="glass-input"
                  value={customThreshold}
                  onChange={(e) => setCustomThreshold(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                <button type="button" onClick={() => setAdjustingMed(null)} className="glass-btn glass-btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>
                  Cancel
                </button>
                <button type="button" onClick={handleSaveStockAdjustment} className="glass-btn" style={{ flex: 1, justifyContent: 'center' }}>
                  Commit Adjustment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
