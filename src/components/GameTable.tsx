import { useEffect, useRef } from 'react';

import {
  useSounds,
  type SoundController,
  type SoundControllerOptions,
} from '../audio/sounds';
import type { Card, GameAction, GameState, PlayerId, PlayerMetadata } from '../game/types';
import { BidPanel } from './BidPanel';
import { GameMenu } from './GameMenu';
import { MatchResult } from './MatchResult';
import { PlayerSeat, type SeatPosition } from './PlayerSeat';
import { PlayingCard } from './PlayingCard';
import { RoundSummary } from './RoundSummary';
import { StorageWarning } from './StorageWarning';
import { TrickArea } from './TrickArea';
import { TrumpPanel } from './TrumpPanel';

export interface GameTableProps {
  readonly state: GameState;
  readonly legalActions: readonly GameAction[];
  readonly onAction: (action: GameAction) => void;
  readonly storageWarning?: boolean;
  readonly onContinueRound?: () => void;
  readonly onRestart?: () => void;
  readonly onHome?: () => void;
  readonly sounds?: SoundController;
  readonly soundOptions?: SoundControllerOptions;
}

const SEAT_POSITIONS: Readonly<Record<PlayerId, SeatPosition>> = {
  human: 'bottom',
  ember: 'left',
  rowan: 'top',
  mira: 'right',
};

const HAND_SUIT_ORDER = { spades: 0, hearts: 1, clubs: 2, diamonds: 3 } as const;

export function GameTable({
  state,
  legalActions,
  onAction,
  storageWarning = false,
  onContinueRound = doNothing,
  onRestart = doNothing,
  onHome = doNothing,
  sounds,
  soundOptions,
}: GameTableProps) {
  const browserSounds = useSounds(soundOptions);
  const activeSounds = sounds ?? browserSounds;
  const previousAudioStateRef = useRef(audioSnapshot(state));
  const human = state.players.find((player) => player.id === 'human');
  const opponents = state.players.filter((player) => player.id !== 'human');
  const activeDecisionPlayerId = isDecisionPhase(state.phase) ? state.activePlayerId : null;
  const trickWinnerId = state.phase === 'trick-result' ? state.activePlayerId : null;
  const leaderId =
    state.currentTrick[0]?.playerId ??
    (state.phase === 'playing' && state.currentTrick.length === 0 ? state.activePlayerId : null);
  const bidActions =
    state.phase === 'bidding' && state.activePlayerId === 'human'
      ? legalActions.filter(isHumanBidAction)
      : [];
  const trumpActions =
    state.phase === 'choose-trump' && state.activePlayerId === 'human'
      ? legalActions.filter(isHumanTrumpAction)
      : [];

  useEffect(() => {
    const previous = previousAudioStateRef.current;
    const current = audioSnapshot(state);
    previousAudioStateRef.current = current;

    if (previous.matchId !== current.matchId) {
      return;
    }
    if (current.playCount > previous.playCount) {
      activeSounds.play('card');
    }
    if (current.phase !== previous.phase && current.phase === 'trick-result') {
      activeSounds.play('trick');
    }
    if (
      current.phase !== previous.phase &&
      (current.phase === 'round-result' || current.phase === 'match-result')
    ) {
      activeSounds.play('round');
    }
  }, [activeSounds, state]);

  if (state.phase === 'round-result') {
    return (
      <main
        className="game-table game-table--result-screen"
        aria-labelledby="round-summary-title"
        data-testid="game-state"
        data-phase={state.phase}
        data-round={state.round}
        data-active-player={state.activePlayerId ?? 'none'}
      >
        {storageWarning ? <StorageWarning /> : null}
        <RoundSummary state={state} onContinue={onContinueRound} />
        <GameMenu
          state={state}
          soundEnabled={activeSounds.enabled}
          onToggleSound={activeSounds.toggle}
          onRestart={onRestart}
          onHome={onHome}
        />
      </main>
    );
  }

  if (state.phase === 'match-result') {
    return (
      <main
        className="game-table game-table--result-screen"
        aria-labelledby="match-result-title"
        data-testid="game-state"
        data-phase={state.phase}
        data-round={state.round}
        data-active-player={state.activePlayerId ?? 'none'}
      >
        {storageWarning ? <StorageWarning /> : null}
        <MatchResult state={state} onNewMatch={onRestart} onHome={onHome} />
      </main>
    );
  }

  return (
    <main
      className="game-table"
      aria-labelledby="game-table-heading"
      data-testid="game-state"
      data-phase={state.phase}
      data-round={state.round}
      data-active-player={state.activePlayerId ?? 'none'}
    >
      <h1 id="game-table-heading" className="sr-only">Wizard game table</h1>
      {storageWarning ? (
        <aside className="table-status table-status--notice-only" aria-label="Save status">
          <StorageWarning />
        </aside>
      ) : null}

      <GameMenu
        state={state}
        soundEnabled={activeSounds.enabled}
        onToggleSound={activeSounds.toggle}
        onRestart={onRestart}
        onHome={onHome}
      />

      <TrickArea
        plays={state.currentTrick}
        players={state.players}
        revealedUpCard={state.revealedUpCard}
        trump={state.trump}
        dealerChoosingTrump={state.phase === 'choose-trump' && state.trump === null}
        dealerPosition={SEAT_POSITIONS[state.dealerId]}
      />

      {bidActions.length > 0 || trumpActions.length > 0 ? (
        <section className="decision-area" aria-label="Your decision">
          {bidActions.length > 0 ? <BidPanel actions={bidActions} onAction={onAction} /> : null}
          {trumpActions.length > 0 ? (
            <TrumpPanel actions={trumpActions} onAction={onAction} />
          ) : null}
        </section>
      ) : null}

      {human ? (
        <section className="human-area" aria-label="Your hand and seat">
          <PlayerSeat
            player={human}
            position={SEAT_POSITIONS.human}
            score={state.scores.human}
            bid={bidFor(state, 'human')}
            tricksWon={state.tricksWon.human}
            dealer={state.dealerId === 'human'}
            active={activeDecisionPlayerId === 'human'}
            leader={leaderId === 'human'}
            winner={trickWinnerId === 'human'}
          />
          <div
            className="human-hand"
            role="group"
            aria-label={`Your hand, ${state.hands.human.length} ${
              state.hands.human.length === 1 ? 'card' : 'cards'
            }`}
          >
            {sortHandForDisplay(state.hands.human).map((card) => {
              const action = humanPlayAction(card, state, legalActions);
              const canPlayNow = state.phase === 'playing' && state.activePlayerId === 'human';

              return (
                <PlayingCard
                  key={card.id}
                  card={card}
                  playable={action !== undefined}
                  disabledReason={canPlayNow ? 'must follow suit' : 'wait for your turn'}
                  onPlay={() => {
                    if (action !== undefined) {
                      onAction(action);
                    }
                  }}
                />
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="opponent-seats" aria-label="Opponent summaries">
        {opponents.map((player) => (
          <Seat
            key={player.id}
            player={player}
            state={state}
            activeDecisionPlayerId={activeDecisionPlayerId}
            leaderId={leaderId}
            trickWinnerId={trickWinnerId}
            hiddenCardCount={state.hands[player.id].length}
          />
        ))}
      </section>
    </main>
  );
}

export function sortHandForDisplay(hand: readonly Card[]): Card[] {
  return [...hand].sort((left, right) => {
    const leftGroup =
      left.kind === 'suited' ? HAND_SUIT_ORDER[left.suit] : left.kind === 'wizard' ? 4 : 5;
    const rightGroup =
      right.kind === 'suited' ? HAND_SUIT_ORDER[right.suit] : right.kind === 'wizard' ? 4 : 5;
    if (leftGroup !== rightGroup) return leftGroup - rightGroup;
    if (left.kind === 'suited' && right.kind === 'suited' && left.rank !== right.rank) {
      return right.rank - left.rank;
    }
    return left.id.localeCompare(right.id);
  });
}

function audioSnapshot(state: GameState): {
  readonly matchId: string;
  readonly phase: GameState['phase'];
  readonly playCount: number;
} {
  return {
    matchId: state.matchId,
    phase: state.phase,
    playCount:
      state.currentTrick.length +
      state.completedTricks.reduce((total, trick) => total + trick.plays.length, 0),
  };
}

function doNothing(): void {}

function Seat({
  player,
  state,
  activeDecisionPlayerId,
  leaderId,
  trickWinnerId,
  hiddenCardCount,
}: {
  readonly player: PlayerMetadata;
  readonly state: GameState;
  readonly activeDecisionPlayerId: PlayerId | null;
  readonly leaderId: PlayerId | null;
  readonly trickWinnerId: PlayerId | null;
  readonly hiddenCardCount: number;
}) {
  return (
    <PlayerSeat
      player={player}
      position={SEAT_POSITIONS[player.id]}
      score={state.scores[player.id]}
      bid={bidFor(state, player.id)}
      tricksWon={state.tricksWon[player.id]}
      dealer={state.dealerId === player.id}
      active={activeDecisionPlayerId === player.id}
      leader={leaderId === player.id}
      winner={trickWinnerId === player.id}
      hiddenCardCount={hiddenCardCount}
      externalRoundStats
    />
  );
}

function isDecisionPhase(phase: GameState['phase']): boolean {
  return phase === 'choose-trump' || phase === 'bidding' || phase === 'playing';
}

function bidFor(state: GameState, playerId: PlayerId): number | undefined {
  return state.bids.find((record) => record.playerId === playerId)?.bid;
}

function humanPlayAction(
  card: Card,
  state: GameState,
  legalActions: readonly GameAction[],
): Extract<GameAction, { readonly type: 'PLAY_CARD' }> | undefined {
  if (state.phase !== 'playing' || state.activePlayerId !== 'human') {
    return undefined;
  }

  return legalActions.find(
    (action): action is Extract<GameAction, { readonly type: 'PLAY_CARD' }> =>
      action.type === 'PLAY_CARD' && action.playerId === 'human' && action.cardId === card.id,
  );
}

function isHumanBidAction(
  action: GameAction,
): action is Extract<GameAction, { readonly type: 'PLACE_BID' }> {
  return action.type === 'PLACE_BID' && action.playerId === 'human';
}

function isHumanTrumpAction(
  action: GameAction,
): action is Extract<GameAction, { readonly type: 'CHOOSE_TRUMP' }> {
  return action.type === 'CHOOSE_TRUMP' && action.playerId === 'human';
}
