import type { Card, GameAction, GameState, PlayerId, PlayerMetadata, Suit } from '../game/types';
import { BidPanel } from './BidPanel';
import { PlayerSeat, type SeatPosition } from './PlayerSeat';
import { cardName, PlayingCard, suitName, suitSymbol } from './PlayingCard';
import { StorageWarning } from './StorageWarning';
import { TrickArea } from './TrickArea';
import { TrumpPanel } from './TrumpPanel';

export interface GameTableProps {
  readonly state: GameState;
  readonly legalActions: readonly GameAction[];
  readonly onAction: (action: GameAction) => void;
  readonly storageWarning?: boolean;
}

const SEAT_POSITIONS: Readonly<Record<PlayerId, SeatPosition>> = {
  human: 'bottom',
  ember: 'left',
  rowan: 'top',
  mira: 'right',
};

export function GameTable({
  state,
  legalActions,
  onAction,
  storageWarning = false,
}: GameTableProps) {
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

  return (
    <main className="game-table" aria-labelledby="game-table-heading">
      <header className="table-status">
        <h1 id="game-table-heading">Wizard game table</h1>
        <p>Round {state.round} of 15</p>
        <p role="status" aria-live="polite">
          {phasePrompt(state)}
        </p>
        {storageWarning ? <StorageWarning /> : null}
        <TrumpDisplay state={state} />
      </header>

      <TrickArea plays={state.currentTrick} players={state.players} />

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
            {state.hands.human.map((card) => {
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
    />
  );
}

function TrumpDisplay({ state }: { readonly state: GameState }) {
  const dealerChoosing = state.phase === 'choose-trump' && state.trump === null;
  const trumpText = dealerChoosing
    ? 'Dealer choosing'
    : state.trump === null
      ? 'No trump'
      : `${suitSymbol(state.trump)} ${suitName(state.trump)}`;

  return (
    <section className="trump-area" aria-label="Trump">
      <h2>Trump: {trumpText}</h2>
      <p>{upCardContext(state.revealedUpCard, state.trump, dealerChoosing)}</p>
    </section>
  );
}

function upCardContext(card: Card | null, trump: Suit | null, dealerChoosing: boolean): string {
  if (card === null) {
    return 'No up card this round.';
  }
  if (card.kind === 'wizard') {
    if (dealerChoosing) {
      return 'Revealed Wizard — dealer chooses trump.';
    }
    return trump === null
      ? 'Revealed Wizard.'
      : `Revealed Wizard — dealer chose ${suitName(trump)}.`;
  }

  return `Up card: ${cardName(card)}`;
}

function phasePrompt(state: GameState): string {
  const activeName = state.players.find((player) => player.id === state.activePlayerId)?.name;

  switch (state.phase) {
    case 'round-setup':
      return 'Dealing round…';
    case 'choose-trump':
      return state.activePlayerId === 'human'
        ? 'Choose a trump suit.'
        : `${activeName ?? 'Computer'} is choosing trump…`;
    case 'bidding':
      return state.activePlayerId === 'human'
        ? 'Choose your bid.'
        : `${activeName ?? 'Computer'} is bidding…`;
    case 'playing':
      return state.activePlayerId === 'human'
        ? state.currentTrick.length === 0
          ? 'Lead a card.'
          : 'Play a card.'
        : `${activeName ?? 'Computer'} is playing…`;
    case 'trick-result':
      return `${activeName ?? 'A player'} won the trick.`;
    case 'round-result':
      return `Round ${state.round} complete.`;
    case 'match-result':
      return 'Match complete.';
  }
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
