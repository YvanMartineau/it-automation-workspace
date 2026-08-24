import http from "k6/http";
import { check, sleep } from "k6";
import { BASE_URL, authHeaders, jsonHeaders, login, envJson } from "../common.js";

export const options = {
  scenarios: {
    scans: {executor: "constant-vus", vus: Number(__ENV.SCAN_VUS || 5),
      duration: __ENV.DURATION || "2m", exec: "scanWorkload"},
    reports: {executor: "constant-vus", vus: Number(__ENV.REPORT_VUS || 5),
      duration: __ENV.DURATION || "2m", exec: "reportWorkload"},
    reads: {executor: "constant-vus", vus: Number(__ENV.READ_VUS || 10),
      duration: __ENV.DURATION || "2m", exec: "readWorkload"},
  },
  thresholds: {http_req_failed: ["rate<0.01"], http_req_duration: ["p(95)<5000"]},
};

export function setup() { return {token: login()}; }

export function scanWorkload(data) {
  const subnet = __ENV.SCAN_SUBNET;
  if (!subnet) throw new Error("Set SCAN_SUBNET.");
  const r = http.post(`${BASE_URL}/scan`,
    JSON.stringify(envJson("SCAN_PAYLOAD", {subnet})),
    {headers: jsonHeaders(data.token), tags: {name: "POST /scan [cpu]"}});
  check(r, {"scan accepted": x => x.status === 202});
  sleep(1);
}

export function reportWorkload(data) {
  const payload = envJson("REPORT_PAYLOAD", {
    report_type: __ENV.REPORT_TYPE || "overview",
    start_date: __ENV.REPORT_START_DATE || "2026-01-01",
    end_date: __ENV.REPORT_END_DATE || "2026-12-31",
  });
  const r = http.post(`${BASE_URL}/reports/trigger`, JSON.stringify(payload),
    {headers: jsonHeaders(data.token), tags: {name: "POST /reports/trigger [cpu]"}});
  check(r, {"report accepted": x => x.status === 202,
            "report job_id returned": x => !!x.json("job_id")});
  sleep(1);
}

export function readWorkload(data) {
  const r = http.get(`${BASE_URL}/devices?page=1&page_size=50`,
    {headers: authHeaders(data.token), tags: {name: "GET /devices [cpu]"}});
  check(r, {"device read succeeds": x => x.status === 200});
  sleep(1);
}
