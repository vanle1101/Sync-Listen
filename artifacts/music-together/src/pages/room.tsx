import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useWebSocket } from "@/hooks/use-websocket";
import { Track } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { YoutubePlayer } from "@/components/youtube-player";
import { PlayerControls } from "@/components/player-controls";
import { PlaylistPanel } from "@/components/playlist-panel";
import { SearchPanel } from "@/components/search-panel";
import { ChatPanel } from "@/components/chat-panel";
import { Copy, LogOut, Loader2, Music } from "lucide-react";
import { useGetRoom, getGetRoomQueryKey } from "@workspace/api-client-react";

export default function Room() {
  const params = useParams();
  const roomId = params.roomId as string;
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [userName, setUserName] = useState<string | null>(null);
  
  useEffect(() => {
    const name = sessionStorage.getItem("music-together-name");
    if (!name) {
      toast({
        title: "Name required",
        description: "Please enter your name to join a room.",
        variant: "destructive"
      });
      setLocation("/");
      return;
    }
    setUserName(name);
  }, [setLocation, toast]);

  const { data: roomInfo, isLoading: isLoadingRoom, error: roomError } = useGetRoom(roomId, {
    query: { enabled: !!roomId, queryKey: getGetRoomQueryKey(roomId) }
  });

  const { roomState, connected, error: wsError, sendAction } = useWebSocket(roomId, userName);

  useEffect(() => {
    if (roomError) {
      toast({
        title: "Room not found",
        description: "This room doesn't exist or has been closed.",
        variant: "destructive"
      });
      setLocation("/");
    }
  }, [roomError, setLocation, toast]);

  const isHost = roomState?.hostName === userName;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast({
      title: "Link copied!",
      description: "Share this link with your friends to invite them.",
    });
  };

  const handleLeave = () => {
    sessionStorage.removeItem("music-together-name");
    setLocation("/");
  };

  const handleAddTrack = (track: Track) => {
    sendAction({ type: "add_track", track });
  };

  const handleRemoveTrack = (index: number) => {
    sendAction({ type: "remove_track", index });
  };

  const handlePlayPause = () => {
    if (!roomState) return;
    sendAction({ 
      type: "play_pause", 
      playing: !roomState.playing, 
      currentTime: roomState.currentTime 
    });
  };

  const handleSkip = () => {
    sendAction({ type: "skip" });
  };

  const handlePlayerStateChange = (playing: boolean, currentTime: number) => {
    if (!isHost) return;
    // We send periodic seeks or play_pause updates
    sendAction({ type: "seek", currentTime });
  };

  const handleTrackEnd = () => {
    if (isHost) {
      handleSkip();
    }
  };

  const handleSendMessage = (text: string) => {
    sendAction({ type: "chat", text });
  };

  if (isLoadingRoom || !userName) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-background flex flex-col">
      {/* Header */}
      <header className="h-16 border-b border-white/5 bg-black/20 flex items-center justify-between px-6 shrink-0 z-10 relative">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-primary/20 flex items-center justify-center border border-primary/30 neon-glow">
            <Music className="w-4 h-4 text-primary" />
          </div>
          <h1 className="font-bold text-lg tracking-tight hidden sm:block">Music Together</h1>
          <div className="h-4 w-px bg-white/10 mx-2 hidden sm:block"></div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-white/5 px-3 py-1 rounded-full border border-white/5">
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
            {connected ? 'Live' : 'Reconnecting...'}
          </div>
        </div>

        <div className="flex items-center gap-4">
          {roomState && (
            <div className="flex -space-x-2 mr-2">
              {roomState.listeners.slice(0, 3).map((listener, i) => (
                <div key={i} className="w-8 h-8 rounded-full bg-secondary border border-background flex items-center justify-center text-xs font-medium text-foreground relative group" title={listener}>
                  {listener.charAt(0).toUpperCase()}
                  {listener === roomState.hostName && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-accent rounded-full border border-background"></span>
                  )}
                </div>
              ))}
              {roomState.listeners.length > 3 && (
                <div className="w-8 h-8 rounded-full bg-white/10 border border-background flex items-center justify-center text-xs font-medium">
                  +{roomState.listeners.length - 3}
                </div>
              )}
            </div>
          )}
          
          <Button variant="outline" size="sm" className="hidden sm:flex gap-2 border-white/10 bg-white/5 hover:bg-white/10 text-foreground" onClick={handleCopyLink}>
            <Copy className="w-4 h-4 text-muted-foreground" />
            Copy Link
          </Button>
          
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-white" onClick={handleLeave}>
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden flex flex-col lg:flex-row p-4 gap-4 z-10 relative">
        {/* Background decorations */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-[500px] bg-primary/10 rounded-full blur-[150px] pointer-events-none -z-10"></div>
        
        {/* Left Column: Player & Controls */}
        <div className="flex-1 flex flex-col gap-4 min-w-0 max-w-4xl mx-auto w-full">
          <div className="w-full">
            <YoutubePlayer 
              currentTrack={roomState?.currentTrack || null}
              playing={roomState?.playing || false}
              serverTime={roomState?.currentTime || 0}
              isHost={isHost}
              onStateChange={handlePlayerStateChange}
              onTrackEnd={handleTrackEnd}
            />
            
            <PlayerControls 
              isHost={isHost}
              playing={roomState?.playing || false}
              onPlayPause={handlePlayPause}
              onSkip={handleSkip}
              disabled={!roomState?.currentTrack}
            />
          </div>
          
          <div className="flex-1 min-h-[300px] flex flex-col md:flex-row gap-4">
            <div className="flex-1 min-h-[300px] h-full">
              <PlaylistPanel 
                playlist={roomState?.playlist || []}
                currentTrack={roomState?.currentTrack || null}
                onRemoveTrack={handleRemoveTrack}
                isHost={isHost}
              />
            </div>
            <div className="flex-1 min-h-[300px] h-full">
              <SearchPanel onAddTrack={handleAddTrack} />
            </div>
          </div>
        </div>

        {/* Right Column: Chat */}
        <div className="w-full lg:w-[350px] xl:w-[400px] h-[400px] lg:h-auto shrink-0 flex flex-col">
          <ChatPanel 
            messages={roomState?.chatHistory || []}
            onSendMessage={handleSendMessage}
            currentUser={userName || ""}
          />
        </div>
      </main>
    </div>
  );
}
