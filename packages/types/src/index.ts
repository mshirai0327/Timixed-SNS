export type PublicUser = {
  id: string;
  handle: string;
  display_name: string;
  avatar_url: string | null;
};

export type DriftPublic = {
  id: string;
  author: PublicUser;
  body: string;
  resurface_count: number;
  resonance_count: number;
  is_resonated: boolean;
  is_mine: boolean;
};

export type DriftOwned = DriftPublic & {
  composed_at: string;
  is_surfaced: boolean;
};

export type TimelineResponse = {
  drifts: DriftPublic[];
  has_more: boolean;
};

export type CreateDriftRequest = {
  body: string;
};

export type CreateDriftResponse = {
  id: string;
  is_mine: true;
};

export type RegisterRequest = {
  email: string;
  handle: string;
  display_name: string;
  password: string;
};

export type LoginRequest = {
  login: string;
  password: string;
};

export type AuthResponse = {
  token: string;
  user: PublicUser;
};

export type SessionResponse = {
  user: PublicUser;
};

export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "DRIFT_NOT_FOUND"
  | "INVALID_CREDENTIALS"
  | "EMAIL_ALREADY_USED"
  | "HANDLE_ALREADY_USED"
  | "RATE_LIMIT_EXCEEDED"
  | "INTERNAL_ERROR";

export type ErrorResponse = {
  error: {
    code: ApiErrorCode | string;
    message: string;
  };
};
