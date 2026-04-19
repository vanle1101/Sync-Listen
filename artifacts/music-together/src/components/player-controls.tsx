import { useState, useRef } from "react";
import { Play, Pause, SkipForward, SkipBack, Volume2, VolumeX, Shuffle, Repeat, Repeat1, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RepeatMode } from "@/lib/types";

interface PlayerControlsProps {
  isHost: boolean;
  playing: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  repeatMode: RepeatMode;
  shuffle: boolean;
  onPlayPause: () => void;
  onSkip: () => void;
  onPrev: () => void;
  onSeek: (time: number) => void;
  onVolumeChange: (vol: number) => void;
  onRepeat: () => void;
  onShuffle: () => void;
  onFullscreen?: () => void;
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
  repeatMode, shuffle,
  onPlayPause, onSkip, onPrev, onSeek, onVolumeChange, onRepeat, onShuffle, onFullscreen,
  disabled = false
}: PlayerControlsProps) {
  const [dragging, setDragging] = useState(false);
  const [dragTime, setDragTime] = useState(0);

  const displayTime = dragging ? dragTime : currentTime;
  const progress = duration > 0 ? (displayTime / duration) * 100 : 0;

  const hostActive = isHost && !disabled;

  const iconBtn = (active: boolean) =>
    `w-9 h-9 rounded-full border transition-all duration-200 flex items-center justify-center ${
      active
        ? 'border-primary/20 bg-white shadow-sm hover:bg-primary/5 hover:scale-110 active:scale-95 text-primary/80'
        : 'border-transparent bg-transparent text-muted-foreground/40 cursor-not-allowed'
    }`;

  const RepeatIcon = repeatMode === 'one' ? Repeat1 : Repeat;
  const repeatActive = repeatMode !== 'none';

  return (
    <div className="bg-white/60 backdrop-blur-xl border border-primary/5 p-5 rounded-3xl shadow-[0_10px_40px_rgba(192,112,128,0.12)] mt-4 soft-glow space-y-3">

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
            type="range"
            min={0}
            max={duration || 100}
            step={0.5}
            value={displayTime}
            disabled={!hostActive || duration === 0}
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
          {hostActive && duration > 0 && (
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
      <div className="flex items-center justify-between gap-2">

        {/* Left: Volume */}
        <div className="flex items-center gap-2 flex-1">
          <button
            className="text-primary/60 hover:text-primary transition-colors flex-shrink-0"
            onClick={() => onVolumeChange(volume === 0 ? 70 : 0)}
          >
            {volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <div className="relative w-20 h-2">
            <div className="absolute inset-0 bg-primary/10 rounded-full overflow-hidden shadow-inner">
              <div
                className="h-full bg-gradient-to-r from-primary to-secondary rounded-full opacity-70"
                style={{ width: `${volume}%` }}
              />
            </div>
            <input
              type="range" min={0} max={100} value={volume}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              style={{ margin: 0 }}
              onChange={(e) => onVolumeChange(Number(e.target.value))}
            />
          </div>
        </div>

        {/* Center: playback controls */}
        <div className="flex items-center gap-2">

          {/* Shuffle */}
          <button
            className={iconBtn(hostActive) + (shuffle && hostActive ? ' !text-secondary !border-secondary/30' : '')}
            disabled={!hostActive}
            onClick={onShuffle}
            title="Phát ngẫu nhiên"
          >
            <Shuffle className="w-4 h-4" />
          </button>

          {/* Previous */}
          <button
            className={iconBtn(hostActive)}
            disabled={!hostActive}
            onClick={onPrev}
            title="Bài trước"
          >
            <SkipBack className="w-4 h-4 fill-current" />
          </button>

          {/* Play/Pause — larger */}
          <Button
            variant="outline"
            size="icon"
            className={`w-14 h-14 rounded-full border-primary/10 bg-white shadow-sm transition-all duration-300 ${
              hostActive ? 'hover:bg-primary/5 hover:border-primary/30 hover:scale-110 active:scale-95 text-primary' : 'opacity-40 cursor-not-allowed'
            }`}
            disabled={!hostActive}
            onClick={onPlayPause}
          >
            {playing
              ? <Pause className="w-6 h-6 fill-current" />
              : <Play className="w-6 h-6 fill-current ml-1" />}
          </Button>

          {/* Next */}
          <button
            className={iconBtn(hostActive)}
            disabled={!hostActive}
            onClick={onSkip}
            title="Bài tiếp theo"
          >
            <SkipForward className="w-4 h-4 fill-current" />
          </button>

          {/* Repeat */}
          <button
            className={iconBtn(hostActive) + (repeatActive && hostActive ? ' !text-secondary !border-secondary/30' : '')}
            disabled={!hostActive}
            onClick={onRepeat}
            title={repeatMode === 'none' ? 'Tắt lặp' : repeatMode === 'one' ? 'Lặp 1 bài' : 'Lặp tất cả'}
          >
            <RepeatIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Right: fullscreen + host badge */}
        <div className="flex-1 flex items-center justify-end gap-2">
          {!isHost && (
            <div className="text-xs font-medium text-primary/60 bg-primary/5 px-2 py-1 rounded-full flex items-center gap-1 border border-primary/10">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
              Host điều khiển
            </div>
          )}
          {onFullscreen && (
            <button
              onClick={onFullscreen}
              title="Toàn màn hình"
              className="w-8 h-8 rounded-full border border-primary/20 bg-white shadow-sm hover:bg-primary/5 hover:scale-110 active:scale-95 text-primary/70 hover:text-primary flex items-center justify-center transition-all duration-200">
              <Maximize2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
