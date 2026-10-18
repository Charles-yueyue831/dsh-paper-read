import { checkAbort, safeError } from "./config.js";

// No SDK value imports: Cordis services belong to the running host, as in dsh-git-vcs.
export function createHarnessModel(ctx, exec, config) {
  const session = exec.agent?.session;
  const pending =
    session &&
    ctx.get?.("sessionProjections")?.stateOf(session, "modelSelection")
      ?.pending;
  const current =
    pending ||
    session?.requestHeader?.()?.config ||
    ctx.get?.("agentDefaultModel")?.currentSelection();
  const provider = config.provider || current?.provider;
  const model = config.model || current?.model;
  if (!provider || !model)
    throw new Error(
      "无法取得当前会话模型，请在插件配置中同时设置 provider 和 model（使用 Harness 已注册的路由）。",
    );
  const calls = [];
  return {
    route: { provider, model },
    calls,
    async generate(system, input, signal, maxTokens = config.maxOutputTokens) {
      const deadline = AbortSignal.timeout(config.modelTimeoutMs);
      const combined = signal ? AbortSignal.any([signal, deadline]) : deadline;
      checkAbort(combined);
      const started = Date.now();
      let finish;
      let usage = null;
      let failure;
      try {
        const prepared = await ctx.llm.prepareCall(
          { provider, model, maxTokens },
          combined,
        );
        const options = {
          ...prepared.config,
          system,
          messages: [
            { role: "user", content: [{ type: "text", text: input }] },
          ],
          ...(exec.agent?.session?.id
            ? { sessionId: exec.agent.session.id }
            : {}),
          signal: combined,
        };
        const blocks = new Map();
        for await (const chunk of prepared.stream(options)) {
          checkAbort(combined);
          if (chunk.type === "text-delta") {
            const block = blocks.get(chunk.index);
            if (!block?.closed)
              blocks.set(chunk.index, {
                text: (block?.text || "") + chunk.text,
                closed: false,
              });
          } else if (
            chunk.type === "block-end" &&
            chunk.block.type === "text"
          ) {
            if (!blocks.get(chunk.index)?.closed)
              blocks.set(chunk.index, { text: chunk.block.text, closed: true });
          } else if (chunk.type === "finish") finish = chunk.reason;
          else if (chunk.type === "usage") usage = chunk.usage;
        }
        checkAbort(combined);
        if (finish?.kind !== "stop") {
          const error = new Error(
            `模型未完整完成：${finish?.kind || "missing finish"}；请检查输出预算或模型路由。`,
          );
          if (finish?.kind === "max-tokens")
            error.code = "MODEL_OUTPUT_TRUNCATED";
          throw error;
        }
        const output = [...blocks.entries()]
          .sort((a, b) => a[0] - b[0])
          .map(([, b]) => b.text)
          .join("\n");
        if (!output.trim()) throw new Error("模型未返回正文");
        return output;
      } catch (error) {
        failure = error;
        throw error;
      } finally {
        calls.push({
          provider,
          model,
          durationMs: Date.now() - started,
          maxTokens,
          finish: finish?.kind || "missing",
          usage,
          status: failure ? "failed" : "completed",
          ...(failure ? { error: safeError(failure) } : {}),
        });
      }
    },
  };
}
