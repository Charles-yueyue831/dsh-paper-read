import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { PaperInsight } from "../lib/service.js";
import { parseConfig } from "../lib/config.js";
import { createTools } from "../index.js";
import { guardRequest } from "../lib/web.js";
import {
  paper,
  passage,
  research,
  modelResponse,
  fakeModel,
} from "./fixtures.js";
import { researchArtifacts } from "../lib/workflow.js";
import { MODULE_FIELDS } from "../lib/modules.js";

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "paper-v2-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const config = parseConfig({ maxChunks: 2 });
  let reads = 0,
    related = 0;
  const doc = {
    paper,
    coverage: "extracted-text",
    warnings: [],
    chunks: [1, 2].map((n) => ({
      id: `P${n}`,
      locator: `page ${n}`,
      text: passage,
    })),
    segments: [{ locator: "test", text: passage }],
    totalChunks: 2,
    selectedChunks: 2,
  };
  const service = new PaperInsight(
    {
      sandboxPolicy: {
        resolve: () => ({ mode: "workspace-write", workspaceRoot: root }),
      },
    },
    config,
    {
      sources: {
        resolve: async () => paper,
        related: async () => {
          related++;
          return research;
        },
      },
      reader: {
        read: async () => {
          reads++;
          return doc;
        },
      },
      makeModel: () => fakeModel(),
    },
  );
  return {
    root,
    service,
    exec: { signal: new AbortController().signal },
    counts: () => ({ reads, related }),
  };
}
test("resume preserves successful evidence and sections, and writes a separate immutable version", async (t) => {
  const { service, exec, counts } = await fixture(t);
  let n = 0;
  service.makeModel = () => ({
    route: { provider: "fixture", model: "fixture" },
    calls: [],
    generate: async (_, input) => {
      n++;
      if (n === 4) throw new Error("provider offline");
      return modelResponse(input);
    },
  });
  let error;
  try {
    await service.analyze({ reference: paper.id }, exec);
  } catch (e) {
    error = e;
  }
  assert.equal(error.code, "WORKFLOW_FAILED");
  const archive = service.archive(exec);
  const cp = await archive.load(error.key, error.runId, "checkpoint.json");
  assert.equal(cp.evidence.length, 2);
  assert.equal(cp.sections.length, 2);
  service.makeModel = () => fakeModel();
  const result = await service.analyze(
    { key: error.key, runId: error.runId, resume: true },
    exec,
  );
  assert.equal(result.modelCalls, 4);
  assert.equal(
    (await archive.load(result.key, result.runId, "evidence.json")).length,
    2,
  );
  assert.notEqual(result.runId, error.runId);
  assert.equal(result.parentRunId, error.runId);
  assert.deepEqual(counts(), { reads: 1, related: 1 });
  assert.equal(
    (await archive.load(error.key, error.runId, "manifest.json")).status,
    "failed",
  );
  const report = await archive.load(result.key, result.runId);
  for (const section of report.sections)
    for (const key of MODULE_FIELDS[section.id])
      assert.ok(section.details[key]);
});
test("single module rerun reuses source and evidence; history search and version diff work", async (t) => {
  const { service, exec } = await fixture(t);
  const tools = createTools(service);
  const call = (suffix, args) =>
    tools.find((t) => t.name === "paper_insight_" + suffix).execute(args, exec);
  const first = await call("analyze", { reference: paper.id });
  service.read = () => {
    throw new Error("must not download again");
  };
  const second = await call("analyze_sandbox", {
    key: first.key,
    runId: first.runId,
  });
  assert.equal(second.modelCalls, 1);
  assert.deepEqual(second.modules, ["sandbox"]);
  assert.equal(
    (await call("library", { query: "规划与执行分离" })).runs.length,
    2,
  );
  const diff = await call("compare_versions", {
    key: first.key,
    before: first.runId,
    after: second.runId,
  });
  assert.equal(diff.changes.length, 9);
  assert.equal(
    (
      await call("export_report", {
        key: second.key,
        runId: second.runId,
        format: "json",
      })
    ).report.sections.length,
    1,
  );
});
test("fetch failure has a resumable checkpoint before any model call", async (t) => {
  const { service, exec } = await fixture(t);
  const original = service.read.bind(service);
  service.read = async () => {
    throw new Error("network offline");
  };
  let error;
  try {
    await service.analyze({ reference: paper.id, modules: ["paper"] }, exec);
  } catch (e) {
    error = e;
  }
  const cp = await service
    .archive(exec)
    .load(error.key, error.runId, "checkpoint.json");
  assert.equal(cp.events[0].status, "failed");
  service.read = original;
  const result = await service.analyze(
    { key: error.key, runId: error.runId, resume: true },
    exec,
  );
  assert.equal(result.status, "completed");
});
test("incremental discovery persists fingerprints, detects revisions, and can be scheduled as an explicit call", async (t) => {
  const { service, exec } = await fixture(t);
  let current = { ...paper };
  service.search = async () => ({
    papers: [current],
    errors: [],
    searchedAt: new Date().toISOString(),
  });
  const tools = createTools(service);
  const call = (n, a) =>
    tools.find((t) => t.name === "paper_insight_" + n).execute(a, exec);
  await call("subscriptions", { topics: ["agents"] });
  assert.equal((await call("discover_updates", {})).newPapers.length, 1);
  assert.equal((await call("discover_updates", {})).newPapers.length, 0);
  current = { ...paper, arxivId: "2601.00001v2", id: "arxiv:2601.00001v2" };
  assert.equal(
    (await call("discover_updates", {})).newPapers[0].change,
    "updated",
  );
});
test("citation graph distinguishes topical similarity and escapes Mermaid labels", () => {
  const result = researchArtifacts(
    { ...paper, title: 'unsafe"] --> BAD' },
    {
      ...research,
      references: [{ ...paper, evidenceId: "R1", relation: "cited-by-target" }],
      discovery: [
        { ...paper, evidenceId: "D1", relation: "topic-search-only" },
      ],
    },
  );
  assert.match(result.mermaid, /T -->\|cites\| R1/);
  assert.match(result.mermaid, /topic similarity only/);
  assert.doesNotMatch(result.mermaid, /unsafe"\]/);
});
test("workbench API rejects foreign origins, DNS rebinding hosts and simple form posts", () => {
  assert.throws(() =>
    guardRequest({ method: "GET", headers: { host: "evil.example" } }),
  );
  assert.throws(() =>
    guardRequest({
      method: "POST",
      headers: {
        host: "localhost:3080",
        origin: "https://evil.example",
        "content-type": "application/json",
      },
    }),
  );
  assert.throws(() =>
    guardRequest({
      method: "POST",
      headers: { host: "localhost:3080", "content-type": "text/plain" },
    }),
  );
  assert.doesNotThrow(() =>
    guardRequest({
      method: "POST",
      headers: {
        host: "localhost:3080",
        origin: "http://localhost:3080",
        "content-type": "application/json",
      },
    }),
  );
});
test("native sidebar module registers main and navigation without modifying the host DOM", async () => {
  let plugin;
  const registrations = [];
  const source = await fs.readFile(
    new URL("../client.js", import.meta.url),
    "utf8",
  );
  vm.runInNewContext(source, {
    window: {
      __ModuleLoader__: {
        load: (module) => {
          plugin = module.factory(() => ({ createElement: () => null }));
        },
      },
    },
  });
  plugin.apply({
    effect: () => {},
    slots: {
      inject: (_slot, f) => f(),
      register: (options, component) => {
        registrations.push({ options, component });
        return () => {};
      },
    },
  });
  assert.equal(registrations[0].options.name, "main");
  assert.equal(registrations[1].options.name, "sidebar.panellist");
  assert.equal(registrations[0].options.key, registrations[1].options.id);
});
test("partial reports do not claim complete ten-module coverage", async (t) => {
  const { service, exec } = await fixture(t);
  const result = await service.analyze(
    { reference: paper.id, modules: ["sandbox"] },
    exec,
  );
  const report = await service.archive(exec).load(result.key, result.runId);
  assert.equal(report.validation.allSectionsPresent, false);
  assert.equal(report.validation.requestedModulesComplete, true);
});
test("comparison archives exportable JSON and validates report references", async (t) => {
  const { service, exec } = await fixture(t);
  const a = await service.analyze(
    { reference: paper.id, modules: ["paper"] },
    exec,
  );
  const b = await service.analyze(
    { key: a.key, runId: a.runId, modules: ["sandbox"] },
    exec,
  );
  service.makeModel = () => ({
    route: { provider: "fixture", model: "fixture" },
    calls: [],
    generate: async () =>
      JSON.stringify({
        summary: "合成比较，仅验证接口和持久化，不是研究结果。",
        comparisons: [
          {
            dimension: "sandbox",
            analysis: "fixture comparison",
            reportIds: ["A1", "A2"],
            evidenceLevel: "inference",
            validation: "test only",
          },
        ],
      }),
  });
  const tools = createTools(service);
  const call = (n, args) =>
    tools.find((t) => t.name === "paper_insight_" + n).execute(args, exec);
  const compared = await call("compare_papers", {
    reports: [
      { key: a.key, runId: a.runId },
      { key: b.key, runId: b.runId },
    ],
  });
  assert.equal(
    (
      await call("export_report", {
        key: compared.key,
        runId: compared.runId,
        format: "json",
      })
    ).report.comparisons.length,
    1,
  );
  assert.equal(
    (await call("library", { query: "fixture comparison" })).runs.length,
    1,
  );
});
test("local opportunity aggregation keeps latest available product modules after unrelated module reruns", async (t) => {
  const { service, exec } = await fixture(t);
  const a = await service.analyze(
    { reference: paper.id, modules: ["features"] },
    exec,
  );
  await service.analyze(
    { key: a.key, runId: a.runId, modules: ["sandbox"] },
    exec,
  );
  const result = await createTools(service)
    .find((t) => t.name === "paper_insight_aggregate")
    .execute({}, exec);
  assert.equal(result.papers, 1);
  assert.equal(result.opportunities.length, 1);
  assert.equal(result.opportunities[0].runId, a.runId);
});
