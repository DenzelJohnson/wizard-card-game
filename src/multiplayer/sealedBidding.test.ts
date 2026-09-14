import { describe, expect, it } from 'vitest';

import { createMatch, reduceGame } from '../game/state';
import type { GameAction, GameState } from '../game/types';
import type { RoomMember } from './model';
import { sealedBidState } from './sealedBidding';

const members: readonly RoomMember[] = [
  { room_id: 'room-1', user_id: 'host', seat_id: 'human', display_name: 'Denzel', joined_at: 'now' },
  { room_id: 'room-1', user_id: 'guest', seat_id: 'ember', display_name: 'Alex', joined_at: 'now' },
];

describe('sealed online bidding', () => {
  it('waits until every human seat has submitted one valid bid', () => {
    const state = biddingState();
    const next = sealedBidState(state, [{ type: 'PLACE_BID', playerId: 'human', bid: 1 }], members);

    expect(next).toBeNull();
  });

  it('reveals every human and computer bid together after the final human submission', () => {
    const state = biddingState();
    const submissions: readonly GameAction[] = [
      { type: 'PLACE_BID', playerId: 'human', bid: 1 },
      { type: 'PLACE_BID', playerId: 'ember', bid: 0 },
    ];

    const next = sealedBidState(state, submissions, members);

    expect(next?.phase).toBe('playing');
    expect(next?.bids).toHaveLength(4);
    expect(next?.bids.map(({ playerId }) => playerId).sort()).toEqual([
      'ember', 'human', 'mira', 'rowan',
    ]);
    expect(next?.bids).toEqual(expect.arrayContaining([
      { playerId: 'human', bid: 1 },
      { playerId: 'ember', bid: 0 },
    ]));
  });

  it('rejects a duplicate or non-member bid submission', () => {
    const state = biddingState();
    const next = sealedBidState(state, [
      { type: 'PLACE_BID', playerId: 'human', bid: 1 },
      { type: 'PLACE_BID', playerId: 'human', bid: 0 },
      { type: 'PLACE_BID', playerId: 'ember', bid: 0 },
      { type: 'PLACE_BID', playerId: 'rowan', bid: 2 },
    ], members);

    expect(next).toBeNull();
  });
});

function biddingState(): GameState {
  for (let seed = 1; seed < 200; seed += 1) {
    const initial = { ...createMatch(seed), round: 2 };
    const dealt = reduceGame(initial, { type: 'DEAL_ROUND' });
    if (dealt.phase === 'bidding') return dealt;
  }

  throw new Error('Unable to create a bidding state.');
}
