// frontend/src/lib/jwt.ts

/**
 * NOTE: role is typed as a closed union based on what get_admin_user()
 * in jwt_handler.py checks for ("admin" vs. everything else). Your
 * original spec lists three user types — IT admins, IT support staff,
 * read-only managers — but I only have visibility into the admin/
 * non-admin split the backend actually enforces. If "support" or
 * "viewer"/"manager" are distinct role STRINGS stored in the DB (not
 * just admin vs. not-admin), this union needs a third member or it'll
 * be a type-checking lie the moment one of those users logs in. Flagging
 * rather than guessing — send models/user.py's role enum if so.
 */
interface AccessTokenClaims {
  sub: string;
  role: "admin" | "viewer";
  email: string;
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