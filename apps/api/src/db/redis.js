import { createClient } from "redis";

let redis = null;

function num(name, fallback) {
  const v = Number(process.env[name]);
  return Number.isFinite(v) ? v : fallback;
}

function redactRedisUrl(url) {
  // redis://:password@host:port -> redis://***@host:port
  try {
    const u = new URL(url);
    const auth = u.password || u.username ? "***@" : "";
    return `${u.protocol}//${auth}${u.host}${u.pathname || ""}`;
  } catch {
    return "redis://***";
  }
}

export async function getRedis() {
  if (redis) return redis;

  const url = process.env.REDIS_URL;
  if (!url) throw new Error("REDIS_URL is not set");

  const connectTimeout = num("REDIS_CONNECT_TIMEOUT_MS", 5000);
  const socketKeepAlive = num("REDIS_KEEPALIVE_MS", 5000);

  console.log("▶ Connecting to Redis...", {
    url: redactRedisUrl(url),
    connectTimeout,
    socketKeepAlive
  });

  redis = createClient({
    url,
    socket: {
      connectTimeout,
      keepAlive: socketKeepAlive,
      reconnectStrategy: (retries) => {
        // backoff up to 2s
        return Math.min(2000, 50 * retries);
      }
    }
  });

  redis.on("error", (err) => {
    // redis will emit errors even when it reconnects; log but don't crash
    console.error("Redis error:", err?.message || err);
  });

  try {
    await redis.connect();
    // quick sanity check
    await redis.ping();
  } catch (err) {
    console.error("❌ Redis connect failed:", err?.message || err);
    try {
      await redis.quit();
    } catch { }
    redis = null;
    throw err;
  }

  console.log("✅ Redis connected");
  return redis;
}

export async function closeRedis() {
  if (!redis) return;

  try {
    await redis.quit();
  } finally {
    redis = null;
  }
}
