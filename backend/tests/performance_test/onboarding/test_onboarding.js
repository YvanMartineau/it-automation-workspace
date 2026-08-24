import http from "k6/http";
import { check } from "k6";
import { BASE_URL, jsonHeaders, login, uniqueEmail, envJson } from "../common.js";

export const options = {
  scenarios: { onboarding: {
    executor: "constant-vus", vus: Number(__ENV.VUS || 10),
    duration: __ENV.DURATION || "2m",
  }},
  thresholds: { http_req_duration: ["p(95)<10000"], http_req_failed: ["rate<0.01"] },
};

export function setup() { return {token: login()}; }

export default function (data) {
  const payload = envJson("ONBOARDING_PAYLOAD", {
    first_name: "Perf",
    last_name: `User-${Date.now()}`,
    email: uniqueEmail("onboard"),
    department: "IT",
    job_title: "Performance Test User",
  });
  const r = http.post(`${BASE_URL}/onboard`, JSON.stringify(payload),
    {headers: jsonHeaders(data.token), tags: {name: "POST /onboard"}});
  check(r, {
    "onboarding accepted": x => x.status === 202,
    "onboarding job_id returned": x => !!x.json("job_id"),
  });
}
