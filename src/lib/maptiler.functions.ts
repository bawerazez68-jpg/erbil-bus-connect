import { createServerFn } from "@tanstack/react-start";

export const getMapTilerKey = createServerFn({ method: "GET" }).handler(async () => {
  return { key: process.env.MAPTILER_KEY ?? "" };
});