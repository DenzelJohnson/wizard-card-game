import { useCallback, useState } from 'react';

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
  createOscillator(): OscillatorLike;
  createGain(): GainLike;
}

export interface SoundController {
  readonly enabled: boolean;
  toggle(): boolean;
  play(cue: SoundCue): void;
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
    if (activeContext?.state !== 'suspended' || typeof activeContext.resume !== 'function') {
      return;
    }
    try {
      const resumed = activeContext.resume();
      void Promise.resolve(resumed).catch(() => undefined);
    } catch {
      // Audio remains supplementary when a browser rejects activation.
    }
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
      }

      return enabled;
    },
    play(cue): void {
      if (!enabled) {
        return;
      }

      try {
        const needsResume = context === null;
        const activeContext = ensureContext();
        if (activeContext === null) {
          return;
        }
        if (needsResume) {
          resumeContext(activeContext);
        }
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

  return { enabled, toggle, play };
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
