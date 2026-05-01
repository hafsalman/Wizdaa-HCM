import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { timeOffApi } from '../api';

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

export function CreateRequestModal({ onClose, onCreated }: Props) {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const [leaveType, setLeaveType] = useState('VACATION');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [startHalf, setStartHalf] = useState(false);
  const [endHalf, setEndHalf] = useState(false);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!startDate || !endDate) { setError('Select both dates'); return; }
    setLoading(true); setError('');
    try {
      const key = crypto.randomUUID();
      await timeOffApi.create({
        employeeId: user.id, locationId: 'PKR-01', leaveType,
        startDate, endDate, startHalf, endHalf, reason: reason || undefined,
      }, key);
      onCreated();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Request failed');
    } finally { setLoading(false); }
  };

  return (
    <AnimatePresence>
      <motion.div className="modal-overlay" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={onClose}>
        <motion.div className="modal" initial={{opacity:0,scale:0.9,y:30}} animate={{opacity:1,scale:1,y:0}} exit={{opacity:0,scale:0.9}} transition={{duration:0.3}} onClick={e=>e.stopPropagation()}>
          <div className="modal-header">
            <h2>New Time-Off Request</h2>
            <button className="modal-close" onClick={onClose}><X size={16}/></button>
          </div>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Leave Type</label>
              <select className="form-select" value={leaveType} onChange={e=>setLeaveType(e.target.value)}>
                <option value="VACATION">Vacation</option>
                <option value="SICK">Sick Leave</option>
                <option value="PERSONAL">Personal</option>
                <option value="UNPAID">Unpaid</option>
              </select>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Start Date</label><input className="form-input" type="date" value={startDate} onChange={e=>setStartDate(e.target.value)}/></div>
              <div className="form-group"><label className="form-label">End Date</label><input className="form-input" type="date" value={endDate} onChange={e=>setEndDate(e.target.value)}/></div>
            </div>
            <div className="form-row" style={{marginBottom:20}}>
              <label className="form-checkbox"><input type="checkbox" checked={startHalf} onChange={e=>setStartHalf(e.target.checked)}/>Half day (start)</label>
              <label className="form-checkbox"><input type="checkbox" checked={endHalf} onChange={e=>setEndHalf(e.target.checked)}/>Half day (end)</label>
            </div>
            <div className="form-group"><label className="form-label">Reason</label><input className="form-input" placeholder="Optional" value={reason} onChange={e=>setReason(e.target.value)}/></div>
            {error && <div style={{padding:'10px 14px',borderRadius:8,background:'rgba(244,63,94,0.1)',border:'1px solid rgba(244,63,94,0.2)',color:'#f43f5e',fontSize:13,marginBottom:8}}>{error}</div>}
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>{loading?<div className="spinner"/>:'Submit Request'}</button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
