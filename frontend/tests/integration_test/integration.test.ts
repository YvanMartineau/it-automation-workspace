/**
 * @vitest-environment node
 */
import axios from "axios";
import { type AxiosInstance, type AxiosRequestConfig } from "axios";
import { api } from "../../src/lib/api";
import { useAuthStore } from "../../src/hooks/useAuth";
import { beforeEach, describe, expect, test, vi } from "vitest";

type Reply = [number, unknown?] | ((config: AxiosRequestConfig) => [number, unknown?]);

class LocalMockAdapter {
  private handlers: Array<{ method: string; url: string; replies: Reply[] }> = [];
  private normalize(url?: string) {
    if (!url) return "";
    try {
      const u = new URL(url, "http://localhost");
      let p = u.pathname.replace(/^\/api/, "");
      return p.startsWith("/") ? p : `/${p}`;
    } catch {
      let p = url.split("?")[0].replace(/^\/api/, "");
      return p.startsWith("/") ? p : `/${p}`;
    }
  }
  constructor(private readonly client: AxiosInstance) {
    const adapter = async (config: any) => {
      const reqUrl = this.normalize(config.url);
      const handler = this.handlers.find(
        (h) => h.method === config.method?.toLowerCase() && this.normalize(h.url) === reqUrl && h.replies.length > 0
      ) ?? this.handlers.find((h) => h.method === config.method?.toLowerCase() && this.normalize(h.url) === reqUrl);

      if (!handler || handler.replies.length === 0) {
        throw new Error(`No mock for ${config.method} ${config.url} -> ${reqUrl}`);
      }
      const reply = handler.replies.length > 1 ? handler.replies.shift()! : handler.replies[0];
      const [status, data] = typeof reply === "function" ? reply(config) : reply;
      const response = { config, data, headers: {}, status, statusText: String(status), request: {} };
      if (status >= 200 && status < 300) return response as any;
      const err: any = new Error(`Request failed with status code ${status}`);
      err.config = config; err.response = response; err.isAxiosError = true; err.toJSON = () => ({});
      throw err;
    };
    // mock BOTH instances - api and global axios (which your refresh client might use)
    (client as any).defaults.adapter = adapter;
    (axios as any).defaults.adapter = adapter;
  }
  reset() { this.handlers = []; }
  onGet(url: string) { return this.register("get", url); }
  onPost(url: string) { return this.register("post", url); }
  private register(method: string, url: string) {
    const norm = this.normalize(url);
    let handler = this.handlers.find((h) => h.method === method && this.normalize(h.url) === norm);
    if (!handler) {
      handler = { method, url, replies: [] };
      this.handlers.push(handler);
    }
    return {
      reply: (s: number | ((c: AxiosRequestConfig) => [number, unknown?]), d?: unknown) => {
        handler!.replies.push(typeof s === "function" ? s : ([s, d] as any));
      },
      replyOnce: (s: number, d?: unknown) => {
        handler!.replies.push([s, d]);
      },
    };
  }
}

const mock = new LocalMockAdapter(api);

describe("API Integration – axios instance", () => {
  beforeEach(() => {
    mock.reset();
    vi.restoreAllMocks();
    useAuthStore.setState({
      user: { id: "test-user", email: "test@example.com", role: "user", accessToken: "test-token" } as any,
      setAuth: (u: any) => useAuthStore.setState({ user: u }),
      logout: () => useAuthStore.setState({ user: null }),
    } as any);
  });

  test("attaches Authorization header", async () => {
    mock.onGet("/devices/").reply((config) => {
      expect(config.headers?.Authorization).toBe("Bearer test-token");
      return [200, { ok: true }];
    });
    await api.get("/devices/");
  });

  test("refreshes token on 401 and retries request", async () => {
    // 1st GET -> 401, 2nd GET after refresh -> 200
    mock.onGet("/devices/").replyOnce(401, {});
    mock.onGet("/devices/").replyOnce(200, { ok: true });
    // mock refresh for BOTH possible instances
    mock.onPost("/auth/refresh").replyOnce(200, { access_token: "new-token", accessToken: "new-token" });
    mock.onPost("/api/auth/refresh").replyOnce(200, { access_token: "new-token", accessToken: "new-token" });

    await api.get("/devices/");

    expect(useAuthStore.getState().user?.accessToken).toBe("new-token");
  });

  test("logout when refresh fails", async () => {
    mock.onGet("/devices/").replyOnce(401, {});
    mock.onPost("/auth/refresh").replyOnce(400, {});
    mock.onPost("/api/auth/refresh").replyOnce(400, {});
    await expect(api.get("/devices/")).rejects.toBeTruthy();
    expect(useAuthStore.getState().user).toBe(null);
  });
});