import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { OnlineLobby } from './OnlineLobby';

describe('OnlineLobby', () => {
  it('creates a room with the selected people and difficulty', () => {
    const onCreate = vi.fn();
    render(
      <OnlineLobby
        status="entry"
        loading={false}
        error={null}
        room={null}
        members={[]}
        userId={null}
        onCreate={onCreate}
        onJoin={vi.fn()}
        onStart={vi.fn()}
        onLeave={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Denzel' } });
    fireEvent.change(screen.getByLabelText('People'), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('radio', { name: 'Medium' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create Room' }));

    expect(onCreate).toHaveBeenCalledWith({
      displayName: 'Denzel',
      difficulty: 'medium',
      humanSeatCount: 3,
    });
  });

  it('joins a room using a normalized code', () => {
    const onJoin = vi.fn();
    render(
      <OnlineLobby
        status="entry"
        loading={false}
        error={null}
        room={null}
        members={[]}
        userId={null}
        onCreate={vi.fn()}
        onJoin={onJoin}
        onStart={vi.fn()}
        onLeave={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Alex' } });
    fireEvent.change(screen.getByLabelText('Room code'), { target: { value: 'ab-12 c3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Join Room' }));
    expect(onJoin).toHaveBeenCalledWith({ displayName: 'Alex', roomCode: 'AB12C3' });
  });

  it('shows the room roster and starts only when every person has joined', () => {
    const onStart = vi.fn();
    const room = {
      id: 'room-1', room_code: 'ABC123', host_user_id: 'host', status: 'lobby' as const,
      difficulty: 'easy' as const, human_seat_count: 2, revision: 0,
      created_at: 'now', updated_at: 'now',
    };
    const { rerender } = render(
      <OnlineLobby
        status="lobby"
        loading={false}
        error={null}
        room={room}
        members={[{ room_id: 'room-1', user_id: 'host', seat_id: 'human', display_name: 'Denzel', joined_at: 'now' }]}
        userId="host"
        onCreate={vi.fn()}
        onJoin={vi.fn()}
        onStart={onStart}
        onLeave={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Start Game' })).toBeDisabled();
    expect(screen.getByText('1 of 2 people joined')).toBeInTheDocument();

    rerender(
      <OnlineLobby
        status="lobby"
        loading={false}
        error={null}
        room={room}
        members={[
          { room_id: 'room-1', user_id: 'host', seat_id: 'human', display_name: 'Denzel', joined_at: 'now' },
          { room_id: 'room-1', user_id: 'guest', seat_id: 'ember', display_name: 'Alex', joined_at: 'now' },
        ]}
        userId="host"
        onCreate={vi.fn()}
        onJoin={vi.fn()}
        onStart={onStart}
        onLeave={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Start Game' }));
    expect(onStart).toHaveBeenCalledOnce();
  });
});
