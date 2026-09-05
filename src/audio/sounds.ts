import { useCallback, useEffect, useState } from 'react';

export const SOUND_KEY = 'wizard-card-game/sound-enabled';

export type SoundCue = 'card' | 'trick' | 'round';

export interface SoundStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface AudioParamLike {
  setValueAtTime(value: number, time: number): unknown;
  exponentialRampToValueAtTime(value: number, time: number): unknown;
}

export interface OscillatorLike {
  type?: OscillatorType;
  readonly frequency: Pick<AudioParamLike, 'setValueAtTime'>;
  connect(destination: unknown): unknown;
  start(time: number): void;
  stop(time: number): void;
}

export interface GainLike {
  readonly gain: AudioParamLike;
  connect(destination: unknown): unknown;
}

export interface AudioContextLike {
  readonly currentTime: number;
  readonly state?: string;
  readonly destination: unknown;
  resume?(): Promise<void> | void;
  suspend?(): Promise<void> | void;
  close?(): Promise<void> | void;
  createOscillator(): OscillatorLike;
  createGain(): GainLike;
}

export interface SoundController {
  readonly enabled: boolean;
  toggle(): boolean;
  play(cue: SoundCue): void;
  dispose(): void;
}

export interface SoundControllerOptions {
  readonly storage?: SoundStorageLike;
  readonly createAudioContext?: () => AudioContextLike | null;
}

const CUES: Readonly<Record<SoundCue, { frequency: number; duration: number; type: OscillatorType }>> = {
  card: { frequency: 330, duration: 0.045, type: 'sine' },
  trick: { frequency: 494, duration: 0.08, type: 'triangle' },
  round: { frequency: 659, duration: 0.12, type: 'sine' },
};

export function createSoundController(options: SoundControllerOptions = {}): SoundController {
  const storage = options.storage ?? browserStorage();
  let enabled = readPreference(storage);
  let context: AudioContextLike | null = null;
  const createAudioContext = options.createAudioContext ?? browserAudioContext;

  const ensureContext = (): AudioContextLike | null => {
    if (context !== null) {
      return context;
    }

    try {
      context = createAudioContext();
    } catch {
      context = null;
    }

    return context;
  };

  const resumeContext = (activeContext: AudioContextLike | null): void => {
    if (activeContext === null) {
      return;
    }
    try {
      if (activeContext.state !== 'suspended' || typeof activeContext.resume !== 'function') {
        return;
      }
      const resumed = activeContext.resume();
      void Promise.resolve(resumed).catch(() => undefined);
    } catch {
      // Audio remains supplementary when a browser rejects activation.
    }
  };

  const releaseContext = (): void => {
    const activeContext = context;
    context = null;
    if (activeContext === null) {
      return;
    }

    if (typeof activeContext.close === 'function') {
      settleAudioOperation(() => activeContext.close?.(), () => activeContext.suspend?.());
      return;
    }
    settleAudioOperation(() => activeContext.suspend?.());
  };

  return {
    get enabled() {
      return enabled;
    },
    toggle(): boolean {
      enabled = !enabled;
      writePreference(storage, enabled);

      if (enabled) {
        resumeContext(ensureContext());
      } else {
        releaseContext();
      }

      return enabled;
    },
    play(cue): void {
      if (!enabled) {
        return;
      }

      try {
        const activeContext = ensureContext();
        if (activeContext === null) {
          return;
        }
        resumeContext(activeContext);
        const tone = CUES[cue];
        const now = activeContext.currentTime;
        const oscillator = activeContext.createOscillator();
        const gain = activeContext.createGain();
        oscillator.type = tone.type;
        oscillator.frequency.setValueAtTime(tone.frequency, now);
        gain.gain.setValueAtTime(0.025, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + tone.duration);
        oscillator.connect(gain);
        gain.connect(activeContext.destination);
        oscillator.start(now);
        oscillator.stop(now + tone.duration);
      } catch {
        // Interface audio must never interrupt game play.
      }
    },
    dispose(): void {
      releaseContext();
    },
  };
}

export function useSounds(options: SoundControllerOptions = {}): SoundController {
  const [controller] = useState(() => createSoundController(options));
  const [enabled, setEnabled] = useState(controller.enabled);
  const toggle = useCallback((): boolean => {
    const nextEnabled = controller.toggle();
    setEnabled(nextEnabled);
    return nextEnabled;
  }, [controller]);
  const play = useCallback((cue: SoundCue) => controller.play(cue), [controller]);

  useEffect(() => () => controller.dispose(), [controller]);

  return { enabled, toggle, play, dispose: controller.dispose };
}

function settleAudioOperation(operation: () => Promise<void> | void | undefined, fallback?: () => Promise<void> | void | undefined): void {
  try {
    const result = operation();
    void Promise.resolve(result).catch(() => {
      if (fallback !== undefined) {
        settleAudioOperation(fallback);
      }
    });
  } catch {
    if (fallback !== undefined) {
      settleAudioOperation(fallback);
    }
  }
}

function readPreference(storage: SoundStorageLike | undefined): boolean {
  try {
    return storage?.getItem(SOUND_KEY) === 'true';
  } catch {
    return false;
  }
}

function writePreference(storage: SoundStorageLike | undefined, enabled: boolean): void {
  try {
    storage?.setItem(SOUND_KEY, String(enabled));
  } catch {
    // Preference persistence is optional.
  }
}

function browserAudioContext(): AudioContextLike | null {
  const browser = globalThis as typeof globalThis & {
    AudioContext?: new () => AudioContextLike;
    webkitAudioContext?: new () => AudioContextLike;
  };
  const AudioContextConstructor = browser.AudioContext ?? browser.webkitAudioContext;
  return AudioContextConstructor === undefined ? null : new AudioContextConstructor();
}

function browserStorage(): SoundStorageLike | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}
