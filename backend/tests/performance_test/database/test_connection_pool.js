import http from "k6/http";
import { check } from "k6";
import { Rate } from "k6/metrics";
import { BASE_URL, authHeaders, login } from "../common.js";

const dbErrors = new Rate("db_connection_errors");

export const options = {
  scenarios: { pool_stress: {
    executor: "constant-vus", vus: Number(__ENV.VUS || 30),
    duration: __ENV.DURATION || "2m",
  }},
  thresholds: { http_req_failed: ["rate<0.01"], db_connection_errors: ["rate<0.01"] },
};

export function setup() { return {token: login()}; }

export default function (data) {
  const r = http.get(`${BASE_URL}/devices?page=1&page_size=50`,
    {headers: authHeaders(data.token), tags: {name: "GET /devices [pool]"}});
  const ok = check(r, {
    "pool request succeeds": x => x.status === 200,
    "no DB service error": x => x.status !== 500 && x.status !== 503,
  });
  dbErrors.add(ok ? 0 : 1);
}
