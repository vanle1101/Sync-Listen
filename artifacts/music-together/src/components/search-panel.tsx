import { useState } from "react";
import { Track } from "@/lib/types";
import { useYoutubeSearch, getYoutubeSearchQueryKey } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Plus, Loader2 } from "lucide-react";

interface SearchPanelProps {
  onAddTrack: (track: Track) => void;
}

export function SearchPanel({ onAddTrack }: SearchPanelProps) {
  const [query, setQuery] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  
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
    // Visual feedback could go here
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
      
      <ScrollArea className="flex-1 p-3">
        {isLoading ? (
          <div className="h-full flex items-center justify-center p-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary/60" />
          </div>
        ) : results && results.length > 0 ? (
          <div className="space-y-2">
            {results.map((video) => (
              <div key={video.videoId} className="group flex items-center gap-4 p-3 rounded-2xl hover:bg-white border border-transparent transition-all duration-300 hover:shadow-md">
                <div className="relative w-20 h-14 rounded-xl overflow-hidden flex-shrink-0 bg-muted shadow-sm">
                  <img src={video.thumbnail} alt="" className="w-full h-full object-cover" />
                </div>
                
                <div className="flex-1 min-w-0 pr-8">
                  <h4 className="text-sm font-semibold text-foreground truncate">{video.title}</h4>
                  <p className="text-xs text-muted-foreground/70 truncate mt-0.5">{video.channelTitle}</p>
                </div>
                
                <Button 
                  size="icon" 
                  variant="ghost"
                  className="h-10 w-10 rounded-2xl opacity-0 group-hover:opacity-100 transition-all text-primary hover:text-white hover:bg-primary shadow-sm active:scale-95 shrink-0"
                  onClick={() => handleAdd(video)}
                >
                  <Plus className="w-5 h-5" />
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
      </ScrollArea>
    </div>
  );
}
