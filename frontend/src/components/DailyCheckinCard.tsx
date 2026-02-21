import React, { useMemo } from 'react';
import type { DailyLog, Energy, Flow, Mood, Mucus, Pain, SleepBand, Stress } from '../db';

interface DailyCheckinCardProps {
  dateLabel: string;
  log: DailyLog | null;
  onSelect: (field: keyof DailyLog, value: DailyLog[keyof DailyLog]) => void;
  isCalendarPeriod?: boolean;
  onPeriodSync?: (active: boolean) => void;
}

const moodOptions: { value: Mood; label: string; emoji: string }[] = [
  { value: 'very_low', label: 'Awful', emoji: '🌧' },
  { value: 'low', label: 'Low', emoji: '🌥' },
  { value: 'neutral', label: 'Okay', emoji: '🌤' },
  { value: 'good', label: 'Good', emoji: '🌸' },
  { value: 'great', label: 'Great', emoji: '☀️' }
];

const energyOptions: { value: Energy; label: string; emoji: string }[] = [
  { value: 'low', label: 'Low', emoji: '🍂' },
  { value: 'medium', label: 'Medium', emoji: '🌿' },
  { value: 'high', label: 'High', emoji: '🌻' }
];

const painOptions: { value: Pain; label: string; emoji: string }[] = [
  { value: 'none', label: 'None', emoji: '✨' },
  { value: 'mild', label: 'Mild', emoji: '🌡️' },
  { value: 'high', label: 'Severe', emoji: '💫' }
];

const mucusOptions: { value: Exclude<Mucus, null>; label: string; emoji: string }[] = [
  { value: 'dry', label: 'Dry', emoji: '�' },
  { value: 'sticky', label: 'Sticky', emoji: '🫧' },
  { value: 'creamy', label: 'Creamy', emoji: '☁️' },
  { value: 'egg_white', label: 'Egg white', emoji: '💧' }
];

const sleepOptions: { value: SleepBand; label: string; emoji: string }[] = [
  { value: 'lt6', label: '< 6h', emoji: '🌙' },
  { value: 'btw6_8', label: '6–8h', emoji: '✨' },
  { value: 'gt8', label: '> 8h', emoji: '💤' }
];

const stressOptions: { value: Stress; label: string; emoji: string }[] = [
  { value: 'low', label: 'Calm', emoji: '🍃' },
  { value: 'normal', label: 'Normal', emoji: '🌿' },
  { value: 'high', label: 'High', emoji: '🌊' }
];

const flowOptions: { value: Flow; label: string; emoji: string }[] = [
  { value: 'light', label: 'Light', emoji: '🩷' },
  { value: 'medium', label: 'Medium', emoji: '🌺' },
  { value: 'heavy', label: 'Heavy', emoji: '🌹' },
  { value: 'none', label: 'None', emoji: '·' }
];


export const DailyCheckinCard: React.FC<DailyCheckinCardProps> = ({
  dateLabel,
  log,
  onSelect,
  isCalendarPeriod = false,
  onPeriodSync
}) => {
  const periodDay = log?.flow ? log.flow !== 'none' : false;
  const isBleeding = periodDay || isCalendarPeriod;

  const trackableFields = useMemo(() => {
    const base: (keyof DailyLog)[] = ['mood', 'energy', 'pain', 'sleepBand', 'stress'];
    if (!isBleeding) base.push('mucus');
    return base;
  }, [isBleeding]);

  const filledCount = useMemo(() => {
    if (!log) return 0;
    return trackableFields.filter(f => log[f] !== undefined && log[f] !== null).length;
  }, [log, trackableFields]);

  const completionPct = Math.round((filledCount / trackableFields.length) * 100);

  const handleToggle = (field: keyof DailyLog, value: DailyLog[keyof DailyLog]) => {
    const current = log?.[field];
    if (current === value) {
      onSelect(field, undefined);
      return;
    }
    onSelect(field, value);
  };

  const handlePeriodToggle = (value: 'yes' | 'no') => {
    if (value === 'no') {
      onSelect('flow', 'none');
      onPeriodSync?.(false);
      return;
    }
    onSelect('flow', log?.flow && log.flow !== 'none' ? log.flow : 'light');
    onPeriodSync?.(true);
  };

  return (
    <div className="daily-log-card">
      {/* Header with completion ring */}
      <div className="log-header">
        <div className="log-header-left">
          <p className="section-title">Daily check-in</p>
          <h2 className="checkin-date">{dateLabel}</h2>
        </div>
        <div className="log-completion">
          <svg className="log-ring" viewBox="0 0 48 48">
            <circle className="log-ring-bg" cx="24" cy="24" r="20" />
            <circle
              className="log-ring-fill"
              cx="24" cy="24" r="20"
              strokeDasharray={`${completionPct * 1.257} 125.7`}
            />
          </svg>
          <span className="log-ring-text">{filledCount}/{trackableFields.length}</span>
        </div>
      </div>

      {/* Completion bar */}
      <div className="log-progress-track">
        <div className="log-progress-fill" style={{ width: `${completionPct}%` }} />
      </div>
      <p className="log-progress-label">
        {completionPct === 100
          ? '✨ All logged — beautifully done.'
          : completionPct > 50
          ? '🌿 Almost there — keep going.'
          : '🌸 Tap to log how you feel today'}
      </p>

      {/* Categories */}
      <div className="log-categories">
        <LogCategory
          icon="🦋" title="Mood"
          field="mood"
          options={moodOptions}
          value={log?.mood}
          onSelect={(value) => handleToggle('mood', value)}
        />
        <LogCategory
          icon="🌱" title="Energy"
          field="energy"
          options={energyOptions}
          value={log?.energy}
          onSelect={(value) => handleToggle('energy', value)}
        />
        <LogCategory
          icon="�" title="Pain"
          field="pain"
          options={painOptions}
          value={log?.pain}
          onSelect={(value) => handleToggle('pain', value)}
        />
        {!isBleeding ? (
          <LogCategory
            icon="💧" title="Cervical mucus"
            field="mucus"
            options={mucusOptions}
            value={log?.mucus ?? undefined}
            onSelect={(value) => handleToggle('mucus', value)}
          />
        ) : (
          <div className="log-category log-category-muted">
            <div className="log-section-header">
              <span className="log-section-icon">💧</span>
              <span className="log-section-title">Cervical mucus</span>
            </div>
            <p className="log-muted-note">
              Paused during your period — mucus tracking resumes after bleeding ends.
            </p>
          </div>
        )}
        <LogCategory
          icon="🌙" title="Sleep"
          field="sleepBand"
          options={sleepOptions}
          value={log?.sleepBand}
          onSelect={(value) => handleToggle('sleepBand', value)}
        />
        <LogCategory
          icon="🍃" title="Stress"
          field="stress"
          options={stressOptions}
          value={log?.stress}
          onSelect={(value) => handleToggle('stress', value)}
        />
      </div>

      {/* Period */}
      <div className="log-section">
        <div className="log-section-header">
          <span className="log-section-icon">🌺</span>
          <span className="log-section-title">Period today?</span>
        </div>

        {isCalendarPeriod && !periodDay && (
          <div className="log-sync-hint">
            <span>🔄</span>
            <span>Your calendar shows today as a period day.</span>
          </div>
        )}

        <div className="chip-row">
          <button
            type="button"
            className={`log-chip ${isBleeding ? 'log-chip-active' : ''}`}
            onClick={() => handlePeriodToggle('yes')}
          >
            <span className="log-chip-emoji" aria-hidden="true">✓</span>
            <span>Yes</span>
          </button>
          <button
            type="button"
            className={`log-chip ${!isBleeding ? 'log-chip-active' : ''}`}
            onClick={() => handlePeriodToggle('no')}
          >
            <span className="log-chip-emoji" aria-hidden="true">✗</span>
            <span>No</span>
          </button>
        </div>

        {isBleeding && (
          <div style={{ marginTop: 12 }}>
            <LogCategory
              icon="🌺" title="Flow"
              field="flow"
              options={flowOptions}
              value={log?.flow}
              onSelect={(value) => handleToggle('flow', value)}
            />
          </div>
        )}
      </div>

      {/* Notes */}
      <div className="log-section">
        <div className="log-section-header">
          <span className="log-section-icon">🍃</span>
          <span className="log-section-title">Notes</span>
        </div>
        <textarea
          className="input notes-textarea"
          placeholder="Anything to note today? Medication, symptoms, thoughts..."
          value={log?.notes || ''}
          onChange={(e) => onSelect('notes', e.target.value)}
          rows={3}
        />
      </div>

      <div className="log-autosave">
        <span className="log-autosave-dot" />
        Auto-saved
      </div>
    </div>
  );
};

interface LogCategoryProps<TValue> {
  icon: string;
  title: string;
  field: keyof DailyLog;
  options: { value: TValue; label: string; emoji: string }[];
  value: TValue | undefined;
  onSelect: (value: TValue) => void;
}

function LogCategory<TValue extends string | number>({
  icon,
  title,
  field,
  options,
  value,
  onSelect
}: LogCategoryProps<TValue>) {
  return (
    <div className="log-category">
      <div className="log-section-header">
        <span className="log-section-icon">{icon}</span>
        <span className="log-section-title">{title}</span>
        {value !== undefined && <span className="log-check">✓</span>}
      </div>
      <div className="chip-row">
        {options.map((option) => (
          <button
            key={String(option.value)}
            type="button"
            data-field={field}
            data-value={String(option.value)}
            className={`log-chip ${value === option.value ? 'log-chip-active' : ''}`}
            onClick={() => onSelect(option.value)}
          >
            <span className="log-chip-emoji" aria-hidden="true">{option.emoji}</span>
            <span>{option.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
