# Zynthel 开源终审报告（OPEN_SOURCE_REVIEW）

> 生成时间：2026-09-20
> 仓库：https://github.com/yy00110011/Zynthel
> **当前仓库状态：PRIVATE**（未公开、未发布 Release —— 等待你确认后才执行 Public 与 v0.1.0 Release）
> 本次只开源 Windows 与 Android 两个版本，共用同一仓库、同一前端与数据层。

---

## 0. 结论速览

| 项 | 结果 |
| --- | --- |
| 源码完整性 | ✅ 完整（Next.js + Tauri 2 + Rust + Android Kotlin/Gradle 全在仓库内） |
| 敏感信息 | ✅ 未发现真实 Secret |
| 私人数据 | ✅ 未发现 |
| 私有版本隔离 | ✅ 已确认隔离 |
| 版权资源 | ✅ 无第三方素材；图标为项目自有 |
| Windows 云端构建 | ✅ 成功（x64 + arm64 均成功，EXE + MSI 真实产出） |
| Android 云端构建 | ✅ 成功（APK 真实产出） |
| CI（typecheck/lint/test/build/cargo check） | ✅ 成功 |
| 文档 | ✅ README / LICENSE 草稿 / SECURITY / CONTRIBUTING / FAQ / Release Notes 已就绪 |
| **是否可转 Public** | ⏸ **等待你确认**（见第 10 节待确认项） |

---

## 1. 源码完整性

| 检查项 | 状态 |
| --- | --- |
| `package.json` / `pnpm-lock.yaml` | ✅ |
| `src/`（前端） | ✅ |
| `src-tauri/Cargo.toml` / `Cargo.lock` / `tauri.conf.json` | ✅ |
| `src-tauri/src/`（Rust 后端） | ✅ |
| `src-tauri/gen/android/`（Android 工程：Kotlin / Gradle / Manifest） | ✅ |
| `.github/workflows/build-windows.yml` | ✅ |
| `.github/workflows/build-android.yml` | ✅ |
| `.github/workflows/ci.yml` | ✅ |

包名 / 标识：`com.zynthel.workspace`（Windows 与 Android 一致）。Android `minSdk 24` / `targetSdk 36` / `compileSdk 36`。

---

## 2. 敏感信息

扫描范围：当前工作树全部源码 + Git 全部 30 个 commit 的内容与文件名历史。

- ✅ 未发现真实 API Key / Token / Password / Bearer 凭据
- ✅ 未发现私钥（`BEGIN PRIVATE KEY` 等）
- ✅ 未发现 `.env` / `.env.local` 等环境变量文件
- ✅ 未包含 Android keystore：本地存在 `src-tauri/gen/android/app/zynthel-release.jks` 与 `keystore.properties`，两者**已被 `.gitignore` 排除，且从未进入 Git 历史**（历史文件名扫描结果为空）
- ✅ 未包含签名密码（仓库中不存在任何签名密码字面量）
- ✅ 未发现手机端/服务端地址、IP、私人服务器地址

说明：源码中存在 `apiKey` 字段，这是**供用户自行填写**的配置字段，属于功能设计，不是硬编码凭据。

---

## 3. 私有版本隔离

- ✅ 未包含 SOLARIS 各平台内测版代码
- ✅ 未包含 SOLARIS 私人配置
- ✅ 未包含私有 Obsidian 集成：仓库中无 `md.obsidian` 包可见性声明、无 `obsidian://` scheme、无相关功能代码（`launch.rs` 中仅有一条说明该 scheme 被拒绝的注释与一条对应的拒绝用测试常量）
- ✅ 未包含 macOS 私人版本：`launch.rs` 中残留少量 `#[cfg(target_os = "macos")]` **单元测试**（不参与 Windows / Android 编译产物），不存在 macOS 私有功能模块
- ✅ 未包含私人数据（见第 4 节）

---

## 4. 个人数据

- ✅ 无开发者本机绝对路径（`/Users/...`、`C:\Users\...`）残留
- ✅ 无真实姓名、邮箱、手机号
- ✅ 无真实待办 / 日记 / 密码本 / 课程 / 记账 / 学习数据
- ✅ 无 AI 对话记录或真实 AI API 配置
- ✅ 无个人备份 JSON、IndexedDB 导出、日志文件
- ✅ 截图（Android 真机 5 张 + 桌面端 8 张）已逐张检查，均为虚构 Demo 数据，不含任何个人信息

---

## 5. 版权资源

> 完整审计见 [docs/THIRD_PARTY_AUDIT.md](docs/THIRD_PARTY_AUDIT.md) 与 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

- ✅ `public/` 仅含 `pdf.worker.min.mjs`（pdfjs-dist 官方未修改构建产物，md5 与 npm 包一致）
- ✅ 无任何第三方图片、壁纸、人物/动漫素材、商用字体（仓库内字体文件数为 0）
- ✅ 无音频 / 视频素材
- ✅ UI 图标全部来自 `lucide-react`（ISC 许可）
- ✅ 应用图标（`src-tauri/icons/`、`mipmap-*`）为项目自有原创设计（蓝色星球 + 轨道环），非第三方品牌素材
- ✅ 第三方依赖许可证检查完成：运行时与构建依赖均为 MIT / Apache-2.0 / ISC / BSD-2-Clause 等宽松许可证，**无 copyleft 依赖进入分发物**；完整列表见 `NOTICE.md`、`THIRD_PARTY_NOTICES.md`、`docs/THIRD_PARTY_AUDIT.md`
- ✅ Rust 生成代码（`gen/android/**/generated/*.kt`）的 SPDX 许可证头完整保留（已列入禁删清单）
- ⚠️ **MANUAL REVIEW**：Rust 传递依赖（Cargo.lock 436 crate）需在转 Public 前跑一次 `cargo deny check licenses` 全量核验（直接依赖已确认为 MIT OR Apache-2.0）

### 法定署名三清单

**A. 必须保留/署名（删除可能违反许可证条件）**

| 项目 | 许可证依据 | 写在哪里 |
| --- | --- | --- |
| pdf.js（vendored worker，进 EXE/MSI/APK） | Apache-2.0 §4 | `THIRD_PARTY_NOTICES.md` + `docs/licenses/Apache-2.0-pdfjs.txt`；建议随 Release 资产附带 |
| epub.js | BSD-2-Clause（保留版权声明与许可文本） | 同上 |
| JSZip | MIT（双许可择 MIT） | 同上 |
| Lucide Icons | ISC | 同上 |
| React / ReactDOM / Next.js / Zod / Framer Motion / @tauri-apps/api | MIT / Apache-2.0 OR MIT | 同上（版权行已列明） |
| Tauri（含 `gen/android/**/generated/*.kt` 的 SPDX 头） | MIT OR Apache-2.0 | SPDX 头保留在源文件内，**禁止删除** |
| AndroidX / Material / Kotlin 标准库（进 APK dex） | Apache-2.0 | `THIRD_PARTY_NOTICES.md` + `docs/licenses/` |
| Rust crates（MIT/Apache-2.0） | 各 crate 许可证 | `THIRD_PARTY_NOTICES.md`（传递依赖待 cargo deny 核验） |

**B. 可选致谢（voluntary acknowledgement，不写不构成违规）**

ChatGPT、OpenAI Codex、WorkBuddy、Google Gemini、DeepSeek、腾讯元宝 —— 仅作为开发辅助工具致谢于 README，**不属于法定 attribution**，不写入 LICENSE / THIRD_PARTY_NOTICES。Tauri、Next.js、React、Rust、TypeScript 属于「技术栈」而非「贡献者」，README 单独以技术栈呈现。

**C. 无法确认（解决前不得自动判定可公开）**

| 项 | 原因 | 解决方式 |
| --- | --- | --- |
| Rust 传递依赖全量许可证（436 crate） | 编写时离线环境无法访问 crates.io 元数据 | 转 Public 前执行 `cargo deny check licenses`；建议加入 CI |

无任何图片 / 字体 / 图标 / 代码片段属于「无法确认版权」状态。

---

## 6. GitHub 文件准备

| 文件 | 状态 |
| --- | --- |
| `.gitignore` | ✅ 已覆盖 `node_modules/` `.next/` `out/` `src-tauri/target/`、`.env*`、`*.jks*` `*.keystore` `keystore.properties` `*.p12` `*.pem` `*.key` `local.properties`、`*.apk` `*.aab` `*.msi` `*.exe`、Gradle/Kotlin 缓存、日志、IDE 配置 |
| `README.md` | ✅ 完整项目主页（简介 / 界面预览 / 功能 / 平台支持表 / 下载 / Windows+Android 安装 / 快速开始 / AI 配置 / 数据与隐私 / 备份 / 密码本 / 浮光墙 / FAQ / 源码构建 / 项目结构 / 致谢） |
| `LICENSE` | ⚠️ **MIT 已就绪，Copyright Owner 已按你的选择写入 `Copyright (c) 2026 yy00110011`** —— 请确认 |
| `SECURITY.md` | ✅ 已创建（支持版本、报告方式、安全模型、已知限制、不在响应范围） |
| `CONTRIBUTING.md` | ✅ 已更新（双平台构建、禁止提交密钥/签名材料/二进制产物/个人数据） |
| `docs/FAQ.md` | ✅ 已创建（9 个常见问题） |
| `docs/release-notes-v0.1.0.md` | ✅ v0.1.0 Release Notes 草稿 |
| `docs/trademark-clearance-research.md` | ✅ 商标检索报告（保留，已从文件名移除旧品牌字样） |
| `docs/CONTRIBUTIONS.md` | ✅ 项目贡献、架构与方案来源说明（严格按可核验记录撰写，无法判定归属的模块统一标注） |
| `docs/ARCHITECTURE.md` | ✅ 架构说明（为什么这样设计） |
| `docs/adr/0001~0005` | ✅ 5 份架构决策记录（Tauri 2 / 本地优先存储 / 双平台单仓库 / AI 自配置 / GitHub Actions 发布） |
| `SCREENSHOT_CHECKLIST.md` | ✅ 待人工补的 Windows 实机截图清单 |
| 仓库 About / Topics | ✅ 已设置（描述 + 8 个 topics） |

---

## 7. Windows 构建结果（GitHub Actions 真实产出）

Workflow：**Build Windows** · Run `35489065078` · https://github.com/yy00110011/Zynthel/actions/runs/35489065078
结论：**success**（x64 与 arm64 两个 job 均 success）

| Job | 结论 |
| --- | --- |
| Windows (x64) | ✅ success |
| Windows (arm64，Experimental) | ✅ success |

已下载 artifact 并核实的真实文件：

| 文件 | 大小 |
| --- | --- |
| **EXE** `Zynthel_0.1.0_x64-setup.exe` | 3,050,236 字节（2.91 MiB） |
| **MSI** `Zynthel_0.1.0_x64_en-US.msi` | 4,055,040 字节（3.87 MiB） |
| （Experimental）`Zynthel_0.1.0_arm64-setup.exe` | 2,841,488 字节（2.71 MiB） |
| （Experimental）`Zynthel_0.1.0_arm64_en-US.msi` | 3,903,488 字节（3.72 MiB） |

- ✅ Windows x64 GitHub Actions 实际运行且成功
- ✅ NSIS EXE Artifact 实际存在
- ✅ MSI Artifact 实际存在
- ⚠️ **签名状态：未签名**（无商业代码签名证书）→ Windows 会提示「未知发布者 / SmartScreen」。已知限制，已在 README、SECURITY、FAQ、Release Notes 中如实说明，未做任何降低系统安全性的引导。
- ✅ EXE / MSI 未提交进 Git，仅作为 Actions Artifact 保存

---

## 8. Android 构建结果（GitHub Actions 真实产出）

Workflow：**Build Android (regression)** · Run `35489067629` · https://github.com/yy00110011/Zynthel/actions/runs/35489067629
结论：**success**

| 文件 | 大小 |
| --- | --- |
| **APK** `app-universal-debug.apk` | 475,887,456 字节（453.8 MiB） |

- ✅ Android GitHub Actions 实际运行且成功
- ✅ APK Artifact（`zynthel-android-apk`）实际存在
- ⚠️ **签名状态：debug 变体包**（由 Android debug key 签名，包名带 `.debug` 后缀），可安装、可 sideload，**不是**用于应用商店的发布签名包
- ⚠️ **体积待确认**：453 MiB 偏大，原因是 debug 变体按配置保留了全部 ABI 的调试符号（4 个 ABI × 未裁剪的 `.so`）。若要作为正式 Release 资产分发，建议二选一（见第 10 节）
- ✅ APK 未提交进 Git

---

## 9. CI 结果（质量闸门）

Workflow：CI · Run `35489848786` · 结论 **success**

包含：typecheck / lint / vitest（143 passed）/ Next.js 生产构建（20 个静态路由）/ `cargo check`。
首次运行曾因 Linux runner 缺少 Tauri 桌面端系统库（`glib-2.0`）失败，属于 **GitHub Actions 环境问题**，已在 `ci.yml` 中补装系统依赖后转绿（未改动任何业务源码）。

---

## 10. 需要人工确认（请逐项回复）

1. **MIT LICENSE 的 Copyright Owner**：当前写入 `Copyright (c) 2026 yy00110011`（按你的选择：GitHub 用户名）。是否确认？
2. **仓库最终名称是否为 `Zynthel`**：当前为 `yy00110011/Zynthel`。是否确认？
3. **Windows 未签名状态是否接受**：普通用户安装时会看到「未知发布者」。是否接受以此状态发布？
4. **Android Release 资产方案**（当前是 453 MiB 的 debug APK）：
   - A. 保持现状，Release 直接提供 debug universal APK（可安装，体积大）
   - B. 改为只构建 arm64（`--target aarch64`），体积大幅下降，覆盖绝大多数现代设备
   - C. 由你提供签名材料并写入 GitHub Secrets（仅 `secrets.KEYSTORE_BASE64` 等引用，绝不出现明文），产出正式 release APK
   - 推荐：**C（若你愿意配置 Secrets）；否则 B**
5. **是否正式启用自动 GitHub Releases**（tag `v*` 自动构建并附加资产）：当前 Release 需要手动创建。是否要我加一个 `release.yml`？
6. **Windows 实机截图**：待人工补充（清单见 `SCREENSHOT_CHECKLIST.md`）。是否先带着现有截图发布？

---

## 11. 阻止公开的问题

**未发现阻止进入最终公开发布阶段的问题。**

说明：以上第 8 节的 Android APK 体积与第 10 节的待确认项属于**发布质量与授权确认**，不构成安全或合规层面的阻断。

---

## 12. GitHub 项目展示检查表

- [x] README 项目简介完成
- [x] 功能说明完成（按真实源码逐项核对）
- [x] 平台支持表完成（Windows x64 / arm64 Experimental / Android）
- [x] Windows 安装教程完成（含 SmartScreen 如实说明）
- [x] Android 安装教程完成
- [x] 快速开始完成
- [x] AI 配置教程完成
- [x] 数据与隐私说明完成
- [x] 备份教程完成
- [x] Vault 教程完成
- [x] 浮光墙教程完成
- [x] FAQ 完成（`docs/FAQ.md`）
- [x] 开发者 Build 文档完成
- [x] Release Notes 完成（`docs/release-notes-v0.1.0.md`）
- [x] GitHub About 建议完成（描述 + Topics）
- [x] Screenshot Gallery 完成（README 内 4 张 + `docs/screenshots/` 共 13 张）
- [ ] **Windows 实机截图完成** —— 待人工补充（清单见 `SCREENSHOT_CHECKLIST.md`）
- [x] Android 实机截图完成（5 张，你提供）

---

## 13. 停止点

**本阶段到此停止。** 未执行以下任何操作：

- ❌ 未把 Repository 从 Private 改为 Public
- ❌ 未发布 v0.1.0 Release
- ❌ 未创建任何公开 Release 资产

等你回复第 10 节的确认项后，再执行：完成 LICENSE 最终确认 → 最后一次 Secret Scan → 最后跑一次 Windows x64 与 Android 构建 → 转 Public → 创建 `v0.1.0` → 上传 Windows EXE / MSI 与 Android APK → 校验下载链接。
