import { useEffect, useRef, useState } from "react";
import { Track } from "@/lib/types";
import { getApiUrl } from "@/lib/runtime-config";

declare global {
  interface Window {
    YT: any;
    SC: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

interface YoutubePlayerProps {
  currentTrack: Track | null;
  playing: boolean;
  serverTime: number;
  isHost: boolean;
  volume: number;
  fullscreen?: boolean;
  onStateChange?: (playing: boolean, currentTime: number) => void;
  onTrackEnd?: () => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
}

type PlaybackGestureDetail = {
  play?: boolean;
  track?: Track | null;
  currentTime?: number;
};

function getTrackSource(track: Track | null): "youtube" | "soundcloud" | "upload" {
  if (!track?.source || track.source === "youtube") return "youtube";
  if (track.source === "soundcloud") return "soundcloud";
  return "upload";
}

function toAbsoluteMediaUrl(url?: string): string {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  return getApiUrl(url);
}

function getSoundCloudLoadOptions(autoPlay: boolean) {
  return {
    auto_play: autoPlay,
    hide_related: true,
    show_comments: false,
    show_user: true,
    show_reposts: false,
    visual: true,
    sharing: false,
    buying: false,
    download: false,
  };
}

export function YoutubePlayer({
  currentTrack,
  playing,
  serverTime,
  isHost,
  volume,
  fullscreen = false,
  onStateChange,
  onTrackEnd,
  onTimeUpdate,
}: YoutubePlayerProps) {
  const source = getTrackSource(currentTrack);
  const sourceRef = useRef(source);
  const playingRef = useRef(playing);
  const currentTrackRef = useRef<Track | null>(currentTrack);
  const volumeRef = useRef(volume);
  const isHostRef = useRef(isHost);
  const onStateChangeRef = useRef(onStateChange);
  const onTrackEndRef = useRef(onTrackEnd);

  const ytContainerRef = useRef<HTMLDivElement>(null);
  const scIframeRef = useRef<HTMLIFrameElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const ytPlayerRef = useRef<any>(null);
  const scWidgetRef = useRef<any>(null);
  const scBoundRef = useRef(false);

  const [ytReady, setYtReady] = useState(false);
  const [scScriptReady, setScScriptReady] = useState(false);
  const [scReady, setScReady] = useState(false);
  const [ytErrorCode, setYtErrorCode] = useState<number | null>(null);
  const [iosUnlockPromptVisible, setIosUnlockPromptVisible] = useState(false);

  const heartbeatInterval = useRef<NodeJS.Timeout | null>(null);
  const timeUpdateInterval = useRef<NodeJS.Timeout | null>(null);
  const hiddenKeepAliveInterval = useRef<NodeJS.Timeout | null>(null);
  const wakeLockRetryTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audibilityTimersRef = useRef<NodeJS.Timeout[]>([]);
  const ignorePauseUntilRef = useRef<number>(0);
  const scHoldPlayUntilRef = useRef<number>(0);
  const scPauseIntentUntilRef = useRef<number>(0);
  const scPauseRecoverAttemptsRef = useRef<number>(0);
  const scLastPositionMsRef = useRef<number>(0);
  const scLastDurationMsRef = useRef<number>(0);
  const scPendingStartMsRef = useRef<number>(0);
  const scLoadedUrlRef = useRef<string>("");
  const scInitialSyncDoneRef = useRef<boolean>(false);
  const lastPlayCommandAtRef = useRef<number>(0);
  const lastPauseCommandAtRef = useRef<number>(0);
  const suppressAmbientUnlockUntilRef = useRef<number>(0);
  const lastDriftCorrectionAtRef = useRef<number>(0);
  const lastUploadRateAdjustmentAtRef = useRef<number>(0);
  const ytRetryKeyRef = useRef<string>("");

  const internalPlayingState = useRef<boolean>(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const silentSourceRef = useRef<AudioScheduledSourceNode | null>(null);
  const wakeLockRef = useRef<any>(null);
  const isAndroidRef = useRef<boolean>(
    typeof navigator !== "undefined" ? /Android/i.test(navigator.userAgent || "") : false,
  );
  const isIosSafariRef = useRef<boolean>(
    typeof navigator !== "undefined"
      ? /iP(hone|ad|od)/i.test(navigator.userAgent || "") &&
          /Safari/i.test(navigator.userAgent || "") &&
          !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(navigator.userAgent || "")
      : false,
  );

  useEffect(() => { sourceRef.current = source; }, [source]);
  useEffect(() => { playingRef.current = playing; }, [playing]);
  useEffect(() => { currentTrackRef.current = currentTrack; }, [currentTrack]);
  useEffect(() => { volumeRef.current = volume; }, [volume]);
  useEffect(() => { isHostRef.current = isHost; }, [isHost]);
  useEffect(() => { onStateChangeRef.current = onStateChange; }, [onStateChange]);
  useEffect(() => { onTrackEndRef.current = onTrackEnd; }, [onTrackEnd]);

  useEffect(() => {
    if (!isIosSafariRef.current) return;
    if (!currentTrack || !playing) {
      setIosUnlockPromptVisible(false);
      return;
    }

    const timer = setTimeout(() => {
      if (playingRef.current && currentTrackRef.current) {
        setIosUnlockPromptVisible(true);
      }
    }, 900);

    return () => clearTimeout(timer);
  }, [currentTrack?.videoId, currentTrack?.source, playing]);

  const ytErrorMessage = (() => {
    switch (ytErrorCode) {
      case 2:
        return {
          title: "Link video không hợp lệ",
          description: "Mã video YouTube này không đúng định dạng hoặc đã bị đổi.",
        };
      case 5:
        return {
          title: "Trình phát YouTube không đọc được video này",
          description: "Video này mở trên YouTube được nhưng iframe player không phát được trong web.",
        };
      case 100:
        return {
          title: "Video không còn khả dụng",
          description: "Video đã bị xóa, đặt riêng tư hoặc đổi quyền hiển thị.",
        };
      case 101:
      case 150:
        return {
          title: "Video chặn nhúng trên website",
          description: "Video vẫn có thể xem trên YouTube, nhưng chủ kênh không cho phát trong player nhúng.",
        };
      default:
        return null;
    }
  })();

  const hardStopSoundCloud = () => {
    scPauseIntentUntilRef.current = Date.now() + 3000;
    scHoldPlayUntilRef.current = 0;
    scPauseRecoverAttemptsRef.current = 0;
    try { scWidgetRef.current?.pause?.(); } catch {}
    setTimeout(() => {
      if (sourceRef.current === "soundcloud") return;
      try { scWidgetRef.current?.pause?.(); } catch {}
      try { scWidgetRef.current?.seekTo?.(0); } catch {}
      if (scIframeRef.current) {
        scIframeRef.current.src =
          "https://w.soundcloud.com/player/?url=https%3A//soundcloud.com&auto_play=false&show_comments=false&show_user=true&show_reposts=false&visual=true";
      }
      scLoadedUrlRef.current = "";
      scWidgetRef.current = null;
      scBoundRef.current = false;
      setScReady(false);
    }, 120);
  };

  const getActiveCurrentTime = (cb: (seconds: number) => void) => {
    const src = sourceRef.current;
    if (src === "youtube" && ytPlayerRef.current) {
      cb(ytPlayerRef.current.getCurrentTime?.() ?? 0);
      return;
    }
    if (src === "upload" && audioRef.current) {
      cb(audioRef.current.currentTime || 0);
      return;
    }
    if (src === "soundcloud" && scWidgetRef.current) {
      scWidgetRef.current.getPosition((ms: number) => {
        const safeMs = ms || 0;
        scLastPositionMsRef.current = safeMs;
        cb(safeMs / 1000);
      });
      return;
    }
    cb(0);
  };

  const getActiveDuration = (cb: (seconds: number) => void) => {
    const src = sourceRef.current;
    if (src === "youtube" && ytPlayerRef.current) {
      cb(ytPlayerRef.current.getDuration?.() ?? 0);
      return;
    }
    if (src === "upload" && audioRef.current) {
      cb(audioRef.current.duration || 0);
      return;
    }
    if (src === "soundcloud" && scWidgetRef.current) {
      scWidgetRef.current.getDuration((ms: number) => {
        const safeMs = ms || 0;
        scLastDurationMsRef.current = safeMs;
        cb(safeMs / 1000);
      });
      return;
    }
    cb(0);
  };

  const pauseInactiveSources = (nextSource: "youtube" | "soundcloud" | "upload" | null) => {
    try {
      if (nextSource !== "youtube") {
        ytPlayerRef.current?.pauseVideo?.();
      }
    } catch {}
    try {
      if (nextSource !== "upload") {
        audioRef.current?.pause();
      }
    } catch {}
    try {
      if (nextSource !== "soundcloud") {
        hardStopSoundCloud();
      }
    } catch {}
  };

  const releaseWakeLock = () => {
    try {
      wakeLockRef.current?.release?.();
    } catch {}
    wakeLockRef.current = null;
    if (wakeLockRetryTimerRef.current) {
      clearTimeout(wakeLockRetryTimerRef.current);
      wakeLockRetryTimerRef.current = null;
    }
  };

  const ensureAudioContext = () => {
    try {
      const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AC) return null;
      if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
        audioCtxRef.current = new AC();
      }
      return audioCtxRef.current;
    } catch {
      return null;
    }
  };

  const resumeAudioContextSafely = () => {
    const ctx = ensureAudioContext();
    if (!ctx || ctx.state !== "suspended") return ctx;
    try {
      void ctx.resume();
    } catch {
      if (audioCtxRef.current === ctx) {
        audioCtxRef.current = null;
      }
      return ensureAudioContext();
    }
    return ctx;
  };

  const requestWakeLock = async () => {
    if (!isAndroidRef.current) return;
    if (typeof document === "undefined" || document.hidden) return;
    try {
      const nav = navigator as any;
      if (!nav?.wakeLock?.request) return;
      if (wakeLockRef.current) return;
      wakeLockRef.current = await nav.wakeLock.request("screen");
      wakeLockRef.current?.addEventListener?.("release", () => {
        wakeLockRef.current = null;
        if (!playingRef.current || !currentTrackRef.current || document.hidden) return;
        if (wakeLockRetryTimerRef.current) clearTimeout(wakeLockRetryTimerRef.current);
        wakeLockRetryTimerRef.current = setTimeout(() => {
          requestWakeLock().catch(() => {});
        }, 450);
      });
    } catch {}
  };

  const startSilentAudio = () => {
    try {
      const ctx = resumeAudioContextSafely();
      if (!ctx) return;
      try { silentSourceRef.current?.stop(); } catch {}
      const src = ctx.createOscillator();
      src.type = "sine";
      src.frequency.value = 20;
      const gain = ctx.createGain();
      gain.gain.value = 0.00001;
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

  const clearAudibilityNudges = () => {
    audibilityTimersRef.current.forEach((timer) => clearTimeout(timer));
    audibilityTimersRef.current = [];
  };

  const nudgeActiveSourceAudibility = () => {
    resumeAudioContextSafely();
    const src = sourceRef.current;
    if (src === "youtube" && ytPlayerRef.current) {
      try {
        ytPlayerRef.current.unMute?.();
        ytPlayerRef.current.setVolume?.(volumeRef.current);
        if (playingRef.current) ytPlayerRef.current.playVideo?.();
      } catch {}
      return;
    }
    if (src === "upload" && audioRef.current) {
      try {
        audioRef.current.muted = false;
        audioRef.current.volume = Math.max(0, Math.min(1, volumeRef.current / 100));
        if (playingRef.current) audioRef.current.play().catch(() => {});
      } catch {}
      return;
    }
    if (src === "soundcloud" && scWidgetRef.current) {
      try {
        scWidgetRef.current.setVolume?.(volumeRef.current);
        if (playingRef.current) scWidgetRef.current.play?.();
      } catch {}
    }
  };

  const scheduleAudibilityNudges = () => {
    clearAudibilityNudges();
    if (!playingRef.current || !currentTrackRef.current) return;
    const delays = isIosSafariRef.current && sourceRef.current === "soundcloud"
      ? [220, 1200]
      : [120, 420, 1100, 2200];
    delays.forEach((delay) => {
      const timer = setTimeout(() => {
        if (!playingRef.current || !currentTrackRef.current) return;
        nudgeActiveSourceAudibility();
      }, delay);
      audibilityTimersRef.current.push(timer);
    });
  };

  const primeAudioContext = () => {
    try {
      const ctx = resumeAudioContextSafely();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 30;
      gain.gain.setValueAtTime(0.00001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.000001, ctx.currentTime + 0.06);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.06);
    } catch {}
  };

  const playActive = () => {
    lastPlayCommandAtRef.current = Date.now();
    const src = sourceRef.current;
    ignorePauseUntilRef.current = Date.now() + 1500;
    pauseInactiveSources(src);
    if (src === "youtube" && ytPlayerRef.current) {
      if (isIosSafariRef.current) {
        // iOS Safari is stricter with unmuted autoplay. Start muted first, then unmute.
        ytPlayerRef.current.mute?.();
      } else {
        ytPlayerRef.current.unMute?.();
      }
      ytPlayerRef.current.setVolume?.(volumeRef.current);
      ytPlayerRef.current.playVideo?.();
      // Retry unmute after play call to avoid muted autoplay fallback.
      setTimeout(() => {
        try {
          ytPlayerRef.current?.unMute?.();
          ytPlayerRef.current?.setVolume?.(volumeRef.current);
        } catch {}
      }, 120);
    }
    if (src === "upload" && audioRef.current) {
      audioRef.current.volume = Math.max(0, Math.min(1, volumeRef.current / 100));
      audioRef.current.play().catch(() => {});
    }
    if (src === "soundcloud" && scWidgetRef.current) {
      scPauseIntentUntilRef.current = 0;
      scHoldPlayUntilRef.current = Date.now() + 30000;
      scPauseRecoverAttemptsRef.current = 0;
      scWidgetRef.current.setVolume?.(volumeRef.current);
      scWidgetRef.current.play?.();
      // SoundCloud widget may emit a transient PAUSE right after PLAY on some browsers.
      if (!isIosSafariRef.current) {
        setTimeout(() => {
          if (sourceRef.current !== "soundcloud" || !playingRef.current) return;
          try { scWidgetRef.current?.play?.(); } catch {}
        }, 220);
      }
    }
    requestWakeLock().catch(() => {});
    startSilentAudio();
    scheduleAudibilityNudges();
  };

  const pauseActive = () => {
    lastPauseCommandAtRef.current = Date.now();
    ignorePauseUntilRef.current = 0;
    clearAudibilityNudges();
    const src = sourceRef.current;
    if (src === "youtube" && ytPlayerRef.current) {
      ytPlayerRef.current.pauseVideo?.();
    }
    if (src === "upload" && audioRef.current) {
      audioRef.current.pause();
    }
    if (src === "soundcloud" && scWidgetRef.current) {
      scPauseIntentUntilRef.current = Date.now() + 2000;
      scHoldPlayUntilRef.current = 0;
      scPauseRecoverAttemptsRef.current = 0;
      scWidgetRef.current.pause?.();
    }
    releaseWakeLock();
    stopSilentAudio();
  };

  const applyPlaybackIntent = (shouldPlay: boolean) => {
    const now = Date.now();
    const minGapMs = isIosSafariRef.current ? 900 : 350;
    if (shouldPlay) {
      if (now - lastPlayCommandAtRef.current < minGapMs) return;
      const src = sourceRef.current;
      if (src === "youtube" && ytPlayerRef.current && window.YT?.PlayerState) {
        const state = ytPlayerRef.current.getPlayerState?.();
        if (state === window.YT.PlayerState.PLAYING) return;
      }
      if (src === "upload" && audioRef.current && !audioRef.current.paused) return;
      if (src === "soundcloud" && internalPlayingState.current && now - lastPlayCommandAtRef.current < 1300) return;
      playActive();
      return;
    }

    if (now - lastPauseCommandAtRef.current < minGapMs) return;
    const src = sourceRef.current;
    if (src === "youtube" && ytPlayerRef.current && window.YT?.PlayerState) {
      const state = ytPlayerRef.current.getPlayerState?.();
      if (state === window.YT.PlayerState.PAUSED || state === window.YT.PlayerState.ENDED) return;
    }
    if (src === "upload" && audioRef.current && audioRef.current.paused) return;
    pauseActive();
  };

  // Init YouTube API and player once
  useEffect(() => {
    const initPlayer = () => {
      if (!ytContainerRef.current || ytPlayerRef.current || !window.YT) return;
      ytPlayerRef.current = new window.YT.Player(ytContainerRef.current, {
        host: "https://www.youtube-nocookie.com",
        height: "100%",
        width: "100%",
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          rel: 0,
          modestbranding: 1,
          origin: window.location.origin,
          playsinline: 1,
          iv_load_policy: 3,
        },
        events: {
          onReady: () => {
            setYtReady(true);
            setYtErrorCode(null);
            try {
              const iframe = ytPlayerRef.current?.getIframe?.();
              if (iframe) {
                iframe.setAttribute("allow", "autoplay; encrypted-media; picture-in-picture; fullscreen");
                iframe.setAttribute("playsinline", "1");
                iframe.setAttribute("webkit-playsinline", "1");
                iframe.style.width = "100%";
                iframe.style.height = "100%";
                iframe.style.border = "0";
                iframe.style.display = "block";
                iframe.style.transform = "none";
              }
              ytPlayerRef.current?.unMute?.();
              ytPlayerRef.current?.setVolume?.(volumeRef.current);
              scheduleAudibilityNudges();
            } catch {}
          },
          onStateChange: (event: any) => {
            if (sourceRef.current === "youtube" && event.data === window.YT?.PlayerState?.PLAYING) {
              setYtErrorCode(null);
            }
            if (!isHost || sourceRef.current !== "youtube") return;
            const PLAYING = window.YT.PlayerState.PLAYING;
            const PAUSED = window.YT.PlayerState.PAUSED;
            const ENDED = window.YT.PlayerState.ENDED;
            if (event.data === PLAYING) {
              ignorePauseUntilRef.current = 0;
              try {
                ytPlayerRef.current?.unMute?.();
                ytPlayerRef.current?.setVolume?.(volumeRef.current);
              } catch {}
              scheduleAudibilityNudges();
              internalPlayingState.current = true;
              onStateChange?.(true, ytPlayerRef.current.getCurrentTime?.() ?? 0);
            } else if (event.data === PAUSED) {
              // Some mobile browsers emit PAUSED right after a play request; retry once within grace window.
              if (playingRef.current && Date.now() < ignorePauseUntilRef.current) {
                try {
                  ytPlayerRef.current?.playVideo?.();
                } catch {}
                return;
              }
              internalPlayingState.current = false;
              onStateChange?.(false, ytPlayerRef.current.getCurrentTime?.() ?? 0);
            } else if (event.data === ENDED) {
              internalPlayingState.current = false;
              onTrackEnd?.();
            }
          },
          onError: (event: any) => {
            const code = Number(event?.data);
            const safeCode = Number.isFinite(code) ? code : -1;
            const activeTrack = currentTrackRef.current;
            const retryKey = activeTrack ? `${activeTrack.videoId}:${safeCode}` : "";
            const canRetry =
              !!activeTrack &&
              retryKey !== ytRetryKeyRef.current &&
              [2, 5, 101, 150].includes(safeCode);

            if (canRetry && activeTrack) {
              ytRetryKeyRef.current = retryKey;
              setTimeout(() => {
                if (sourceRef.current !== "youtube" || currentTrackRef.current?.videoId !== activeTrack.videoId) return;
                try {
                  setYtErrorCode(null);
                  if (playingRef.current) {
                    ytPlayerRef.current?.loadVideoById?.(activeTrack.videoId, Math.max(0, serverTime));
                  } else {
                    ytPlayerRef.current?.cueVideoById?.(activeTrack.videoId, Math.max(0, serverTime));
                  }
                } catch {}
              }, 350);
              return;
            }

            setYtErrorCode(safeCode);
            internalPlayingState.current = false;
            if (isHostRef.current) {
              const safeTime = ytPlayerRef.current?.getCurrentTime?.() ?? 0;
              onStateChangeRef.current?.(false, safeTime);
            }
          },
        },
      });
    };

    if (!window.YT) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName("script")[0];
      if (firstScriptTag?.parentNode) firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
      window.onYouTubeIframeAPIReady = initPlayer;
    } else {
      initPlayer();
    }

    return () => {
      try { ytPlayerRef.current?.destroy?.(); } catch {}
      if (heartbeatInterval.current) clearInterval(heartbeatInterval.current);
      if (timeUpdateInterval.current) clearInterval(timeUpdateInterval.current);
    };
  }, []);

  // Init SoundCloud widget API script once
  useEffect(() => {
    if (window.SC?.Widget) {
      setScScriptReady(true);
      return;
    }
    const tag = document.createElement("script");
    tag.src = "https://w.soundcloud.com/player/api.js";
    tag.async = true;
    tag.onload = () => setScScriptReady(true);
    document.body.appendChild(tag);
    return () => {
      try { document.body.removeChild(tag); } catch {}
    };
  }, []);

  // Setup SoundCloud widget when needed
  useEffect(() => {
    if (source !== "soundcloud" || !currentTrack?.mediaUrl || !scScriptReady || !scIframeRef.current || !window.SC?.Widget) {
      return;
    }

    if (!scWidgetRef.current) {
      scWidgetRef.current = window.SC.Widget(scIframeRef.current);
    }

    if (!scBoundRef.current) {
      const widget = scWidgetRef.current;
      const events = window.SC.Widget.Events;

      widget.bind(events.READY, () => {
        setScReady(true);
        const pendingStartMs = Math.max(0, scPendingStartMsRef.current || 0);
        if (pendingStartMs > 0) {
          try { widget.seekTo?.(pendingStartMs); } catch {}
        }
        scInitialSyncDoneRef.current = pendingStartMs <= 0;
        if (playingRef.current) {
          applyPlaybackIntent(true);
          scheduleAudibilityNudges();
          setTimeout(() => {
            if (sourceRef.current !== "soundcloud" || !playingRef.current) return;
            try { widget.seekTo?.(pendingStartMs); } catch {}
            try { widget.play?.(); } catch {}
          }, isIosSafariRef.current ? 280 : 180);
          if (!isIosSafariRef.current) {
            setTimeout(() => {
              if (sourceRef.current !== "soundcloud" || !playingRef.current) return;
              try { widget.play?.(); } catch {}
            }, 520);
          }
        }
      });
      widget.bind(events.PLAY, () => {
        if (sourceRef.current !== "soundcloud") return;
        ignorePauseUntilRef.current = 0;
        scPauseIntentUntilRef.current = 0;
        scHoldPlayUntilRef.current = Date.now() + 30000;
        scPauseRecoverAttemptsRef.current = 0;
        internalPlayingState.current = true;
        if (!isHostRef.current) return;
        widget.getPosition((ms: number) => onStateChangeRef.current?.(true, (ms || 0) / 1000));
      });
      widget.bind(events.PAUSE, () => {
        if (sourceRef.current !== "soundcloud") return;
        if (playingRef.current && Date.now() < ignorePauseUntilRef.current) {
          // Ignore transient PAUSE right after a play request to avoid host state flapping.
          try { widget.play?.(); } catch {}
          return;
        }
        const now = Date.now();
        const pauseWasIntentional = now < scPauseIntentUntilRef.current || !playingRef.current;
        if (!pauseWasIntentional && now < scHoldPlayUntilRef.current && scPauseRecoverAttemptsRef.current < 6) {
          scPauseRecoverAttemptsRef.current += 1;
          setTimeout(() => {
            if (sourceRef.current !== "soundcloud" || !playingRef.current) return;
            try { widget.play?.(); } catch {}
          }, 120);
          return;
        }
        internalPlayingState.current = false;
        if (!isHostRef.current) return;
        widget.getPosition((ms: number) => onStateChangeRef.current?.(false, (ms || 0) / 1000));
      });
      widget.bind(events.FINISH, () => {
        if (sourceRef.current !== "soundcloud") return;
        widget.getPosition((positionMs: number) => {
          if (sourceRef.current !== "soundcloud") return;
          widget.getDuration((durationMs: number) => {
            if (sourceRef.current !== "soundcloud") return;
            const safePositionMs = positionMs || scLastPositionMsRef.current || 0;
            const safeDurationMs = durationMs || scLastDurationMsRef.current || 0;
            scLastPositionMsRef.current = safePositionMs;
            scLastDurationMsRef.current = safeDurationMs;

            const nearEnd = safeDurationMs > 0
              ? safePositionMs >= Math.max(0, safeDurationMs - 2500)
              : safePositionMs >= 20000;

            if (!nearEnd) {
              // Ignore false FINISH events; keep current track alive.
              if (playingRef.current) {
                try { widget.play?.(); } catch {}
              }
              return;
            }

            internalPlayingState.current = false;
            onTrackEndRef.current?.();
          });
        });
      });

      scBoundRef.current = true;
    }

    setScReady(false);
    scPendingStartMsRef.current = Math.max(0, Math.floor(serverTime * 1000));
    scInitialSyncDoneRef.current = false;
    const shouldLoadSoundCloudTrack = scLoadedUrlRef.current !== currentTrack.mediaUrl;
    if (shouldLoadSoundCloudTrack) {
      scLoadedUrlRef.current = currentTrack.mediaUrl;
      scWidgetRef.current.load(currentTrack.mediaUrl, getSoundCloudLoadOptions(playingRef.current));
    }
    // Some devices never fire READY after re-load; force an extra play attempt.
    if (playingRef.current) {
      setTimeout(() => {
        if (sourceRef.current !== "soundcloud" || !playingRef.current) return;
        try { scWidgetRef.current?.seekTo?.(scPendingStartMsRef.current); } catch {}
        applyPlaybackIntent(true);
        scheduleAudibilityNudges();
      }, isIosSafariRef.current ? 520 : 420);
      if (!isIosSafariRef.current) {
        setTimeout(() => {
          if (sourceRef.current !== "soundcloud" || !playingRef.current) return;
          try { scWidgetRef.current?.seekTo?.(scPendingStartMsRef.current); } catch {}
          try { scWidgetRef.current?.play?.(); } catch {}
        }, 900);
      }
    }
  }, [source, currentTrack?.mediaUrl, scScriptReady]);

  // Sync track source when track changes
  useEffect(() => {
    if (!currentTrack) {
      setYtErrorCode(null);
      pauseInactiveSources(null);
      releaseWakeLock();
      stopSilentAudio();
      return;
    }

    const src = getTrackSource(currentTrack);
    sourceRef.current = src;
    if (src !== "youtube") {
      setYtErrorCode(null);
      ytRetryKeyRef.current = "";
    }
    pauseInactiveSources(src);
    if (src === "youtube" && ytReady && ytPlayerRef.current) {
      const currentVideoId = ytPlayerRef.current.getVideoData?.()?.video_id;
      if (currentVideoId !== currentTrack.videoId) {
        setYtErrorCode(null);
        ytRetryKeyRef.current = "";
        if (playing) {
          ytPlayerRef.current.loadVideoById(currentTrack.videoId, serverTime);
        } else {
          ytPlayerRef.current.cueVideoById?.(currentTrack.videoId, serverTime);
          ytPlayerRef.current.seekTo?.(serverTime, true);
          ytPlayerRef.current.pauseVideo?.();
        }
      }
      return;
    }

    if (src === "upload" && audioRef.current) {
      const mediaUrl = toAbsoluteMediaUrl(currentTrack.mediaUrl);
      const isNewMedia = audioRef.current.src !== mediaUrl;
      if (isNewMedia) {
        audioRef.current.src = mediaUrl;
        audioRef.current.load();
        try { audioRef.current.currentTime = Math.max(0, serverTime); } catch {}
        if (playing) {
          audioRef.current.play().catch(() => {});
          scheduleAudibilityNudges();
        } else {
          audioRef.current.pause();
        }
      }
    }
  }, [currentTrack?.videoId, currentTrack?.mediaUrl, ytReady]);

  // Playback sync for all sources
  useEffect(() => {
    if (!currentTrack) return;
    internalPlayingState.current = playing;
    const shouldCorrectDrift = !isHostRef.current;

    const src = getTrackSource(currentTrack);
    if (src === "youtube") {
      if (!ytReady || !ytPlayerRef.current) return;
      try {
        applyPlaybackIntent(playing);
        const playerTime = ytPlayerRef.current.getCurrentTime?.() ?? 0;
        const seekDriftThreshold = (isIosSafariRef.current || isAndroidRef.current) ? 2.2 : 1.5;
        const correctionCooldownMs = (isIosSafariRef.current || isAndroidRef.current) ? 1800 : 600;
        if (
          shouldCorrectDrift &&
          Math.abs(playerTime - serverTime) > seekDriftThreshold &&
          Date.now() - lastDriftCorrectionAtRef.current > correctionCooldownMs
        ) {
          lastDriftCorrectionAtRef.current = Date.now();
          ytPlayerRef.current.seekTo?.(serverTime, true);
        }
      } catch {}
      return;
    }

    if (src === "upload") {
      const audio = audioRef.current;
      if (!audio) return;
      try {
        applyPlaybackIntent(playing);
        const drift = (audio.currentTime || 0) - serverTime;
        const isIphoneUpload = isIosSafariRef.current;
        if (!playing || !shouldCorrectDrift) {
          audio.playbackRate = 1;
          return;
        }

        const isMobileBrowser = isIosSafariRef.current || isAndroidRef.current;
        const now = Date.now();
        const hardSeekThreshold = isIphoneUpload ? 14 : (isMobileBrowser ? 10 : 5);
        const correctionCooldownMs = isIphoneUpload ? 9000 : (isMobileBrowser ? 5000 : 1800);
        if (
          Math.abs(drift) > hardSeekThreshold &&
          now - lastDriftCorrectionAtRef.current > correctionCooldownMs
        ) {
          lastDriftCorrectionAtRef.current = now;
          audio.playbackRate = 1;
          audio.currentTime = Math.max(0, serverTime);
          return;
        }

        if (isIphoneUpload) {
          audio.playbackRate = 1;
          return;
        }

        const rateAdjustmentCooldownMs = isMobileBrowser ? 1500 : 700;
        if (now - lastUploadRateAdjustmentAtRef.current < rateAdjustmentCooldownMs) return;
        lastUploadRateAdjustmentAtRef.current = now;

        if (Math.abs(drift) > 2.2) {
          audio.playbackRate = drift > 0 ? 0.97 : 1.03;
        } else if (Math.abs(drift) > 0.9) {
          audio.playbackRate = drift > 0 ? 0.98 : 1.02;
        } else if (Math.abs(drift) > 0.45) {
          audio.playbackRate = drift > 0 ? 0.985 : 1.015;
        } else {
          audio.playbackRate = 1;
        }
      } catch {}
      return;
    }

    if (src === "soundcloud" && scWidgetRef.current) {
      try {
        if (playing) {
          scHoldPlayUntilRef.current = Date.now() + 30000;
          applyPlaybackIntent(true);
          if (!isIosSafariRef.current || !scInitialSyncDoneRef.current) {
            scheduleAudibilityNudges();
          }
        } else {
          applyPlaybackIntent(false);
        }
        scWidgetRef.current.getPosition((ms: number) => {
          scLastPositionMsRef.current = ms || 0;
          const ct = (ms || 0) / 1000;
          if (isIosSafariRef.current) {
            const drift = Math.abs(ct - serverTime);
            const now = Date.now();
            const shouldInitialSnap = !scInitialSyncDoneRef.current && drift > 1.2;
            const shouldHardRecover = drift > 12 && now - lastDriftCorrectionAtRef.current > 8000;
            if (shouldCorrectDrift && (shouldInitialSnap || shouldHardRecover)) {
              lastDriftCorrectionAtRef.current = now;
              scInitialSyncDoneRef.current = true;
              scWidgetRef.current.seekTo(serverTime * 1000);
            } else if (drift <= 1.2) {
              scInitialSyncDoneRef.current = true;
            }
            return;
          }
          const seekDriftThreshold = isAndroidRef.current ? 3.2 : 1.6;
          const correctionCooldownMs = isAndroidRef.current ? 2400 : 900;
          if (
            shouldCorrectDrift &&
            Math.abs(ct - serverTime) > seekDriftThreshold &&
            Date.now() - lastDriftCorrectionAtRef.current > correctionCooldownMs
          ) {
            lastDriftCorrectionAtRef.current = Date.now();
            scWidgetRef.current.seekTo(serverTime * 1000);
          }
        });
        scWidgetRef.current.getDuration((ms: number) => {
          scLastDurationMsRef.current = ms || 0;
        });
      } catch {}
    }
  }, [playing, serverTime, ytReady, currentTrack, source]);

  // Volume sync
  useEffect(() => {
    try {
      if (source === "youtube" && ytPlayerRef.current) {
        ytPlayerRef.current.unMute?.();
        ytPlayerRef.current.setVolume?.(volume);
      }
      if (source === "upload" && audioRef.current) {
        audioRef.current.volume = Math.max(0, Math.min(1, volume / 100));
      }
      if (source === "soundcloud" && scWidgetRef.current) {
        scWidgetRef.current.setVolume?.(volume);
      }
    } catch {}
  }, [volume, source, ytReady, scReady]);

  // Native audio events
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onPlay = () => {
      if (sourceRef.current !== "upload") return;
      internalPlayingState.current = true;
      if (isHost) onStateChange?.(true, audio.currentTime || 0);
    };
    const onPause = () => {
      if (sourceRef.current !== "upload") return;
      internalPlayingState.current = false;
      if (isHost) onStateChange?.(false, audio.currentTime || 0);
    };
    const onEnded = () => {
      if (sourceRef.current !== "upload") return;
      internalPlayingState.current = false;
      onTrackEnd?.();
    };

    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
    };
  }, [isHost, onStateChange, onTrackEnd]);

  // Host heartbeat for sync_time
  useEffect(() => {
    if (!isHost) return;
    heartbeatInterval.current = setInterval(() => {
      if (!internalPlayingState.current || !currentTrackRef.current) return;
      getActiveCurrentTime((ct) => onStateChange?.(true, ct));
    }, 400);

    return () => {
      if (heartbeatInterval.current) clearInterval(heartbeatInterval.current);
    };
  }, [isHost, onStateChange]);

  // Time update for seek bar
  useEffect(() => {
    timeUpdateInterval.current = setInterval(() => {
      if (!currentTrackRef.current) {
        onTimeUpdate?.(0, 0);
        return;
      }
      getActiveCurrentTime((ct) => {
        getActiveDuration((dur) => {
          onTimeUpdate?.(ct, dur);
        });
      });
    }, 500);

    return () => {
      if (timeUpdateInterval.current) clearInterval(timeUpdateInterval.current);
    };
  }, [onTimeUpdate]);

  // Page visibility handler
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden && playingRef.current && currentTrackRef.current) {
        releaseWakeLock();
        startSilentAudio();
      }
      if (!document.hidden && playingRef.current && currentTrackRef.current) {
        resumeAudioContextSafely();
        requestWakeLock().catch(() => {});
        setTimeout(() => {
          applyPlaybackIntent(true);
          scheduleAudibilityNudges();
        }, 250);
      }
    };
    const handlePageHide = () => {
      if (!playingRef.current || !currentTrackRef.current) return;
      releaseWakeLock();
      startSilentAudio();
    };
    const handlePageShow = () => {
      if (!playingRef.current || !currentTrackRef.current) return;
      requestWakeLock().catch(() => {});
      setTimeout(() => {
        applyPlaybackIntent(true);
        scheduleAudibilityNudges();
      }, 180);
    };
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("pageshow", handlePageShow);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, []);

  // Unlock playback on mobile user gesture
  useEffect(() => {
    const unlock = (event?: Event) => {
      primeAudioContext();
      if (event && event.type !== "mt-playback-gesture") {
        setIosUnlockPromptVisible(false);
      }
      const detail = (event as CustomEvent<PlaybackGestureDetail> | undefined)?.detail;
      const requestedPlay = detail?.play;
      const requestedTrack = detail?.track;
      const requestedTime = Number.isFinite(Number(detail?.currentTime)) ? Math.max(0, Number(detail?.currentTime)) : serverTime;
      const hasExplicitPlaybackIntent = typeof requestedPlay === "boolean";

      if (hasExplicitPlaybackIntent) {
        playingRef.current = requestedPlay;
        if (requestedTrack !== undefined) currentTrackRef.current = requestedTrack;
        suppressAmbientUnlockUntilRef.current = requestedPlay ? 0 : Date.now() + 1200;
      }

      if (requestedTrack) {
        const wantsPlayback = requestedPlay !== false;
        const requestedSource = getTrackSource(requestedTrack);
        if (requestedSource === "youtube" && ytPlayerRef.current) {
          try {
            const currentVideoId = ytPlayerRef.current.getVideoData?.()?.video_id;
            const shouldReloadTrack = wantsPlayback && currentVideoId !== requestedTrack.videoId;
            if (shouldReloadTrack) {
              ytPlayerRef.current.loadVideoById?.(requestedTrack.videoId, requestedTime);
            } else if (Math.abs((ytPlayerRef.current.getCurrentTime?.() ?? 0) - requestedTime) > 1.5) {
              ytPlayerRef.current.seekTo?.(requestedTime, true);
            }
            ytPlayerRef.current.unMute?.();
            ytPlayerRef.current.setVolume?.(volumeRef.current);
            if (wantsPlayback) {
              ytPlayerRef.current.playVideo?.();
              setIosUnlockPromptVisible(false);
              scheduleAudibilityNudges();
            }
          } catch {}
        } else if (requestedSource === "upload" && audioRef.current) {
          try {
            const mediaUrl = toAbsoluteMediaUrl(requestedTrack.mediaUrl);
            const shouldReloadTrack = wantsPlayback && mediaUrl && audioRef.current.src !== mediaUrl;
            if (shouldReloadTrack) {
              audioRef.current.src = mediaUrl;
              audioRef.current.load();
              try { audioRef.current.currentTime = requestedTime; } catch {}
            } else if (Math.abs((audioRef.current.currentTime || 0) - requestedTime) > 1.5) {
              try { audioRef.current.currentTime = requestedTime; } catch {}
            }
            audioRef.current.volume = Math.max(0, Math.min(1, volumeRef.current / 100));
            if (wantsPlayback) {
              audioRef.current.play().catch(() => {});
              setIosUnlockPromptVisible(false);
              scheduleAudibilityNudges();
            }
          } catch {}
        } else if (requestedSource === "soundcloud" && scWidgetRef.current) {
          try {
            scPendingStartMsRef.current = Math.max(0, Math.floor(requestedTime * 1000));
            const requestedMediaUrl = requestedTrack.mediaUrl ?? "";
            const shouldReloadTrack =
              wantsPlayback &&
              !!requestedMediaUrl &&
              scLoadedUrlRef.current !== requestedMediaUrl;
            if (shouldReloadTrack) {
              scLoadedUrlRef.current = requestedMediaUrl;
              scInitialSyncDoneRef.current = false;
              scWidgetRef.current.load(requestedMediaUrl, getSoundCloudLoadOptions(wantsPlayback));
            } else {
              try { scWidgetRef.current.seekTo?.(scPendingStartMsRef.current); } catch {}
            }
            scWidgetRef.current.setVolume?.(volumeRef.current);
            if (wantsPlayback) {
              scWidgetRef.current.play?.();
              setIosUnlockPromptVisible(false);
              setTimeout(() => {
                try { scWidgetRef.current?.seekTo?.(scPendingStartMsRef.current); } catch {}
              }, isIosSafariRef.current ? 260 : 180);
              if (!isIosSafariRef.current) {
                setTimeout(() => {
                  try { scWidgetRef.current?.play?.(); } catch {}
                }, 220);
              }
              scheduleAudibilityNudges();
            }
          } catch {}
        }
      }

      if (requestedPlay === false) {
        applyPlaybackIntent(false);
        return;
      }
      if (!hasExplicitPlaybackIntent && Date.now() < suppressAmbientUnlockUntilRef.current) {
        return;
      }
      if (requestedPlay === true || playingRef.current) {
        applyPlaybackIntent(true);
      }
    };

    window.addEventListener("mt-playback-gesture", unlock as EventListener);
    document.addEventListener("touchstart", unlock, { passive: true });
    document.addEventListener("touchend", unlock, { passive: true });
    document.addEventListener("pointerup", unlock);
    document.addEventListener("click", unlock);
    document.addEventListener("keydown", unlock);

    return () => {
      window.removeEventListener("mt-playback-gesture", unlock as EventListener);
      document.removeEventListener("touchstart", unlock);
      document.removeEventListener("touchend", unlock);
      document.removeEventListener("pointerup", unlock);
      document.removeEventListener("click", unlock);
      document.removeEventListener("keydown", unlock);
      if (hiddenKeepAliveInterval.current) clearInterval(hiddenKeepAliveInterval.current);
      clearAudibilityNudges();
      releaseWakeLock();
      stopSilentAudio();
      const ctx = audioCtxRef.current;
      audioCtxRef.current = null;
      try { ctx?.close(); } catch {}
    };
  }, []);

  const handleIosUnlockTap = () => {
    if (!currentTrackRef.current) return;
    setIosUnlockPromptVisible(false);
    window.dispatchEvent(new CustomEvent("mt-playback-gesture", {
      detail: {
        play: true,
        track: currentTrackRef.current,
        currentTime: serverTime,
      },
    }));
  };

  // Keep playback alive while tab/app is hidden (mobile browser stability)
  useEffect(() => {
    if (hiddenKeepAliveInterval.current) clearInterval(hiddenKeepAliveInterval.current);
    if (!playing || !currentTrack) return;

    hiddenKeepAliveInterval.current = setInterval(() => {
      if (!playingRef.current || !currentTrackRef.current || !document.hidden) return;
      primeAudioContext();
      applyPlaybackIntent(true);
    }, isAndroidRef.current ? 7000 : 12000);

    return () => {
      if (hiddenKeepAliveInterval.current) clearInterval(hiddenKeepAliveInterval.current);
    };
  }, [playing, currentTrack?.videoId, currentTrack?.mediaUrl]);

  // Media Session metadata
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    try {
      if (currentTrack && typeof window !== "undefined" && "MediaMetadata" in window) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: currentTrack.title,
          artist: currentTrack.channelTitle,
          artwork: currentTrack.thumbnail
            ? [{ src: currentTrack.thumbnail, sizes: "120x90", type: "image/jpeg" }]
            : [],
        });
      } else {
        navigator.mediaSession.metadata = null;
      }
    } catch {
      try { navigator.mediaSession.metadata = null; } catch {}
    }
  }, [currentTrack]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    try {
      navigator.mediaSession.playbackState = playing ? "playing" : "paused";
    } catch {}
  }, [playing]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    const setSafeActionHandler = (
      action: MediaSessionAction,
      handler: MediaSessionActionHandler | null,
    ) => {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch {}
    };

    setSafeActionHandler("play", () => {
      applyPlaybackIntent(true);
      if (isHost) getActiveCurrentTime((ct) => onStateChange?.(true, ct));
    });
    setSafeActionHandler("pause", () => {
      applyPlaybackIntent(false);
      if (isHost) getActiveCurrentTime((ct) => onStateChange?.(false, ct));
    });
    setSafeActionHandler("nexttrack", () => {
      if (isHost) onTrackEnd?.();
    });
    setSafeActionHandler("previoustrack", () => {
      const src = sourceRef.current;
      if (src === "youtube" && ytPlayerRef.current) ytPlayerRef.current.seekTo?.(0, true);
      if (src === "upload" && audioRef.current) audioRef.current.currentTime = 0;
      if (src === "soundcloud" && scWidgetRef.current) scWidgetRef.current.seekTo?.(0);
    });
    setSafeActionHandler("seekforward", (d) => {
      const skip = d.seekOffset ?? 10;
      getActiveCurrentTime((ct) => {
        const target = ct + skip;
        const src = sourceRef.current;
        if (src === "youtube" && ytPlayerRef.current) ytPlayerRef.current.seekTo?.(target, true);
        if (src === "upload" && audioRef.current) audioRef.current.currentTime = target;
        if (src === "soundcloud" && scWidgetRef.current) scWidgetRef.current.seekTo?.(target * 1000);
      });
    });
    setSafeActionHandler("seekbackward", (d) => {
      const skip = d.seekOffset ?? 10;
      getActiveCurrentTime((ct) => {
        const target = Math.max(0, ct - skip);
        const src = sourceRef.current;
        if (src === "youtube" && ytPlayerRef.current) ytPlayerRef.current.seekTo?.(target, true);
        if (src === "upload" && audioRef.current) audioRef.current.currentTime = target;
        if (src === "soundcloud" && scWidgetRef.current) scWidgetRef.current.seekTo?.(target * 1000);
      });
    });

    return () => {
      ["play", "pause", "nexttrack", "previoustrack", "seekforward", "seekbackward"].forEach((a) => {
        setSafeActionHandler(a as MediaSessionAction, null);
      });
    };
  }, [isHost, onStateChange, onTrackEnd]);

  return (
    <div className={fullscreen
      ? "absolute inset-0 bg-black group"
      : "relative w-full pt-[56.25%] bg-white rounded-[2rem] overflow-hidden border border-primary/10 group shadow-2xl soft-glow"}>
      <div
        className={`absolute inset-0 z-0 overflow-hidden ${currentTrack ? "opacity-100" : "opacity-0"} ${source === "soundcloud" ? "pointer-events-auto" : "pointer-events-none"}`}
        aria-hidden={!currentTrack}
      >
        <div
          ref={ytContainerRef}
          className={`absolute inset-0 w-full h-full ${source === "youtube" ? "block" : "hidden"}`}
        />

        <iframe
          ref={scIframeRef}
          title="soundcloud-player"
          className={`absolute inset-0 w-full h-full border-0 ${source === "soundcloud" ? "block" : "hidden"}`}
          allow="autoplay"
          src="https://w.soundcloud.com/player/?url=https%3A//soundcloud.com&auto_play=false&show_comments=false&show_user=true&show_reposts=false&visual=true"
        />

        {source === "upload" && currentTrack?.thumbnail && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
            <img src={currentTrack.thumbnail} alt={currentTrack.title} className="w-full h-full object-cover" />
          </div>
        )}

        <audio
          ref={audioRef}
          preload="auto"
          playsInline
          className="absolute bottom-0 left-0 w-px h-px opacity-0 pointer-events-none"
        />
      </div>

      {source === "youtube" && currentTrack && ytErrorMessage && (
        <div className="absolute inset-0 z-[25] flex items-center justify-center bg-black/78 px-6 text-center">
          <div className="max-w-md">
            <p className="text-2xl font-semibold text-white">{ytErrorMessage.title}</p>
            <p className="mt-3 text-sm leading-relaxed text-white/80">{ytErrorMessage.description}</p>
            <a
              href={`https://www.youtube.com/watch?v=${currentTrack.videoId}`}
              target="_blank"
              rel="noreferrer"
              className="mt-5 inline-flex items-center justify-center rounded-full border border-white/20 bg-white/10 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/20"
            >
              Mở trên YouTube
            </a>
          </div>
        </div>
      )}

      {isIosSafariRef.current && currentTrack && playing && iosUnlockPromptVisible && !ytErrorMessage && (
        <button
          type="button"
          onClick={handleIosUnlockTap}
          className="absolute inset-0 z-[24] flex items-center justify-center bg-black/45 px-6 text-center text-white backdrop-blur-[1px]"
        >
          <span className="rounded-3xl border border-white/20 bg-black/60 px-5 py-4 text-sm font-medium shadow-2xl">
            Chạm để bật tiếng
          </span>
        </button>
      )}

      {!currentTrack && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-5"
          style={{ background: "linear-gradient(135deg, #fdf6f0 0%, #fce8e8 50%, #eef5ef 100%)" }}>
          <div className="text-center mt-1">
            <p className="text-base font-serif italic font-semibold text-[#8c5f6a]">Chưa có bài hát đang phát</p>
            <p className="text-xs text-[#a07060]/70 mt-1">Thêm bài vào danh sách để bắt đầu</p>
          </div>
        </div>
      )}

      {!fullscreen && source !== "soundcloud" && <div className="absolute inset-0 z-20 pointer-events-auto bg-transparent" />}

      {currentTrack && !fullscreen && (
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
