import { ServerWebSocket } from "bun";
import html from "./tracker.html";

let clients: ServerWebSocket<unknown>[] = [];
let statii: Map<string, string> = new Map();
let trackerN = 0;

function setStatus(name: string, status: string) {
  statii.set(name, status);
  clients.forEach((client) => {
    client.send(JSON.stringify({ newStatus: { name, status } }));
  });
}

const server = Bun.serve({
  routes: {
    "/": html,
  },
  fetch(request, server) {
    if (request.url.includes("/socket")) {
      if (server.upgrade(request)) {
        return;
      }
      return new Response("Upgrade failed", { status: 500 });
    }
    return new Response("Not found", { status: 404 });
  },
  websocket: {
    open(ws) {
      console.log("open");
      clients.push(ws);
      ws.send(JSON.stringify({ statii: Object.fromEntries(statii) }));
    },
    message(ws, message) {
      console.log("message", message);
    },
    close(ws) {
      console.log("close");
    },
  },
});

export class Tracker {
  readonly name: string;

  constructor(name: string) {
    this.name = name;
    setStatus(this.name, "running");
    trackerN++;
  }
  setStatus(name: string, status: string) {
    setStatus(this.name + ">" + name, status);
  }
  child(name: string) {
    return new Tracker(this.name + ">" + name);
  }

  run<R extends any>(name: string, promise: Promise<R>): Promise<R> {
    this.setStatus(name, "running");
    return promise
      .then((result) => {
        this.setStatus(name, "success");
        return result;
      })
      .catch((error) => {
        this.setStatus(name, "error");
        throw error;
      });
  }

  async runAll<T extends Record<string, Promise<any>>>(
    tasks: T
  ): Promise<{ [K in keyof T]: Awaited<T[K]> }> {
    for (const [key, promise] of Object.entries(tasks)) this.run(key, promise);
    const results = await Promise.all(Object.values(tasks));
    return Object.fromEntries(
      Object.entries(tasks).map(([key, task], index) => [key, results[index]])
    ) as { [K in keyof T]: Awaited<T[K]> };
  }

  async runArray<T>(tasks: Promise<T>[]): Promise<T[]> {
    return Object.values(
      await this.runAll(
        Object.fromEntries(tasks.map((task, index) => [index + "", task]))
      )
    );
  }
  [Symbol.dispose]() {
    setStatus(this.name, "done");
    trackerN--;
    if (trackerN === 0) server.stop();
  }
}

console.log(`Server running at ${server.url}`);

const interval = setInterval(() => {
  if (trackerN === 0) {
    server.stop();
    clearInterval(interval);
  }
}, 1000);
