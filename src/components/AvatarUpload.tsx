import { useRef, useState } from "react";
import { useAuth } from "@/lib/auth";

const MAX_BYTES = 2 * 1024 * 1024;

/**
 * Minimal avatar upload control. Exercises the server-side upload pipeline
 * (auth check, rate limit, magic-byte MIME sniffing, size cap, random
 * server-generated filename) at /api/uploads/avatar.
 */
export function AvatarUpload() {
  const { accessToken } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  if (!accessToken) return null;

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (file.size > MAX_BYTES) {
      setStatus("error");
      setError("Image must be 2MB or smaller");
      return;
    }

    setStatus("uploading");
    setError(null);
    try {
      const form = new FormData();
      form.append("avatar", file);
      const res = await fetch("/api/uploads/avatar", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: form,
      });
      const body = (await res.json().catch(() => null)) as { url?: string; error?: string } | null;
      if (!res.ok || !body?.url) {
        throw new Error(body?.error ?? "Upload failed");
      }
      setAvatarUrl(body.url);
      setStatus("idle");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Upload failed");
    }
  };

  return (
    <div className="flex items-center gap-2">
      {avatarUrl && (
        <img
          src={avatarUrl}
          alt="Avatar"
          className="w-7 h-7 rounded-full object-cover border border-white/30"
        />
      )}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={status === "uploading"}
        className="text-xs text-white/90 hover:text-white px-3 py-1.5 rounded-full bg-white/10 border border-white/20 backdrop-blur disabled:opacity-60"
        title={error ?? undefined}
      >
        {status === "uploading" ? "…" : "Avatar"}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={onFileChange}
      />
    </div>
  );
}
