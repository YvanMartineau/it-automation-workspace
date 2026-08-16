// frontend/src/types/scan.ts
import { z } from "zod";

/**
 * Hand-written mirror of backend/schemas/scan.py — not derived from
 * src/types/api.ts, because sse-starlette streams bypass FastAPI's
 * response_model validation, so ScanProgressData/ScanCompleteData/
 * ScanErrorData never appear in /openapi.json for openapi-typescript to
 * generate from. ScanRequest/ScanStartResponse are the exception (real
 * request/response models) but are mirrored here too for consistency —
 * swap to the generated api.ts types for those two once codegen is run.
 */

export const scanRequestSchema = z.object({
  subnet: z
    .string()
    .trim()
    .min(1, "Subnetz ist erforderlich")
    .regex(/^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/, "Ungültiges CIDR-Format (z. B. 192.168.1.0/24)"),
  // NOTE: format check only. The real validation — RFC 1918 containment
  // via subnet_of() against the three private supernets, plus the /22
  // max-size cap — lives in ScanRequest.validate_private_subnet on the
  // backend. Duplicating that bit-math here isn't worth the drift risk;
  // an out-of-range subnet still round-trips and surfaces as a 422. This
  // regex exists only to catch typos before spending a request.
});
export type ScanRequestInput = z.infer<typeof scanRequestSchema>;

export const scanStartResponseSchema = z.object({
  job_id: z.string().uuid(),
  status: z.string(),
});
export type ScanStartResponse = z.infer<typeof scanStartResponseSchema>;

export const scanProgressDataSchema = z.object({
  // NOTE: despite the name, this is currently the subnet's total host
  // count on every tick (see services/scanner.py's push_progress), NOT a
  // running "assets found" tally. Do not read this as a live discovery
  // count — see useScanStream.ts.
  hosts_found: z.number(),
  hosts_scanned: z.number(),
  current_host: z.string().nullable(),
});
export type ScanProgressData = z.infer<typeof scanProgressDataSchema>;

export const scanCompleteDataSchema = z.object({
  total_hosts: z.number(),
  online: z.number(),
  offline: z.number(),
});
export type ScanCompleteData = z.infer<typeof scanCompleteDataSchema>;

export const scanErrorDataSchema = z.object({
  message: z.string(),
});
export type ScanErrorData = z.infer<typeof scanErrorDataSchema>;