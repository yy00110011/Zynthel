import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Windows CI 的失败策略必须「绑定到 Job」，而且只让 arm64 试构建允许失败：
// 只写在 strategy.matrix.include 里的 continue-on-error 不会生效，
// 而把整个 Job 设成 continue-on-error: true 会让 x64 失败也照样发版。
// 这里用文本解析锁死这个结构（不引入 YAML 依赖）。
const WORKFLOW = readFileSync(resolve(process.cwd(), ".github/workflows/build-windows.yml"), "utf8");

/** Job 自身的属性区（`strategy:` 之前），不含 matrix 条目。 */
function jobBlock(): string {
  const start = WORKFLOW.indexOf("\n  windows:");
  expect(start).toBeGreaterThan(-1);
  const end = WORKFLOW.indexOf("    strategy:");
  expect(end).toBeGreaterThan(start);
  return WORKFLOW.slice(start, end);
}

function archBlock(arch: string): string {
  const start = WORKFLOW.indexOf(`- arch: ${arch}`);
  expect(start, `matrix 中缺少 arch=${arch}`).toBeGreaterThan(-1);
  const next = WORKFLOW.indexOf("- arch:", start + 1);
  return WORKFLOW.slice(start, next === -1 ? WORKFLOW.length : next);
}

describe("Windows CI 失败策略", () => {
  it("Job 层的 continue-on-error 取自 matrix（真正绑定到 Job）", () => {
    const block = jobBlock();
    expect(block).toContain("continue-on-error: ${{ matrix.continue-on-error }}");
  });

  it("没有把整个 Windows Job 一律设成允许失败", () => {
    const block = jobBlock();
    // 除 matrix 引用外，不允许出现写死的 continue-on-error: true
    const literal = block
      .split("\n")
      .filter((line) => line.includes("continue-on-error") && !line.includes("matrix."));
    expect(literal.every((line) => line.includes("false"))).toBe(true);
  });

  it("x64 必须失败即失败（continue-on-error: false）", () => {
    const block = archBlock("x64");
    expect(block).toMatch(/continue-on-error:\s*false/);
    expect(block).not.toMatch(/continue-on-error:\s*true/);
  });

  it("arm64 为试构建，失败不阻塞（continue-on-error: true）", () => {
    const block = archBlock("arm64");
    expect(block).toMatch(/continue-on-error:\s*true/);
  });

  it("两个架构都在 matrix 中，且失败策略不同", () => {
    expect(archBlock("x64")).toContain("x86_64-pc-windows-msvc");
    expect(archBlock("arm64")).toContain("aarch64-pc-windows-msvc");
  });
});
