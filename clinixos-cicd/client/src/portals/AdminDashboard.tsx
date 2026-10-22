import React, { useState, useEffect } from 'react';
import { HospitalStats, UserRole } from '../types';
import { api } from '../services/api';
import { wsClient } from '../services/websocket';
import { LayoutDashboard, BedDouble, AlertTriangle, FileDown, DollarSign, Calendar, RefreshCw } from 'lucide-react';

interface AdminDashboardProps {
  currentRole: UserRole;
  onNavigateToTab: (tabId: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onNavigateToTab }) => {
  const [stats, setStats] = useState<HospitalStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [period, setPeriod] = useState<'today' | '7days' | 'month'>('today');

  const fetchStats = async () => {
    try {
      const res = await api.getStats(period);
      if (res.success) {
        setStats(res.stats);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();

    // Auto refresh every 60 seconds (FR-06.2)
    const interval = setInterval(fetchStats, 60000);

    // Listen to real-time events
    const unsubBeds = wsClient.subscribe('BED_STATUS_UPDATE', fetchStats);
    const unsubAlerts = wsClient.subscribe('PHARMACY_STOCK_ALERT', fetchStats);

    return () => {
      clearInterval(interval);
      unsubBeds();
      unsubAlerts();
    };
  }, [period]);

  const handleDownloadPdf = (type: 'billing' | 'inventory' | 'occupancy') => {
    const url = api.downloadReportPdfUrl(type);
    window.open(url, '_blank');
  };

  return (
    <div style={{ maxWidth: 1440, margin: '0 auto', padding: '24px' }}>
      {/* Top Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 12 }}>
            <LayoutDashboard size={28} color="#06b6d4" /> Administrative Executive Dashboard
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: 4 }}>
            Unified real-time clinical operations, bed occupancy census, inventory alerts, and automated PDF reporting.
          </p>
        </div>

        {/* Date Filter Controls (FR-06.4) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {(['today', '7days', 'month'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={period === p ? 'glass-btn' : 'glass-btn glass-btn-secondary'}
              style={{ fontSize: '0.8rem', padding: '6px 14px', textTransform: 'capitalize' }}
            >
              {p === 'today' ? 'Today' : p === '7days' ? 'Last 7 Days' : 'Current Month'}
            </button>
          ))}
          <button
            onClick={fetchStats}
            className="glass-btn glass-btn-secondary"
            title="Manual Metric Refresh"
            style={{ padding: '6px 10px' }}
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 18, marginBottom: 24 }}>
        {/* Total Bed Occupancy */}
        <div className="glass-panel" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            <span>Ward Bed Occupancy Rate</span>
            <BedDouble size={18} color="#06b6d4" />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#0f172a', margin: '8px 0' }}>
            {stats ? `${stats.bedOccupancyPercentage}%` : '--'}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
            {stats ? `${stats.occupiedBeds} occupied / ${stats.totalBeds} total beds` : 'Loading...'}
          </div>
          {/* Progress Bar */}
          <div style={{ width: '100%', height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3, marginTop: 10, overflow: 'hidden' }}>
            <div
              style={{
                width: `${stats?.bedOccupancyPercentage || 0}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #06b6d4, #3b82f6)',
                borderRadius: 3
              }}
            />
          </div>
        </div>

        {/* ICU Bed Vacancy Rate (FR-03.4) */}
        <div className="glass-panel" style={{ padding: 20, border: (stats?.icuVacancyRate || 100) < 10 ? '1px solid #f43f5e' : '1px solid var(--border-glass)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            <span>ICU Safety Vacancy Rate</span>
            <AlertTriangle size={18} color={(stats?.icuVacancyRate || 100) < 10 ? '#f43f5e' : '#10b981'} />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: (stats?.icuVacancyRate || 100) < 10 ? '#f43f5e' : '#10b981', margin: '8px 0' }}>
            {stats ? `${stats.icuVacancyRate}%` : '--'}
          </div>
          <div style={{ fontSize: '0.75rem', color: (stats?.icuVacancyRate || 100) < 10 ? '#fda4af' : 'var(--text-dim)' }}>
            {stats ? `${stats.icuVacant} vacant ICU beds out of ${stats.icuTotal}` : 'Loading...'}
          </div>
        </div>

        {/* Scheduled Appointments Today */}
        <div className="glass-panel" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            <span>Outpatient Appointments</span>
            <Calendar size={18} color="#38bdf8" />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#38bdf8', margin: '8px 0' }}>
            {stats ? stats.scheduledAppointmentsToday : '--'}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
            {stats ? `${stats.completedAppointmentsToday} completed sessions` : 'Loading...'}
          </div>
        </div>

        {/* Financial All-Time Revenue (FR-06.3) */}
        {stats?.financialData && (
          <div className="glass-panel" style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              <span>Collected Revenue</span>
              <DollarSign size={18} color="#34d399" />
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: '#34d399', margin: '8px 0' }}>
              ${stats.financialData.allTimeRevenue.toLocaleString()}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
              {stats.financialData.pendingInvoicesCount} invoices pending settlement
            </div>
          </div>
        )}
      </div>

      {/* Middle Section: Department Loads & Automated PDF Reporting Console */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 24, marginBottom: 24 }}>
        {/* Department Loads */}
        <div className="glass-panel" style={{ padding: 24 }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', marginBottom: 16 }}>
            Active Appointments by Clinical Department
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {stats?.departmentLoads?.map((d, idx) => (
              <div key={idx}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, color: '#0f172a' }}>{d.department}</span>
                  <span style={{ color: 'var(--cyan-accent)', fontWeight: 700 }}>{d.appointment_count} booked</span>
                </div>
                <div style={{ width: '100%', height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${Math.min(d.appointment_count * 20, 100)}%`,
                      height: '100%',
                      background: 'linear-gradient(90deg, #06b6d4, #6366f1)',
                      borderRadius: 4
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Automated PDF Report Generation (FR-08.1, FR-08.3) */}
        <div className="glass-panel" style={{ padding: 24 }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>
            Automated Report Generation
          </h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 20 }}>
            Generates standardized, tamper-evident PDF documents with digital security headers and audit timestamps.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <button
              onClick={() => handleDownloadPdf('billing')}
              className="glass-btn"
              style={{ justifyContent: 'space-between', padding: '12px 18px' }}
            >
              <span>Monthly Billing &amp; Invoicing Summary</span>
              <FileDown size={18} />
            </button>

            <button
              onClick={() => handleDownloadPdf('inventory')}
              className="glass-btn glass-btn-secondary"
              style={{ justifyContent: 'space-between', padding: '12px 18px' }}
            >
              <span>Pharmacy Inventory &amp; Critical Stock Audit</span>
              <FileDown size={18} />
            </button>

            <button
              onClick={() => handleDownloadPdf('occupancy')}
              className="glass-btn glass-btn-secondary"
              style={{ justifyContent: 'space-between', padding: '12px 18px' }}
            >
              <span>Ward Bed Census &amp; Real-time Occupancy</span>
              <FileDown size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
