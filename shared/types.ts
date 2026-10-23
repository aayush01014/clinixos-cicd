export type UserRole = 'Patient' | 'Receptionist' | 'Doctor' | 'Nurse' | 'Pharmacist' | 'Admin';

export interface User {
  id: number;
  email: string;
  role: UserRole;
  created_at: string;
}

export interface Patient {
  id: number;
  user_id?: number | null;
  pid: string; // e.g. PT-2026-0001
  first_name: string;
  last_name: string;
  dob: string;
  gender: 'Male' | 'Female' | 'Other';
  contact_number: string;
  emergency_contact: string;
  blood_group?: string;
  created_at: string;
}

export interface Doctor {
  id: number;
  user_id: number;
  first_name?: string;
  last_name?: string;
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
  appointment_date: string; // YYYY-MM-DD
  time_slot: string; // e.g. "09:30 AM"
  status: AppointmentStatus;
  notes?: string;
  created_at?: string;
  patient_name?: string;
  patient_pid?: string;
  doctor_name?: string;
  doctor_department?: string;
  doctor_fee?: number;
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
  patient_name?: string;
  patient_pid?: string;
  check_in_time?: string;
}

export interface Medication {
  id: number;
  barcode: string;
  name: string;
  generic_name?: string;
  category: string;
  stock_count: number;
  min_threshold: number;
  unit_price: number;
  is_critical?: boolean;
}

export type PrescriptionStatus = 'Issued' | 'Dispensed';

export interface PrescriptionItem {
  id?: number;
  prescription_id?: number;
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
  appointment_id: number;
  patient_id: number;
  doctor_id: number;
  diagnosis: string;
  icd10_code?: string;
  status: PrescriptionStatus;
  doctor_signature?: string;
  items?: PrescriptionItem[];
  created_at?: string;
  patient_name?: string;
  patient_pid?: string;
  doctor_name?: string;
}

export type PaymentStatus = 'Paid' | 'Partially Paid' | 'Pending';
export type PaymentMethod = 'Cash' | 'Card' | 'Online';

export interface Bill {
  id: number;
  appointment_id: number;
  patient_id: number;
  total_amount: number;
  paid_amount: number;
  payment_status: PaymentStatus;
  payment_method?: PaymentMethod;
  insurance_provider?: string;
  insurance_policy_no?: string;
  insurance_claim_amount?: number;
  created_at?: string;
  patient_name?: string;
  patient_pid?: string;
  doctor_name?: string;
}

export interface Feedback {
  id: number;
  patient_id: number;
  doctor_id: number;
  rating: number; // 1 to 5
  comments: string;
  created_at: string;
  patient_name?: string;
  doctor_name?: string;
}

export interface HospitalStats {
  totalBeds: number;
  occupiedBeds: number;
  vacantBeds: number;
  cleaningBeds: number;
  icuTotal: number;
  icuOccupied: number;
  icuVacancyRate: number;
  criticalMedicationsCount: number;
  scheduledAppointmentsToday: number;
  completedAppointmentsToday: number;
  pendingBillingCount: number;
  todayRevenue: number;
}

export interface WebSocketMessage {
  type: 'BED_STATUS_UPDATE' | 'ICU_WARNING' | 'PHARMACY_STOCK_ALERT' | 'NEW_APPOINTMENT' | 'BILL_GENERATED';
  payload: any;
  timestamp: string;
}
