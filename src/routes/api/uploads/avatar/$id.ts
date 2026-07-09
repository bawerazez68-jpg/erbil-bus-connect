import { createFileRoute } from "@tanstack/react-router";
import { getAvatarUploadPath } from "@/server/uploads";

// Public read: avatars are meant to be visible without auth. The `id` is a
// server-generated UUID looked up against the database, never a raw
// filesystem path, so there's no path-traversal surface here.
export const Route = createFileRoute("/api/uploads/avatar/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const found = getAvatarUploadPath(params.id);
        if (!found) {
          return new Response("Not found", { status: 404 });
        }
        const file = Bun.file(found.filePath);
        if (!(await file.exists())) {
          return new Response("Not found", { status: 404 });
        }
        return new Response(file, {
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
