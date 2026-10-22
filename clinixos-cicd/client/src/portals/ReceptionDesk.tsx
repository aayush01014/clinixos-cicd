import React, { useState, useEffect } from 'react';
import { Patient, Doctor, Appointment, Bill, UserRole } from '../types';
import { api } from '../services/api';
import { UserPlus, Calendar, CreditCard, Printer, Search, Check, AlertCircle } from 'lucide-react';

interface ReceptionDeskProps {
  currentRole: UserRole;
}

export const ReceptionDesk: React.FC<ReceptionDeskProps> = ({ currentRole }) => {
  const [activeSubTab, setActiveSubTab] = useState<'intake' | 'appointments' | 'billing'>('intake');

  // Intake Form State (Zero hardcoded names, clean placeholders)
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState<'Male' | 'Female' | 'Other'>('Male');
  const [contactNumber, setContactNumber] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [bloodGroup, setBloodGroup] = useState('O+');
  const [registeredPid, setRegisteredPid] = useState<string | null>(null);

  // Scheduling State
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
  const [appointmentDate, setAppointmentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string>('');
  const [doctorLeaveMessage, setDoctorLeaveMessage] = useState<string | null>(null);

  // Billing State
  const [bills, setBills] = useState<Bill[]>([]);
  const [selectedBillForPay, setSelectedBillForPay] = useState<Bill | null>(null);
  const [payAmount, setPayAmount] = useState<string>('');
  const [payMethod, setPayMethod] = useState<'Cash' | 'Card' | 'Online'>('Cash');
  const [insuranceProvider, setInsuranceProvider] = useState<string>('');
  const [insurancePolicyNo, setInsurancePolicyNo] = useState<string>('');
  const [insuranceClaimAmount, setInsuranceClaimAmount] = useState<string>('');
  const [receiptModalBill, setReceiptModalBill] = useState<any | null>(null);

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; isError: boolean } | null>(null);

  useEffect(() => {
    loadPatients();
    loadDoctors();
    loadBills();
  }, []);

  const loadPatients = async (query?: string) => {
    try {
      const res = await api.searchPatients(query);
      if (res.success) setPatients(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadDoctors = async () => {
    try {
      const res = await api.getDoctors();
      if (res.success) setDoctors(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadBills = async () => {
    try {
      const res = await api.getBills();
      if (res.success) setBills(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  // Load available doctor slots when doctor or date changes
  useEffect(() => {
    if (selectedDoctorId && appointmentDate) {
      checkSlots(Number(selectedDoctorId), appointmentDate);
    }
  }, [selectedDoctorId, appointmentDate]);

  const checkSlots = async (docId: number, date: string) => {
    try {
      const res = await api.getDoctorAvailability(docId, date);
      if (res.success) {
        if (res.isOnLeave) {
          setDoctorLeaveMessage(res.message);
          setAvailableSlots([]);
        } else {
          setDoctorLeaveMessage(null);
          setAvailableSlots(res.availableSlots || []);
          if (res.availableSlots && res.availableSlots.length > 0) {
            setSelectedSlot(res.availableSlots[0]);
          } else {
            setSelectedSlot('');
          }
        }
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  // Handle Patient Intake Submission (FR-01.1, FR-01.3)
  const handleIntakeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedbackMsg(null);
    setRegisteredPid(null);

    try {
      const payload = {
        first_name: firstName,
        last_name: lastName,
        dob,
        gender,
        contact_number: contactNumber,
        emergency_contact: emergencyContact,
        blood_group: bloodGroup
      };

      const res = await api.registerPatient(payload);
      if (res.success) {
        setRegisteredPid(res.patient.pid);
        setFeedbackMsg({ text: `Patient successfully registered with Unique PID: ${res.patient.pid}`, isError: false });
        // Reset form
        setFirstName('');
        setLastName('');
        setContactNumber('');
        setEmergencyContact('');
        loadPatients();
      }
    } catch (err: any) {
      setFeedbackMsg({ text: err.message || 'Intake failed.', isError: true });
    }
  };

  // Handle Appointment Booking Submission (FR-02.1, FR-02.4)
  const handleAppointmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedbackMsg(null);

    if (!selectedPatientId || !selectedDoctorId || !appointmentDate || !selectedSlot) {
      setFeedbackMsg({ text: 'Please fill in all appointment booking fields.', isError: true });
      return;
    }

    try {
      const payload = {
        patient_id: Number(selectedPatientId),
        doctor_id: Number(selectedDoctorId),
        appointment_date: appointmentDate,
        time_slot: selectedSlot
      };

      const res = await api.bookAppointment(payload);
      if (res.success) {
        setFeedbackMsg({ text: `Appointment confirmed for ${appointmentDate} at ${selectedSlot}. Ref ID: AP-${res.appointment.id}`, isError: false });
        // Refresh availability
        checkSlots(Number(selectedDoctorId), appointmentDate);
      }
    } catch (err: any) {
      setFeedbackMsg({ text: err.message || 'Booking conflict detected.', isError: true });
    }
  };

  // Handle Bill Payment (FR-09.2, FR-09.3)
  const handleProcessPayment = async () => {
    if (!selectedBillForPay) return;
    setFeedbackMsg(null);

    try {
      const res = await api.payBill(selectedBillForPay.id, {
        paid_amount: Number(payAmount),
        payment_method: payMethod,
        insurance_provider: insuranceProvider,
        insurance_policy_no: insurancePolicyNo,
        insurance_claim_amount: Number(insuranceClaimAmount)
      });

      if (res.success) {
        setFeedbackMsg({ text: 'Payment & Insurance reconciliation recorded successfully.', isError: false });
        loadBills();
        // Load details for receipt
        const billDetails = await api.getBillDetails(selectedBillForPay.id);
        setReceiptModalBill(billDetails.data);
        setSelectedBillForPay(null);
      }
    } catch (err: any) {
      setFeedbackMsg({ text: err.message || 'Payment processing failed.', isError: true });
    }
  };

  return (
    <div style={{ maxWidth: 1440, margin: '0 auto', padding: '24px' }}>
      {/* Header & Sub-Tabs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 12 }}>
            <UserPlus size={28} color="#06b6d4" /> Receptionist Intake & Billing Desk
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: 4 }}>
            Walk-in patient registration, doctor slot booking, invoice itemization, and receipt printing.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setActiveSubTab('intake')}
            className={activeSubTab === 'intake' ? 'glass-btn' : 'glass-btn glass-btn-secondary'}
          >
            <UserPlus size={16} /> Patient Intake
          </button>
          <button
            onClick={() => setActiveSubTab('appointments')}
            className={activeSubTab === 'appointments' ? 'glass-btn' : 'glass-btn glass-btn-secondary'}
          >
            <Calendar size={16} /> Slot Booking
          </button>
          <button
            onClick={() => setActiveSubTab('billing')}
            className={activeSubTab === 'billing' ? 'glass-btn' : 'glass-btn glass-btn-secondary'}
          >
            <CreditCard size={16} /> Invoices &amp; Billing
          </button>
        </div>
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
          {feedbackMsg.isError ? <AlertCircle size={18} /> : <Check size={18} />}
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* 1. WALK-IN PATIENT INTAKE FORM (FR-01) */}
      {activeSubTab === 'intake' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(350px, 1.2fr) 1fr', gap: 24 }}>
          <div className="glass-panel" style={{ padding: 28 }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: 16, color: '#0f172a' }}>
              Walk-in Patient Registration
            </h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 20 }}>
              Mandatory fields generate a permanent, non-modifiable sequential Patient Identification Number (PID).
            </p>

            <form onSubmit={handleIntakeSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                    First Name *
                  </label>
                  <input
                    type="text"
                    required
                    className="glass-input"
                    placeholder="e.g. Eleanor"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                    Last Name *
                  </label>
                  <input
                    type="text"
                    required
                    className="glass-input"
                    placeholder="e.g. Vance"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                    Date of Birth *
                  </label>
                  <input
                    type="date"
                    required
                    className="glass-input"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                    Gender *
                  </label>
                  <select
                    className="glass-input"
                    value={gender}
                    onChange={(e) => setGender(e.target.value as any)}
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                    Contact Number *
                  </label>
                  <input
                    type="tel"
                    required
                    className="glass-input"
                    placeholder="e.g. +1 555-019-2834"
                    value={contactNumber}
                    onChange={(e) => setContactNumber(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                    Emergency Contact *
                  </label>
                  <input
                    type="tel"
                    required
                    className="glass-input"
                    placeholder="e.g. +1 555-982-1100"
                    value={emergencyContact}
                    onChange={(e) => setEmergencyContact(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                  Blood Group
                </label>
                <select
                  className="glass-input"
                  value={bloodGroup}
                  onChange={(e) => setBloodGroup(e.target.value)}
                >
                  {['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map((bg) => (
                    <option key={bg} value={bg}>{bg}</option>
                  ))}
                </select>
              </div>

              <button type="submit" className="glass-btn" style={{ marginTop: 8, justifyContent: 'center' }}>
                <UserPlus size={18} /> Register & Generate Sequential PID
              </button>
            </form>

            {registeredPid && (
              <div style={{ marginTop: 20, padding: 16, background: 'rgba(6, 182, 212, 0.15)', border: '1px solid var(--cyan-accent)', borderRadius: 10 }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Assigned Identification Number:</span>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#38bdf8', letterSpacing: '0.05em' }}>
                  {registeredPid}
                </div>
              </div>
            )}
          </div>

          {/* Centralized Patient Index Search (FR-01.2) */}
          <div className="glass-panel" style={{ padding: 28 }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: 12, color: '#0f172a' }}>
              Centralized Patient Index
            </h2>
            <div style={{ position: 'relative', marginBottom: 16 }}>
              <Search size={18} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-dim)' }} />
              <input
                type="text"
                className="glass-input"
                placeholder="Search by PID, Name, or Phone..."
                style={{ paddingLeft: 38 }}
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  loadPatients(e.target.value);
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 440, overflowY: 'auto' }}>
              {patients.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-dim)', fontSize: '0.85rem' }}>
                  No patients found matching search query.
                </div>
              ) : (
                patients.map((p) => (
                  <div
                    key={p.id}
                    style={{
                      padding: '12px 16px',
                      borderRadius: 10,
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid var(--border-glass)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.95rem' }}>
                        {p.first_name} {p.last_name}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--cyan-accent)' }}>
                        PID: {p.pid} • {p.gender} • Blood: {p.blood_group || 'N/A'}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                        Phone: {p.contact_number}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPatientId(String(p.id));
                        setActiveSubTab('appointments');
                      }}
                      className="glass-btn glass-btn-secondary"
                      style={{ fontSize: '0.75rem', padding: '6px 10px' }}
                    >
                      Book Visit &rarr;
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. AUTOMATED APPOINTMENT SCHEDULING (FR-02) */}
      {activeSubTab === 'appointments' && (
        <div className="glass-panel" style={{ padding: 28, maxWidth: 800, margin: '0 auto' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: 16, color: '#0f172a' }}>
            Book Consultation Appointment
          </h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 20 }}>
            Automated conflict validation prevents double-booking and checks doctor leave in real time.
          </p>

          <form onSubmit={handleAppointmentSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                Select Registered Patient:
              </label>
              <select
                required
                className="glass-input"
                value={selectedPatientId}
                onChange={(e) => setSelectedPatientId(e.target.value)}
              >
                <option value="">-- Choose Patient by PID --</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.pid} - {p.first_name} {p.last_name} (Phone: {p.contact_number})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                  Select Doctor &amp; Specialization:
                </label>
                <select
                  required
                  className="glass-input"
                  value={selectedDoctorId}
                  onChange={(e) => setSelectedDoctorId(e.target.value)}
                >
                  <option value="">-- Select Specialist --</option>
                  {doctors.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.specialization} ({d.department}) - Room: {d.room_number} - ${d.consultation_fee}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                  Appointment Date:
                </label>
                <input
                  type="date"
                  required
                  className="glass-input"
                  value={appointmentDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setAppointmentDate(e.target.value)}
                />
              </div>
            </div>

            {/* Live Conflict-Free Available Slots (BR-01: 8:00 AM to 8:00 PM) */}
            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 8 }}>
                Real-Time Available Slots (Conflict Validated):
              </label>
              {doctorLeaveMessage ? (
                <div style={{ padding: 12, background: 'rgba(244, 63, 94, 0.15)', border: '1px solid #f43f5e', borderRadius: 8, color: '#fda4af', fontSize: '0.84rem' }}>
                  {doctorLeaveMessage}
                </div>
              ) : availableSlots.length === 0 ? (
                <div style={{ padding: 12, background: 'rgba(255,255,255,0.04)', borderRadius: 8, color: 'var(--text-dim)', fontSize: '0.84rem' }}>
                  Please select a doctor and date to load available time slots.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 8 }}>
                  {availableSlots.map((slot) => (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setSelectedSlot(slot)}
                      style={{
                        padding: '8px 10px',
                        borderRadius: 8,
                        border: selectedSlot === slot ? '2px solid var(--cyan-accent)' : '1px solid var(--border-glass)',
                        background: selectedSlot === slot ? 'rgba(6, 182, 212, 0.25)' : 'rgba(15, 23, 42, 0.6)',
                        color: selectedSlot === slot ? '#38bdf8' : 'var(--text-main)',
                        fontWeight: 700,
                        fontSize: '0.8rem',
                        cursor: 'pointer'
                      }}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={!selectedSlot || Boolean(doctorLeaveMessage)}
              className="glass-btn"
              style={{ marginTop: 8, justifyContent: 'center' }}
            >
              <Calendar size={18} /> Confirm &amp; Transmit Appointment Details
            </button>
          </form>
        </div>
      )}

      {/* 3. BILLING & INVOICING DESK (FR-09) */}
      {activeSubTab === 'billing' && (
        <div>
          <div className="glass-panel" style={{ padding: 24, marginBottom: 24 }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: 8, color: '#0f172a' }}>
              Pending Invoices &amp; Payment Processing
            </h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Automatically compiled itemized bills, insurance claim reconciliation, and receipt generation.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 18 }}>
            {bills.map((bill) => {
              const isPaid = bill.payment_status === 'Paid';
              const isPartial = bill.payment_status === 'Partially Paid';
              const isPending = bill.payment_status === 'Pending';

              return (
                <div
                  key={bill.id}
                  className="glass-panel"
                  style={{
                    padding: 20,
                    border: isPaid
                      ? '1px solid var(--status-vacant)'
                      : isPartial
                      ? '1px solid var(--status-cleaning)'
                      : '1px solid var(--status-occupied)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#38bdf8' }}>INV-{bill.id}</span>
                    <span
                      className={`badge ${
                        isPaid ? 'badge-vacant' : isPartial ? 'badge-cleaning' : 'badge-occupied'
                      }`}
                    >
                      {bill.payment_status}
                    </span>
                  </div>

                  <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>
                    {bill.patient_first ? `${bill.patient_first} ${bill.patient_last}` : 'Registered Patient'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: 12 }}>
                    PID: {bill.patient_pid || 'N/A'} • {bill.doctor_spec || 'Clinical Consultation'}
                  </div>

                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 10, display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
                    <div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Total Amount:</div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>${bill.total_amount.toFixed(2)}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Paid Amount:</div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#34d399' }}>${bill.paid_amount.toFixed(2)}</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    {!isPaid && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedBillForPay(bill);
                          setPayAmount(String(bill.total_amount - bill.paid_amount));
                        }}
                        className="glass-btn"
                        style={{ flex: 1, justifyContent: 'center', padding: '6px 10px', fontSize: '0.78rem' }}
                      >
                        <CreditCard size={14} /> Process Payment
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={async () => {
                        const billDetails = await api.getBillDetails(bill.id);
                        setReceiptModalBill(billDetails.data);
                      }}
                      className="glass-btn glass-btn-secondary"
                      style={{ flex: isPaid ? 1 : 'none', justifyContent: 'center', padding: '6px 10px', fontSize: '0.78rem' }}
                    >
                      <Printer size={14} /> Receipt
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Payment Processing Modal (FR-09.2, FR-09.3) */}
      {selectedBillForPay && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div className="glass-modal" style={{ width: '100%', maxWidth: 480, padding: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>
                Payment for INV-{selectedBillForPay.id}
              </h3>
              <button onClick={() => setSelectedBillForPay(null)} style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '1.4rem', cursor: 'pointer' }}>&times;</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Amount to Pay ($):</label>
                <input
                  type="number"
                  className="glass-input"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Payment Method:</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  {(['Cash', 'Card', 'Online'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPayMethod(m)}
                      style={{
                        padding: 8,
                        borderRadius: 8,
                        border: payMethod === m ? '2px solid var(--cyan-accent)' : '1px solid var(--border-glass)',
                        background: payMethod === m ? 'rgba(6, 182, 212, 0.25)' : 'rgba(15, 23, 42, 0.6)',
                        color: payMethod === m ? '#38bdf8' : 'var(--text-main)',
                        fontWeight: 700,
                        fontSize: '0.82rem',
                        cursor: 'pointer'
                      }}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Insurance Details (FR-09.3) */}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 10 }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--cyan-accent)', textTransform: 'uppercase' }}>Insurance Details (Optional):</span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8 }}>
                  <input
                    type="text"
                    className="glass-input"
                    placeholder="e.g. BlueCross Shield"
                    value={insuranceProvider}
                    onChange={(e) => setInsuranceProvider(e.target.value)}
                  />
                  <input
                    type="text"
                    className="glass-input"
                    placeholder="e.g. POL-98234-BC"
                    value={insurancePolicyNo}
                    onChange={(e) => setInsurancePolicyNo(e.target.value)}
                  />
                </div>
                <div style={{ marginTop: 8 }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Approved Insurance Claim Coverage ($):</label>
                  <input
                    type="number"
                    className="glass-input"
                    placeholder="Claim Amount ($)"
                    value={insuranceClaimAmount}
                    onChange={(e) => setInsuranceClaimAmount(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                <button type="button" onClick={() => setSelectedBillForPay(null)} className="glass-btn glass-btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>Cancel</button>
                <button type="button" onClick={handleProcessPayment} className="glass-btn" style={{ flex: 1, justifyContent: 'center' }}>Record Payment</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Printable Thermal Receipt Modal (FR-09.4) */}
      {receiptModalBill && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 16 }}>
          <div style={{ background: '#fff', color: '#111', fontFamily: 'monospace', width: 340, padding: 24, borderRadius: 8, boxShadow: '0 10px 40px rgba(0,0,0,0.5)' }}>
            <div style={{ textAlign: 'center', borderBottom: '1px dashed #444', paddingBottom: 10, marginBottom: 10 }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>CLINIXOS HOSPITAL</h3>
              <p style={{ fontSize: '0.75rem' }}>Official Payment Receipt</p>
              <p style={{ fontSize: '0.7rem', color: '#666' }}>{new Date().toLocaleString()}</p>
            </div>

            <div style={{ fontSize: '0.78rem', marginBottom: 10 }}>
              <div><b>Invoice:</b> INV-{receiptModalBill.bill?.id}</div>
              <div><b>Patient:</b> {receiptModalBill.bill?.first_name} {receiptModalBill.bill?.last_name}</div>
              <div><b>PID:</b> {receiptModalBill.bill?.patient_pid}</div>
              <div><b>Method:</b> {receiptModalBill.bill?.payment_method || 'Cash'}</div>
              <div><b>Status:</b> {receiptModalBill.bill?.payment_status}</div>
            </div>

            <div style={{ borderTop: '1px dashed #444', borderBottom: '1px dashed #444', padding: '8px 0', fontSize: '0.75rem', marginBottom: 10 }}>
              {receiptModalBill.lineItems?.map((item: any, i: number) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span>{item.description}</span>
                  <span>${Number(item.amount).toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', fontWeight: 800, marginBottom: 16 }}>
              <span>TOTAL PAID:</span>
              <span>${Number(receiptModalBill.bill?.paid_amount).toFixed(2)}</span>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => window.print()}
                style={{ flex: 1, padding: 8, background: '#111', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 700 }}
              >
                Print Token
              </button>
              <button
                onClick={() => setReceiptModalBill(null)}
                style={{ flex: 1, padding: 8, background: '#eee', color: '#333', border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
