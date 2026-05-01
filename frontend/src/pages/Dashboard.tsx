import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  CalendarDays,
  TreePalm,
  Clock,
  CheckCircle2,
  XCircle,
  Plus,
  RefreshCw,
  Briefcase,
} from 'lucide-react';
import { timeOffApi, balanceApi } from '../api';
import { CreateRequestModal } from '../components/CreateRequestModal';
import { format } from 'date-fns';

interface Balance {
  id: string;
  leaveType: string;
  totalDays: number;
  usedDays: number;
  pendingDays: number;
}

interface TimeOffRequest {
  id: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  status: string;
  hcmStatus: string;
  reason?: string;
  createdAt: string;
}

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

export function Dashboard() {
  const [balances, setBalances] = useState<Balance[]>([]);
  const [requests, setRequests] = useState<TimeOffRequest[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);

  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [balRes, reqRes] = await Promise.all([
        balanceApi.get(user.id, 'PKR-01').catch(() => ({ data: [] })),
        timeOffApi.list({ employeeId: user.id }).catch(() => ({ data: [] })),
      ]);
      setBalances(Array.isArray(balRes.data) ? balRes.data : []);
      setRequests(Array.isArray(reqRes.data) ? reqRes.data : []);
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, [user.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const vacationBal = balances.find(b => b.leaveType === 'VACATION');
  const sickBal = balances.find(b => b.leaveType === 'SICK');
  const personalBal = balances.find(b => b.leaveType === 'PERSONAL');

  const available = (b?: Balance) => b ? Number(b.totalDays) - Number(b.usedDays) - Number(b.pendingDays) : 0;
  const pendingCount = requests.filter(r => r.status === 'PENDING').length;
  const approvedCount = requests.filter(r => r.status === 'APPROVED').length;

  const statCards = [
    {
      label: 'Vacation Available',
      value: available(vacationBal).toFixed(1),
      unit: 'days',
      color: 'amber',
      icon: <TreePalm size={22} />,
    },
    {
      label: 'Sick Leave Available',
      value: available(sickBal).toFixed(1),
      unit: 'days',
      color: 'rose',
      icon: <Briefcase size={22} />,
    },
    {
      label: 'Pending Requests',
      value: String(pendingCount),
      unit: '',
      color: 'blue',
      icon: <Clock size={22} />,
    },
    {
      label: 'Approved This Year',
      value: String(approvedCount),
      unit: '',
      color: 'emerald',
      icon: <CheckCircle2 size={22} />,
    },
  ];

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">
          Welcome back, {user.name || 'User'}. Here's your time-off overview.
        </p>
      </div>

      <motion.div
        className="stats-grid"
        variants={stagger}
        initial="hidden"
        animate="show"
      >
        {statCards.map((card) => (
          <motion.div key={card.label} variants={fadeUp} className={`stat-card ${card.color}`}>
            <div className="stat-card-icon">{card.icon}</div>
            <div className="stat-card-label">{card.label}</div>
            <div className="stat-card-value">
              {card.value}
              {card.unit && <span className="stat-card-unit">{card.unit}</span>}
            </div>
          </motion.div>
        ))}
      </motion.div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          <Plus size={16} /> New Request
        </button>
        <button className="btn btn-secondary" onClick={loadData}>
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      <motion.div variants={fadeUp} initial="hidden" animate="show" className="panel">
        <div className="panel-header">
          <h3 className="panel-title">Recent Requests</h3>
          <span style={{ fontSize: 13, color: '#8b95a8' }}>
            {requests.length} total
          </span>
        </div>
        <div className="panel-body">
          {loading ? (
            <div className="loading-overlay"><div className="spinner" /></div>
          ) : requests.length === 0 ? (
            <div className="empty-state">
              <CalendarDays size={48} className="empty-state-icon" />
              <div className="empty-state-title">No requests yet</div>
              <div className="empty-state-desc">
                Create your first time-off request to get started
              </div>
            </div>
          ) : (
            <div className="request-list">
              {requests.slice(0, 10).map((req) => (
                <motion.div
                  key={req.id}
                  className="request-item"
                  whileHover={{ scale: 1.005 }}
                  transition={{ duration: 0.15 }}
                >
                  <span className={`request-type-badge ${req.leaveType}`}>
                    {req.leaveType}
                  </span>
                  <div className="request-info">
                    <div className="request-dates">
                      {format(new Date(req.startDate), 'MMM d')} — {format(new Date(req.endDate), 'MMM d, yyyy')}
                    </div>
                    <div className="request-meta">
                      {req.reason || 'No reason provided'}
                    </div>
                  </div>
                  <div className="request-days">
                    {Number(req.totalDays).toFixed(1)}
                    <span> days</span>
                  </div>
                  <span className={`status-badge ${req.status}`}>
                    {req.status}
                  </span>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </motion.div>

      {showCreate && (
        <CreateRequestModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); loadData(); }}
        />
      )}
    </>
  );
}
