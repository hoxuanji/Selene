import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePeriodStore } from '../store';

const toLocalDateString = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const Onboarding: React.FC = () => {
  const [step, setStep] = useState<'initial' | 'name' | 'profile' | 'dates'>('initial');
  const [dates, setDates] = useState<string[]>(['']);
  const [dateErrors, setDateErrors] = useState<string[]>([]);
  const navigate = useNavigate();
  const addPeriodToStore = usePeriodStore(state => state.addPeriodToStore);
  const profile = usePeriodStore(state => state.profile);
  const setProfile = usePeriodStore(state => state.setProfile);
  const [userName, setUserName] = useState(profile.userName || '');
  const [ageGroup, setAgeGroup] = useState(profile.ageGroup);
  const [pcos, setPcos] = useState(profile.pcos);
  const [thyroid, setThyroid] = useState(profile.thyroid);
  const [birthControl, setBirthControl] = useState(profile.birthControl);
  const trimmedDates = useMemo(
    () => dates.filter(date => date.trim() !== ''),
    [dates]
  );

  // Date bounds: max = today, min = 1 year ago
  const today = useMemo(() => toLocalDateString(new Date()), []);
  const oneYearAgo = useMemo(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    return toLocalDateString(d);
  }, []);

  const handleAddDate = () => {
    setDates([...dates, '']);
  };

  const handleRemoveDate = (idx: number) => {
    setDates(dates.filter((_, i) => i !== idx));
  };

  const validateDate = (value: string): string | null => {
    if (!value) return null;
    if (value > today) return 'Date cannot be in the future';
    if (value < oneYearAgo) return 'Date cannot be more than 1 year ago';
    return null;
  };

  const handleDateChange = (idx: number, value: string) => {
    const newDates = [...dates];
    newDates[idx] = value;
    setDates(newDates);

    const newErrors = [...dateErrors];
    newErrors[idx] = validateDate(value) || '';
    setDateErrors(newErrors);
  };

  const handleSubmit = async () => {
    if (trimmedDates.length === 0) {
      alert('Please enter at least one date');
      return;
    }

    // Validate all dates before submitting
    const errors: string[] = [];
    for (const date of trimmedDates) {
      const err = validateDate(date);
      if (err) errors.push(`${date}: ${err}`);
    }
    if (errors.length > 0) {
      alert(`Please fix the following:\n${errors.join('\n')}`);
      return;
    }

    // Check for duplicate dates
    const uniqueDates = new Set(trimmedDates);
    if (uniqueDates.size !== trimmedDates.length) {
      alert('Please remove duplicate dates.');
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
                Step {step === 'initial' ? '1' : step === 'name' ? '2' : step === 'profile' ? '3' : '4'} of 4
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
                        setStep('profile');
                      }}
                    >
                      Continue
                    </button>
                  </div>
                </div>
              ) : step === 'profile' ? (
                <div>
                  <h2 style={{ marginTop: 0 }}>Tell us a bit about you</h2>
                  <p style={{ color: '#6a6b76' }}>
                    This helps us personalize predictions and alerts. You can always change these in Settings.
                  </p>
                  <div style={{ marginTop: 20, display: 'grid', gap: 16 }}>
                    <label className="form-field">
                      <span className="label-icon">🎂</span> Age group
                      <select className="input" value={ageGroup}
                        onChange={(e) => setAgeGroup(e.target.value as typeof ageGroup)}>
                        <option value="under18">Under 18</option>
                        <option value="18-24">18–24</option>
                        <option value="25-34">25–34</option>
                        <option value="35-44">35–44</option>
                        <option value="45plus">45+</option>
                      </select>
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <label className="form-field">
                        <span className="label-icon">🧬</span> PCOS
                        <select className="input" value={pcos ? 'yes' : 'no'}
                          onChange={(e) => setPcos(e.target.value === 'yes')}>
                          <option value="no">No</option>
                          <option value="yes">Yes</option>
                        </select>
                      </label>
                      <label className="form-field">
                        <span className="label-icon">🧪</span> Thyroid
                        <select className="input" value={thyroid ? 'yes' : 'no'}
                          onChange={(e) => setThyroid(e.target.value === 'yes')}>
                          <option value="no">No</option>
                          <option value="yes">Yes</option>
                        </select>
                      </label>
                    </div>
                    <label className="form-field">
                      <span className="label-icon">💊</span> Birth control
                      <select className="input" value={birthControl ? 'yes' : 'no'}
                        onChange={(e) => setBirthControl(e.target.value === 'yes')}>
                        <option value="no">No</option>
                        <option value="yes">Yes</option>
                      </select>
                    </label>
                  </div>
                  <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
                    <button className="btn btn-ghost" onClick={() => setStep('name')}>
                      Back
                    </button>
                    <button className="btn btn-primary" onClick={() => {
                      setProfile({ ...profile, ageGroup, pcos, thyroid, birthControl });
                      setStep('dates');
                    }}>
                      Continue
                    </button>
                    <button className="btn btn-ghost" onClick={() => {
                      setStep('dates');
                    }} style={{ marginLeft: 'auto', fontSize: 13 }}>
                      Skip for now
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
                      <div key={idx}>
                        <div style={{ display: 'flex', gap: 10 }}>
                          <input
                            type="date"
                            value={date}
                            max={today}
                            min={oneYearAgo}
                            onChange={(e) => handleDateChange(idx, e.target.value)}
                            style={{
                              flex: 1,
                              padding: '10px 12px',
                              borderRadius: 10,
                              border: dateErrors[idx] ? '1px solid #e53935' : '1px solid #ececf3'
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
                        {dateErrors[idx] && (
                          <p style={{ color: '#e53935', fontSize: 13, margin: '4px 0 0 0' }}>
                            {dateErrors[idx]}
                          </p>
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
                    <button className="btn btn-ghost" onClick={() => setStep('profile')}>
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
