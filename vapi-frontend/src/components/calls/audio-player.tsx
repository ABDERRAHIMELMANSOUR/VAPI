'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface AudioPlayerHandle {
  seek: (seconds: number) => void;
}

interface AudioPlayerProps {
  recordingUrl: string | null;
  durationSec: number;
  /** Stable id used to synthesize a deterministic waveform. */
  seed: string;
  onTimeUpdate?: (seconds: number) => void;
  className?: string;
}

const BAR_COUNT = 72;

/** Deterministic pseudo-random heights so the waveform is stable per call. */
function waveformBars(seed: string, count: number): number[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const bars: number[] = [];
  for (let i = 0; i < count; i += 1) {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    const norm = ((h >>> 0) % 1000) / 1000;
    // Bias toward a natural speech envelope: taller in the middle.
    const envelope = 0.35 + 0.65 * Math.sin((Math.PI * i) / count);
    bars.push(0.15 + norm * 0.85 * envelope);
  }
  return bars;
}

function fmt(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}

/**
 * Waveform audio player. Uses a real <audio> element when a recording URL is
 * present; otherwise simulates playback across the known call duration so the
 * transcript timeline stays interactive even without a stored recording.
 */
export const AudioPlayer = forwardRef<AudioPlayerHandle, AudioPlayerProps>(function AudioPlayer(
  { recordingUrl, durationSec, seed, onTimeUpdate, className },
  ref,
) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef<number>(0);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);

  const duration = Math.max(durationSec || 0, 0.001);
  const bars = useMemo(() => waveformBars(seed, BAR_COUNT), [seed]);
  const simulated = !recordingUrl;

  const report = useCallback(
    (t: number) => {
      setCurrent(t);
      onTimeUpdate?.(t);
    },
    [onTimeUpdate],
  );

  const stopRaf = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  // Simulated playback loop.
  useEffect(() => {
    if (!simulated || !playing) return;
    lastTickRef.current = performance.now();
    const tick = (now: number) => {
      const delta = (now - lastTickRef.current) / 1000;
      lastTickRef.current = now;
      setCurrent((prev) => {
        const next = prev + delta;
        if (next >= duration) {
          setPlaying(false);
          onTimeUpdate?.(duration);
          return duration;
        }
        onTimeUpdate?.(next);
        return next;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return stopRaf;
  }, [simulated, playing, duration, onTimeUpdate, stopRaf]);

  useImperativeHandle(ref, () => ({
    seek(seconds: number) {
      const clamped = Math.min(Math.max(seconds, 0), duration);
      if (simulated) {
        report(clamped);
      } else if (audioRef.current) {
        audioRef.current.currentTime = clamped;
        report(clamped);
      }
    },
  }));

  function toggle() {
    if (simulated) {
      if (current >= duration) setCurrent(0);
      setPlaying((p) => !p);
      return;
    }
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) void el.play();
    else el.pause();
  }

  function restart() {
    if (simulated) {
      report(0);
      setPlaying(true);
    } else if (audioRef.current) {
      audioRef.current.currentTime = 0;
      void audioRef.current.play();
    }
  }

  function seekToFraction(fraction: number) {
    const target = fraction * duration;
    if (simulated) report(target);
    else if (audioRef.current) {
      audioRef.current.currentTime = target;
      report(target);
    }
  }

  const progress = Math.min(current / duration, 1);
  const activeBar = Math.floor(progress * BAR_COUNT);

  return (
    <div className={cn('rounded-lg border border-border bg-card p-4', className)}>
      {recordingUrl ? (
        <audio
          ref={audioRef}
          src={recordingUrl}
          preload="metadata"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onTimeUpdate={(e) => report(e.currentTarget.currentTime)}
          onEnded={() => setPlaying(false)}
        />
      ) : null}

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="icon"
            variant="secondary"
            className="size-9 rounded-full"
            onClick={toggle}
            aria-label={playing ? 'Pause' : 'Play'}
          >
            {playing ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-8 text-muted-foreground"
            onClick={restart}
            aria-label="Restart"
          >
            <RotateCcw className="size-4" aria-hidden />
          </Button>
        </div>

        <button
          type="button"
          className="group relative flex h-16 flex-1 items-center gap-[2px] overflow-hidden"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            seekToFraction((e.clientX - rect.left) / rect.width);
          }}
          aria-label="Seek"
        >
          {bars.map((height, i) => (
            <span
              key={i}
              className={cn(
                'w-full rounded-full transition-colors',
                i <= activeBar ? 'bg-foreground/80' : 'bg-muted-foreground/25',
              )}
              style={{ height: `${Math.round(height * 100)}%` }}
            />
          ))}
        </button>

        <div className="w-24 text-right font-mono text-xs text-muted-foreground">
          {fmt(current)} / {fmt(duration)}
        </div>
      </div>

      {simulated ? (
        <p className="mt-2 text-xs text-muted-foreground/70">
          No stored recording — showing a simulated timeline synced to the transcript.
        </p>
      ) : null}
    </div>
  );
});
