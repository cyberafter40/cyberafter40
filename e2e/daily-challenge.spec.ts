import { expect, test, type Page } from '@playwright/test';
import { createRng } from '../src/engine/rng';
import { getVariant } from '../src/engine/registry';
import { deriveDailyChallenge } from '../src/daily/challenge';
import { registerAllGameModules } from '../src/games';
import { generateSecret } from '../src/games/numberLogic/generator';
import { toDateKey } from '../src/utils/date';

/**
 * The full loop, for real.
 *
 * The app boots in a browser, signs itself in anonymously against the Auth
 * emulator, derives today's challenge, plays it, and submits the result to the
 * real `submitGameResult` Cloud Function — which replays the game, applies the
 * security rules and writes six documents. Then the profile screen is checked
 * for the statistics that write produced.
 *
 * The test knows the answer the same way the app does: by deriving it from the
 * date. If the app's derivation and the test's ever diverge, this fails — which
 * is exactly the guarantee the Daily Challenge depends on.
 */

registerAllGameModules();

const TODAY = toDateKey();
const CHALLENGE = deriveDailyChallenge(TODAY);

function dailySecret(): string {
  const variant = getVariant(CHALLENGE.moduleId, CHALLENGE.variantId);
  return generateSecret(variant.config, createRng(CHALLENGE.seed));
}

/** Clears storage so every test starts as a brand-new install. */
async function freshInstall(page: Page): Promise<void> {
  await page.goto('/');
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  await page.reload();
}

async function completeOnboarding(page: Page): Promise<void> {
  // Three cards, then the app proper.
  await expect(page.getByText('A hidden code')).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByText('Every guess tells you something')).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByText('Five minutes a day')).toBeVisible();
  await page.getByRole('button', { name: 'Start playing' }).click();
}

/**
 * Enters a guess at roughly human speed.
 *
 * The backend rejects anything faster than 250ms per move as an instant-solve
 * bot (`MIN_MS_PER_MOVE` in functions/src/replay.ts). That check is correct and
 * is deliberately *not* relaxed for the tests — so the test taps like a person
 * instead. A run without these pauses is what first proved the rule fires.
 */
async function typeCode(page: Page, code: string): Promise<void> {
  for (const digit of code) {
    await page.getByRole('button', { name: digit, exact: true }).click();
    await page.waitForTimeout(220);
  }
  await page.getByRole('button', { name: 'Check' }).click();
  await page.waitForTimeout(220);
}

test.describe('MindCode end to end', () => {
  test('boots, onboards, and reaches the home screen', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    await freshInstall(page);
    await completeOnboarding(page);

    await expect(page.getByText('Daily Challenge')).toBeVisible();
    await expect(page.getByRole('button', { name: /Play today/ })).toBeVisible();

    // A boot that throws is a boot that would have shown a white screen.
    expect(errors).toEqual([]);
  });

  test('shows both game modules from the registry', async ({ page }) => {
    await freshInstall(page);
    await completeOnboarding(page);

    await expect(page.getByText(/Number Logic/).first()).toBeVisible();
    await expect(page.getByText(/Memory Grid/).first()).toBeVisible();
  });

  test('plays the Daily Challenge and records it through the backend', async ({ page }) => {
    const warnings: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'warning' && msg.text().includes('MindCode')) warnings.push(msg.text());
    });

    await freshInstall(page);
    await completeOnboarding(page);

    await page.getByRole('button', { name: /Play today/ }).click();
    // React Navigation keeps the home screen mounted behind the game, so assert
    // on something only the board has rather than on the shared title.
    await expect(page.getByLabel(/Empty code/)).toBeVisible();

    // One deliberate wrong guess first, so the history and the score breakdown
    // both have something real in them.
    const secret = dailySecret();
    const wrong = secret === '10' ? '23' : '10';
    await typeCode(page, wrong);
    await expect(page.getByText(/guesses left/)).toBeVisible();

    await typeCode(page, secret);

    // Result screen: the code is revealed and the game was scored.
    await expect(page.getByText('The code was')).toBeVisible();
    await expect(page.getByText(secret, { exact: true }).first()).toBeVisible();
    await expect(page.getByText('How it scored')).toBeVisible();

    // The backend must have accepted it — a rejected submission would show the
    // offline notice instead, and would log a warning.
    expect(warnings).toEqual([]);
    await expect(
      page.getByText('Saved on this device — it will sync when you are back online.'),
    ).toHaveCount(0);

    await page.getByRole('button', { name: 'Done', exact: true }).click();

    // The attempt is spent — the play button is replaced by a countdown.
    await expect(page.getByText('Next challenge in')).toBeVisible();
    await expect(page.getByRole('button', { name: /Play today/ })).toHaveCount(0);
  });

  test('reflects the finished game in the profile statistics', async ({ page }) => {
    await freshInstall(page);
    await completeOnboarding(page);

    await page.getByRole('button', { name: /Play today/ }).click();
    await typeCode(page, dailySecret());
    await expect(page.getByText('The code was')).toBeVisible();
    await page.getByRole('button', { name: 'Done', exact: true }).click();

    // React Navigation renders bottom tabs as links on web (they are buttons on
    // native). This suite runs against the web build, so it asserts the web role.
    await page.getByRole('link', { name: /You/ }).click();

    // These numbers come from the profile document the Cloud Function wrote.
    await expect(page.getByLabel('Games played: 1, 1 solved')).toBeVisible();
    await expect(page.getByLabel('Win rate: 100%')).toBeVisible();
    await expect(page.getByLabel('Daily challenges: 1')).toBeVisible();
  });

  test('enforces one attempt per day across a reload', async ({ page }) => {
    await freshInstall(page);
    await completeOnboarding(page);

    await page.getByRole('button', { name: /Play today/ }).click();
    await typeCode(page, dailySecret());
    await expect(page.getByText('The code was')).toBeVisible();
    await page.getByRole('button', { name: 'Done', exact: true }).click();

    // Reloading must not hand back a second attempt: the entry is in Firestore,
    // not in local state.
    await page.reload();
    await expect(page.getByText('Next challenge in')).toBeVisible();
    await expect(page.getByRole('button', { name: /Play today/ })).toHaveCount(0);
  });

  test('plays a Memory Grid game through the same host screen', async ({ page }) => {
    await freshInstall(page);
    await completeOnboarding(page);

    await page.getByRole('button', { name: /Play Memory Grid, Four Tiles/ }).click();

    // Watch phase first — the grid is locked until the sequence has played.
    await expect(page.getByText('Watch')).toBeVisible();
    await expect(page.getByText('Repeat it')).toBeVisible({ timeout: 15_000 });

    // The sequence is seeded per session, so the test cannot know it; asserting
    // that the phase transition happens is what matters here. The engine's own
    // suite covers the rules.
    await expect(page.getByRole('button', { name: 'Tile 1' })).toBeEnabled();
  });

  test('survives a reload without losing the signed-in session', async ({ page }) => {
    await freshInstall(page);
    await completeOnboarding(page);
    await expect(page.getByText('Daily Challenge')).toBeVisible();

    await page.reload();

    // Onboarding is not shown again, and the profile is still there.
    await expect(page.getByText('Daily Challenge')).toBeVisible();
    await expect(page.getByText('A hidden code')).toHaveCount(0);
  });
});
