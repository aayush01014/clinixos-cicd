import React, { useState } from 'react';
import { Activity } from 'lucide-react';
import { api, setToken } from '../services/api';

interface LoginScreenProps {
  onLoginSuccess: (user: any) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  // Purely dynamic, starts completely empty with zero static pre-filled strings
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!email.trim() || !password.trim()) {
      setErrorMsg('Please enter your hospital email and password.');
      return;
    }

    setLoading(true);

    try {
      const res = await api.login({ email: email.trim(), password: password.trim() });
      if (res.success && res.token) {
        setToken(res.token);
        onLoginSuccess(res.user);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Invalid credentials. Please verify and retry.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100vw',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Ambient Lighting Mesh */}
      <div className="ambient-mesh">
        <div className="ambient-orb ambient-orb-1" />
        <div className="ambient-orb ambient-orb-2" />
      </div>

      {/* Floating Centered Balanced Light Glass Card */}
      <div
        className="glass-modal"
        style={{
          width: '100%',
          maxWidth: 440,
          padding: '44px 38px',
          position: 'relative',
          zIndex: 10,
          textAlign: 'center',
          border: '1.5px solid rgba(255, 255, 255, 0.95)',
          boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.12), 0 0 35px rgba(14, 165, 233, 0.12)',
          backdropFilter: 'blur(32px) saturate(180%)',
          WebkitBackdropFilter: 'blur(32px) saturate(180%)',
          background: 'rgba(255, 255, 255, 0.78)',
          borderRadius: 24
        }}
      >
        {/* ClinixOS Icon Badge */}
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 25px rgba(2, 132, 199, 0.35)',
            marginBottom: 16
          }}
        >
          <Activity size={32} color="#ffffff" />
        </div>

        {/* Title & Subtitle */}
        <h1
          style={{
            fontSize: '2.1rem',
            fontWeight: 800,
            letterSpacing: '-0.03em',
            color: '#0f172a',
            marginBottom: 4
          }}
        >
          ClinixOS
        </h1>
        <p style={{ fontSize: '0.88rem', color: '#475569', marginBottom: 24, fontWeight: 500 }}>
          Sign in with your hospital account.
        </p>

        {errorMsg && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 10,
              background: 'rgba(244, 63, 94, 0.12)',
              border: '1px solid rgba(244, 63, 94, 0.4)',
              color: '#be123c',
              fontSize: '0.84rem',
              marginBottom: 18,
              textAlign: 'left',
              fontWeight: 600
            }}
          >
            {errorMsg}
          </div>
        )}

        {/* Login Form with Clean Placeholders Only */}
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <input
              type="email"
              required
              className="glass-input"
              placeholder="Hospital email (e.g. user@clinixos.org)"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                fontSize: '0.94rem',
                padding: '13px 18px',
                background: 'rgba(255, 255, 255, 0.95)',
                border: '1.5px solid rgba(203, 213, 225, 0.8)',
                borderRadius: 14,
                color: '#0f172a'
              }}
            />
          </div>

          <div>
            <input
              type="password"
              required
              className="glass-input"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                fontSize: '0.94rem',
                padding: '13px 18px',
                background: 'rgba(255, 255, 255, 0.95)',
                border: '1.5px solid rgba(203, 213, 225, 0.8)',
                borderRadius: 14,
                color: '#0f172a'
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="glass-btn"
            style={{
              justifyContent: 'center',
              padding: '14px',
              marginTop: 4,
              fontSize: '1rem',
              fontWeight: 800,
              borderRadius: 14,
              background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
              color: '#ffffff',
              boxShadow: '0 6px 20px rgba(2, 132, 199, 0.35)',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            {loading ? 'Authenticating...' : 'Sign in'}
          </button>
        </form>

        {/* Individual Role-Based Quick Test Accounts (SRS Section 3.1) */}
        <div style={{ marginTop: 24, paddingTop: 18, borderTop: '1px solid rgba(203, 213, 225, 0.7)' }}>
          <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 10 }}>
            Individual Hospital Staff &amp; Patient Logins
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
            {[
              { label: '👑 Admin', email: 'admin@clinixos.org', desc: 'Full Enterprise Access' },
              { label: '👨‍⚕️ Doctor', email: 'doctor.cardio@clinixos.org', desc: 'Clinical, Lab, ICU' },
              { label: '🛏️ Nurse', email: 'nurse@clinixos.org', desc: 'Wards & Intake' },
              { label: '🏥 Reception', email: 'receptionist@clinixos.org', desc: 'Registration & Billing' },
              { label: '💊 Pharmacy', email: 'pharmacist@clinixos.org', desc: 'Dispensing & Formulary' },
              { label: '🧑 Patient', email: 'patient.demo@clinixos.org', desc: 'Personal Health Portal' }
            ].map((persona) => (
              <button
                key={persona.email}
                type="button"
                onClick={() => {
                  setEmail(persona.email);
                  setPassword('ClinixOS@2026');
                  setErrorMsg(null);
                }}
                className="glass-btn glass-btn-secondary"
                style={{
                  fontSize: '0.74rem',
                  padding: '7px 4px',
                  justifyContent: 'center',
                  fontWeight: 700,
                  color: email === persona.email ? '#0284c7' : '#0f172a',
                  background: email === persona.email ? 'rgba(2, 132, 199, 0.12)' : 'rgba(255, 255, 255, 0.9)',
                  borderColor: email === persona.email ? '#0284c7' : 'rgba(203, 213, 225, 0.8)',
                  borderRadius: 10
                }}
                title={`${persona.email} • ${persona.desc}`}
              >
                {persona.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
