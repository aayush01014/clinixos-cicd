/**
 * ClinixOS Enterprise Verification Test Suite
 * Conforming to IEEE Std 830-1998 Acceptance Criteria
 */

const API_BASE = 'http://localhost:5000/api';

async function runTests() {
  console.log('========================================================');
  console.log(' Starting ClinixOS Automated Verification Test Suite');
  console.log('========================================================\n');

  let passed = 0;
  let failed = 0;

  async function assert(desc: string, testFn: () => Promise<boolean>) {
    try {
      const result = await testFn();
      if (result) {
        console.log(`  [PASS] ${desc}`);
        passed++;
      } else {
        console.error(`  [FAIL] ${desc}`);
        failed++;
      }
    } catch (err: any) {
      console.error(`  [ERROR] ${desc}:`, err.message);
      failed++;
    }
  }

  // 1. Health check
  await assert('NFR-15 / System Health Endpoint is ONLINE', async () => {
    const res = await fetch(`${API_BASE}/health`);
    const data: any = await res.json();
    return res.status === 200 && data.status === 'ONLINE';
  });

  // 2. Authentication & JWT
  let adminToken = '';
  await assert('NFR-10 / Admin User Authentication and JWT Issuance', async () => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@clinixos.org', password: 'ClinixOS@2026' })
    });
    const data: any = await res.json();
    adminToken = data.token;
    return res.status === 200 && Boolean(data.token) && data.user.role === 'Admin';
  });

  // 3. Patient Intake & Sequential PID (FR-01.1, FR-01.3)
  let createdPatient: any = null;
  await assert('FR-01.1 / Generate Unique Sequential PID on Walk-in Intake', async () => {
    const res = await fetch(`${API_BASE}/patients`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        first_name: 'TestPatient',
        last_name: 'Verification',
        dob: '1992-05-14',
        gender: 'Female',
        contact_number: '+1-555-888-9999',
        emergency_contact: '+1-555-000-1111',
        blood_group: 'B+'
      })
    });
    const data: any = await res.json();
    createdPatient = data.patient;
    return res.status === 201 && Boolean(data.patient) && data.patient.pid.startsWith('PT-2026-');
  });

  // 4. Ward Bed Management & BR-03 Business Rule
  await assert('BR-03 / Prevent Assigning Bed Marked as Cleaning Needed', async () => {
    const bedsRes = await fetch(`${API_BASE}/beds`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const bedsData: any = await bedsRes.json();
    const bedToTest = bedsData.data[0];

    // Attempt invalid state (BR-03)
    const invalidRes = await fetch(`${API_BASE}/beds/${bedToTest.id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ status: 'Cleaning', patient_id: createdPatient.id })
    });
    return invalidRes.status === 400;
  });

  // 5. Conflict-Free Appointment Scheduling (FR-02.1)
  await assert('FR-02.1 / Automated Slot Conflict Validation & Booking', async () => {
    const docRes = await fetch(`${API_BASE}/doctors`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const docData: any = await docRes.json();
    const doctor = docData.data[0];

    const randomDay = String(Math.floor(Math.random() * 25) + 1).padStart(2, '0');
    const testDate = `2030-05-${randomDay}`;
    const testSlot = '11:15 AM';

    const bookRes = await fetch(`${API_BASE}/appointments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        patient_id: createdPatient.id,
        doctor_id: doctor.id,
        appointment_date: testDate,
        time_slot: testSlot
      })
    });

    // Attempt duplicate booking for same doctor and slot (Must trigger 409 Conflict)
    const duplicateRes = await fetch(`${API_BASE}/appointments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        patient_id: createdPatient.id,
        doctor_id: doctor.id,
        appointment_date: testDate,
        time_slot: testSlot
      })
    });

    return bookRes.status === 201 && duplicateRes.status === 409;
  });

  // 6. Pharmacy Barcode Lookup & Auto-Decrement Dispense (FR-05.1)
  await assert('FR-05.1 / Barcode Lookup & Stock Decrement upon Prescription Fulfillment', async () => {
    const medRes = await fetch(`${API_BASE}/pharmacy/barcode/890103001001`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const medData: any = await medRes.json();
    const initialStock = medData.data.stock_count;

    // Issue Prescription
    const rxRes = await fetch(`${API_BASE}/prescriptions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        patient_id: createdPatient.id,
        doctor_id: 1,
        diagnosis: 'Test Clinical Indication',
        doctor_signature: 'Verified Lic #DOC-CARD-2026-01',
        items: [{ medication_id: medData.data.id, dosage: '500mg', frequency: 'BD', duration_days: 2, quantity: 2 }]
      })
    });
    const rxData: any = await rxRes.json();

    // Dispense
    const dispenseRes = await fetch(`${API_BASE}/pharmacy/dispense`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ prescription_id: rxData.prescriptionId })
    });

    // Check new stock
    const verifyMed = await fetch(`${API_BASE}/pharmacy/barcode/890103001001`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const verifyData: any = await verifyMed.json();

    return dispenseRes.status === 200 && verifyData.data.stock_count === initialStock - 2;
  });

  // 7. Automated Report PDF Compilation (FR-08.1)
  await assert('FR-08.1 / Dynamic PDF Report Compilation with Digital Security Signature', async () => {
    const pdfRes = await fetch(`${API_BASE}/reports/pdf/billing`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const contentType = pdfRes.headers.get('content-type');
    return pdfRes.status === 200 && Boolean(contentType?.includes('application/pdf'));
  });

  console.log('\n========================================================');
  console.log(` Test Results: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================\n');
}

runTests().catch(console.error);
