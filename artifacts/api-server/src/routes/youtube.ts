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
