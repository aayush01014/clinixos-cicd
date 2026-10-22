const BASE_URL = '/api';

export const getToken = (): string | null => localStorage.getItem('clinixos_token');
export const setToken = (token: string): void => localStorage.setItem('clinixos_token', token);
export const removeToken = (): void => localStorage.removeItem('clinixos_token');

export async function request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `HTTP ${response.status}: ${response.statusText}`);
  }

  return data;
}

export const api = {
  // ─── Auth ───────────────────────────────────────────────────
  login: (credentials: any) => request('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
  register: (data: any) => request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  getMe: () => request('/auth/me'),

  // ─── Patients ───────────────────────────────────────────────
  searchPatients: (q?: string) => request(`/patients${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  getPatientTimeline: (id: string | number) => request(`/patients/${id}`),
  registerPatient: (data: any) => request('/patients', { method: 'POST', body: JSON.stringify(data) }),
  updatePatient: (id: number, data: any) => request(`/patients/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  // ─── Beds ────────────────────────────────────────────────────
  getBeds: () => request('/beds'),
  updateBedStatus: (id: number, status: string, patient_id?: number | null) =>
    request(`/beds/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status, patient_id }) }),
  addBed: (data: any) => request('/beds', { method: 'POST', body: JSON.stringify(data) }),
  deleteBed: (id: number) => request(`/beds/${id}`, { method: 'DELETE' }),

  // ─── Appointments ────────────────────────────────────────────
  getAppointments: (params?: any) => {
    const query = new URLSearchParams(params || {}).toString();
    return request(`/appointments${query ? `?${query}` : ''}`);
  },
  getDoctorAvailability: (doctorId: number, date: string) =>
    request(`/appointments/availability?doctor_id=${doctorId}&date=${date}`),
  bookAppointment: (data: any) => request('/appointments', { method: 'POST', body: JSON.stringify(data) }),
  updateAppointmentStatus: (id: number, status: string) =>
    request(`/appointments/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  cancelAppointment: (id: number, reason?: string) =>
    request(`/appointments/${id}/cancel`, { method: 'PATCH', body: JSON.stringify({ reason }) }),

  // ─── Doctors ────────────────────────────────────────────────
  getDoctors: () => request('/doctors'),
  toggleDoctorLeave: (id: number, is_on_leave: boolean) =>
    request(`/doctors/${id}/leave`, { method: 'PATCH', body: JSON.stringify({ is_on_leave }) }),
  getDoctorWorkload: (id: number) => request(`/doctors/${id}/workload`),

  // ─── Prescriptions ───────────────────────────────────────────
  getPrescriptions: (params?: any) => {
    const query = new URLSearchParams(params || {}).toString();
    return request(`/prescriptions${query ? `?${query}` : ''}`);
  },
  getIcd10Codes: (q?: string) => request(`/prescriptions/icd10${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  createPrescription: (data: any) => request('/prescriptions', { method: 'POST', body: JSON.stringify(data) }),
  getPrescriptionDetail: (id: number) => request(`/prescriptions/${id}`),

  // ─── Pharmacy ────────────────────────────────────────────────
  getInventory: (params?: any) => {
    const query = new URLSearchParams(params || {}).toString();
    return request(`/pharmacy/inventory${query ? `?${query}` : ''}`);
  },
  scanBarcode: (barcode: string) => request(`/pharmacy/barcode/${barcode}`),
  dispensePrescription: (prescriptionId: number) =>
    request('/pharmacy/dispense', { method: 'POST', body: JSON.stringify({ prescription_id: prescriptionId }) }),
  adjustInventory: (id: number, data: any) =>
    request(`/pharmacy/inventory/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  addInventoryItem: (data: any) => request('/pharmacy/inventory', { method: 'POST', body: JSON.stringify(data) }),
  getPharmacyStats: () => request('/pharmacy/stats'),
  getLowStockAlerts: () => request('/pharmacy/alerts/low-stock'),

  // ─── Billing ─────────────────────────────────────────────────
  getBills: (params?: any) => {
    const query = new URLSearchParams(params || {}).toString();
    return request(`/billing${query ? `?${query}` : ''}`);
  },
  getBillDetails: (id: number) => request(`/billing/${id}`),
  payBill: (id: number, data: any) => request(`/billing/${id}/pay`, { method: 'POST', body: JSON.stringify(data) }),
  createBill: (data: any) => request('/billing', { method: 'POST', body: JSON.stringify(data) }),
  addBillItem: (billId: number, data: any) => request(`/billing/${billId}/items`, { method: 'POST', body: JSON.stringify(data) }),
  generateInvoicePdf: (billId: number) => `${BASE_URL}/billing/${billId}/invoice`,

  // ─── Reports ─────────────────────────────────────────────────
  getStats: (period?: string) => request(`/reports/stats${period ? `?period=${period}` : ''}`),
  downloadReportPdfUrl: (type: string) => `${BASE_URL}/reports/pdf/${type}`,
  getAuditLog: (params?: any) => {
    const query = new URLSearchParams(params || {}).toString();
    return request(`/reports/audit${query ? `?${query}` : ''}`);
  },

  // ─── Feedback ────────────────────────────────────────────────
  getFeedback: (doctorId?: number) => request(`/feedback${doctorId ? `?doctor_id=${doctorId}` : ''}`),
  submitFeedback: (data: any) => request('/feedback', { method: 'POST', body: JSON.stringify(data) }),

  // ─── Lab Console ─────────────────────────────────────────────
  getLabOrders: (params?: any) => {
    const query = new URLSearchParams(
      Object.fromEntries(Object.entries(params || {}).filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => [k, String(v)]))
    ).toString();
    return request(`/lab/orders${query ? `?${query}` : ''}`);
  },
  createLabOrder: (data: any) => request('/lab/orders', { method: 'POST', body: JSON.stringify(data) }),
  updateLabResult: (data: any) => request('/lab/results', { method: 'POST', body: JSON.stringify(data) }),
  updateLabOrderStatus: (data: any) => request('/lab/orders/status', { method: 'PATCH', body: JSON.stringify(data) }),
  getLabOrderDetail: (id: number) => request(`/lab/orders/${id}`),
  downloadLabReport: (id: number) => `${BASE_URL}/lab/orders/${id}/report`,

  // ─── ICU Monitor ─────────────────────────────────────────────
  getICUStatus: () => request('/icu/status'),
  admitToICU: (data: any) => request('/icu/admit', { method: 'POST', body: JSON.stringify(data) }),
  dischargeFromICU: (data: any) => request('/icu/discharge', { method: 'POST', body: JSON.stringify(data) }),
  updateICUVitals: (data: any) => request('/icu/vitals', { method: 'POST', body: JSON.stringify(data) }),
  getICUVitalsHistory: (icuPatientId: number) => request(`/icu/vitals/${icuPatientId}/history`),
  addICUAlert: (data: any) => request('/icu/alerts', { method: 'POST', body: JSON.stringify(data) }),
  resolveICUAlert: (alertId: number) => request(`/icu/alerts/${alertId}/resolve`, { method: 'PATCH' }),

  // ─── User Management (Admin only) ────────────────────────────
  getSystemUsers: (params?: any) => {
    const query = new URLSearchParams(
      Object.fromEntries(Object.entries(params || {}).filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => [k, String(v)]))
    ).toString();
    return request(`/users${query ? `?${query}` : ''}`);
  },
  createSystemUser: (data: any) => request('/users', { method: 'POST', body: JSON.stringify(data) }),
  updateSystemUser: (data: any) => request(`/users/${data.id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  toggleUserActive: (data: any) => request(`/users/${data.id}/toggle-active`, { method: 'PATCH', body: JSON.stringify(data) }),
  resetUserPassword: (data: any) => request(`/users/${data.id}/reset-password`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteSystemUser: (id: number) => request(`/users/${id}`, { method: 'DELETE' }),

  // ─── Notifications ────────────────────────────────────────────
  getNotifications: () => request('/notifications'),
  markNotificationRead: (id: number) => request(`/notifications/${id}/read`, { method: 'PATCH' }),
  markAllNotificationsRead: () => request('/notifications/read-all', { method: 'PATCH' }),
};
