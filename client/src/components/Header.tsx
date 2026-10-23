import React from 'react';
import { Activity, LogOut, User as UserIcon } from 'lucide-react';
import { UserRole } from '../types';

interface HeaderProps {
  currentUser: any;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onSignOut: () => void;
  wsOnline?: boolean;
  alertBanner?: string | null;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  activeTab,
  onTabChange,
  onSignOut,
  alertBanner
}) => {
  const currentRole = (currentUser?.role || 'Admin') as UserRole;

  const tabsByRole: Record<UserRole, Array<{ id: string; label: string }>> = {
    Admin: [
      { id: 'admin', label: '📊 Dashboard' },
      { id: 'nurse', label: '🛏️ Ward Beds' },
      { id: 'doctor', label: '👨‍⚕️ Doctor Workspace' },
      { id: 'reception', label: '🏥 Reception & Intake' },
      { id: 'pharmacy', label: '💊 Pharmacy' },
      { id: 'lab', label: '🔬 Lab Console' },
      { id: 'icu', label: '❤️ ICU Monitor' },
      { id: 'users', label: '👥 User Management' },
      { id: 'patient', label: '🧑‍🤝‍🧑 Patient Portal' }
    ],
    Doctor: [
      { id: 'doctor', label: '🩺 My Clinical Workspace' },
      { id: 'nurse', label: '🛏️ Ward Beds' },
      { id: 'lab', label: '🔬 Lab Orders' },
      { id: 'icu', label: '❤️ ICU Monitor' }
    ],
    Nurse: [
      { id: 'nurse', label: '🛏️ Ward Bed Mapping' },
      { id: 'reception', label: '📋 Patient Registration' },
      { id: 'icu', label: '❤️ ICU Monitor' }
    ],
    Receptionist: [
      { id: 'reception', label: '🏥 Front-Desk & Billing' },
      { id: 'nurse', label: '🛏️ Ward Bed Overview' }
    ],
    Pharmacist: [
      { id: 'pharmacy', label: '💊 Pharmacy & Dispensing' }
    ],
    Patient: [
      { id: 'patient', label: '🧑‍⚕️ My Health Portal' }
    ]
  };

  const currentTabs = tabsByRole[currentRole] || [];

  return (
    <header className="header-container" style={{ borderBottom: '1px solid rgba(203, 213, 225, 0.7)', position: 'sticky', top: 0, zIndex: 100, backdropFilter: 'blur(20px)', background: 'rgba(255, 255, 255, 0.85)', boxShadow: '0 4px 20px rgba(15, 23, 42, 0.04)' }}>
      {/* Critical ICU Warning or Low Stock Global Notification Banner */}
      {alertBanner && (
        <div style={{ background: 'linear-gradient(90deg, #be123c 0%, #e11d48 100%)', color: '#fff', padding: '8px 24px', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <Activity size={16} />
          <span>{alertBanner}</span>
        </div>
      )}

      <div style={{ maxWidth: 1440, margin: '0 auto', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        {/* Brand Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 15px rgba(2, 132, 199, 0.3)' }}>
            <Activity size={24} color="#fff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#0f172a' }}>
                ClinixOS
              </span>
            </div>
            <p style={{ fontSize: '0.72rem', color: '#64748b' }}>Smart Hospital Resource &amp; Clinical Suite</p>
          </div>
        </div>

        {/* User Profile Pill */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '6px 14px',
              borderRadius: 12,
              background: 'rgba(255, 255, 255, 0.9)',
              border: '1px solid rgba(203, 213, 225, 0.7)',
              boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)'
            }}
          >
            <div style={{ width: 28, height: 28, borderRadius: 50, background: 'rgba(2, 132, 199, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <UserIcon size={16} color="#0284c7" />
            </div>
            <div>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a' }}>
                {currentUser?.email || 'User'}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#0284c7', fontWeight: 700 }}>
                Role: {currentRole}
              </div>
            </div>

            <button
              onClick={onSignOut}
              className="glass-btn glass-btn-secondary"
              title="Sign Out of Session"
              style={{ padding: '6px 10px', fontSize: '0.75rem', marginLeft: 8 }}
            >
              <LogOut size={13} /> Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div style={{ maxWidth: 1440, margin: '0 auto', padding: '0 24px', display: 'flex', gap: 6, overflowX: 'auto' }}>
        {currentTabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              style={{
                padding: '10px 18px',
                background: isActive ? 'rgba(2, 132, 199, 0.12)' : 'transparent',
                border: 'none',
                borderBottom: isActive ? '2.5px solid #0284c7' : '2.5px solid transparent',
                color: isActive ? '#0284c7' : '#475569',
                fontWeight: isActive ? 800 : 600,
                fontSize: '0.86rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                whiteSpace: 'nowrap'
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </header>
  );
};
