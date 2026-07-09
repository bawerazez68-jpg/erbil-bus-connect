import { createFileRoute } from "@tanstack/react-router";
import { verifyAccessToken, JwtVerificationError } from "@/server/security/jwt";
import { getJwtAccessSecret } from "@/server/security/env";
import { getPublicUserById } from "@/server/auth.server";

export const Route = createFileRoute("/api/auth/me")({
  server: {
    handlers: {
      GET: async ({ request }) => {
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

        const user = getPublicUserById(userId);
        if (!user) {
          return Response.json({ error: "Account no longer exists" }, { status: 401 });
        }
        return Response.json(user);
      },
    },
  },
});
