# Zynthel

**本地优先个人工作台** —— 一个把所有数据留在你自己设备上的单机工作台，整合任务、项目、日历、笔记、专注、工具、AI 对话，以及 8 个生活工具模块。

当前开源 **两个版本**，共用同一套前端、数据层与业务逻辑：

| 平台 | 形态 | 包名 / 标识 | 状态 |
| --- | --- | --- | --- |
| Windows | NSIS `.exe` 安装包 + `.msi` 安装包 | `com.zynthel.workspace` | x64 为主目标；arm64 为实验性构建，失败不阻塞 x64 |
| Android | `.apk` | `com.zynthel.workspace` | minSdk 24 / targetSdk 36；定位为 GitHub 开源 + sideload |

> **核心原则**：数据全本地存储 · 无云端后端 · 无内置密钥 · 侧边栏固定导航 · 最小原生权限。

---

## 给普通用户：怎么装

### Windows

1. 到本仓库 Releases 页面，下载 `Zynthel_<版本>_x64-setup.exe`（NSIS 安装包）或 `Zynthel_<版本>_x64_en-US.msi`。
2. 双击安装。**Windows 会提示“未知发布者 / SmartScreen 已阻止”** —— 本项目没有商业代码签名证书，所以安装包是**未签名**的，这是已知的分发限制。请点击「更多信息 → 仍要运行」继续，并自行核对发布页给出的文件校验值。
3. 卸载：Windows「设置 → 应用」中正常卸载即可。

> 不要为了绕过这个提示去降低 Windows 的安全设置或关闭 SmartScreen。

### Android

1. 到 Releases 页面下载 `.apk`。
2. 在手机上允许「未知来源安装」，然后安装。
3. 本项目**不在 Google Play 上架**：App Picker 需要 `QUERY_ALL_PACKAGES` 权限，属于 Play 的受限权限；项目定位是自编译 / sideload 分发。

---

## 功能特性

- **侧边栏固定导航**：核心区（首页 / 浮光墙 / 任务 / 项目 / 日历 / 笔记 / 专注 / 工具 / AI / 设置）+ 生活工具区，两区分组展示。
- **浮光墙（DriftWall）**：个人动态图片墙，图片存于本机 IndexedDB，自由摆放、漂浮动效，支持整包备份；尊重系统「减弱动态效果」设置。
- **日历内置节日与待办**：中国传统节日 + 法定节假日徽标，可在日历格内直接编辑待办。
- **生活工具 8 项**：记账本、健身打卡、日记、课程表、习惯打卡、倒数日、阅读清单、密码本，全部本地持久化；密码本采用本地主密码加密（Web Crypto AES-GCM + PBKDF2）。
- **内置阅读器**：支持本地 PDF / EPUB 阅读，文件存于本机 IndexedDB。
- **完整数据备份**：可导出整包备份（JSON + 图片目录），导入时走同一套白名单与限额校验。
- **AI 纯配置入口**：不内置任何 AI 服务、端点或密钥；你自己填接口地址、API Key、模型标识即可接入任意 OpenAI 兼容服务，支持多模型、对话历史本地存储、Markdown 渲染。

---

## 环境要求（仅开发者需要）

| 依赖 | 版本 |
| --- | --- |
| Node.js | 20.9+（推荐 22） |
| pnpm | 11（仓库已锁定 `packageManager`） |
| Rust | stable（Tauri 2 后端） |
| Android SDK | compileSdk / targetSdk 36 |
| Android NDK | 27.x |
| JDK | 17 |

## 从源码构建

### 1. 公共步骤

```bash
pnpm install --frozen-lockfile
```

### 2. 浏览器开发模式（不开 Tauri，最快）

```bash
pnpm dev
# 打开 http://127.0.0.1:3000
```

### 3. Windows 安装包（需在 Windows 上执行）

```bash
pnpm tauri build --bundles nsis,msi
```

产物：

```text
src-tauri/target/release/bundle/nsis/Zynthel_0.1.0_x64-setup.exe
src-tauri/target/release/bundle/msi/Zynthel_0.1.0_x64_en-US.msi
```

如需 arm64（实验性）：

```bash
pnpm tauri build --target aarch64-pc-windows-msvc --bundles nsis,msi
```

### 4. Android APK

```bash
export ANDROID_HOME=<android-sdk>
export NDK_HOME=$ANDROID_HOME/ndk/27.0.12077973
export NEXT_PUBLIC_TARGET_PLATFORM=android

pnpm tauri android build --apk --debug     # debug 变体，无需密钥
```

产物：

```text
src-tauri/gen/android/app/build/outputs/apk/**/*.apk
```

**签名**：若要用自己的密钥产出 release 包，在 `src-tauri/gen/android/keystore.properties` 中配置 `storeFile` / `storePassword` / `keyAlias` / `keyPassword`，Gradle 会在 release 构建时自动签名。该文件与 `*.jks` **已在 `.gitignore` 中排除，永远不会进入仓库**。

### 5. 验证

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

---

## 自动化构建（GitHub Actions）

| Workflow | 触发 | 产出 |
| --- | --- | --- |
| `ci.yml` | push / PR | typecheck、lint、vitest、Next.js 生产构建、cargo check |
| `build-windows.yml` | 手动 / `v*` tag | Windows x64 的 `.exe` + `.msi`（artifact）；arm64 为实验性、`continue-on-error`，失败不阻塞 x64 |
| `build-android.yml` | push / PR / 手动 | Android debug APK（regression 闸门，保证 Windows 改造不破坏 Android） |

Windows x64 与 Android 均通过后才发布 Release。

---

## 数据与隐私

Zynthel 是 **local-first** 单机应用：

- 工作区数据（任务、项目、笔记、生活工具、密码本、AI 配置与对话记录）默认保存在**你的设备本地**（Web 视图 localStorage / IndexedDB）；
- 项目**不运营任何云后端**，维护者默认不会收到你的工作区数据；
- 你主动调用第三方 AI API 时，请求会**直接**发往你自己选择的服务商；
- 第三方服务的数据处理受其自己的条款与隐私政策约束。

> **关于 AI API Key**：密钥保存在设备本地应用存储中，属于应用数据级存储，**并非**操作系统安全密钥库（Keystore / DPAPI / Keychain）级别的保护。请勿在不受信任的设备上配置高价值密钥。

> **关于密码本**：主密码只用于派生内存中的密钥，不落盘，因此主密码遗忘后**无法找回**，请自行备份。

## 权限说明（Android）

- **`INTERNET`**：仅用于你自己配置的 AI 模型接口调用。
- **`QUERY_ALL_PACKAGES`**：仅用于「应用跳转 / App Picker」枚举本机已安装应用，**不会收集、上传应用列表**。该权限是 Android 11+ 枚举完整应用列表所必需的，也正因如此本项目不做应用商店上架。

## AI 功能说明

本项目**仅提供通用配置入口**，需你自行配置 API 接口地址与密钥。项目不提供任何云端 AI 服务，不内置任何端点、密钥或代理账户。你接入什么 API 就使用什么模型，完全自主。

Zynthel allows users to configure third-party API endpoints. The project does not provide, resell, or proxy third-party API accounts or API keys. When a user configures and uses a third-party API, requests are sent directly to the service selected by the user. Use of that service is subject to the applicable provider's terms, policies, pricing, and privacy practices. Zynthel is not affiliated with, endorsed by, or sponsored by any third-party service provider unless explicitly stated otherwise.

---

## 项目结构

```text
src/                     # Next.js 前端（静态导出到 out/）
├── app/                 # 路由页面
├── features/            # 功能模块（data / ai / calendar / drift-wall / life ...）
└── lib/                 # 运行时、平台检测、启动器
src-tauri/               # Rust 后端（Tauri 2）
├── src/                 # launch.rs（原生命令 + URL 校验）/ lib.rs / main.rs
├── gen/android/         # Android 工程（Kotlin + Gradle）
├── icons/               # 应用图标（项目自有素材）
└── tauri.conf.json      # 应用标识 / CSP / 打包目标
.github/workflows/       # CI、Windows 构建、Android 构建
```

## 贡献

详见 [CONTRIBUTING.md](CONTRIBUTING.md)。提交前请确保不包含任何密钥、签名材料、二进制产物或个人数据。

## 安全

详见 [SECURITY.md](SECURITY.md)。发现漏洞请通过 Private Security Advisory 私下报告，不要在公开 Issue 贴可利用细节。

## 商标

`Zynthel` 为本项目名称，已做过公开资料的初步商标检索（见 `docs/trademark-clearance-research.md`）。该检索为事实收集，**不构成法律意见**，也不保证可在任何司法辖区注册。

## 免责声明

本项目按 MIT 协议分发，**不提供任何担保**。使用者自行编译、自行承担使用风险。

## 开源协议

[MIT License](LICENSE) · 第三方依赖见 [NOTICE.md](NOTICE.md) · 贡献指南见 [CONTRIBUTING.md](CONTRIBUTING.md)
