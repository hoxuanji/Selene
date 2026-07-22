# Selene — Period & Cycle Tracker

A private, on-device menstrual cycle tracking PWA with smart predictions, daily symptom logging, and ovulation detection. All sensitive health data stays in your browser — nothing is sent to a server.

**Live app:** https://selene-tawny.vercel.app

---

## Features

- **Cycle predictions** — weighted average of historical cycles with a confidence score (0–95%), computed entirely on-device
- **Ovulation detection** — inferred from cervical mucus patterns and pain signals
- **Phase labeling** — automatic menstrual / follicular / ovulation / luteal classification
- **Fertile window** — calculated and shown on the calendar
- **Daily logging** — tap-only emoji chips for mood, energy, pain, flow, mucus, sleep, stress, and notes
- **Analytics** — cycle stats, logging streaks, and symptom patterns by phase
- **Health alerts** — flags unusual cycles, skipped cycles, pregnancy/medical warnings (45+ day gaps)
- **Notifications** — opt-in daily check-in reminders and phase-change alerts
- **Data export / import** — JSON backup and CSV export; fully restorable
- **PWA** — installable on iOS and Android, works fully offline via Workbox service worker
- **Dark mode** — persisted theme preference
- **Privacy first** — all data in browser IndexedDB; nothing is sent to any server

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend framework | React 19 + TypeScript 5 |
| Bundler | Vite 7 |
| Routing | React Router DOM 7 |
| State management | Zustand 5 |
| Local database | Dexie 4 (IndexedDB) |
| PWA | vite-plugin-pwa + Workbox 7 |
| Analytics | Vercel Analytics + Speed Insights |
| E2E tests | Playwright |
| Predictions | On-device TypeScript (`utils/predictor.ts`) — no backend |

---

## Project Structure

```
Selene/
├── frontend/
│   ├── src/
│   │   ├── pages/           # Dashboard, DailyLog, Analytics, History, Settings, Onboarding
│   │   ├── components/      # Calendar, PredictionCard, FertileWindow, PhaseInsights, …
│   │   ├── utils/           # predictor, phaseEngine, ovulationSignals, confidenceAdjuster, …
│   │   ├── db.ts            # Dexie schema and queries (periods + daily_logs tables)
│   │   ├── store.ts         # Zustand store
│   │   └── App.tsx          # Router + shell layout
│   ├── e2e/                 # Playwright tests
│   ├── public/              # PWA icons, OG images
│   ├── vite.config.ts
│   └── playwright.config.ts
└── vercel.json              # Vercel static build + SPA rewrite config
```

---

## Local Development

### Prerequisites

- Node 18+

### Frontend

```bash
cd frontend
npm install
npm run dev          # http://localhost:3000
```

Predictions run on-device in the browser — there is no backend to run.

---

## Testing

```bash
cd frontend
npm run test:e2e     # Playwright E2E suite
```

Build and preview before running E2E tests against the production bundle:

```bash
npm run build && npm run preview
```

---

## Environment Variables

None required for local development or Vercel deployment.

---

## Deployment

The app is a fully static PWA deployed on Vercel with a single `vercel.json`:

- **Frontend** — built with `npm run build --prefix frontend`, served from `frontend/dist`
- **Rewrites** — everything → `index.html` (SPA)

To deploy your own instance:

```bash
npm install -g vercel
vercel          # follow prompts; no env vars required
```

---

## Data & Privacy

All period and symptom data is stored in the browser's IndexedDB (`periodDB`). Nothing is transmitted to any server — predictions are computed entirely on-device. You can export a full JSON backup or CSV from the Settings page and import it to restore your data.

---

## License

MIT
