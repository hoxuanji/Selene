import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePeriodStore } from '../store';

export const Onboarding: React.FC = () => {
  const [step, setStep] = useState<'initial' | 'name' | 'dates'>('initial');
  const [dates, setDates] = useState<string[]>(['']);
  const navigate = useNavigate();
  const addPeriodToStore = usePeriodStore(state => state.addPeriodToStore);
  const profile = usePeriodStore(state => state.profile);
  const setProfile = usePeriodStore(state => state.setProfile);
  const [userName, setUserName] = useState(profile.userName || '');
  const trimmedDates = useMemo(
    () => dates.filter(date => date.trim() !== ''),
    [dates]
  );

  const handleAddDate = () => {
    setDates([...dates, '']);
  };

  const handleRemoveDate = (idx: number) => {
    setDates(dates.filter((_, i) => i !== idx));
  };

  const handleDateChange = (idx: number, value: string) => {
    const newDates = [...dates];
    newDates[idx] = value;
    setDates(newDates);
  };

  const handleSubmit = async () => {
    if (trimmedDates.length === 0) {
      alert('Please enter at least one date');
      return;
    }

    for (const date of trimmedDates) {
      await addPeriodToStore(date);
    }
    navigate('/dashboard');
  };

  return (
    <div className="app-shell">
      <div className="main">
        <div className="page" style={{ maxWidth: 960 }}>
          <div className="grid grid-2">
            <div className="card">
              <div className="badge">Welcome</div>
              <h1 style={{ margin: '16px 0 8px 0' }}>🌙 Selene</h1>
              <p style={{ color: '#6a6b76', marginTop: 0 }}>
                A calm, data-aware space for tracking your cycle and spotting
                patterns.
              </p>

              <div style={{ marginTop: 24 }}>
                <div className="card" style={{ marginBottom: 12 }}>
                  <strong>📅 Smart predictions</strong>
                  <p style={{ margin: '6px 0 0 0', color: '#6a6b76' }}>
                    See an estimated range for your next cycle.
                  </p>
                </div>
                <div className="card" style={{ marginBottom: 12 }}>
                  <strong>📊 Progress over time</strong>
                  <p style={{ margin: '6px 0 0 0', color: '#6a6b76' }}>
                    Build better accuracy with each entry.
                  </p>
                </div>
                <div className="card">
                  <strong>🔒 Private & local</strong>
                  <p style={{ margin: '6px 0 0 0', color: '#6a6b76' }}>
                    Your dates stay in your browser storage.
                  </p>
                </div>
              </div>
            </div>

            <div className="card">
              <p className="section-title">
                Step {step === 'initial' ? '1' : step === 'name' ? '2' : '3'} of 3
              </p>

              {step === 'initial' ? (
                <div>
                  <h2 style={{ marginTop: 0 }}>Let’s set up your timeline</h2>
                  <p style={{ color: '#6a6b76' }}>
                    Add your most recent period start dates so we can start
                    predicting the next one.
                  </p>

                  <div style={{ marginTop: 24 }}>
                    <button
                      className="btn btn-primary"
                      onClick={() => setStep('name')}
                    >
                      Continue
                    </button>
                  </div>
                </div>
              ) : step === 'name' ? (
                <div>
                  <h2 style={{ marginTop: 0 }}>What should we call you?</h2>
                  <p style={{ color: '#6a6b76' }}>
                    We’ll personalize your dashboard and alerts.
                  </p>

                  <div style={{ marginTop: 20 }}>
                    <input
                      className="input"
                      type="text"
                      placeholder="Enter your name"
                      value={userName}
                      onChange={(e) => setUserName(e.target.value)}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
                    <button className="btn btn-ghost" onClick={() => setStep('initial')}>
                      Back
                    </button>
                    <button
                      className="btn btn-primary"
                      onClick={() => {
                        if (!userName.trim()) {
                          alert('Please enter your name');
                          return;
                        }
                        setProfile({ ...profile, userName: userName.trim() });
                        setStep('dates');
                      }}
                    >
                      Continue
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <h2 style={{ marginTop: 0 }}>Add your recent start dates</h2>
                  <p style={{ color: '#6a6b76' }}>
                    Add at least 3 entries for higher confidence.
                  </p>

                  <div style={{ marginTop: 20, display: 'grid', gap: 12 }}>
                    {dates.map((date, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: 10 }}>
                        <input
                          type="date"
                          value={date}
                          onChange={(e) => handleDateChange(idx, e.target.value)}
                          style={{
                            flex: 1,
                            padding: '10px 12px',
                            borderRadius: 10,
                            border: '1px solid #ececf3'
                          }}
                        />
                        {dates.length > 1 && (
                          <button
                            className="btn btn-ghost"
                            onClick={() => handleRemoveDate(idx)}
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  <button
                    className="btn btn-ghost"
                    style={{ marginTop: 16 }}
                    onClick={handleAddDate}
                  >
                    + Add another date
                  </button>

                  <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
                    <button className="btn btn-ghost" onClick={() => setStep('name')}>
                      Back
                    </button>
                    <button className="btn btn-primary" onClick={handleSubmit}>
                      Continue
                    </button>
                  </div>

                  <p style={{ color: '#6a6b76', marginTop: 16 }}>
                    {trimmedDates.length} date(s) ready
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
