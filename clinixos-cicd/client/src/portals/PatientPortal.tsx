import React, { useState, useEffect } from 'react';
import { Patient, Doctor, Appointment, Bill, Prescription, UserRole } from '../types';
import { api } from '../services/api';
import { User, Calendar, CreditCard, Star, FileText, CheckCircle, AlertCircle } from 'lucide-react';

interface PatientPortalProps {
  currentRole: UserRole;
}

export const PatientPortal: React.FC<PatientPortalProps> = () => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [timeline, setTimeline] = useState<any | null>(null);
  const [doctors, setDoctors] = useState<Doctor[]>([]);

  // Booking Form State
  const [bookingDoctorId, setBookingDoctorId] = useState<string>('');
  const [bookingDate, setBookingDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string>('');
  const [doctorLeaveNotice, setDoctorLeaveNotice] = useState<string | null>(null);

  // Feedback State (FR-01.5)
  const [feedbackDoctorId, setFeedbackDoctorId] = useState<string>('');
  const [feedbackRating, setFeedbackRating] = useState<number>(5);
  const [feedbackComments, setFeedbackComments] = useState<string>('');

  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);

  useEffect(() => {
    loadPatients();
    loadDoctors();
  }, []);

  const loadPatients = async () => {
    try {
      const res = await api.searchPatients();
      if (res.success && res.data.length > 0) {
        setPatients(res.data);
        setSelectedPatientId(String(res.data[0].id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadDoctors = async () => {
    try {
      const res = await api.getDoctors();
      if (res.success) {
        setDoctors(res.data);
        if (res.data.length > 0) {
          setBookingDoctorId(String(res.data[0].id));
          setFeedbackDoctorId(String(res.data[0].id));
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (selectedPatientId) {
      loadTimeline(selectedPatientId);
    }
  }, [selectedPatientId]);

  const loadTimeline = async (id: string) => {
    try {
      const res = await api.getPatientTimeline(id);
      if (res.success) {
        setTimeline(res.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Load slots when booking doctor or date changes
  useEffect(() => {
    if (bookingDoctorId && bookingDate) {
      api.getDoctorAvailability(Number(bookingDoctorId), bookingDate).then((res) => {
        if (res.success) {
          if (res.isOnLeave) {
            setDoctorLeaveNotice(res.message);
            setAvailableSlots([]);
          } else {
            setDoctorLeaveNotice(null);
            setAvailableSlots(res.availableSlots || []);
            if (res.availableSlots && res.availableSlots.length > 0) {
              setSelectedSlot(res.availableSlots[0]);
            } else {
              setSelectedSlot('');
            }
          }
        }
      });
    }
  }, [bookingDoctorId, bookingDate]);

  const handleBook = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    try {
      const res = await api.bookAppointment({
        patient_id: Number(selectedPatientId),
        doctor_id: Number(bookingDoctorId),
        appointment_date: bookingDate,
        time_slot: selectedSlot
      });

      if (res.success) {
        setMessage({ text: 'Appointment booked successfully! SMS confirmation dispatched.', isError: false });
        loadTimeline(selectedPatientId);
      }
    } catch (err: any) {
      setMessage({ text: err.message || 'Slot booking failed.', isError: true });
    }
  };

  const handlePayBill = async (billId: number, total: number) => {
    setMessage(null);
    try {
      const res = await api.payBill(billId, {
        paid_amount: total,
        payment_method: 'Online'
      });
      if (res.success) {
        setMessage({ text: `Payment of $${total} completed via Online Payment Gateway.`, isError: false });
        loadTimeline(selectedPatientId);
      }
    } catch (err: any) {
      setMessage({ text: err.message, isError: true });
    }
  };

  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    try {
      const res = await api.submitFeedback({
        patient_id: Number(selectedPatientId),
        doctor_id: Number(feedbackDoctorId),
        rating: feedbackRating,
        comments: feedbackComments
      });

      if (res.success) {
        setMessage({ text: 'Thank you! Your consultation review has been recorded.', isError: false });
        setFeedbackComments('');
      }
    } catch (err: any) {
      setMessage({ text: err.message, isError: true });
    }
  };

  return (
    <div style={{ maxWidth: 1440, margin: '0 auto', padding: '24px' }}>
      {/* Top Banner & Patient Selector */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 12 }}>
            <User size={28} color="#06b6d4" /> Patient Self-Service Portal
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: 4 }}>
            Book appointments (max 2 active slots), review electronic prescriptions, settle invoices, and submit feedback.
          </p>
        </div>

        <div className="glass-panel" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Logged-in Patient:</span>
          <select
            className="glass-input"
            style={{ padding: '4px 8px', fontSize: '0.82rem' }}
            value={selectedPatientId}
            onChange={(e) => setSelectedPatientId(e.target.value)}
          >
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.pid} - {p.first_name} {p.last_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {message && (
        <div
          style={{
            padding: '12px 18px',
            marginBottom: 20,
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: message.isError ? 'rgba(244, 63, 94, 0.2)' : 'rgba(16, 185, 129, 0.2)',
            border: `1px solid ${message.isError ? '#f43f5e' : '#10b981'}`,
            color: message.isError ? '#fda4af' : '#6ee7b7',
            fontSize: '0.88rem'
          }}
        >
          {message.isError ? <AlertCircle size={18} /> : <CheckCircle size={18} />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Main Grid: My Bookings & Prescriptions (Left), Invoices & Doctor Review (Right) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 24 }}>
        {/* LEFT PANE: Book Appointment & Active Prescriptions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Appointment Booking Card */}
          <div className="glass-panel" style={{ padding: 24 }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', marginBottom: 16 }}>
              Self-Service Appointment Booking
            </h2>

            <form onSubmit={handleBook} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                  Select Specialist / Department:
                </label>
                <select
                  className="glass-input"
                  value={bookingDoctorId}
                  onChange={(e) => setBookingDoctorId(e.target.value)}
                >
                  {doctors.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.specialization} ({d.department}) - Fee: ${d.consultation_fee}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                  Appointment Date:
                </label>
                <input
                  type="date"
                  className="glass-input"
                  min={new Date().toISOString().split('T')[0]}
                  value={bookingDate}
                  onChange={(e) => setBookingDate(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                  Available Time Slots:
                </label>
                {doctorLeaveNotice ? (
                  <div style={{ padding: 10, background: 'rgba(244,63,94,0.15)', borderRadius: 8, color: '#fda4af', fontSize: '0.8rem' }}>
                    {doctorLeaveNotice}
                  </div>
                ) : availableSlots.length === 0 ? (
                  <div style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>No slots available on this date.</div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 6 }}>
                    {availableSlots.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSelectedSlot(s)}
                        style={{
                          padding: '6px 8px',
                          borderRadius: 6,
                          border: selectedSlot === s ? '2px solid var(--cyan-accent)' : '1px solid var(--border-glass)',
                          background: selectedSlot === s ? 'rgba(6, 182, 212, 0.25)' : 'rgba(15, 23, 42, 0.6)',
                          color: selectedSlot === s ? '#38bdf8' : 'var(--text-main)',
                          fontWeight: 700,
                          fontSize: '0.78rem',
                          cursor: 'pointer'
                        }}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={!selectedSlot || Boolean(doctorLeaveNotice)}
                className="glass-btn"
                style={{ justifyContent: 'center', marginTop: 6 }}
              >
                <Calendar size={16} /> Confirm Appointment
              </button>
            </form>
          </div>

          {/* Active Digital Prescriptions */}
          <div className="glass-panel" style={{ padding: 24 }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', marginBottom: 16 }}>
              My Medical Prescriptions
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {timeline?.prescriptions?.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.85rem', padding: 20 }}>
                  No prescriptions recorded on file.
                </div>
              ) : (
                timeline?.prescriptions?.map((rx: any) => (
                  <div key={rx.id} style={{ padding: 14, borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-glass)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontWeight: 800, color: '#38bdf8' }}>RX-{rx.id}</span>
                      <span className={`badge ${rx.status === 'Dispensed' ? 'badge-vacant' : 'badge-cleaning'}`}>
                        {rx.status}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#0f172a', fontWeight: 600 }}>{rx.diagnosis}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: 4 }}>
                      Prescribing Doctor: {rx.specialization} (Lic #{rx.license_number})
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* RIGHT PANE: Invoices & Feedback Rating */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Outstanding Bills & Payment */}
          <div className="glass-panel" style={{ padding: 24 }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', marginBottom: 16 }}>
              Invoices &amp; Online Payment
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {timeline?.bills?.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.85rem', padding: 20 }}>
                  No pending invoices for this patient.
                </div>
              ) : (
                timeline?.bills?.map((b: any) => {
                  const isPaid = b.payment_status === 'Paid';
                  return (
                    <div key={b.id} style={{ padding: 14, borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-glass)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <span style={{ fontWeight: 800, color: '#0f172a' }}>INV-{b.id}</span>
                        <span className={`badge ${isPaid ? 'badge-vacant' : 'badge-occupied'}`}>{b.payment_status}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '8px 0' }}>
                        <div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Payable Total:</div>
                          <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>${b.total_amount.toFixed(2)}</div>
                        </div>
                        {!isPaid && (
                          <button
                            type="button"
                            onClick={() => handlePayBill(b.id, b.total_amount)}
                            className="glass-btn"
                            style={{ padding: '6px 12px', fontSize: '0.78rem' }}
                          >
                            <CreditCard size={14} /> Settle Bill
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Consultation Feedback & Star Rating (FR-01.5) */}
          <div className="glass-panel" style={{ padding: 24 }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>
              Consultation Feedback
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 16 }}>
              Submit confidential reviews regarding your completed medical consultations.
            </p>

            <form onSubmit={handleSubmitFeedback} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                  Select Doctor:
                </label>
                <select
                  className="glass-input"
                  value={feedbackDoctorId}
                  onChange={(e) => setFeedbackDoctorId(e.target.value)}
                >
                  {doctors.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.specialization} ({d.department})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                  Rating (1 to 5 Stars):
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setFeedbackRating(star)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        transform: feedbackRating >= star ? 'scale(1.15)' : 'scale(1)',
                        transition: 'transform 0.15s ease'
                      }}
                    >
                      <Star size={24} color={feedbackRating >= star ? '#fbbf24' : '#475569'} fill={feedbackRating >= star ? '#fbbf24' : 'none'} />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                  Written Review / Experience:
                </label>
                <textarea
                  rows={2}
                  className="glass-input"
                  placeholder="Share details of your clinical consultation..."
                  value={feedbackComments}
                  onChange={(e) => setFeedbackComments(e.target.value)}
                />
              </div>

              <button type="submit" className="glass-btn" style={{ justifyContent: 'center' }}>
                <Star size={16} /> Submit Feedback
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
