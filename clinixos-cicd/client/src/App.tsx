import React, { useState, useEffect } from 'react';
import { UserRole } from './types';
import { Header } from './components/Header';
import { LoginScreen } from './portals/LoginScreen';
import { AdminDashboard } from './portals/AdminDashboard';
import { NurseStation } from './portals/NurseStation';
import { DoctorWorkspace } from './portals/DoctorWorkspace';
import { ReceptionDesk } from './portals/ReceptionDesk';
import { PharmacyConsole } from './portals/PharmacyConsole';
import { PatientPortal } from './portals/PatientPortal';
import { LabConsole } from './portals/LabConsole';
import { ICUMonitor } from './portals/ICUMonitor';
import { UserManagement } from './portals/UserManagement';
import { api, getToken, removeToken } from './services/api';
import { wsClient } from './services/websocket';

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<string>('admin');
  const [loadingUser, setLoadingUser] = useState<boolean>(true);
  const [wsOnline, setWsOnline] = useState<boolean>(true);
  const [alertBanner, setAlertBanner] = useState<string | null>(null);

  // Check stored JWT session on initial load
  useEffect(() => {
    checkActiveSession();
  }, []);

  const checkActiveSession = async () => {
    const token = getToken();
    if (!token) {
      setLoadingUser(false);
      return;
    }

    try {
      const res = await api.getMe();
      if (res.success && res.user) {
        handleUserAuthenticated(res.user);
      } else {
        removeToken();
        setCurrentUser(null);
      }
    } catch (err) {
      removeToken();
      setCurrentUser(null);
    } finally {
      setLoadingUser(false);
    }
  };

  const handleUserAuthenticated = (user: any) => {
    setCurrentUser(user);
    const role = user.role as UserRole;
    const defaultTabs: Record<UserRole, string> = {
      Admin: 'admin',
      Doctor: 'doctor',
      Nurse: 'nurse',
      Receptionist: 'reception',
      Pharmacist: 'pharmacy',
      Patient: 'patient'
    };
    setActiveTab(defaultTabs[role] || 'admin');
  };

  const handleSignOut = () => {
    removeToken();
    setCurrentUser(null);
  };

  // Subscribe to critical alerts from WebSocket telemetry
  useEffect(() => {
    const unsubIcu = wsClient.subscribe('ICU_WARNING', (payload) => {
      setAlertBanner(payload.warning || 'CRITICAL: Hospital ICU bed vacancy has dropped below 10% threshold!');
    });

    const unsubPharmacy = wsClient.subscribe('PHARMACY_STOCK_ALERT', (payload) => {
      setAlertBanner(payload.message || 'CRITICAL: Pharmacy items have dropped below safety reorder threshold!');
    });

    return () => {
      unsubIcu();
      unsubPharmacy();
    };
  }, []);

  if (loadingUser) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#070b14', color: '#38bdf8' }}>
        Authenticating with ClinixOS Security Gateway...
      </div>
    );
  }

  // If no user is logged in, show the real Login & Authentication Portal (SRS Section 3.1)
  if (!currentUser) {
    return <LoginScreen onLoginSuccess={handleUserAuthenticated} />;
  }

  const currentRole = currentUser.role as UserRole;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header
        currentUser={currentUser}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onSignOut={handleSignOut}
        wsOnline={wsOnline}
        alertBanner={alertBanner}
      />

      <main style={{ flex: 1, paddingBottom: 40 }}>
        {activeTab === 'admin' && <AdminDashboard currentRole={currentRole} onNavigateToTab={setActiveTab} />}
        {activeTab === 'nurse' && <NurseStation currentRole={currentRole} />}
        {activeTab === 'doctor' && <DoctorWorkspace currentRole={currentRole} />}
        {activeTab === 'reception' && <ReceptionDesk currentRole={currentRole} />}
        {activeTab === 'pharmacy' && <PharmacyConsole currentRole={currentRole} />}
        {activeTab === 'patient' && <PatientPortal currentRole={currentRole} />}
        {activeTab === 'lab' && <LabConsole currentRole={currentRole} />}
        {activeTab === 'icu' && <ICUMonitor currentRole={currentRole} />}
        {activeTab === 'users' && <UserManagement currentRole={currentRole} />}
      </main>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--border-glass)', padding: '16px 24px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.78rem' }}>
        ClinixOS • Intelligent Hospital Operations Platform
      </footer>
    </div>
  );
};

export default App;
