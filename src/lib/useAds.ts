import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";

export type Ad = {
  id: string;
  title: string;
  body: string;
  advertiserName: string;
  likeCount: number;
  likedByMe: boolean;
  createdAt: number;
};

export type MyAd = {
  id: string;
  title: string;
  body: string;
  status: "active" | "paused";
  viewCount: number;
  likeCount: number;
  createdAt: number;
};

async function authedFetch<T>(path: string, accessToken: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      body && typeof body === "object" && typeof body.error === "string"
        ? body.error
        : "Request failed";
    throw new Error(message);
  }
  return body as T;
}

/** Polls the shared ad feed shown on the passenger/owner/auditor dashboards. */
export function useAds(pollMs = 10000) {
  const { accessToken } = useAuth();
  const [ads, setAds] = useState<Ad[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Tracks ad ids we've already recorded a view for in this session so a
  // re-render or re-poll can't call /view repeatedly (the server is
  // idempotent per-viewer anyway, but this avoids the redundant requests).
  const viewedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;

    const poll = async () => {
      try {
        const data = await authedFetch<{ ads: Ad[] }>("/api/ads", accessToken);
        if (cancelled) return;
        setAds(data.ads);
        setError(null);
        for (const ad of data.ads) {
          if (viewedRef.current.has(ad.id)) continue;
          viewedRef.current.add(ad.id);
          void authedFetch(`/api/ads/${ad.id}/view`, accessToken, { method: "POST" }).catch(
            () => {},
          );
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load ads");
      }
    };

    void poll();
    const id = setInterval(poll, pollMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [accessToken, pollMs]);

  const toggleLike = useCallback(
    async (adId: string) => {
      if (!accessToken) return;
      const result = await authedFetch<{ liked: boolean; likeCount: number }>(
        `/api/ads/${adId}/like`,
        accessToken,
        { method: "POST" },
      );
      setAds((prev) =>
        prev.map((a) =>
          a.id === adId ? { ...a, likedByMe: result.liked, likeCount: result.likeCount } : a,
        ),
      );
    },
    [accessToken],
  );

  return { ads, error, toggleLike };
}

/** The advertiser's own ads with view/like stats, plus actions to post and pause/resume. */
export function useMyAds(pollMs = 5000) {
  const { accessToken } = useAuth();
  const [ads, setAds] = useState<MyAd[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!accessToken) return;
    try {
      const data = await authedFetch<{ ads: MyAd[] }>("/api/ads/mine", accessToken);
      setAds(data.ads);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load ads");
    }
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken) return;
    void refresh();
    const id = setInterval(refresh, pollMs);
    return () => clearInterval(id);
  }, [accessToken, pollMs, refresh]);

  const createAd = useCallback(
    async (title: string, body: string) => {
      if (!accessToken) return;
      await authedFetch("/api/ads", accessToken, {
        method: "POST",
        body: JSON.stringify({ title, body }),
      });
      await refresh();
    },
    [accessToken, refresh],
  );

  const setStatus = useCallback(
    async (adId: string, status: "active" | "paused") => {
      if (!accessToken) return;
      await authedFetch(`/api/ads/${adId}`, accessToken, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await refresh();
    },
    [accessToken, refresh],
  );

  return { ads, error, createAd, setStatus, refresh };
}
