import type { AuthResponse, PublicUser, SessionResponse } from "@timixed-diary/types";

import { ApiError } from "./errors.js";
import { sql } from "./db.js";
import { hashPassword, verifyPassword } from "./password.js";
import { signAccessToken } from "./tokens.js";

type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  handle: string;
  display_name: string;
  avatar_url: string | null;
};

type PublicUserRow = Omit<UserRow, "email" | "password_hash">;

function mapPublicUser(row: PublicUserRow): PublicUser {
  return {
    id: row.id,
    handle: row.handle,
    display_name: row.display_name,
    avatar_url: row.avatar_url,
  };
}

function isUniqueViolation(error: unknown, constraint: string) {
  return typeof error === "object" && error !== null && "code" in error && "constraint_name" in error
    ? (error as { code?: string; constraint_name?: string }).code === "23505" &&
        (error as { constraint_name?: string }).constraint_name === constraint
    : false;
}

export type AuthenticatedUser = PublicUser & {
  email: string;
};

export async function findUserById(userId: string): Promise<AuthenticatedUser | null> {
  const rows = await sql<UserRow[]>`
    select id, email, password_hash, handle, display_name, avatar_url
    from users
    where id = ${userId}
    limit 1
  `;

  const row = rows[0];

  if (!row) {
    return null;
  }

  return {
    ...mapPublicUser(row),
    email: row.email,
  };
}

export async function registerUser(input: {
  email: string;
  handle: string;
  display_name: string;
  password: string;
}): Promise<AuthResponse> {
  const passwordHash = await hashPassword(input.password);

  try {
    const rows = await sql<PublicUserRow[]>`
      insert into users (email, password_hash, handle, display_name)
      values (${input.email}, ${passwordHash}, ${input.handle}, ${input.display_name})
      returning id, handle, display_name, avatar_url
    `;

    const user = mapPublicUser(rows[0]!);
    const token = await signAccessToken(user.id);

    return { token, user };
  } catch (error) {
    if (isUniqueViolation(error, "users_email_key")) {
      throw new ApiError(409, "EMAIL_ALREADY_USED", "That email address is already in use.");
    }

    if (isUniqueViolation(error, "users_handle_key")) {
      throw new ApiError(409, "HANDLE_ALREADY_USED", "That handle is already in use.");
    }

    throw error;
  }
}

export async function loginUser(input: {
  login: string;
  password: string;
}): Promise<AuthResponse> {
  const rows = await sql<UserRow[]>`
    select id, email, password_hash, handle, display_name, avatar_url
    from users
    where email = ${input.login} or handle = ${input.login}
    limit 1
  `;

  const user = rows[0];

  if (!user || !(await verifyPassword(input.password, user.password_hash))) {
    throw new ApiError(401, "INVALID_CREDENTIALS", "The email, handle, or password is incorrect.");
  }

  return {
    token: await signAccessToken(user.id),
    user: mapPublicUser(user),
  };
}

export async function getSession(userId: string): Promise<SessionResponse> {
  const user = await findUserById(userId);

  if (!user) {
    throw new ApiError(401, "UNAUTHORIZED", "Your session is not valid.");
  }

  return {
    user,
  };
}
