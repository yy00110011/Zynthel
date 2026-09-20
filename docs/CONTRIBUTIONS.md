# Zynthel 项目贡献、架构与方案来源说明

> 本文件记录 Zynthel 从产品构思、架构设计、代码实现、安全审查、平台适配到 GitHub 开源发布过程中，各参与者与 AI 工具分别承担的工作。
>
> **这不是版权归属文件。** 项目作者本人仍然是 Zynthel 的发起者、需求提出者、产品决策者与最终维护者。文中列出的 AI 产品均为开发过程中使用的**辅助工具**，不构成 Zynthel 的版权所有者，也不代表 OpenAI、Google、DeepSeek、腾讯等相关公司对本项目有任何官方参与、赞助、联合开发或背书。

## 📌 本文件的证据基础（请先读）

为避免虚构贡献历史，先说明本文件能依据什么：

| 依据 | 内容 |
| --- | --- |
| Git 历史 | 34 个提交，**全部由同一位人类作者提交**，提交信息为约定式提交（feat / fix / docs / chore），**没有任何 AI 署名或 `Co-authored-by` trailer** |
| 工作目录 | 项目位于 `Documents/Codex/2026-09-18/...`，且 2026-09-18～19 的提交早于本次 WorkBuddy 会话 —— 据此可判断**早期工程实现主要在 Codex 环境完成** |
| 仓库文档 | 存在面向「第三方 AI / 外部开发者」的后端源码审查包与安全审查清单，说明项目过程中确实使用过外部 AI 做代码与安全审查 |
| 本次会话（2026-09-20） | 开源清理、文档、CI 验证、云端构建、终审报告由 **WorkBuddy** 执行，有明确的会话与提交记录 |

**因此：**

- 凡能由上述记录支撑的归属，本文件明确记录；
- 凡无法从现有记录可靠区分单一来源的模块，一律标注 **`AI 辅助 · 无法从现有记录可靠区分单一来源`**，而不是猜测归给某个工具；
- 项目作者确认过的参与关系（如 ChatGPT 参与方案与安全审查），会注明「**作者确认，仓库未保留逐项记录**」。

---

## 👤 项目作者

Zynthel 的发起者、需求提出者、产品决策者与最终维护者。负责：

- 项目发起与产品定位
- 核心产品构思与功能需求提出
- 功能取舍与优先级（做什么、不做什么）
- UI 风格方向与交互基调
- Windows / Android 双平台方向
- local-first 产品方向（数据不出设备、无云端账号）
- AI 工具的选择、调度与结果筛选
- 各方案最终确认（包括架构、安全边界、发布策略）
- 测试反馈与 Bug 反馈
- 开源决定、公开时机与最终发布决定
- 项目长期维护

**特别说明**：AI 工具可以提出方案、生成代码、做审查，但**最终产品需求、方案取舍与是否采用，全部由项目作者决定**。任何 AI 都不替代作者的决策。

## 🤖 ChatGPT

作者确认的参与方向（**仓库未保留逐项对话记录，故不把具体代码实现单独归给 ChatGPT**）：

- 项目总体规划与阶段划分
- 产品架构与技术选型讨论
- Windows / Android 开源方案与双平台单仓库结构方案
- GitHub Repository 结构、GitHub Actions / Release 流程设计
- Windows EXE / MSI 云端构建方案、Android APK 发布方案
- 安全审查与后端源码审查（配合项目自带的审查包）
- Bug 分级与修复方案设计
- 开源前终审方案（版权 / 隐私 / Secret 检查流程）
- README / SECURITY / CONTRIBUTING 与安装使用文档体系规划
- 多个 AI 工具之间的任务分工建议

> 可核验性：以上为作者确认的参与方向；具体某段代码的归属无法从现有仓库记录判定，见第 9 节表格。

## 🧑‍💻 OpenAI Codex

依据工作目录与提交时间线可确认的工程工作：

- **主要代码实现环境**：项目位于 Codex 工作目录，2026-09-18～19 期间的 30 个提交（功能开发、Bug 修复、重构、工程配置）均在该环境中完成
- 前端实现（Next.js / TypeScript 页面与组件）
- Rust / Tauri 后端实现与命令层调试
- 平台适配（Android 与 Windows 差异处理）
- 工程配置（Gradle / Cargo / Next.js 配置）
- 本地构建与调试

> 说明：Git 提交者均为项目作者本人，Codex 的贡献体现为**在该环境中完成的工程工作**，而非独立提交身份。

## 🛠️ WorkBuddy

有明确会话记录的贡献（本次开源会话，2026-09-20）：

- 开源前源码清理与敏感信息 / 私人信息 / 版权资源扫描
- `.gitignore` 加固（签名材料、安装包产物、内嵌源码的审查包）
- README / SECURITY / CONTRIBUTING 重写与新增
- `docs/FAQ.md`、`docs/release-notes-v0.1.0.md`、`SCREENSHOT_CHECKLIST.md`
- 截图体系（Android 真机截图归档 + 桌面端界面截图生成管线，全部使用虚构 Demo 数据）
- GitHub Actions 核对与修正（`ci.yml` 补装 Tauri Linux 系统依赖）
- 创建 Private 仓库、推送源码、触发并验证 Windows 与 Android 云端构建
- 生成 `OPEN_SOURCE_REVIEW.md` 终审报告
- GitHub Repository 描述与 Topics 设置

## ✨ Google Gemini

作者在项目中确认使用的辅助工具之一，参与方向包括：

- 项目与技术方案分析
- 架构讨论
- UI / UX 思路讨论
- 开发与文档辅助

> 仓库未保留逐项对话记录，因此不指定具体模块归属。凡无法区分的部分均标注为「AI 辅助 · 无法从现有记录可靠区分单一来源」。

## 🧠 DeepSeek

作者在项目中确认使用的辅助工具之一，参与方向包括：

- 技术分析与方案讨论
- 代码辅助与调试建议
- 开发方案讨论

> 同上：不指定具体模块归属，不做扩大性描述。

## 💬 腾讯元宝

作者在项目中确认使用的辅助工具之一，参与方向包括：

- 项目与技术分析
- 技术讨论与开发辅助
- 文档辅助

> 同上：仅记录可确认的辅助参与，不做具体归属。

---

## 🏗️ 核心架构与方案来源

> 表中「AI 辅助 · 无法区分」= 该模块经过多轮 AI 辅助开发与人工迭代，无法从现有记录可靠区分单一实现来源。
> 所有行的**最终决策均为项目作者**。

| 架构 / 方案 | 主要提出 / 设计 | 主要实现 | 审查 / 辅助 | 最终决策 |
| --- | --- | --- | --- | --- |
| Zynthel 产品定位 | 项目作者 | — | AI 工具辅助讨论 | 项目作者 |
| local-first 产品方向 | 项目作者 | AI 辅助 · 无法区分 | 多工具审查 | 项目作者 |
| Tauri 2 跨平台架构 | 共同讨论 / 多轮迭代形成 | AI 辅助 · 无法区分 | 安全审查（多工具） | 项目作者 |
| Next.js + TypeScript 前端 | 共同讨论 / 多轮迭代形成 | AI 辅助 · 无法区分（Codex 环境为主） | 多工具审查 | 项目作者 |
| Rust 后端（Tauri 命令层） | 共同讨论 / 多轮迭代形成 | AI 辅助 · 无法区分 | 后端源码审查包 + 外部 AI 审查 | 项目作者 |
| Repository 数据层（localStorage） | 共同讨论 / 多轮迭代形成 | AI 辅助 · 无法区分 | 多工具审查 | 项目作者 |
| IndexedDB 大对象层（图片 / 书籍） | 共同讨论 / 多轮迭代形成 | AI 辅助 · 无法区分 | 多工具审查 | 项目作者 |
| Web Crypto 加密方案（Vault） | 共同讨论 / 多轮迭代形成 | AI 辅助 · 无法区分 | 安全审查（含模偏差、IV 复用等） | 项目作者 |
| Vault 架构（主密码 / 自动锁定） | 共同讨论 / 多轮迭代形成 | AI 辅助 · 无法区分 | 安全审查 | 项目作者 |
| AI 接口架构（纯配置、不内置密钥） | 项目作者提出约束 | AI 辅助 · 无法区分 | 安全审查（URL 校验、超时） | 项目作者 |
| DriftWall / 浮光墙 | 共同讨论 / 多轮迭代形成 | AI 辅助 · 无法区分 | 安全审查（MIME / 限额 / 渲染前缀） | 项目作者 |
| 图片处理管线（降采样 / 缩略图 / WebP） | 共同讨论 / 多轮迭代形成 | AI 辅助 · 无法区分 | 多工具审查 | 项目作者 |
| 备份 / 恢复架构（ZIP + JSON + 资源限额） | 共同讨论 / 多轮迭代形成 | AI 辅助 · 无法区分 | 安全审查（解压炸弹 / 回滚） | 项目作者 |
| Windows 平台适配 | 共同讨论 / 多轮迭代形成 | AI 辅助 · 无法区分 | 安全审查（禁止 shell / 命令白名单） | 项目作者 |
| Android 平台适配 | 共同讨论 / 多轮迭代形成 | AI 辅助 · 无法区分 | 安全审查（scheme 白名单 / 主线程） | 项目作者 |
| Android App Picker（QUERY_ALL_PACKAGES） | 共同讨论 / 多轮迭代形成 | AI 辅助 · 无法区分 | 权限必要性审查 | 项目作者 |
| Windows Local App Launcher | 共同讨论 / 多轮迭代形成 | AI 辅助 · 无法区分 | 安全审查（不拼 shell、不执行命令） | 项目作者 |
| GitHub 双平台单仓库方案 | ChatGPT 参与方案设计（作者确认） | WorkBuddy 实际执行 | Codex 等按实际记录参与 | 项目作者 |
| Windows GitHub Actions（EXE + MSI） | 既有 workflow（早期会话）+ ChatGPT 方案讨论 | 早期会话实现；WorkBuddy 本轮核对 / 修正 / 验证 | 云端构建实测 | 项目作者 |
| Android GitHub Actions（APK） | 既有 workflow（早期会话） | 早期会话实现；WorkBuddy 本轮补充 tag 触发与平台标记并验证 | 云端构建实测 | 项目作者 |
| GitHub Releases 方案 | ChatGPT 参与方案设计（作者确认） | WorkBuddy 准备（Release Notes 草稿，尚未发布） | 待作者确认后执行 | 项目作者 |
| 开源安全审查流程 | ChatGPT 参与（作者确认） | WorkBuddy 执行扫描与终审 | 多工具交叉审查 | 项目作者 |
| README / 安装与使用文档体系 | ChatGPT 参与方案设计（作者确认） | WorkBuddy 实际整理 | 按真实源码逐项核对 | 项目作者 |
| 商标检索与更名（SOLARIS → Zynthel） | 项目作者发起 | 联网检索（AI 辅助） | 建议人工在官方数据库复核 | 项目作者 |

---

## 🔧 技术方案记录

### 1. Local-first

- **为什么采用**：项目作者的明确方向 —— 个人数据不上传、不需要账号、不依赖云端服务。
- **本地保存的数据**：任务、项目、笔记、日历事件、专注记录、8 个生活工具数据、AI 配置与对话记录、设置、密码本密文、浮光墙缩略图 —— 存于 WebView 的 localStorage（键 `zynthel.workspace.open`）。
- **IndexedDB 的作用**：承载不适合放进 localStorage 的大对象 —— 浮光墙**原图**（WebP Blob，库 `zynthel-drift-wall/images`）与**阅读器的本地书籍文件**。
- **需要网络的功能**：只有 AI —— 用户主动发起对话时，请求从设备直连用户自己配置的服务商。
- **参与者**：方向由项目作者提出；实现为 AI 辅助（无法区分单一来源）；审查为多工具。

### 2. Tauri 2

- **为什么采用**：需要一套代码同时产出 Windows 桌面包与 Android APK，且要调用少量原生能力（启动应用 / 网址、枚举已安装应用）。Next.js/TypeScript 负责界面与业务，Rust + Tauri 2 负责原生层，前端静态导出（`output: "export"`）后由 Tauri 打包。
- **参与者**：架构为共同讨论 / 多轮迭代形成；实现为 AI 辅助（Codex 环境为主）；安全审查见下节。

### 3. Windows Launcher（安全边界）

当前实现要点（以源码为准）：

- 打开网址：统一走 `rundll32 url.dll,FileProtocolHandler`（ShellExecute 的安全封装），参数以 `Command::new(...).arg(...)` 传入，**绝不把用户输入拼进 shell 字符串**；
- 本地应用：路径必须来自 Rust 侧 `find_local_app` 的扫描结果，不允许手工伪造；
- 可执行命令白名单：仅允许 `open` / `/usr/bin/open` / `codex`；
- **`CustomCommand` 在 Windows 编译期直接返回 `CommandNotAllowed`** —— Windows 上不存在任意命令执行入口；
- URL 严格校验：`url` crate 解析，仅允许 http/https 且要求合法 host（拒绝 `file:` `javascript:` `intent:` `data:` `obsidian:` 等）。

**参与者**：安全方案为共同讨论 / 多轮迭代形成；实现为 AI 辅助（无法区分单一来源）；安全审查由外部 AI 与审查包完成；最终采用由项目作者确认。

### 4. Android Launcher

- **App Picker**：通过 Kotlin 插件 `LaunchPlugin` 枚举本机已安装应用，供用户把常用应用添加为快捷入口；
- **`QUERY_ALL_PACKAGES` 的实际用途**：Android 11+ 要枚举**任意**已安装应用（包名无法预先穷举），必须声明该权限。应用列表只在本地使用，不收集、不上传；
- **打开网页 / 启动应用**：`openUrl` 只放行 http/https；`launchPackage` 启动第三方应用，未安装时走 fallback URL；
- **稳定性**：枚举移出主线程（IO 协程），异常与生命周期安全处理，Bitmap 在 `finally` 中回收。

**参与者**：同上模式（设计：共同讨论；实现：AI 辅助；审查：多工具；决策：项目作者）。

### 5. Vault（密码本）

源码可证明的实现：

- Web Crypto 原生实现：**AES-GCM-256 + PBKDF2-SHA256**；
- 迭代次数限制在 100,000～1,000,000（防止异常数据导致解锁卡死）；
- 密钥只存在于内存（CryptoKey），**不落盘**；
- password / url / note 各字段使用**独立 IV**（旧数据回退 `vaultMeta.iv`）；
- 支持自动锁定与异步竞态处理；
- **主密码无法找回**（项目不保存主密码，也没有重置途径）。

### 6. DriftWall / 浮光墙

- 缩略图（WebP，长边 192px）以 dataURL 存入 workspace JSON；**原图（WebP，长边 1024px）以 Blob 存入 IndexedDB**；
- 上传只认位图 MIME：`image/png` / `image/jpeg` / `image/webp`，单张 ≤10MB，源图 ≤4000 万像素；
- 坐标归一化（0~1），窗口缩放不跑位；动画为纯 CSS `transform` + `@keyframes`，尊重系统「减弱动态效果」；
- 渲染时二次校验图片来源（只渲染 `data:image/` 前缀），防止被篡改的数据注入外链。

### 7. Backup / 恢复

当前实现（以 `src/features/data/transfer.ts` 为准）：

- **导出**：ZIP（`zynthel-full-backup` 标记），内含 `workspace.json`、书籍文件、浮光墙图片目录 `drift-wall/`；
- **导入**：先解压校验，再做 schema 校验与资源白名单校验，**校验失败整体拒绝并回滚**，不会写入一半的数据；
- **限额**：ZIP ≤200MB；书籍文件 ≤500 个、单文件 ≤40MB、总量 ≤150MB；浮光墙图片 ≤400 个、单文件 ≤8MB、总量 ≤80MB；
- 另提供纯 JSON 的工作区导出 / 导入（`exportWorkspace` / `importWorkspace`），适合轻量迁移。

### 8. AI

- 用户自行配置：**Interface 名称 / Endpoint（baseUrl）/ API Key / Model**；
- 请求直连用户配置的服务商：`{baseUrl}/chat/completions`，OpenAI 兼容协议，非流式，60 秒超时（AbortController）；
- **为什么不内置开发者私人 Key**：内置密钥会（a）把作者的付费额度暴露给所有使用者，（b）让项目变成需要作者运营的服务，与 local-first 定位冲突，（c）一旦随公开仓库分发即为凭据泄露。
- 密钥保存在本机应用存储，**不是**操作系统密钥库级别保护 —— 已在 README / SECURITY / FAQ 中如实说明。

### 9. Windows Build 链路

```
源码 → GitHub（Private 验证） → GitHub Actions → Windows Runner
     → pnpm install --frozen-lockfile → pnpm tauri build --bundles nsis,msi
     → NSIS EXE + MSI → Actions Artifact / Release 资产
```

- 实测产出：`Zynthel_0.1.0_x64-setup.exe`、`Zynthel_0.1.0_x64_en-US.msi`（arm64 为 Experimental，失败不阻塞 x64）；
- 未做商业代码签名 → SmartScreen「未知发布者」为已知限制。
- **参与者**：方案设计 ChatGPT 参与（作者确认）+ 既有 workflow；实现早期会话完成，本轮由 WorkBuddy 核对与云端实测；最终决策项目作者。

### 10. Android Build 链路

```
源码 → GitHub（Private 验证） → GitHub Actions → ubuntu-latest
     → JDK 17 + Android SDK 36 + NDK 27 → pnpm tauri android build --apk --debug
     → APK → Actions Artifact / Release 资产
```

- 实测产出：`app-universal-debug.apk`（debug 变体，包名带 `.debug` 后缀）；
- Release 签名需要作者自己的密钥（走 GitHub Secrets 或本地签名），**不上传任何 keystore 与签名密码**。

---

## ⚖️ 版权与贡献的区分

| 类别 | 内容 |
| --- | --- |
| **Author（作者）** | 项目作者本人 —— 发起者、需求提出者、产品决策者、最终维护者 |
| **Contributors / Assistance（贡献与协助）** | ChatGPT、OpenAI Codex、WorkBuddy、Google Gemini、DeepSeek、腾讯元宝等开发辅助工具，以及未来真实的社区贡献者 |
| **Copyright（版权）** | 以 `LICENSE` 中确认的 Copyright Holder 为准（当前为 `Copyright (c) 2026 yy00110011`，以最终确认为准） |

**不能**因为某个 AI 生成过代码，就把 OpenAI、Google、DeepSeek、腾讯等公司写成 Zynthel 的版权所有者或联合发布方。GitHub Contributors 页面按真实 Git 提交与 Pull Request 显示，不为 AI 伪造贡献账号。

---

## 🧭 如何解读 Zynthel 的开发过程

```
项目作者提出需求、决定方向并最终确认
        ↓
多个 AI 工具参与方案讨论、代码实现、审查与文档
        ↓
项目作者持续测试、反馈与筛选
        ↓
形成最终 Zynthel
```

既不是「某个 AI 自己创造了整个 Zynthel」，也不是「这些 AI 公司联合开发了 Zynthel」。
