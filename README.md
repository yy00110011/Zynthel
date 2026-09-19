# SOLARIS

**本地优先个人工作台** — 面向 Android 平板（16:9 横屏）的本地优先工作台，整合任务、项目、日历、笔记、专注、工具、AI 对话，以及记账本、健身打卡、日记、课程表、习惯打卡、倒数日、阅读清单、密码本共 8 个生活工具模块。

> **核心原则**：数据全本地存储 · 无云端服务 · 无内置密钥 · 国内环境优先适配 · 侧边栏固定导航 · 全量版权合规。

## 功能特性

- **侧边栏固定 17 项导航**：核心办公区（首页/任务/项目/日历/笔记/专注/工具/AI/设置）+ 生活工具区（记账本/健身打卡/日记/课程表/习惯打卡/倒数日/阅读清单/密码本），两区分组展示，仅可调序。
- **AI 纯配置入口**：不内置任何 AI 服务、端点或密钥；用户自行填写接口地址、API 密钥、模型标识即可接入任意服务，支持多模型、对话历史本地存储、Markdown 渲染。
- **8 个生活工具**：全部本地持久化，密码本采用本地主密码加密（Web Crypto AES-GCM）。
- **本地优先**：所有数据存于本机 WebView 的 localStorage，不上传任何服务器，不收集任何个人隐私信息。

## 环境要求

| 依赖 | 版本 |
| --- | --- |
| Node.js | 20.9+（推荐 22） |
| pnpm | 11+ |
| Rust | stable（用于 Tauri 后端） |
| Android SDK | API 34+ |
| Android NDK | 27.x |
| Tauri CLI | 2.x |

## 构建与运行

### 浏览器开发模式

```bash
pnpm install
pnpm dev
```

打开 [http://127.0.0.1:3000](http://127.0.0.1:3000)。

### 生成静态前端

```bash
pnpm build
```

### Android APK 打包

```bash
export ANDROID_HOME=<android-sdk>
export NDK_HOME=$ANDROID_HOME/ndk/27.0.12077973
export NEXT_PUBLIC_TARGET_PLATFORM=android

pnpm tauri android init     # 首次，生成 src-tauri/gen/android
pnpm tauri android build --apk --target aarch64
```

产物位置：

```text
src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release.apk
```

签名：在 `src-tauri/gen/android/keystore.properties` 中配置 `storeFile` / `storePassword` / `keyAlias` / `keyPassword`，Gradle 会在 release 构建时自动签名。该文件与 `*.jks` 均已在 `.gitignore` 中排除。

## 验证

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## 本地数据

工作区数据存储在 WebView/localStorage 的 `solaris.workspace.open` 中。通过「设置 → 数据」导出 JSON 备份，导入时通过完整校验后替换当前数据。

## 权限说明

- **网络（INTERNET）**：用于你自行配置的 AI 模型接口调用。
- **查询已安装应用（QUERY_ALL_PACKAGES）**：仅用于列出本机已安装应用以实现应用跳转，**不会收集、上传应用列表**。

> ⚠️ **上架提示**：本项目含 `QUERY_ALL_PACKAGES` 权限，无法提交应用商店，仅支持本地编译安装。

## AI 功能说明

本项目**仅提供通用配置入口**，需用户自行配置 API 接口地址与密钥。官方不提供任何云端 AI 服务，不内置任何端点、密钥或境外服务。用户接入什么 API 即使用什么模型，完全自主。

SOLARIS allows users to configure third-party API endpoints. The project does not provide, resell, or proxy third-party API accounts or API keys. When a user configures and uses a third-party API, requests are sent directly to the service selected by the user. Use of that service is subject to the applicable provider's terms, policies, pricing, and privacy practices. SOLARIS is not affiliated with, endorsed by, or sponsored by third-party service providers unless explicitly stated otherwise.

## 数据与隐私（Data & Privacy）

SOLARIS is local-first：

- 工作区数据（任务、项目、笔记、生活工具、密码本、AI 配置与对话记录）默认保存在用户设备本地；
- 项目本身不运营 Zynthel 云后端，项目维护者默认不会收到用户的工作区数据；
- 用户主动调用第三方 AI API 时，相应请求会发送给用户选择的服务商；
- 第三方服务的数据处理受其自己的条款和隐私政策约束。

> **关于 AI API 密钥**：API Key 保存在设备本地应用存储（localStorage）中，属于应用数据级存储，并非操作系统安全密钥库（如 Keystore/Keychain）级别保护。请勿在不受信任的设备上配置高价值密钥。

## 免责声明

本项目为开源学习项目，按 MIT 协议分发，不提供任何担保。使用者自行编译 APK，自行承担使用风险。

## 开源协议

本项目基于 [MIT License](LICENSE) 分发。第三方依赖列表见 [NOTICE.md](NOTICE.md)，贡献指南见 [CONTRIBUTING.md](CONTRIBUTING.md)。
