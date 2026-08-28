/**
 * @vitest-environment node
 */
import axios, {
  type AxiosInstance,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
  type AxiosError,
} from "axios";
import { api } from "../../src/lib/api";
import { useAuthStore } from "../../src/hooks/useAuth";
import { beforeEach, describe, expect, test, vi } from "vitest";

type ReplyTuple = [number, unknown];
type ReplyFn = (config: InternalAxiosRequestConfig) => ReplyTuple;
type Reply = ReplyTuple | ReplyFn;

class LocalMockAdapter {
  private handlers: Array<{ method: string; url: string; replies: Reply[] }> = [];

  private normalize(url?: string): string {
    if (!url) return "";
    try {
      const u = new URL(url, "http://localhost");
      const p = u.pathname.replace(/^\/api/, "");
      return p.startsWith("/")? p : `/${p}`;
    } catch {
      const p = url.split("?")[0].replace(/^\/api/, "");
      return p.startsWith("/")? p : `/${p}`;
    }
  }

  constructor(private readonly client: AxiosInstance) {
    const adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
      const reqUrl = this.normalize(config.url);
      const handler =
        this.handlers.find(
          (h) => h.method === config.method?.toLowerCase() && this.normalize(h.url) === reqUrl && h.replies.length > 0
        )??
        this.handlers.find((h) => h.method === config.method?.toLowerCase() && this.normalize(h.url) === reqUrl);

      if (!handler || handler.replies.length === 0) {
        throw new Error(`No mock for ${config.method} ${config.url} -> ${reqUrl}`);
      }

      const raw = handler.replies.length > 1? handler.replies.shift()! : handler.replies[0];
      const [status, data] = typeof raw === "function"? (raw as ReplyFn)(config) : (raw as ReplyTuple);

      const response = {
        config,
        data,
        headers: {},
        status,
        statusText: String(status),
        request: {},
      } as AxiosResponse;

      if (status >= 200 && status < 300) return response;

      const err = Object.assign(new Error(`Request failed with status code ${status}`), {
        config,
        response,
        isAxiosError: true,
      }) as AxiosError;

      throw err;
    };

    (client.defaults as unknown as { adapter: typeof adapter }).adapter = adapter;
    (axios.defaults as unknown as { adapter: typeof adapter }).adapter = adapter;
  }

  reset(): void {
    this.handlers = [];
  }

  onGet(url: string) {
    return this.register("get", url);
  }

  onPost(url: string) {
    return this.register("post", url);
  }

  private register(method: string, url: string) {
    const norm = this.normalize(url);
    let handler = this.handlers.find((h) => h.method === method && this.normalize(h.url) === norm);
    if (!handler) {
      handler = { method, url, replies: [] };
      this.handlers.push(handler);
    }
    return {
      reply: (s: number | ReplyFn, d?: unknown) => {
        const tuple: Reply = typeof s === "function"? s : [s, d];
        handler!.replies.push(tuple);
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
      user: {
        id: "test-user",
        email: "test@example.com",
        role: "user",
        accessToken: "test-token",
      } as unknown as ReturnType<typeof useAuthStore.getState>["user"],
      setAuth: (u: unknown) =>
        useAuthStore.setState({
          user: u as ReturnType<typeof useAuthStore.getState>["user"],
        }),
      logout: () => useAuthStore.setState({ user: null } as unknown as { user: null }),
    } as unknown as Parameters<typeof useAuthStore.setState>[0]);
  });

  test("attaches Authorization header", async () => {
    mock.onGet("/devices/").reply((config) => {
      expect(config.headers?.Authorization).toBe("Bearer test-token");
      return [200, { ok: true }];
    });
    await api.get("/devices/");
  });

  test("refreshes token on 401 and retries request", async () => {
    mock.onGet("/devices/").replyOnce(401, {});
    mock.onPost("/auth/refresh").replyOnce(200, { access_token: "new-token", accessToken: "new-token" });
    mock.onPost("/api/auth/refresh").replyOnce(200, { access_token: "new-token", accessToken: "new-token" });
    mock.onGet("/devices/").replyOnce(200, { ok: true });

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