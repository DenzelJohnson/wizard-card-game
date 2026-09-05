import type { GameAction } from '../game/types';
import { suitName, suitSymbol } from './PlayingCard';

type TrumpAction = Extract<GameAction, { readonly type: 'CHOOSE_TRUMP' }>;

export interface TrumpPanelProps {
  readonly actions: readonly TrumpAction[];
  readonly onAction: (action: TrumpAction) => void;
}

export function TrumpPanel({ actions, onAction }: TrumpPanelProps) {
  return (
    <fieldset className="decision-panel trump-panel">
      <legend>Choose trump</legend>
      {actions.map((action) => (
        <button key={action.suit} type="button" onClick={() => onAction(action)}>
          {suitSymbol(action.suit)} {suitName(action.suit)}
        </button>
      ))}
    </fieldset>
  );
}
