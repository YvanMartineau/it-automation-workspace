//backend/tests/performance_test/common.js
import http from "k6/http";
import { check, fail } from "k6";
import exec from "k6/execution";

export const BASE_URL = __ENV.BASE_URL || "http://localhost:8000";

export function jsonHeaders(token) {
  return {"Content-Type": "application/json", "Authorization": `Bearer ${token}`};
}
export function authHeaders(token) {
  return {"Authorization": `Bearer ${token}`};
}
export function login() {
  const email = __ENV.PERF_USER_EMAIL;
  const password = __ENV.PERF_USER_PASSWORD;
  if (!email || !password) fail("Set PERF_USER_EMAIL and PERF_USER_PASSWORD.");
  const r = http.post(`${BASE_URL}/auth/login`,
    JSON.stringify({email, password}),
    {headers: {"Content-Type": "application/json"}, tags: {name: "POST /auth/login"}});
  if (!check(r, {"login status 200": x => x.status === 200,
                 "access token returned": x => !!x.json("access_token")})) {
    fail(`Login failed: HTTP ${r.status} ${r.body}`);
  }
  return r.json("access_token");
}
export function uniqueEmail(prefix="perf") {
  return `${prefix}-${exec.vu.idInTest}-${exec.scenario.iterationInTest}-${Date.now()}@example.invalid`;
}
export function envJson(name, fallback) {
  if (!__ENV[name]) return fallback;
  try { return JSON.parse(__ENV[name]); }
  catch (e) { fail(`${name} must be valid JSON: ${e}`); }
}
// backend/tests/performance_test/common.js - add at bottom
export function toQueryString(obj) {
  return Object.entries(obj)
    .filter(([,v]) => v !== undefined && v !== null && v !== '')
    .map(([k,v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
}
