import React, { useCallback, useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

/**
 * When a new service-worker version is available this small toast appears
 * and lets the user reload to get the latest version.
 */
export const ReloadPrompt: React.FC = () => {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, registration) {
      // Check for SW updates every hour
      if (registration) {
        setInterval(() => registration.update(), 60 * 60 * 1000);
      }
    },
    onRegisterError(error) {
      console.error('SW registration error', error);
    },
  });

  const close = useCallback(() => setNeedRefresh(false), [setNeedRefresh]);

  if (!needRefresh) return null;

  return (
    <div className="reload-toast">
      <span>A new version of Selene is available.</span>
      <button
        className="reload-toast-btn"
        onClick={() => updateServiceWorker(true)}
      >
        Update
      </button>
      <button
        className="reload-toast-close"
        onClick={close}
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
};
