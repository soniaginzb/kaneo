import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { useMyTasksLiveUpdates } from "./use-my-tasks-live-updates";

vi.mock("@/hooks/use-project-websocket", () => ({
  getWsUrl: (projectId: string) => `ws://test/${projectId}`,
}));

class FakeSocket {
  static instances: FakeSocket[] = [];
  onmessage: ((event: { data: string }) => void) | null = null;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  readyState = 0;
  closed = false;
  sent: string[] = [];
  constructor(public url: string) {
    FakeSocket.instances.push(this);
  }
  close() {
    this.closed = true;
  }
  // What the page sends to the server.
  send(message: string) {
    this.sent.push(message);
  }
  // What the server pushes to the page.
  receive(message: string) {
    this.onmessage?.({ data: message });
  }
}

function setup(projectIds: string[]) {
  const client = new QueryClient();
  const invalidate = vi.spyOn(client, "invalidateQueries");
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const hook = renderHook(() => useMyTasksLiveUpdates("ws-1", projectIds), {
    wrapper,
  });
  return { client, invalidate, ...hook };
}

beforeEach(() => {
  FakeSocket.instances = [];
  vi.stubGlobal("WebSocket", FakeSocket);
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("useMyTasksLiveUpdates", () => {
  it("listens to every project and refreshes once per burst of task events", () => {
    const { invalidate, unmount } = setup(["p1", "p2"]);
    expect(FakeSocket.instances.map((socket) => socket.url)).toEqual([
      "ws://test/p1",
      "ws://test/p2",
    ]);

    FakeSocket.instances[0]?.receive(JSON.stringify({ type: "TASK_UPDATED" }));
    FakeSocket.instances[1]?.receive(JSON.stringify({ type: "TASK_CREATED" }));
    vi.advanceTimersByTime(300);

    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["my-tasks", "ws-1"],
    });

    unmount();
    expect(FakeSocket.instances.every((socket) => socket.closed)).toBe(true);
  });

  it("ignores pongs and frames that are not JSON", () => {
    const { invalidate } = setup(["p1"]);
    FakeSocket.instances[0]?.receive(JSON.stringify({ type: "pong" }));
    FakeSocket.instances[0]?.receive("hello");
    vi.advanceTimersByTime(300);
    expect(invalidate).not.toHaveBeenCalled();
  });

  it("reconnects a dropped socket and refreshes once it is back", () => {
    const { invalidate, unmount } = setup(["p1"]);
    const first = FakeSocket.instances[0];
    first?.onclose?.();
    expect(FakeSocket.instances).toHaveLength(1);

    vi.advanceTimersByTime(1000);
    expect(FakeSocket.instances).toHaveLength(2);
    expect(FakeSocket.instances[1]?.url).toBe("ws://test/p1");

    FakeSocket.instances[1]?.onopen?.();
    vi.advanceTimersByTime(300);
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["my-tasks", "ws-1"],
    });

    unmount();
    FakeSocket.instances[1]?.onclose?.();
    vi.advanceTimersByTime(60_000);
    expect(FakeSocket.instances).toHaveLength(2);
  });

  it("sends a keepalive ping every 30 seconds", () => {
    setup(["p1"]);
    const socket = FakeSocket.instances[0];
    if (socket) socket.readyState = 1;
    vi.advanceTimersByTime(30_000);
    expect(socket?.sent).toEqual(['{"type":"ping"}']);
  });

  it("refreshes after any successful change made in this tab", async () => {
    const { client, invalidate } = setup([]);
    await client
      .getMutationCache()
      .build(client, { mutationFn: async () => "saved" })
      .execute(undefined);
    await vi.advanceTimersByTimeAsync(300);
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["my-tasks", "ws-1"],
    });
  });
});
