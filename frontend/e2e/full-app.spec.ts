import { test, expect, type Page } from '@playwright/test';

/* ────────── helpers ────────── */

const toLocalDateString = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toLocalDateString(d);
};

const daysFromNow = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return toLocalDateString(d);
};

const today = () => toLocalDateString(new Date());

/** Dates that create ~30 day cycle gaps, all within the last year */
const realisticDates = {
  d1: daysAgo(90), // 3 cycles ago
  d2: daysAgo(60), // 2 cycles ago
  d3: daysAgo(30), // 1 cycle ago
};

/* ────────── setup ────────── */

test.beforeEach(async ({ page }) => {
  // Mock the prediction API so tests don't depend on backend
  await page.route('**/predict', async (route) => {
    const body = route.request().postDataJSON();
    const dates: string[] = body?.dates ?? [];
    const sorted = [...dates].sort();
    const last = sorted[sorted.length - 1];
    const predicted = new Date(last);
    predicted.setDate(predicted.getDate() + 30);
    const earliest = new Date(predicted);
    earliest.setDate(earliest.getDate() - 1);
    const latest = new Date(predicted);
    latest.setDate(latest.getDate() + 1);

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        predicted_date: toLocalDateString(predicted),
        earliest: toLocalDateString(earliest),
        latest: toLocalDateString(latest),
        confidence: 0.8,
      }),
    });
  });

  // Clear all storage so every test starts fresh
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    indexedDB.deleteDatabase('periodDB');
  });
  await page.reload();
});

/* ────────── reusable flows ────────── */

const completeOnboardingWithDates = async (
  page: Page,
  dates?: [string, string, string]
) => {
  const [d1, d2, d3] = dates ?? [realisticDates.d1, realisticDates.d2, realisticDates.d3];

  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByPlaceholder('Enter your name').fill('Test User');
  await page.getByRole('button', { name: 'Continue' }).click();

  const dateInputs = page.locator('input[type="date"]');
  await dateInputs.nth(0).fill(d1);
  await page.getByRole('button', { name: '+ Add another date' }).click();
  await dateInputs.nth(1).fill(d2);
  await page.getByRole('button', { name: '+ Add another date' }).click();
  await dateInputs.nth(2).fill(d3);

  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(/\/dashboard/);
};

/* ══════════════════════════════════════════════════════
   1. ONBOARDING – HAPPY PATH
   ══════════════════════════════════════════════════════ */

test.describe('Onboarding – happy path', () => {
  test('full flow: welcome → name → 3 dates → dashboard', async ({ page }) => {
    await expect(page.getByText('Selene')).toBeVisible();
    await expect(page.getByText('Step 1 of 3')).toBeVisible();

    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByText('Step 2 of 3')).toBeVisible();

    await page.getByPlaceholder('Enter your name').fill('Alice');
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByText('Step 3 of 3')).toBeVisible();

    const dateInputs = page.locator('input[type="date"]');
    await dateInputs.nth(0).fill(daysAgo(90));
    await page.getByRole('button', { name: '+ Add another date' }).click();
    await dateInputs.nth(1).fill(daysAgo(60));
    await page.getByRole('button', { name: '+ Add another date' }).click();
    await dateInputs.nth(2).fill(daysAgo(30));

    await expect(page.getByText('3 date(s) ready')).toBeVisible();
    await page.getByRole('button', { name: 'Continue' }).click();

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByText('Tracking 3 entries')).toBeVisible();
  });

  test('back buttons navigate between steps', async ({ page }) => {
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByText('Step 2 of 3')).toBeVisible();
    await page.getByRole('button', { name: 'Back' }).click();
    await expect(page.getByText('Step 1 of 3')).toBeVisible();

    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByPlaceholder('Enter your name').fill('Bob');
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByText('Step 3 of 3')).toBeVisible();
    await page.getByRole('button', { name: 'Back' }).click();
    await expect(page.getByText('Step 2 of 3')).toBeVisible();
  });
});

/* ══════════════════════════════════════════════════════
   2. ONBOARDING – VALIDATION GUARDRAILS
   ══════════════════════════════════════════════════════ */

test.describe('Onboarding – validation guardrails', () => {
  test('empty name is rejected', async ({ page }) => {
    page.on('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'Continue' }).click();
    // Clear the name field (default profile name is 'Friend')
    await page.getByPlaceholder('Enter your name').fill('');
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByText('Step 2 of 3')).toBeVisible();
  });

  test('no dates → alert, stays on step 3', async ({ page }) => {
    page.on('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByPlaceholder('Enter your name').fill('X');
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByText('Step 3 of 3')).toBeVisible();
  });

  test('date inputs carry max=today and min=1-year-ago', async ({ page }) => {
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByPlaceholder('Enter your name').fill('X');
    await page.getByRole('button', { name: 'Continue' }).click();

    const dateInput = page.locator('input[type="date"]').first();
    expect(await dateInput.getAttribute('max')).toBe(today());

    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    expect(await dateInput.getAttribute('min')).toBe(toLocalDateString(oneYearAgo));
  });

  test('future date shows inline error', async ({ page }) => {
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByPlaceholder('Enter your name').fill('X');
    await page.getByRole('button', { name: 'Continue' }).click();

    await page.locator('input[type="date"]').first().fill(daysFromNow(30));
    await expect(page.getByText('Date cannot be in the future')).toBeVisible();
  });

  test('date >1 year ago shows inline error', async ({ page }) => {
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByPlaceholder('Enter your name').fill('X');
    await page.getByRole('button', { name: 'Continue' }).click();

    await page.locator('input[type="date"]').first().fill('2020-01-01');
    await expect(page.getByText('Date cannot be more than 1 year ago')).toBeVisible();
  });

  test('future date blocks submission', async ({ page }) => {
    let alertMsg = '';
    page.on('dialog', async (d) => { alertMsg = d.message(); await d.accept(); });

    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByPlaceholder('Enter your name').fill('X');
    await page.getByRole('button', { name: 'Continue' }).click();

    await page.locator('input[type="date"]').first().fill(daysFromNow(10));
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByText('Step 3 of 3')).toBeVisible();
    expect(alertMsg.toLowerCase()).toContain('future');
  });

  test('duplicate dates are blocked', async ({ page }) => {
    let alertMsg = '';
    page.on('dialog', async (d) => { alertMsg = d.message(); await d.accept(); });

    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByPlaceholder('Enter your name').fill('X');
    await page.getByRole('button', { name: 'Continue' }).click();

    const sameDate = daysAgo(20);
    await page.locator('input[type="date"]').nth(0).fill(sameDate);
    await page.getByRole('button', { name: '+ Add another date' }).click();
    await page.locator('input[type="date"]').nth(1).fill(sameDate);
    await page.getByRole('button', { name: 'Continue' }).click();

    await expect(page.getByText('Step 3 of 3')).toBeVisible();
    expect(alertMsg.toLowerCase()).toContain('duplicate');
  });

  test('remove date button works', async ({ page }) => {
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByPlaceholder('Enter your name').fill('X');
    await page.getByRole('button', { name: 'Continue' }).click();

    await page.getByRole('button', { name: '+ Add another date' }).click();
    await expect(page.locator('input[type="date"]')).toHaveCount(2);
    await page.getByRole('button', { name: 'Remove' }).first().click();
    await expect(page.locator('input[type="date"]')).toHaveCount(1);
  });
});

/* ══════════════════════════════════════════════════════
   3. DASHBOARD – CORE ELEMENTS
   ══════════════════════════════════════════════════════ */

test.describe('Dashboard – core elements', () => {
  test('all main sections are visible', async ({ page }) => {
    await completeOnboardingWithDates(page);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByText('Cycle day')).toBeVisible();
    await expect(page.getByText('Next prediction')).toBeVisible();
    await expect(page.getByText('Fertile window')).toBeVisible();
    await expect(page.getByText('Phase insights')).toBeVisible();
    await expect(page.getByText('Personalization')).toBeVisible();
  });

  test('"Add today\'s start" creates an entry', async ({ page }) => {
    await completeOnboardingWithDates(page);
    await page.locator('button.btn-primary', { hasText: /Add today/ }).click();
    await expect(page.getByText('Tracking 4 entries')).toBeVisible();
  });

  test('personalization shows onboarding name', async ({ page }) => {
    await completeOnboardingWithDates(page);
    await expect(page.getByText('Hi, Test User')).toBeVisible();
  });

  test('check-in prompt appears when no daily logs', async ({ page }) => {
    await completeOnboardingWithDates(page);
    await expect(page.getByText('Quick check-in?')).toBeVisible();
  });

  test('"Log now" navigates to daily log page', async ({ page }) => {
    await completeOnboardingWithDates(page);
    await page.getByRole('link', { name: 'Log now' }).click();
    await expect(page).toHaveURL(/\/daily-log/);
  });
});

/* ══════════════════════════════════════════════════════
   4. CYCLE DAY COUNTER – GUARDRAILS
   ══════════════════════════════════════════════════════ */

test.describe('Cycle day counter', () => {
  test('shows realistic cycle day (≥1)', async ({ page }) => {
    await completeOnboardingWithDates(page);
    const text = await page.locator('.cycle-day-number').textContent();
    const day = parseInt(text!.match(/Day (\d+)/)![1]);
    expect(day).toBeGreaterThanOrEqual(1);
  });

  test('shows "Day X of ~Y" format', async ({ page }) => {
    await completeOnboardingWithDates(page);
    await expect(page.locator('.cycle-day-number')).toContainText(/Day \d+/);
    await expect(page.locator('.cycle-day-total')).toContainText(/of ~\d+/);
  });

  test('overdue cycle shows amber notice', async ({ page }) => {
    await completeOnboardingWithDates(page, [daysAgo(95), daysAgo(65), daysAgo(35)]);
    await expect(page.getByText(/past your usual/)).toBeVisible();
  });

  test('very overdue cycle (>45 days) shows skipped cycle warning', async ({ page }) => {
    await completeOnboardingWithDates(page, [daysAgo(110), daysAgo(80), daysAgo(50)]);
    // >45 days since last period = possible skipped cycle (pregnancy/medical)
    await expect(page.getByText(/Possible skipped cycle detected/)).toBeVisible();
    await expect(page.getByText(/pregnancy/i).first()).toBeVisible();
    // Day should display actual value (no longer capped)
    const text = await page.locator('.cycle-day-number').textContent();
    const day = parseInt(text!.match(/Day (\d+)/)![1]);
    expect(day).toBeGreaterThan(45);
  });

  test('progress bar does not exceed 100%', async ({ page }) => {
    await completeOnboardingWithDates(page);
    const width = await page.locator('.cycle-progress-fill').evaluate(
      (el) => (el as HTMLElement).style.width
    );
    expect(parseInt(width)).toBeLessThanOrEqual(100);
  });
});

/* ══════════════════════════════════════════════════════
   5. CALENDAR
   ══════════════════════════════════════════════════════ */

test.describe('Calendar', () => {
  test('click today adds period entry', async ({ page }) => {
    await page.goto('/dashboard');
    const btn = page.getByLabel(`calendar-day-${today()}`);
    await btn.click();
    await expect(btn).toHaveClass(/period/);
  });

  test('click period date again removes it', async ({ page }) => {
    page.on('dialog', (d) => d.accept());
    await page.goto('/dashboard');
    const btn = page.getByLabel(`calendar-day-${today()}`);
    await btn.click();
    await expect(btn).toHaveClass(/period/);
    await btn.click();
    await expect(btn).not.toHaveClass(/period/);
  });

  test('future dates in current month are disabled', async ({ page }) => {
    await page.goto('/dashboard');
    const tmrw = daysFromNow(1);
    const btn = page.getByLabel(`calendar-day-${tmrw}`);
    if ((await btn.count()) > 0) {
      await expect(btn).toBeDisabled();
      await expect(btn).toHaveClass(/disabled/);
    }
  });

  test('future dates tooltip says "Cannot add entries for future dates"', async ({ page }) => {
    await page.goto('/dashboard');
    const future = daysFromNow(5);
    const btn = page.getByLabel(`calendar-day-${future}`);
    if ((await btn.count()) > 0) {
      expect(await btn.getAttribute('title')).toContain('Cannot add entries for future dates');
    }
  });

  test('month navigation prev/next', async ({ page }) => {
    await page.goto('/dashboard');
    const now = new Date();
    const curMonth = now.toLocaleString('default', { month: 'long', year: 'numeric' });
    await expect(page.getByText(curMonth)).toBeVisible();

    await page.getByRole('button', { name: '← Previous' }).first().click();
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    await expect(page.getByText(prev.toLocaleString('default', { month: 'long', year: 'numeric' }))).toBeVisible();

    await page.getByRole('button', { name: 'Next →' }).first().click();
    await expect(page.getByText(curMonth)).toBeVisible();
  });

  test('phase coloring appears on calendar after onboarding', async ({ page }) => {
    await completeOnboardingWithDates(page);
    // A few days after last period should be menstrual
    const lp = new Date(realisticDates.d3);
    lp.setDate(lp.getDate() + 2);
    const btn = page.getByLabel(`calendar-day-${toLocalDateString(lp)}`);
    if ((await btn.count()) > 0) {
      await expect(btn).toHaveClass(/phase-menstrual/);
    }
  });

  test('calendar legend is shown', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByText('Period Date')).toBeVisible();
    await expect(page.getByText('Predicted Range')).toBeVisible();
  });
});

/* ══════════════════════════════════════════════════════
   6. DAILY LOG
   ══════════════════════════════════════════════════════ */

test.describe('Daily Log', () => {
  test('page loads with today selected', async ({ page }) => {
    await page.goto('/daily-log');
    await expect(page.getByRole('heading', { name: 'Daily Log' })).toBeVisible();
    const dayNum = new Date().getDate().toString();
    await expect(page.locator('.checkin-date')).toContainText(dayNum);
  });

  test('all checkin categories are visible', async ({ page }) => {
    await page.goto('/daily-log');
    for (const label of ['Mood', 'Energy', 'Pain', 'Cervical mucus', 'Sleep', 'Stress', 'Period today?']) {
      await expect(page.getByText(label)).toBeVisible();
    }
  });

  test('chip selection sets active state', async ({ page }) => {
    await page.goto('/daily-log');
    const chip = page.locator('[data-field="mood"][data-value="good"]');
    await chip.click();
    await expect(chip).toHaveClass(/chip-active/);
  });

  test('chip toggle-off deselects', async ({ page }) => {
    await page.goto('/daily-log');
    const chip = page.locator('[data-field="mood"][data-value="neutral"]');
    await chip.click();
    await expect(chip).toHaveClass(/chip-active/);
    await chip.click();
    await expect(chip).not.toHaveClass(/chip-active/);
  });

  test('full check-in persists after reload', async ({ page }) => {
    await page.goto('/daily-log');
    await page.locator('[data-field="mood"][data-value="good"]').click();
    await page.locator('[data-field="energy"][data-value="high"]').click();
    await page.locator('[data-field="pain"][data-value="mild"]').click();
    await page.locator('[data-field="mucus"][data-value="egg_white"]').click();
    await page.locator('[data-field="sleepBand"][data-value="btw6_8"]').click();
    await page.locator('[data-field="stress"][data-value="normal"]').click();
    await page.getByRole('button', { name: 'Yes' }).click();
    await page.locator('[data-field="flow"][data-value="medium"]').click();

    await page.reload();
    await expect(page.locator('[data-field="mood"][data-value="good"]')).toHaveClass(/chip-active/);
    await expect(page.locator('[data-field="energy"][data-value="high"]')).toHaveClass(/chip-active/);
  });

  test('"Yes" shows flow options, "No" hides them', async ({ page }) => {
    await page.goto('/daily-log');
    await expect(page.locator('[data-field="flow"][data-value="heavy"]')).not.toBeVisible();
    await page.getByRole('button', { name: 'Yes', exact: true }).click();
    await expect(page.locator('[data-field="flow"][data-value="heavy"]')).toBeVisible();
    await page.getByRole('button', { name: 'No', exact: true }).click();
    await expect(page.locator('[data-field="flow"][data-value="heavy"]')).not.toBeVisible();
  });

  test('"Next →" is disabled on today', async ({ page }) => {
    await page.goto('/daily-log');
    await expect(page.getByRole('button', { name: 'Next →' })).toBeDisabled();
  });

  test('cannot navigate beyond today', async ({ page }) => {
    await page.goto('/daily-log');
    await page.getByRole('button', { name: '← Previous' }).click();
    const nextBtn = page.getByRole('button', { name: 'Next →' });
    await expect(nextBtn).toBeEnabled();
    await nextBtn.click();
    await expect(nextBtn).toBeDisabled();
  });

  test('"Today" button returns to current date', async ({ page }) => {
    await page.goto('/daily-log');
    await page.getByRole('button', { name: '← Previous' }).click();
    await page.getByRole('button', { name: '← Previous' }).click();
    await page.getByRole('button', { name: 'Today' }).click();
    await expect(page.locator('.checkin-date')).toContainText(new Date().getDate().toString());
  });

  test('"Why it matters" section is visible', async ({ page }) => {
    await page.goto('/daily-log');
    await expect(page.getByText('Why it matters')).toBeVisible();
  });
});

/* ══════════════════════════════════════════════════════
   7. HISTORY PAGE
   ══════════════════════════════════════════════════════ */

test.describe('History', () => {
  test('empty state when no entries', async ({ page }) => {
    await page.goto('/history');
    await expect(page.getByText('No recorded periods yet')).toBeVisible();
    await expect(page.getByText('0 saved entries')).toBeVisible();
  });

  test('shows entries after onboarding', async ({ page }) => {
    await completeOnboardingWithDates(page);
    await page.goto('/history');
    await expect(page.getByText('3 saved entries')).toBeVisible();
  });

  test('delete removes entry', async ({ page }) => {
    page.on('dialog', (d) => d.accept());
    await completeOnboardingWithDates(page);
    await page.goto('/history');
    await page.getByRole('button', { name: 'Delete' }).first().click();
    await expect(page.getByText('2 saved entries')).toBeVisible();
  });

  test('dismiss confirm keeps entry', async ({ page }) => {
    page.on('dialog', (d) => d.dismiss());
    await completeOnboardingWithDates(page);
    await page.goto('/history');
    await page.getByRole('button', { name: 'Delete' }).first().click();
    await expect(page.getByText('3 saved entries')).toBeVisible();
  });
});

/* ══════════════════════════════════════════════════════
   8. NAVIGATION
   ══════════════════════════════════════════════════════ */

test.describe('Navigation', () => {
  test('nav links work correctly', async ({ page }) => {
    await completeOnboardingWithDates(page);

    await page.getByRole('link', { name: /daily log/i }).click();
    await expect(page).toHaveURL(/\/daily-log/);

    await page.getByRole('link', { name: /history/i }).click();
    await expect(page).toHaveURL(/\/history/);

    await page.getByRole('link', { name: /dashboard/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('fresh user without data sees onboarding', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByText('Selene')).toBeVisible();
  });
});

/* ══════════════════════════════════════════════════════
   9. PREDICTIONS & PHASES
   ══════════════════════════════════════════════════════ */

test.describe('Predictions & phases', () => {
  test('prediction card shows confidence after 3 entries', async ({ page }) => {
    await completeOnboardingWithDates(page);
    await expect(page.getByText('Confidence')).toBeVisible();
    await expect(page.getByText(/\d+%/)).toBeVisible();
  });

  test('prediction says "Add more dates" with <3 entries', async ({ page }) => {
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByPlaceholder('Enter your name').fill('X');
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.locator('input[type="date"]').first().fill(daysAgo(30));
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('heading', { name: 'Add more dates' })).toBeVisible();
  });

  test('fertile window is computed with 3+ entries', async ({ page }) => {
    await completeOnboardingWithDates(page);
    await expect(page.getByText('More data needed to estimate fertile window')).not.toBeVisible();
  });

  test('ovulation log boosts prediction confidence', async ({ page }) => {
    await completeOnboardingWithDates(page);
    await page.goto('/daily-log');
    await page.locator('[data-field="mucus"][data-value="egg_white"]').click();
    await page.locator('[data-field="stress"][data-value="normal"]').click();
    await page.locator('[data-field="sleepBand"][data-value="btw6_8"]').click();

    await page.goto('/dashboard');
    await expect(page.getByText('Ovulation confirmed from logs')).toBeVisible();
    await expect(page.getByText(/Base 80%/)).toBeVisible();
  });
});

/* ══════════════════════════════════════════════════════
   10. PERSONALIZATION
   ══════════════════════════════════════════════════════ */

test.describe('Personalization', () => {
  test('avatar can be changed', async ({ page }) => {
    await completeOnboardingWithDates(page);
    const select = page.locator('select').filter({ has: page.locator('option[value="🌼"]') });
    if ((await select.count()) > 0) {
      await select.first().selectOption('🌼');
      await expect(page.locator('.avatar-emoji')).toContainText('🌼');
    }
  });

  test('name can be edited in personalization', async ({ page }) => {
    await completeOnboardingWithDates(page);
    const nameInput = page.locator('.form-grid input[type="text"]').first();
    await nameInput.fill('Updated');
    await expect(page.getByText('Hi, Updated')).toBeVisible();
  });
});

/* ══════════════════════════════════════════════════════
   11. EDGE CASES & REGRESSIONS
   ══════════════════════════════════════════════════════ */

test.describe('Edge cases & regressions', () => {
  test('dashboard shows skipped cycle warning for historical gaps >45 days', async ({ page }) => {
    // Dates with a 60-day gap between 1st and 2nd entry
    await completeOnboardingWithDates(page, [daysAgo(120), daysAgo(60), daysAgo(30)]);
    await expect(page.getByText(/Possible skipped cycle detected/)).toBeVisible();
    await expect(page.getByText(/longer than 45 days/)).toBeVisible();
    await expect(page.getByText(/pregnancy/i)).toBeVisible();
  });

  test('normal cycle gaps (≤45 days) do NOT show skipped warning', async ({ page }) => {
    // All gaps are 30 days → normal
    await completeOnboardingWithDates(page, [daysAgo(90), daysAgo(60), daysAgo(30)]);
    await expect(page.getByText(/Possible skipped cycle detected/)).not.toBeVisible();
  });

  test('single date entry does not crash', async ({ page }) => {
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByPlaceholder('Enter your name').fill('Solo');
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.locator('input[type="date"]').first().fill(daysAgo(15));
    await page.getByRole('button', { name: 'Continue' }).click();

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator('.cycle-day-number')).toContainText(/Day \d+/);
    await expect(page.getByRole('heading', { name: 'Add more dates' })).toBeVisible();
  });

  test('dashboard survives full reload', async ({ page }) => {
    await completeOnboardingWithDates(page);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByText('Tracking 3 entries')).toBeVisible();
  });

  test('daily log persists after reload', async ({ page }) => {
    await page.goto('/daily-log');
    await page.locator('[data-field="mood"][data-value="great"]').click();
    await page.reload();
    await expect(page.locator('[data-field="mood"][data-value="great"]')).toHaveClass(/chip-active/);
  });

  test('stress/sleep warning shown for high-stress logs', async ({ page }) => {
    await completeOnboardingWithDates(page);
    await page.goto('/daily-log');
    await page.locator('[data-field="stress"][data-value="high"]').click();
    await page.locator('[data-field="sleepBand"][data-value="lt6"]').click();
    await page.goto('/dashboard');
    await expect(page.getByText(/stress|sleep/i)).toBeVisible();
  });
});
