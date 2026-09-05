import { useWizardGame } from './app/useWizardGame';
import { GameTable } from './components/GameTable';
import { HomeScreen } from './components/HomeScreen';

export function App() {
  const game = useWizardGame();
  const developmentSeed = developmentSeedForSearch(
    typeof window === 'undefined' ? '' : window.location.search,
    import.meta.env.DEV,
  );

  if (game.screen === 'game' && game.state !== null) {
    return (
      <GameTable
        state={game.state}
        legalActions={game.legalActions}
        onAction={game.dispatchHuman}
        storageWarning={game.storageWarning}
        onContinueRound={game.acknowledgeRound}
        onRestart={() => game.startGame(developmentSeed)}
        onHome={game.abandonGame}
      />
    );
  }

  return (
    <HomeScreen
      hasSavedGame={game.hasSavedGame}
      storageWarning={game.storageWarning}
      onStart={() => game.startGame(developmentSeed)}
      onContinue={game.continueGame}
    />
  );
}

export function developmentSeedForSearch(
  search: string,
  enabled: boolean,
): number | undefined {
  if (!enabled) {
    return undefined;
  }

  const value = new URLSearchParams(search).get('seed');
  if (value === null || value === '' || !/^[+-]?\d+$/.test(value)) {
    return undefined;
  }

  const seed = Number(value);
  return Number.isSafeInteger(seed) ? seed : undefined;
}
