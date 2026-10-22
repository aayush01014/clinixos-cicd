import React, { useState, useEffect } from 'react';
import { Patient, Doctor, Medication, PrescriptionItem, UserRole } from '../types';
import { api } from '../services/api';
import { Stethoscope, Plus, Trash2, CheckCircle, Search, Clock, FileText, AlertCircle } from 'lucide-react';

interface DoctorWorkspaceProps {
  currentRole: UserRole;
}

export const DoctorWorkspace: React.FC<DoctorWorkspaceProps> = () => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [patientTimeline, setPatientTimeline] = useState<any | null>(null);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [activeDoctorId, setActiveDoctorId] = useState<string>('');

  // Diagnosis & ICD-10 Search
  const [diagnosis, setDiagnosis] = useState('');
  const [icdSearchQuery, setIcdSearchQuery] = useState('');
  const [icdResults, setIcdResults] = useState<any[]>([]);
  const [selectedIcdCode, setSelectedIcdCode] = useState<string>('');

  // Prescription Items (Empty by default, formulated dynamically by doctor)
  const [rxItems, setRxItems] = useState<PrescriptionItem[]>([]);

  const [doctorSignature, setDoctorSignature] = useState('');
  const [isOnLeave, setIsOnLeave] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; isError: boolean } | null>(null);

  useEffect(() => {
    loadPatients();
    loadMedications();
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

  const loadMedications = async () => {
    try {
      const res = await api.getInventory();
      if (res.success) setMedications(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadDoctors = async () => {
    try {
      const res = await api.getDoctors();
      if (res.success && res.data.length > 0) {
        setDoctors(res.data);
        setActiveDoctorId(String(res.data[0].id));
        setIsOnLeave(Boolean(res.data[0].is_on_leave));
        setDoctorSignature(`Electronically signed by Lic. #${res.data[0].license_number}`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Load patient clinical timeline when selected
  useEffect(() => {
    if (selectedPatientId) {
      loadTimeline(selectedPatientId);
    }
  }, [selectedPatientId]);

  const loadTimeline = async (id: string) => {
    try {
      const res = await api.getPatientTimeline(id);
      if (res.success) {
        setPatientTimeline(res.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Search ICD-10 codes dynamically
  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const res = await api.getIcd10Codes(icdSearchQuery);
        if (res.success) setIcdResults(res.data);
      } catch (err) {
        console.error(err);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [icdSearchQuery]);

  const handleAddRxItem = () => {
    if (medications.length > 0) {
      setRxItems([
        ...rxItems,
        {
          medication_id: medications[0].id,
          dosage: '1 tablet',
          frequency: 'Once daily in morning',
          duration_days: 7,
          quantity: 7
        }
      ]);
    }
  };

  const handleRemoveRxItem = (index: number) => {
    setRxItems(rxItems.filter((_, i) => i !== index));
  };

  const handleUpdateRxItem = (index: number, field: keyof PrescriptionItem, value: any) => {
    const copy = [...rxItems];
    copy[index] = { ...copy[index], [field]: value };
    setRxItems(copy);
  };

  const handleToggleLeave = async () => {
    if (!activeDoctorId) return;
    try {
      const newStatus = !isOnLeave;
      const res = await api.toggleDoctorLeave(Number(activeDoctorId), newStatus);
      if (res.success) {
        setIsOnLeave(newStatus);
        setFeedbackMsg({
          text: `Doctor schedule leave status updated to: ${newStatus ? 'On Leave (Calendar Blocked)' : 'Active (Available)'}`,
          isError: false
        });
      }
    } catch (err: any) {
      setFeedbackMsg({ text: err.message, isError: true });
    }
  };

  const handleSubmitPrescription = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedbackMsg(null);

    if (!selectedPatientId || !activeDoctorId || !diagnosis || rxItems.length === 0) {
      setFeedbackMsg({ text: 'Please fill in diagnosis and at least one medication formulation.', isError: true });
      return;
    }

    try {
      const res = await api.createPrescription({
        patient_id: Number(selectedPatientId),
        doctor_id: Number(activeDoctorId),
        diagnosis,
        icd10_code: selectedIcdCode,
        doctor_signature: doctorSignature,
        items: rxItems
      });

      if (res.success) {
        setFeedbackMsg({ text: `Prescription successfully signed and queued to Pharmacy! Ref: RX-${res.prescriptionId}`, isError: false });
        setDiagnosis('');
        setSelectedIcdCode('');
        loadTimeline(selectedPatientId);
      }
    } catch (err: any) {
      setFeedbackMsg({ text: err.message || 'Error signing prescription.', isError: true });
    }
  };

  const activeDoctor = doctors.find((d) => d.id === Number(activeDoctorId));

  return (
    <div style={{ maxWidth: 1440, margin: '0 auto', padding: '24px' }}>
      {/* Top Banner & Doctor Leave Switcher */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 12 }}>
            <Stethoscope size={28} color="#06b6d4" /> Doctor Clinical Workspace
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: 4 }}>
            Split-pane clinical chart review, ICD-10 diagnostics, and digitally signed electronic prescriptions.
          </p>
        </div>

        <div className="glass-panel" style={{ padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 16 }}>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>Consulting Specialist:</div>
            <select
              className="glass-input"
              style={{ padding: '4px 8px', fontSize: '0.82rem', marginTop: 2 }}
              value={activeDoctorId}
              onChange={(e) => {
                setActiveDoctorId(e.target.value);
                const doc = doctors.find((d) => d.id === Number(e.target.value));
                if (doc) {
                  setIsOnLeave(Boolean(doc.is_on_leave));
                  setDoctorSignature(`Electronically signed by Lic. #${doc.license_number}`);
                }
              }}
            >
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.specialization} ({d.department}) - Lic #{d.license_number}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={handleToggleLeave}
            className={`glass-btn ${isOnLeave ? 'glass-btn-danger' : 'glass-btn-secondary'}`}
            style={{ fontSize: '0.8rem', padding: '6px 12px' }}
          >
            <Clock size={14} /> {isOnLeave ? 'Mark as Active' : 'Mark On Leave'}
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
          {feedbackMsg.isError ? <AlertCircle size={18} /> : <CheckCircle size={18} />}
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* Split-Pane Clinical Interface (SRS Section 3.1) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.35fr', gap: 24 }}>
        {/* LEFT PANE: Patient Demographics & Scrollable Clinical History */}
        <div className="glass-panel" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 8 }}>
              Select Patient Chart:
            </label>
            <select
              className="glass-input"
              value={selectedPatientId}
              onChange={(e) => setSelectedPatientId(e.target.value)}
            >
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.pid} - {p.first_name} {p.last_name} ({p.gender}, DOB: {p.dob})
                </option>
              ))}
            </select>
          </div>

          {patientTimeline?.patient && (
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-glass)', borderRadius: 12, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>
                  {patientTimeline.patient.first_name} {patientTimeline.patient.last_name}
                </span>
                <span className="badge badge-vacant">{patientTimeline.patient.pid}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                <div>DOB: <span style={{ color: '#0f172a', fontWeight: 600 }}>{patientTimeline.patient.dob}</span></div>
                <div>Gender: <span style={{ color: '#0f172a', fontWeight: 600 }}>{patientTimeline.patient.gender}</span></div>
                <div>Blood: <span style={{ color: '#0f172a', fontWeight: 600 }}>{patientTimeline.patient.blood_group || 'O+'}</span></div>
                <div>Contact: <span style={{ color: '#0f172a', fontWeight: 600 }}>{patientTimeline.patient.contact_number}</span></div>
              </div>

              {patientTimeline.currentBed && (
                <div style={{ marginTop: 10, padding: 8, background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)', borderRadius: 6, fontSize: '0.75rem', color: '#fda4af' }}>
                  Currently Admitted: Bed {patientTimeline.currentBed.bed_label} ({patientTimeline.currentBed.ward_number})
                </div>
              )}
            </div>
          )}

          {/* Chronological Clinical Timeline */}
          <div>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#38bdf8', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Clock size={16} /> Chronological Clinical Records &amp; Visits
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 380, overflowY: 'auto' }}>
              {patientTimeline?.prescriptions?.length === 0 && patientTimeline?.appointments?.length === 0 ? (
                <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.82rem' }}>
                  No prior clinical history recorded for this patient file.
                </div>
              ) : (
                patientTimeline?.prescriptions?.map((pr: any) => (
                  <div key={pr.id} style={{ padding: 12, borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-glass)', fontSize: '0.8rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#38bdf8', fontWeight: 700 }}>
                      <span>RX-{pr.id} • {pr.specialization}</span>
                      <span style={{ color: pr.status === 'Dispensed' ? '#34d399' : '#fde68a' }}>{pr.status}</span>
                    </div>
                    <div style={{ color: '#0f172a', marginTop: 4, fontWeight: 600 }}>Diagnosis: {pr.diagnosis}</div>
                    {pr.icd10_code && <div style={{ color: 'var(--text-dim)', fontSize: '0.72rem' }}>ICD-10 Code: {pr.icd10_code}</div>}
                    <div style={{ color: 'var(--text-dim)', fontSize: '0.7rem', marginTop: 4 }}>{pr.created_at}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* RIGHT PANE: Digital Diagnosis & Prescription Builder (BR-02) */}
        <div className="glass-panel" style={{ padding: 24 }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: 16, color: '#0f172a' }}>
            Clinical Examination &amp; Digital Prescription
          </h2>

          <form onSubmit={handleSubmitPrescription} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Diagnosis & ICD-10 Search */}
            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                Primary Clinical Diagnosis *
              </label>
              <textarea
                required
                rows={2}
                className="glass-input"
                placeholder="e.g. Acute upper respiratory tract infection with secondary bronchospasm..."
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
              />
            </div>

            {/* ICD-10 Live Catalog Search */}
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-glass)', borderRadius: 10, padding: 14 }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--cyan-accent)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <Search size={14} /> ICD-10 Diagnostic Classification Standard:
              </label>
              <input
                type="text"
                className="glass-input"
                placeholder="Type disease keyword (e.g. asthma, diabetes, hypertension, pneumonia)..."
                value={icdSearchQuery}
                onChange={(e) => setIcdSearchQuery(e.target.value)}
              />

              {icdResults.length > 0 && icdSearchQuery && (
                <div style={{ maxHeight: 150, overflowY: 'auto', marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {icdResults.map((entry) => (
                    <div
                      key={entry.code}
                      onClick={() => {
                        setSelectedIcdCode(`${entry.code} - ${entry.description}`);
                        setDiagnosis((prev) => (prev ? prev : entry.description));
                        setIcdSearchQuery('');
                      }}
                      style={{
                        padding: '6px 10px',
                        borderRadius: 6,
                        background: 'rgba(15,23,42,0.8)',
                        border: '1px solid var(--border-glass)',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between'
                      }}
                    >
                      <span style={{ color: '#38bdf8', fontWeight: 700 }}>{entry.code}</span>
                      <span style={{ color: 'var(--text-main)', marginLeft: 8 }}>{entry.description}</span>
                    </div>
                  ))}
                </div>
              )}

              {selectedIcdCode && (
                <div style={{ marginTop: 8, fontSize: '0.75rem', color: '#34d399', fontWeight: 600 }}>
                  Selected ICD-10: {selectedIcdCode}
                </div>
              )}
            </div>

            {/* Dynamic Medication Formulations */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a' }}>
                  Prescribed Medication Formulations:
                </label>
                <button
                  type="button"
                  onClick={handleAddRxItem}
                  className="glass-btn glass-btn-secondary"
                  style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                >
                  <Plus size={14} /> Add Medicine
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {rxItems.length === 0 ? (
                  <div style={{ padding: 14, textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.82rem', background: 'rgba(255,255,255,0.4)', borderRadius: 10, border: '1px dashed var(--glass-border-subtle)' }}>
                    No medications prescribed yet. Click &quot;+ Add Medicine&quot; above to select from the hospital formulary.
                  </div>
                ) : (
                  rxItems.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: 12,
                      borderRadius: 10,
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid var(--border-glass)',
                      display: 'grid',
                      gridTemplateColumns: '1.4fr 1fr 1fr 60px 40px',
                      gap: 8,
                      alignItems: 'center'
                    }}
                  >
                    <select
                      className="glass-input"
                      style={{ fontSize: '0.78rem', padding: '6px 8px' }}
                      value={item.medication_id}
                      onChange={(e) => handleUpdateRxItem(idx, 'medication_id', Number(e.target.value))}
                    >
                      {medications.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.dosage_form || 'Tab'}) - In Stock: {m.stock_count}
                        </option>
                      ))}
                    </select>

                    <input
                      type="text"
                      className="glass-input"
                      style={{ fontSize: '0.78rem', padding: '6px 8px' }}
                      placeholder="e.g. 500mg"
                      value={item.dosage}
                      onChange={(e) => handleUpdateRxItem(idx, 'dosage', e.target.value)}
                    />

                    <input
                      type="text"
                      className="glass-input"
                      style={{ fontSize: '0.78rem', padding: '6px 8px' }}
                      placeholder="e.g. TDS after meals"
                      value={item.frequency}
                      onChange={(e) => handleUpdateRxItem(idx, 'frequency', e.target.value)}
                    />

                    <input
                      type="number"
                      className="glass-input"
                      style={{ fontSize: '0.78rem', padding: '6px 8px' }}
                      placeholder="Qty"
                      min={1}
                      value={item.quantity}
                      onChange={(e) => handleUpdateRxItem(idx, 'quantity', Number(e.target.value))}
                    />

                    {rxItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveRxItem(idx)}
                        style={{ background: 'transparent', border: 'none', color: '#f43f5e', cursor: 'pointer' }}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                )))}
              </div>
            </div>

            {/* Doctor Signature (BR-02 Requirement) */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 12 }}>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-dim)', display: 'block', marginBottom: 4 }}>
                Digital License Signature:
              </label>
              <input
                type="text"
                readOnly
                className="glass-input"
                style={{ color: '#38bdf8', fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}
                value={doctorSignature}
              />
            </div>

            <button
              type="submit"
              className="glass-btn"
              style={{ justifyContent: 'center', marginTop: 4 }}
            >
              <CheckCircle size={18} /> Issue &amp; Route to Pharmacy Console
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
