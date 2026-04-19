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
    <div className="flex items-center justify-between bg-white/60 backdrop-blur-xl border border-primary/5 p-5 rounded-3xl shadow-[0_10px_40px_rgba(192,112,128,0.12)] mt-6 soft-glow">
      <div className="flex items-center gap-4">
        {!isHost && (
          <div className="text-xs font-medium text-primary/70 bg-primary/5 px-4 py-1.5 rounded-full flex items-center gap-2 border border-primary/10">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
            Chỉ host mới điều khiển
          </div>
        )}
      </div>
      
      <div className="flex items-center justify-center gap-6 flex-1">
        <Button 
          variant="outline" 
          size="icon" 
          className={`w-14 h-14 rounded-full border-primary/10 bg-white shadow-sm transition-all duration-300 ${isHost && !disabled ? 'hover:bg-primary/5 hover:border-primary/30 hover:scale-110 active:scale-95 text-primary' : 'opacity-40 cursor-not-allowed'}`}
          disabled={!isHost || disabled}
          onClick={onPlayPause}
        >
          {playing ? (
            <Pause className="w-6 h-6 fill-current" />
          ) : (
            <Play className="w-6 h-6 fill-current ml-1" />
          )}
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
      
      <div className="flex items-center gap-3 text-primary/60">
        <Volume2 className="w-5 h-5" />
        <div className="w-28 h-2 bg-primary/10 rounded-full overflow-hidden shadow-inner">
          <div className="w-2/3 h-full bg-gradient-to-r from-primary to-secondary rounded-full opacity-70"></div>
        </div>
      </div>
    </div>
  );
}
