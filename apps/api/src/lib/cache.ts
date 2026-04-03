import { createClient, type RedisClientType } from "redis";

import { config } from "../config.js";

let redis: RedisClientType | null = config.REDIS_URL
  ? createClient({
      url: config.REDIS_URL,
    })
  : null;

if (redis) {
  redis.on("error", (error) => {
    console.error("Redis error", error);
  });
}

export async function connectCache() {
  if (redis && !redis.isOpen) {
    await redis.connect();
  }
}

export function getCache() {
  return redis;
}

export async function closeCache() {
  if (redis?.isOpen) {
    await redis.quit();
  }
}
