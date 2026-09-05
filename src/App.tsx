import { useWizardGame } from './app/useWizardGame';
import { GameTable } from './components/GameTable';
import { HomeScreen } from './components/HomeScreen';

export function App() {
  const game = useWizardGame();

  if (game.screen === 'game' && game.state !== null) {
    return (
      <GameTable
        state={game.state}
        legalActions={game.legalActions}
        onAction={game.dispatchHuman}
        storageWarning={game.storageWarning}
      />
    );
  }

  return (
    <HomeScreen
      hasSavedGame={game.hasSavedGame}
      storageWarning={game.storageWarning}
      onStart={() => game.startGame()}
      onContinue={game.continueGame}
    />
  );
}
