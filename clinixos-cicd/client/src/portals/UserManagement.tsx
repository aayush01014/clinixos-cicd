import React, { useState, useEffect } from 'react';
import { UserRole } from '../types';
import { api } from '../services/api';
import {
  Users, UserPlus, Search, Shield, Key, Edit3,
  Trash2, CheckCircle, AlertTriangle, RefreshCw,
  Lock, Unlock, Eye, EyeOff, Settings, Database
} from 'lucide-react';

interface UserManagementProps {
  currentRole: UserRole;
}

type SystemRole = 'Admin' | 'Doctor' | 'Nurse' | 'Receptionist' | 'Pharmacist' | 'Patient';

interface SystemUser {
  id: number;
  full_name: string;
  email: string;
  role: SystemRole;
  department: string | null;
  created_at: string;
  last_login: string | null;
  is_active: boolean;
  employee_id: string | null;
  specialization: string | null;
}

interface UserStats {
  total: number;
  active: number;
  inactive: number;
  by_role: Record<SystemRole, number>;
}

const ROLE_CONFIG: Record<SystemRole, { color: string; bg: string; border: string }> = {
  Admin: { color: '#e11d48', bg: 'rgba(225,29,72,0.1)', border: 'rgba(225,29,72,0.35)' },
  Doctor: { color: '#0284c7', bg: 'rgba(2,132,199,0.1)', border: 'rgba(2,132,199,0.35)' },
  Nurse: { color: '#059669', bg: 'rgba(5,150,105,0.1)', border: 'rgba(5,150,105,0.35)' },
  Receptionist: { color: '#7c3aed', bg: 'rgba(124,58,237,0.1)', border: 'rgba(124,58,237,0.35)' },
  Pharmacist: { color: '#d97706', bg: 'rgba(217,119,6,0.1)', border: 'rgba(217,119,6,0.35)' },
  Patient: { color: '#6366f1', bg: 'rgba(99,102,241,0.1)', border: 'rgba(99,102,241,0.35)' },
};

const DEPARTMENTS = [
  'Administration', 'Cardiology', 'Neurology', 'Orthopaedics', 'Paediatrics',
  'Gynaecology', 'General Medicine', 'Emergency', 'ICU', 'Pharmacy', 'Laboratory',
  'Radiology', 'Oncology', 'Dermatology', 'ENT', 'Ophthalmology', 'Psychiatry'
];

const SPECIALIZATIONS = [
  'General Physician', 'Cardiologist', 'Neurologist', 'Orthopaedic Surgeon',
  'Paediatrician', 'Gynaecologist', 'Oncologist', 'Dermatologist', 'ENT Specialist',
  'Ophthalmologist', 'Psychiatrist', 'Radiologist', 'Pathologist', 'Anaesthesiologist',
  'Emergency Medicine', 'Intensivist', 'Nephrologist', 'Gastroenterologist',
  'Pulmonologist', 'Rheumatologist', 'Endocrinologist', 'Urologist'
];

export const UserManagement: React.FC<UserManagementProps> = ({ currentRole }) => {
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState<'list' | 'create' | 'roles'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<SystemRole | 'All'>('All');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive'>('All');
  const [feedback, setFeedback] = useState<{ text: string; isError: boolean } | null>(null);
  const [editingUser, setEditingUser] = useState<SystemUser | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Create/Edit Form
  const [formFullName, setFormFullName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState<SystemRole>('Doctor');
  const [formDepartment, setFormDepartment] = useState('');
  const [formSpecialization, setFormSpecialization] = useState('');
  const [formEmployeeId, setFormEmployeeId] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  const showFeedback = (text: string, isError = false) => {
    setFeedback({ text, isError });
    setTimeout(() => setFeedback(null), 4500);
  };

  const loadUsers = async () => {
    try {
      const res = await api.getSystemUsers?.({
        search: searchQuery || undefined,
        role: roleFilter !== 'All' ? roleFilter : undefined,
        is_active: statusFilter === 'All' ? undefined : statusFilter === 'Active',
      });
      if (res?.success) {
        setUsers(res.data || []);
        setStats(res.stats || null);
      }
    } catch { /* empty */ } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadUsers(); }, [searchQuery, roleFilter, statusFilter]);

  const resetForm = () => {
    setFormFullName(''); setFormEmail(''); setFormPassword('');
    setFormRole('Doctor'); setFormDepartment(''); setFormSpecialization('');
    setFormEmployeeId(''); setEditingUser(null);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formFullName.trim() || !formEmail.trim()) {
      showFeedback('Full name and email are required.', true);
      return;
    }
    if (!editingUser && !formPassword.trim()) {
      showFeedback('Password is required for new users.', true);
      return;
    }
    setFormLoading(true);
    try {
      let res;
      if (editingUser) {
        res = await api.updateSystemUser?.({
          id: editingUser.id,
          full_name: formFullName,
          email: formEmail,
          role: formRole,
          department: formDepartment || null,
          specialization: formSpecialization || null,
          employee_id: formEmployeeId || null,
          ...(formPassword ? { password: formPassword } : {}),
        });
      } else {
        res = await api.createSystemUser?.({
          full_name: formFullName,
          email: formEmail,
          password: formPassword,
          role: formRole,
          department: formDepartment || null,
          specialization: formSpecialization || null,
          employee_id: formEmployeeId || null,
        });
      }
      if (res?.success) {
        showFeedback(editingUser ? `User "${formFullName}" updated.` : `User "${formFullName}" created successfully.`);
        resetForm();
        setActiveSubTab('list');
        loadUsers();
      }
    } catch (err: any) {
      showFeedback(err.message || 'Operation failed.', true);
    } finally {
      setFormLoading(false);
    }
  };

  const handleEditUser = (user: SystemUser) => {
    setEditingUser(user);
    setFormFullName(user.full_name);
    setFormEmail(user.email);
    setFormPassword('');
    setFormRole(user.role);
    setFormDepartment(user.department || '');
    setFormSpecialization(user.specialization || '');
    setFormEmployeeId(user.employee_id || '');
    setActiveSubTab('create');
  };

  const handleToggleActive = async (userId: number, isActive: boolean, name: string) => {
    try {
      const res = await api.toggleUserActive?.({ id: userId, is_active: !isActive });
      if (res?.success) {
        showFeedback(`${name} has been ${!isActive ? 'activated' : 'deactivated'}.`);
        loadUsers();
      }
    } catch (err: any) {
      showFeedback(err.message || 'Failed to update user status.', true);
    }
  };

  const handleResetPassword = async (userId: number, name: string) => {
    const newPass = prompt(`Enter new password for ${name}:`);
    if (!newPass || newPass.length < 6) {
      showFeedback('Password must be at least 6 characters.', true);
      return;
    }
    try {
      const res = await api.resetUserPassword?.({ id: userId, password: newPass });
      if (res?.success) showFeedback(`Password for ${name} reset successfully.`);
    } catch (err: any) {
      showFeedback(err.message || 'Password reset failed.', true);
    }
  };

  const filteredUsers = users.filter(u => {
    const q = searchQuery.toLowerCase();
    return u.full_name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || u.employee_id?.toLowerCase().includes(q);
  });

  return (
    <div style={{ maxWidth: 1440, margin: '0 auto', padding: '24px' }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 12 }}>
          <Settings size={28} color="#6366f1" /> User & Access Management
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: 4 }}>
          Create, manage, and control staff accounts with role-based access. Requires Admin privileges.
        </p>
      </div>

      {/* Feedback */}
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

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14, marginBottom: 24 }}>
        <div className="glass-panel" style={{ padding: '16px 18px' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>Total Users</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0284c7' }}>{stats?.total ?? '--'}</div>
        </div>
        <div className="glass-panel" style={{ padding: '16px 18px' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>Active</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#059669' }}>{stats?.active ?? '--'}</div>
        </div>
        <div className="glass-panel" style={{ padding: '16px 18px' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>Inactive</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#d97706' }}>{stats?.inactive ?? '--'}</div>
        </div>
        {(Object.entries(ROLE_CONFIG) as [SystemRole, typeof ROLE_CONFIG[SystemRole]][])
          .filter(([r]) => r !== 'Patient')
          .map(([role, cfg]) => (
            <div key={role} className="glass-panel" style={{ padding: '16px 18px', borderColor: cfg.border }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: cfg.color, marginBottom: 6 }}>{role}s</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: cfg.color }}>{stats?.by_role[role] ?? 0}</div>
            </div>
          ))}
      </div>

      {/* Sub-Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { id: 'list', label: 'All Users', icon: <Users size={15} /> },
          { id: 'create', label: editingUser ? 'Edit User' : 'Create User', icon: <UserPlus size={15} /> },
          { id: 'roles', label: 'Role Permissions', icon: <Shield size={15} /> },
        ].map(tab => (
          <button key={tab.id} onClick={() => { setActiveSubTab(tab.id as any); if (tab.id !== 'create') resetForm(); }}
            className={activeSubTab === tab.id ? 'glass-btn' : 'glass-btn glass-btn-secondary'}
            style={{ fontSize: '0.85rem', padding: '8px 16px', gap: 6 }}>
            {tab.icon} {tab.label}
          </button>
        ))}
        <button onClick={loadUsers} className="glass-btn glass-btn-secondary" style={{ padding: '8px 12px', marginLeft: 'auto' }}>
          <RefreshCw size={14} />
        </button>
      </div>

      {/* === USER LIST TAB === */}
      {activeSubTab === 'list' && (
        <div>
          {/* Filters */}
          <div className="glass-panel" style={{ padding: 16, marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
              <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
              <input className="glass-input" style={{ paddingLeft: 36 }} placeholder="Search name, email, employee ID..."
                value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>
            <select className="glass-input" style={{ width: 'auto', minWidth: 140 }} value={roleFilter} onChange={e => setRoleFilter(e.target.value as any)}>
              <option value="All">All Roles</option>
              {Object.keys(ROLE_CONFIG).map(r => <option key={r}>{r}</option>)}
            </select>
            <select className="glass-input" style={{ width: 'auto', minWidth: 130 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}>
              <option value="All">All Status</option>
              <option>Active</option>
              <option>Inactive</option>
            </select>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-dim)' }}>Loading users...</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filteredUsers.length === 0 ? (
                <div className="glass-panel" style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
                  <Database size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
                  <p>No users found.</p>
                </div>
              ) : filteredUsers.map(user => {
                const roleCfg = ROLE_CONFIG[user.role];
                return (
                  <div key={user.id} className="glass-panel" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', opacity: user.is_active ? 1 : 0.65 }}>
                    {/* Role Badge */}
                    <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 800, background: roleCfg.bg, color: roleCfg.color, border: `1px solid ${roleCfg.border}`, minWidth: 100, textAlign: 'center' }}>
                      {user.role}
                    </span>

                    {/* User Info */}
                    <div style={{ flex: 1, minWidth: 180 }}>
                      <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.95rem' }}>{user.full_name}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 1 }}>{user.email}</div>
                    </div>

                    {/* Department */}
                    <div style={{ minWidth: 130 }}>
                      <div style={{ fontSize: '0.82rem', color: '#0f172a', fontWeight: 600 }}>{user.department || '—'}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{user.specialization || ''}</div>
                    </div>

                    {/* Employee ID */}
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', minWidth: 90 }}>
                      {user.employee_id ? `ID: ${user.employee_id}` : ''}
                    </div>

                    {/* Last Login */}
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', minWidth: 120 }}>
                      {user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never logged in'}
                    </div>

                    {/* Active Status */}
                    <span style={{
                      padding: '3px 10px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700,
                      background: user.is_active ? 'rgba(5,150,105,0.12)' : 'rgba(156,163,175,0.12)',
                      color: user.is_active ? '#059669' : '#6b7280',
                      border: `1px solid ${user.is_active ? 'rgba(5,150,105,0.35)' : 'rgba(156,163,175,0.35)'}`
                    }}>
                      {user.is_active ? 'Active' : 'Inactive'}
                    </span>

                    {/* Actions */}
                    {currentRole === 'Admin' && (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button title="Edit user" className="glass-btn glass-btn-secondary" style={{ padding: '6px 10px' }} onClick={() => handleEditUser(user)}>
                          <Edit3 size={13} />
                        </button>
                        <button title={user.is_active ? 'Deactivate' : 'Activate'} className="glass-btn glass-btn-secondary" style={{ padding: '6px 10px' }}
                          onClick={() => handleToggleActive(user.id, user.is_active, user.full_name)}>
                          {user.is_active ? <Lock size={13} /> : <Unlock size={13} />}
                        </button>
                        <button title="Reset password" className="glass-btn glass-btn-secondary" style={{ padding: '6px 10px' }}
                          onClick={() => handleResetPassword(user.id, user.full_name)}>
                          <Key size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* === CREATE/EDIT USER TAB === */}
      {activeSubTab === 'create' && (
        <div className="glass-panel" style={{ padding: 28, maxWidth: 620 }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
            <UserPlus size={20} color="#6366f1" />
            {editingUser ? `Edit: ${editingUser.full_name}` : 'Create New System User'}
          </h2>
          <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', marginBottom: 5 }}>Full Name *</label>
                <input className="glass-input" placeholder="e.g. Dr. Sarah Johnson" value={formFullName} onChange={e => setFormFullName(e.target.value)} required />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', marginBottom: 5 }}>Hospital Email *</label>
                <input className="glass-input" type="email" placeholder="staff@clinixos.org" value={formEmail} onChange={e => setFormEmail(e.target.value)} required />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', marginBottom: 5 }}>
                {editingUser ? 'New Password (leave blank to keep current)' : 'Password *'}
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  className="glass-input"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Minimum 8 characters..."
                  value={formPassword}
                  onChange={e => setFormPassword(e.target.value)}
                  required={!editingUser}
                  style={{ paddingRight: 42 }}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)' }}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>Role *</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {(Object.keys(ROLE_CONFIG) as SystemRole[]).filter(r => r !== 'Patient').map(role => {
                  const cfg = ROLE_CONFIG[role];
                  return (
                    <button key={role} type="button" onClick={() => setFormRole(role)}
                      style={{
                        padding: '7px 16px', borderRadius: 10, fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer',
                        border: `1.5px solid ${formRole === role ? cfg.color : 'var(--glass-border-subtle)'}`,
                        background: formRole === role ? cfg.bg : 'rgba(255,255,255,0.7)',
                        color: formRole === role ? cfg.color : 'var(--text-muted)',
                      }}>
                      {role}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', marginBottom: 5 }}>Department</label>
                <select className="glass-input" value={formDepartment} onChange={e => setFormDepartment(e.target.value)}>
                  <option value="">-- Select Department --</option>
                  {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', marginBottom: 5 }}>Specialization</label>
                <select className="glass-input" value={formSpecialization} onChange={e => setFormSpecialization(e.target.value)}>
                  <option value="">-- Select Specialization --</option>
                  {SPECIALIZATIONS.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', marginBottom: 5 }}>Employee ID</label>
                <input className="glass-input" placeholder="e.g. EMP-2024-001" value={formEmployeeId} onChange={e => setFormEmployeeId(e.target.value)} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button type="submit" className="glass-btn" disabled={formLoading}
                style={{ flex: 1, justifyContent: 'center', padding: '13px', fontWeight: 800 }}>
                {formLoading ? 'Saving...' : <><CheckCircle size={16} /> {editingUser ? 'Save Changes' : 'Create User'}</>}
              </button>
              {editingUser && (
                <button type="button" className="glass-btn glass-btn-secondary" onClick={resetForm}
                  style={{ padding: '13px 18px' }}>
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      {/* === ROLE PERMISSIONS TAB === */}
      {activeSubTab === 'roles' && (
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', marginBottom: 16 }}>Role Access Matrix (RBAC)</h2>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--glass-border-subtle)' }}>
                  <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 700 }}>FEATURE / PORTAL</th>
                  {(Object.keys(ROLE_CONFIG) as SystemRole[]).map(r => (
                    <th key={r} style={{ padding: '10px 12px', fontSize: '0.78rem', fontWeight: 800, color: ROLE_CONFIG[r].color, textAlign: 'center' }}>{r}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { feature: 'Admin Dashboard', Admin: true, Doctor: false, Nurse: false, Receptionist: false, Pharmacist: false, Patient: false },
                  { feature: 'User Management', Admin: true, Doctor: false, Nurse: false, Receptionist: false, Pharmacist: false, Patient: false },
                  { feature: 'Doctor Workspace', Admin: true, Doctor: true, Nurse: false, Receptionist: false, Pharmacist: false, Patient: false },
                  { feature: 'Prescriptions (Write)', Admin: false, Doctor: true, Nurse: false, Receptionist: false, Pharmacist: false, Patient: false },
                  { feature: 'Nurse Station', Admin: true, Doctor: false, Nurse: true, Receptionist: false, Pharmacist: false, Patient: false },
                  { feature: 'Bed Management', Admin: true, Doctor: false, Nurse: true, Receptionist: true, Pharmacist: false, Patient: false },
                  { feature: 'Reception Desk', Admin: true, Doctor: false, Nurse: false, Receptionist: true, Pharmacist: false, Patient: false },
                  { feature: 'Patient Registration', Admin: true, Doctor: false, Nurse: false, Receptionist: true, Pharmacist: false, Patient: false },
                  { feature: 'Appointment Booking', Admin: true, Doctor: true, Nurse: true, Receptionist: true, Pharmacist: false, Patient: true },
                  { feature: 'Billing & Invoicing', Admin: true, Doctor: false, Nurse: false, Receptionist: true, Pharmacist: false, Patient: false },
                  { feature: 'Pharmacy Console', Admin: true, Doctor: false, Nurse: false, Receptionist: false, Pharmacist: true, Patient: false },
                  { feature: 'Lab Console', Admin: true, Doctor: true, Nurse: false, Receptionist: false, Pharmacist: false, Patient: false },
                  { feature: 'ICU Monitor', Admin: true, Doctor: true, Nurse: true, Receptionist: false, Pharmacist: false, Patient: false },
                  { feature: 'Patient Portal (Own)', Admin: false, Doctor: false, Nurse: false, Receptionist: false, Pharmacist: false, Patient: true },
                  { feature: 'PDF Report Generation', Admin: true, Doctor: true, Nurse: false, Receptionist: true, Pharmacist: true, Patient: false },
                ].map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--glass-border-subtle)', background: i % 2 === 0 ? 'rgba(241,245,249,0.4)' : 'transparent' }}>
                    <td style={{ padding: '10px 14px', fontSize: '0.85rem', fontWeight: 600, color: '#0f172a' }}>{row.feature}</td>
                    {(Object.keys(ROLE_CONFIG) as SystemRole[]).map(r => (
                      <td key={r} style={{ textAlign: 'center', padding: '10px 12px' }}>
                        {(row as any)[r] ? (
                          <CheckCircle size={16} color="#059669" />
                        ) : (
                          <span style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
