import React, { useEffect } from 'react';
import { usePeriodStore } from '../store';

export const History: React.FC = () => {
  const { periodEntries, loadPeriodsFromDB, removePeriod, error } = usePeriodStore();

  useEffect(() => {
    loadPeriodsFromDB();
  }, []);

  const handleDelete = async (entryId: number, date: string) => {
    if (window.confirm(`Delete period on ${date}?`)) {
      await removePeriod(entryId);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">History</h1>
          <div className="badge">{periodEntries.length} saved entries</div>
        </div>
      </div>

      {error && <div className="alert">⚠️ {error}</div>}

      {periodEntries.length === 0 ? (
        <div className="card card-muted empty-state">
          No recorded periods yet
        </div>
      ) : (
        <div className="history-list">
          {periodEntries.map(entry => (
            <div
              key={entry.id}
              className="history-item"
            >
              <span style={{ fontSize: '15px' }}>{formatDate(entry.startDate)}</span>
              <button
                onClick={() => handleDelete(entry.id, entry.startDate)}
                className="btn btn-danger"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
