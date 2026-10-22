import bcrypt from 'bcryptjs';
import { runQuery, queryOne } from './db';
import { initializeSchema } from './schema';
import { PHARMACY_MEDICATIONS_CATALOG } from './catalogs/medications';

export async function seedDatabase(): Promise<void> {
  console.log('[ClinixOS Seed] Commencing database seeding...');
  await initializeSchema();

  // 1. Seed Roles & Default Staff Credentials (Password: "ClinixOS@2026")
  const defaultPasswordHash = await bcrypt.hash('ClinixOS@2026', 12);

  const staffUsers = [
    { email: 'admin@clinixos.org', role: 'Admin' },
    { email: 'receptionist@clinixos.org', role: 'Receptionist' },
    { email: 'nurse@clinixos.org', role: 'Nurse' },
    { email: 'pharmacist@clinixos.org', role: 'Pharmacist' },
    { email: 'doctor.cardio@clinixos.org', role: 'Doctor' },
    { email: 'doctor.neuro@clinixos.org', role: 'Doctor' },
    { email: 'doctor.general@clinixos.org', role: 'Doctor' },
    { email: 'patient.demo@clinixos.org', role: 'Patient' }
  ];

  for (const staff of staffUsers) {
    const existing = await queryOne('SELECT id FROM users WHERE email = ?', [staff.email]);
    if (!existing) {
      await runQuery(
        'INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)',
        [staff.email, defaultPasswordHash, staff.role]
      );
    }
  }

  // 2. Seed Doctor Profiles (Using institutional department designations, avoiding hardcoded static personal names)
  const doctorProfiles = [
    {
      email: 'doctor.cardio@clinixos.org',
      license: 'DOC-CARD-2026-01',
      specialization: 'Cardiology',
      department: 'Cardiovascular Care',
      room: 'Suite 302',
      fee: 80.0
    },
    {
      email: 'doctor.neuro@clinixos.org',
      license: 'DOC-NEUR-2026-02',
      specialization: 'Neurology',
      department: 'Neurosciences',
      room: 'Suite 415',
      fee: 90.0
    },
    {
      email: 'doctor.general@clinixos.org',
      license: 'DOC-GENM-2026-03',
      specialization: 'Internal Medicine',
      department: 'General Outpatient OPD',
      room: 'Suite 108',
      fee: 50.0
    }
  ];

  for (const doc of doctorProfiles) {
    const user = await queryOne<{ id: number }>('SELECT id FROM users WHERE email = ?', [doc.email]);
    if (user) {
      const existingDoc = await queryOne('SELECT id FROM doctors WHERE user_id = ?', [user.id]);
      if (!existingDoc) {
        await runQuery(
          `INSERT INTO doctors (user_id, license_number, specialization, department, room_number, consultation_fee)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [user.id, doc.license, doc.specialization, doc.department, doc.room, doc.fee]
        );
      }
    }
  }

  // 3. Seed Hospital Ward Beds (General, Semi-Private, ICU)
  const bedConfigurations = [
    // General Ward 1A
    { ward: 'Ward-1A', type: 'General', label: 'GEN-101', status: 'Vacant' },
    { ward: 'Ward-1A', type: 'General', label: 'GEN-102', status: 'Vacant' },
    { ward: 'Ward-1A', type: 'General', label: 'GEN-103', status: 'Cleaning' },
    { ward: 'Ward-1A', type: 'General', label: 'GEN-104', status: 'Vacant' },
    { ward: 'Ward-1A', type: 'General', label: 'GEN-105', status: 'Maintenance' },
    { ward: 'Ward-1A', type: 'General', label: 'GEN-106', status: 'Vacant' },

    // Semi-Private Ward 2B
    { ward: 'Ward-2B', type: 'Semi-Private', label: 'SP-201', status: 'Vacant' },
    { ward: 'Ward-2B', type: 'Semi-Private', label: 'SP-202', status: 'Vacant' },
    { ward: 'Ward-2B', type: 'Semi-Private', label: 'SP-203', status: 'Cleaning' },
    { ward: 'Ward-2B', type: 'Semi-Private', label: 'SP-204', status: 'Vacant' },

    // Intensive Care Unit (ICU)
    { ward: 'Ward-ICU', type: 'ICU', label: 'ICU-301', status: 'Vacant' },
    { ward: 'Ward-ICU', type: 'ICU', label: 'ICU-302', status: 'Vacant' },
    { ward: 'Ward-ICU', type: 'ICU', label: 'ICU-303', status: 'Vacant' },
    { ward: 'Ward-ICU', type: 'ICU', label: 'ICU-304', status: 'Vacant' },
    { ward: 'Ward-ICU', type: 'ICU', label: 'ICU-305', status: 'Vacant' }
  ];

  for (const bed of bedConfigurations) {
    const existingBed = await queryOne('SELECT id FROM beds WHERE bed_label = ?', [bed.label]);
    if (!existingBed) {
      await runQuery(
        `INSERT INTO beds (ward_number, ward_type, bed_label, status) VALUES (?, ?, ?, ?)`,
        [bed.ward, bed.type, bed.label, bed.status]
      );
    }
  }

  // 4. Seed Pharmacy Medications Catalog
  for (const med of PHARMACY_MEDICATIONS_CATALOG) {
    const existingMed = await queryOne('SELECT id FROM medications WHERE barcode = ?', [med.barcode]);
    if (!existingMed) {
      await runQuery(
        `INSERT INTO medications (barcode, name, generic_name, category, dosage_form, strength, stock_count, min_threshold, unit_price)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          med.barcode,
          med.name,
          med.generic_name,
          med.category,
          med.dosage_form,
          med.strength,
          med.stock_count,
          med.min_threshold,
          med.unit_price
        ]
      );
    }
  }

  console.log('[ClinixOS Seed] Database seeding finished successfully.');
}

if (require.main === module) {
  seedDatabase().then(() => {
    console.log('[ClinixOS Seed] Exiting seeder process.');
    process.exit(0);
  }).catch((err) => {
    console.error('[ClinixOS Seed] Seeding failed:', err);
    process.exit(1);
  });
}
