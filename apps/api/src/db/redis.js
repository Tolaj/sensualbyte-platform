import { createClient } from "redis";

let redis = null;

export async function getRedis() {
  if (redis) return redis;

  const url = process.env.REDIS_URL;
  if (!url) throw new Error("REDIS_URL is not set");

  redis = createClient({ url });
  redis.on("error", (err) => console.error("Redis error:", err));
  await redis.connect();
  return redis;
}

export async function closeRedis() {
  if (redis) await redis.quit();
  redis = null;
}
