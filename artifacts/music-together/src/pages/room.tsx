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
    <div className="h-screen overflow-hidden w-full bg-background flex flex-col petal-bg font-sans">
      {/* Header */}
      <header className="h-20 border-b border-primary/5 bg-white/40 backdrop-blur-md flex items-center justify-between px-8 shrink-0 z-20 sticky top-0">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 soft-glow">
            <Music className="w-5 h-5 text-primary" />
          </div>
          <h1 className="font-serif text-2xl tracking-tight hidden sm:block italic font-medium text-foreground">Music Together</h1>
          <div className="h-6 w-px bg-primary/10 mx-2 hidden sm:block"></div>
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground bg-primary/5 px-4 py-1.5 rounded-full border border-primary/10">
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-primary animate-pulse' : 'bg-red-400'}`}></span>
            {connected ? 'Đang phát trực tiếp' : 'Đang kết nối lại...'}
          </div>
        </div>

        <div className="flex items-center gap-6">
          {roomState && (
            <div className="flex -space-x-3 mr-2">
              {roomState.listeners.slice(0, 4).map((listener, i) => (
                <div key={i} className="w-10 h-10 rounded-full bg-card border-2 border-white flex items-center justify-center text-xs font-semibold text-primary shadow-sm relative group transition-transform hover:-translate-y-1" title={listener}>
                  {listener.charAt(0).toUpperCase()}
                  {listener === roomState.hostName && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full border-2 border-white flex items-center justify-center">
                      <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                    </span>
                  )}
                </div>
              ))}
              {roomState.listeners.length > 4 && (
                <div className="w-10 h-10 rounded-full bg-muted border-2 border-white flex items-center justify-center text-xs font-bold text-muted-foreground shadow-sm">
                  +{roomState.listeners.length - 4}
                </div>
              )}
            </div>
          )}
          
          <Button variant="ghost" size="sm" className="hidden sm:flex gap-2 text-primary hover:bg-primary/5 font-medium rounded-xl" onClick={handleCopyLink}>
            <Copy className="w-4 h-4" />
            Sao chép link
          </Button>
          
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-xl" onClick={handleLeave}>
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden flex flex-col lg:flex-row p-6 gap-6 z-10 relative min-h-0">
        {/* Background decorations */}
        <div className="absolute top-0 right-0 w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px] pointer-events-none -z-10"></div>
        <div className="absolute bottom-0 left-0 w-[30%] h-[30%] bg-secondary/5 rounded-full blur-[100px] pointer-events-none -z-10"></div>
        
        {/* Left Column: Player & Controls */}
        <div className="flex-1 flex flex-col gap-6 min-w-0 max-w-5xl mx-auto w-full overflow-y-auto min-h-0">
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
          
          <div className="flex-1 min-h-[400px] flex flex-col md:flex-row gap-6">
            <div className="flex-1 min-h-[400px] h-full">
              <PlaylistPanel 
                playlist={roomState?.playlist || []}
                currentTrack={roomState?.currentTrack || null}
                onRemoveTrack={handleRemoveTrack}
                isHost={isHost}
              />
            </div>
            <div className="flex-1 min-h-[400px] h-full">
              <SearchPanel onAddTrack={handleAddTrack} />
            </div>
          </div>
        </div>

        {/* Right Column: Chat */}
        <div className="w-full lg:w-[380px] xl:w-[420px] h-[500px] lg:h-auto shrink-0 flex flex-col min-h-0">
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
