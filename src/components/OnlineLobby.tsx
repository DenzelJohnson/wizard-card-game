import { useState, type FormEvent } from 'react';

import type { Difficulty } from '../game/types';
import { PLAYERS } from '../game/types';
import { botSeatsForHumanCount, normalizeRoomCode, type RoomMember } from '../multiplayer/model';
import type { CreateRoomInput, JoinRoomInput, WizardRoom } from '../multiplayer/types';

export interface OnlineLobbyProps {
  readonly status: 'entry' | 'lobby';
  readonly loading: boolean;
  readonly error: string | null;
  readonly room: WizardRoom | null;
  readonly members: readonly RoomMember[];
  readonly userId: string | null;
  readonly onCreate: (input: CreateRoomInput) => void;
  readonly onJoin: (input: JoinRoomInput) => void;
  readonly onStart: () => void;
  readonly onLeave: () => void;
}

export function OnlineLobby({
  status,
  loading,
  error,
  room,
  members,
  userId,
  onCreate,
  onJoin,
  onStart,
  onLeave,
}: OnlineLobbyProps) {
  const [displayName, setDisplayName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [humanSeatCount, setHumanSeatCount] = useState(2);
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const cleanName = displayName.trim();

  if (status === 'lobby' && room !== null) {
    const isHost = room.host_user_id === userId;
    const ready = members.length === room.human_seat_count;
    const memberBySeat = new Map(members.map((member) => [member.seat_id, member]));
    const botSeats = new Set(botSeatsForHumanCount(room.human_seat_count));

    return (
      <main className="online-screen" aria-labelledby="online-lobby-title">
        <section className="online-panel online-panel--lobby">
          <p className="online-kicker">Private tavern table</p>
          <h1 id="online-lobby-title">Room {room.room_code}</h1>
          <p className="online-room-count">{members.length} of {room.human_seat_count} people joined</p>
          <ul className="online-roster" aria-label="Room players">
            {PLAYERS.map((player) => {
              const member = memberBySeat.get(player.id);
              const label = member?.display_name ?? (botSeats.has(player.id) ? player.name : 'Waiting…');
              return (
                <li key={player.id}>
                  <span>{label}</span>
                  <small>{member?.user_id === room.host_user_id ? 'Host' : botSeats.has(player.id) ? 'Computer' : 'Player'}</small>
                </li>
              );
            })}
          </ul>
          {error ? <p className="online-error" role="alert">{error}</p> : null}
          {isHost ? (
            <button className="button button--primary" type="button" disabled={!ready || loading} onClick={onStart}>
              {loading ? 'Starting…' : 'Start Game'}
            </button>
          ) : (
            <p className="online-waiting" role="status">Waiting for the host to start…</p>
          )}
          <button className="button button--secondary" type="button" disabled={loading} onClick={onLeave}>
            Leave Room
          </button>
        </section>
      </main>
    );
  }

  const create = (event: FormEvent): void => {
    event.preventDefault();
    if (cleanName === '') return;
    onCreate({ displayName: cleanName, difficulty, humanSeatCount });
  };

  const join = (event: FormEvent): void => {
    event.preventDefault();
    const code = normalizeRoomCode(roomCode);
    if (cleanName === '' || code.length !== 6) return;
    onJoin({ displayName: cleanName, roomCode: code });
  };

  return (
    <main className="online-screen" aria-labelledby="online-entry-title">
      <section className="online-panel">
        <p className="online-kicker">Gather your party</p>
        <h1 id="online-entry-title">Play Online</h1>
        <label className="online-field">
          <span>Your name</span>
          <input maxLength={20} value={displayName} onChange={(event) => setDisplayName(event.target.value)} autoComplete="nickname" />
        </label>
        <div className="online-entry-grid">
          <form onSubmit={create} className="online-entry-card">
            <h2>Create a room</h2>
            <label className="online-field">
              <span>People</span>
              <select value={humanSeatCount} onChange={(event) => setHumanSeatCount(Number(event.target.value))}>
                <option value={2}>2 people + 2 computers</option>
                <option value={3}>3 people + 1 computer</option>
                <option value={4}>4 people</option>
              </select>
            </label>
            <fieldset className="online-difficulty">
              <legend>Computer difficulty</legend>
              <label><input type="radio" name="online-difficulty" checked={difficulty === 'easy'} onChange={() => setDifficulty('easy')} /> Easy</label>
              <label><input type="radio" name="online-difficulty" checked={difficulty === 'medium'} onChange={() => setDifficulty('medium')} /> Medium</label>
            </fieldset>
            <button className="button button--primary" type="submit" disabled={loading || cleanName === ''}>Create Room</button>
          </form>
          <form onSubmit={join} className="online-entry-card">
            <h2>Join a room</h2>
            <label className="online-field">
              <span>Room code</span>
              <input
                value={roomCode}
                onChange={(event) => setRoomCode(normalizeRoomCode(event.target.value))}
                maxLength={6}
                autoCapitalize="characters"
                autoComplete="off"
                placeholder="ABC123"
              />
            </label>
            <button className="button button--primary" type="submit" disabled={loading || cleanName === '' || roomCode.length !== 6}>Join Room</button>
          </form>
        </div>
        {error ? <p className="online-error" role="alert">{error}</p> : null}
        {loading ? <p className="online-waiting" role="status">Connecting to the tavern…</p> : null}
        <button className="button button--secondary" type="button" disabled={loading} onClick={onLeave}>Return Home</button>
      </section>
    </main>
  );
}
