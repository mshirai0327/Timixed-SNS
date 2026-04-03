import crypto from "node:crypto";

import type { CreateDriftResponse, DriftPublic, TimelineResponse } from "@drift/types";

import { ApiError } from "./errors";
import { supabaseAdmin } from "./supabase";

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

function normalizeSessionSeed(seedHeader?: string): number | null {
  if (!seedHeader) {
    return null;
  }

  if (!SESSION_SEED_PATTERN.test(seedHeader)) {
    throw new ApiError(400, "VALIDATION_ERROR", "X-Session-Seed must be a UUID.");
  }

  const hash = crypto.createHash("sha256").update(seedHeader).digest();
  const bucket = hash.readUInt32BE(0);

  return (bucket / 0xffffffff) * 2 - 1;
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

export async function createDrift(userId: string, body: string): Promise<CreateDriftResponse> {
  const normalizedBody = normalizeBody(body);
  const threshold = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { count, error: rateLimitError } = await supabaseAdmin
    .from("drifts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("composed_at", threshold);

  if (rateLimitError) {
    throw new ApiError(500, "INTERNAL_ERROR", "Failed to validate your posting rate.");
  }

  if ((count ?? 0) >= MAX_DRIFTS_PER_HOUR) {
    throw new ApiError(
      429,
      "RATE_LIMIT_EXCEEDED",
      "You can only send 10 drifts per hour.",
    );
  }

  const { data, error } = await supabaseAdmin
    .from("drifts")
    .insert({
      user_id: userId,
      body: normalizedBody,
    })
    .select("id")
    .single();

  if (error || !data) {
    if (error?.code === "23503") {
      throw new ApiError(
        403,
        "FORBIDDEN",
        "A profile row is required before posting. Check the users trigger or create the profile first.",
      );
    }

    throw new ApiError(500, "INTERNAL_ERROR", "Failed to create the drift.");
  }

  return {
    id: data.id,
    is_mine: true,
  };
}

export async function getTimeline(
  viewerId: string,
  limitParam?: string,
  offsetParam?: string,
  seedHeader?: string,
): Promise<TimelineResponse> {
  const { limit, offset } = parseTimelinePagination(limitParam, offsetParam);
  const seed = normalizeSessionSeed(seedHeader);

  const { data, error } = await supabaseAdmin.rpc("get_timeline_entries", {
    p_limit: limit + 1,
    p_offset: offset,
    p_seed: seed,
    p_viewer_id: viewerId,
  });

  if (error) {
    throw new ApiError(500, "INTERNAL_ERROR", "Failed to load the timeline.");
  }

  const rows = (data ?? []) as TimelineRow[];
  const hasMore = rows.length > limit;

  return {
    drifts: rows.slice(0, limit).map(mapTimelineRow),
    has_more: hasMore,
  };
}

