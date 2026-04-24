import crypto from "crypto";
import { Router, type IRouter } from "express";

const router: IRouter = Router();

function normalizeInputUrl(raw: string): string | null {
  try {
    const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    return new URL(withScheme).toString();
  } catch {
    return null;
  }
}

function isSoundCloudUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    const host = u.hostname.toLowerCase();
    return (
      host === "snd.sc" ||
      host === "soundcloud.app.goo.gl" ||
      host === "on.soundcloud.com" ||
      host === "soundcloud.com" ||
      host.endsWith(".soundcloud.com")
    );
  } catch {
    return false;
  }
}

function toCanonicalSoundCloudUrl(raw: string): string {
  try {
    const u = new URL(raw);
    // Keep only the canonical path so widget parsing stays stable across share links.
    return `${u.protocol}//${u.host}${u.pathname}`;
  } catch {
    return raw;
  }
}

function extractWidgetTrackUrl(oembedHtml?: string): string | null {
  if (!oembedHtml) return null;
  const srcMatch = oembedHtml.match(/src="([^"]+)"/i);
  if (!srcMatch?.[1]) return null;
  try {
    const iframeSrc = new URL(srcMatch[1]);
    const embeddedUrl = iframeSrc.searchParams.get("url");
    if (!embeddedUrl) return null;
    const normalized = decodeURIComponent(embeddedUrl);
    return /^https?:\/\//i.test(normalized) ? normalized : null;
  } catch {
    return null;
  }
}

async function normalizeResolvableSoundCloudUrl(raw: string): Promise<string> {
  if (!isSoundCloudUrl(raw)) return raw;

  try {
    const host = new URL(raw).hostname.toLowerCase();
    if (host === "snd.sc" || host === "on.soundcloud.com" || host === "soundcloud.app.goo.gl") {
      const redirectResponse = await fetch(raw, { redirect: "follow" });
      const redirectedUrl = redirectResponse.url;
      if (redirectedUrl && isSoundCloudUrl(redirectedUrl)) {
        return redirectedUrl;
      }
    }
  } catch {
    // fall back to the original URL
  }

  return raw;
}

router.get("/soundcloud/resolve", async (req, res): Promise<void> => {
  const requestedUrl = typeof req.query.url === "string" ? req.query.url.trim() : "";
  const normalizedInput = normalizeInputUrl(requestedUrl);
  if (!normalizedInput || !isSoundCloudUrl(normalizedInput)) {
    res.status(400).json({ error: "Invalid SoundCloud URL" });
    return;
  }

  try {
    const resolvedUrl = await normalizeResolvableSoundCloudUrl(normalizedInput);
    const resolvedCanonical = toCanonicalSoundCloudUrl(resolvedUrl);
    const inputCanonical = toCanonicalSoundCloudUrl(normalizedInput);
    const candidateUrls = [resolvedCanonical];
    if (resolvedUrl !== resolvedCanonical) {
      candidateUrls.push(resolvedUrl);
    }
    if (inputCanonical !== resolvedCanonical) {
      candidateUrls.push(inputCanonical);
    }
    if (resolvedUrl !== normalizedInput) {
      candidateUrls.push(normalizedInput);
    }

    let data:
      | {
          title?: string;
          author_name?: string;
          thumbnail_url?: string;
          html?: string;
        }
      | null = null;
    let finalTrackUrl = resolvedUrl;

    for (const url of candidateUrls) {
      const oembedUrl = `https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(url)}`;
      const response = await fetch(oembedUrl);
      if (!response.ok) continue;
      data = (await response.json()) as {
        title?: string;
        author_name?: string;
        thumbnail_url?: string;
        html?: string;
      };
      finalTrackUrl = url;
      break;
    }

    if (!data) {
      res.status(404).json({ error: "Cannot resolve SoundCloud track" });
      return;
    }

    const widgetTrackUrl = extractWidgetTrackUrl(data.html);
    const mediaUrl = widgetTrackUrl ?? toCanonicalSoundCloudUrl(finalTrackUrl);
    const idSeed = crypto.createHash("sha1").update(mediaUrl).digest("hex").slice(0, 16);

    res.json({
      videoId: `sc_${idSeed}`,
      source: "soundcloud",
      title: data.title ?? "SoundCloud track",
      channelTitle: data.author_name ?? "SoundCloud",
      thumbnail:
        data.thumbnail_url ??
        "https://upload.wikimedia.org/wikipedia/commons/7/72/Soundcloud_logo.svg",
      duration: null,
      mediaUrl,
      mimeType: null,
      fileName: null,
    });
  } catch (err) {
    req.log.error({ err }, "soundcloud resolve failed");
    res.status(500).json({ error: "SoundCloud lookup failed" });
  }
});

export default router;
