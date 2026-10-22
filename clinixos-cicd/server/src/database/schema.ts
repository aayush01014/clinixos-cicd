import { runQuery } from './db';

export async function initializeSchema(): Promise<void> {
  console.log('[ClinixOS DB] Initializing database schema according to SRS Section 6.1...');

  // 1. Users Table
  await runQuery(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT CHECK(role IN ('Patient', 'Receptionist', 'Doctor', 'Nurse', 'Pharmacist', 'Admin')) NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 2. Patients Table (FR-01)
  await runQuery(`
    CREATE TABLE IF NOT EXISTS patients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      pid TEXT UNIQUE NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      dob DATE NOT NULL,
      gender TEXT CHECK(gender IN ('Male', 'Female', 'Other')) NOT NULL,
      contact_number TEXT NOT NULL,
      emergency_contact TEXT NOT NULL,
      blood_group TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );
  `);

  // 3. Doctors Table
  await runQuery(`
    CREATE TABLE IF NOT EXISTS doctors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      license_number TEXT UNIQUE NOT NULL,
      specialization TEXT NOT NULL,
      department TEXT NOT NULL,
      room_number TEXT NOT NULL,
      consultation_fee REAL NOT NULL DEFAULT 50.0,
      is_on_leave INTEGER DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // 4. Appointments Table (FR-02)
  await runQuery(`
    CREATE TABLE IF NOT EXISTS appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL,
      doctor_id INTEGER NOT NULL,
      appointment_date DATE NOT NULL,
      time_slot TEXT NOT NULL,
      status TEXT CHECK(status IN ('Scheduled', 'In-Progress', 'Completed', 'Cancelled')) DEFAULT 'Scheduled',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
      FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE
    );
  `);

  // 5. Prescriptions Table
  await runQuery(`
    CREATE TABLE IF NOT EXISTS prescriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      appointment_id INTEGER,
      patient_id INTEGER NOT NULL,
      doctor_id INTEGER NOT NULL,
      diagnosis TEXT NOT NULL,
      icd10_code TEXT,
      status TEXT CHECK(status IN ('Issued', 'Dispensed')) DEFAULT 'Issued',
      doctor_signature TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
      FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE
    );
  `);

  // 6. Prescription Items Table
  await runQuery(`
    CREATE TABLE IF NOT EXISTS prescription_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      prescription_id INTEGER NOT NULL,
      medication_id INTEGER NOT NULL,
      dosage TEXT NOT NULL,
      frequency TEXT NOT NULL,
      duration_days INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      FOREIGN KEY (prescription_id) REFERENCES prescriptions(id) ON DELETE CASCADE,
      FOREIGN KEY (medication_id) REFERENCES medications(id) ON DELETE RESTRICT
    );
  `);

  // 7. Medications Table (FR-05)
  await runQuery(`
    CREATE TABLE IF NOT EXISTS medications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      barcode TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      generic_name TEXT,
      category TEXT NOT NULL,
      dosage_form TEXT,
      strength TEXT,
      stock_count INTEGER NOT NULL DEFAULT 0,
      min_threshold INTEGER NOT NULL DEFAULT 20,
      unit_price REAL NOT NULL DEFAULT 0.0
    );
  `);

  // 8. Beds Table (FR-03)
  await runQuery(`
    CREATE TABLE IF NOT EXISTS beds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ward_number TEXT NOT NULL,
      ward_type TEXT CHECK(ward_type IN ('General', 'Semi-Private', 'ICU')) NOT NULL,
      bed_label TEXT NOT NULL,
      status TEXT CHECK(status IN ('Vacant', 'Occupied', 'Cleaning', 'Maintenance')) DEFAULT 'Vacant',
      current_patient_id INTEGER,
      check_in_time DATETIME,
      FOREIGN KEY (current_patient_id) REFERENCES patients(id) ON DELETE SET NULL
    );
  `);

  // 9. Bills Table (FR-09)
  await runQuery(`
    CREATE TABLE IF NOT EXISTS bills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      appointment_id INTEGER,
      patient_id INTEGER NOT NULL,
      total_amount REAL NOT NULL DEFAULT 0.0,
      paid_amount REAL NOT NULL DEFAULT 0.0,
      payment_status TEXT CHECK(payment_status IN ('Paid', 'Partially Paid', 'Pending')) DEFAULT 'Pending',
      payment_method TEXT CHECK(payment_method IN ('Cash', 'Card', 'Online')),
      insurance_provider TEXT,
      insurance_policy_no TEXT,
      insurance_claim_amount REAL DEFAULT 0.0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
    );
  `);

  // 10. Feedback Table (FR-01.5)
  await runQuery(`
    CREATE TABLE IF NOT EXISTS feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL,
      doctor_id INTEGER NOT NULL,
      rating INTEGER CHECK(rating BETWEEN 1 AND 5) NOT NULL,
      comments TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
      FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE
    );
  `);

  // 11. Clinical Documents Table (FR-01.4)
  await runQuery(`
    CREATE TABLE IF NOT EXISTS clinical_documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL,
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
    );
  `);

  // 12. Notification Logs Table (FR-04)
  await runQuery(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recipient TEXT NOT NULL,
      channel TEXT CHECK(channel IN ('Email', 'SMS')) NOT NULL,
      subject TEXT,
      message TEXT NOT NULL,
      status TEXT DEFAULT 'Sent',
      sent_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 13. Audit Log Table (NFR-11)
  await runQuery(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      action TEXT NOT NULL,
      details TEXT,
      ip_address TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Indexes for Scalability (NFR-04)
  await runQuery(`CREATE INDEX IF NOT EXISTS idx_patients_pid ON patients(pid);`);
  await runQuery(`CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);`);
  await runQuery(`CREATE INDEX IF NOT EXISTS idx_appointments_doctor ON appointments(doctor_id);`);
  await runQuery(`CREATE INDEX IF NOT EXISTS idx_medications_barcode ON medications(barcode);`);
  await runQuery(`CREATE INDEX IF NOT EXISTS idx_beds_ward ON beds(ward_number, status);`);

  console.log('[ClinixOS DB] All 10 SRS tables and indexes initialized successfully.');
}
