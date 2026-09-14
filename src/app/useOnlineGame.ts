import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { chooseEasyAction } from '../ai/easy';
import { chooseMediumAction } from '../ai/medium';
import { createMatch, legalActions as engineLegalActions, reduceGame } from '../game/state';
import type { GameAction, GameState, PlayerId } from '../game/types';
import { createSupabaseBackend, multiplayerErrorMessage, type OnlineBackend } from '../multiplayer/backend';
import {
  actionBelongsToSeat,
  botSeatsForHumanCount,
  playerStatePayloads,
  stateWithRoomMembers,
  type RoomMember,
} from '../multiplayer/model';
import { sealedBidState } from '../multiplayer/sealedBidding';
import type { CreateRoomInput, JoinRoomInput, OnlineGameController, WizardRoom } from '../multiplayer/types';

const DECISION_DELAY_MS = 450;
const PLAY_DELAY_MS = 700;
const TRICK_DELAY_MS = 900;
const RECONCILE_DELAY_MS = 4_000;
const MAX_HOST_RETRIES = 2;

interface OnlineGameOptions {
  readonly backend?: OnlineBackend;
  readonly seedFactory?: () => number;
  readonly timings?: {
    readonly decisionMs?: number;
    readonly playMs?: number;
    readonly trickMs?: number;
    readonly reconcileMs?: number;
  };
}

export function useOnlineGame(options: OnlineGameOptions = {}): OnlineGameController {
  const [backend] = useState(() => options.backend ?? createSupabaseBackend());
  const [seedFactory] = useState(() => options.seedFactory ?? browserSeed);
  const decisionMs = options.timings?.decisionMs ?? DECISION_DELAY_MS;
  const playMs = options.timings?.playMs ?? PLAY_DELAY_MS;
  const trickMs = options.timings?.trickMs ?? TRICK_DELAY_MS;
  const reconcileMs = options.timings?.reconcileMs ?? RECONCILE_DELAY_MS;
  const [status, setStatus] = useState<OnlineGameController['status']>('closed');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [room, setRoomState] = useState<WizardRoom | null>(null);
  const [members, setMembersState] = useState<readonly RoomMember[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [localPlayerId, setLocalPlayerId] = useState<PlayerId | null>(null);
  const [state, setState] = useState<GameState | null>(null);
  const [bidLocked, setBidLockedState] = useState(false);
  const roomRef = useRef<WizardRoom | null>(null);
  const membersRef = useRef<readonly RoomMember[]>([]);
  const userIdRef = useRef<string | null>(null);
  const localPlayerIdRef = useRef<PlayerId | null>(null);
  const authoritativeStateRef = useRef<GameState | null>(null);
  const revisionRef = useRef(0);
  const committingRef = useRef(false);
  const pendingGuestActionRef = useRef(false);
  const pendingGuestTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bidLockedRef = useRef(false);
  const bidLockRefreshGenerationRef = useRef(0);
  const subscriptionGenerationRef = useRef(0);
  const sessionGenerationRef = useRef(0);
  const roomRefreshGenerationRef = useRef(0);
  const membersRefreshGenerationRef = useRef(0);
  const commitGenerationRef = useRef(0);
  const hostRetryCountRef = useRef(0);
  const reconcileHostRef = useRef<() => void>(() => undefined);

  const clearPendingGuestAction = useCallback(() => {
    pendingGuestActionRef.current = false;
    if (pendingGuestTimerRef.current !== null) {
      clearTimeout(pendingGuestTimerRef.current);
      pendingGuestTimerRef.current = null;
    }
  }, []);

  const setBidLocked = useCallback((next: boolean) => {
    bidLockedRef.current = next;
    setBidLockedState(next);
  }, []);

  const setRoom = useCallback((next: WizardRoom | null) => {
    roomRef.current = next;
    if (next !== null) revisionRef.current = next.revision;
    setRoomState(next);
  }, []);
  const setMembers = useCallback((next: readonly RoomMember[]) => {
    membersRef.current = next;
    setMembersState(next);
  }, []);

  const clearOnline = useCallback(() => {
    roomRef.current = null;
    membersRef.current = [];
    userIdRef.current = null;
    localPlayerIdRef.current = null;
    authoritativeStateRef.current = null;
    revisionRef.current = 0;
    committingRef.current = false;
    clearPendingGuestAction();
    bidLockRefreshGenerationRef.current += 1;
    setBidLocked(false);
    subscriptionGenerationRef.current += 1;
    sessionGenerationRef.current += 1;
    roomRefreshGenerationRef.current += 1;
    membersRefreshGenerationRef.current += 1;
    commitGenerationRef.current += 1;
    hostRetryCountRef.current = 0;
    setRoomState(null);
    setMembersState([]);
    setUserId(null);
    setLocalPlayerId(null);
    setState(null);
    setError(null);
    setLoading(false);
  }, [clearPendingGuestAction, setBidLocked]);

  const refreshMembers = useCallback(async () => {
    const currentRoom = roomRef.current;
    const currentUserId = userIdRef.current;
    if (currentRoom === null || currentUserId === null) return;
    const generation = membersRefreshGenerationRef.current + 1;
    membersRefreshGenerationRef.current = generation;
    try {
      const nextMembers = await backend.loadMembers(currentRoom.id);
      if (
        membersRefreshGenerationRef.current !== generation ||
        roomRef.current?.id !== currentRoom.id || userIdRef.current !== currentUserId
      ) return;
      setMembers(nextMembers);
    } catch (reason) {
      if (roomRef.current?.id === currentRoom.id && userIdRef.current === currentUserId) {
        setError(multiplayerErrorMessage(reason));
      }
    }
  }, [backend, setMembers]);

  const refreshRoom = useCallback(async () => {
    const currentRoom = roomRef.current;
    const currentUserId = userIdRef.current;
    if (currentRoom === null || currentUserId === null) return;
    const generation = roomRefreshGenerationRef.current + 1;
    roomRefreshGenerationRef.current = generation;
    try {
      const nextRoom = await backend.loadRoom(currentRoom.id);
      if (
        roomRefreshGenerationRef.current !== generation || nextRoom.revision < revisionRef.current ||
        roomRef.current?.id !== currentRoom.id || userIdRef.current !== currentUserId
      ) return;
      setRoom(nextRoom);
      if (nextRoom.status !== 'lobby' && nextRoom.host_user_id !== currentUserId) {
        const playerState = await backend.loadPlayerState(nextRoom.id, currentUserId);
        if (
          roomRefreshGenerationRef.current !== generation ||
          roomRef.current?.id !== currentRoom.id || userIdRef.current !== currentUserId ||
          (playerState !== null && playerState.revision < revisionRef.current)
        ) return;
        if (playerState !== null) {
          revisionRef.current = playerState.revision;
          clearPendingGuestAction();
          setState(playerState.state);
          setStatus('game');
        }
      }
    } catch (reason) {
      if (roomRef.current?.id === currentRoom.id && userIdRef.current === currentUserId) {
        setError(multiplayerErrorMessage(reason));
      }
    }
  }, [backend, clearPendingGuestAction, setRoom]);

  const commitHostState = useCallback(async (expectedState: GameState | null, nextState: GameState) => {
    const currentRoom = roomRef.current;
    const currentUserId = userIdRef.current;
    if (currentRoom === null || currentUserId !== currentRoom.host_user_id || committingRef.current) return;
    if (expectedState !== null && authoritativeStateRef.current !== expectedState) return;
    const sessionGeneration = sessionGenerationRef.current;
    const expectedRevision = revisionRef.current;
    const commitGeneration = commitGenerationRef.current + 1;
    commitGenerationRef.current = commitGeneration;
    committingRef.current = true;
    const namedState = stateWithRoomMembers(nextState, membersRef.current);
    try {
      const revision = await backend.commitState(
        currentRoom.id,
        expectedRevision,
        namedState,
        playerStatePayloads(namedState, membersRef.current),
      );
      if (
        sessionGenerationRef.current !== sessionGeneration ||
        commitGenerationRef.current !== commitGeneration ||
        roomRef.current?.id !== currentRoom.id || userIdRef.current !== currentUserId ||
        (revisionRef.current !== expectedRevision && revisionRef.current !== revision)
      ) return;
      revisionRef.current = revision;
      authoritativeStateRef.current = namedState;
      setRoom({ ...currentRoom, revision, status: namedState.phase === 'match-result' ? 'finished' : 'playing' });
      setState(namedState);
      setStatus('game');
      setError(null);
      hostRetryCountRef.current = 0;
    } catch (reason) {
      if (
        sessionGenerationRef.current !== sessionGeneration ||
        commitGenerationRef.current !== commitGeneration ||
        roomRef.current?.id !== currentRoom.id || userIdRef.current !== currentUserId
      ) return;
      setError(multiplayerErrorMessage(reason));
      if (hostRetryCountRef.current < MAX_HOST_RETRIES) {
        hostRetryCountRef.current += 1;
        setTimeout(() => reconcileHostRef.current(), reconcileMs);
      } else {
        void refreshRoom();
      }
    } finally {
      if (commitGenerationRef.current === commitGeneration) committingRef.current = false;
    }
  }, [backend, reconcileMs, refreshRoom, setRoom]);

  const applyHostAction = useCallback((action: GameAction, expectedRevision = revisionRef.current) => {
    const current = authoritativeStateRef.current;
    if (current === null || expectedRevision !== revisionRef.current) return;
    if (!engineLegalActions(current).some((candidate) => actionsEqual(candidate, action))) return;
    const next = reduceGame(current, action);
    if (next !== current) void commitHostState(current, next);
  }, [commitHostState]);

  const reconcileHost = useCallback(async () => {
    const currentRoom = roomRef.current;
    const currentUserId = userIdRef.current;
    if (currentRoom === null || currentUserId !== currentRoom.host_user_id || committingRef.current) return;
    const sessionGeneration = sessionGenerationRef.current;
    try {
      const [nextRoom, saved] = await Promise.all([
        backend.loadRoom(currentRoom.id),
        backend.loadHostState(currentRoom.id),
      ]);
      if (
        sessionGenerationRef.current !== sessionGeneration ||
        roomRef.current?.id !== currentRoom.id || userIdRef.current !== currentUserId
      ) return;
      setRoom(nextRoom);
      if (saved !== null) {
        revisionRef.current = saved.revision;
        authoritativeStateRef.current = saved.state;
        setState(saved.state);
        setStatus('game');
      }
      const authoritative = authoritativeStateRef.current;
      if (authoritative === null) return;
      const revision = revisionRef.current;
      const pending = await backend.loadPendingActions(currentRoom.id, revision);
      if (
        sessionGenerationRef.current !== sessionGeneration || revisionRef.current !== revision ||
        authoritativeStateRef.current !== authoritative || roomRef.current?.id !== currentRoom.id ||
        userIdRef.current !== currentUserId
      ) return;
      const valid = pending.find(({ action, expectedRevision }) =>
        expectedRevision === revision &&
        action.type !== 'PLACE_BID' &&
        engineLegalActions(authoritative).some((candidate) => actionsEqual(candidate, action)),
      );
      const sealed = sealedBidState(authoritative, pending.map(({ action }) => action), membersRef.current);
      if (sealed !== null) {
        void commitHostState(authoritative, sealed);
        return;
      }
      if (valid !== undefined) applyHostAction(valid.action, valid.expectedRevision);
    } catch (reason) {
      setError(multiplayerErrorMessage(reason));
    }
  }, [applyHostAction, backend, commitHostState, setRoom]);
  reconcileHostRef.current = () => { void reconcileHost(); };

  const enterRoom = useCallback(async (operation: () => Promise<{ roomId: string; seatId: PlayerId }>) => {
    const generation = sessionGenerationRef.current + 1;
    sessionGenerationRef.current = generation;
    setLoading(true);
    setError(null);
    try {
      const identity = await backend.ensureUser();
      if (sessionGenerationRef.current !== generation) return;
      const joined = await operation();
      if (sessionGenerationRef.current !== generation) {
        void backend.leaveRoom(joined.roomId).catch(() => undefined);
        return;
      }
      userIdRef.current = identity;
      localPlayerIdRef.current = joined.seatId;
      setUserId(identity);
      setLocalPlayerId(joined.seatId);
      const [nextRoom, nextMembers] = await Promise.all([
        backend.loadRoom(joined.roomId),
        backend.loadMembers(joined.roomId),
      ]);
      if (sessionGenerationRef.current !== generation) return;
      setRoom(nextRoom);
      setMembers(nextMembers);
      if (nextRoom.status === 'lobby') {
        setStatus('lobby');
      } else if (nextRoom.host_user_id === identity) {
        const saved = await backend.loadHostState(nextRoom.id);
        if (
          sessionGenerationRef.current !== generation || roomRef.current?.id !== nextRoom.id ||
          userIdRef.current !== identity || (saved !== null && saved.revision < revisionRef.current)
        ) return;
        if (saved !== null) {
          authoritativeStateRef.current = saved.state;
          revisionRef.current = saved.revision;
          setState(saved.state);
          setStatus('game');
        }
      } else {
        const saved = await backend.loadPlayerState(nextRoom.id, identity);
        if (
          sessionGenerationRef.current !== generation || roomRef.current?.id !== nextRoom.id ||
          userIdRef.current !== identity || (saved !== null && saved.revision < revisionRef.current)
        ) return;
        if (saved !== null) {
          revisionRef.current = saved.revision;
          setState(saved.state);
          setStatus('game');
        }
      }
    } catch (reason) {
      if (sessionGenerationRef.current === generation) setError(multiplayerErrorMessage(reason));
    } finally {
      if (sessionGenerationRef.current === generation) setLoading(false);
    }
  }, [backend, setMembers, setRoom]);

  const subscriptionEnabled = status === 'lobby' || status === 'game';

  useEffect(() => {
    const currentRoom = roomRef.current;
    if (currentRoom === null || userId === null || !subscriptionEnabled) return;
    const generation = subscriptionGenerationRef.current + 1;
    subscriptionGenerationRef.current = generation;
    const isCurrent = (): boolean =>
      subscriptionGenerationRef.current === generation &&
      roomRef.current?.id === currentRoom.id && userIdRef.current === userId;
    const unsubscribe = backend.subscribe(currentRoom.id, userId, currentRoom.host_user_id === userId, {
      onRoomChanged: () => { if (isCurrent()) void refreshRoom(); },
      onMembersChanged: () => { if (isCurrent()) void refreshMembers(); },
      onPlayerState: (nextState, revision) => {
        if (!isCurrent() || currentRoom.host_user_id === userId || revision < revisionRef.current) return;
        revisionRef.current = revision;
        clearPendingGuestAction();
        setState(nextState);
        setStatus('game');
        setRoomState((current) => current === null ? current : { ...current, revision });
      },
      onAction: (action, expectedRevision) => {
        if (!isCurrent()) return;
        if (action.type === 'PLACE_BID') {
          void reconcileHost();
          return;
        }
        applyHostAction(action, expectedRevision);
      },
      onConnection: (connected) => {
        if (!connected || !isCurrent()) return;
        setError(null);
        void refreshRoom();
        void refreshMembers();
        if (currentRoom.host_user_id === userId && authoritativeStateRef.current !== null) {
          void reconcileHost();
        }
      },
    });
    return () => {
      if (subscriptionGenerationRef.current === generation) subscriptionGenerationRef.current += 1;
      unsubscribe();
    };
  }, [applyHostAction, backend, clearPendingGuestAction, reconcileHost, refreshMembers, refreshRoom, subscriptionEnabled, userId]);

  useEffect(() => {
    const currentRoom = roomRef.current;
    const current = state;
    const currentUserId = userIdRef.current;
    const seatId = localPlayerIdRef.current;
    const generation = bidLockRefreshGenerationRef.current + 1;
    bidLockRefreshGenerationRef.current = generation;

    if (
      status !== 'game' || currentRoom === null || current === null || currentUserId === null ||
      seatId === null || current.phase !== 'bidding'
    ) {
      setBidLocked(false);
      return;
    }

    const revision = revisionRef.current;
    void backend.hasBidLock(currentRoom.id, revision).then((locked) => {
      if (
        bidLockRefreshGenerationRef.current !== generation || roomRef.current?.id !== currentRoom.id ||
        userIdRef.current !== currentUserId || localPlayerIdRef.current !== seatId ||
        revisionRef.current !== revision || authoritativeStateRef.current?.phase === 'playing'
      ) return;
      setBidLocked(locked);
    }).catch((reason) => {
      if (bidLockRefreshGenerationRef.current === generation && roomRef.current?.id === currentRoom.id) {
        setError(multiplayerErrorMessage(reason));
      }
    });
  }, [backend, localPlayerId, room, setBidLocked, state, status, userId]);

  useEffect(() => {
    const currentRoom = room;
    const current = state;
    if (status !== 'game' || currentRoom === null || current === null || userId !== currentRoom.host_user_id) return;

    if (current.phase === 'round-setup') {
      applyHostAction({ type: 'DEAL_ROUND' });
      return;
    }
    if (current.phase === 'trick-result') {
      const timer = setTimeout(() => applyHostAction({ type: 'ACKNOWLEDGE_TRICK' }), trickMs);
      return () => clearTimeout(timer);
    }

    const bots = botSeatsForHumanCount(currentRoom.human_seat_count);
    if (current.activePlayerId !== null && bots.includes(current.activePlayerId) && ['choose-trump', 'playing'].includes(current.phase)) {
      const timer = setTimeout(() => {
        const choice = current.difficulty === 'medium'
          ? chooseMediumAction(current, bots)
          : chooseEasyAction(current, bots);
        if (choice === null || authoritativeStateRef.current !== current) return;
        const consumed = { ...current, rng: choice.rng };
        authoritativeStateRef.current = consumed;
        const next = reduceGame(consumed, choice.action);
        authoritativeStateRef.current = current;
        if (next !== consumed) void commitHostState(current, next);
      }, current.phase === 'playing' ? playMs : decisionMs);
      return () => clearTimeout(timer);
    }
  }, [applyHostAction, commitHostState, decisionMs, playMs, room, state, status, trickMs, userId]);

  const open = useCallback(() => {
    clearOnline();
    setStatus('entry');
  }, [clearOnline]);
  const createRoom = useCallback((input: CreateRoomInput) => {
    void enterRoom(async () => backend.createRoom(input));
  }, [backend, enterRoom]);
  const joinRoom = useCallback((input: JoinRoomInput) => {
    void enterRoom(async () => backend.joinRoom(input));
  }, [backend, enterRoom]);
  const startGame = useCallback(() => {
    const currentRoom = roomRef.current;
    if (currentRoom === null || currentRoom.host_user_id !== userIdRef.current || membersRef.current.length !== currentRoom.human_seat_count) return;
    const next = stateWithRoomMembers(createMatch(seedFactory(), currentRoom.difficulty), membersRef.current);
    void commitHostState(null, next);
  }, [commitHostState, seedFactory]);
  const dispatch = useCallback((action: GameAction) => {
    const currentRoom = roomRef.current;
    const currentUserId = userIdRef.current;
    const seatId = localPlayerIdRef.current;
    const current = authoritativeStateRef.current ?? state;
    if (currentRoom === null || currentUserId === null || seatId === null || current === null || !actionBelongsToSeat(action, seatId)) return;
    if (isOnlineBidAction(action, current, seatId)) {
      if (bidLockedRef.current) return;
      bidLockRefreshGenerationRef.current += 1;
      setBidLocked(true);
      void backend.submitAction(currentRoom.id, revisionRef.current, action).then(() => {
        if (currentRoom.host_user_id === currentUserId) void reconcileHost();
      }).catch((reason) => {
        setBidLocked(false);
        setError(multiplayerErrorMessage(reason));
        void refreshRoom();
      });
      return;
    }
    if (!engineLegalActions(current).some((candidate) => actionsEqual(candidate, action))) return;
    if (currentRoom.host_user_id === currentUserId) {
      applyHostAction(action);
    } else if (!pendingGuestActionRef.current) {
      pendingGuestActionRef.current = true;
      pendingGuestTimerRef.current = setTimeout(() => {
        pendingGuestTimerRef.current = null;
        pendingGuestActionRef.current = false;
        void refreshRoom();
      }, reconcileMs);
      void backend.submitAction(currentRoom.id, revisionRef.current, action).catch((reason) => {
        clearPendingGuestAction();
        setError(multiplayerErrorMessage(reason));
        void refreshRoom();
      });
    }
  }, [applyHostAction, backend, clearPendingGuestAction, reconcileHost, reconcileMs, refreshRoom, setBidLocked, state]);
  const acknowledgeRound = useCallback(() => dispatch({ type: 'ACKNOWLEDGE_ROUND' }), [dispatch]);
  const leave = useCallback(() => {
    const currentRoom = roomRef.current;
    if (currentRoom !== null) void backend.leaveRoom(currentRoom.id).catch(() => undefined);
    clearOnline();
    setStatus('closed');
  }, [backend, clearOnline]);

  const legalActions = useMemo(() => {
    if (status !== 'game' || state === null || localPlayerId === null) return [];
    if (state.phase === 'bidding') {
      if (bidLocked) return [];
      return Array.from({ length: state.round + 1 }, (_, bid) => ({
        type: 'PLACE_BID' as const,
        playerId: localPlayerId,
        bid,
      }));
    }
    return engineLegalActions(state).filter((action) => actionBelongsToSeat(action, localPlayerId));
  }, [bidLocked, localPlayerId, state, status]);

  return useMemo(() => ({
    status, loading, error, room, members, userId, localPlayerId, state, legalActions, bidLocked,
    open, leave, createRoom, joinRoom, startGame, dispatch, acknowledgeRound,
  }), [acknowledgeRound, bidLocked, createRoom, dispatch, error, joinRoom, leave, legalActions, loading, localPlayerId, members, open, room, startGame, state, status, userId]);
}

function isOnlineBidAction(action: GameAction, state: GameState, seatId: PlayerId): action is Extract<GameAction, { readonly type: 'PLACE_BID' }> {
  return action.type === 'PLACE_BID' && state.phase === 'bidding' && action.playerId === seatId &&
    Number.isInteger(action.bid) && action.bid >= 0 && action.bid <= state.round;
}

function actionsEqual(left: GameAction, right: GameAction): boolean {
  if (left.type !== right.type) return false;
  switch (left.type) {
    case 'CHOOSE_TRUMP':
      return right.type === 'CHOOSE_TRUMP' && left.playerId === right.playerId && left.suit === right.suit;
    case 'PLACE_BID':
      return right.type === 'PLACE_BID' && left.playerId === right.playerId && left.bid === right.bid;
    case 'PLAY_CARD':
      return right.type === 'PLAY_CARD' && left.playerId === right.playerId && left.cardId === right.cardId;
    case 'DEAL_ROUND':
    case 'ACKNOWLEDGE_TRICK':
    case 'ACKNOWLEDGE_ROUND':
      return true;
  }
}

function browserSeed(): number {
  const values = new Uint32Array(1);
  try {
    crypto.getRandomValues(values);
    return values[0];
  } catch {
    return (Date.now() ^ Math.floor(performance.now() * 1_000)) >>> 0;
  }
}
