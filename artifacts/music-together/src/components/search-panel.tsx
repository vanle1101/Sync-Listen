import { useState } from "react";
import { Track } from "@/lib/types";
import { useYoutubeSearch, getYoutubeSearchQueryKey } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus, Loader2, Check } from "lucide-react";

interface SearchPanelProps {
  onAddTrack: (track: Track) => void;
}

export function SearchPanel({ onAddTrack }: SearchPanelProps) {
  const [query, setQuery] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  
  const { data: results, isLoading } = useYoutubeSearch(
    { q: searchQuery }, 
    { query: { enabled: !!searchQuery, queryKey: getYoutubeSearchQueryKey({ q: searchQuery }) } }
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      setSearchQuery(query.trim());
    }
  };

  const handleAdd = (video: any) => {
    onAddTrack({
      videoId: video.videoId,
      title: video.title,
      channelTitle: video.channelTitle,
      thumbnail: video.thumbnail,
      duration: video.duration
    });
    setAddedIds(prev => new Set([...prev, video.videoId]));
    setTimeout(() => {
      setAddedIds(prev => { const next = new Set(prev); next.delete(video.videoId); return next; });
    }, 2000);
  };

  return (
    <div className="flex flex-col h-full bloom-card overflow-hidden border-none">
      <div className="p-5 border-b border-primary/5 bg-white/60">
        <form onSubmit={handleSearch} className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-primary/40" />
          <Input 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm kiếm bài hát..." 
            className="pl-11 bg-white border-primary/10 h-12 rounded-2xl shadow-sm focus-visible:ring-primary/20"
          />
        </form>
      </div>
      
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 min-h-0">
        {isLoading ? (
          <div className="h-full flex items-center justify-center p-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary/60" />
          </div>
        ) : results && results.length > 0 ? (
          <div className="space-y-2">
            {results.map((video) => (
              <div key={video.videoId} className="relative flex items-center gap-3 p-3 pr-14 rounded-2xl hover:bg-white border border-transparent transition-all duration-300 hover:shadow-md hover:border-primary/10">
                <div className="relative w-16 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-muted shadow-sm">
                  <img src={video.thumbnail} alt="" className="w-full h-full object-cover" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-foreground leading-snug line-clamp-2">{video.title}</h4>
                  <p className="text-xs text-muted-foreground/70 mt-0.5">{video.channelTitle}</p>
                </div>
                
                <Button 
                  size="icon" 
                  variant="ghost"
                  className={`absolute right-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-xl transition-all active:scale-95 border ${
                    addedIds.has(video.videoId)
                      ? 'text-white bg-secondary border-secondary'
                      : 'text-primary hover:text-white hover:bg-primary border-primary/20 hover:border-primary'
                  }`}
                  onClick={() => handleAdd(video)}
                  title="Thêm vào hàng đợi"
                  aria-label="Thêm vào hàng đợi"
                >
                  {addedIds.has(video.videoId) ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                </Button>
              </div>
            ))}
          </div>
        ) : searchQuery ? (
          <div className="text-center text-muted-foreground/60 p-12 italic">
            <p className="text-sm">Không tìm thấy kết quả cho "{searchQuery}"</p>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground/60 space-y-4 py-16">
            <div className="w-12 h-12 rounded-full bg-primary/5 flex items-center justify-center">
              <Search className="w-6 h-6 text-primary/40" />
            </div>
            <p className="text-sm font-medium">Tìm kiếm bài hát để thêm vào hàng đợi</p>
          </div>
        )}
      </div>
    </div>
  );
}
