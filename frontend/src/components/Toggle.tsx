import React from 'react';

/**
 * Accessible toggle switch — a role="switch" button styled with the design
 * tokens. Keyboard-operable (Enter/Space) and announces on/off state via
 * aria-checked. No dependency needed.
 */
interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}

export const Toggle: React.FC<ToggleProps> = ({ checked, onChange, label }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    className={`switch${checked ? ' switch-on' : ''}`}
    onClick={() => onChange(!checked)}
  >
    <span className="switch-thumb" />
  </button>
);
