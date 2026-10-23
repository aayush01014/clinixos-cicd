import React, { useState, useEffect, useCallback } from 'react';
import { UserRole } from '../types';
import { api } from '../services/api';
import {
  FlaskConical, Search, Plus, FileText, Clock, CheckCircle,
  AlertTriangle, RefreshCw, Microscope, Activity, Download,
  ChevronDown, ChevronUp, Filter, X, TrendingUp, TrendingDown
} from 'lucide-react';

interface LabConsoleProps {
  currentRole: UserRole;
}

type TestStatus = 'Pending' | 'In Progress' | 'Completed' | 'Cancelled';
type PriorityLevel = 'Routine' | 'Urgent' | 'STAT';

interface LabTestOrder {
  id: number;
  patient_id: number;
  patient_name: string;
  patient_mrn: string;
  doctor_name: string;
  test_name: string;
  test_code: string;
  category: string;
  priority: PriorityLevel;
  status: TestStatus;
  ordered_at: string;
  collected_at: string | null;
  resulted_at: string | null;
  result_value: string | null;
  result_unit: string | null;
  reference_range: string | null;
  is_abnormal: boolean | null;
  notes: string | null;
  technician_name: string | null;
}

interface LabStat {
  total_ordered: number;
  pending: number;
  in_progress: number;
  completed_today: number;
  abnormal_today: number;
  avg_turnaround_hours: number;
}

const TEST_CATEGORIES = [
  'Haematology', 'Biochemistry', 'Microbiology', 'Immunology',
  'Histopathology', 'Radiology', 'Urinalysis', 'Serology'
];

const PANEL_TESTS: Record<string, { code: string; name: string; unit: string; range: string }[]> = {
  Haematology: [
    { code: 'CBC', name: 'Complete Blood Count', unit: 'cells/μL', range: 'See individual components' },
    { code: 'HGB', name: 'Haemoglobin', unit: 'g/dL', range: 'M: 13.5–17.5 | F: 12–15.5' },
    { code: 'WBC', name: 'White Blood Cell Count', unit: '10³/μL', range: '4.5–11.0' },
    { code: 'PLT', name: 'Platelet Count', unit: '10³/μL', range: '150–400' },
    { code: 'HCT', name: 'Haematocrit', unit: '%', range: 'M: 41–53 | F: 36–46' },
    { code: 'ESR', name: 'Erythrocyte Sedimentation Rate', unit: 'mm/hr', range: 'M: <15 | F: <20' },
  ],
  Biochemistry: [
    { code: 'GLUFA', name: 'Fasting Blood Glucose', unit: 'mg/dL', range: '70–100' },
    { code: 'HBA1C', name: 'Glycated Haemoglobin (HbA1c)', unit: '%', range: '<5.7 (normal)' },
    { code: 'CREA', name: 'Serum Creatinine', unit: 'mg/dL', range: 'M: 0.7–1.3 | F: 0.6–1.1' },
    { code: 'BUN', name: 'Blood Urea Nitrogen', unit: 'mg/dL', range: '7–20' },
    { code: 'SGOT', name: 'AST (SGOT)', unit: 'U/L', range: '10–40' },
    { code: 'SGPT', name: 'ALT (SGPT)', unit: 'U/L', range: '7–56' },
    { code: 'TBIL', name: 'Total Bilirubin', unit: 'mg/dL', range: '0.1–1.2' },
    { code: 'LDLC', name: 'LDL Cholesterol', unit: 'mg/dL', range: '<100 (optimal)' },
    { code: 'HDLC', name: 'HDL Cholesterol', unit: 'mg/dL', range: 'M: >40 | F: >50' },
    { code: 'TRIG', name: 'Triglycerides', unit: 'mg/dL', range: '<150' },
  ],
  Microbiology: [
    { code: 'BLDC', name: 'Blood Culture & Sensitivity', unit: 'qualitative', range: 'No growth' },
    { code: 'URINC', name: 'Urine Culture & Sensitivity', unit: 'CFU/mL', range: '<1000' },
    { code: 'SPUTC', name: 'Sputum Culture', unit: 'qualitative', range: 'No pathogen' },
    { code: 'WOUNDSWAB', name: 'Wound Swab C&S', unit: 'qualitative', range: 'No growth' },
  ],
  Immunology: [
    { code: 'TSH', name: 'Thyroid Stimulating Hormone', unit: 'mIU/L', range: '0.4–4.0' },
    { code: 'FT4', name: 'Free Thyroxine (FT4)', unit: 'ng/dL', range: '0.8–1.8' },
    { code: 'FT3', name: 'Free Tri-iodothyronine (FT3)', unit: 'pg/mL', range: '2.3–4.2' },
    { code: 'TPAB', name: 'Anti-TPO Antibodies', unit: 'IU/mL', range: '<35' },
    { code: 'ANA', name: 'Antinuclear Antibody (ANA)', unit: 'titer', range: '<1:40' },
    { code: 'CRP', name: 'C-Reactive Protein', unit: 'mg/L', range: '<10' },
    { code: 'RF', name: 'Rheumatoid Factor', unit: 'IU/mL', range: '<14' },
  ],
  Urinalysis: [
    { code: 'URINAL', name: 'Routine Urinalysis', unit: 'qualitative', range: 'See report' },
    { code: 'MICRO', name: 'Urine Microscopy', unit: 'cells/hpf', range: 'RBC <2 | WBC <5' },
    { code: 'ACR', name: 'Albumin–Creatinine Ratio', unit: 'mg/g', range: '<30' },
  ],
  Serology: [
    { code: 'HIVAB', name: 'HIV Antibody Screen', unit: 'qualitative', range: 'Non-reactive' },
    { code: 'HBSAG', name: 'Hepatitis B Surface Antigen', unit: 'qualitative', range: 'Non-reactive' },
    { code: 'HCVAB', name: 'Hepatitis C Antibody', unit: 'qualitative', range: 'Non-reactive' },
    { code: 'VDRL', name: 'VDRL (Syphilis Screen)', unit: 'qualitative', range: 'Non-reactive' },
    { code: 'DENGNS', name: 'Dengue NS1 Antigen', unit: 'qualitative', range: 'Negative' },
    { code: 'MALAAB', name: 'Malaria Antigen Panel', unit: 'qualitative', range: 'Negative' },
    { code: 'WIDAL', name: 'Widal Test (Typhoid)', unit: 'titer', range: '<1:80' },
    { code: 'COVIDAG', name: 'COVID-19 Antigen Test', unit: 'qualitative', range: 'Negative' },
  ],
  Histopathology: [
    { code: 'HISTO', name: 'Histopathological Examination', unit: 'qualitative', range: 'See pathology report' },
    { code: 'CYTOL', name: 'Cytological Examination (PAP)', unit: 'qualitative', range: 'See pathology report' },
    { code: 'FNAC', name: 'FNAC (Fine Needle Aspiration)', unit: 'qualitative', range: 'See pathology report' },
  ],
  Radiology: [
    { code: 'XRAY', name: 'X-Ray', unit: 'image', range: 'Radiologist report' },
    { code: 'USG', name: 'Ultrasonography', unit: 'image', range: 'Sonologist report' },
    { code: 'CT', name: 'CT Scan', unit: 'image', range: 'Radiologist report' },
    { code: 'MRI', name: 'MRI Scan', unit: 'image', range: 'Radiologist report' },
    { code: 'ECG', name: 'Electrocardiogram (ECG)', unit: 'trace', range: 'Cardiologist report' },
    { code: 'ECHO', name: 'Echocardiography', unit: 'image', range: 'Cardiologist report' },
  ],
};

const STATUS_CONFIG: Record<TestStatus, { color: string; bg: string; border: string; icon: React.ReactNode }> = {
  Pending: { color: '#b45309', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.35)', icon: <Clock size={12} /> },
  'In Progress': { color: '#0284c7', bg: 'rgba(14,165,233,0.12)', border: 'rgba(14,165,233,0.35)', icon: <Activity size={12} /> },
  Completed: { color: '#059669', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.35)', icon: <CheckCircle size={12} /> },
  Cancelled: { color: '#9ca3af', bg: 'rgba(156,163,175,0.12)', border: 'rgba(156,163,175,0.35)', icon: <X size={12} /> },
};

const PRIORITY_CONFIG: Record<PriorityLevel, { color: string; bg: string }> = {
  Routine: { color: '#475569', bg: 'rgba(71,85,105,0.1)' },
  Urgent: { color: '#d97706', bg: 'rgba(217,119,6,0.12)' },
  STAT: { color: '#e11d48', bg: 'rgba(225,29,72,0.12)' },
};

export const LabConsole: React.FC<LabConsoleProps> = ({ currentRole }) => {
  const [activeSubTab, setActiveSubTab] = useState<'queue' | 'order' | 'results' | 'analytics'>('queue');
  const [orders, setOrders] = useState<LabTestOrder[]>([]);
  const [stats, setStats] = useState<LabStat | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<TestStatus | 'All'>('All');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [priorityFilter, setPriorityFilter] = useState<PriorityLevel | 'All'>('All');
  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{ text: string; isError: boolean } | null>(null);

  // Order Form State
  const [patients, setPatients] = useState<any[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Haematology');
  const [selectedTestCode, setSelectedTestCode] = useState('');
  const [orderPriority, setOrderPriority] = useState<PriorityLevel>('Routine');
  const [orderNotes, setOrderNotes] = useState('');
  const [orderingDoctorNote, setOrderingDoctorNote] = useState('');
  const [orderLoading, setOrderLoading] = useState(false);
  const [patientSearch, setPatientSearch] = useState('');

  // Result Entry State
  const [selectedOrderForResult, setSelectedOrderForResult] = useState<LabTestOrder | null>(null);
  const [resultValue, setResultValue] = useState('');
  const [resultNotes, setResultNotes] = useState('');
  const [isAbnormal, setIsAbnormal] = useState(false);
  const [technicianName, setTechnicianName] = useState('');
  const [resultLoading, setResultLoading] = useState(false);

  const showFeedback = (text: string, isError = false) => {
    setFeedback({ text, isError });
    setTimeout(() => setFeedback(null), 4000);
  };

  const loadOrders = useCallback(async () => {
    try {
      const res = await api.getLabOrders?.({
        search: searchQuery || undefined,
        status: statusFilter !== 'All' ? statusFilter : undefined,
        category: categoryFilter !== 'All' ? categoryFilter : undefined,
        priority: priorityFilter !== 'All' ? priorityFilter : undefined,
      });
      if (res?.success) {
        setOrders(res.data || []);
        setStats(res.stats || null);
      }
    } catch {
      // gracefully show empty
    } finally {
      setLoading(false);
    }
  }, [searchQuery, statusFilter, categoryFilter, priorityFilter]);

  useEffect(() => {
    loadOrders();
    const interval = setInterval(loadOrders, 30000);
    return () => clearInterval(interval);
  }, [loadOrders]);

  const loadPatients = async (query?: string) => {
    try {
      const res = await api.searchPatients(query);
      if (res.success) setPatients(res.data || []);
    } catch { /* empty */ }
  };

  useEffect(() => {
    loadPatients(patientSearch || undefined);
  }, [patientSearch]);

  const handleOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatientId || !selectedTestCode) {
      showFeedback('Please select a patient and a test.', true);
      return;
    }
    setOrderLoading(true);
    try {
      const testDef = PANEL_TESTS[selectedCategory]?.find(t => t.code === selectedTestCode);
      const res = await api.createLabOrder?.({
        patient_id: Number(selectedPatientId),
        test_code: selectedTestCode,
        test_name: testDef?.name || selectedTestCode,
        category: selectedCategory,
        priority: orderPriority,
        notes: orderNotes || orderingDoctorNote,
        reference_range: testDef?.range,
        result_unit: testDef?.unit,
      });
      if (res?.success) {
        showFeedback(`Lab order #${res.orderId} placed successfully.`);
        setSelectedPatientId('');
        setOrderNotes('');
        setOrderingDoctorNote('');
        setActiveSubTab('queue');
        loadOrders();
      }
    } catch (err: any) {
      showFeedback(err.message || 'Failed to create lab order.', true);
    } finally {
      setOrderLoading(false);
    }
  };

  const handleResultSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderForResult || !resultValue.trim()) {
      showFeedback('Please enter the result value.', true);
      return;
    }
    setResultLoading(true);
    try {
      const res = await api.updateLabResult?.({
        order_id: selectedOrderForResult.id,
        result_value: resultValue,
        is_abnormal: isAbnormal,
        notes: resultNotes,
        technician_name: technicianName,
      });
      if (res?.success) {
        showFeedback(`Result for ${selectedOrderForResult.test_name} entered successfully.`);
        setSelectedOrderForResult(null);
        setResultValue('');
        setResultNotes('');
        setIsAbnormal(false);
        setTechnicianName('');
        loadOrders();
      }
    } catch (err: any) {
      showFeedback(err.message || 'Failed to record result.', true);
    } finally {
      setResultLoading(false);
    }
  };

  const handleUpdateStatus = async (orderId: number, newStatus: TestStatus) => {
    try {
      const res = await api.updateLabOrderStatus?.({ order_id: orderId, status: newStatus });
      if (res?.success) {
        showFeedback(`Order status updated to ${newStatus}.`);
        loadOrders();
      }
    } catch (err: any) {
      showFeedback(err.message || 'Status update failed.', true);
    }
  };

  const filteredOrders = orders.filter(o => {
    const q = searchQuery.toLowerCase();
    return (
      o.patient_name?.toLowerCase().includes(q) ||
      o.test_name?.toLowerCase().includes(q) ||
      o.patient_mrn?.toLowerCase().includes(q) ||
      o.test_code?.toLowerCase().includes(q)
    );
  });

  const statCards = [
    { label: 'Total Ordered', value: stats?.total_ordered ?? '--', color: '#0284c7', icon: <FlaskConical size={18} color="#0284c7" /> },
    { label: 'Pending', value: stats?.pending ?? '--', color: '#d97706', icon: <Clock size={18} color="#d97706" /> },
    { label: 'In Progress', value: stats?.in_progress ?? '--', color: '#7c3aed', icon: <Activity size={18} color="#7c3aed" /> },
    { label: 'Completed Today', value: stats?.completed_today ?? '--', color: '#059669', icon: <CheckCircle size={18} color="#059669" /> },
    { label: 'Abnormal Results', value: stats?.abnormal_today ?? '--', color: '#e11d48', icon: <AlertTriangle size={18} color="#e11d48" /> },
    { label: 'Avg TAT (hrs)', value: stats?.avg_turnaround_hours != null ? `${stats.avg_turnaround_hours}h` : '--', color: '#6366f1', icon: <TrendingUp size={18} color="#6366f1" /> },
  ];

  return (
    <div style={{ maxWidth: 1440, margin: '0 auto', padding: '24px' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 12 }}>
          <Microscope size={28} color="#7c3aed" />
          Laboratory Information Console
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: 4 }}>
          Real-time lab order tracking, result entry, and diagnostic reporting for all departments.
        </p>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div style={{
          padding: '12px 18px', borderRadius: 12, marginBottom: 16, fontWeight: 600, fontSize: '0.88rem',
          background: feedback.isError ? 'rgba(244,63,94,0.12)' : 'rgba(16,185,129,0.12)',
          border: `1px solid ${feedback.isError ? 'rgba(244,63,94,0.4)' : 'rgba(16,185,129,0.4)'}`,
          color: feedback.isError ? '#be123c' : '#059669',
          display: 'flex', alignItems: 'center', gap: 8
        }}>
          {feedback.isError ? <AlertTriangle size={16} /> : <CheckCircle size={16} />}
          {feedback.text}
        </div>
      )}

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
        {statCards.map((card, i) => (
          <div key={i} className="glass-panel" style={{ padding: '18px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>{card.label}</span>
              {card.icon}
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: card.color }}>{card.value}</div>
          </div>
        ))}
      </div>

      {/* Sub-Tab Navigation */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {[
          { id: 'queue', label: 'Test Queue', icon: <FlaskConical size={15} /> },
          { id: 'order', label: 'New Lab Order', icon: <Plus size={15} /> },
          { id: 'results', label: 'Enter Results', icon: <FileText size={15} /> },
          { id: 'analytics', label: 'TAT Analytics', icon: <TrendingUp size={15} /> },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id as any)}
            className={activeSubTab === tab.id ? 'glass-btn' : 'glass-btn glass-btn-secondary'}
            style={{ fontSize: '0.85rem', padding: '8px 16px', gap: 6 }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
        <button onClick={loadOrders} className="glass-btn glass-btn-secondary" style={{ padding: '8px 12px', marginLeft: 'auto' }}>
          <RefreshCw size={14} />
        </button>
      </div>

      {/* === TEST QUEUE TAB === */}
      {activeSubTab === 'queue' && (
        <div>
          {/* Filters */}
          <div className="glass-panel" style={{ padding: 16, marginBottom: 18, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
              <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
              <input
                className="glass-input"
                style={{ paddingLeft: 36 }}
                placeholder="Search patient name, MRN, test..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            <select className="glass-input" style={{ width: 'auto', minWidth: 140 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}>
              <option value="All">All Statuses</option>
              {(['Pending', 'In Progress', 'Completed', 'Cancelled'] as TestStatus[]).map(s => <option key={s}>{s}</option>)}
            </select>
            <select className="glass-input" style={{ width: 'auto', minWidth: 160 }} value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
              <option value="All">All Categories</option>
              {TEST_CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
            <select className="glass-input" style={{ width: 'auto', minWidth: 130 }} value={priorityFilter} onChange={e => setPriorityFilter(e.target.value as any)}>
              <option value="All">All Priorities</option>
              {(['Routine', 'Urgent', 'STAT'] as PriorityLevel[]).map(p => <option key={p}>{p}</option>)}
            </select>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-dim)' }}>Loading lab queue...</div>
          ) : filteredOrders.length === 0 ? (
            <div className="glass-panel" style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
              <Microscope size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
              <p>No lab orders found matching the current filters.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filteredOrders.map(order => {
                const statusCfg = STATUS_CONFIG[order.status];
                const priorityCfg = PRIORITY_CONFIG[order.priority];
                const isExpanded = expandedOrderId === order.id;
                return (
                  <div key={order.id} className="glass-panel" style={{ overflow: 'hidden' }}>
                    {/* Order Row */}
                    <div
                      style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', flexWrap: 'wrap' }}
                      onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                    >
                      {/* Priority Badge */}
                      <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 800, background: priorityCfg.bg, color: priorityCfg.color, minWidth: 60, textAlign: 'center' }}>
                        {order.priority}
                      </span>

                      {/* Test Info */}
                      <div style={{ flex: 1, minWidth: 200 }}>
                        <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.95rem' }}>{order.test_name}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
                          [{order.test_code}] • {order.category}
                        </div>
                      </div>

                      {/* Patient */}
                      <div style={{ minWidth: 160 }}>
                        <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.85rem' }}>{order.patient_name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>MRN: {order.patient_mrn}</div>
                      </div>

                      {/* Doctor */}
                      <div style={{ minWidth: 140, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        Dr. {order.doctor_name}
                      </div>

                      {/* Ordered Time */}
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', minWidth: 100 }}>
                        {new Date(order.ordered_at).toLocaleString()}
                      </div>

                      {/* Status Badge */}
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        padding: '4px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 700,
                        background: statusCfg.bg, color: statusCfg.color, border: `1px solid ${statusCfg.border}`
                      }}>
                        {statusCfg.icon} {order.status}
                      </span>

                      {/* Abnormal Flag */}
                      {order.is_abnormal && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#e11d48', fontSize: '0.75rem', fontWeight: 700 }}>
                          <TrendingDown size={13} /> ABNORMAL
                        </span>
                      )}

                      {isExpanded ? <ChevronUp size={16} color="var(--text-dim)" /> : <ChevronDown size={16} color="var(--text-dim)" />}
                    </div>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div style={{ borderTop: '1px solid var(--glass-border-subtle)', padding: '16px 18px', background: 'rgba(241,245,249,0.5)' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 16 }}>
                          <div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontWeight: 600, marginBottom: 2 }}>REFERENCE RANGE</div>
                            <div style={{ fontSize: '0.88rem', color: '#0f172a' }}>{order.reference_range || '—'}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontWeight: 600, marginBottom: 2 }}>RESULT VALUE</div>
                            <div style={{ fontSize: '0.88rem', color: order.is_abnormal ? '#e11d48' : '#059669', fontWeight: 700 }}>
                              {order.result_value ? `${order.result_value} ${order.result_unit || ''}` : 'Awaiting result'}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontWeight: 600, marginBottom: 2 }}>TECHNICIAN</div>
                            <div style={{ fontSize: '0.88rem', color: '#0f172a' }}>{order.technician_name || '—'}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontWeight: 600, marginBottom: 2 }}>NOTES</div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{order.notes || '—'}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontWeight: 600, marginBottom: 2 }}>RESULTED AT</div>
                            <div style={{ fontSize: '0.85rem', color: '#0f172a' }}>
                              {order.resulted_at ? new Date(order.resulted_at).toLocaleString() : 'Pending'}
                            </div>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {order.status === 'Pending' && (
                            <button className="glass-btn" style={{ fontSize: '0.8rem', padding: '7px 14px' }}
                              onClick={() => handleUpdateStatus(order.id, 'In Progress')}>
                              <Activity size={13} /> Mark In Progress
                            </button>
                          )}
                          {order.status === 'In Progress' && (
                            <button className="glass-btn" style={{ fontSize: '0.8rem', padding: '7px 14px', background: 'linear-gradient(135deg,#059669,#047857)' }}
                              onClick={() => { setSelectedOrderForResult(order); setActiveSubTab('results'); }}>
                              <FileText size={13} /> Enter Result
                            </button>
                          )}
                          {order.status === 'Pending' && (
                            <button className="glass-btn glass-btn-danger" style={{ fontSize: '0.8rem', padding: '7px 14px' }}
                              onClick={() => handleUpdateStatus(order.id, 'Cancelled')}>
                              <X size={13} /> Cancel Order
                            </button>
                          )}
                          {order.status === 'Completed' && (
                            <button className="glass-btn glass-btn-secondary" style={{ fontSize: '0.8rem', padding: '7px 14px' }}>
                              <Download size={13} /> Download Report
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* === NEW ORDER TAB === */}
      {activeSubTab === 'order' && (
        <div className="glass-panel" style={{ padding: 28, maxWidth: 640 }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Plus size={20} color="#7c3aed" /> New Laboratory Test Order
          </h2>

          <form onSubmit={handleOrderSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Patient Search */}
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>
                Patient <span style={{ color: '#e11d48' }}>*</span>
              </label>
              <input
                className="glass-input"
                placeholder="Search patient by name or MRN..."
                value={patientSearch}
                onChange={e => setPatientSearch(e.target.value)}
                style={{ marginBottom: 6 }}
              />
              {patients.length > 0 && (
                <select
                  className="glass-input"
                  value={selectedPatientId}
                  onChange={e => setSelectedPatientId(e.target.value)}
                  required
                >
                  <option value="">-- Select Patient --</option>
                  {patients.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.first_name} {p.last_name} — MRN: {p.mrn}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Test Category */}
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>
                Test Category <span style={{ color: '#e11d48' }}>*</span>
              </label>
              <select
                className="glass-input"
                value={selectedCategory}
                onChange={e => { setSelectedCategory(e.target.value); setSelectedTestCode(''); }}
                required
              >
                {TEST_CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>

            {/* Specific Test */}
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>
                Specific Test <span style={{ color: '#e11d48' }}>*</span>
              </label>
              <select
                className="glass-input"
                value={selectedTestCode}
                onChange={e => setSelectedTestCode(e.target.value)}
                required
              >
                <option value="">-- Select Test --</option>
                {(PANEL_TESTS[selectedCategory] || []).map(t => (
                  <option key={t.code} value={t.code}>{t.name} ({t.code})</option>
                ))}
              </select>
              {selectedTestCode && PANEL_TESTS[selectedCategory]?.find(t => t.code === selectedTestCode) && (
                <div style={{ marginTop: 6, padding: '8px 12px', borderRadius: 8, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}>
                  <span style={{ fontSize: '0.78rem', color: '#6366f1', fontWeight: 600 }}>
                    Reference: {PANEL_TESTS[selectedCategory].find(t => t.code === selectedTestCode)?.range} |
                    Unit: {PANEL_TESTS[selectedCategory].find(t => t.code === selectedTestCode)?.unit}
                  </span>
                </div>
              )}
            </div>

            {/* Priority */}
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>Priority</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['Routine', 'Urgent', 'STAT'] as PriorityLevel[]).map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setOrderPriority(p)}
                    style={{
                      padding: '8px 18px', borderRadius: 10, fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer',
                      border: `1.5px solid ${orderPriority === p ? PRIORITY_CONFIG[p].color : 'var(--glass-border-subtle)'}`,
                      background: orderPriority === p ? PRIORITY_CONFIG[p].bg : 'rgba(255,255,255,0.7)',
                      color: orderPriority === p ? PRIORITY_CONFIG[p].color : 'var(--text-muted)',
                    }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Clinical Notes */}
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>
                Clinical Notes / Ordering Physician Remarks
              </label>
              <textarea
                className="glass-input"
                rows={3}
                placeholder="Enter clinical indication, relevant history, or special instructions..."
                value={orderNotes}
                onChange={e => setOrderNotes(e.target.value)}
                style={{ resize: 'vertical' }}
              />
            </div>

            <button
              type="submit"
              className="glass-btn"
              disabled={orderLoading}
              style={{ padding: '13px', justifyContent: 'center', fontSize: '0.95rem', fontWeight: 800 }}
            >
              {orderLoading ? 'Placing Order...' : <><Plus size={16} /> Place Lab Order</>}
            </button>
          </form>
        </div>
      )}

      {/* === ENTER RESULTS TAB === */}
      {activeSubTab === 'results' && (
        <div style={{ display: 'grid', gridTemplateColumns: selectedOrderForResult ? '1fr 420px' : '1fr', gap: 20 }}>
          {/* In-Progress Orders List */}
          <div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', marginBottom: 14 }}>
              Orders Awaiting Results
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {orders.filter(o => o.status === 'In Progress' || o.status === 'Pending').length === 0 ? (
                <div className="glass-panel" style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
                  No pending or in-progress orders.
                </div>
              ) : (
                orders.filter(o => o.status === 'In Progress' || o.status === 'Pending').map(order => (
                  <div
                    key={order.id}
                    className="glass-panel"
                    style={{
                      padding: '14px 18px', cursor: 'pointer',
                      border: selectedOrderForResult?.id === order.id ? '1.5px solid #7c3aed' : undefined,
                      background: selectedOrderForResult?.id === order.id ? 'rgba(124,58,237,0.06)' : undefined,
                    }}
                    onClick={() => {
                      setSelectedOrderForResult(order);
                      setResultValue('');
                      setResultNotes(order.notes || '');
                      setIsAbnormal(false);
                      setTechnicianName('');
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{order.test_name}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
                          {order.patient_name} | Ref: {order.reference_range}
                        </div>
                      </div>
                      <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 800, background: PRIORITY_CONFIG[order.priority].bg, color: PRIORITY_CONFIG[order.priority].color }}>
                        {order.priority}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Result Entry Form */}
          {selectedOrderForResult && (
            <div className="glass-panel" style={{ padding: 24, height: 'fit-content', position: 'sticky', top: 80 }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>
                Enter Result: {selectedOrderForResult.test_name}
              </h3>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 18 }}>
                Patient: {selectedOrderForResult.patient_name} | Ref Range: {selectedOrderForResult.reference_range}
              </div>

              <form onSubmit={handleResultSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#0f172a', marginBottom: 5 }}>
                    Result Value ({selectedOrderForResult.result_unit || 'units'}) *
                  </label>
                  <input
                    className="glass-input"
                    type="text"
                    placeholder={`Enter value in ${selectedOrderForResult.result_unit || 'units'}...`}
                    value={resultValue}
                    onChange={e => setResultValue(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#0f172a', marginBottom: 5 }}>
                    Technician / Analyst Name
                  </label>
                  <input
                    className="glass-input"
                    type="text"
                    placeholder="Lab technician name..."
                    value={technicianName}
                    onChange={e => setTechnicianName(e.target.value)}
                  />
                </div>

                {/* Abnormal Toggle */}
                <div
                  onClick={() => setIsAbnormal(!isAbnormal)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                    borderRadius: 10, cursor: 'pointer',
                    background: isAbnormal ? 'rgba(225,29,72,0.1)' : 'rgba(241,245,249,0.8)',
                    border: `1.5px solid ${isAbnormal ? 'rgba(225,29,72,0.4)' : 'var(--glass-border-subtle)'}`,
                  }}
                >
                  <div style={{
                    width: 18, height: 18, borderRadius: 4,
                    background: isAbnormal ? '#e11d48' : 'rgba(203,213,225,0.5)',
                    border: `2px solid ${isAbnormal ? '#e11d48' : '#cbd5e1'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    {isAbnormal && <span style={{ color: '#fff', fontSize: '0.7rem', fontWeight: 800 }}>✓</span>}
                  </div>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: isAbnormal ? '#e11d48' : 'var(--text-muted)' }}>
                    Flag as Abnormal / Critical
                  </span>
                  {isAbnormal && <AlertTriangle size={15} color="#e11d48" />}
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#0f172a', marginBottom: 5 }}>
                    Lab Notes / Interpretation
                  </label>
                  <textarea
                    className="glass-input"
                    rows={3}
                    placeholder="Additional notes, interpretations, or methodologies..."
                    value={resultNotes}
                    onChange={e => setResultNotes(e.target.value)}
                    style={{ resize: 'vertical' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="submit" className="glass-btn" disabled={resultLoading}
                    style={{ flex: 1, justifyContent: 'center', padding: '12px', fontWeight: 800, background: isAbnormal ? 'linear-gradient(135deg,#e11d48,#be123c)' : undefined }}>
                    {resultLoading ? 'Saving...' : <><CheckCircle size={15} /> Submit Result</>}
                  </button>
                  <button type="button" className="glass-btn glass-btn-secondary" onClick={() => setSelectedOrderForResult(null)} style={{ padding: '12px' }}>
                    <X size={15} />
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* === ANALYTICS TAB === */}
      {activeSubTab === 'analytics' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
          <div className="glass-panel" style={{ padding: 24 }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', marginBottom: 16 }}>Test Volume by Category</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {TEST_CATEGORIES.map((cat, i) => {
                const count = orders.filter(o => o.category === cat).length;
                const maxCount = Math.max(...TEST_CATEGORIES.map(c => orders.filter(o => o.category === c).length), 1);
                return (
                  <div key={cat}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, color: '#0f172a' }}>{cat}</span>
                      <span style={{ color: '#0284c7', fontWeight: 700 }}>{count} orders</span>
                    </div>
                    <div style={{ height: 7, background: 'rgba(226,232,240,0.8)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{
                        width: `${(count / maxCount) * 100}%`, height: '100%',
                        background: `hsl(${(i * 360) / TEST_CATEGORIES.length}, 70%, 55%)`,
                        borderRadius: 3, transition: 'width 0.5s ease'
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="glass-panel" style={{ padding: 24 }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', marginBottom: 16 }}>Status Distribution</h3>
            {(['Pending', 'In Progress', 'Completed', 'Cancelled'] as TestStatus[]).map(status => {
              const count = orders.filter(o => o.status === status).length;
              const pct = orders.length > 0 ? Math.round((count / orders.length) * 100) : 0;
              const cfg = STATUS_CONFIG[status];
              return (
                <div key={status} style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, color: cfg.color }}>{status}</span>
                    <span style={{ color: 'var(--text-muted)' }}>{count} ({pct}%)</span>
                  </div>
                  <div style={{ height: 7, background: cfg.bg, borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: cfg.color, borderRadius: 3 }} />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="glass-panel" style={{ padding: 24 }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', marginBottom: 16 }}>Priority Breakdown</h3>
            {(['Routine', 'Urgent', 'STAT'] as PriorityLevel[]).map(priority => {
              const count = orders.filter(o => o.priority === priority).length;
              const pct = orders.length > 0 ? Math.round((count / orders.length) * 100) : 0;
              const cfg = PRIORITY_CONFIG[priority];
              return (
                <div key={priority} style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, color: cfg.color }}>{priority}</span>
                    <span style={{ color: 'var(--text-muted)' }}>{count} ({pct}%)</span>
                  </div>
                  <div style={{ height: 8, background: cfg.bg, borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: cfg.color, borderRadius: 4 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
