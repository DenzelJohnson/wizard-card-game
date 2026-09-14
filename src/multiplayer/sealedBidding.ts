import { estimateMediumBid } from '../ai/medium';
import { nextRandom } from '../game/deck';
import { nextPlayerId, reduceGame } from '../game/state';
import type { GameAction, GameState, PlayerId, RngState } from '../game/types';
import { botSeatsForHumanCount, type RoomMember } from './model';

export function sealedBidState(
  state: GameState,
  submissions: readonly GameAction[],
  members: readonly RoomMember[],
): GameState | null {
  if (state.phase !== 'bidding' || state.activePlayerId === null) return null;

  const humanBids = humanBidValues(state, submissions, members);
  if (humanBids === null) return null;

  const botBids = botBidValues(state, botSeatsForHumanCount(members.length));
  const bids = { ...humanBids, ...botBids.bids };
  let next: GameState = { ...state, rng: botBids.rng };
  let playerId = state.activePlayerId;

  for (let count = 0; count < 4; count += 1) {
    const bid = bids[playerId];
    if (bid === undefined) return null;
    const reduced = reduceGame(next, { type: 'PLACE_BID', playerId, bid });
    if (reduced === next) return null;
    next = reduced;
    playerId = nextPlayerId(playerId);
  }

  return next.phase === 'playing' && next.bids.length === 4 ? next : null;
}

function humanBidValues(
  state: GameState,
  submissions: readonly GameAction[],
  members: readonly RoomMember[],
): Partial<Record<PlayerId, number>> | null {
  const humanSeatIds = new Set(members.map(({ seat_id }) => seat_id));
  if (humanSeatIds.size !== members.length) return null;

  const bids: Partial<Record<PlayerId, number>> = {};
  for (const submission of submissions) {
    if (submission.type !== 'PLACE_BID') continue;
    if (
      !humanSeatIds.has(submission.playerId) ||
      !Number.isInteger(submission.bid) ||
      submission.bid < 0 ||
      submission.bid > state.round ||
      bids[submission.playerId] !== undefined
    ) {
      return null;
    }
    bids[submission.playerId] = submission.bid;
  }

  return [...humanSeatIds].every((playerId) => bids[playerId] !== undefined) ? bids : null;
}

function botBidValues(
  state: GameState,
  botSeatIds: readonly PlayerId[],
): { readonly bids: Partial<Record<PlayerId, number>>; readonly rng: RngState } {
  const bids: Partial<Record<PlayerId, number>> = {};
  let rng = state.rng;

  for (const playerId of botSeatIds) {
    if (state.difficulty === 'medium') {
      bids[playerId] = estimateMediumBid(state.hands[playerId], state.trump, state.round);
      continue;
    }

    const next = nextRandom(rng);
    bids[playerId] = Math.floor(next.value * (state.round + 1));
    rng = next.state;
  }

  return { bids, rng };
}
