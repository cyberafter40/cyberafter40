import { GameSession } from '@/engine/session';
import { listGameModules, registerGameModule, tryGetGameModule } from '@/engine/registry';
import { registerAllGameModules } from '@/games';
import type { NumberLogicState } from '@/games/numberLogic/engine';

registerAllGameModules();

function newSession(overrides: Partial<ConstructorParameters<typeof GameSession>[0]> = {}) {
  let clock = 1_000_000;
  return new GameSession({
    sessionId: 'test-session',
    moduleId: 'number-logic',
    variantId: 'two-digit',
    mode: 'classic',
    seed: 'session-seed',
    now: () => (clock += 1_000),
    ...overrides,
  });
}

describe('registry', () => {
  it('registers the flagship module plus the roadmap placeholders', () => {
    expect(tryGetGameModule('number-logic')?.status).toBe('live');
    expect(listGameModules().length).toBeGreaterThan(1);
    expect(listGameModules().filter((m) => m.status === 'coming_soon').length).toBeGreaterThan(0);
  });

  it('refuses duplicate ids', () => {
    const existing = tryGetGameModule('number-logic')!;
    expect(() => registerGameModule(existing)).toThrow(/already registered/);
  });

  it('gives a helpful error for an unknown module', () => {
    expect(() => new GameSession({
      sessionId: 'x',
      moduleId: 'does-not-exist',
      variantId: 'v',
      mode: 'classic',
      seed: 's',
    })).toThrow(/Unknown game module/);
  });
});

describe('GameSession', () => {
  it('drives an engine without knowing its rules', () => {
    const session = newSession();
    const secret = session.getState<NumberLogicState>().secret;

    expect(session.status).toBe('in_progress');
    expect(session.submit({ guess: secret }).terminal).toBe(true);
    expect(session.status).toBe('won');
    expect(session.revealSolution()).toBe(secret);
  });

  it('records a label and relative timestamp for every accepted move', () => {
    const session = newSession();
    session.submit({ guess: '12' });

    const [record] = session.history;
    expect(record?.index).toBe(0);
    expect(record?.label).toMatch(/^12 → /);
    expect(record?.atMs).toBeGreaterThan(0);
  });

  it('does not record rejected moves', () => {
    const session = newSession();
    const outcome = session.submit({ guess: '1' });

    expect(outcome.accepted).toBe(false);
    expect(outcome.validation.code).toBe('malformed');
    expect(session.history).toHaveLength(0);
  });

  it('refuses to produce a result while still in progress', () => {
    expect(() => newSession().toResult()).toThrow(/still in progress/);
  });

  it('produces a transport-ready result once finished', () => {
    const session = newSession({ mode: 'daily', challengeId: '2026-08-01' });
    session.submit({ guess: session.getState<NumberLogicState>().secret });

    const result = session.toResult();
    expect(result.mode).toBe('daily');
    expect(result.challengeId).toBe('2026-08-01');
    expect(result.outcome.status).toBe('won');
    expect(result.outcome.movesUsed).toBe(1);
    expect(result.moves).toHaveLength(1);
    // Must survive a round trip to Firestore and back.
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });

  it('closes out an abandoned game', () => {
    const session = newSession();
    session.submit({ guess: '12' });
    session.abandon();

    expect(session.isOver).toBe(true);
    expect(session.toResult().outcome.status).toBe('abandoned');
  });

  it('rejects moves after the game has ended', () => {
    const session = newSession();
    session.submit({ guess: session.getState<NumberLogicState>().secret });

    const late = session.submit({ guess: '99' });
    expect(late.accepted).toBe(false);
    expect(late.validation.code).toBe('game_over');
  });
});
