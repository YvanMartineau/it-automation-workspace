import http from "k6/http";
import { check } from "k6";
import { BASE_URL, authHeaders, login, toQueryString } from "../common.js";

export const options = {
  scenarios: { audit_queries: {
    executor: "constant-vus", vus: Number(__ENV.VUS || 10),
    duration: __ENV.DURATION || "2m",
  }},
  thresholds: { http_req_duration: ["p(95)<1000"], http_req_failed: ["rate<0.01"] },
};

export function setup() { return {token: login()}; }

export default function (data) {
  const limit = Math.min(Number(__ENV.LIMIT || 100), 500);
  const offset = Math.floor(Math.random() * Number(__ENV.MAX_OFFSET || 10000));

  const params = {
    limit: String(limit),
    offset: String(offset),
  };
  if (__ENV.ACTOR) params.actor = __ENV.ACTOR;
  if (__ENV.ACTION) params.action = __ENV.ACTION;
  if (__ENV.TARGET_TYPE) params.target_type = __ENV.TARGET_TYPE;
  if (__ENV.DATE_FROM) params.date_from = __ENV.DATE_FROM;
  if (__ENV.DATE_TO) params.date_to = __ENV.DATE_TO;

  const r = http.get(`${BASE_URL}/audit-logs/?${toQueryString(params)}`,
    {headers: authHeaders(data.token), tags: {name: "GET /audit-logs/"}});

  check(r, {
    "audit status 200": x => x.status === 200,
    "audit returns array": x => Array.isArray(x.json()),
  });
}