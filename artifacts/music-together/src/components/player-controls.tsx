import { Play, Pause, SkipForward, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PlayerControlsProps {
  isHost: boolean;
  playing: boolean;
  onPlayPause: () => void;
  onSkip: () => void;
  disabled?: boolean;
}

export function PlayerControls({ isHost, playing, onPlayPause, onSkip, disabled = false }: PlayerControlsProps) {
  return (
    <div className="flex items-center justify-between bg-card/60 backdrop-blur-xl border border-white/5 p-4 rounded-xl shadow-lg mt-4 glass-panel">
      <div className="flex items-center gap-4">
        {!isHost && (
          <div className="text-xs font-mono text-muted-foreground bg-black/30 px-3 py-1 rounded-full flex items-center gap-2 border border-white/5">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse"></span>
            Host controls playback
          </div>
        )}
      </div>
      
      <div className="flex items-center justify-center gap-4 flex-1">
        <Button 
          variant="outline" 
          size="icon" 
          className={`w-12 h-12 rounded-full border-white/10 bg-black/40 ${isHost && !disabled ? 'hover:bg-white/10 hover:border-primary/50' : 'opacity-50'}`}
          disabled={!isHost || disabled}
          onClick={onPlayPause}
        >
          {playing ? (
            <Pause className="w-5 h-5 fill-current" />
          ) : (
            <Play className="w-5 h-5 fill-current ml-1" />
          )}
        </Button>
        
        <Button 
          variant="outline" 
          size="icon" 
          className={`w-10 h-10 rounded-full border-white/10 bg-black/40 ${isHost && !disabled ? 'hover:bg-white/10' : 'opacity-50'}`}
          disabled={!isHost || disabled}
          onClick={onSkip}
        >
          <SkipForward className="w-4 h-4" />
        </Button>
      </div>
      
      <div className="flex items-center gap-3 text-muted-foreground">
        <Volume2 className="w-4 h-4" />
        <div className="w-24 h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div className="w-2/3 h-full bg-primary/80 rounded-full"></div>
        </div>
      </div>
    </div>
  );
}
