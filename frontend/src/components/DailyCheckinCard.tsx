import React from 'react';
import type { DailyLog, Energy, Flow, Mood, Mucus, Pain, SleepBand, Stress } from '../db';

interface DailyCheckinCardProps {
  dateLabel: string;
  log: DailyLog | null;
  onSelect: (field: keyof DailyLog, value: DailyLog[keyof DailyLog]) => void;
}

const moodOptions: { value: Mood; label: string }[] = [
  { value: 'very_low', label: '😞' },
  { value: 'low', label: '😕' },
  { value: 'neutral', label: '😐' },
  { value: 'good', label: '🙂' },
  { value: 'great', label: '😄' }
];

const energyOptions: { value: Energy; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' }
];

const painOptions: { value: Pain; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'mild', label: 'Mild' },
  { value: 'high', label: 'High' }
];

const mucusOptions: { value: Exclude<Mucus, null>; label: string }[] = [
  { value: 'dry', label: 'Dry' },
  { value: 'sticky', label: 'Sticky' },
  { value: 'creamy', label: 'Creamy' },
  { value: 'egg_white', label: 'Egg white' }
];

const sleepOptions: { value: SleepBand; label: string }[] = [
  { value: 'lt6', label: '< 6h' },
  { value: 'btw6_8', label: '6–8h' },
  { value: 'gt8', label: '> 8h' }
];

const stressOptions: { value: Stress; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' }
];

const flowOptions: { value: Flow; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'medium', label: 'Medium' },
  { value: 'heavy', label: 'Heavy' },
  { value: 'none', label: 'None' }
];

export const DailyCheckinCard: React.FC<DailyCheckinCardProps> = ({
  dateLabel,
  log,
  onSelect
}) => {
  const periodDay = log?.flow ? log.flow !== 'none' : false;

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
      return;
    }
    onSelect('flow', log?.flow && log.flow !== 'none' ? log.flow : 'light');
  };

  return (
    <div className="card">
      <div className="checkin-header">
        <div>
          <p className="section-title">Daily check-in</p>
          <h2 className="checkin-date">{dateLabel}</h2>
        </div>
        <span className="badge">Auto-saved</span>
      </div>

      <div className="checkin-grid">
        <CheckinGroup
          title="Mood"
          field="mood"
          options={moodOptions}
          value={log?.mood}
          onSelect={(value) => handleToggle('mood', value)}
        />
        <CheckinGroup
          title="Energy"
          field="energy"
          options={energyOptions}
          value={log?.energy}
          onSelect={(value) => handleToggle('energy', value)}
        />
        <CheckinGroup
          title="Pain"
          field="pain"
          options={painOptions}
          value={log?.pain}
          onSelect={(value) => handleToggle('pain', value)}
        />
        <CheckinGroup
          title="Cervical mucus"
          field="mucus"
          options={mucusOptions}
          value={log?.mucus ?? undefined}
          onSelect={(value) => handleToggle('mucus', value)}
        />
        <CheckinGroup
          title="Sleep"
          field="sleepBand"
          options={sleepOptions}
          value={log?.sleepBand}
          onSelect={(value) => handleToggle('sleepBand', value)}
        />
        <CheckinGroup
          title="Stress"
          field="stress"
          options={stressOptions}
          value={log?.stress}
          onSelect={(value) => handleToggle('stress', value)}
        />
      </div>

      <div style={{ marginTop: 20 }}>
        <div className="checkin-group">
          <div className="checkin-group-title">Period today?</div>
          <div className="chip-row">
            <button
              type="button"
              className={`chip ${periodDay ? 'chip-active' : ''}`}
              onClick={() => handlePeriodToggle('yes')}
            >
              Yes
            </button>
            <button
              type="button"
              className={`chip ${!periodDay ? 'chip-active' : ''}`}
              onClick={() => handlePeriodToggle('no')}
            >
              No
            </button>
          </div>
        </div>

        {periodDay && (
          <CheckinGroup
            title="Flow"
            field="flow"
            options={flowOptions}
            value={log?.flow}
            onSelect={(value) => handleToggle('flow', value)}
          />
        )}
      </div>
    </div>
  );
};

interface CheckinGroupProps<TValue> {
  title: string;
  field: keyof DailyLog;
  options: { value: TValue; label: string }[];
  value: TValue | undefined;
  onSelect: (value: TValue) => void;
}

function CheckinGroup<TValue extends string | number>({
  title,
  field,
  options,
  value,
  onSelect
}: CheckinGroupProps<TValue>) {
  return (
    <div className="checkin-group">
      <div className="checkin-group-title">{title}</div>
      <div className="chip-row">
        {options.map((option) => (
          <button
            key={String(option.value)}
            type="button"
            data-field={field}
            data-value={String(option.value)}
            className={`chip ${value === option.value ? 'chip-active' : ''}`}
            onClick={() => onSelect(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
