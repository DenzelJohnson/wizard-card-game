import type { GameAction } from '../game/types';

type BidAction = Extract<GameAction, { readonly type: 'PLACE_BID' }>;

export interface BidPanelProps {
  readonly actions: readonly BidAction[];
  readonly onAction: (action: BidAction) => void;
}

export function BidPanel({ actions, onAction }: BidPanelProps) {
  return (
    <fieldset className="decision-panel bid-panel">
      <legend>Choose your bid</legend>
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
    </fieldset>
  );
}
