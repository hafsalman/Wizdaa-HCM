import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  Database,
  Server,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Wifi,
} from 'lucide-react';
import { healthApi } from '../api';

interface HealthData {
  status: string;
  timestamp: string;
  checks: {
    database: string;
  };
}

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
};

export function HealthPage() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [responseTime, setResponseTime] = useState<number | null>(null);

  const checkHealth = useCallback(async () => {
    setLoading(true);
    setError(null);
    const start = performance.now();
    try {
      const res = await healthApi.check();
      const elapsed = Math.round(performance.now() - start);
      setResponseTime(elapsed);
      setHealth(res.data);
      setLastChecked(new Date());
    } catch (err) {
      setError('Unable to reach the backend API. Is the server running?');
      setHealth(null);
      setResponseTime(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 30000); // auto-refresh every 30s
    return () => clearInterval(interval);
  }, [checkHealth]);

  const isHealthy = health?.status === 'healthy';
  const dbConnected = health?.checks?.database === 'connected';

  const services = [
    {
      name: 'NestJS API Server',
      status: health ? 'operational' : error ? 'down' : 'checking',
      icon: <Server size={20} />,
      detail: health ? `Responded in ${responseTime}ms` : error || 'Checking...',
      color: health ? 'emerald' : error ? 'rose' : 'blue',
    },
    {
      name: 'PostgreSQL Database',
      status: dbConnected ? 'connected' : health ? 'disconnected' : 'unknown',
      icon: <Database size={20} />,
      detail: dbConnected
        ? 'Supabase PostgreSQL — connected via pooler'
        : health
          ? 'Database connection lost'
          : 'Waiting for API...',
      color: dbConnected ? 'emerald' : health ? 'rose' : 'blue',
    },
    {
      name: 'Mock HCM Server',
      status: health ? 'expected' : 'unknown',
      icon: <Wifi size={20} />,
      detail: 'Fastify server on port 3001',
      color: health ? 'emerald' : 'blue',
    },
    {
      name: 'React Frontend',
      status: 'operational',
      icon: <Activity size={20} />,
      detail: 'Vite dev server — you\'re viewing it right now',
      color: 'emerald',
    },
  ];

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">System Health</h1>
        <p className="page-subtitle">
          Real-time status of all ReadyOn services
        </p>
      </div>

      {/* Overall status banner */}
      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="show"
        style={{
          background: loading
            ? 'linear-gradient(135deg, #1e3a5f 0%, #1a2d45 100%)'
            : isHealthy
              ? 'linear-gradient(135deg, #064e3b 0%, #022c22 100%)'
              : 'linear-gradient(135deg, #7f1d1d 0%, #450a0a 100%)',
          borderRadius: 16,
          padding: '32px 36px',
          marginBottom: 28,
          display: 'flex',
          alignItems: 'center',
          gap: 20,
          border: `1px solid ${loading ? '#2563eb33' : isHealthy ? '#10b98133' : '#ef444433'}`,
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            background: loading ? '#2563eb22' : isHealthy ? '#10b98122' : '#ef444422',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: loading ? '#60a5fa' : isHealthy ? '#34d399' : '#f87171',
            flexShrink: 0,
          }}
        >
          {loading ? (
            <RefreshCw size={28} className="spinner" />
          ) : isHealthy ? (
            <CheckCircle2 size={28} />
          ) : (
            <XCircle size={28} />
          )}
        </div>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#f1f5f9', marginBottom: 4 }}>
            {loading ? 'Checking...' : isHealthy ? 'All Systems Operational' : 'System Issues Detected'}
          </div>
          <div style={{ fontSize: 14, color: '#94a3b8' }}>
            {lastChecked
              ? `Last checked: ${lastChecked.toLocaleTimeString()} • Auto-refreshes every 30s`
              : 'Running initial health check...'}
          </div>
        </div>
        <button
          className="btn btn-secondary"
          onClick={checkHealth}
          style={{ marginLeft: 'auto', flexShrink: 0 }}
          disabled={loading}
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </motion.div>

      {/* Service cards */}
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 16,
          marginBottom: 28,
        }}
      >
        {services.map((svc) => (
          <motion.div
            key={svc.name}
            variants={fadeUp}
            className={`stat-card ${svc.color}`}
            style={{ cursor: 'default' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div className="stat-card-icon">{svc.icon}</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#e2e8f0' }}>{svc.name}</div>
            </div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 12px',
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                background:
                  svc.color === 'emerald' ? '#10b98118' :
                  svc.color === 'rose' ? '#ef444418' : '#3b82f618',
                color:
                  svc.color === 'emerald' ? '#34d399' :
                  svc.color === 'rose' ? '#f87171' : '#60a5fa',
                marginBottom: 8,
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background:
                    svc.color === 'emerald' ? '#34d399' :
                    svc.color === 'rose' ? '#f87171' : '#60a5fa',
                  display: 'inline-block',
                }}
              />
              {svc.status}
            </div>
            <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.5 }}>
              {svc.detail}
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Response details panel */}
      {health && (
        <motion.div variants={fadeUp} initial="hidden" animate="show" className="panel">
          <div className="panel-header">
            <h3 className="panel-title">
              <Clock size={16} style={{ marginRight: 8 }} />
              Response Details
            </h3>
          </div>
          <div className="panel-body">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 24, padding: '8px 0' }}>
              <div>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Status
                </div>
                <div style={{ fontSize: 16, fontWeight: 600, color: isHealthy ? '#34d399' : '#f87171' }}>
                  {health.status.toUpperCase()}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Response Time
                </div>
                <div style={{ fontSize: 16, fontWeight: 600, color: '#e2e8f0' }}>
                  {responseTime}ms
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Server Time
                </div>
                <div style={{ fontSize: 16, fontWeight: 600, color: '#e2e8f0' }}>
                  {new Date(health.timestamp).toLocaleTimeString()}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Error panel */}
      {error && !loading && (
        <motion.div variants={fadeUp} initial="hidden" animate="show" className="panel">
          <div className="panel-body" style={{ textAlign: 'center', padding: 40 }}>
            <XCircle size={48} style={{ color: '#f87171', marginBottom: 16 }} />
            <div style={{ fontSize: 18, fontWeight: 600, color: '#f1f5f9', marginBottom: 8 }}>
              Cannot Reach Backend
            </div>
            <div style={{ fontSize: 14, color: '#94a3b8', maxWidth: 400, margin: '0 auto' }}>
              {error}
              <br />
              Make sure <code style={{ color: '#fbbf24' }}>npm run start:dev</code> is running in the{' '}
              <code style={{ color: '#fbbf24' }}>time-off-service</code> directory.
            </div>
          </div>
        </motion.div>
      )}
    </>
  );
}
