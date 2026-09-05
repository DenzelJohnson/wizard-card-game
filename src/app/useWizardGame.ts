import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { chooseEasyAction } from '../ai/easy';
import { createMatch, legalActions as engineLegalActions, reduceGame } from '../game/state';
import type { GameAction, GameState } from '../game/types';
import { clearGame, loadGame, saveGame, type StorageLike } from '../storage/save';

const COMPUTER_DECISION_DELAY_MS = 450;
const TRICK_RESULT_DELAY_MS = 900;
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

export interface MotionQueryLike {
  readonly matches: boolean;
  addEventListener(type: 'change', listener: (event: { matches: boolean }) => void): void;
  removeEventListener(type: 'change', listener: (event: { matches: boolean }) => void): void;
}

export interface WizardGameOptions {
  readonly storage?: StorageLike;
  readonly seedFactory?: () => number;
  readonly matchMedia?: (query: string) => MotionQueryLike | null;
  readonly timings?: {
    readonly computerDecisionMs?: number;
    readonly trickResultMs?: number;
  };
}

export interface WizardGameController {
  readonly screen: 'home' | 'game';
  readonly state: GameState | null;
  readonly hasSavedGame: boolean;
  readonly storageWarning: boolean;
  readonly legalActions: GameAction[];
  startGame(seed?: number): void;
  continueGame(): void;
  dispatchHuman(action: GameAction): void;
  acknowledgeRound(): void;
  abandonGame(): void;
}

export function useWizardGame(options: WizardGameOptions = {}): WizardGameController {
  const [storage] = useState<StorageLike>(() => options.storage ?? browserStorage());
  const [seedFactory] = useState<() => number>(() => options.seedFactory ?? browserSeed);
  const [matchMedia] = useState<WizardGameOptions['matchMedia']>(
    () => options.matchMedia ?? browserMatchMedia,
  );
  const [computerDecisionMs] = useState(
    () => options.timings?.computerDecisionMs ?? COMPUTER_DECISION_DELAY_MS,
  );
  const [trickResultMs] = useState(
    () => options.timings?.trickResultMs ?? TRICK_RESULT_DELAY_MS,
  );
  const [screen, setScreen] = useState<'home' | 'game'>('home');
  const [state, setState] = useState<GameState | null>(null);
  const [hasSavedGame, setHasSavedGame] = useState(false);
  const [storageWarning, setStorageWarning] = useState(false);
  const resumeCandidateRef = useRef<GameState | null>(null);
  const currentStateRef = useRef<GameState | null>(null);
  const didLoadRef = useRef(false);
  const reducedMotion = useReducedMotion(matchMedia);

  useEffect(() => {
    if (didLoadRef.current) {
      return;
    }
    didLoadRef.current = true;

    const loaded = loadGame(storage);
    if (loaded.ok) {
      resumeCandidateRef.current = loaded.state;
      setHasSavedGame(true);
      return;
    }

    resumeCandidateRef.current = null;
    setHasSavedGame(false);
    if (loaded.reason === 'unavailable') {
      setStorageWarning(true);
    }
  }, [storage]);

  const persist = useCallback(
    (nextState: GameState): void => {
      const result = saveGame(storage, nextState);

      if (nextState.phase === 'match-result') {
        setHasSavedGame(false);
      } else if (result.ok) {
        setHasSavedGame(true);
      }

      setStorageWarning(!result.ok);
    },
    [storage],
  );

  const commitTransition = useCallback(
    (expectedState: GameState, nextState: GameState): boolean => {
      if (currentStateRef.current !== expectedState || nextState === expectedState) {
        return false;
      }

      currentStateRef.current = nextState;
      setState(nextState);
      persist(nextState);
      return true;
    },
    [persist],
  );

  const applyAction = useCallback(
    (expectedState: GameState, action: GameAction): boolean => {
      const nextState = reduceGame(expectedState, action);
      return commitTransition(expectedState, nextState);
    },
    [commitTransition],
  );

  useEffect(() => {
    if (screen !== 'game' || state === null) {
      return;
    }

    if (state.phase === 'round-setup') {
      applyAction(state, { type: 'DEAL_ROUND' });
      return;
    }

    if (state.phase === 'trick-result') {
      const timer = setTimeout(
        () => applyAction(state, { type: 'ACKNOWLEDGE_TRICK' }),
        reducedMotion ? 0 : trickResultMs,
      );
      return () => clearTimeout(timer);
    }

    if (isComputerDecision(state)) {
      const timer = setTimeout(
        () => {
          if (currentStateRef.current !== state) {
            return;
          }

          const choice = chooseEasyAction(state);
          if (choice === null || currentStateRef.current !== state) {
            return;
          }

          const stateWithConsumedRng = { ...state, rng: choice.rng };
          const nextState = reduceGame(stateWithConsumedRng, choice.action);
          if (nextState === stateWithConsumedRng) {
            return;
          }

          commitTransition(state, nextState);
        },
        reducedMotion ? 0 : computerDecisionMs,
      );
      return () => clearTimeout(timer);
    }
  }, [applyAction, commitTransition, computerDecisionMs, reducedMotion, screen, state, trickResultMs]);

  const startGame = useCallback(
    (seed?: number): void => {
      const nextState = createMatch(seed ?? seedFactory());

      resumeCandidateRef.current = null;
      currentStateRef.current = nextState;
      setHasSavedGame(false);
      setScreen('game');
      setState(nextState);
      persist(nextState);
    },
    [persist, seedFactory],
  );

  const continueGame = useCallback((): void => {
    const candidate = resumeCandidateRef.current;
    if (candidate === null || currentStateRef.current !== null) {
      return;
    }

    resumeCandidateRef.current = null;
    currentStateRef.current = candidate;
    setScreen('game');
    setState(candidate);
  }, []);

  const dispatchHuman = useCallback(
    (action: GameAction): void => {
      const current = currentStateRef.current;
      if (current === null || !isHumanDecision(current)) {
        return;
      }

      if (!engineLegalActions(current).some((legalAction) => actionsEqual(legalAction, action))) {
        return;
      }

      applyAction(current, action);
    },
    [applyAction],
  );

  const acknowledgeRound = useCallback((): void => {
    const current = currentStateRef.current;
    if (
      current === null ||
      current.phase !== 'round-result' ||
      !engineLegalActions(current).some((action) => action.type === 'ACKNOWLEDGE_ROUND')
    ) {
      return;
    }

    applyAction(current, { type: 'ACKNOWLEDGE_ROUND' });
  }, [applyAction]);

  const abandonGame = useCallback((): void => {
    const result = clearGame(storage);

    resumeCandidateRef.current = null;
    currentStateRef.current = null;
    setScreen('home');
    setState(null);
    setHasSavedGame(false);
    setStorageWarning(!result.ok);
  }, [storage]);

  const legalActions = useMemo(
    () => (screen === 'game' && state !== null ? engineLegalActions(state) : []),
    [screen, state],
  );

  return {
    screen,
    state,
    hasSavedGame,
    storageWarning,
    legalActions,
    startGame,
    continueGame,
    dispatchHuman,
    acknowledgeRound,
    abandonGame,
  };
}

function useReducedMotion(
  matchMedia: WizardGameOptions['matchMedia'],
): boolean {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (matchMedia === undefined) {
      return;
    }

    let query: MotionQueryLike | null;
    try {
      query = matchMedia(REDUCED_MOTION_QUERY);
    } catch {
      return;
    }

    if (query === null) {
      return;
    }

    setReducedMotion(query.matches);
    const handleChange = (event: { matches: boolean }): void => setReducedMotion(event.matches);
    query.addEventListener('change', handleChange);
    return () => query.removeEventListener('change', handleChange);
  }, [matchMedia]);

  return reducedMotion;
}

function isHumanDecision(state: GameState): boolean {
  return (
    state.activePlayerId === 'human' &&
    (state.phase === 'choose-trump' || state.phase === 'bidding' || state.phase === 'playing')
  );
}

function isComputerDecision(state: GameState): boolean {
  return (
    state.activePlayerId !== null &&
    state.activePlayerId !== 'human' &&
    (state.phase === 'choose-trump' || state.phase === 'bidding' || state.phase === 'playing')
  );
}

function actionsEqual(left: GameAction, right: GameAction): boolean {
  if (left.type !== right.type) {
    return false;
  }

  switch (left.type) {
    case 'CHOOSE_TRUMP':
      return right.type === 'CHOOSE_TRUMP' && left.playerId === right.playerId && left.suit === right.suit;
    case 'PLACE_BID':
      return right.type === 'PLACE_BID' && left.playerId === right.playerId && left.bid === right.bid;
    case 'PLAY_CARD':
      return right.type === 'PLAY_CARD' && left.playerId === right.playerId && left.cardId === right.cardId;
    case 'DEAL_ROUND':
    case 'ACKNOWLEDGE_TRICK':
    case 'ACKNOWLEDGE_ROUND':
      return true;
  }
}

function browserSeed(): number {
  const values = new Uint32Array(1);

  if (globalThis.crypto?.getRandomValues === undefined) {
    throw new Error('Secure browser randomness is unavailable.');
  }

  globalThis.crypto.getRandomValues(values);
  return values[0];
}

function browserStorage(): StorageLike {
  try {
    if (typeof window !== 'undefined' && window.localStorage !== undefined) {
      return window.localStorage;
    }
  } catch {
    // The throwing adapter below lets the normal storage boundary report unavailability.
  }

  return unavailableStorage;
}

function browserMatchMedia(query: string): MotionQueryLike | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return null;
  }

  return window.matchMedia(query) as MotionQueryLike;
}

const unavailableStorage: StorageLike = {
  getItem(): null {
    throw new Error('Browser storage is unavailable.');
  },
  setItem(): void {
    throw new Error('Browser storage is unavailable.');
  },
  removeItem(): void {
    throw new Error('Browser storage is unavailable.');
  },
};
