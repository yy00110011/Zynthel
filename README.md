# Zynthel

> 一个面向 Windows 与 Android 的本地优先个人工作台。

![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Android-4a9d9f)
![Framework](https://img.shields.io/badge/Tauri-2-24c8db)
![Frontend](https://img.shields.io/badge/Next.js-16-111827)
![License](https://img.shields.io/badge/license-MIT-green)

**Zynthel 把任务、项目、日历、笔记、专注、阅读、密码本和 8 个生活工具收进一个界面，所有数据都保存在你自己的设备上 —— 没有账号，没有云端，没有内置密钥。**

---

## ✨ Zynthel 是什么？

Zynthel 是一个 **local-first** 的个人工作台：日常要用的一堆小工具被集中到一个统一的界面里，而不是散落在十几个应用之间。

它没有账号体系，也不连接任何后端服务器 —— 打开就能用，数据只存在你的设备本地。想用 AI 的话，填入你自己的接口配置即可，Zynthel 本身不内置任何 AI 服务或密钥。

当前开源两个版本：**Windows**（EXE / MSI 安装包）与 **Android**（APK），两者共用同一套界面与数据层。

## 📸 界面预览

| 首页（Android 真机） | 浮光墙 |
| --- | --- |
| ![首页](docs/screenshots/android-home.jpg) | ![浮光墙](docs/screenshots/drift-wall.png) |

| 日历 | 主题与外观 |
| --- | --- |
| ![日历](docs/screenshots/calendar.png) | ![主题](docs/screenshots/android-settings.jpg) |

更多截图见 [docs/screenshots/](docs/screenshots/)。

## 🚀 功能

### 工作台
首页集中展示今日任务、即将到来的日程、最近项目与专注计时器，点一下就能跳到对应页面。

### 任务
管理个人任务与计划，支持优先级、状态流转、标签、重复与截止日期。

### 日历
月视图 + 中国传统节日与法定节假日徽标，点击日期格可以直接添加待办，并与任务模块同步。

### 笔记与项目
自由记录笔记，按项目归档，项目支持进度、标签与状态。

### 专注
番茄钟式专注计时，会话记录可在首页回顾。

### 阅读
内置阅读清单管理想读 / 在读 / 已读，支持添加本地 PDF / EPUB 文件在应用内直接阅读。

### 浮光墙
一个属于你自己的图片墙：图片以圆形呈现，可自由拖动摆放，带轻微的漂浮动效（尊重系统「减弱动态效果」设置）。

### 密码本
本地主密码加密的敏感信息管理，采用 Web Crypto（AES-GCM + PBKDF2），不引入第三方加密依赖。

### 生活工具
记账本、健身打卡、日记、课程表、习惯打卡、倒数日、阅读清单、密码本 —— 8 个小工具，全部本地存储。

### AI（可选）
纯配置入口：填入你自己的接口地址、API Key 与模型标识即可接入任意 OpenAI 兼容服务。Zynthel 不内置任何 AI 服务，也没有开发者的私人密钥。

### 主题
内置 6 套主题：默认、砚蓝、玫雾、樱杏、月霜、苔桃，一键切换。

## 💻 平台支持

| 平台 | 状态 | 安装方式 |
| --- | --- | --- |
| Windows x64 | 支持 | EXE / MSI（GitHub Releases） |
| Windows ARM64 | Experimental | Release（构建失败不阻塞 x64） |
| Android（ARM64 等） | 支持 | APK（GitHub Releases / sideload） |

## 📥 下载

**普通用户不需要下载 Source code，也不需要安装任何编译工具。**

1. 打开本仓库的 [Releases](../../releases) 页面；
2. 按平台下载：

| 平台 | 推荐文件 |
| --- | --- |
| Windows | `Zynthel_<版本>_x64-setup.exe`（也可选 `.msi`） |
| Android | `Zynthel_<版本>.apk` |

> Source code (zip / tar.gz) 是给开发者的源码，不是安装包。

## 🪟 Windows 安装

1. 到 [Releases](../../releases) 下载最新版 `Zynthel_<版本>_x64-setup.exe`；
2. 双击运行安装向导；
3. 安装完成后从开始菜单启动 Zynthel。

> **关于「未知发布者」提示**：本项目目前没有商业代码签名证书，Windows SmartScreen 可能会显示「Windows 已保护你的电脑」。请点击「更多信息」→「仍要运行」继续。这是已知限制，请自行核对 Release 页面提供的文件信息后再安装。**不建议**为此关闭 Windows Defender 或 SmartScreen。

**EXE 和 MSI 的区别**：两者都是 Windows 安装包，安装的是同一个软件。普通用户用 `.exe` 即可；`.msi` 适合偏好 MSI 的用户与企业部署场景。

## 🤖 Android 安装

1. 到 [Releases](../../releases) 下载最新版 `.apk`；
2. 打开时系统可能询问「是否允许此来源安装应用」，按你设备的设置完成授权；
3. 安装并启动 Zynthel。

> 本项目**不在 Google Play 上架**：应用跳转功能需要 `QUERY_ALL_PACKAGES` 权限，属于 Play 受限权限。项目定位为 GitHub 开源 + sideload 分发。无需 Root，也无需关闭 Play Protect。

## 🚀 快速开始

### 1. 打开 Zynthel
首次启动会进入首页工作台，上方是问候语与今日概览，右侧是专注计时器。

### 2. 创建第一个任务
进入「任务」，点右上角「+」新建，填标题、选优先级即可；设置了截止日期的任务会出现在首页「今日任务」里。

### 3. 用日历安排事情
进入「日历」，点击任意日期格可以直接添加待办；中国节日与法定节假日会以徽标显示。

### 4. 换个主题
「设置 → 外观」里可以切换 6 套内置主题。

### 5.（可选）配置 AI
AI 不是使用 Zynthel 的必要条件 —— 不配置时，其余本地功能全部可用。需要时见下节。

## 🤖 AI 配置（可选）

「设置 → AI 模型配置」中添加模型：

| 字段 | 说明 |
| --- | --- |
| 名称 | 随便起，用于在界面里区分多个模型 |
| 接口地址 | 你的 OpenAI 兼容服务地址，如 `https://api.example.com/v1` |
| API 密钥 | 你自己的密钥，例如 `YOUR_API_KEY`（仅保存在本机） |
| 模型标识 | 你要调用的模型名，例如 `gpt-4o` |

Zynthel 不内置任何服务商，也不内置任何密钥；请求由你的设备直接发往你配置的服务商。密钥保存在本机应用存储中，**不是**操作系统密钥库级别保护，请勿在不受信任的设备上填高价值密钥。

## 🔐 数据与隐私

- Zynthel 是 **local-first** 单机应用：任务、笔记、生活工具、密码本、AI 配置与对话记录默认保存在**你的设备本地**（应用 WebView 的 localStorage / IndexedDB）；
- 项目**不运营任何云后端**，维护者默认不会收到你的工作区数据；
- 你主动使用 AI 功能时，请求会**直接**发往你自己配置的服务商，受其条款与隐私政策约束；
- 项目不收集、不上传任何统计数据。

## 💾 备份与恢复

「设置 → 数据」中可以导出/导入**整包备份**：

- 备份内容：全部工作区数据（任务 / 项目 / 笔记 / 生活工具 / AI 配置与对话 / 设置等）+ 浮光墙图片 + 阅读清单中的本地书籍文件；
- 导入时会做完整校验（schema、图片格式白名单、数量与大小限额），校验失败会整体拒绝，不会写入一半的数据；
- 建议定期导出备份并保存在你信任的位置（网盘 / 移动硬盘均可，备份文件本身就是普通 ZIP）。

## 🔑 密码本

- 首次进入「密码本」时设置**主密码**，之后每次进入需要解锁；
- 加密使用 Web Crypto：AES-GCM-256 + PBKDF2-SHA256，密钥只存在于内存，不落盘；
- 解锁后可手动锁定，或按设置中的自动锁定时间退出；
- **主密码遗忘无法找回** —— 项目不保存主密码，也没有任何恢复途径，请务必自己记住或妥善保管。

## 🌌 浮光墙

- 首次进入会生成 8 个空白占位圆，点击空白圆或右上角「添加图片」选择本地图片；
- 支持格式：PNG / JPEG / WebP；单张 ≤10MB，过大图片会自动降采样（长边 1024px）后以 WebP 存入本机 IndexedDB；
- 拖动即可自由摆放（坐标按比例存储，窗口大小变化不跑位）；通过右键菜单可以更换图片、调整大小、移除；
- 「尊重系统设置」：开启系统「减弱动态效果」后漂浮动画会自动停止。

## ❓ FAQ

更多问题见 [docs/FAQ.md](docs/FAQ.md)。

**Windows 下载哪个文件？** 普通 x64 用户下载 `Zynthel_<版本>_x64-setup.exe`。`.msi` 是同一软件的另一种安装方式。

**为什么显示「未知发布者」？** 安装包未做商业代码签名。详见上文 Windows 安装说明。

**必须配置 AI 才能用吗？** 不需要。AI 是可选功能，不配置时其余功能完整可用。

**我的数据存在哪里？** 全部在本机（应用 WebView 的 localStorage / IndexedDB），不上传任何服务器。

## 🛠️ 从源码构建

开发者才需要这一节；普通用户请直接从 Releases 下载。

**依赖**：Git、Node.js 20.9+（推荐 22）、pnpm 11（仓库已锁定 `packageManager`）、Rust stable（Tauri 2 后端）。

**Windows 额外需要**：Visual Studio C++ Build Tools、Windows SDK、WebView2 Runtime。
**Android 额外需要**：JDK 17、Android SDK（compileSdk/targetSdk 36）、Android NDK 27.x、Tauri Android 环境。版本以 `package.json` / `src-tauri/Cargo.toml` / `src-tauri/gen/android/` 与 GitHub Actions 中的实际配置为准。

```bash
# 1. 安装依赖
pnpm install --frozen-lockfile

# 2. 浏览器开发模式（不开 Tauri，最快）
pnpm dev            # http://127.0.0.1:3000

# 3. Windows 安装包（需在 Windows 上执行）
pnpm tauri build --bundles nsis,msi
# 产物：
#   src-tauri/target/release/bundle/nsis/Zynthel_0.1.0_x64-setup.exe
#   src-tauri/target/release/bundle/msi/Zynthel_0.1.0_x64_en-US.msi

# 4. Android APK
export ANDROID_HOME=<android-sdk>
export NDK_HOME=$ANDROID_HOME/ndk/27.0.12077973
pnpm tauri android build --apk --debug
# 产物：src-tauri/gen/android/app/build/outputs/apk/**/*.apk

# 5. 验证
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

Android release 签名：在 `src-tauri/gen/android/keystore.properties` 配置 `storeFile` / `storePassword` / `keyAlias` / `keyPassword`（该文件与 `*.jks` 均已在 `.gitignore` 中排除，**永远不要提交**）。

## 📁 项目结构

```text
Zynthel
├── src/                  # Next.js 前端（静态导出）
│   ├── app/              # 路由页面
│   ├── features/         # 功能模块（data / calendar / drift-wall / life ...）
│   └── lib/              # 运行时与平台检测、启动器
├── src-tauri/            # Tauri 2 / Rust 后端
│   ├── src/              # 原生命令（URL 校验、应用启动）
│   ├── gen/android/      # Android 原生工程（Kotlin + Gradle）
│   └── icons/            # 应用图标（项目自有素材）
├── public/               # 静态资源
├── docs/                 # 文档与截图
└── .github/workflows/    # CI / Windows 构建 / Android 构建
```

## 🤝 贡献

详见 [CONTRIBUTING.md](CONTRIBUTING.md)。提交前请确保不包含任何密钥、签名材料、二进制产物或个人数据。

## 🔒 安全

详见 [SECURITY.md](SECURITY.md)。发现漏洞请通过 Private Security Advisory 私下报告，不要在公开 Issue 贴可利用细节。

## 📄 许可与商标

[MIT License](LICENSE) · 第三方依赖见 [NOTICE.md](NOTICE.md)

`Zynthel` 已做过公开资料的初步商标检索（见 [docs/trademark-clearance-research.md](docs/trademark-clearance-research.md)）；该检索为事实收集，不构成法律意见。

## ⚠️ 免责声明

本项目按 MIT 协议分发，**不提供任何担保**。使用者自行编译、自行承担使用风险。
