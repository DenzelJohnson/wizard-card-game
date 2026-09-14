import type { GameAction } from '../game/types';

type BidAction = Extract<GameAction, { readonly type: 'PLACE_BID' }>;

export interface BidPanelProps {
  readonly actions: readonly BidAction[];
  readonly onAction: (action: BidAction) => void;
  readonly locked?: boolean;
}

export function BidPanel({ actions, locked = false, onAction }: BidPanelProps) {
  return (
    <fieldset className="decision-panel bid-panel">
      <legend>{locked ? 'Bid locked' : 'Choose your bid'}</legend>
      {locked ? (
        <p className="bid-panel__locked" role="status">Bid locked — waiting for other players.</p>
      ) : (
        <div className="decision-panel__options">
          {actions.map((action) => (
            <button
              className="decision-button"
              key={`${action.playerId}-${action.bid}`}
              type="button"
              onClick={() => onAction(action)}
            >
              Bid {action.bid}
            </button>
          ))}
        </div>
      )}
    </fieldset>
  );
}
