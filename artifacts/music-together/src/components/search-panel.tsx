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
    <div className="flex flex-col h-full bg-card/40 border border-white/5 rounded-xl overflow-hidden glass-panel">
      <div className="p-4 border-b border-white/5 bg-black/20">
        <form onSubmit={handleSearch} className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search YouTube..." 
            className="pl-9 bg-black/40 border-white/10 h-10 rounded-full"
          />
        </form>
      </div>
      
      <ScrollArea className="flex-1 p-2">
        {isLoading ? (
          <div className="h-full flex items-center justify-center p-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : results && results.length > 0 ? (
          <div className="space-y-2">
            {results.map((video) => (
              <div key={video.videoId} className="group flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 border border-transparent transition-colors">
                <div className="relative w-16 h-12 rounded overflow-hidden flex-shrink-0 bg-black/50">
                  <img src={video.thumbnail} alt="" className="w-full h-full object-cover" />
                </div>
                
                <div className="flex-1 min-w-0 pr-8">
                  <h4 className="text-sm font-medium text-foreground truncate">{video.title}</h4>
                  <p className="text-xs text-muted-foreground truncate">{video.channelTitle}</p>
                </div>
                
                <Button 
                  size="icon" 
                  variant="ghost"
                  className="h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity text-primary hover:text-primary-foreground hover:bg-primary shrink-0"
                  onClick={() => handleAdd(video)}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        ) : searchQuery ? (
          <div className="text-center text-muted-foreground p-8 opacity-70">
            <p className="text-sm">No results found for "{searchQuery}"</p>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground space-y-3 opacity-40 py-12">
            <Search className="w-8 h-8 mb-2" />
            <p className="text-sm">Search for songs to add to the queue</p>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
