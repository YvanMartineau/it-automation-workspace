import http from "k6/http";
import { check } from "k6";
import { BASE_URL, authHeaders, login } from "../common.js";

export const options = {
  scenarios: { traffic_spike: {
    executor: "ramping-vus", startVUs: 10,
    stages: [
      {duration: "1s", target: 100},
      {duration: "30s", target: 100},
      {duration: "30s", target: 10},
      {duration: "60s", target: 10},
    ],
    gracefulRampDown: "10s",
  }},
  thresholds: {http_req_failed: ["rate<0.01"]},
};

export function setup() { return {token: login()}; }

export default function (data) {
  const r = http.get(`${BASE_URL}/devices?page=1&page_size=50`,
    {headers: authHeaders(data.token), tags: {name: "GET /devices [spike]"}});
  check(r, {
    "spike request succeeds": x => x.status === 200,
    "spike has no 5xx": x => x.status < 500,
  });
}
