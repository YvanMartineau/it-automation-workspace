import http from "k6/http";
import { check } from "k6";
import { BASE_URL, authHeaders, login } from "../common.js";

export const options = {
  scenarios: { dashboard_users: {
    executor: "constant-vus", vus: Number(__ENV.VUS || 50),
    duration: __ENV.DURATION || "2m",
  }},
  thresholds: {
    http_req_duration: ["p(95)<500"],
    http_reqs: ["rate>=100"],
    http_req_failed: ["rate<0.01"],
  },
};

export function setup() { return {token: login()}; }

export default function (data) {
  const page = Math.floor(Math.random() * Number(__ENV.MAX_PAGE || 5)) + 1;
  const pageSize = Number(__ENV.PAGE_SIZE || 50);
  const p = new URLSearchParams({page: String(page), page_size: String(pageSize)});
  if (__ENV.STATUS) p.set("status", __ENV.STATUS);
  if (__ENV.SEARCH) p.set("search", __ENV.SEARCH);
  if (__ENV.OS) p.set("os", __ENV.OS);

  const r = http.get(`${BASE_URL}/devices?${p.toString()}`,
    {headers: authHeaders(data.token), tags: {name: "GET /devices"}});
  check(r, {
    "devices status 200": x => x.status === 200,
    "devices data present": x => x.json("data") !== undefined,
    "devices meta present": x => x.json("meta") !== undefined,
  });
}
