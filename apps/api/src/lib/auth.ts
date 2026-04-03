import type { Context } from "hono";

import { ApiError } from "./errors.js";
import { verifyAccessToken } from "./tokens.js";
import { findUserById, type AuthenticatedUser } from "./users.js";

export async function requireUser(c: Context): Promise<AuthenticatedUser> {
  const authorization = c.req.header("authorization");

  if (!authorization?.toLowerCase().startsWith("bearer ")) {
    throw new ApiError(401, "UNAUTHORIZED", "A bearer token is required.");
  }

  const token = authorization.slice("bearer ".length).trim();

  if (!token) {
    throw new ApiError(401, "UNAUTHORIZED", "A bearer token is required.");
  }

  try {
    const userId = await verifyAccessToken(token);
    const user = await findUserById(userId);

    if (!user) {
      throw new ApiError(401, "UNAUTHORIZED", "Your session is not valid.");
    }

    return user;
  } catch {
    throw new ApiError(401, "UNAUTHORIZED", "Your session is not valid.");
  }
}

export async function optionalUser(c: Context): Promise<AuthenticatedUser | null> {
  const authorization = c.req.header("authorization");

  if (!authorization?.toLowerCase().startsWith("bearer ")) {
    return null;
  }

  const token = authorization.slice("bearer ".length).trim();

  if (!token) {
    return null;
  }

  try {
    const userId = await verifyAccessToken(token);
    return await findUserById(userId);
  } catch {
    return null;
  }
}
