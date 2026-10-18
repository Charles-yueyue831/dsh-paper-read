import test from "node:test";
import assert from "node:assert/strict";
import {
  splitReport,
  headingSlug,
  reportLinks,
  validateDiagram,
} from "../client/report-utils.js";
import { installWeb } from "../lib/web.js";

test("Mermaid fences separate without changing other report bytes", () => {
  const md =
    '# 报告\r\n\r\n```js\nconst demo = "```mermaid";\n```\n~~~mermaid\nflowchart LR\n A --> B\n~~~\n尾部\n';
  const parts = splitReport(md);
  assert.equal(parts.length, 3);
  assert.equal(parts[1].type, "mermaid");
  assert.equal(parts[1].text, "flowchart LR\n A --> B\n");
  assert.equal(parts.map((p) => p.raw || p.text).join(""), md);
});
test("long fences, unclosed fences and nested code examples remain literal", () => {
  for (const md of [
    "```mermaid\nA --> B",
    "    ```mermaid\n    A --> B\n    ```",
    "````md\n```mermaid\nA --> B\n```\n````",
  ]) {
    assert.deepEqual(splitReport(md), [{ type: "markdown", text: md }]);
  }
  assert.equal(
    splitReport("````mermaid\ngraph LR\nA-->B\n````\n")[0].type,
    "mermaid",
  );
});
test("citation anchors resolve locally while code and external links remain unchanged", () => {
  const input =
    "见 [P1.F1](#p1-f1) 和 [外部](https://example.org)\n`[code](#p1-f1)`\n```text\n[code](#p1-f1)\n```\n    [code](#p1-f1)";
  const output = reportLinks(input, "http://localhost:3091/", "report-id");
  assert.equal(
    output,
    input.replace(
      "[P1.F1](#p1-f1)",
      "[P1.F1](http://localhost:3091/#report-id-p1-f1)",
    ),
  );
  assert.equal(
    reportLinks("[bad](#%zz)", "http://localhost/", "r"),
    "[bad](#%zz)",
  );
  assert.equal(headingSlug(" P1.F1 "), "p1f1");
  assert.equal(headingSlug("P1-F1"), "p1-f1");
  assert.equal(headingSlug("主要矛盾 → 代价"), "主要矛盾-代价");
});
test("diagram configuration, executable HTML, links and oversized inputs fail closed", () => {
  for (const source of [
    '%%{init:{securityLevel:"loose"}}%%\ngraph LR',
    "---\nconfig: x\n---",
    'graph LR\n click A "https://example.org"',
    'graph LR\n A["<script>alert(1)</script>"]',
    'graph LR\n A@{img:"https://example.org/a"}',
    "graph LR\nclassDef x fill:url(javascript:evil)",
    "x".repeat(30001),
  ])
    assert.throws(() => validateDiagram(source));
  assert.equal(
    validateDiagram("flowchart LR\n A[论文] --> B[产品]"),
    "flowchart LR\n A[论文] --> B[产品]",
  );
});
test("locally bundled diagram asset uses exact route and existing origin guards", async () => {
  let handler;
  installWeb(
    {
      inject: (_, callback) =>
        callback({
          effect: (fn) => fn(),
          webServer: {
            register: (route) => {
              handler = route.handler;
            },
          },
        }),
    },
    {},
    [],
    new AbortController().signal,
  );
  async function request(path, headers = { host: "127.0.0.1:3091" }) {
    const result = {};
    await handler(
      { method: "GET", url: path, headers },
      {
        writeHead: (status, headers) =>
          Object.assign(result, { status, headers }),
        end: (body) => {
          result.body = String(body);
        },
      },
    );
    return result;
  }
  const asset = await request("/api/paper-insight/assets/diagram.js?v=0.2.1");
  assert.equal(asset.status, 200);
  assert.match(asset.headers["content-type"], /javascript/);
  assert.match(asset.body, /renderDiagram/);
  assert.equal(
    (
      await request("/api/paper-insight/assets/diagram.js", {
        host: "127.0.0.1:3091",
        origin: "https://evil.example",
      })
    ).status,
    400,
  );
  assert.notEqual(
    (await request("/api/paper-insight/assets/../../package.json")).status,
    200,
  );
});
