import { SignJWT, jwtVerify } from "jose";

import { config } from "../config";

const secret = new TextEncoder().encode(config.APP_SECRET);

export async function signAccessToken(userId: string) {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${config.ACCESS_TOKEN_TTL_DAYS}d`)
    .sign(secret);
}

export async function verifyAccessToken(token: string) {
  const { payload } = await jwtVerify(token, secret);

  if (!payload.sub) {
    throw new Error("Missing token subject.");
  }

  return payload.sub;
}

