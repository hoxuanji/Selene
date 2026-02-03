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
        <p style={{ color: '#6a6b76', marginTop: '10px' }}>
          Add more data to improve prediction
        </p>
      </div>
    );
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const confidence = Math.round(predictedRange.confidence * 100);

  return (
    <div className="card">
      <p className="section-title">Next prediction</p>
      <div style={{ marginTop: '12px' }}>
        <p style={{ fontSize: '16px', marginBottom: '10px' }}>
          <strong>
            Likely between{' '}
            <span style={{ color: '#e91e63' }}>
              {formatDate(predictedRange.earliest)}
            </span>
            {' '}and{' '}
            <span style={{ color: '#e91e63' }}>
              {formatDate(predictedRange.latest)}
            </span>
          </strong>
        </p>
        <div style={{ marginTop: '10px' }}>
          <div style={{ fontSize: '12px', color: '#6a6b76', marginBottom: '6px' }}>
            Confidence: <strong>{confidence}%</strong>
          </div>
          <div style={confidenceBarStyle}>
            <div
              style={{
                width: `${confidence}%`,
                height: '100%',
                backgroundColor: '#e91e63',
                transition: 'width 0.3s ease'
              }}
            ></div>
          </div>
        </div>
      </div>
    </div>
  );
};

const confidenceBarStyle: React.CSSProperties = {
  width: '100%',
  height: '8px',
  backgroundColor: '#e0e0e0',
  borderRadius: '4px',
  overflow: 'hidden'
};
