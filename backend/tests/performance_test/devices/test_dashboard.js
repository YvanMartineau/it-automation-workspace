// performance/devices/test_dashboard.js
import http from "k6/http";
import { check, sleep } from "k6";
import { BASE_URL, authHeaders, login } from "../common.js";

export const options = {
  scenarios: {
    dashboard_users: {
      executor: "constant-vus",
      vus: Number(__ENV.VUS || 50),
      duration: __ENV.DURATION || "2m",
    }
  },
  thresholds: {
    http_req_duration: ["p(95)<500"],
    http_reqs: ["rate>=100"], // with 50 VUs you need NO sleep or >100 VUs
    http_req_failed: ["rate<0.01"],
  },
};

export function setup() {
  return { token: login() };
}

function toQueryString(obj) {
  return Object.entries(obj)
   .filter(([, v]) => v!== undefined && v!== null && v!== '')
   .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
   .join('&');
}

export default function (data) {
  const page = Math.floor(Math.random() * Number(__ENV.MAX_PAGE || 5)) + 1;
  const pageSize = Number(__ENV.PAGE_SIZE || 50);

  const params = {
    page: String(page),
    page_size: String(pageSize),
  };
  if (__ENV.STATUS) params.status = __ENV.STATUS;
  if (__ENV.SEARCH) params.search = __ENV.SEARCH;
  if (__ENV.OS) params.os = __ENV.OS;

  const qs = toQueryString(params);

  const r = http.get(`${BASE_URL}/devices?${qs}`, {
    headers: authHeaders(data.token),
    tags: { name: "GET /devices" }
  });

  check(r, {
    "devices status 200": x => x.status === 200,
    "devices data present": x => x.json("data")!== undefined,
    "devices meta present": x => x.json("meta")!== undefined,
  });

  // small think time - if you keep rate>=100, keep this low or remove it
  // sleep(0.2);
}