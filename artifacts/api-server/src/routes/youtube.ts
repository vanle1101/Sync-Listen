import { Router, type IRouter } from "express";
import { createRequire } from "module";
import { YoutubeSearchQueryParams } from "@workspace/api-zod";

const require = createRequire(import.meta.url);

const router: IRouter = Router();

interface YtsVideo {
  videoId: string;
  title: string;
  author?: { name?: string };
  thumbnail?: string;
  duration?: { seconds?: number; timestamp?: string };
}

interface YtsResult {
  videos: YtsVideo[];
}

router.get("/youtube/video/:videoId", async (req, res): Promise<void> => {
  const { videoId } = req.params;
  if (!videoId || !/^[a-zA-Z0-9_-]{6,15}$/.test(videoId)) {
    res.status(400).json({ error: "Invalid video ID" });
    return;
  }
  try {
    const yts = require("yt-search") as (
      opts: { videoId: string },
      cb: (err: Error | null, result: YtsVideo) => void,
    ) => void;
    const video = await new Promise<YtsVideo>((resolve, reject) => {
      yts({ videoId }, (err, r) => {
        if (err) reject(err);
        else resolve(r);
      });
    });
    res.json({
      videoId: video.videoId,
      title: video.title,
      channelTitle: video.author?.name ?? "Unknown",
      thumbnail: video.thumbnail ?? `https://i.ytimg.com/vi/${video.videoId}/mqdefault.jpg`,
      duration: video.duration?.timestamp ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "yt-search video lookup failed");
    res.status(500).json({ error: "Video lookup failed" });
  }
});

router.get("/youtube/search", async (req, res): Promise<void> => {
  const parsed = YoutubeSearchQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { q } = parsed.data;

  try {
    const yts = require("yt-search") as (
      query: string,
      cb: (err: Error | null, result: YtsResult) => void,
    ) => void;

    const result = await new Promise<YtsResult>((resolve, reject) => {
      yts(q, (err, r) => {
        if (err) reject(err);
        else resolve(r);
      });
    });

    const videos = result.videos.slice(0, 10).map((v) => ({
      videoId: v.videoId,
      title: v.title,
      channelTitle: v.author?.name ?? "Unknown",
      thumbnail:
        v.thumbnail ?? `https://i.ytimg.com/vi/${v.videoId}/mqdefault.jpg`,
      duration: v.duration?.timestamp ?? null,
    }));

    res.json(videos);
  } catch (err) {
    req.log.error({ err }, "yt-search failed");
    res.status(500).json({ error: "Search failed" });
  }
});

export default router;
