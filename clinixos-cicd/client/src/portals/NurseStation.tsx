import React, { useState, useEffect } from 'react';
import { Bed, Patient, UserRole } from '../types';
import { api } from '../services/api';
import { wsClient } from '../services/websocket';
import {
  BedDouble,
  CheckCircle,
  AlertTriangle,
  Sparkles,
  Wrench,
  UserPlus,
  Filter,
  PlusCircle,
  Trash2,
  Clock,
  User,
  HeartPulse,
  LogOut
} from 'lucide-react';

interface NurseStationProps {
  currentRole: UserRole;
  onSelectPatientForDoctor?: (patientId: number) => void;
}

export const NurseStation: React.FC<NurseStationProps> = ({ currentRole }) => {
  const [beds, setBeds] = useState<Bed[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filterWard, setFilterWard] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  // Manage Bed Status Modal
  const [selectedBed, setSelectedBed] = useState<Bed | null>(null);
  const [modalStatus, setModalStatus] = useState<string>('');
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');

  // Add New Bed Modal
  const [showAddBedModal, setShowAddBedModal] = useState<boolean>(false);
  const [newWardNumber, setNewWardNumber] = useState<string>('Ward-1A');
  const [customWardNumber, setCustomWardNumber] = useState<string>('');
  const [newWardType, setNewWardType] = useState<'General' | 'Semi-Private' | 'ICU'>('General');
  const [newBedLabel, setNewBedLabel] = useState<string>('');
  const [newBedStatus, setNewBedStatus] = useState<'Vacant' | 'Cleaning' | 'Maintenance'>('Vacant');

  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  const fetchBeds = async () => {
    try {
      const res = await api.getBeds();
      if (res.success) {
        setBeds(res.data);
      }
    } catch (err: any) {
      console.error('Error loading beds:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPatients = async () => {
    try {
      const res = await api.searchPatients();
      if (res.success) {
        setPatients(res.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchBeds();
    fetchPatients();

    // Listen to real-time WebSocket updates
    const unsubscribe = wsClient.subscribe('BED_STATUS_UPDATE', (payload) => {
      console.log('[NurseStation WS] Real-time Bed Update received:', payload);
      fetchBeds();
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleOpenBedModal = (bed: Bed) => {
    setSelectedBed(bed);
    setModalStatus(bed.status);
    setSelectedPatientId(bed.current_patient_id ? String(bed.current_patient_id) : '');
    setErrorMsg('');
    setSuccessMsg('');
  };

  const handleSaveBedStatus = async () => {
    if (!selectedBed) return;
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const patientIdNum = selectedPatientId ? Number(selectedPatientId) : null;
      const res = await api.updateBedStatus(selectedBed.id, modalStatus, patientIdNum);
      if (res.success) {
        setSuccessMsg(res.message);
        setTimeout(() => {
          setSelectedBed(null);
          setSuccessMsg('');
        }, 1000);
        fetchBeds();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update bed status.');
    }
  };

  // Quick Direct Actions on Cards
  const handleQuickAdmit = (bed: Bed) => {
    setSelectedBed(bed);
    setModalStatus('Occupied');
    setSelectedPatientId('');
    setErrorMsg('');
    setSuccessMsg('');
  };

  const handleQuickDischarge = async (bed: Bed) => {
    if (!window.confirm(`Discharge patient from Bed ${bed.bed_label}? Bed will be queued for sanitization.`)) return;
    try {
      await api.updateBedStatus(bed.id, 'Cleaning', null);
      fetchBeds();
    } catch (err: any) {
      alert(err.message || 'Failed to discharge patient.');
    }
  };

  const handleQuickSanitized = async (bed: Bed) => {
    try {
      await api.updateBedStatus(bed.id, 'Vacant', null);
      fetchBeds();
    } catch (err: any) {
      alert(err.message || 'Failed to update bed status.');
    }
  };

  const handleQuickMaintenanceClear = async (bed: Bed) => {
    try {
      await api.updateBedStatus(bed.id, 'Vacant', null);
      fetchBeds();
    } catch (err: any) {
      alert(err.message || 'Failed to update bed status.');
    }
  };

  const handleDeleteBed = async (bed: Bed) => {
    if (!window.confirm(`Are you sure you want to decommission and delete Bed ${bed.bed_label}?`)) return;
    try {
      await api.deleteBed(bed.id);
      fetchBeds();
    } catch (err: any) {
      alert(err.message || 'Failed to delete bed.');
    }
  };

  const handleCreateNewBed = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const targetWard = newWardNumber === 'CUSTOM' ? customWardNumber.trim() : newWardNumber;
    if (!targetWard) {
      setErrorMsg('Please specify a valid Ward name or number.');
      return;
    }
    if (!newBedLabel.trim()) {
      setErrorMsg('Please provide a Bed Label (e.g. BED-107).');
      return;
    }

    try {
      const res = await api.addBed({
        ward_number: targetWard,
        ward_type: newWardType,
        bed_label: newBedLabel.trim().toUpperCase(),
        status: newBedStatus
      });

      if (res.success) {
        setShowAddBedModal(false);
        setNewBedLabel('');
        setCustomWardNumber('');
        fetchBeds();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create new bed.');
    }
  };

  // Group beds by Ward
  const filteredBeds = beds.filter((b) => {
    const matchesWard = filterWard === 'ALL' || b.ward_number === filterWard;
    const matchesStatus = filterStatus === 'ALL' || b.status === filterStatus;
    return matchesWard && matchesStatus;
  });

  const wards = Array.from(new Set(beds.map((b) => b.ward_number)));

  const totalOccupied = beds.filter((b) => b.status === 'Occupied').length;
  const totalVacant = beds.filter((b) => b.status === 'Vacant').length;
  const totalCleaning = beds.filter((b) => b.status === 'Cleaning').length;

  const icuBeds = beds.filter((b) => b.ward_type === 'ICU');
  const icuVacant = icuBeds.filter((b) => b.status === 'Vacant').length;
  const icuVacancyRate = icuBeds.length > 0 ? Math.round((icuVacant / icuBeds.length) * 100) : 100;
  const isIcuCritical = icuVacancyRate < 10;

  const canModifyBeds = currentRole === 'Nurse' || currentRole === 'Admin';

  return (
    <div style={{ maxWidth: 1440, margin: '0 auto', padding: '24px' }}>
      {/* Top Banner / Ward Status Overview */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 12 }}>
            <BedDouble size={28} color="#0284c7" /> Ward Bed Allocation &amp; Live Telemetry
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: 4 }}>
            Dynamic ward station manager • {beds.length} Total Hospital Beds ({totalOccupied} Occupied, {totalVacant} Available, {totalCleaning} Cleaning)
          </p>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {canModifyBeds && (
            <button
              onClick={() => {
                setShowAddBedModal(true);
                setErrorMsg('');
              }}
              className="glass-btn"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 18px',
                borderRadius: 12,
                fontSize: '0.86rem',
                fontWeight: 700,
                background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                color: '#fff',
                boxShadow: '0 4px 15px rgba(2, 132, 199, 0.3)'
              }}
            >
              <PlusCircle size={16} /> + Add New Bed Station
            </button>
          )}

          {/* ICU Alert Status Pill */}
          <div className="glass-panel" style={{ padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 12, borderRadius: 14 }}>
            <div>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 700 }}>ICU Capacity</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: isIcuCritical ? '#e11d48' : '#059669' }}>
                {icuVacant} / {icuBeds.length} Free
              </div>
            </div>
            {isIcuCritical && (
              <span className="badge badge-occupied" style={{ animation: 'pulseAnimation 1.5s infinite' }}>
                <AlertTriangle size={14} /> Critical
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="glass-panel" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14, marginBottom: 24, borderRadius: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.84rem', color: '#475569', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}>
            <Filter size={15} /> Ward:
          </span>
          <button
            onClick={() => setFilterWard('ALL')}
            className={filterWard === 'ALL' ? 'glass-btn' : 'glass-btn glass-btn-secondary'}
            style={{ padding: '6px 14px', fontSize: '0.8rem' }}
          >
            All Wards ({beds.length})
          </button>
          {wards.map((w) => (
            <button
              key={w}
              onClick={() => setFilterWard(w)}
              className={filterWard === w ? 'glass-btn' : 'glass-btn glass-btn-secondary'}
              style={{ padding: '6px 14px', fontSize: '0.8rem' }}
            >
              {w} ({beds.filter((b) => b.ward_number === w).length})
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.84rem', color: '#475569', fontWeight: 700 }}>Status:</span>
          {['ALL', 'Vacant', 'Occupied', 'Cleaning', 'Maintenance'].map((st) => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={filterStatus === st ? 'glass-btn' : 'glass-btn glass-btn-secondary'}
              style={{ padding: '5px 12px', fontSize: '0.78rem' }}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Bed Grid Display */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#64748b' }}>Synchronizing telemetry with hospital grid...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: 18 }}>
          {filteredBeds.map((bed) => {
            const isVacant = bed.status === 'Vacant';
            const isOccupied = bed.status === 'Occupied';
            const isCleaning = bed.status === 'Cleaning';
            const isMaint = bed.status === 'Maintenance';

            const statusColor = isVacant
              ? '#059669'
              : isOccupied
              ? '#e11d48'
              : isCleaning
              ? '#d97706'
              : '#ea580c';

            const statusBg = isVacant
              ? 'rgba(5, 150, 105, 0.08)'
              : isOccupied
              ? 'rgba(225, 29, 72, 0.08)'
              : isCleaning
              ? 'rgba(217, 119, 6, 0.08)'
              : 'rgba(234, 88, 12, 0.08)';

            return (
              <div
                key={bed.id}
                className="glass-panel"
                style={{
                  padding: '18px',
                  borderRadius: 18,
                  border: `1.5px solid ${statusColor}35`,
                  background: 'rgba(255, 255, 255, 0.95)',
                  boxShadow: '0 4px 18px rgba(15, 23, 42, 0.04)',
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: 14,
                  transition: 'all 0.2s ease'
                }}
              >
                <div>
                  {/* Ward Badge & Status Pill */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <span style={{ fontSize: '0.76rem', fontWeight: 800, color: '#0284c7', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {bed.ward_number} • {bed.ward_type}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: 6,
                          background: statusBg,
                          color: statusColor,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4
                        }}
                      >
                        {isVacant && <CheckCircle size={12} />}
                        {isOccupied && <HeartPulse size={12} />}
                        {isCleaning && <Sparkles size={12} />}
                        {isMaint && <Wrench size={12} />}
                        {bed.status}
                      </span>

                      {canModifyBeds && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteBed(bed);
                          }}
                          title="Decommission Bed"
                          style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 2 }}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Bed Identifier */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                    <div
                      style={{
                        width: 46,
                        height: 46,
                        borderRadius: 12,
                        background: statusBg,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <BedDouble size={26} color={statusColor} />
                    </div>
                    <div>
                      <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a' }}>{bed.bed_label}</div>
                      <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                        {bed.ward_type === 'ICU' ? 'Telemetry: Continuous Vitals' : 'Ward Station: Active'}
                      </div>
                    </div>
                  </div>

                  {/* Dynamic Occupancy Details */}
                  <div style={{ borderTop: '1px solid rgba(226, 232, 240, 0.8)', paddingTop: 10 }}>
                    {isOccupied ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <User size={13} color="#e11d48" />
                          <span style={{ fontSize: '0.86rem', fontWeight: 800, color: '#0f172a' }}>
                            {bed.first_name ? `${bed.first_name} ${bed.last_name}` : 'Admitted Inpatient'}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span>PID: <strong>{bed.patient_pid || 'PT-Admitted'}</strong></span>
                          {bed.gender && <span>• {bed.gender}</span>}
                        </div>
                        {bed.check_in_time && (
                          <div style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                            <Clock size={11} /> Admitted: {new Date(bed.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        )}
                      </div>
                    ) : isCleaning ? (
                      <div style={{ fontSize: '0.78rem', color: '#b45309', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                        <Sparkles size={14} /> Sanitization &amp; sterilization queued
                      </div>
                    ) : isMaint ? (
                      <div style={{ fontSize: '0.78rem', color: '#c2410c', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                        <Wrench size={14} /> Biomedical engineering inspection active
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.78rem', color: '#059669', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                        <CheckCircle size={14} /> Available • Ready for immediate intake
                      </div>
                    )}
                  </div>
                </div>

                {/* Quick Action Footer */}
                {canModifyBeds && (
                  <div style={{ borderTop: '1px solid rgba(226, 232, 240, 0.8)', paddingTop: 10, display: 'flex', gap: 8 }}>
                    {isVacant && (
                      <button
                        onClick={() => handleQuickAdmit(bed)}
                        className="glass-btn"
                        style={{ flex: 1, padding: '7px 10px', fontSize: '0.76rem', justifyContent: 'center', gap: 6 }}
                      >
                        <UserPlus size={13} /> Admit Patient
                      </button>
                    )}

                    {isOccupied && (
                      <button
                        onClick={() => handleQuickDischarge(bed)}
                        className="glass-btn glass-btn-secondary"
                        style={{ flex: 1, padding: '7px 10px', fontSize: '0.76rem', justifyContent: 'center', gap: 6, color: '#e11d48' }}
                      >
                        <LogOut size={13} /> Discharge Patient
                      </button>
                    )}

                    {isCleaning && (
                      <button
                        onClick={() => handleQuickSanitized(bed)}
                        className="glass-btn"
                        style={{ flex: 1, padding: '7px 10px', fontSize: '0.76rem', justifyContent: 'center', gap: 6, background: '#059669' }}
                      >
                        <CheckCircle size={13} /> Mark Sanitized (Ready)
                      </button>
                    )}

                    {isMaint && (
                      <button
                        onClick={() => handleQuickMaintenanceClear(bed)}
                        className="glass-btn"
                        style={{ flex: 1, padding: '7px 10px', fontSize: '0.76rem', justifyContent: 'center', gap: 6, background: '#0284c7' }}
                      >
                        <CheckCircle size={13} /> Clear Maintenance
                      </button>
                    )}

                    <button
                      onClick={() => handleOpenBedModal(bed)}
                      className="glass-btn glass-btn-secondary"
                      style={{ padding: '7px 10px', fontSize: '0.76rem' }}
                      title="Custom Status Editor"
                    >
                      Edit
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Bed Assignment & Status Modal (Nurses & Admin) */}
      {selectedBed && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div className="glass-modal" style={{ width: '100%', maxWidth: 480, padding: 28, background: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
                  Manage Station: {selectedBed.bed_label}
                </h3>
                <p style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  {selectedBed.ward_number} • {selectedBed.ward_type}
                </p>
              </div>
              <button
                onClick={() => setSelectedBed(null)}
                style={{ background: 'transparent', border: 'none', color: '#64748b', fontSize: '1.4rem', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>

            {errorMsg && (
              <div style={{ padding: '10px 14px', background: 'rgba(225, 29, 72, 0.1)', border: '1px solid rgba(225, 29, 72, 0.3)', borderRadius: 8, color: '#be123c', fontSize: '0.82rem', marginBottom: 16 }}>
                {errorMsg}
              </div>
            )}
            {successMsg && (
              <div style={{ padding: '10px 14px', background: 'rgba(5, 150, 105, 0.1)', border: '1px solid rgba(5, 150, 105, 0.3)', borderRadius: 8, color: '#059669', fontSize: '0.82rem', marginBottom: 16 }}>
                {successMsg}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: 8 }}>
                  Target Occupancy Status:
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {['Vacant', 'Occupied', 'Cleaning', 'Maintenance'].map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setModalStatus(st)}
                      style={{
                        padding: '10px',
                        borderRadius: 10,
                        border: modalStatus === st ? '2px solid #0284c7' : '1px solid #cbd5e1',
                        background: modalStatus === st ? 'rgba(2, 132, 199, 0.1)' : '#f8fafc',
                        color: modalStatus === st ? '#0284c7' : '#0f172a',
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        cursor: 'pointer'
                      }}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              {/* Patient Selection (Mandatory if marking Occupied) */}
              {modalStatus === 'Occupied' && (
                <div>
                  <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: 8 }}>
                    Select Patient to Admit:
                  </label>
                  <select
                    className="glass-input"
                    value={selectedPatientId}
                    onChange={(e) => setSelectedPatientId(e.target.value)}
                  >
                    <option value="">-- Choose Registered Patient (PID) --</option>
                    {patients.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.pid} - {p.first_name} {p.last_name} ({p.gender}, Contact: {p.contact_number})
                      </option>
                    ))}
                  </select>
                  <p style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 4 }}>
                    New patient? Register via Reception Desk first to generate a sequential PID.
                  </p>
                </div>
              )}

              {modalStatus === 'Cleaning' && (
                <div style={{ padding: '12px', background: 'rgba(217, 119, 6, 0.1)', border: '1px solid rgba(217, 119, 6, 0.3)', borderRadius: 8, fontSize: '0.8rem', color: '#b45309' }}>
                  Marking this bed as &quot;Cleaning&quot; discharges any existing patient and makes it unavailable until sanitized.
                </div>
              )}

              <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
                <button
                  type="button"
                  className="glass-btn glass-btn-secondary"
                  onClick={() => setSelectedBed(null)}
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="glass-btn"
                  onClick={handleSaveBedStatus}
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  Commit Status
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add New Bed Station Modal */}
      {showAddBedModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div className="glass-modal" style={{ width: '100%', maxWidth: 480, padding: 28, background: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
                  Create New Hospital Bed
                </h3>
                <p style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  Dynamically provision a new station in any ward
                </p>
              </div>
              <button
                onClick={() => setShowAddBedModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#64748b', fontSize: '1.4rem', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>

            {errorMsg && (
              <div style={{ padding: '10px 14px', background: 'rgba(225, 29, 72, 0.1)', border: '1px solid rgba(225, 29, 72, 0.3)', borderRadius: 8, color: '#be123c', fontSize: '0.82rem', marginBottom: 16 }}>
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleCreateNewBed} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                  Ward Destination:
                </label>
                <select
                  className="glass-input"
                  value={newWardNumber}
                  onChange={(e) => setNewWardNumber(e.target.value)}
                >
                  {wards.map((w) => (
                    <option key={w} value={w}>
                      Existing: {w}
                    </option>
                  ))}
                  <option value="CUSTOM">+ Create Custom Ward Name</option>
                </select>
              </div>

              {newWardNumber === 'CUSTOM' && (
                <div>
                  <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                    Custom Ward Name / Code:
                  </label>
                  <input
                    type="text"
                    required
                    className="glass-input"
                    placeholder="e.g. Ward-3C (Cardiology) or Pediatric-2"
                    value={customWardNumber}
                    onChange={(e) => setCustomWardNumber(e.target.value)}
                  />
                </div>
              )}

              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                  Ward Classification:
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {(['General', 'Semi-Private', 'ICU'] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setNewWardType(type)}
                      style={{
                        padding: '9px 6px',
                        borderRadius: 8,
                        border: newWardType === type ? '2px solid #0284c7' : '1px solid #cbd5e1',
                        background: newWardType === type ? 'rgba(2, 132, 199, 0.1)' : '#f8fafc',
                        color: newWardType === type ? '#0284c7' : '#0f172a',
                        fontWeight: 700,
                        fontSize: '0.82rem',
                        cursor: 'pointer'
                      }}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                  Bed Station Identifier:
                </label>
                <input
                  type="text"
                  required
                  className="glass-input"
                  placeholder="e.g. BED-107 or ICU-306"
                  value={newBedLabel}
                  onChange={(e) => setNewBedLabel(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                  Initial Status:
                </label>
                <select
                  className="glass-input"
                  value={newBedStatus}
                  onChange={(e) => setNewBedStatus(e.target.value as any)}
                >
                  <option value="Vacant">Vacant (Ready for Patients)</option>
                  <option value="Cleaning">Cleaning Required</option>
                  <option value="Maintenance">Under Maintenance</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
                <button
                  type="button"
                  className="glass-btn glass-btn-secondary"
                  onClick={() => setShowAddBedModal(false)}
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="glass-btn"
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  Save &amp; Deploy Bed
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
