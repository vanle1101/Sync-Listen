import { useState, useRef } from "react";
import { Play, Pause, SkipForward, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PlayerControlsProps {
  isHost: boolean;
  playing: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  onPlayPause: () => void;
  onSkip: () => void;
  onSeek: (time: number) => void;
  onVolumeChange: (vol: number) => void;
  disabled?: boolean;
}

function formatTime(s: number) {
  if (!s || isNaN(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export function PlayerControls({
  isHost, playing, currentTime, duration, volume,
  onPlayPause, onSkip, onSeek, onVolumeChange, disabled = false
}: PlayerControlsProps) {
  const [dragging, setDragging] = useState(false);
  const [dragTime, setDragTime] = useState(0);
  const seekBarRef = useRef<HTMLInputElement>(null);

  const displayTime = dragging ? dragTime : currentTime;
  const progress = duration > 0 ? (displayTime / duration) * 100 : 0;

  return (
    <div className="bg-white/60 backdrop-blur-xl border border-primary/5 p-5 rounded-3xl shadow-[0_10px_40px_rgba(192,112,128,0.12)] soft-glow space-y-3">

      {/* Seek bar row */}
      <div className="flex items-center gap-3">
        <span className="text-xs tabular-nums text-muted-foreground/70 w-9 text-right shrink-0">
          {formatTime(displayTime)}
        </span>

        <div className="relative flex-1 h-2 group">
          <div className="absolute inset-0 bg-primary/10 rounded-full overflow-hidden shadow-inner">
            <div
              className="h-full bg-gradient-to-r from-primary to-secondary rounded-full transition-none"
              style={{ width: `${progress}%` }}
            />
          </div>
          <input
            ref={seekBarRef}
            type="range"
            min={0}
            max={duration || 100}
            step={0.5}
            value={displayTime}
            disabled={!isHost || disabled || duration === 0}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
            style={{ margin: 0 }}
            onMouseDown={() => { setDragging(true); setDragTime(currentTime); }}
            onChange={(e) => setDragTime(Number(e.target.value))}
            onMouseUp={(e) => {
              const t = Number((e.target as HTMLInputElement).value);
              setDragging(false);
              onSeek(t);
            }}
            onTouchEnd={(e) => {
              const t = Number((e.target as HTMLInputElement).value);
              setDragging(false);
              onSeek(t);
            }}
          />
          {/* Thumb dot */}
          {isHost && !disabled && duration > 0 && (
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-primary shadow-md border-2 border-white pointer-events-none transition-none"
              style={{ left: `calc(${progress}% - 6px)` }}
            />
          )}
        </div>

        <span className="text-xs tabular-nums text-muted-foreground/70 w-9 shrink-0">
          {formatTime(duration)}
        </span>
      </div>

      {/* Controls row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Volume */}
          <button
            className="text-primary/60 hover:text-primary transition-colors"
            onClick={() => onVolumeChange(volume === 0 ? 70 : 0)}
          >
            {volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>
          <div className="relative w-24 h-2 group">
            <div className="absolute inset-0 bg-primary/10 rounded-full overflow-hidden shadow-inner">
              <div
                className="h-full bg-gradient-to-r from-primary to-secondary rounded-full opacity-70"
                style={{ width: `${volume}%` }}
              />
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={volume}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              style={{ margin: 0 }}
              onChange={(e) => onVolumeChange(Number(e.target.value))}
            />
          </div>
        </div>

        <div className="flex items-center gap-4">
          {!isHost && (
            <div className="text-xs font-medium text-primary/70 bg-primary/5 px-3 py-1 rounded-full flex items-center gap-1.5 border border-primary/10">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
              Chỉ host điều khiển
            </div>
          )}

          <Button
            variant="outline"
            size="icon"
            className={`w-14 h-14 rounded-full border-primary/10 bg-white shadow-sm transition-all duration-300 ${isHost && !disabled ? 'hover:bg-primary/5 hover:border-primary/30 hover:scale-110 active:scale-95 text-primary' : 'opacity-40 cursor-not-allowed'}`}
            disabled={!isHost || disabled}
            onClick={onPlayPause}
          >
            {playing
              ? <Pause className="w-6 h-6 fill-current" />
              : <Play className="w-6 h-6 fill-current ml-1" />}
          </Button>

          <Button
            variant="outline"
            size="icon"
            className={`w-12 h-12 rounded-full border-primary/10 bg-white shadow-sm transition-all duration-300 ${isHost && !disabled ? 'hover:bg-primary/5 hover:scale-110 active:scale-95 text-primary/80' : 'opacity-40 cursor-not-allowed'}`}
            disabled={!isHost || disabled}
            onClick={onSkip}
          >
            <SkipForward className="w-5 h-5 fill-current" />
          </Button>
        </div>

        {/* Spacer to balance layout */}
        <div className="w-32" />
      </div>
    </div>
  );
}
