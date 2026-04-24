import fs from "fs";
import path from "path";
import crypto from "crypto";
import { Router, type IRouter } from "express";

const router: IRouter = Router();

const UPLOAD_DIR = path.resolve(process.cwd(), "artifacts", "api-server", "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const MAX_FILE_BYTES = 80 * 1024 * 1024; // 80MB

function isMediaMime(mime: string | undefined): boolean {
  return !!mime && (mime.startsWith("audio/") || mime.startsWith("video/"));
}

function inferMimeFromFileName(fileName: string | undefined): string | undefined {
  if (!fileName) return undefined;
  const ext = path.extname(fileName).toLowerCase();
  const mimeByExt: Record<string, string> = {
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".m4a": "audio/mp4",
    ".aac": "audio/aac",
    ".ogg": "audio/ogg",
    ".flac": "audio/flac",
    ".webm": "audio/webm",
    ".mp4": "video/mp4",
    ".mov": "video/quicktime",
    ".mkv": "video/x-matroska",
  };
  return mimeByExt[ext];
}

function resolveMediaMimeType(input: {
  providedMimeType?: string;
  parsedMimeType?: string;
  fileName?: string;
}): string | undefined {
  const normalizedProvided = input.providedMimeType?.trim().toLowerCase();
  if (isMediaMime(normalizedProvided)) return normalizedProvided;

  const normalizedParsed = input.parsedMimeType?.trim().toLowerCase();
  if (isMediaMime(normalizedParsed)) return normalizedParsed;

  return inferMimeFromFileName(input.fileName);
}

function inferExtFromMime(mimeType: string): string {
  if (mimeType.includes("mpeg")) return ".mp3";
  if (mimeType.includes("wav")) return ".wav";
  if (mimeType.includes("aac")) return ".aac";
  if (mimeType.includes("ogg")) return ".ogg";
  if (mimeType.includes("flac")) return ".flac";
  if (mimeType.includes("audio/mp4")) return ".m4a";
  if (mimeType.includes("webm")) return ".webm";
  if (mimeType.includes("video/mp4")) return ".mp4";
  if (mimeType.includes("quicktime")) return ".mov";
  if (mimeType.includes("matroska")) return ".mkv";
  return "";
}

function resolveUploadedPath(fileName: string): string | null {
  const clean = path.basename(fileName);
  const abs = path.resolve(UPLOAD_DIR, clean);
  if (!abs.startsWith(UPLOAD_DIR)) return null;
  return abs;
}

function inferDownloadName(baseName: string, format: string | undefined): string {
  const safeBase = baseName.replace(/[^\w\- ]+/g, "_").trim() || "track";
  if (format === "mp3" || format === "mp4") {
    return `${safeBase}.${format}`;
  }
  return safeBase;
}

function parseDataUrl(dataUrl: string): { mimeType: string; buffer: Buffer } | null {
  const m = /^data:([^;]+);base64,(.+)$/s.exec(dataUrl);
  if (!m) return null;
  const mimeType = m[1];
  const b64 = m[2];
  const buffer = Buffer.from(b64, "base64");
  return { mimeType, buffer };
}

router.post("/media/upload", async (req, res): Promise<void> => {
  const body = req.body as {
    fileName?: string;
    mimeType?: string;
    dataUrl?: string;
    title?: string;
    userName?: string;
  };

  if (!body?.dataUrl || typeof body.dataUrl !== "string") {
    res.status(400).json({ error: "Missing file payload" });
    return;
  }

  const parsed = parseDataUrl(body.dataUrl);
  if (!parsed) {
    res.status(400).json({ error: "Invalid file payload" });
    return;
  }

  const mimeType = resolveMediaMimeType({
    providedMimeType: body.mimeType,
    parsedMimeType: parsed.mimeType,
    fileName: body.fileName,
  });
  if (!mimeType || !isMediaMime(mimeType)) {
    res.status(400).json({ error: "Only audio/video files are supported" });
    return;
  }

  if (parsed.buffer.byteLength > MAX_FILE_BYTES) {
    res.status(400).json({ error: "File too large (max 80MB)" });
    return;
  }

  const originalName = (body.fileName || "upload.bin")
    .replace(/[^\w.\- ]+/g, "_")
    .replace(/\s+/g, " ")
    .trim();

  const extFromName = path.extname(originalName);
  const extFromMime = inferExtFromMime(mimeType);
  const ext = extFromName || extFromMime || ".bin";
  const seed = crypto.randomBytes(4).toString("hex");
  const storedName = `${Date.now()}-${seed}${ext}`;
  const abs = path.resolve(UPLOAD_DIR, storedName);

  fs.writeFileSync(abs, parsed.buffer);

  const title =
    (typeof body.title === "string" && body.title.trim()) ||
    path.parse(originalName).name ||
    "Uploaded track";
  const userName =
    (typeof body.userName === "string" && body.userName.trim()) ||
    "Uploaded file";

  const isAudio = mimeType.startsWith("audio/");
  const thumbnail = isAudio
    ? "https://upload.wikimedia.org/wikipedia/commons/2/21/Speaker_Icon.svg"
    : "https://upload.wikimedia.org/wikipedia/commons/8/87/Video-Icon.svg";

  res.json({
    videoId: `upload_${crypto.randomBytes(8).toString("hex")}`,
    source: "upload",
    title,
    channelTitle: userName,
    thumbnail,
    duration: null,
    mediaUrl: `/api/media/files/${encodeURIComponent(storedName)}`,
    mimeType,
    fileName: originalName,
  });
});

router.get("/media/files/:fileName", (req, res): void => {
  const abs = resolveUploadedPath(req.params.fileName);
  if (!abs || !fs.existsSync(abs)) {
    res.status(404).json({ error: "File not found" });
    return;
  }

  const wantsDownload = req.query.download === "1";
  if (wantsDownload) {
    const baseName =
      typeof req.query.name === "string" && req.query.name.trim()
        ? req.query.name.trim()
        : path.parse(path.basename(abs)).name;
    const format = typeof req.query.format === "string" ? req.query.format.trim().toLowerCase() : undefined;
    const downloadName = inferDownloadName(baseName, format);
    res.download(abs, downloadName);
    return;
  }

  res.sendFile(abs);
});

export default router;
