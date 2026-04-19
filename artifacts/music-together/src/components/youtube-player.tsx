import { useEffect, useRef, useState } from "react";
import { Track } from "@/lib/types";

// Add YouTube type declarations
declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

interface YoutubePlayerProps {
  currentTrack: Track | null;
  playing: boolean;
  serverTime: number;
  isHost: boolean;
  onStateChange?: (playing: boolean, currentTime: number) => void;
  onTrackEnd?: () => void;
}

export function YoutubePlayer({
  currentTrack,
  playing,
  serverTime,
  isHost,
  onStateChange,
  onTrackEnd
}: YoutubePlayerProps) {
  const playerRef = useRef<any>(null);
  const [isReady, setIsReady] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastSyncTime = useRef<number>(0);
  const heartbeatInterval = useRef<NodeJS.Timeout | null>(null);
  const internalPlayingState = useRef<boolean>(false);

  // Initialize YouTube API
  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName("script")[0];
      if (firstScriptTag.parentNode) {
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
      }
      
      window.onYouTubeIframeAPIReady = () => {
        initPlayer();
      };
    } else if (!playerRef.current) {
      initPlayer();
    }

    function initPlayer() {
      playerRef.current = new window.YT.Player(containerRef.current, {
        height: "100%",
        width: "100%",
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          iv_load_policy: 3
        },
        events: {
          onReady: () => {
            setIsReady(true);
          },
          onStateChange: (event: any) => {
            if (!isHost) return;
            
            const PLAYING = window.YT.PlayerState.PLAYING;
            const PAUSED = window.YT.PlayerState.PAUSED;
            const ENDED = window.YT.PlayerState.ENDED;
            
            if (event.data === PLAYING) {
              internalPlayingState.current = true;
              onStateChange?.(true, playerRef.current.getCurrentTime());
            } else if (event.data === PAUSED) {
              internalPlayingState.current = false;
              onStateChange?.(false, playerRef.current.getCurrentTime());
            } else if (event.data === ENDED) {
              internalPlayingState.current = false;
              onTrackEnd?.();
            }
          }
        }
      });
    }

    return () => {
      if (playerRef.current && playerRef.current.destroy) {
        playerRef.current.destroy();
      }
      if (heartbeatInterval.current) {
        clearInterval(heartbeatInterval.current);
      }
    };
  }, []);

  // Handle track changes
  useEffect(() => {
    if (!isReady || !playerRef.current) return;

    if (currentTrack) {
      const currentVideoId = playerRef.current.getVideoData?.()?.video_id;
      if (currentVideoId !== currentTrack.videoId) {
        playerRef.current.loadVideoById(currentTrack.videoId, serverTime);
        if (!playing) {
          playerRef.current.pauseVideo();
        }
      }
    } else {
      playerRef.current.stopVideo();
    }
  }, [currentTrack?.videoId, isReady]);

  // Handle playback state and sync from server
  useEffect(() => {
    if (!isReady || !playerRef.current || !currentTrack) return;

    internalPlayingState.current = playing;
    
    try {
      if (playing) {
        playerRef.current.playVideo();
      } else {
        playerRef.current.pauseVideo();
      }

      // Sync time if diff > 2 seconds
      const playerTime = playerRef.current.getCurrentTime() || 0;
      if (Math.abs(playerTime - serverTime) > 2) {
        playerRef.current.seekTo(serverTime, true);
      }
    } catch (err) {
      console.error("YT Player error", err);
    }
  }, [playing, serverTime, isReady, currentTrack]);

  // Host heartbeat
  useEffect(() => {
    if (isHost && isReady) {
      heartbeatInterval.current = setInterval(() => {
        if (internalPlayingState.current && playerRef.current) {
          const currentTime = playerRef.current.getCurrentTime();
          onStateChange?.(true, currentTime);
        }
      }, 5000);
    }
    
    return () => {
      if (heartbeatInterval.current) {
        clearInterval(heartbeatInterval.current);
      }
    };
  }, [isHost, isReady, onStateChange]);

  return (
    <div className="relative w-full pt-[56.25%] bg-white rounded-[2rem] overflow-hidden border border-primary/10 group shadow-2xl soft-glow">
      {/* YT player is pushed back and pointer events disabled to prevent direct interaction, we use custom controls */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-90 group-hover:opacity-100 transition-opacity duration-700">
        <div ref={containerRef} id="youtube-player" className="w-full h-full scale-[1.1]"></div>
      </div>
      
      {!currentTrack && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center text-primary/40">
          <div className="w-20 h-20 rounded-full bg-primary/5 flex items-center justify-center mb-6 soft-glow">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>
          </div>
          <p className="text-lg font-serif italic font-medium tracking-wide">Chưa có bài hát đang phát</p>
        </div>
      )}
      
      {/* Overlay to catch clicks and prevent youtube's default controls from interfering */}
      <div className="absolute inset-0 z-20 pointer-events-auto bg-transparent"></div>
      
      {/* Current track info overlay */}
      {currentTrack && (
        <div className="absolute bottom-0 left-0 right-0 p-8 z-30 bg-gradient-to-t from-white/95 via-white/60 to-transparent pointer-events-none backdrop-blur-[2px]">
          <div className="flex items-end gap-6">
            {currentTrack.thumbnail && (
              <img src={currentTrack.thumbnail} alt={currentTrack.title} className="w-20 h-20 rounded-2xl shadow-lg object-cover border-2 border-white transform transition-transform group-hover:scale-105" />
            )}
            <div className="flex-1 min-w-0 pb-1">
              <h2 className="text-2xl font-serif italic font-semibold text-foreground truncate drop-shadow-sm">{currentTrack.title}</h2>
              <p className="text-primary/70 font-medium truncate mt-1">{currentTrack.channelTitle}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
