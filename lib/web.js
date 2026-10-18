import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { safeError } from "./config.js";

const base = "/api/paper-insight";
const json = (res, status, value) => {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  res.end(JSON.stringify(value));
};
export function guardRequest(req) {
  const host = req.headers.host || "";
  if (!/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host))
    throw new Error("工作台 API 仅支持本机 Harness");
  if (
    req.headers.origin &&
    ![`http://${host}`, `https://${host}`].includes(req.headers.origin)
  )
    throw new Error("拒绝跨站请求");
  if (req.headers["sec-fetch-site"] === "cross-site")
    throw new Error("拒绝跨站请求");
  if (
    req.method === "POST" &&
    req.headers["content-type"]?.split(";")[0] !== "application/json"
  )
    throw new Error("需要 application/json");
}
async function body(req) {
  let text = "";
  for await (const chunk of req) {
    text += chunk;
    if (Buffer.byteLength(text) > 64000) throw new Error("请求过大");
  }
  return JSON.parse(text);
}

/** Optional web services: headless hosts load the research tools without any UI dependencies. */
export function installWeb(ctx, service, tools, lifetime) {
  if (typeof ctx.inject !== "function") return;
  ctx.inject(["webServer", "agents"], (web) => {
    const jobs = new Map();
    const definitions = new Map(tools.map((t) => [t.name, t]));
    const writableOps = new Set([
      "analyze",
      "resume",
      "fetch",
      "batch",
      "compare_papers",
      "discover_updates",
      "subscriptions",
      ...[
        "analyze_principles",
        "trace_research",
        "analyze_sandbox",
        "generate_capabilities",
        "ideate_products",
        "optimize_experience",
        "analyze_transfer",
        "explain_for_beginners",
        "generate_poc",
      ],
    ]);
    const handler = async (req, res) => {
      try {
        guardRequest(req);
        const url = new URL(req.url, `http://${req.headers.host}`);
        if (
          req.method === "GET" &&
          url.pathname === base + "/assets/diagram.js"
        ) {
          const bytes = await readFile(
            new URL("../dist/diagram.js", import.meta.url),
          );
          res.writeHead(200, {
            "content-type": "text/javascript; charset=utf-8",
            "cache-control": "private, max-age=3600",
            "x-content-type-options": "nosniff",
          });
          return res.end(bytes);
        }
        if (req.method === "GET" && url.pathname === base + "/sessions")
          return json(res, 200, {
            sessions: web.agents.roots().map((a) => ({
              id: a.id,
              title: a.session.requestHeader()?.meta?.title || a.id,
              workspace: service.archive({ agent: a }).root,
            })),
            modules: tools.map((t) => ({
              name: t.name,
              description: t.description,
              parameters: t.parameters,
            })),
          });
        if (req.method === "GET" && url.pathname === base + "/jobs") {
          const job = jobs.get(url.searchParams.get("id"));
          if (!job)
            return json(res, 404, {
              error: "任务不存在；可从本地历史检查点恢复",
            });
          return json(res, 200, {
            id: job.id,
            status: job.status,
            progress: job.progress,
            result: job.result,
            error: job.error,
          });
        }
        if (req.method !== "POST")
          return json(res, 405, { error: "Method not allowed" });
        const input = await body(req);
        if (url.pathname === base + "/cancel") {
          const job = jobs.get(input.id);
          if (!job) return json(res, 404, { error: "任务不存在" });
          job.controller.abort();
          return json(res, 200, { status: "cancelling" });
        }
        if (url.pathname !== base + "/run")
          return json(res, 404, { error: "Unknown route" });
        const tool = definitions.get(input.tool);
        if (!tool) return json(res, 400, { error: "未知研究工具" });
        const agent = web.agents.get(input.sessionId);
        if (!agent)
          return json(res, 400, {
            error:
              "请先打开一个已配置模型和工作区的 Harness 会话，再刷新会话列表",
          });
        if (
          [...jobs.values()].filter((j) => j.status === "running").length >=
          service.config.concurrency
        )
          return json(res, 409, {
            error: "已有研究任务正在运行，请等待或取消",
          });
        if (writableOps.has(input.tool.replace("paper_insight_", "")))
          service.archive({ agent }, true);
        const id = randomUUID();
        const controller = new AbortController();
        const job = {
          id,
          status: "running",
          controller,
          progress: { stage: "starting" },
        };
        jobs.set(id, job);
        // Limit completed in-memory receipts; durable results remain in the workspace.
        if (jobs.size > 100)
          for (const [key, value] of jobs) {
            if (value.status !== "running") {
              jobs.delete(key);
              break;
            }
          }
        void Promise.resolve()
          .then(() =>
            tool.execute(input.args || {}, {
              agent,
              signal: AbortSignal.any([controller.signal, lifetime]),
              onProgress: (p) => {
                job.progress = p;
              },
            }),
          )
          .then(
            (result) => {
              job.result = result;
              job.status = "completed";
            },
            (error) => {
              job.status =
                controller.signal.aborted || lifetime.aborted
                  ? "cancelled"
                  : "failed";
              job.error = {
                message: safeError(error),
                code: error.code || "TOOL_FAILED",
                key: error.key,
                runId: error.runId,
              };
            },
          );
        return json(res, 202, { id, status: "running" });
      } catch (e) {
        return json(res, 400, { error: safeError(e) });
      }
    };
    web.effect(() =>
      web.webServer.register({ kind: "prefix", path: base, handler }),
    );
  });
}
