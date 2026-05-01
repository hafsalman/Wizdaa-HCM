import { ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  CalendarDays,
  TreePalm,
  LogOut,
  Activity,
} from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const navItems = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/requests', label: 'My Requests', icon: CalendarDays },
    { path: '/holidays', label: 'Holidays', icon: TreePalm },
  ];

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.reload();
  };

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">R</div>
          <div className="sidebar-logo-text">
            Ready<span>On</span>
          </div>
        </div>

        <div className="nav-section-label">Navigation</div>

        {navItems.map((item) => (
          <div
            key={item.path}
            className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
            onClick={() => navigate(item.path)}
          >
            <item.icon size={18} />
            {item.label}
          </div>
        ))}

        <div className="nav-section-label">System</div>
        <div className="nav-item" onClick={() => window.open('http://localhost:3000/api/health', '_blank')}>
          <Activity size={18} />
          Health Check
        </div>

        <div className="sidebar-user">
          <div className="sidebar-user-avatar">
            {user.name?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">{user.name || 'User'}</div>
            <div className="sidebar-user-role">{user.role || 'employee'}</div>
          </div>
          <div
            className="modal-close"
            onClick={handleLogout}
            title="Logout"
            style={{ width: 28, height: 28, marginLeft: 'auto' }}
          >
            <LogOut size={14} />
          </div>
        </div>
      </aside>

      <main className="main-content">
        {children}
      </main>
    </div>
  );
}
