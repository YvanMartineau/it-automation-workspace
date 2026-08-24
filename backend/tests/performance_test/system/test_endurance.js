import http from "k6/http";
import { check, sleep } from "k6";
import { BASE_URL, authHeaders, login } from "../common.js";

export const options = {
  scenarios: { endurance: {
    executor: "constant-vus", vus: Number(__ENV.VUS || 30),
    duration: __ENV.DURATION || "1h",
  }},
  thresholds: {http_req_failed: ["rate<0.01"], http_req_duration: ["p(95)<1000"]},
};

export function setup() { return {token: login()}; }

export default function (data) {
  const n = Math.floor(Math.random() * 3);
  let r;
  if (n === 0) {
    r = http.get(`${BASE_URL}/devices?page=1&page_size=50`,
      {headers: authHeaders(data.token), tags: {name: "GET /devices [endurance]"}});
  } else if (n === 1) {
    r = http.get(`${BASE_URL}/audit-logs/?limit=50&offset=${Math.floor(Math.random()*10000)}`,
      {headers: authHeaders(data.token), tags: {name: "GET /audit-logs/ [endurance]"}});
  } else {
    r = http.get(`${BASE_URL}/devices?page=1&page_size=25&status=online`,
      {headers: authHeaders(data.token), tags: {name: "GET /devices?status=online [endurance]"}});
  }
  check(r, {"request succeeds": x => x.status === 200});
  sleep(Number(__ENV.THINK_TIME || 1));
}
