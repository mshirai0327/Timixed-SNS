import type { Context } from "hono";

import { ApiError } from "./errors";
import { supabaseAdmin } from "./supabase";

export type AuthenticatedUser = {
  id: string;
  email: string | null;
};

export async function requireUser(c: Context): Promise<AuthenticatedUser> {
  const authorization = c.req.header("authorization");

  if (!authorization?.toLowerCase().startsWith("bearer ")) {
    throw new ApiError(401, "UNAUTHORIZED", "A bearer token is required.");
  }

  const token = authorization.slice("bearer ".length).trim();

  if (!token) {
    throw new ApiError(401, "UNAUTHORIZED", "A bearer token is required.");
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !data.user) {
    throw new ApiError(401, "UNAUTHORIZED", "Your session is not valid.");
  }

  return {
    id: data.user.id,
    email: data.user.email ?? null,
  };
}

