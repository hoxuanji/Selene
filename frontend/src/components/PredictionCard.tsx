import React from 'react';
import { PredictionRange } from '../store';

interface PredictionCardProps {
  predictedRange: PredictionRange | null;
  loading: boolean;
}

export const PredictionCard: React.FC<PredictionCardProps> = ({ predictedRange, loading }) => {
  if (loading) {
    return (
      <div className="card">
        <p className="section-title">Next prediction</p>
        <p>Loading prediction...</p>
      </div>
    );
  }

  if (!predictedRange) {
    return (
      <div className="card card-muted">
        <p className="section-title">Next prediction</p>
        <h3 style={{ margin: 0 }}>Add more dates</h3>
        <p style={{ color: 'var(--muted)', marginTop: '10px' }}>
          Add more data to improve prediction
        </p>
      </div>
    );
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const formatDateShort = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const confidence = Math.round(predictedRange.confidence * 100);
  const baseConfidence =
    typeof predictedRange.baseConfidence === 'number'
      ? Math.round(predictedRange.baseConfidence * 100)
      : null;

  return (
    <div className="card">
      <p className="section-title">Next prediction</p>
      <div style={{ marginTop: '12px' }}>
        <p style={{ fontSize: '20px', marginBottom: '4px', textAlign: 'center' }}>
          <strong>
            <span style={{ color: 'var(--primary)' }}>
              {formatDate(predictedRange.predictedDate)}
            </span>
          </strong>
        </p>
        <p style={{ fontSize: '12px', color: 'var(--muted)', textAlign: 'center', margin: '4px 0 12px' }}>
          ±1 day ({formatDateShort(predictedRange.earliest)} – {formatDateShort(predictedRange.latest)})
        </p>
        <div style={{ marginTop: '10px' }}>
          <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '6px' }}>
            Confidence: <strong>{confidence}%</strong>
            {baseConfidence !== null && baseConfidence !== confidence && (
              <span style={{ marginLeft: 8, color: 'var(--muted)' }}>
                (Base {baseConfidence}%)
              </span>
            )}
          </div>
          <div style={confidenceBarStyle}>
            <div
              style={{
                width: `${confidence}%`,
                height: '100%',
                backgroundColor: 'var(--primary)',
                transition: 'width 0.3s ease'
              }}
            ></div>
          </div>
          {predictedRange.adjustmentNote && (
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--muted)' }}>
              {predictedRange.adjustmentNote}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const confidenceBarStyle: React.CSSProperties = {
  width: '100%',
  height: '8px',
  backgroundColor: 'var(--border)',
  borderRadius: '4px',
  overflow: 'hidden'
};
