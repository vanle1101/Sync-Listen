import { Router, type IRouter } from "express";
import { YoutubeSearchQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

interface YTSearchItem {
  id: { videoId: string };
  snippet: {
    title: string;
    channelTitle: string;
    thumbnails: { medium?: { url: string }; default?: { url: string } };
  };
}

router.get("/youtube/search", async (req, res): Promise<void> => {
  const parsed = YoutubeSearchQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { q } = parsed.data;
  const apiKey = process.env.YOUTUBE_API_KEY;

  if (!apiKey) {
    const fallback = getMockResults(q);
    res.json(fallback);
    return;
  }

  try {
    const url = new URL("https://www.googleapis.com/youtube/v3/search");
    url.searchParams.set("part", "snippet");
    url.searchParams.set("type", "video");
    url.searchParams.set("maxResults", "10");
    url.searchParams.set("q", q);
    url.searchParams.set("key", apiKey);

    const response = await fetch(url.toString());
    if (!response.ok) {
      req.log.warn({ status: response.status }, "YouTube API error, falling back to mock");
      res.json(getMockResults(q));
      return;
    }

    const data = (await response.json()) as { items: YTSearchItem[] };
    const results = (data.items ?? []).map((item) => ({
      videoId: item.id.videoId,
      title: decodeHTMLEntities(item.snippet.title),
      channelTitle: item.snippet.channelTitle,
      thumbnail:
        item.snippet.thumbnails.medium?.url ??
        item.snippet.thumbnails.default?.url ??
        `https://img.youtube.com/vi/${item.id.videoId}/mqdefault.jpg`,
      duration: null,
    }));

    res.json(results);
  } catch (err) {
    req.log.error({ err }, "YouTube search failed, using mock");
    res.json(getMockResults(q));
  }
});

function decodeHTMLEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function getMockResults(q: string) {
  const mockVideos = [
    { videoId: "dQw4w9WgXcQ", title: "Rick Astley - Never Gonna Give You Up", channelTitle: "RickAstleyVEVO", thumbnail: "https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg", duration: "3:33" },
    { videoId: "9bZkp7q19f0", title: "PSY - GANGNAM STYLE", channelTitle: "officialpsy", thumbnail: "https://img.youtube.com/vi/9bZkp7q19f0/mqdefault.jpg", duration: "4:13" },
    { videoId: "kXYiU_JCYtU", title: "Linkin Park - Numb", channelTitle: "Linkin Park", thumbnail: "https://img.youtube.com/vi/kXYiU_JCYtU/mqdefault.jpg", duration: "3:07" },
    { videoId: "hT_nvWreIhg", title: "OneRepublic - Counting Stars", channelTitle: "OneRepublic", thumbnail: "https://img.youtube.com/vi/hT_nvWreIhg/mqdefault.jpg", duration: "4:18" },
    { videoId: "JGwWNGJdvx8", title: "Ed Sheeran - Shape of You", channelTitle: "Ed Sheeran", thumbnail: "https://img.youtube.com/vi/JGwWNGJdvx8/mqdefault.jpg", duration: "4:24" },
    { videoId: "fRh_vgS2dFE", title: "Justin Bieber - Sorry", channelTitle: "JustinBieberVEVO", thumbnail: "https://img.youtube.com/vi/fRh_vgS2dFE/mqdefault.jpg", duration: "3:20" },
    { videoId: "pRpeEdMmmQ0", title: "Shakira - Waka Waka", channelTitle: "shakiraVEVO", thumbnail: "https://img.youtube.com/vi/pRpeEdMmmQ0/mqdefault.jpg", duration: "3:34" },
    { videoId: "OPf0YbXqDm0", title: "Mark Ronson - Uptown Funk ft. Bruno Mars", channelTitle: "MarkRonsonVEVO", thumbnail: "https://img.youtube.com/vi/OPf0YbXqDm0/mqdefault.jpg", duration: "4:30" },
  ];

  return mockVideos.filter(
    (v) =>
      v.title.toLowerCase().includes(q.toLowerCase()) ||
      v.channelTitle.toLowerCase().includes(q.toLowerCase()),
  ).concat(mockVideos).slice(0, 8);
}

export default router;
