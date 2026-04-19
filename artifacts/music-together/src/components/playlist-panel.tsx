import { Track } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Trash2, Music, Play } from "lucide-react";

interface PlaylistPanelProps {
  playlist: Track[];
  currentTrack: Track | null;
  onRemoveTrack: (index: number) => void;
  isHost: boolean;
}

export function PlaylistPanel({ playlist, currentTrack, onRemoveTrack, isHost }: PlaylistPanelProps) {
  const totalCount = (currentTrack ? 1 : 0) + playlist.length;

  return (
    <div className="flex flex-col h-full bloom-card overflow-hidden border-none">
      <div className="p-5 border-b border-primary/5 bg-white/60 flex justify-between items-center">
        <h3 className="text-base font-medium text-foreground flex items-center gap-2">
          <Music className="w-5 h-5 text-primary" />
          Hàng đợi
        </h3>
        <div className="text-xs font-semibold bg-primary/10 text-primary px-3 py-1 rounded-full border border-primary/5">
          {totalCount} bài hát
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 min-h-0">
        {!currentTrack && playlist.length === 0 ? (
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
            {currentTrack && (
              <div className="relative flex items-center gap-3 p-3 rounded-2xl bg-primary/5 border border-primary/20 shadow-sm">
                <div className="relative w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 bg-muted shadow-sm">
                  {currentTrack.thumbnail ? (
                    <img src={currentTrack.thumbnail} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-primary/5">
                      <Music className="w-5 h-5 text-primary/30" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-primary/20 backdrop-blur-[1px] flex items-center justify-center">
                    <div className="flex gap-0.5 items-end h-4">
                      <span className="w-1 h-4 bg-white rounded-full animate-[bounce_0.5s_infinite_alternate]"></span>
                      <span className="w-1 h-2 bg-white rounded-full animate-[bounce_0.6s_infinite_alternate]"></span>
                      <span className="w-1 h-5 bg-white rounded-full animate-[bounce_0.7s_infinite_alternate]"></span>
                    </div>
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <Play className="w-3 h-3 text-primary fill-primary flex-shrink-0" />
                    <span className="text-[10px] font-semibold text-primary uppercase tracking-wide">Đang phát</span>
                  </div>
                  <h4 className="text-sm font-semibold text-primary line-clamp-2 leading-snug">{currentTrack.title}</h4>
                  <p className="text-xs text-muted-foreground/70 mt-0.5">{currentTrack.channelTitle}</p>
                </div>
              </div>
            )}

            {playlist.length > 0 && (
              <>
                {currentTrack && (
                  <div className="px-2 py-1">
                    <p className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wider">Tiếp theo</p>
                  </div>
                )}
                {playlist.map((track, i) => (
                  <div
                    key={`${track.videoId}-${i}`}
                    className="relative flex items-center gap-3 p-3 pr-12 rounded-2xl hover:bg-white border border-transparent hover:shadow-md hover:border-primary/10 transition-all duration-300"
                  >
                    <div className="relative w-12 h-10 rounded-xl overflow-hidden flex-shrink-0 bg-muted shadow-sm">
                      {track.thumbnail ? (
                        <img src={track.thumbnail} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-primary/5">
                          <Music className="w-4 h-4 text-primary/30" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-foreground line-clamp-2 leading-snug">{track.title}</h4>
                      <p className="text-xs text-muted-foreground/70 mt-0.5">{track.channelTitle}</p>
                    </div>

                    {isHost && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground/40 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                        onClick={() => onRemoveTrack(i)}
                        title="Xoá khỏi hàng đợi"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
