import { type AxiosInstance, type AxiosRequestConfig } from "axios";
import { api } from "../../src/lib/api";
import { useAuthStore } from "../../src/hooks/useAuth";
import { beforeEach, describe, expect, test } from "vitest";

type Reply = [number, unknown?] | ((config: AxiosRequestConfig) => [number, unknown?]);

class LocalMockAdapter {
  private handlers: Array<{
    method: string;
    url: string;
    replies: Reply[];
  }> = [];

  constructor(private readonly client: AxiosInstance) {
    client.defaults.adapter = async (config) => {
      const handler = this.handlers.find(
        (candidate) =>
          candidate.method === config.method?.toLowerCase() &&
          candidate.url === config.url,
      );

      if (!handler || handler.replies.length === 0) {
        throw new Error(`No mock configured for ${config.method} ${config.url}`);
      }

      const reply = handler.replies.length > 1 ? handler.replies.shift()! : handler.replies[0];
      const [status, data] = typeof reply === "function" ? reply(config) : reply;

      return {
        config,
        data,
        headers: {},
        status,
        statusText: String(status),
      };
    };
  }

  reset() {
    this.handlers = [];
  }

  onGet(url: string) {
    return this.register("get", url);
  }

  onPost(url: string) {
    return this.register("post", url);
  }

  private register(method: string, url: string) {
    const handler = { method, url, replies: [] as Reply[] };
    this.handlers.push(handler);
    return {
      reply: (statusOrCallback: number | ((config: AxiosRequestConfig) => [number, unknown?]), data?: unknown) => {
        handler.replies.push(
          typeof statusOrCallback === "function"
            ? statusOrCallback
            : [statusOrCallback, data],
        );
      },
      replyOnce: (status: number, data?: unknown) => {
        handler.replies.push([status, data]);
      },
    };
  }
}

const mock = new LocalMockAdapter(api);

describe("API Integration – axios instance", () => {
  beforeEach(() => {
    mock.reset();
    useAuthStore.setState({
      user: {
        id: "test-user",
        email: "test@example.com",
        role: "user",
        accessToken: "test-token", // dummy value, no real secret
      },
      setAuth: (u) => useAuthStore.setState({ user: u }),
      logout: () => useAuthStore.setState({ user: null }),
    });
  });

  test("attaches Authorization header", async () => {
    mock.onGet("/api/devices/").reply((config: AxiosRequestConfig) => {
      expect(config.headers?.Authorization).toBe("Bearer test-token");
      return [200, { ok: true }];
    });

    await api.get("/devices/");
  });

  test("refreshes token on 401 and retries request", async () => {
    mock.onGet("/api/devices/").replyOnce(401);
    mock.onPost("/api/auth/refresh").reply(200, { access_token: "new-token" });
    mock.onGet("/api/devices/").reply(200, { ok: true });

    await api.get("/devices/");

    expect(useAuthStore.getState().user?.accessToken).toBe("new-token");
  });

  test("logout when refresh fails", async () => {
    mock.onGet("/api/devices/").replyOnce(401);
    mock.onPost("/api/auth/refresh").reply(400);

    await expect(api.get("/devices/")).rejects.toBeTruthy();
    expect(useAuthStore.getState().user).toBe(null);
  });
});