import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { timeOffApi } from '../api';
import { format } from 'date-fns';
import { CheckCircle2, XCircle, Trash2 } from 'lucide-react';

export function RequestsPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isManager = user.role === 'manager' || user.role === 'admin';

  const load = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (!isManager) params.employeeId = user.id;
      if (filter) params.status = filter;
      const { data } = await timeOffApi.list(params);
      setRequests(Array.isArray(data) ? data : []);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [filter]);

  const handleApprove = async (id: string) => {
    try { await timeOffApi.approve(id); load(); } catch {}
  };
  const handleReject = async (id: string) => {
    try { await timeOffApi.reject(id); load(); } catch {}
  };
  const handleCancel = async (id: string) => {
    try { await timeOffApi.cancel(id); load(); } catch {}
  };

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">{isManager ? 'All Requests' : 'My Requests'}</h1>
        <p className="page-subtitle">{isManager ? 'Manage team time-off requests' : 'Track your time-off history'}</p>
      </div>
      <div style={{display:'flex',gap:8,marginBottom:24,flexWrap:'wrap'}}>
        {['','PENDING','APPROVED','REJECTED','CANCELLED'].map(s => (
          <button key={s} className={`btn btn-sm ${filter===s?'btn-primary':'btn-secondary'}`} onClick={()=>setFilter(s)}>
            {s||'All'}
          </button>
        ))}
      </div>
      <div className="panel">
        <div className="panel-body">
          {loading ? <div className="loading-overlay"><div className="spinner"/></div> :
           requests.length === 0 ? <div className="empty-state"><div className="empty-state-title">No requests found</div></div> :
          <div className="request-list">
            {requests.map(req => (
              <motion.div key={req.id} className="request-item" whileHover={{scale:1.003}}>
                <span className={`request-type-badge ${req.leaveType}`}>{req.leaveType}</span>
                <div className="request-info">
                  <div className="request-dates">{format(new Date(req.startDate),'MMM d')} — {format(new Date(req.endDate),'MMM d, yyyy')}</div>
                  <div className="request-meta">{req.employee?.name || 'You'} · {req.reason||'No reason'}</div>
                </div>
                <div className="request-days">{Number(req.totalDays).toFixed(1)}<span> days</span></div>
                <span className={`status-badge ${req.status}`}>{req.status}</span>
                <div className="actions-row">
                  {isManager && req.status === 'PENDING' && <>
                    <button className="btn btn-sm btn-success" onClick={()=>handleApprove(req.id)} title="Approve"><CheckCircle2 size={14}/></button>
                    <button className="btn btn-sm btn-danger" onClick={()=>handleReject(req.id)} title="Reject"><XCircle size={14}/></button>
                  </>}
                  {req.status === 'PENDING' && req.employeeId === user.id &&
                    <button className="btn btn-sm btn-secondary" onClick={()=>handleCancel(req.id)} title="Cancel"><Trash2 size={14}/></button>
                  }
                </div>
              </motion.div>
            ))}
          </div>}
        </div>
      </div>
    </>
  );
}
