import { useWizardGame } from './app/useWizardGame';
import { useOnlineGame } from './app/useOnlineGame';
import { GameTable } from './components/GameTable';
import { HomeScreen } from './components/HomeScreen';
import { OnlineLobby } from './components/OnlineLobby';

export function App() {
  const game = useWizardGame();
  const online = useOnlineGame();
  const developmentSeed = developmentSeedForSearch(
    typeof window === 'undefined' ? '' : window.location.search,
    import.meta.env.DEV,
  );

  if (online.status === 'game' && online.state !== null && online.localPlayerId !== null) {
    return (
      <GameTable
        state={online.state}
        legalActions={online.legalActions}
        localPlayerId={online.localPlayerId}
        onAction={online.dispatch}
        onContinueRound={online.acknowledgeRound}
        onRestart={online.leave}
        onHome={online.leave}
        canRestartMatch={false}
      />
    );
  }

  if (online.status === 'entry' || online.status === 'lobby') {
    return (
      <OnlineLobby
        status={online.status}
        loading={online.loading}
        error={online.error}
        room={online.room}
        members={online.members}
        userId={online.userId}
        onCreate={online.createRoom}
        onJoin={online.joinRoom}
        onStart={online.startGame}
        onLeave={online.leave}
      />
    );
  }

  if (game.screen === 'game' && game.state !== null) {
    return (
      <GameTable
        state={game.state}
        legalActions={game.legalActions}
        onAction={game.dispatchHuman}
        storageWarning={game.storageWarning}
        onContinueRound={game.acknowledgeRound}
        onRestart={() => game.startGame(game.state?.difficulty ?? 'easy', developmentSeed)}
        onHome={game.abandonGame}
      />
    );
  }

  return (
    <HomeScreen
      hasSavedGame={game.hasSavedGame}
      storageWarning={game.storageWarning}
      onStart={(difficulty) => game.startGame(difficulty, developmentSeed)}
      onContinue={game.continueGame}
      onOnline={online.open}
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
