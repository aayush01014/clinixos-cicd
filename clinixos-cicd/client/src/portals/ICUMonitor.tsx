import React, { useState, useEffect, useRef } from 'react';
import { UserRole } from '../types';
import { api } from '../services/api';
import { wsClient } from '../services/websocket';
import {
  Activity, Heart, Thermometer, Wind, Droplets, AlertTriangle,
  RefreshCw, BedDouble, Plus, Zap, TrendingUp, TrendingDown,
  Monitor, Shield, Clock, CheckCircle, X
} from 'lucide-react';

interface ICUMonitorProps {
  currentRole: UserRole;
}

type VitalStatus = 'Normal' | 'Warning' | 'Critical';

interface ICUPatient {
  id: number;
  bed_number: string;
  patient_id: number;
  patient_name: string;
  patient_age: number;
  patient_mrn: string;
  diagnosis: string;
  admitted_at: string;
  attending_doctor: string;
  vitals: {
    heart_rate: number;
    systolic_bp: number;
    diastolic_bp: number;
    spo2: number;
    temperature: number;
    respiratory_rate: number;
    last_updated: string;
  } | null;
  alerts: string[];
  consciousness_level: 'Alert' | 'Confused' | 'Drowsy' | 'Unresponsive';
  ventilator: boolean;
  isolation: boolean;
}

interface ICUStat {
  total_icu_beds: number;
  occupied: number;
  vacant: number;
  critical_count: number;
  on_ventilator: number;
  isolation_count: number;
}

// Vital Ranges
const VITAL_RANGES = {
  heart_rate: { normal: [60, 100], warning: [50, 120], unit: 'bpm', label: 'Heart Rate', icon: Heart },
  spo2: { normal: [95, 100], warning: [90, 100], unit: '%', label: 'SpO₂', icon: Droplets },
  temperature: { normal: [36.1, 37.2], warning: [35.5, 38.5], unit: '°C', label: 'Temp', icon: Thermometer },
  respiratory_rate: { normal: [12, 20], warning: [10, 25], unit: '/min', label: 'Resp Rate', icon: Wind },
  systolic_bp: { normal: [90, 140], warning: [80, 160], unit: 'mmHg', label: 'Systolic BP', icon: Activity },
  diastolic_bp: { normal: [60, 90], warning: [50, 100], unit: 'mmHg', label: 'Diastolic BP', icon: Activity },
};

function getVitalStatus(key: keyof typeof VITAL_RANGES, value: number): VitalStatus {
  const range = VITAL_RANGES[key];
  if (value >= range.normal[0] && value <= range.normal[1]) return 'Normal';
  if (value >= range.warning[0] && value <= range.warning[1]) return 'Warning';
  return 'Critical';
}

const STATUS_COLORS: Record<VitalStatus, string> = {
  Normal: '#059669',
  Warning: '#d97706',
  Critical: '#e11d48',
};

function VitalWidget({ label, value, unit, status, Icon, animated }: {
  label: string;
  value: number;
  unit: string;
  status: VitalStatus;
  Icon: React.ElementType;
  animated?: boolean;
}) {
  const color = STATUS_COLORS[status];
  return (
    <div style={{
      background: status === 'Critical' ? 'rgba(225,29,72,0.08)' : 'rgba(241,245,249,0.7)',
      border: `1px solid ${status === 'Critical' ? 'rgba(225,29,72,0.4)' : 'var(--glass-border-subtle)'}`,
      borderRadius: 12, padding: '10px 14px', textAlign: 'center',
      animation: status === 'Critical' && animated ? 'criticalPulse 1s ease infinite' : undefined,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginBottom: 3 }}>
        <Icon size={13} color={color} />
        <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)', fontWeight: 600 }}>{label}</span>
      </div>
      <div style={{ fontSize: '1.25rem', fontWeight: 800, color, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', marginTop: 1 }}>{unit}</div>
    </div>
  );
}

export const ICUMonitor: React.FC<ICUMonitorProps> = ({ currentRole }) => {
  const [patients, setPatients] = useState<ICUPatient[]>([]);
  const [stats, setStats] = useState<ICUStat | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState<'monitor' | 'admit' | 'vitals'>('monitor');
  const [selectedPatient, setSelectedPatient] = useState<ICUPatient | null>(null);
  const [feedback, setFeedback] = useState<{ text: string; isError: boolean } | null>(null);
  const [alertsVisible, setAlertsVisible] = useState(true);
  const animationRef = useRef<number | null>(null);

  // Admit Form
  const [availablePatientsForAdmit, setAvailablePatientsForAdmit] = useState<any[]>([]);
  const [admitPatientId, setAdmitPatientId] = useState('');
  const [admitBedNumber, setAdmitBedNumber] = useState('');
  const [admitDiagnosis, setAdmitDiagnosis] = useState('');
  const [admitDoctor, setAdmitDoctor] = useState('');
  const [admitOnVentilator, setAdmitOnVentilator] = useState(false);
  const [admitIsolation, setAdmitIsolation] = useState(false);
  const [admitConsciousness, setAdmitConsciousness] = useState<ICUPatient['consciousness_level']>('Alert');
  const [admitLoading, setAdmitLoading] = useState(false);

  // Vitals Entry Form
  const [vitalsPatientId, setVitalsPatientId] = useState('');
  const [heartRate, setHeartRate] = useState('');
  const [systolicBp, setSystolicBp] = useState('');
  const [diastolicBp, setDiastolicBp] = useState('');
  const [spo2, setSpo2] = useState('');
  const [temperature, setTemperature] = useState('');
  const [respiratoryRate, setRespiratoryRate] = useState('');
  const [vitalsLoading, setVitalsLoading] = useState(false);

  const showFeedback = (text: string, isError = false) => {
    setFeedback({ text, isError });
    setTimeout(() => setFeedback(null), 4500);
  };

  const loadICUData = async () => {
    try {
      const res = await api.getICUStatus?.();
      if (res?.success) {
        setPatients(res.patients || []);
        setStats(res.stats || null);
      }
    } catch { /* empty */ } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadICUData();
    const interval = setInterval(loadICUData, 15000); // refresh every 15s

    // Subscribe to ICU alerts
    const unsub = wsClient.subscribe('ICU_WARNING', (payload) => {
      showFeedback(payload.warning || 'ICU Alert received!', true);
      loadICUData();
    });

    return () => {
      clearInterval(interval);
      unsub();
    };
  }, []);

  useEffect(() => {
    api.searchPatients?.().then(res => {
      if (res?.success) setAvailablePatientsForAdmit(res.data || []);
    });
  }, []);

  const handleAdmitICU = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!admitPatientId || !admitBedNumber || !admitDiagnosis) {
      showFeedback('Please fill all required fields.', true);
      return;
    }
    setAdmitLoading(true);
    try {
      const res = await api.admitToICU?.({
        patient_id: Number(admitPatientId),
        bed_number: admitBedNumber,
        diagnosis: admitDiagnosis,
        attending_doctor: admitDoctor,
        ventilator: admitOnVentilator,
        isolation: admitIsolation,
        consciousness_level: admitConsciousness,
      });
      if (res?.success) {
        showFeedback(`Patient admitted to ICU Bed ${admitBedNumber}.`);
        setAdmitPatientId('');
        setAdmitBedNumber('');
        setAdmitDiagnosis('');
        setAdmitDoctor('');
        setAdmitOnVentilator(false);
        setAdmitIsolation(false);
        setActiveSubTab('monitor');
        loadICUData();
      }
    } catch (err: any) {
      showFeedback(err.message || 'Failed to admit patient.', true);
    } finally {
      setAdmitLoading(false);
    }
  };

  const handleVitalsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vitalsPatientId || !heartRate || !spo2 || !temperature) {
      showFeedback('Please fill all required vital fields.', true);
      return;
    }
    setVitalsLoading(true);
    try {
      const res = await api.updateICUVitals?.({
        icu_patient_id: Number(vitalsPatientId),
        heart_rate: Number(heartRate),
        systolic_bp: Number(systolicBp),
        diastolic_bp: Number(diastolicBp),
        spo2: Number(spo2),
        temperature: Number(temperature),
        respiratory_rate: Number(respiratoryRate),
      });
      if (res?.success) {
        showFeedback('Vitals updated successfully.');
        setHeartRate('');
        setSystolicBp('');
        setDiastolicBp('');
        setSpo2('');
        setTemperature('');
        setRespiratoryRate('');
        setVitalsPatientId('');
        loadICUData();
      }
    } catch (err: any) {
      showFeedback(err.message || 'Vitals update failed.', true);
    } finally {
      setVitalsLoading(false);
    }
  };

  const handleDischarge = async (icuId: number, bedNumber: string) => {
    if (!window.confirm(`Discharge patient from ICU Bed ${bedNumber}?`)) return;
    try {
      const res = await api.dischargeFromICU?.({ icu_patient_id: icuId });
      if (res?.success) {
        showFeedback(`Patient discharged from ICU Bed ${bedNumber}.`);
        loadICUData();
      }
    } catch (err: any) {
      showFeedback(err.message || 'Discharge failed.', true);
    }
  };

  const allAlerts = patients.flatMap(p => p.alerts.map(a => ({ patient: p.patient_name, bed: p.bed_number, msg: a })));
  const criticalPatients = patients.filter(p => {
    if (!p.vitals) return false;
    return (
      getVitalStatus('heart_rate', p.vitals.heart_rate) === 'Critical' ||
      getVitalStatus('spo2', p.vitals.spo2) === 'Critical' ||
      getVitalStatus('temperature', p.vitals.temperature) === 'Critical' ||
      getVitalStatus('respiratory_rate', p.vitals.respiratory_rate) === 'Critical'
    );
  });

  return (
    <div style={{ maxWidth: 1440, margin: '0 auto', padding: '24px' }}>
      <style>{`
        @keyframes criticalPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(225,29,72,0); }
          50% { box-shadow: 0 0 0 6px rgba(225,29,72,0.2); }
        }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 12 }}>
            <Monitor size={28} color="#e11d48" />
            ICU Real-Time Monitor
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: 4 }}>
            Live critical care unit status, vital sign tracking, and ventilator management.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: '#059669', fontWeight: 700 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#059669', display: 'inline-block', animation: 'pulseAnim 2s infinite' }} />
            Live Monitoring Active
          </div>
          <button onClick={loadICUData} className="glass-btn glass-btn-secondary" style={{ padding: '7px 12px' }}>
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Feedback */}
      {feedback && (
        <div style={{
          padding: '12px 18px', borderRadius: 12, marginBottom: 16, fontWeight: 600, fontSize: '0.88rem',
          background: feedback.isError ? 'rgba(225,29,72,0.12)' : 'rgba(16,185,129,0.12)',
          border: `1px solid ${feedback.isError ? 'rgba(225,29,72,0.4)' : 'rgba(16,185,129,0.4)'}`,
          color: feedback.isError ? '#be123c' : '#059669',
          display: 'flex', alignItems: 'center', gap: 8
        }}>
          {feedback.isError ? <AlertTriangle size={16} /> : <CheckCircle size={16} />}
          {feedback.text}
        </div>
      )}

      {/* Critical Alerts Banner */}
      {allAlerts.length > 0 && alertsVisible && (
        <div style={{
          padding: '14px 18px', borderRadius: 12, marginBottom: 18,
          background: 'rgba(225,29,72,0.1)', border: '1.5px solid rgba(225,29,72,0.4)',
          display: 'flex', gap: 12, alignItems: 'flex-start'
        }}>
          <AlertTriangle size={20} color="#e11d48" style={{ marginTop: 1, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, color: '#be123c', fontSize: '0.9rem', marginBottom: 6 }}>
              {allAlerts.length} Active Clinical Alert{allAlerts.length > 1 ? 's' : ''}
            </div>
            {allAlerts.map((a, i) => (
              <div key={i} style={{ fontSize: '0.82rem', color: '#be123c', marginBottom: 2 }}>
                Bed {a.bed} — {a.patient}: {a.msg}
              </div>
            ))}
          </div>
          <button onClick={() => setAlertsVisible(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <X size={16} color="#be123c" />
          </button>
        </div>
      )}

      {/* Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'Total ICU Beds', value: stats?.total_icu_beds ?? '--', color: '#0284c7', icon: <BedDouble size={18} color="#0284c7" /> },
          { label: 'Occupied', value: stats?.occupied ?? '--', color: '#e11d48', icon: <Activity size={18} color="#e11d48" /> },
          { label: 'Vacant', value: stats?.vacant ?? '--', color: '#059669', icon: <CheckCircle size={18} color="#059669" /> },
          { label: 'Critical', value: criticalPatients.length, color: '#e11d48', icon: <AlertTriangle size={18} color="#e11d48" /> },
          { label: 'On Ventilator', value: stats?.on_ventilator ?? '--', color: '#7c3aed', icon: <Wind size={18} color="#7c3aed" /> },
          { label: 'Isolation', value: stats?.isolation_count ?? '--', color: '#d97706', icon: <Shield size={18} color="#d97706" /> },
        ].map((card, i) => (
          <div key={i} className="glass-panel" style={{ padding: '16px 18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>{card.label}</span>
              {card.icon}
            </div>
            <div style={{ fontSize: '1.7rem', fontWeight: 800, color: card.color }}>{card.value}</div>
          </div>
        ))}
      </div>

      {/* Sub-Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {[
          { id: 'monitor', label: 'Live Monitor', icon: <Monitor size={15} /> },
          { id: 'admit', label: 'Admit to ICU', icon: <Plus size={15} /> },
          { id: 'vitals', label: 'Record Vitals', icon: <Activity size={15} /> },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id as any)}
            className={activeSubTab === tab.id ? 'glass-btn' : 'glass-btn glass-btn-secondary'}
            style={{ fontSize: '0.85rem', padding: '8px 16px', gap: 6,
              ...(activeSubTab === tab.id && tab.id === 'monitor' ? { background: 'linear-gradient(135deg,#e11d48,#be123c)' } : {}) }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* === MONITOR TAB === */}
      {activeSubTab === 'monitor' && (
        <div>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-dim)' }}>Loading ICU data...</div>
          ) : patients.length === 0 ? (
            <div className="glass-panel" style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
              <Monitor size={48} style={{ opacity: 0.3, marginBottom: 12 }} />
              <p>No patients currently admitted to the ICU.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(460px, 1fr))', gap: 18 }}>
              {patients.map(p => {
                const isCritical = p.alerts.length > 0 || (p.vitals && (
                  getVitalStatus('spo2', p.vitals.spo2) === 'Critical' ||
                  getVitalStatus('heart_rate', p.vitals.heart_rate) === 'Critical'
                ));

                return (
                  <div
                    key={p.id}
                    className="glass-panel"
                    style={{
                      overflow: 'hidden',
                      border: isCritical ? '1.5px solid rgba(225,29,72,0.5)' : '1.5px solid var(--glass-border)',
                      animation: isCritical ? 'criticalPulse 1.5s ease infinite' : undefined,
                    }}
                  >
                    {/* Patient Header */}
                    <div style={{
                      padding: '12px 18px',
                      background: isCritical ? 'rgba(225,29,72,0.08)' : 'rgba(241,245,249,0.5)',
                      borderBottom: '1px solid var(--glass-border-subtle)',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                    }}>
                      <div>
                        <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '1rem' }}>
                          Bed {p.bed_number} — {p.patient_name}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                          Age {p.patient_age} | MRN: {p.patient_mrn} | Dr. {p.attending_doctor}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        {p.ventilator && (
                          <span style={{ padding: '3px 8px', borderRadius: 20, fontSize: '0.68rem', fontWeight: 800, background: 'rgba(124,58,237,0.12)', color: '#7c3aed', border: '1px solid rgba(124,58,237,0.3)' }}>
                            <Wind size={10} style={{ marginRight: 3 }} />Ventilator
                          </span>
                        )}
                        {p.isolation && (
                          <span style={{ padding: '3px 8px', borderRadius: 20, fontSize: '0.68rem', fontWeight: 800, background: 'rgba(217,119,6,0.12)', color: '#d97706', border: '1px solid rgba(217,119,6,0.3)' }}>
                            <Shield size={10} style={{ marginRight: 3 }} />Isolation
                          </span>
                        )}
                        <span style={{
                          padding: '3px 8px', borderRadius: 20, fontSize: '0.68rem', fontWeight: 800,
                          background: p.consciousness_level === 'Alert' ? 'rgba(5,150,105,0.1)' : 'rgba(225,29,72,0.1)',
                          color: p.consciousness_level === 'Alert' ? '#059669' : '#e11d48',
                          border: `1px solid ${p.consciousness_level === 'Alert' ? 'rgba(5,150,105,0.3)' : 'rgba(225,29,72,0.3)'}`
                        }}>
                          {p.consciousness_level}
                        </span>
                      </div>
                    </div>

                    {/* Diagnosis */}
                    <div style={{ padding: '8px 18px', borderBottom: '1px solid var(--glass-border-subtle)', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                      <strong style={{ color: '#0f172a' }}>Dx:</strong> {p.diagnosis}
                    </div>

                    {/* Vitals Grid */}
                    {p.vitals ? (
                      <div style={{ padding: '14px 18px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 10 }}>
                          <VitalWidget label="Heart Rate" value={p.vitals.heart_rate} unit="bpm"
                            status={getVitalStatus('heart_rate', p.vitals.heart_rate)} Icon={Heart} animated />
                          <VitalWidget label="SpO₂" value={p.vitals.spo2} unit="%"
                            status={getVitalStatus('spo2', p.vitals.spo2)} Icon={Droplets} animated />
                          <VitalWidget label="Temp" value={p.vitals.temperature} unit="°C"
                            status={getVitalStatus('temperature', p.vitals.temperature)} Icon={Thermometer} animated />
                          <VitalWidget label="Resp Rate" value={p.vitals.respiratory_rate} unit="/min"
                            status={getVitalStatus('respiratory_rate', p.vitals.respiratory_rate)} Icon={Wind} animated />
                          <VitalWidget label="Systolic" value={p.vitals.systolic_bp} unit="mmHg"
                            status={getVitalStatus('systolic_bp', p.vitals.systolic_bp)} Icon={TrendingUp} animated />
                          <VitalWidget label="Diastolic" value={p.vitals.diastolic_bp} unit="mmHg"
                            status={getVitalStatus('diastolic_bp', p.vitals.diastolic_bp)} Icon={TrendingDown} animated />
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Clock size={11} /> Last updated: {new Date(p.vitals.last_updated).toLocaleTimeString()}
                        </div>
                      </div>
                    ) : (
                      <div style={{ padding: '20px 18px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
                        No vitals recorded yet.
                      </div>
                    )}

                    {/* Alerts */}
                    {p.alerts.length > 0 && (
                      <div style={{ padding: '8px 18px', borderTop: '1px solid rgba(225,29,72,0.2)', background: 'rgba(225,29,72,0.05)' }}>
                        {p.alerts.map((alert, i) => (
                          <div key={i} style={{ fontSize: '0.78rem', color: '#be123c', fontWeight: 600, display: 'flex', gap: 6, alignItems: 'center' }}>
                            <Zap size={12} /> {alert}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Footer Actions */}
                    <div style={{ padding: '10px 18px', borderTop: '1px solid var(--glass-border-subtle)', display: 'flex', gap: 8 }}>
                      <button
                        className="glass-btn glass-btn-secondary"
                        style={{ fontSize: '0.78rem', padding: '6px 12px' }}
                        onClick={() => {
                          setVitalsPatientId(String(p.id));
                          setActiveSubTab('vitals');
                        }}
                      >
                        <Activity size={12} /> Record Vitals
                      </button>
                      <button
                        className="glass-btn glass-btn-danger"
                        style={{ fontSize: '0.78rem', padding: '6px 12px', marginLeft: 'auto' }}
                        onClick={() => handleDischarge(p.id, p.bed_number)}
                      >
                        Discharge
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* === ADMIT TAB === */}
      {activeSubTab === 'admit' && (
        <div className="glass-panel" style={{ padding: 28, maxWidth: 580 }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Plus size={20} color="#e11d48" /> Admit Patient to ICU
          </h2>
          <form onSubmit={handleAdmitICU} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>Patient *</label>
              <select className="glass-input" value={admitPatientId} onChange={e => setAdmitPatientId(e.target.value)} required>
                <option value="">-- Select Patient --</option>
                {availablePatientsForAdmit.map(p => (
                  <option key={p.id} value={p.id}>{p.first_name} {p.last_name} — MRN: {p.mrn}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>ICU Bed Number *</label>
              <input className="glass-input" placeholder="e.g. ICU-01, ICU-05B..." value={admitBedNumber} onChange={e => setAdmitBedNumber(e.target.value)} required />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>Primary Diagnosis *</label>
              <input className="glass-input" placeholder="Enter diagnosis..." value={admitDiagnosis} onChange={e => setAdmitDiagnosis(e.target.value)} required />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>Attending Physician</label>
              <input className="glass-input" placeholder="Attending doctor name..." value={admitDoctor} onChange={e => setAdmitDoctor(e.target.value)} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>Consciousness Level</label>
              <select className="glass-input" value={admitConsciousness} onChange={e => setAdmitConsciousness(e.target.value as any)}>
                {['Alert', 'Confused', 'Drowsy', 'Unresponsive'].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <div
                onClick={() => setAdmitOnVentilator(!admitOnVentilator)}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
                  borderRadius: 10, cursor: 'pointer',
                  background: admitOnVentilator ? 'rgba(124,58,237,0.1)' : 'rgba(241,245,249,0.8)',
                  border: `1.5px solid ${admitOnVentilator ? '#7c3aed' : 'var(--glass-border-subtle)'}`,
                }}
              >
                <Wind size={16} color={admitOnVentilator ? '#7c3aed' : 'var(--text-dim)'} />
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: admitOnVentilator ? '#7c3aed' : 'var(--text-muted)' }}>Ventilator Required</span>
              </div>
              <div
                onClick={() => setAdmitIsolation(!admitIsolation)}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
                  borderRadius: 10, cursor: 'pointer',
                  background: admitIsolation ? 'rgba(217,119,6,0.1)' : 'rgba(241,245,249,0.8)',
                  border: `1.5px solid ${admitIsolation ? '#d97706' : 'var(--glass-border-subtle)'}`,
                }}
              >
                <Shield size={16} color={admitIsolation ? '#d97706' : 'var(--text-dim)'} />
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: admitIsolation ? '#d97706' : 'var(--text-muted)' }}>Isolation Ward</span>
              </div>
            </div>
            <button type="submit" className="glass-btn" disabled={admitLoading}
              style={{ padding: '13px', justifyContent: 'center', fontWeight: 800, background: 'linear-gradient(135deg,#e11d48,#be123c)', boxShadow: '0 6px 20px rgba(225,29,72,0.35)' }}>
              {admitLoading ? 'Admitting...' : <><Plus size={16} /> Admit to ICU</>}
            </button>
          </form>
        </div>
      )}

      {/* === VITALS TAB === */}
      {activeSubTab === 'vitals' && (
        <div className="glass-panel" style={{ padding: 28, maxWidth: 560 }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Activity size={20} color="#e11d48" /> Record Patient Vitals
          </h2>
          <form onSubmit={handleVitalsSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>ICU Patient *</label>
              <select className="glass-input" value={vitalsPatientId} onChange={e => setVitalsPatientId(e.target.value)} required>
                <option value="">-- Select ICU Patient --</option>
                {patients.map(p => <option key={p.id} value={p.id}>Bed {p.bed_number} — {p.patient_name}</option>)}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#0f172a', marginBottom: 5 }}>Heart Rate (bpm) *</label>
                <input className="glass-input" type="number" min={20} max={250} placeholder="e.g. 72" value={heartRate} onChange={e => setHeartRate(e.target.value)} required />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#0f172a', marginBottom: 5 }}>SpO₂ (%) *</label>
                <input className="glass-input" type="number" min={50} max={100} step={0.1} placeholder="e.g. 98" value={spo2} onChange={e => setSpo2(e.target.value)} required />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#0f172a', marginBottom: 5 }}>Systolic BP (mmHg)</label>
                <input className="glass-input" type="number" min={50} max={250} placeholder="e.g. 120" value={systolicBp} onChange={e => setSystolicBp(e.target.value)} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#0f172a', marginBottom: 5 }}>Diastolic BP (mmHg)</label>
                <input className="glass-input" type="number" min={30} max={150} placeholder="e.g. 80" value={diastolicBp} onChange={e => setDiastolicBp(e.target.value)} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#0f172a', marginBottom: 5 }}>Temperature (°C) *</label>
                <input className="glass-input" type="number" min={32} max={42} step={0.1} placeholder="e.g. 37.0" value={temperature} onChange={e => setTemperature(e.target.value)} required />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#0f172a', marginBottom: 5 }}>Respiratory Rate (/min)</label>
                <input className="glass-input" type="number" min={5} max={60} placeholder="e.g. 16" value={respiratoryRate} onChange={e => setRespiratoryRate(e.target.value)} />
              </div>
            </div>
            <button type="submit" className="glass-btn" disabled={vitalsLoading}
              style={{ padding: '13px', justifyContent: 'center', fontWeight: 800, background: 'linear-gradient(135deg,#059669,#047857)', boxShadow: '0 6px 20px rgba(5,150,105,0.35)' }}>
              {vitalsLoading ? 'Saving...' : <><Activity size={16} /> Record Vitals</>}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
