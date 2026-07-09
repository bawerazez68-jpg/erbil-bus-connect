import crypto from "node:crypto";
import path from "node:path";
import { mkdirSync } from "node:fs";
import { insertAvatarUpload, findAvatarUploadById } from "./db";

// Stored outside of public/ — the only way to read a file back is through
// the controlled GET route (routes/api/uploads/avatar.$id.ts), which looks
// the id up in the database rather than trusting a client-supplied path.
const uploadsDir = path.join(process.cwd(), "data", "uploads");
mkdirSync(uploadsDir, { recursive: true });

const MAGIC_BYTES: Array<{
  mime: "image/png" | "image/jpeg" | "image/webp";
  ext: string;
  check: (b: Uint8Array) => boolean;
}> = [
  {
    mime: "image/png",
    ext: "png",
    check: (b) =>
      b.length >= 8 &&
      b[0] === 0x89 &&
      b[1] === 0x50 &&
      b[2] === 0x4e &&
      b[3] === 0x47 &&
      b[4] === 0x0d &&
      b[5] === 0x0a &&
      b[6] === 0x1a &&
      b[7] === 0x0a,
  },
  {
    mime: "image/jpeg",
    ext: "jpg",
    check: (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    mime: "image/webp",
    ext: "webp",
    check: (b) =>
      b.length >= 12 &&
      b[0] === 0x52 &&
      b[1] === 0x49 &&
      b[2] === 0x46 &&
      b[3] === 0x46 && // "RIFF"
      b[8] === 0x57 &&
      b[9] === 0x45 &&
      b[10] === 0x42 &&
      b[11] === 0x50, // "WEBP"
  },
];

/** Identifies the real file type from its content, ignoring any client-supplied filename or Content-Type. */
export function sniffImageMime(bytes: Uint8Array): { mime: string; ext: string } | null {
  for (const candidate of MAGIC_BYTES) {
    if (candidate.check(bytes)) return { mime: candidate.mime, ext: candidate.ext };
  }
  return null;
}

export async function saveAvatarUpload(input: {
  userId: string;
  bytes: Uint8Array;
  mime: string;
  ext: string;
}): Promise<{ id: string }> {
  const id = crypto.randomUUID();
  // Server-generated filename only — the client's original filename is
  // never used for the path, which rules out path traversal and overwrite
  // attacks via crafted filenames.
  const filename = `${id}.${input.ext}`;
  const filePath = path.join(uploadsDir, filename);
  await Bun.write(filePath, input.bytes);
  insertAvatarUpload({
    id,
    userId: input.userId,
    filename,
    mime: input.mime,
    size: input.bytes.byteLength,
  });
  return { id };
}

export function getAvatarUploadPath(id: string): { filePath: string; mime: string } | null {
  const row = findAvatarUploadById(id);
  if (!row) return null;
  return { filePath: path.join(uploadsDir, row.filename), mime: row.mime };
}
