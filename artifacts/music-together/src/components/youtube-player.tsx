import { useEffect, useRef, useState } from "react";
import { Track } from "@/lib/types";

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
  volume: number;
  onStateChange?: (playing: boolean, currentTime: number) => void;
  onTrackEnd?: () => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
}

export function YoutubePlayer({
  currentTrack,
  playing,
  serverTime,
  isHost,
  volume,
  onStateChange,
  onTrackEnd,
  onTimeUpdate,
}: YoutubePlayerProps) {
  const playerRef = useRef<any>(null);
  const [isReady, setIsReady] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastSyncTime = useRef<number>(0);
  const heartbeatInterval = useRef<NodeJS.Timeout | null>(null);
  const timeUpdateInterval = useRef<NodeJS.Timeout | null>(null);
  const internalPlayingState = useRef<boolean>(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const silentSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const playingRef = useRef(playing);

  // Keep playingRef in sync for visibility handler closure
  useEffect(() => { playingRef.current = playing; }, [playing]);

  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName("script")[0];
      if (firstScriptTag.parentNode) {
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
      }
      window.onYouTubeIframeAPIReady = () => { initPlayer(); };
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
          iv_load_policy: 3,
        },
        events: {
          onReady: () => { setIsReady(true); },
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
          },
        },
      });
    }

    return () => {
      if (playerRef.current?.destroy) playerRef.current.destroy();
      if (heartbeatInterval.current) clearInterval(heartbeatInterval.current);
      if (timeUpdateInterval.current) clearInterval(timeUpdateInterval.current);
    };
  }, []);

  // Track changes
  useEffect(() => {
    if (!isReady || !playerRef.current) return;
    if (currentTrack) {
      const currentVideoId = playerRef.current.getVideoData?.()?.video_id;
      if (currentVideoId !== currentTrack.videoId) {
        playerRef.current.loadVideoById(currentTrack.videoId, serverTime);
        if (!playing) playerRef.current.pauseVideo();
      }
    } else {
      playerRef.current.stopVideo();
    }
  }, [currentTrack?.videoId, isReady]);

  // Track prev serverTime to detect explicit seeks
  const prevServerTimeRef = useRef<number>(serverTime);
  const prevServerTimeStampRef = useRef<number>(Date.now());

  // Playback sync
  useEffect(() => {
    if (!isReady || !playerRef.current || !currentTrack) return;
    internalPlayingState.current = playing;
    try {
      if (playing) {
        playerRef.current.playVideo();
      } else {
        playerRef.current.pauseVideo();
      }
      const playerTime = playerRef.current.getCurrentTime() || 0;

      // Detect explicit seek vs natural playback drift
      const elapsed = (Date.now() - prevServerTimeStampRef.current) / 1000;
      const expectedServerTime = prevServerTimeRef.current + (playing ? elapsed : 0);
      const isExplicitSeek = Math.abs(serverTime - expectedServerTime) > 1;
      const driftThreshold = isExplicitSeek ? 0.5 : 2;

      if (Math.abs(playerTime - serverTime) > driftThreshold) {
        playerRef.current.seekTo(serverTime, true);
      }

      prevServerTimeRef.current = serverTime;
      prevServerTimeStampRef.current = Date.now();
    } catch (err) {
      console.error("YT Player error", err);
    }
  }, [playing, serverTime, isReady, currentTrack]);

  // Volume sync
  useEffect(() => {
    if (!isReady || !playerRef.current) return;
    try {
      playerRef.current.setVolume(volume);
    } catch {}
  }, [volume, isReady]);

  // Host heartbeat
  useEffect(() => {
    if (isHost && isReady) {
      heartbeatInterval.current = setInterval(() => {
        if (internalPlayingState.current && playerRef.current) {
          onStateChange?.(true, playerRef.current.getCurrentTime());
        }
      }, 5000);
    }
    return () => { if (heartbeatInterval.current) clearInterval(heartbeatInterval.current); };
  }, [isHost, isReady, onStateChange]);

  // Time update for seek bar
  useEffect(() => {
    if (!isReady) return;
    timeUpdateInterval.current = setInterval(() => {
      if (playerRef.current) {
        try {
          const ct = playerRef.current.getCurrentTime?.() ?? 0;
          const dur = playerRef.current.getDuration?.() ?? 0;
          onTimeUpdate?.(ct, dur);
        } catch {}
      }
    }, 500);
    return () => { if (timeUpdateInterval.current) clearInterval(timeUpdateInterval.current); };
  }, [isReady, onTimeUpdate]);

  // ── Silent Web Audio loop ────────────────────────────────────────────────
  // Keeps the browser's audio context alive so the page is treated as
  // "playing audio" — this prevents Android/Chromium from suspending the
  // YouTube iframe when the screen locks.
  const startSilentAudio = () => {
    try {
      const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AC) return;
      if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
        audioCtxRef.current = new AC();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      // Stop any existing source
      try { silentSourceRef.current?.stop(); } catch {}

      // 1-second silent buffer, looping forever
      const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      const gain = ctx.createGain();
      gain.gain.value = 0; // completely silent
      src.connect(gain);
      gain.connect(ctx.destination);
      src.start(0);
      silentSourceRef.current = src;
    } catch {}
  };

  const stopSilentAudio = () => {
    try {
      silentSourceRef.current?.stop();
      silentSourceRef.current = null;
    } catch {}
  };

  // Start/stop silent audio based on playback state
  useEffect(() => {
    if (playing && currentTrack) {
      startSilentAudio();
    } else {
      stopSilentAudio();
    }
  }, [playing, currentTrack?.videoId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopSilentAudio();
      try { audioCtxRef.current?.close(); } catch {}
    };
  }, []);

  // ── Page Visibility handler ───────────────────────────────────────────────
  // When the user unlocks the screen, resume AudioContext and re-sync player
  useEffect(() => {
    const handleVisibility = () => {
      if (!document.hidden) {
        // Resume audio context if it was suspended
        try { audioCtxRef.current?.resume(); } catch {}
        // If we should be playing, force the player to play
        if (playingRef.current && playerRef.current && isReady) {
          setTimeout(() => {
            try { playerRef.current?.playVideo(); } catch {}
          }, 300);
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [isReady]);

  // Unlock AudioContext on first user interaction (required by browser policy)
  useEffect(() => {
    const unlock = () => {
      try { audioCtxRef.current?.resume(); } catch {}
    };
    document.addEventListener('touchstart', unlock, { once: true });
    document.addEventListener('click', unlock, { once: true });
    return () => {
      document.removeEventListener('touchstart', unlock);
      document.removeEventListener('click', unlock);
    };
  }, []);

  // ── Media Session API ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    if (currentTrack) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.title,
        artist: currentTrack.channelTitle,
        artwork: [{ src: currentTrack.thumbnail, sizes: '120x90', type: 'image/jpeg' }],
      });
    } else {
      navigator.mediaSession.metadata = null;
    }
  }, [currentTrack]);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
  }, [playing]);

  useEffect(() => {
    if (!('mediaSession' in navigator) || !isHost || !isReady) return;
    navigator.mediaSession.setActionHandler('play', () => {
      playerRef.current?.playVideo();
      onStateChange?.(true, playerRef.current?.getCurrentTime() || 0);
    });
    navigator.mediaSession.setActionHandler('pause', () => {
      playerRef.current?.pauseVideo();
      onStateChange?.(false, playerRef.current?.getCurrentTime() || 0);
    });
    navigator.mediaSession.setActionHandler('nexttrack', () => onTrackEnd?.());
    navigator.mediaSession.setActionHandler('previoustrack', () => {
      const ct = playerRef.current?.getCurrentTime() || 0;
      if (ct > 3) {
        playerRef.current?.seekTo(0, true);
      } else {
        onStateChange?.(false, 0);
      }
    });
    // Seek forward/backward 10 seconds from lock screen
    navigator.mediaSession.setActionHandler('seekforward', (d) => {
      const skip = d.seekOffset ?? 10;
      const cur = playerRef.current?.getCurrentTime() || 0;
      playerRef.current?.seekTo(cur + skip, true);
    });
    navigator.mediaSession.setActionHandler('seekbackward', (d) => {
      const skip = d.seekOffset ?? 10;
      const cur = playerRef.current?.getCurrentTime() || 0;
      playerRef.current?.seekTo(Math.max(0, cur - skip), true);
    });
    return () => {
      try {
        ['play','pause','nexttrack','previoustrack','seekforward','seekbackward'].forEach(a => {
          navigator.mediaSession.setActionHandler(a as MediaSessionAction, null);
        });
      } catch {}
    };
  }, [isHost, isReady]);

  return (
    <div className="relative w-full pt-[56.25%] bg-white rounded-[2rem] overflow-hidden border border-primary/10 group shadow-2xl soft-glow">
      {/* YouTube player — hidden when no track to avoid black background */}
      <div
        className="absolute inset-0 z-0 pointer-events-none opacity-90 group-hover:opacity-100 transition-opacity duration-700"
        style={{ visibility: currentTrack ? 'visible' : 'hidden' }}
      >
        <div ref={containerRef} id="youtube-player" className="w-full h-full scale-[1.1]"></div>
      </div>

      {/* Cute placeholder when no track */}
      {!currentTrack && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-5"
          style={{ background: 'linear-gradient(135deg, #fdf6f0 0%, #fce8e8 50%, #eef5ef 100%)' }}>
          <div className="relative flex items-center justify-center">
            {/* Vinyl record */}
            <svg width="110" height="110" viewBox="0 0 110 110" fill="none" className="animate-[spin_8s_linear_infinite]">
              <circle cx="55" cy="55" r="54" fill="#3d2b1f" stroke="#5a3e2b" strokeWidth="2"/>
              <circle cx="55" cy="55" r="38" fill="#2a1f14" stroke="#5a3e2b" strokeWidth="1.5"/>
              <circle cx="55" cy="55" r="28" fill="#1a120a" stroke="#3d2b1f" strokeWidth="1"/>
              <circle cx="55" cy="55" r="18" fill="#2a1f14" stroke="#5a3e2b" strokeWidth="1"/>
              <circle cx="55" cy="55" r="8" fill="#c07060" stroke="#e09080" strokeWidth="1.5"/>
              <circle cx="55" cy="55" r="3" fill="#f5e8e0"/>
              {/* Light reflection */}
              <path d="M20 35 Q55 10 90 35" stroke="rgba(255,255,255,0.07)" strokeWidth="12" fill="none" strokeLinecap="round"/>
            </svg>
            {/* Tone arm */}
            <div className="absolute top-1 right-4 w-1 h-14 rounded-full origin-top"
              style={{ background: 'linear-gradient(to bottom, #c8a882, #a07050)', transform: 'rotate(28deg)', boxShadow: '0 2px 6px rgba(0,0,0,0.2)' }} />
          </div>

          {/* Floating notes */}
          <div className="absolute top-4 left-8 text-2xl animate-bounce" style={{ animationDelay: '0s', animationDuration: '2.5s', color: '#c07080' }}>♪</div>
          <div className="absolute top-8 right-10 text-xl animate-bounce" style={{ animationDelay: '0.8s', animationDuration: '3s', color: '#7a9e7e' }}>♫</div>
          <div className="absolute bottom-8 left-12 text-lg animate-bounce" style={{ animationDelay: '1.4s', animationDuration: '2.8s', color: '#c07080' }}>♩</div>
          <div className="absolute bottom-6 right-8 text-xl animate-bounce" style={{ animationDelay: '0.4s', animationDuration: '3.2s', color: '#7a9e7e' }}>♬</div>

          <div className="text-center mt-1">
            <p className="text-base font-serif italic font-semibold text-[#8c5f6a]">Chưa có bài hát đang phát</p>
            <p className="text-xs text-[#a07060]/70 mt-1">Thêm bài vào danh sách để bắt đầu</p>
          </div>
        </div>
      )}

      <div className="absolute inset-0 z-20 pointer-events-auto bg-transparent"></div>

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
