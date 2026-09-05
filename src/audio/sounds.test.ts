import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SAVE_KEY } from '../storage/save';
import {
  SOUND_KEY,
  createSoundController,
  useSounds,
  type AudioContextLike,
} from './sounds';

class MemoryStorage {
  readonly values = new Map<string, string>();
  readonly writes: Array<[string, string]> = [];

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.writes.push([key, value]);
    this.values.set(key, value);
  }
}

function audioHarness() {
  let currentState = 'suspended';
  const oscillators: Array<{
    frequency: { setValueAtTime: ReturnType<typeof vi.fn> };
    connect: ReturnType<typeof vi.fn>;
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
  }> = [];
  const gains: Array<{
    gain: {
      setValueAtTime: ReturnType<typeof vi.fn>;
      exponentialRampToValueAtTime: ReturnType<typeof vi.fn>;
    };
    connect: ReturnType<typeof vi.fn>;
  }> = [];
  const context: AudioContextLike = {
    currentTime: 12,
    get state() {
      return currentState;
    },
    destination: {},
    resume: vi.fn(() => {
      currentState = 'running';
      return Promise.resolve();
    }),
    suspend: vi.fn(() => {
      currentState = 'suspended';
      return Promise.resolve();
    }),
    close: vi.fn(() => {
      currentState = 'closed';
      return Promise.resolve();
    }),
    createOscillator: vi.fn(() => {
      const oscillator = {
        frequency: { setValueAtTime: vi.fn() },
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      };
      oscillators.push(oscillator);
      return oscillator;
    }),
    createGain: vi.fn(() => {
      const gain = {
        gain: {
          setValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
      };
      gains.push(gain);
      return gain;
    }),
  };

  return {
    context,
    oscillators,
    gains,
    setState(state: string) {
      currentState = state;
    },
  };
}

describe('sound controller', () => {
  it('defaults off and reads true only from the exact persisted string', () => {
    const empty = new MemoryStorage();
    expect(createSoundController({ storage: empty }).enabled).toBe(false);

    empty.values.set(SOUND_KEY, 'TRUE');
    expect(createSoundController({ storage: empty }).enabled).toBe(false);

    empty.values.set(SOUND_KEY, 'true');
    expect(createSoundController({ storage: empty }).enabled).toBe(true);
  });

  it('toggles and persists only the independent sound preference', () => {
    const storage = new MemoryStorage();
    const createAudioContext = vi.fn(() => null);
    const sound = createSoundController({ storage, createAudioContext });

    expect(sound.toggle()).toBe(true);
    expect(sound.enabled).toBe(true);
    expect(sound.toggle()).toBe(false);
    expect(sound.enabled).toBe(false);
    expect(storage.writes).toEqual([
      [SOUND_KEY, 'true'],
      [SOUND_KEY, 'false'],
    ]);
    expect(createAudioContext).toHaveBeenCalledOnce();
  });

  it('uses browser storage by default without touching the match save', () => {
    window.localStorage.removeItem(SOUND_KEY);
    window.localStorage.setItem(SAVE_KEY, 'saved-match-sentinel');
    const sound = createSoundController({ createAudioContext: () => null });

    sound.toggle();

    expect(window.localStorage.getItem(SOUND_KEY)).toBe('true');
    expect(window.localStorage.getItem(SAVE_KEY)).toBe('saved-match-sentinel');
    window.localStorage.removeItem(SOUND_KEY);
    window.localStorage.removeItem(SAVE_KEY);
  });

  it('never throws when storage reads or writes fail', () => {
    const storage = {
      getItem: vi.fn(() => {
        throw new Error('blocked');
      }),
      setItem: vi.fn(() => {
        throw new Error('full');
      }),
    };

    expect(() => {
      const sound = createSoundController({ storage, createAudioContext: () => null });
      expect(sound.enabled).toBe(false);
      sound.toggle();
    }).not.toThrow();
  });

  it('does not create or play audio while disabled', () => {
    const harness = audioHarness();
    const createAudioContext = vi.fn(() => harness.context);
    const sound = createSoundController({
      storage: new MemoryStorage(),
      createAudioContext,
    });

    sound.play('card');
    sound.play('trick');
    sound.play('round');

    expect(createAudioContext).not.toHaveBeenCalled();
    expect(harness.context.createOscillator).not.toHaveBeenCalled();
  });

  it('degrades silently when Web Audio is unavailable or throws', () => {
    const unavailable = createSoundController({
      storage: new MemoryStorage(),
      createAudioContext: () => null,
    });
    unavailable.toggle();
    expect(() => unavailable.play('card')).not.toThrow();

    const throwing = createSoundController({
      storage: new MemoryStorage(),
      createAudioContext: () => {
        throw new Error('denied');
      },
    });
    expect(() => {
      throwing.toggle();
      throwing.play('round');
    }).not.toThrow();
  });

  it('resumes after opt-in and synthesizes restrained short cues', () => {
    const harness = audioHarness();
    const sound = createSoundController({
      storage: new MemoryStorage(),
      createAudioContext: () => harness.context,
    });

    sound.toggle();
    sound.play('card');
    sound.play('trick');
    sound.play('round');

    expect(harness.context.resume).toHaveBeenCalledOnce();
    expect(harness.oscillators).toHaveLength(3);
    expect(harness.gains).toHaveLength(3);
    for (const oscillator of harness.oscillators) {
      expect(oscillator.start).toHaveBeenCalledWith(12);
      const stopTime = oscillator.stop.mock.calls[0]?.[0] as number;
      expect(stopTime).toBeGreaterThan(12);
      expect(stopTime).toBeLessThanOrEqual(12.15);
    }
    for (const gain of harness.gains) {
      expect(gain.gain.setValueAtTime).toHaveBeenCalledWith(0.025, 12);
      expect(gain.gain.exponentialRampToValueAtTime).toHaveBeenCalled();
    }
  });

  it('can play after a previously persisted opt-in without rewriting the preference', () => {
    const storage = new MemoryStorage();
    storage.values.set(SOUND_KEY, 'true');
    const harness = audioHarness();
    const createAudioContext = vi.fn(() => harness.context);
    const sound = createSoundController({ storage, createAudioContext });

    sound.play('card');

    expect(createAudioContext).toHaveBeenCalledOnce();
    expect(harness.context.createOscillator).toHaveBeenCalledOnce();
    expect(storage.writes).toEqual([]);
  });

  it('retries a rejected resume on a later play', async () => {
    const storage = new MemoryStorage();
    storage.values.set(SOUND_KEY, 'true');
    const harness = audioHarness();
    const resume = vi.fn(() => {
      if (resume.mock.calls.length === 1) {
        return Promise.reject(new Error('gesture required'));
      }
      harness.setState('running');
      return Promise.resolve();
    });
    harness.context.resume = resume;
    const sound = createSoundController({
      storage,
      createAudioContext: () => harness.context,
    });

    sound.play('card');
    await Promise.resolve();
    sound.play('card');

    expect(resume).toHaveBeenCalledTimes(2);
  });

  it('does not throw when reading audio context state fails', () => {
    const harness = audioHarness();
    Object.defineProperty(harness.context, 'state', {
      get() {
        throw new Error('context disconnected');
      },
    });
    const sound = createSoundController({
      storage: new MemoryStorage(),
      createAudioContext: () => harness.context,
    });

    expect(() => sound.toggle()).not.toThrow();
    expect(() => sound.play('card')).not.toThrow();
  });

  it('resumes a reused suspended context before scheduling another cue', () => {
    const harness = audioHarness();
    const sound = createSoundController({
      storage: new MemoryStorage(),
      createAudioContext: () => harness.context,
    });
    sound.toggle();
    harness.setState('suspended');

    sound.play('trick');

    expect(harness.context.resume).toHaveBeenCalledTimes(2);
    expect(harness.context.createOscillator).toHaveBeenCalledOnce();
  });

  it('closes and resets its context when sound is disabled', () => {
    const first = audioHarness();
    const second = audioHarness();
    const createAudioContext = vi
      .fn<() => AudioContextLike | null>()
      .mockReturnValueOnce(first.context)
      .mockReturnValueOnce(second.context);
    const sound = createSoundController({ storage: new MemoryStorage(), createAudioContext });
    sound.toggle();

    sound.toggle();

    expect(first.context.close).toHaveBeenCalledOnce();
    expect(first.context.suspend).not.toHaveBeenCalled();
    sound.toggle();
    expect(createAudioContext).toHaveBeenCalledTimes(2);
  });

  it('disposes its context without changing the persisted preference', () => {
    const storage = new MemoryStorage();
    const harness = audioHarness();
    const sound = createSoundController({
      storage,
      createAudioContext: () => harness.context,
    });
    sound.toggle();
    storage.writes.length = 0;

    sound.dispose();
    sound.dispose();

    expect(harness.context.close).toHaveBeenCalledOnce();
    expect(storage.writes).toEqual([]);
  });

  it('swallows close failures and remains safe to dispose again', async () => {
    const harness = audioHarness();
    harness.context.close = vi.fn().mockRejectedValue(new Error('close denied'));
    const sound = createSoundController({
      storage: new MemoryStorage(),
      createAudioContext: () => harness.context,
    });
    sound.toggle();

    expect(() => sound.dispose()).not.toThrow();
    await Promise.resolve();
    expect(() => sound.dispose()).not.toThrow();
  });

  it('disposes the active context when the sound hook unmounts', () => {
    const harness = audioHarness();
    const { result, unmount } = renderHook(() =>
      useSounds({
        storage: new MemoryStorage(),
        createAudioContext: () => harness.context,
      }),
    );
    act(() => {
      result.current.toggle();
    });

    unmount();

    expect(harness.context.close).toHaveBeenCalledOnce();
  });
});
