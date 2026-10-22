export type UserRole = 'Patient' | 'Receptionist' | 'Doctor' | 'Nurse' | 'Pharmacist' | 'Admin';

export interface User {
  id: number;
  email: string;
  role: UserRole;
  doctor?: Doctor;
  patient?: Patient;
}

export interface Patient {
  id: number;
  user_id?: number | null;
  pid: string;
  first_name: string;
  last_name: string;
  dob: string;
  gender: 'Male' | 'Female' | 'Other';
  contact_number: string;
  emergency_contact: string;
  blood_group?: string;
  created_at?: string;
}

export interface Doctor {
  id: number;
  user_id: number;
  email?: string;
  license_number: string;
  specialization: string;
  department: string;
  room_number: string;
  consultation_fee: number;
  is_on_leave?: number | boolean;
}

export type AppointmentStatus = 'Scheduled' | 'In-Progress' | 'Completed' | 'Cancelled';

export interface Appointment {
  id: number;
  patient_id: number;
  doctor_id: number;
  appointment_date: string;
  time_slot: string;
  status: AppointmentStatus;
  notes?: string;
  patient_pid?: string;
  patient_first?: string;
  patient_last?: string;
  patient_phone?: string;
  doctor_spec?: string;
  doctor_dept?: string;
  room_number?: string;
  consultation_fee?: number;
}

export type WardType = 'General' | 'Semi-Private' | 'ICU';
export type BedStatus = 'Vacant' | 'Occupied' | 'Cleaning' | 'Maintenance';

export interface Bed {
  id: number;
  ward_number: string;
  ward_type: WardType;
  bed_label: string;
  status: BedStatus;
  current_patient_id: number | null;
  patient_pid?: string;
  first_name?: string;
  last_name?: string;
  check_in_time?: string;
  gender?: string;
}

export interface Medication {
  id: number;
  barcode: string;
  name: string;
  generic_name?: string;
  category: string;
  dosage_form?: string;
  strength?: string;
  stock_count: number;
  min_threshold: number;
  unit_price: number;
  is_critical?: boolean;
}

export interface PrescriptionItem {
  id?: number;
  medication_id: number;
  medication_name?: string;
  dosage: string;
  frequency: string;
  duration_days: number;
  quantity: number;
  unit_price?: number;
}

export interface Prescription {
  id: number;
  appointment_id?: number;
  patient_id: number;
  doctor_id: number;
  diagnosis: string;
  icd10_code?: string;
  status: 'Issued' | 'Dispensed';
  doctor_signature?: string;
  items?: PrescriptionItem[];
  created_at?: string;
  patient_pid?: string;
  patient_first?: string;
  patient_last?: string;
  specialization?: string;
  license_number?: string;
}

export interface Bill {
  id: number;
  appointment_id?: number;
  patient_id: number;
  total_amount: number;
  paid_amount: number;
  payment_status: 'Paid' | 'Partially Paid' | 'Pending';
  payment_method?: 'Cash' | 'Card' | 'Online';
  insurance_provider?: string;
  insurance_policy_no?: string;
  insurance_claim_amount?: number;
  created_at?: string;
  patient_pid?: string;
  patient_first?: string;
  patient_last?: string;
  patient_phone?: string;
  appointment_date?: string;
  time_slot?: string;
  doctor_spec?: string;
  doctor_dept?: string;
}

export interface HospitalStats {
  totalBeds: number;
  occupiedBeds: number;
  vacantBeds: number;
  cleaningBeds: number;
  bedOccupancyPercentage: number;
  icuTotal: number;
  icuVacant: number;
  icuVacancyRate: number;
  icuOccupancyRate: number;
  criticalMedicationsCount: number;
  scheduledAppointmentsToday: number;
  completedAppointmentsToday: number;
  financialData?: {
    allTimeRevenue: number;
    pendingInvoicesCount: number;
  } | null;
  departmentLoads?: Array<{ department: string; appointment_count: number }>;
}
