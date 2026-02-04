import { test, expect, type Page } from '@playwright/test';

const toLocalDateString = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

test.beforeEach(async ({ page }) => {
  await page.route('**/predict', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        earliest: '2026-02-28',
        latest: '2026-03-02',
        confidence: 0.8
      })
    });
  });
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    indexedDB.deleteDatabase('periodDB');
  });
  await page.reload();
});

const completeOnboardingWithDates = async (page: Page) => {
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByPlaceholder('Enter your name').fill('Test User');
  await page.getByRole('button', { name: 'Continue' }).click();

  const dateInputs = page.locator('input[type="date"]');
  await dateInputs.nth(0).fill('2025-12-05');
  await page.getByRole('button', { name: '+ Add another date' }).click();
  await dateInputs.nth(1).fill('2026-01-05');
  await page.getByRole('button', { name: '+ Add another date' }).click();
  await dateInputs.nth(2).fill('2026-02-01');

  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(/\/dashboard/);
};

test('onboarding flows into dashboard', async ({ page }) => {
  await completeOnboardingWithDates(page);
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
});

test('daily log check-in saves selections', async ({ page }) => {
  await page.goto('/daily-log');

  await page.locator('[data-field="mood"][data-value="good"]').click();
  await page.locator('[data-field="energy"][data-value="high"]').click();
  await page.locator('[data-field="pain"][data-value="mild"]').click();
  await page.locator('[data-field="mucus"][data-value="egg_white"]').click();
  await page.locator('[data-field="sleepBand"][data-value="btw6_8"]').click();
  await page.locator('[data-field="stress"][data-value="normal"]').click();
  await page.getByRole('button', { name: 'Yes' }).click();
  await page.locator('[data-field="flow"][data-value="medium"]').click();

  await expect(page.locator('[data-field="mood"][data-value="good"]')).toHaveClass(/chip-active/);
  await expect(page.locator('[data-field="energy"][data-value="high"]')).toHaveClass(/chip-active/);
  await expect(page.locator('[data-field="flow"][data-value="medium"]')).toHaveClass(/chip-active/);

  await page.reload();
  await expect(page.locator('[data-field="mood"][data-value="good"]')).toHaveClass(/chip-active/);
  await expect(page.locator('[data-field="energy"][data-value="high"]')).toHaveClass(/chip-active/);
});

test('calendar selection uses correct date', async ({ page }) => {
  await page.goto('/dashboard');
  const today = toLocalDateString(new Date());
  const dayButton = page.getByLabel(`calendar-day-${today}`);
  await dayButton.click();
  await expect(dayButton).toHaveClass(/period/);
});

test('phase coloring aligns with cycle window', async ({ page }) => {
  await completeOnboardingWithDates(page);

  const menstrualDay = page.getByLabel('calendar-day-2026-02-03');
  await expect(menstrualDay).toHaveClass(/phase-menstrual/);

  const ovulationDay = page.getByLabel('calendar-day-2026-02-15');
  await expect(ovulationDay).toHaveClass(/phase-ovulation/);

  const lutealDay = page.getByLabel('calendar-day-2026-02-20');
  await expect(lutealDay).toHaveClass(/phase-luteal/);
});

test('prediction confidence adjusts with ovulation log', async ({ page }) => {
  await completeOnboardingWithDates(page);
  await page.goto('/daily-log');

  await page.locator('[data-field="mucus"][data-value="egg_white"]').click();
  await page.locator('[data-field="stress"][data-value="normal"]').click();
  await page.locator('[data-field="sleepBand"][data-value="btw6_8"]').click();

  await page.goto('/dashboard');
  await expect(page.getByText('Ovulation confirmed from logs')).toBeVisible();
  await expect(page.getByText(/Base 80%/)).toBeVisible();
});
