# ✅ Feature: Daily Log & Phase Detection (Optional Power Mode)

## Goal

Add an **optional Daily Log** feature to improve:

* Ovulation detection
* Phase labeling
* Prediction confidence

This must NOT disturb the existing passive prediction flow.

---

## 1) Database / Schema

**Create a new table / collection: `daily_logs`**

Fields:

```
id (uuid)
user_id
date (ISO)
mood (enum: very_low, low, neutral, good, great)
energy (enum: low, medium, high)
pain (enum: none, mild, high)
mucus (enum: dry, sticky, creamy, egg_white, null)
sleep_band (enum: lt6, btw6_8, gt8)
stress (enum: low, normal, high)
flow (enum: none, light, medium, heavy)
created_at
```

Rules:

* One entry per user per day
* Upsert if already exists

---

## 2) UI — New Tab: `Daily Log`

Create route/page: `/daily-log`

### Component: `DailyCheckinCard`

Tap-only chips for:

* Mood (5 emoji chips)
* Energy (3 chips)
* Pain (3 chips)
* Mucus (4 chips)
* Sleep (3 chips)
* Stress (3 chips)
* Flow (4 chips, shown only if user marks period)

No typing. Only selections.

Auto-save on selection.

---

## 3) Phase Detection Engine

Create: `utils/phaseEngine.ts`

Function:

```ts
getPhase({
  lastPeriodDate,
  predictedOvulationDate,
  todayLog
}) => 'menstrual' | 'follicular' | 'ovulation' | 'luteal'
```

Logic:

```
if flow != none → menstrual
else if mucus == egg_white → ovulation
else if today < predictedOvulation → follicular
else → luteal
```

---

## 4) Ovulation Confirmation Hook

Create: `utils/ovulationSignals.ts`

Function:

```ts
detectOvulationFromLogs(last7DaysLogs)
```

Rules:

* If mucus == egg_white → ovulationDate = that date
* If pain == mild/high AND near window → ovulationDate candidate

Return:

```
{ ovulationDetected: boolean, ovulationDate }
```

---

## 5) Confidence Adjustment Layer

Create: `utils/confidenceAdjuster.ts`

Input:

* Base confidence
* Recent logs (sleep, stress, mucus)

Rules:

```
if ovulationDetected → confidence = 0.97+

if high_stress OR poor_sleep last 5 days:
    widen prediction window
    reduce confidence slightly

if consistent logs:
    tighten window
    increase confidence
```

---

## 6) Wire Logs into Existing Predictor

Inside your prediction pipeline:

```
basePrediction = predictFromHistory()

phase = getPhase(...)
ovulationSignal = detectOvulationFromLogs(...)

finalPrediction = adjustUsingSignals(basePrediction, ovulationSignal)

confidence = adjustConfidence(...)
```

---

## 7) Calendar Enhancements

Show phase colors on calendar:

* Menstrual → red
* Follicular → blue
* Ovulation → green
* Luteal → purple

Tooltip on date:

> “Likely Ovulation Day (from mucus log)”

---

## 8) Insights Panel (new component)

Create: `PhaseInsights.tsx`

Show:

* Current phase
* “Ovulation expected in X days”
* “Sleep & stress may delay this cycle”
* “Your luteal phase averages 13 days”

---

## 9) Optional Prompts (non-intrusive)

If user hasn’t logged in 3 days:

> “Quick check-in? Takes 10 seconds.”

Do not block usage.

---

## 10) Data Model for Time-Series Learning

Create helper:

`utils/logFeatureExtractor.ts`

Convert logs into features:

```
stress_rolling_avg
sleep_rolling_avg
mucus_peak_day
pain_near_ovulation
```

Feed into ML/prediction logic later.

---

## 11) Keep This Optional

* App must work fully without this
* This only enhances accuracy & insights

---

## 12) Nice-to-have (later)

* Streak counter
* “You usually feel low energy in luteal phase”
* PMS pattern detection

---

### Definition of Done

* User can log daily in <15 seconds
* Phases auto-labeled
* Ovulation detected from mucus
* Confidence visibly improves
* Zero impact on users who ignore this feature
