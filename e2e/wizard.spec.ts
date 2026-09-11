import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { expect, test, type Locator, type Page } from '@playwright/test';

const SEED_PATH = '/?seed=42';
const VISUAL_REVIEW_DIR = path.join(process.cwd(), 'test-results', 'visual-review');
const MAX_GAME_TRANSITIONS = 1_200;
const errorsByPage = new WeakMap<Page, string[]>();

type GameSnapshot = {
  readonly phase: string;
  readonly round: number;
  readonly activePlayer: string;
  readonly signature: string;
};

type AuthoritativeView = {
  readonly phase: string;
  readonly round: string;
  readonly activePlayer: string;
  readonly prompt: string;
  readonly seats: readonly string[];
  readonly humanCards: readonly string[];
  readonly trickCards: readonly string[];
};

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  errorsByPage.set(page, errors);
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push(`console.error: ${message.text()}`);
    }
  });
});

test.afterEach(async ({ page }) => {
  expect(errorsByPage.get(page) ?? [], 'browser console and page errors').toEqual([]);
});

test('plays a seeded Easy match through all 15 rounds and final standings', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'desktop match coverage');

  await openFresh(page, SEED_PATH);
  await screenshot(page, 'home-desktop.png');
  await page.getByRole('button', { name: 'Easy' }).click();
  await waitForHumanDecision(page);
  await screenshot(page, 'round-table-desktop.png');

  let sawRound15Result = false;
  let capturedRoundResult = false;

  for (let transition = 0; transition < MAX_GAME_TRANSITIONS; transition += 1) {
    const snapshot = await readGameSnapshot(page);

    if (snapshot.phase === 'match-result') {
      break;
    }

    if (snapshot.phase === 'round-result') {
      await expect(page.getByRole('heading', { name: `Round ${snapshot.round} complete` })).toBeVisible();
      if (!capturedRoundResult) {
        capturedRoundResult = true;
        await screenshot(page, 'round-result-desktop.png');
      }
      if (snapshot.round === 15) {
        sawRound15Result = true;
      }

      await page.getByRole('button', { name: 'Continue', exact: true }).click();
      await waitForGameChange(page, snapshot.signature);
      continue;
    }

    if (isHumanDecision(snapshot)) {
      await chooseFirstHumanAction(page, snapshot);
      continue;
    }

    await waitForGameChange(page, snapshot.signature);
  }

  expect(sawRound15Result, 'the browser surfaced the round 15 summary').toBe(true);
  await expect(gameState(page)).toHaveAttribute('data-phase', 'match-result');
  await expect(page.getByRole('heading', { name: 'Match complete' })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Final standings' }).getByRole('listitem')).toHaveCount(4);
  await screenshot(page, 'match-result-desktop.png');

  await page.getByRole('button', { name: 'Score Sheet' }).click();
  const scoreDialog = page.getByRole('dialog', { name: 'Score sheet' });
  await expect(scoreDialog).toBeVisible();
  await expect(scoreDialog.locator('tbody')).toHaveCount(15);
});

test('plays a persisted Medium match through all 15 rounds', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'desktop mode coverage');

  await openFresh(page, SEED_PATH);
  await page.getByRole('button', { name: 'Medium' }).click();
  await waitForHumanDecision(page);

  const difficulty = await page.evaluate(() => {
    const value = localStorage.getItem('wizard-card-game/save-v1');
    return value === null ? null : (JSON.parse(value) as { difficulty?: unknown }).difficulty;
  });
  expect(difficulty).toBe('medium');

  for (let transition = 0; transition < MAX_GAME_TRANSITIONS; transition += 1) {
    const snapshot = await readGameSnapshot(page);
    if (snapshot.phase === 'match-result') break;
    if (snapshot.phase === 'round-result') {
      await page.getByRole('button', { name: 'Continue', exact: true }).click();
      await waitForGameChange(page, snapshot.signature);
    } else if (isHumanDecision(snapshot)) {
      await chooseFirstHumanAction(page, snapshot);
    } else {
      await waitForGameChange(page, snapshot.signature);
    }
  }

  await expect(gameState(page)).toHaveAttribute('data-phase', 'match-result');
  await expect(page.getByRole('heading', { name: 'Match complete' })).toBeVisible();
});

test('arranges four enlarged player-owned trick slots as a cross', async ({ page }) => {
  await openFresh(page, SEED_PATH);
  await page.getByRole('button', { name: 'Easy' }).click();
  await waitForHumanDecision(page);

  const centers = await page.locator('[data-trick-player]').evaluateAll((slots) =>
    Object.fromEntries(slots.map((slot) => {
      const rect = slot.getBoundingClientRect();
      return [slot.getAttribute('data-trick-player'), {
        x: rect.x + rect.width / 2,
        y: rect.y + rect.height / 2,
      }];
    })),
  ) as Record<'human' | 'ember' | 'rowan' | 'mira', { x: number; y: number }>;

  expect(Object.keys(centers)).toHaveLength(4);
  expect(centers.rowan.y).toBeLessThan(centers.ember.y);
  expect(centers.rowan.y).toBeLessThan(centers.mira.y);
  expect(centers.ember.x).toBeLessThan(centers.rowan.x);
  expect(centers.mira.x).toBeGreaterThan(centers.rowan.x);
  expect(centers.human.y).toBeGreaterThan(centers.ember.y);
  expect(centers.human.y).toBeGreaterThan(centers.mira.y);

  const [slotSize, faceUpWidth] = await Promise.all([
    page.locator('.trick-play__empty').first().evaluate((slot) => {
      const rect = slot.getBoundingClientRect();
      return { width: rect.width, height: rect.height };
    }),
    page.locator('.face-up-card .playing-card').evaluate((card) => card.getBoundingClientRect().width),
  ]);

  expect(slotSize.width).toBeGreaterThanOrEqual(faceUpWidth * 1.8);
  expect(slotSize.height).toBeGreaterThanOrEqual(slotSize.width * 1.39);
});

test('withholds bids until the human bids and then parks the reveal in the upper-left', async ({ page }) => {
  await openFresh(page, SEED_PATH);
  await page.getByRole('button', { name: 'Easy' }).click();
  const bidding = await reachHumanPhase(page, 'bidding');

  const stats = page.locator('.seat-table-stats');
  await expect(stats).toHaveCount(4);
  for (const text of await stats.allTextContents()) {
    expect(text).not.toContain('Bid');
    expect(text).toContain('Tricks');
  }

  await page.getByRole('button', { name: /^Bid \d+$/ }).first().click();
  await waitForGameChange(page, bidding.signature);
  await expect(page.getByLabel('You round stats')).toContainText('Bid');
  await reachHumanPhase(page, 'playing');

  const reveal = page.locator('.face-up-card--table-corner');
  await expect(reveal).toBeVisible();
  const tableBox = await page.locator('.game-table').boundingBox();
  expect(tableBox).not.toBeNull();
  if (tableBox !== null) {
    await expect.poll(async () => {
      const revealBox = await reveal.boundingBox();
      return revealBox === null ? Number.POSITIVE_INFINITY : revealBox.x + revealBox.width / 2;
    }).toBeLessThan(tableBox.x + tableBox.width / 3);
    const revealBox = await reveal.boundingBox();
    expect(revealBox).not.toBeNull();
    if (revealBox !== null) {
      expect(revealBox.y + revealBox.height / 2).toBeLessThan(tableBox.y + tableBox.height / 3);
    }
  }
});

test('enlarges human hand cards without fading their disabled state', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'desktop hand-size coverage');

  await openFresh(page, SEED_PATH);
  await page.getByRole('button', { name: 'Easy' }).click();
  await reachHumanPhase(page, 'bidding');

  const card = page.locator('.human-hand .playing-card').first();
  await expect(card).toBeDisabled();
  const presentation = await card.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      width: element.getBoundingClientRect().width,
      opacity: style.opacity,
      filter: style.filter,
    };
  });
  const tableCardWidth = await page
    .locator('.face-up-card .playing-card')
    .evaluate((element) => element.getBoundingClientRect().width);

  expect(presentation.width).toBeGreaterThanOrEqual(tableCardWidth * 1.25);
  expect(presentation.opacity).toBe('1');
  expect(presentation.filter).toBe('none');
});

test.describe('normal-motion resume flows', () => {
  test.use({ reducedMotion: 'no-preference' });

  test('resumes the exact saved state from a human bidding turn', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'desktop resume coverage');

    await openFresh(page, SEED_PATH);
    await page.getByRole('button', { name: 'Easy' }).click();
    const bidding = await reachHumanPhase(page, 'bidding');
    const saved = await captureAuthoritativeView(page);

    await page.reload();
    await expect(page.getByRole('button', { name: 'Continue Game' })).toBeVisible();
    await page.getByRole('button', { name: 'Continue Game' }).click();

    await expect.poll(() => captureAuthoritativeView(page)).toEqual(saved);
    await page.getByRole('button', { name: /^Bid \d+$/ }).first().click();
    await waitForGameChange(page, bidding.signature);
  });

  test('resumes a partial trick exactly and continues play', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'desktop resume coverage');

    await openFresh(page, SEED_PATH);
    await page.getByRole('button', { name: 'Easy' }).click();
    let playing = await reachHumanPhase(page, 'playing');

    if ((await currentTrickCards(page).count()) === 0) {
      await page.getByTestId('legal-card').first().click();
      await expect(currentTrickCards(page)).not.toHaveCount(0);
      playing = await readGameSnapshot(page);
    }

    expect(playing.phase).toBe('playing');
    expect(await currentTrickCards(page).count()).toBeGreaterThan(0);
    const saved = await captureAuthoritativeView(page);

    await page.reload();
    await expect(page.getByRole('button', { name: 'Continue Game' })).toBeVisible();
    await page.getByRole('button', { name: 'Continue Game' }).click();

    await expect.poll(() => captureAuthoritativeView(page)).toEqual(saved);
    const resumed = await readGameSnapshot(page);
    expect(resumed.activePlayer).toBe('human');
    await page.getByTestId('legal-card').first().click();
    await waitForGameChange(page, resumed.signature);
  });
});

test('uses native modal dialogs with focus containment, restoration, and described consequences', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'desktop dialog coverage');

  await openFresh(page, SEED_PATH);
  const rulesButton = page.getByRole('button', { name: 'Rules' });
  await rulesButton.click();
  const rulesDialog = page.getByRole('dialog', { name: 'How to play Wizard' });
  await expectNativeModal(rulesDialog);
  await expect(page.getByRole('button', { name: 'Close rules' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Close rules' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(rulesDialog).toBeHidden();
  await expect(rulesButton).toBeFocused();

  await page.getByRole('button', { name: 'Easy' }).click();
  await waitForHumanDecision(page);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Continue Game' })).toBeVisible();

  const easyButton = page.getByRole('button', { name: 'Easy' });
  await easyButton.click();
  const savedGameDialog = page.getByRole('dialog', { name: 'Start a new game?' });
  await expectNativeModal(savedGameDialog);
  await expectDialogDescription(savedGameDialog, 'Your saved match will be replaced.');
  await expect(savedGameDialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(savedGameDialog.getByRole('button', { name: 'Start New Game' })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(savedGameDialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(savedGameDialog).toBeHidden();
  await expect(easyButton).toBeFocused();

  await page.getByRole('button', { name: 'Continue Game' }).click();
  const beforeAction = await waitForHumanDecision(page);
  await chooseFirstHumanAction(page, beforeAction);
  const beforeRestart = await readGameSnapshot(page);

  await page.getByRole('button', { name: 'Restart' }).click();
  const restartDialog = page.getByRole('dialog', { name: 'Restart match?' });
  await expectNativeModal(restartDialog);
  await expectDialogDescription(
    restartDialog,
    'Your current unfinished match will be lost and replaced with a new match.',
  );
  await expect(restartDialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await expect(page.locator('dialog:modal')).toHaveCount(1);
  await restartDialog.getByRole('button', { name: 'Restart Match' }).click();
  await waitForGameChange(page, beforeRestart.signature);
  await expect(gameState(page)).toHaveAttribute('data-round', '1');

  await page.getByRole('button', { name: 'Return Home' }).click();
  const homeDialog = page.getByRole('dialog', { name: 'Return home?' });
  await expectNativeModal(homeDialog);
  await expectDialogDescription(
    homeDialog,
    'Your unfinished match will be abandoned and its saved progress removed.',
  );
  await homeDialog.getByRole('button', { name: 'Return Home and Abandon Match' }).click();
  await expect(page.getByRole('heading', { name: 'Wizard' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue Game' })).toHaveCount(0);
});

test('reduces representative motion to near zero while gameplay advances', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'desktop motion coverage');

  await openFresh(page, SEED_PATH);
  await page.getByRole('button', { name: 'Easy' }).click();
  const before = await waitForHumanDecision(page);
  const durations = await page.evaluate(() => {
    const card = document.querySelector<HTMLElement>('.human-hand .playing-card');
    const seat = document.querySelector<HTMLElement>('.player-seat--active');
    if (card === null || seat === null) {
      return null;
    }
    const styles = [getComputedStyle(card), getComputedStyle(seat)];
    return styles.flatMap((style) => [style.animationDuration, style.transitionDuration]);
  });

  expect(durations).not.toBeNull();
  for (const durationList of durations ?? []) {
    for (const duration of durationList.split(',')) {
      expect(cssDurationMilliseconds(duration.trim())).toBeLessThanOrEqual(0.1);
    }
  }

  await chooseFirstHumanAction(page, before);
  await waitForGameChange(page, before.signature);
});

test('keeps the critical mobile flow contained with usable controls at 390px and 320px', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium', 'mobile layout coverage');

  await openFresh(page, SEED_PATH);
  await expectNoDocumentOverflow(page);
  const hardButton = page.getByRole('button', { name: 'Hard — Beta' });
  await expect(hardButton).toBeDisabled();
  expect(await hardButton.evaluate((button) => {
    let clicks = 0;
    button.addEventListener('click', () => { clicks += 1; });
    (button as HTMLButtonElement).click();
    (button as HTMLButtonElement).focus();
    return { clicks, focused: document.activeElement === button };
  })).toEqual({ clicks: 0, focused: false });
  await expectMinimumControlSize(page);

  await page.getByRole('button', { name: 'Easy' }).click();
  await reachHumanPhase(page, 'playing');
  await expectNoDocumentOverflow(page);
  await expectGameTableFitsViewport(page);
  await expectContained(page.locator('.game-table'));
  await expectHandFitsViewport(page.locator('.human-hand'));
  for (const seatName of ['You', 'Ember', 'Rowan', 'Mira']) {
    await expectContained(page.getByRole('region', { name: `${seatName} seat` }));
  }
  await screenshot(page, 'round-table-mobile-390.png');

  const beforeCard = await readGameSnapshot(page);
  await page.getByTestId('legal-card').first().click();
  await waitForGameChange(page, beforeCard.signature);
  await driveUntilPhase(page, 'round-result');
  await expect(page.getByRole('heading', { name: 'Round 1 complete' })).toBeVisible();
  await expectNoDocumentOverflow(page);
  await expectContained(page.locator('.round-summary'));

  await page.setViewportSize({ width: 320, height: 844 });
  await expectNoDocumentOverflow(page);
  await expectContained(page.locator('.round-summary'));

  const firstRoundResult = await readGameSnapshot(page);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await waitForGameChange(page, firstRoundResult.signature);
  const activeAt320 = await reachHumanPlayingRound(page, 15);
  const handAt320 = page.locator('.human-hand');
  await expectNoDocumentOverflow(page);
  await expectGameTableFitsViewport(page);
  await expectContained(page.locator('.game-table'));
  await expectContained(handAt320);
  await expectHandFitsViewport(handAt320);
  for (const seatName of ['You', 'Ember', 'Rowan', 'Mira']) {
    await expectContained(page.getByRole('region', { name: `${seatName} seat` }));
  }

  await page.getByTestId('legal-card').first().click();
  await waitForGameChange(page, activeAt320.signature);

  await page.goto(SEED_PATH);
  await expect(page.getByRole('heading', { name: 'Wizard' })).toBeVisible();
  await expectNoDocumentOverflow(page);
  await expectMinimumControlSize(page);
  await expectContained(page.locator('.home-screen__panel'));
});

test('fits the complete desktop table and full hand inside the viewport', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'desktop layout coverage');

  await openFresh(page, SEED_PATH);
  await page.getByRole('button', { name: 'Easy' }).click();
  await reachHumanPlayingRound(page, 15);
  await page.evaluate(() => window.scrollTo(0, 0));

  await expectNoDocumentOverflow(page);
  await expectGameTableFitsViewport(page);
  await expectHandFitsViewport(page.locator('.human-hand'));
});

test('builds production assets beneath the GitHub Pages base', async ({}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'single production build assertion');

  execFileSync('npm', ['run', 'build'], {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'pipe',
  });

  const html = readFileSync(path.join(process.cwd(), 'dist', 'index.html'), 'utf8');
  const assets = Array.from(
    html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g),
    (match) => match[1],
  );
  expect(assets.length).toBeGreaterThanOrEqual(2);

  for (const asset of assets) {
    expect(asset).toMatch(/^\/wizard-card-game\//);
    const relativeAsset = asset.slice('/wizard-card-game/'.length);
    expect(existsSync(path.join(process.cwd(), 'dist', relativeAsset))).toBe(true);
  }
});

async function openFresh(page: Page, pathName: string): Promise<void> {
  await page.goto('/');
  await page.evaluate(() => window.localStorage.clear());
  await page.goto(pathName);
  await expect(page.getByRole('heading', { name: 'Wizard' })).toBeVisible();
}

function gameState(page: Page): Locator {
  return page.getByTestId('game-state');
}

function currentTrickCards(page: Page): Locator {
  return page.locator('.trick-area__plays [data-card-id]');
}

async function readGameSnapshot(page: Page): Promise<GameSnapshot> {
  await expect(gameState(page)).toBeVisible();
  return gameState(page).evaluate((main) => {
    const phase = main.getAttribute('data-phase') ?? '';
    const roundText = main.getAttribute('data-round') ?? '';
    const activePlayer = main.getAttribute('data-active-player') ?? '';
    const publicState = {
      phase,
      round: roundText,
      activePlayer,
      prompt: main.querySelector('[role="status"]')?.textContent ?? '',
      seats: Array.from(main.querySelectorAll('[data-seat]'), (seat) => seat.textContent ?? ''),
      humanCards: Array.from(
        main.querySelectorAll('.human-hand [data-card-id]'),
        (card) => `${card.getAttribute('data-card-id')}:${card.hasAttribute('disabled')}`,
      ),
      trickCards: Array.from(
        main.querySelectorAll('.trick-area__plays [data-card-id]'),
        (card) => card.getAttribute('data-card-id') ?? '',
      ),
    };

    return {
      phase,
      round: Number(roundText),
      activePlayer,
      signature: JSON.stringify(publicState),
    };
  });
}

async function captureAuthoritativeView(page: Page): Promise<AuthoritativeView> {
  await expect(gameState(page)).toBeVisible();
  return gameState(page).evaluate((main) => ({
    phase: main.getAttribute('data-phase') ?? '',
    round: main.getAttribute('data-round') ?? '',
    activePlayer: main.getAttribute('data-active-player') ?? '',
    prompt: main.querySelector('[role="status"]')?.textContent?.trim() ?? '',
    seats: Array.from(main.querySelectorAll('[data-seat]'), (seat) => seat.textContent?.trim() ?? ''),
    humanCards: Array.from(
      main.querySelectorAll<HTMLButtonElement>('.human-hand [data-card-id]'),
      (card) => `${card.dataset.cardId}:${card.getAttribute('aria-label')}:${card.disabled}`,
    ),
    trickCards: Array.from(
      main.querySelectorAll('.trick-area__plays [data-card-id]'),
      (card) => `${card.getAttribute('data-card-id')}:${card.getAttribute('aria-label')}`,
    ),
  }));
}

async function waitForGameChange(page: Page, priorSignature: string): Promise<void> {
  await expect.poll(async () => (await readGameSnapshot(page)).signature, {
    message: 'the public game view should advance',
    timeout: 10_000,
  }).not.toBe(priorSignature);
}

async function waitForHumanDecision(page: Page): Promise<GameSnapshot> {
  for (let transition = 0; transition < 80; transition += 1) {
    const snapshot = await readGameSnapshot(page);
    if (
      snapshot.activePlayer === 'human' &&
      ['choose-trump', 'bidding', 'playing'].includes(snapshot.phase)
    ) {
      return snapshot;
    }
    await waitForGameChange(page, snapshot.signature);
  }

  throw new Error('The game did not reach a human decision within 80 public transitions.');
}

async function reachHumanPhase(page: Page, targetPhase: 'bidding' | 'playing'): Promise<GameSnapshot> {
  for (let transition = 0; transition < 120; transition += 1) {
    const snapshot = await waitForHumanDecision(page);
    if (snapshot.phase === targetPhase) {
      return snapshot;
    }
    await chooseFirstHumanAction(page, snapshot);
  }

  throw new Error(`The game did not reach a human ${targetPhase} turn.`);
}

async function chooseFirstHumanAction(page: Page, snapshot: GameSnapshot): Promise<void> {
  let action: Locator;
  if (snapshot.phase === 'choose-trump') {
    action = page.getByRole('group', { name: 'Choose trump' }).getByRole('button').first();
  } else if (snapshot.phase === 'bidding') {
    action = page.getByRole('button', { name: /^Bid \d+$/ }).first();
  } else if (snapshot.phase === 'playing') {
    action = page.getByTestId('legal-card').first();
  } else {
    throw new Error(`Unsupported human decision phase: ${snapshot.phase}`);
  }

  await expect(action).toBeEnabled();
  await action.click();
  await waitForGameChange(page, snapshot.signature);
}

function isHumanDecision(snapshot: GameSnapshot): boolean {
  return (
    snapshot.activePlayer === 'human' &&
    ['choose-trump', 'bidding', 'playing'].includes(snapshot.phase)
  );
}

async function driveUntilPhase(page: Page, targetPhase: string): Promise<GameSnapshot> {
  for (let transition = 0; transition < MAX_GAME_TRANSITIONS; transition += 1) {
    const snapshot = await readGameSnapshot(page);
    if (snapshot.phase === targetPhase) {
      return snapshot;
    }
    if (isHumanDecision(snapshot)) {
      await chooseFirstHumanAction(page, snapshot);
    } else {
      await waitForGameChange(page, snapshot.signature);
    }
  }

  throw new Error(`The game did not reach ${targetPhase} within the transition cap.`);
}

async function reachHumanPlayingRound(page: Page, minimumRound: number): Promise<GameSnapshot> {
  for (let transition = 0; transition < MAX_GAME_TRANSITIONS; transition += 1) {
    const snapshot = await readGameSnapshot(page);
    if (
      snapshot.round >= minimumRound &&
      snapshot.phase === 'playing' &&
      snapshot.activePlayer === 'human'
    ) {
      return snapshot;
    }
    if (snapshot.phase === 'round-result') {
      await page.getByRole('button', { name: 'Continue', exact: true }).click();
      await waitForGameChange(page, snapshot.signature);
    } else if (isHumanDecision(snapshot)) {
      await chooseFirstHumanAction(page, snapshot);
    } else {
      await waitForGameChange(page, snapshot.signature);
    }
  }

  throw new Error(`The game did not reach a human playing turn at round ${minimumRound} or later.`);
}

async function expectNativeModal(dialog: Locator): Promise<void> {
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveJSProperty('open', true);
  await expect(dialog).not.toHaveAttribute('data-fallback');
  expect(await dialog.evaluate((element) => element.matches(':modal'))).toBe(true);
}

async function expectDialogDescription(dialog: Locator, expected: string): Promise<void> {
  const descriptionId = await dialog.getAttribute('aria-describedby');
  expect(descriptionId).toBeTruthy();
  await expect(dialog.locator(`#${descriptionId}`)).toHaveText(expected);
}

async function expectNoDocumentOverflow(page: Page): Promise<void> {
  await expect.poll(() => page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
  )).toBe(true);
}

async function expectMinimumControlSize(page: Page): Promise<void> {
  const undersized = await page.locator('button:visible').evaluateAll((buttons) =>
    buttons
      .map((button) => {
        const rect = button.getBoundingClientRect();
        return { name: button.getAttribute('aria-label') ?? button.textContent?.trim(), width: rect.width, height: rect.height };
      })
      .filter(({ width, height }) => width < 44 || height < 44),
  );
  expect(undersized, 'visible controls smaller than 44px').toEqual([]);
}

async function expectContained(locator: Locator): Promise<void> {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  if (box === null) {
    return;
  }
  const viewportWidth = await locator.page().evaluate(() => document.documentElement.clientWidth);
  expect(box.x).toBeGreaterThanOrEqual(-0.5);
  expect(box.x + box.width).toBeLessThanOrEqual(viewportWidth + 0.5);
}

async function expectHandFitsViewport(locator: Locator): Promise<void> {
  const dimensions = await locator.evaluate((element) => ({
    clientWidth: element.clientWidth,
    overflowX: getComputedStyle(element).overflowX,
    scrollWidth: element.scrollWidth,
  }));
  expect(dimensions.overflowX).not.toBe('auto');
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
}

async function expectGameTableFitsViewport(page: Page): Promise<void> {
  const dimensions = await page.locator('.game-table').evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      bottom: rect.bottom,
      scrollHeight: document.documentElement.scrollHeight,
      viewportHeight: document.documentElement.clientHeight,
      top: rect.top,
    };
  });
  expect(dimensions.top).toBeGreaterThanOrEqual(-0.5);
  expect(dimensions.bottom).toBeLessThanOrEqual(dimensions.viewportHeight + 0.5);
  expect(dimensions.scrollHeight).toBeLessThanOrEqual(dimensions.viewportHeight);
}

function cssDurationMilliseconds(duration: string): number {
  if (duration.endsWith('ms')) {
    return Number.parseFloat(duration);
  }
  if (duration.endsWith('s')) {
    return Number.parseFloat(duration) * 1_000;
  }
  return Number.POSITIVE_INFINITY;
}

async function screenshot(page: Page, name: string): Promise<void> {
  await page.screenshot({
    path: path.join(VISUAL_REVIEW_DIR, name),
    fullPage: true,
    animations: 'disabled',
  });
}
