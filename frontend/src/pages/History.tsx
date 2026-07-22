import React, { useEffect } from 'react';
import { usePeriodStore } from '../store';
import { useConfirm } from '../components/ConfirmDialog';

export const History: React.FC = () => {
  const { periodEntries, loadPeriodsFromDB, removePeriod, error } = usePeriodStore();
  const { confirm, dialog } = useConfirm();

  useEffect(() => {
    loadPeriodsFromDB();
  }, []);

  const handleDelete = async (entryId: number, date: string) => {
    const ok = await confirm({
      title: 'Delete this period entry?',
      description: `This removes the entry on ${formatDate(date)}.`,
      confirmLabel: 'Delete',
      cancelLabel: 'Keep',
      danger: true,
    });
    if (ok) await removePeriod(entryId, date);
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

      {dialog}
    </div>
  );
};
