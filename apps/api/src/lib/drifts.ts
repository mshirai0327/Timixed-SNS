import crypto from "node:crypto";

import type { CreateDriftResponse, DriftPublic, TimelineResponse } from "@timixed-diary/types";

import { getCache } from "./cache";
import { sql } from "./db";
import { ApiError } from "./errors";

const DEFAULT_TIMELINE_LIMIT = 20;
const MAX_TIMELINE_LIMIT = 50;
const MAX_DRIFTS_PER_HOUR = 10;
const SESSION_SEED_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type TimelineRow = {
  id: string;
  author_id: string;
  author_handle: string;
  author_display_name: string;
  author_avatar_url: string | null;
  body: string;
  resurface_count: number;
  resonance_count: number;
  is_resonated: boolean;
  is_mine: boolean;
};

export function parseTimelinePagination(
  limitParam?: string,
  offsetParam?: string,
): {
  limit: number;
  offset: number;
} {
  const limit = limitParam ? Number(limitParam) : DEFAULT_TIMELINE_LIMIT;
  const offset = offsetParam ? Number(offsetParam) : 0;

  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_TIMELINE_LIMIT) {
    throw new ApiError(
      400,
      "VALIDATION_ERROR",
      `limit must be an integer between 1 and ${MAX_TIMELINE_LIMIT}.`,
    );
  }

  if (!Number.isInteger(offset) || offset < 0) {
    throw new ApiError(400, "VALIDATION_ERROR", "offset must be a non-negative integer.");
  }

  return { limit, offset };
}

function normalizeSessionSeed(seedHeader?: string): string | null {
  if (!seedHeader) {
    return null;
  }

  if (!SESSION_SEED_PATTERN.test(seedHeader)) {
    throw new ApiError(400, "VALIDATION_ERROR", "X-Session-Seed must be a UUID.");
  }

  return crypto.createHash("sha256").update(seedHeader).digest("hex");
}

function normalizeBody(body: string): string {
  const normalized = body.trim();

  if (!normalized) {
    throw new ApiError(400, "VALIDATION_ERROR", "body must be between 1 and 500 characters.");
  }

  if (normalized.length > 500) {
    throw new ApiError(400, "VALIDATION_ERROR", "body must be between 1 and 500 characters.");
  }

  return normalized;
}

function mapTimelineRow(row: TimelineRow): DriftPublic {
  return {
    id: row.id,
    author: {
      id: row.author_id,
      handle: row.author_handle,
      display_name: row.author_display_name,
      avatar_url: row.author_avatar_url,
    },
    body: row.body,
    resurface_count: row.resurface_count,
    resonance_count: Number(row.resonance_count),
    is_resonated: row.is_resonated,
    is_mine: row.is_mine,
  };
}

async function assertPostingRateLimit(userId: string) {
  const cache = getCache();

  if (cache?.isOpen) {
    const bucket = new Date().toISOString().slice(0, 13);
    const key = `rate-limit:drifts:${userId}:${bucket}`;
    const count = await cache.incr(key);

    if (count === 1) {
      await cache.expire(key, 60 * 60 + 30);
    }

    if (count > MAX_DRIFTS_PER_HOUR) {
      throw new ApiError(
        429,
        "RATE_LIMIT_EXCEEDED",
        "You can only send 10 drifts per hour.",
      );
    }

    return;
  }

  const threshold = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const rows = await sql<{ count: string }[]>`
    select count(*)::text as count
    from drifts
    where user_id = ${userId}
      and composed_at >= ${threshold}
  `;

  if (Number(rows[0]?.count ?? "0") >= MAX_DRIFTS_PER_HOUR) {
    throw new ApiError(
      429,
      "RATE_LIMIT_EXCEEDED",
      "You can only send 10 drifts per hour.",
    );
  }
}

export async function createDrift(userId: string, body: string): Promise<CreateDriftResponse> {
  const normalizedBody = normalizeBody(body);
  await assertPostingRateLimit(userId);

  const rows = await sql<{ id: string }[]>`
    insert into drifts (user_id, body)
    values (${userId}, ${normalizedBody})
    returning id
  `;

  const data = rows[0];

  if (!data) {
    throw new ApiError(500, "INTERNAL_ERROR", "Failed to create the drift.");
  }

  return {
    id: data.id,
    is_mine: true,
  };
}

export async function getTimeline(
  viewerId: string | null,
  limitParam?: string,
  offsetParam?: string,
  seedHeader?: string,
): Promise<TimelineResponse> {
  const { limit, offset } = parseTimelinePagination(limitParam, offsetParam);
  const seed = normalizeSessionSeed(seedHeader);

  let rows: TimelineRow[];

  if (!viewerId) {
    rows = seed
      ? await sql<TimelineRow[]>`
        select
          d.id,
          u.id as author_id,
          u.handle as author_handle,
          u.display_name as author_display_name,
          u.avatar_url as author_avatar_url,
          d.body,
          d.resurface_count,
          coalesce(rc.resonance_count, 0)::int as resonance_count,
          false as is_resonated,
          false as is_mine
        from drifts d
        join users u on u.id = d.user_id
        left join lateral (
          select count(*) as resonance_count
          from resonances r
          where r.drift_id = d.id
        ) rc on true
        where d.deleted_at is null
          and d.surface_at <= now()
        order by md5(d.id::text || ${seed})
        limit ${limit + 1}
        offset ${offset}
      `
      : await sql<TimelineRow[]>`
        select
          d.id,
          u.id as author_id,
          u.handle as author_handle,
          u.display_name as author_display_name,
          u.avatar_url as author_avatar_url,
          d.body,
          d.resurface_count,
          coalesce(rc.resonance_count, 0)::int as resonance_count,
          false as is_resonated,
          false as is_mine
        from drifts d
        join users u on u.id = d.user_id
        left join lateral (
          select count(*) as resonance_count
          from resonances r
          where r.drift_id = d.id
        ) rc on true
        where d.deleted_at is null
          and d.surface_at <= now()
        order by random()
        limit ${limit + 1}
        offset ${offset}
      `;
  } else {
    rows = seed
      ? await sql<TimelineRow[]>`
        select
          d.id,
          u.id as author_id,
          u.handle as author_handle,
          u.display_name as author_display_name,
          u.avatar_url as author_avatar_url,
          d.body,
          d.resurface_count,
          coalesce(rc.resonance_count, 0)::int as resonance_count,
          coalesce(me.is_resonated, false) as is_resonated,
          d.user_id = ${viewerId} as is_mine
        from drifts d
        join users u on u.id = d.user_id
        left join lateral (
          select count(*) as resonance_count
          from resonances r
          where r.drift_id = d.id
        ) rc on true
        left join lateral (
          select true as is_resonated
          from resonances r
          where r.drift_id = d.id
            and r.user_id = ${viewerId}
          limit 1
        ) me on true
        where d.deleted_at is null
          and (
            d.user_id = ${viewerId}
            or d.surface_at <= now()
          )
          and (
            d.user_id = ${viewerId}
            or exists (
              select 1
              from follows f
              where f.follower_id = ${viewerId}
                and f.following_id = d.user_id
            )
            or not exists (
              select 1
              from follows onboarding_follows
              where onboarding_follows.follower_id = ${viewerId}
            )
          )
        order by md5(d.id::text || ${seed})
        limit ${limit + 1}
        offset ${offset}
      `
      : await sql<TimelineRow[]>`
        select
          d.id,
          u.id as author_id,
          u.handle as author_handle,
          u.display_name as author_display_name,
          u.avatar_url as author_avatar_url,
          d.body,
          d.resurface_count,
          coalesce(rc.resonance_count, 0)::int as resonance_count,
          coalesce(me.is_resonated, false) as is_resonated,
          d.user_id = ${viewerId} as is_mine
        from drifts d
        join users u on u.id = d.user_id
        left join lateral (
          select count(*) as resonance_count
          from resonances r
          where r.drift_id = d.id
        ) rc on true
        left join lateral (
          select true as is_resonated
          from resonances r
          where r.drift_id = d.id
            and r.user_id = ${viewerId}
          limit 1
        ) me on true
        where d.deleted_at is null
          and (
            d.user_id = ${viewerId}
            or d.surface_at <= now()
          )
          and (
            d.user_id = ${viewerId}
            or exists (
              select 1
              from follows f
              where f.follower_id = ${viewerId}
                and f.following_id = d.user_id
            )
            or not exists (
              select 1
              from follows onboarding_follows
              where onboarding_follows.follower_id = ${viewerId}
            )
          )
        order by random()
        limit ${limit + 1}
        offset ${offset}
      `;
  }

  const hasMore = rows.length > limit;

  return {
    drifts: rows.slice(0, limit).map(mapTimelineRow),
    has_more: hasMore,
  };
}
