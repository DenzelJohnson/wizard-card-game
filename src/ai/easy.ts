import { nextRandom } from '../game/deck';
import { legalActions } from '../game/state';
import type { GameAction, GameState, RngState } from '../game/types';

const COMPUTER_IDS = new Set(['ember', 'rowan', 'mira']);
const DECISION_PHASES = new Set(['choose-trump', 'bidding', 'playing']);

export function chooseEasyAction(
  state: GameState,
): { action: GameAction; rng: RngState } | null {
  if (
    state.activePlayerId === null ||
    !COMPUTER_IDS.has(state.activePlayerId) ||
    !DECISION_PHASES.has(state.phase)
  ) {
    return null;
  }

  const choices = legalActions(state);

  if (choices.length === 0) {
    return null;
  }

  const next = nextRandom(state.rng);

  return {
    action: choices[Math.floor(next.value * choices.length)] as GameAction,
    rng: next.state,
  };
}
