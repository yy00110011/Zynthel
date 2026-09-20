# Zynthel Architecture

本文解释 **Zynthel 为什么这样设计**，而不是罗列代码文件。

Zynthel 是一个 local-first 的个人工作台：一套前端与数据层，产出 Windows 桌面包与 Android APK 两个版本。设计上只有一条主线 —— **把数据和网络请求压到最小，把原生能力压到最小**。

## 1. Overall Architecture

```
┌─────────────────────────────────────────────┐
│  Next.js 16 / TypeScript（静态导出 out/）      │
│  页面 · 功能模块 · 数据层 · 加密 · AI 客户端     │
└───────────────────┬─────────────────────────┘
                    │ Tauri IPC（少量、白名单）
┌───────────────────▼─────────────────────────┐
│  Tauri 2 / Rust 原生层                        │
│  Windows：打开网址 · 启动本机应用（不执行 shell）│
│  Android：LaunchPlugin（枚举/启动应用、开网页） │
└─────────────────────────────────────────────┘
```

**为什么这样分层**：界面与业务逻辑是跨平台的，占绝大部分代码量；真正需要原生的只有「启动外部应用 / 网址」和「枚举已安装应用」这几件事。把原生层压到最小，意味着攻击面最小、两个平台的行为差异最小。

前端用 `output: "export"` 静态导出，Tauri 直接打包 `out/` —— 不需要 Node 运行时，也不需要任何服务端。

## 2. Frontend

- Next.js App Router + React，构建为纯静态站点（`trailingSlash: true`），Tauri 以 `frontendDist: ../out` 加载；
- 侧边栏固定导航，核心区与生活工具区分组；
- UI 图标全部来自 `lucide-react`（ISC），界面元素以几何图形与主题色块构成，不引入任何第三方素材；
- 主题为 CSS 变量驱动的 6 套内置主题，切换不重建数据。

## 3. Tauri / Rust

- Rust 侧只有三个命令：`launch_resource`、`detect_applications`、`list_android_apps`（外加 `find_local_app`）；
- CSP 在 `tauri.conf.json` 中收紧（`connect-src` 仅放开 `https:` 等必要来源）；
- capabilities 只给 `core:default`，不给多余权限；
- **Windows 上 `CustomCommand` 直接返回 `CommandNotAllowed`** —— 不存在任意命令执行入口。

## 4. Data Layer

- 单一数据源：workspace 对象（Zod schema 校验，版本号 `2`）存在 localStorage，键 `zynthel.workspace.open`；
- 所有写入先过 `workspaceSchema`，读写经 `workspaceRepository` 统一封装并带订阅通知；
- **先持久化再更新内存缓存** —— 写盘失败时错误向上传播，不会出现「界面显示已保存、实际没落盘」；
- schema 新字段一律给 `.default()`，旧数据可平滑迁移（项目曾整体更名，保留旧 key 的一次性迁移逻辑）。

## 5. IndexedDB

localStorage 有容量上限，装不下图片和书籍。分层策略：

| 数据 | 存放位置 |
| --- | --- |
| 工作区结构化数据、浮光墙缩略图（小 dataURL） | localStorage |
| 浮光墙原图（WebP Blob） | IndexedDB `zynthel-drift-wall/images` |
| 阅读器本地 PDF / EPUB 文件 | IndexedDB |

缩略图跟着 workspace 走，保证渲染同步；大对象只在需要时读取，避免一次性把整库拉进内存。

## 6. Crypto / Vault

- Web Crypto 原生实现：AES-GCM-256 + PBKDF2-SHA256，不引入第三方加密依赖；
- 迭代次数限制 100,000～1,000,000（防异常数据导致解锁卡死）；
- 密钥只存在于内存，**主密码不落盘** —— 代价是主密码遗忘无法找回，这一点在文档中对用户明说；
- password / url / note 使用各自独立的 IV；
- 支持自动锁定与解锁竞态处理。

**为什么不用更强的措辞宣传**：加密强度是可描述的（算法、参数、IV 策略），但「绝对安全」无法证明。文档只写实现事实，不做安全承诺。

## 7. AI

- 纯配置入口：名称 / Endpoint / API Key / Model，项目不内置任何服务与密钥；
- 请求由设备直连用户配置的服务商（OpenAI 兼容 `/chat/completions`），60 秒超时；
- baseUrl 只接受 http/https 且需合法 host。

**为什么不内置密钥**：内置即等于把私人凭据公开分发，也等于要运营一个后端 —— 与 local-first 直接冲突。

## 8. Windows Platform Layer

- 打开网址：`rundll32 url.dll,FileProtocolHandler`，参数以 `Command::new(...).arg(...)` 传入，不拼 shell 字符串；
- 启动本机应用：路径必须来自 Rust 侧扫描结果，不可手工伪造；
- 可执行命令白名单仅 `open` / `/usr/bin/open` / `codex`；
- 首页第三方快捷入口只用固定官方 HTTPS 地址，复用同一套 URL 校验。

## 9. Android Platform Layer

- Kotlin `LaunchPlugin`：`listInstalledApps`（App Picker）、`launchPackage`、`openUrl`、`isInstalled`；
- `QUERY_ALL_PACKAGES` 是枚举任意已安装应用的必要条件（包名无法预先穷举），列表仅本地使用；
- `openUrl` 只放行 http/https；枚举在 IO 协程执行，避免主线程 ANR；
- 项目定位 GitHub 开源 + sideload，**不按应用商店上架设计**。

## 10. Backup

- 整包备份为 ZIP（标记 `zynthel-full-backup`）：`workspace.json` + 书籍文件 + `drift-wall/` 图片；
- 导入先解压校验，再过 schema 与资源白名单，**失败整体拒绝并回滚**；
- 限额：ZIP ≤200MB；书籍 ≤500 个 / 单文件 ≤40MB / 总量 ≤150MB；浮光墙图片 ≤400 个 / 单文件 ≤8MB / 总量 ≤80MB；
- 另提供纯 JSON 的轻量导出导入。

**为什么这么设计**：备份是用户唯一的数据自救手段，所以导入必须「要么全成、要么全不」；限额是为了防止异常或恶意备份在移动端触发 OOM。

## 11. DriftWall

- 缩略图（长边 192px）存 workspace，原图（长边 1024px，WebP）存 IndexedDB；
- 上传只认 `image/png` / `image/jpeg` / `image/webp`，单张 ≤10MB、源图 ≤4000 万像素；
- 坐标归一化存储，窗口缩放不跑位；动画用 CSS transform，尊重 `prefers-reduced-motion`；
- 渲染时二次校验（只渲染 `data:image/` 前缀），防被篡改数据注入外链。

## 12. Security Boundaries

| 边界 | 做法 |
| --- | --- |
| 原生命令 | Windows 禁止任意命令执行；可执行名白名单 |
| URL | Rust 用 `url` crate 严格解析，仅 http/https + 合法 host；Kotlin 侧 scheme 白名单 |
| 用户输入进入 shell | 不发生（一律 `Command::new().arg()`，不拼字符串） |
| 图片 | MIME 白名单 + 降采样 + 渲染前缀校验 + 备份限额 |
| 备份导入 | schema 校验 + 资源白名单 + 限额 + 失败回滚 |
| 密钥 | 不内置任何密钥；用户 AI Key 存本机应用存储（非系统密钥库，文档已说明） |
| 权限 | capabilities 仅 `core:default`；Android 仅 INTERNET + QUERY_ALL_PACKAGES |

## 13. Build & Release

```
Windows：源码 → GitHub Actions (windows-latest) → pnpm tauri build --bundles nsis,msi → EXE + MSI
Android：源码 → GitHub Actions (ubuntu-latest) → JDK17 + SDK36 + NDK27 → tauri android build --apk → APK
CI     ：typecheck → lint → vitest → next build → cargo check
```

- Windows x64 为主目标，arm64 为 Experimental（`continue-on-error`，失败不阻塞 x64）；
- 安装包 / APK 只作为 Actions Artifact 与 Release 资产，**不进 Git**；
- 签名材料（`.jks`、`keystore.properties`）从不入库，Release 签名只能走 GitHub Secrets 或本地签名；
- 当前 Windows 包未做商业代码签名 —— 这是已知的分发限制，不以降低系统安全性来规避。
