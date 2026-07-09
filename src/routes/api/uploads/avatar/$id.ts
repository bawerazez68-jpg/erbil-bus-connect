import { createFileRoute } from "@tanstack/react-router";
import { readAvatarUpload } from "@/server/uploads";

// Public read: avatars are meant to be visible without auth. The `id` is a
// server-generated UUID looked up against the database, never a raw
// filesystem path, so there's no path-traversal surface here.
export const Route = createFileRoute("/api/uploads/avatar/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const found = await readAvatarUpload(params.id);
        if (!found) {
          return new Response("Not found", { status: 404 });
        }
        // TS's Uint8Array<ArrayBufferLike> vs BlobPart's ArrayBuffer-only
        // typing is stricter than the actual runtime guarantee here (these
        // bytes always come from a plain, non-shared ArrayBuffer).
        return new Response(new Blob([found.bytes as Uint8Array<ArrayBuffer>]), {
          headers: {
            "Content-Type": found.mime,
            "Cache-Control": "public, max-age=31536000, immutable",
            "Content-Disposition": "inline",
            "X-Content-Type-Options": "nosniff",
          },
        });
      },
    },
  },
});
