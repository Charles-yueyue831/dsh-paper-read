import { createHash } from "node:crypto";
import { analyzeDocument, renderReport, renderBibtex } from "./analysis.js";
import { paperKey } from "./papers.js";
import { MODULE_IDS } from "./modules.js";
import { checkAbort, isoNow, safeError } from "./config.js";

/** Citation edges come only from retrieved indexes, never a model's guessed lineage. */
export function researchArtifacts(paper, related) {
  const rows = [
    ...related.references,
    ...related.citations,
    ...related.discovery,
  ];
  const label = (s) =>
    String(s)
      .replace(/["<>\[\]{}\\\n]/g, " ")
      .slice(0, 100);
  const graph = ["flowchart LR", `  T["${label(paper.title)}"]`];
  for (const p of rows) {
    graph.push(`  ${p.evidenceId}["${label(p.title)}"]`);
    if (p.relation === "cited-by-target")
      graph.push(`  T -->|cites| ${p.evidenceId}`);
    else if (p.relation === "cites-target")
      graph.push(`  ${p.evidenceId} -->|cites| T`);
    else graph.push(`  T -.->|topic similarity only| ${p.evidenceId}`);
  }
  return {
    timeline: [{ ...paper, evidenceId: "T", relation: "target" }, ...rows]
      .sort((a, b) => (a.year || 9999) - (b.year || 9999))
      .map((p) => ({
        id: p.evidenceId,
        title: p.title,
        year: p.year,
        url: p.url,
        doi: p.doi,
        arxivId: p.arxivId,
        relation: p.relation,
        verification:
          p.doi ||
          p.arxivId ||
          p.sources?.some((s) => ["semantic-scholar", "openalex"].includes(s))
            ? "indexed metadata"
            : "待核实",
      })),
    mermaid: graph.join("\n") + "\n",
  };
}

/** Every continuation writes a new version; previously successful work is reused by hash. */
export async function runWorkflow(service, args, exec) {
  const archive = service.archive(exec, true);
  const model = service.makeModel(service.ctx, exec, service.config);
  let previous;
  if (args.key && args.runId)
    previous = await archive.load(args.key, args.runId, "checkpoint.json");
  const modules = args.modules || previous?.modules || MODULE_IDS;
  const run = await archive.start(
    previous?.document?.paper || {
      title: args.reference || args.file || "Pending paper",
      authors: [],
    },
    previous?.key ||
      createHash("sha256")
        .update(args.reference || args.file || "")
        .digest("hex")
        .slice(0, 20),
    exec.signal,
  );
  let cp = {
    schemaVersion: 2,
    promptVersion: "0.2.0",
    modules,
    key: run.key,
    input: previous?.input || { reference: args.reference, file: args.file },
    document: previous?.document,
    related: previous?.related,
    evidence: previous?.evidence || [],
    sections:
      args.resume &&
      !args.refreshResearch &&
      previous?.promptVersion === "0.2.0"
        ? previous.sections || []
        : [],
    parentRunId: args.runId || null,
    events: [],
    priorCalls: previous
      ? [...(previous.priorCalls || []), ...(previous.calls || [])]
      : [],
  };
  const persist = async () => {
    cp.calls = model.calls;
    await archive.write(run, "checkpoint.json", cp);
    await archive.write(run, "events.json", cp.events);
  };
  const stage = async (name, fn) => {
    checkAbort(exec.signal);
    const event = { stage: name, status: "running", startedAt: isoNow() };
    cp.events.push(event);
    await persist();
    exec.onProgress?.({
      key: run.key,
      runId: run.runId,
      stage: name,
      status: "running",
    });
    const started = Date.now();
    try {
      const value = await fn();
      event.status = "completed";
      return value;
    } catch (e) {
      event.status = exec.signal?.aborted ? "cancelled" : "failed";
      event.error = safeError(e);
      throw e;
    } finally {
      event.durationMs = Date.now() - started;
      event.finishedAt = isoNow();
      await persist();
    }
  };
  try {
    if (!cp.document)
      await stage("fetch", async () => {
        cp.document = await service.read(cp.input, exec);
      });
    // The stable canonical identity is known after resolution; keep run paths immutable.
    cp.canonicalKey = paperKey(cp.document.paper);
    run.paper = cp.document.paper;
    await archive.write(run, "document.json", cp.document, exec.signal);
    await archive.write(run, "metadata.json", cp.document.paper, exec.signal);
    await archive.write(
      run,
      "source.txt",
      cp.document.segments.map((s) => `[${s.locator}]\n${s.text}`).join("\n\n"),
      exec.signal,
    );
    if (!cp.related || args.refreshResearch)
      await stage("research", async () => {
        cp.related = await service.sources.related(
          cp.document.paper,
          exec.signal,
        );
      });
    await archive.write(run, "references.json", cp.related, exec.signal);
    const report = await stage("analysis", () =>
      analyzeDocument(
        cp.document,
        cp.related,
        model,
        service.config,
        exec.signal,
        async (evidence) => {
          cp.evidence = evidence;
          await archive.write(run, "evidence.json", evidence);
          await persist();
          exec.onProgress?.({
            stage: "evidence",
            completed: evidence.length,
            total: cp.document.chunks.length,
          });
        },
        {
          modules,
          evidence: cp.evidence,
          sections: cp.sections,
          onSections: async (sections) => {
            cp.sections = sections;
            await persist();
            exec.onProgress?.({
              stage: "sections",
              completed: sections.length,
              total: modules.length,
            });
          },
        },
      ),
    );
    report.parentRunId = cp.parentRunId;
    report.priorCalls = cp.priorCalls;
    const artifacts = researchArtifacts(cp.document.paper, cp.related);
    report.timeline = artifacts.timeline;
    report.relationGraph = artifacts.mermaid;
    let reportPath;
    await stage("export", async () => {
      await archive.write(run, "evidence.json", report.evidence, exec.signal);
      await archive.write(run, "report.json", report, exec.signal);
      reportPath = await archive.write(
        run,
        "report.md",
        renderReport(report) +
          "\n## 研究时间线与引用关系\n\n" +
          artifacts.timeline
            .map(
              (p) =>
                `- ${p.year || "年份未知"}：${p.title} [${p.id}] (${p.verification})`,
            )
            .join("\n") +
          "\n\n```mermaid\n" +
          artifacts.mermaid +
          "```\n",
        exec.signal,
      );
      await archive.write(
        run,
        "timeline.json",
        artifacts.timeline,
        exec.signal,
      );
      await archive.write(run, "relations.mmd", artifacts.mermaid, exec.signal);
      for (const [file, ids] of [
        ["product-ideas.md", ["features", "products", "experience"]],
        ["poc.md", ["decision"]],
      ]) {
        const chosen = report.sections.filter((s) => ids.includes(s.id));
        await archive.write(
          run,
          file,
          chosen.length
            ? renderReport({ ...report, sections: chosen })
            : "# 本次未选择该模块\n",
          exec.signal,
        );
      }
      await archive.write(
        run,
        "references.bib",
        renderBibtex([
          cp.document.paper,
          ...cp.related.references,
          ...cp.related.citations,
          ...cp.related.discovery,
        ]),
        exec.signal,
      );
    });
    await archive.finish(run, "completed", {
      canonicalKey: cp.canonicalKey,
      parentRunId: cp.parentRunId,
      modules,
      coverage: cp.document.coverage,
      model: model.route,
      calls: model.calls,
      reportPath,
    });
    return {
      status: "completed",
      key: run.key,
      canonicalKey: cp.canonicalKey,
      runId: run.runId,
      parentRunId: cp.parentRunId,
      title: run.paper.title,
      folder: run.folder,
      reportPath,
      modules,
      coverage: report.coverage,
      sections: report.sections.map((s) => ({ id: s.id, summary: s.summary })),
      modelCalls: model.calls.length,
      warnings: report.warnings,
      sourceErrors: cp.related.errors,
    };
  } catch (error) {
    await archive.finish(run, exec.signal?.aborted ? "cancelled" : "failed", {
      error: safeError(error),
      parentRunId: cp.parentRunId,
      modules,
      calls: model.calls,
    });
    const failure = new Error(
      `${safeError(error)}；已提取材料及检查点 key=${run.key} runId=${run.runId}；可用 paper_insight_resume 续跑`,
      { cause: error },
    );
    failure.code = exec.signal?.aborted ? "CANCELLED" : "WORKFLOW_FAILED";
    failure.key = run.key;
    failure.runId = run.runId;
    throw failure;
  }
}
