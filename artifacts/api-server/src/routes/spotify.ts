import { Router, type IRouter } from "express";
import { createRequire } from "module";

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

function normalizeUrl(raw: string): string | null {
  try {
    const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    return new URL(withScheme).toString();
  } catch {
    return null;
  }
}

function isSpotifyUrl(raw: string): boolean {
  try {
    const host = new URL(raw).hostname.toLowerCase();
    return (
      host === "open.spotify.com" ||
      host === "spotify.link" ||
      host === "spoti.fi" ||
      host.endsWith(".spotify.com")
    );
  } catch {
    return false;
  }
}

function toSearchQuery(spotifyTitle: string): string {
  return spotifyTitle
    .replace(/\s*\|\s*Spotify\s*$/i, "")
    .replace(/\s*-\s*(song|single|album)\s+by\s+/i, " ")
    .replace(/\s+/g, " ")
    .trim();
}

router.get("/spotify/resolve", async (req, res): Promise<void> => {
  const raw = typeof req.query.url === "string" ? req.query.url.trim() : "";
  const normalized = normalizeUrl(raw);
  if (!normalized || !isSpotifyUrl(normalized)) {
    res.status(400).json({ error: "Invalid Spotify URL" });
    return;
  }

  try {
    const oembedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(normalized)}`;
    const oembedResponse = await fetch(oembedUrl);
    if (!oembedResponse.ok) {
      res.status(404).json({ error: "Cannot resolve Spotify track" });
      return;
    }

    const data = (await oembedResponse.json()) as {
      title?: string;
      author_name?: string;
      thumbnail_url?: string;
    };

    const query = toSearchQuery(data.title ?? data.author_name ?? "");
    if (!query) {
      res.status(404).json({ error: "Cannot identify Spotify track details" });
      return;
    }

    const yts = require("yt-search") as (
      query: string,
      cb: (err: Error | null, result: YtsResult) => void,
    ) => void;

    const result = await new Promise<YtsResult>((resolve, reject) => {
      yts(query, (err, r) => {
        if (err) reject(err);
        else resolve(r);
      });
    });

    const first = result.videos?.[0];
    if (!first?.videoId) {
      res.status(404).json({ error: "Cannot find a playable match for Spotify track" });
      return;
    }

    res.json({
      videoId: first.videoId,
      source: "youtube",
      title: first.title,
      channelTitle: first.author?.name ?? data.author_name ?? "YouTube",
      thumbnail:
        first.thumbnail ??
        data.thumbnail_url ??
        `https://i.ytimg.com/vi/${first.videoId}/mqdefault.jpg`,
      duration: first.duration?.timestamp ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "spotify resolve failed");
    res.status(500).json({ error: "Spotify lookup failed" });
  }
});

export default router;

