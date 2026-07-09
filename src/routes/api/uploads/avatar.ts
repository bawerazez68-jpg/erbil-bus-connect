import { createFileRoute } from "@tanstack/react-router";
import { verifyAccessToken, JwtVerificationError } from "@/server/security/jwt";
import { getJwtAccessSecret } from "@/server/security/env";
import { consumeRateLimit, getClientIp } from "@/server/security/rate-limit";
import { logSecurityEvent } from "@/server/security/audit-log";
import { ALLOWED_UPLOAD_MIME_TYPES, MAX_UPLOAD_BYTES } from "@/server/security/validation";
import { sniffImageMime, saveAvatarUpload } from "@/server/uploads";

// This is a server ROUTE (not a createServerFn) because it needs raw
// multipart/form-data handling. Server routes only accept request-type
// middleware, so auth + rate limiting are checked inline here rather than
// via the function-type authMiddleware/rateLimitMiddleware used by the
// createServerFn-based auth endpoints.
export const Route = createFileRoute("/api/uploads/avatar")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const ip = getClientIp(request);

        if (!consumeRateLimit(`upload:${ip}`, 10, 60 * 1000)) {
          logSecurityEvent({ type: "rate_limit_exceeded", ip, detail: { key: "upload" } });
          return Response.json({ error: "Too many requests" }, { status: 429 });
        }

        const authHeader = request.headers.get("authorization");
        const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;
        if (!token) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }
        let userId: string;
        try {
          const payload = verifyAccessToken(token, getJwtAccessSecret());
          userId = payload.sub;
        } catch (err) {
          if (err instanceof JwtVerificationError) {
            return Response.json({ error: "Unauthorized" }, { status: 401 });
          }
          throw err;
        }

        let form: FormData;
        try {
          form = await request.formData();
        } catch {
          return Response.json({ error: "Expected multipart/form-data" }, { status: 400 });
        }

        const file = form.get("avatar");
        if (!(file instanceof File)) {
          return Response.json({ error: "Missing avatar file" }, { status: 400 });
        }
        if (file.size === 0 || file.size > MAX_UPLOAD_BYTES) {
          logSecurityEvent({
            type: "upload_rejected",
            userId,
            ip,
            detail: { reason: "size", size: file.size },
          });
          return Response.json(
            { error: `File must be between 1 byte and ${MAX_UPLOAD_BYTES} bytes` },
            { status: 400 },
          );
        }

        const bytes = new Uint8Array(await file.arrayBuffer());
        // Never trust the client-supplied filename or Content-Type — sniff
        // the real type from the file's magic bytes.
        const sniffed = sniffImageMime(bytes);
        if (!sniffed || !(ALLOWED_UPLOAD_MIME_TYPES as readonly string[]).includes(sniffed.mime)) {
          logSecurityEvent({
            type: "upload_rejected",
            userId,
            ip,
            detail: { reason: "mime", claimedType: file.type },
          });
          return Response.json({ error: "Unsupported or invalid image file" }, { status: 400 });
        }

        const saved = await saveAvatarUpload({
          userId,
          bytes,
          mime: sniffed.mime,
          ext: sniffed.ext,
        });
        logSecurityEvent({
          type: "upload_accepted",
          userId,
          ip,
          detail: { id: saved.id, mime: sniffed.mime, size: bytes.byteLength },
        });

        return Response.json(
          { id: saved.id, url: `/api/uploads/avatar/${saved.id}` },
          { status: 201 },
        );
      },
    },
  },
});
