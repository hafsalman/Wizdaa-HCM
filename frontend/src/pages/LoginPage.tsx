import { useState } from 'react';
import { motion } from 'framer-motion';
import { authApi } from '../api';

export function LoginPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('employee');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!name || !email) {
      setError('Please fill in all fields');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const { data } = await authApi.seedToken(name, email, role);
      localStorage.setItem('token', data.accessToken);
      localStorage.setItem('user', JSON.stringify(data.employee));
      window.location.reload();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Login failed. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
      position: 'relative',
      zIndex: 1,
    }}>
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.175, 0.885, 0.32, 1.275] }}
        style={{ width: '100%', maxWidth: 440 }}
      >
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            width: 56,
            height: 56,
            borderRadius: 14,
            background: 'linear-gradient(135deg, #f59e0b, #fbbf24)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 24,
            fontWeight: 800,
            color: '#0a0e1a',
            marginBottom: 16,
            boxShadow: '0 0 40px rgba(245, 158, 11, 0.2)',
          }}>
            R
          </div>
          <h1 style={{
            fontSize: 32,
            fontWeight: 800,
            letterSpacing: -1,
            marginBottom: 8,
          }}>
            Ready<span style={{ color: '#f59e0b' }}>On</span>
          </h1>
          <p style={{
            color: '#8b95a8',
            fontSize: 14,
          }}>
            Time-Off Management System
          </p>
        </div>

        <div className="panel" style={{ padding: 32 }}>
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input
              className="form-input"
              type="text"
              placeholder="Ahmed Khan"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              className="form-input"
              type="email"
              placeholder="ahmed@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Role</label>
            <select
              className="form-select"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <option value="employee">Employee</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          {error && (
            <div style={{
              padding: '10px 14px',
              borderRadius: 8,
              background: 'rgba(244, 63, 94, 0.1)',
              border: '1px solid rgba(244, 63, 94, 0.2)',
              color: '#f43f5e',
              fontSize: 13,
              marginBottom: 16,
            }}>
              {error}
            </div>
          )}

          <button
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', padding: '14px 20px' }}
            onClick={handleLogin}
            disabled={loading}
          >
            {loading ? <div className="spinner" /> : 'Sign In & Get Started'}
          </button>
        </div>

        <p style={{
          textAlign: 'center',
          fontSize: 12,
          color: '#5a6378',
          marginTop: 20,
        }}>
          Development mode — creates or retrieves an employee account
        </p>
      </motion.div>
    </div>
  );
}
