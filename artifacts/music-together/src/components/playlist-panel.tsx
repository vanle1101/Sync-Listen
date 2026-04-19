import { Track } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Trash2, Music } from "lucide-react";

interface PlaylistPanelProps {
  playlist: Track[];
  currentTrack: Track | null;
  onRemoveTrack: (index: number) => void;
  isHost: boolean;
}

export function PlaylistPanel({ playlist, currentTrack, onRemoveTrack, isHost }: PlaylistPanelProps) {
  return (
    <div className="flex flex-col h-full bloom-card overflow-hidden border-none">
      <div className="p-5 border-b border-primary/5 bg-white/60 flex justify-between items-center">
        <h3 className="text-base font-medium text-foreground flex items-center gap-2">
          <Music className="w-5 h-5 text-primary" />
          Hàng đợi
        </h3>
        <div className="text-xs font-semibold bg-primary/10 text-primary px-3 py-1 rounded-full border border-primary/5">
          {playlist.length} bài hát
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-3 min-h-0">
        {playlist.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground/60 space-y-4 py-16">
            <div className="w-12 h-12 rounded-full bg-primary/5 flex items-center justify-center">
              <Music className="w-6 h-6 text-primary/40" />
            </div>
            <div>
              <p className="text-sm font-medium">Chưa có bài hát nào</p>
              <p className="text-xs">Hãy thêm bài đầu tiên!</p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {playlist.map((track, i) => {
              const isPlaying = currentTrack?.videoId === track.videoId && i === 0;
              
              return (
                <div 
                  key={`${track.videoId}-${i}`} 
                  className={`group relative flex items-center gap-4 p-3 rounded-2xl transition-all duration-300 ${
                    isPlaying 
                      ? 'bg-primary/5 border border-primary/20 shadow-sm' 
                      : 'hover:bg-white border border-transparent hover:shadow-md'
                  }`}
                >
                  <div className="relative w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 bg-muted shadow-sm">
                    {track.thumbnail ? (
                      <img src={track.thumbnail} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-primary/5">
                        <Music className="w-5 h-5 text-primary/30" />
                      </div>
                    )}
                    {isPlaying && (
                      <div className="absolute inset-0 bg-primary/20 backdrop-blur-[1px] flex items-center justify-center">
                        <div className="flex gap-1 items-end h-4">
                          <span className="w-1 h-4 bg-white rounded-full animate-[bounce_0.5s_infinite_alternate]"></span>
                          <span className="w-1 h-2 bg-white rounded-full animate-[bounce_0.6s_infinite_alternate]"></span>
                          <span className="w-1 h-5 bg-white rounded-full animate-[bounce_0.7s_infinite_alternate]"></span>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h4 className={`text-sm font-semibold truncate ${isPlaying ? 'text-primary' : 'text-foreground'}`}>
                      {track.title}
                    </h4>
                    <p className="text-xs text-muted-foreground/70 truncate mt-0.5">{track.channelTitle}</p>
                  </div>
                  
                  {isHost && (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-9 w-9 text-muted-foreground/40 hover:text-red-500 hover:bg-red-50 rounded-xl shrink-0 transition-all"
                      onClick={() => onRemoveTrack(i)}
                      title="Xoá khỏi hàng đợi"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
