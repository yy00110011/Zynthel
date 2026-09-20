# ADR 0001 · 使用 Tauri 2 作为跨平台底座

## Decision

采用 **Next.js / TypeScript（前端）+ Rust / Tauri 2（原生层）** 的架构：前端静态导出（`output: "export"` → `out/`），由 Tauri 打包成 Windows 安装包与 Android APK。

## Context

项目需要同时交付 Windows 桌面端与 Android 端，但真正需要原生能力的只有三件事：打开外部网址、启动本机已安装应用、枚举已安装应用。其余全部是界面与数据逻辑。

同时希望：

- 两台平台共用同一套界面与业务逻辑，避免双份维护；
- 原生层尽量小，减少攻击面与平台差异；
- 应用不需要联网运行，也不能依赖服务端。

## Alternatives

- **Electron**：生态成熟，但体积大、Android 不支持，与移动端目标冲突。
- **Flutter / React Native**：移动端体验好，但桌面端（尤其 Windows 安装包形态）与 Web 技术栈复用成本高。
- **分别开发两个原生应用**：平台体验最好，但要维护两套代码，与「共用一套前端」的目标直接冲突。
- **纯 Web（PWA）**：无法枚举本机应用、无法启动本机应用，不满足需求。

## Consequences

**优点**

- 一套前端 + 数据层覆盖两个平台，平台差异被压缩到 Rust 条件编译与前端 `detectPlatform()`；
- 原生层仅三个 IPC 命令，审查面小；
- 前端为静态导出，运行时不需要 Node，也没有服务端。

**代价**

- Rust 工具链与 Android NDK 是构建前置依赖，本地搭建成本较高（已用 GitHub Actions 固化构建环境）；
- WebView 行为在不同平台存在细微差异，需要针对性适配；
- Windows 侧需要自行处理代码签名（当前未签名）。

## Contributors

- 决策：项目作者
- 方案讨论：共同讨论 / 多轮迭代形成（含 AI 辅助）
- 实现：AI 辅助开发，无法从现有记录可靠区分单一来源
- 安全审查：外部 AI 与后端源码审查包
