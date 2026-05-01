import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { holidayApi } from '../api';
import { format } from 'date-fns';
import { TreePalm } from 'lucide-react';

export function HolidaysPage() {
  const [holidays, setHolidays] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    holidayApi.getAll(2026).then(({ data }) => {
      setHolidays(Array.isArray(data) ? data : []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Public Holidays</h1>
        <p className="page-subtitle">Pakistan national holidays for 2026</p>
      </div>
      <motion.div className="panel" initial={{opacity:0,y:16}} animate={{opacity:1,y:0}}>
        <div className="panel-header">
          <h3 className="panel-title"><TreePalm size={18} style={{display:'inline',marginRight:8}}/>Holiday Calendar</h3>
          <span style={{fontSize:13,color:'#8b95a8'}}>{holidays.length} holidays</span>
        </div>
        <div className="panel-body">
          {loading ? <div className="loading-overlay"><div className="spinner"/></div> :
          <div className="holiday-list">
            {holidays.map(h => (
              <div key={h.id} className="holiday-item">
                <div className="holiday-name">{h.name}</div>
                <div className="holiday-date">{format(new Date(h.date),'EEE, MMM d yyyy')}</div>
              </div>
            ))}
          </div>}
        </div>
      </motion.div>
    </>
  );
}
