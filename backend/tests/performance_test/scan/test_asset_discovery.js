import http from "k6/http";
import { check } from "k6";
import { Rate } from "k6/metrics";
import { BASE_URL, jsonHeaders, login, envJson } from "../common.js";

const scanErrors = new Rate("scan_job_errors");

export const options = {
  scenarios: {
    asset_discovery: {
      executor: "shared-iterations",
      vus: Number(__ENV.VUS || 20),
      iterations: Number(__ENV.ITERATIONS || 20),
      maxDuration: __ENV.MAX_DURATION || "10m",
    },
  },
  thresholds: {
    http_req_duration: ["p(95)<5000"],
    http_req_failed: ["rate<0.01"],
    scan_job_errors: ["rate<0.01"],
  },
};

export function setup() { return {token: login()}; }

export default function (data) {
  const subnet = __ENV.SCAN_SUBNET;
  if (!subnet) throw new Error("Set SCAN_SUBNET to a controlled RFC1918 test subnet.");
  const payload = envJson("SCAN_PAYLOAD", {subnet});
  const r = http.post(`${BASE_URL}/scan`, JSON.stringify(payload),
    {headers: jsonHeaders(data.token), tags: {name: "POST /scan"}});
  const ok = check(r, {
    "scan accepted": x => x.status === 202,
    "scan job_id returned": x => !!x.json("job_id"),
  });
  scanErrors.add(ok ? 0 : 1);
}
