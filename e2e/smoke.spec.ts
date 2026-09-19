import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test("single bright home matches the final component system", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1294 });
  await page.reload();
  await expect(page.getByRole("heading", { name: "让今天变得更有意义。" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "今日任务" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "即将到来" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "最近项目" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "快捷应用" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "专注" })).toBeVisible();
  await expect(page.locator(".scene-artwork")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.keyboard.press("Meta+K");
  await expect(page.getByRole("dialog", { name: "命令面板" })).toBeVisible();
  await page.keyboard.press("Escape");
});

test("project and tool creation work without console errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto("/projects");
  await page.getByRole("button", { name: "新建项目" }).click();
  await page.getByPlaceholder("项目名称").fill("验收项目");
  await page.getByPlaceholder("项目描述").fill("由 Playwright 创建");
  await page.getByRole("button", { name: "创建项目" }).click();
  await expect(page.getByRole("heading", { name: "验收项目" })).toBeVisible();
  await page.goto("/tools");
  await page.getByRole("button", { name: "添加工具" }).click();
  await page.getByPlaceholder("工具名称").fill("本地文档");
  await page.getByPlaceholder("网址、本地路径或命令参数").fill("https://example.com");
  await page.getByRole("button", { name: "保存工具" }).click();
  await expect(page.getByRole("heading", { name: "本地文档" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("settings persist and invalid launcher requests are rejected", async ({ page, request }) => {
  await page.goto("/settings");
  await page.getByRole("checkbox").check();
  await page.reload();
  await expect(page.getByRole("checkbox")).toBeChecked();
  const invalid = await request.post("http://127.0.0.1:47135/launch", { headers: { origin: "http://127.0.0.1:3000" }, data: { launch: { type: "local-path", path: "../unsafe" } } });
  expect(invalid.status()).toBe(400);
  await expect(invalid.json()).resolves.toEqual({ ok: false, error: "invalid-action" });
});
