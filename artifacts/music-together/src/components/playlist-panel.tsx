import { Track } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Trash2, Music } from "lucide-react";

interface PlaylistPanelProps {
  playlist: Track[];
  currentTrack: Track | null;
  onRemoveTrack: (index: number) => void;
  isHost: boolean;
}

export function PlaylistPanel({ playlist, currentTrack, onRemoveTrack, isHost }: PlaylistPanelProps) {
  return (
    <div className="flex flex-col h-full bg-card/40 border border-white/5 rounded-xl overflow-hidden glass-panel">
      <div className="p-4 border-b border-white/5 bg-black/20 flex justify-between items-center">
        <h3 className="font-mono text-sm tracking-wider uppercase flex items-center gap-2">
          <Music className="w-4 h-4 text-primary" />
          Queue
        </h3>
        <div className="text-xs bg-white/10 px-2 py-0.5 rounded text-muted-foreground">
          {playlist.length} {playlist.length === 1 ? 'song' : 'songs'}
        </div>
      </div>
      
      <ScrollArea className="flex-1 p-2">
        {playlist.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground space-y-3 opacity-50 py-12">
            <Music className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-sm">Queue is empty</p>
            <p className="text-xs">Add the first song!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {playlist.map((track, i) => {
              const isPlaying = currentTrack?.videoId === track.videoId && i === 0;
              
              return (
                <div 
                  key={`${track.videoId}-${i}`} 
                  className={`group relative flex items-center gap-3 p-2 rounded-lg transition-colors ${
                    isPlaying 
                      ? 'bg-primary/20 border border-primary/30' 
                      : 'hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <div className="relative w-12 h-12 rounded overflow-hidden flex-shrink-0 bg-black/50">
                    {track.thumbnail ? (
                      <img src={track.thumbnail} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-white/5">
                        <Music className="w-4 h-4 text-muted-foreground" />
                      </div>
                    )}
                    {isPlaying && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <div className="flex gap-0.5 items-end h-3">
                          <span className="w-0.5 h-3 bg-primary animate-[bounce_0.5s_infinite_alternate]"></span>
                          <span className="w-0.5 h-2 bg-primary animate-[bounce_0.6s_infinite_alternate]"></span>
                          <span className="w-0.5 h-3.5 bg-primary animate-[bounce_0.7s_infinite_alternate]"></span>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0 pr-8">
                    <h4 className={`text-sm font-medium truncate ${isPlaying ? 'text-primary' : 'text-foreground'}`}>
                      {track.title}
                    </h4>
                    <p className="text-xs text-muted-foreground truncate">{track.channelTitle}</p>
                  </div>
                  
                  <div className="absolute right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/20"
                      onClick={() => onRemoveTrack(i)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
