// frontend/src/lib/jwt.ts
interface AccessTokenClaims {
  sub: string;
  role: "admin" | "viewer";
  exp: number;
}

export function decodeAccessToken(token: string): AccessTokenClaims {
  const payload = token.split(".")[1];
  if (!payload) {
    throw new Error("Malformed JWT: missing payload segment");
  }
  const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
  return JSON.parse(json) as AccessTokenClaims;
}