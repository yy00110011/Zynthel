# SOLARIS 开源版 —— 后端代码审查清单

> 本文档用于提交给外部 AI / 开发者进行代码安全审查。
> 项目：本地优先个人工作台（Tauri 2 + Next.js），Android 优先。

## 一、代码结构总览

```
src-tauri/                          # Rust 后端（原生能力层）
├── src/
│   ├── main.rs                     # 入口（3 行，仅调用 run）
│   ├── lib.rs                      # 插件注册 + 命令处理器注册（核心）
│   └── launch.rs                   # 启动外部应用/网址的命令实现（含校验逻辑）
├── Cargo.toml                      # 依赖声明
├── build.rs                        # Tauri 构建脚本
└── tauri.conf.json                 # 应用配置（identifier / CSP / 权限）

src/features/data/                  # 数据层（TypeScript）
├── schema.ts                       # Zod schema（工作区数据模型）
├── repository.ts                   # localStorage 读写 + 订阅
├── crypto.ts                       # 密码本加密（AES-GCM + PBKDF2）
├── ai-schema.ts                    # AI 配置 schema
├── life-schema.ts                  # 生活工具 schema
└── transfer.ts                     # 数据导入导出

src/features/ai/                    # AI 能力
├── ai-client.ts                    # OpenAI 兼容协议客户端（前端直连）
└── chat.tsx                        # 对话页 UI
```

## 二、重点审查文件（按风险优先级）

### 🔴 P0 —— 原生命令层（Rust，安全边界）

**1. `src-tauri/src/launch.rs`**（279 行，最重要）

这是唯一与"外部系统"交互的层，审查重点：

- `validate_url()`：URL 校验，只允许 `http://` / `https://`
- `validate_argument()`：拒绝控制字符（`\0`、`\n`、`\r`）
- `validate_path()`：拒绝相对路径（`../`）
- `validate_executable()`：白名单，只允许 `open` / `/usr/bin/open` / `codex`
- `launch_resource()`：所有启动命令的统一入口

**2. `src-tauri/src/lib.rs`**（40 行）

- Android 插件注册：`register_android_plugin("com.solaris.opensource", "LaunchPlugin")`
- 命令注册：`launch_resource` / `detect_applications` / `list_android_apps`

**3. Android 原生插件（Kotlin）**

`src-tauri/gen/android/app/src/main/java/com/solaris/opensource/LaunchPlugin.kt`

- `launchPackage`：启动第三方应用（含 fallback URL）
- `openUrl`：打开网址
- `listInstalledApps`：枚举已安装应用
- `isInstalled`：检测应用是否安装

### 🟡 P1 —— 数据与加密层（TypeScript）

**4. `src/features/data/crypto.ts`**（132 行）

密码本加密实现：
- AES-GCM 256 + PBKDF2-SHA256
- 密钥仅存内存（CryptoKey），不落盘
- `deriveKey` / `encryptText` / `decryptText` / `verifyMasterPassword`
- `generatePassword`：随机密码生成（`bytes[i] % pool.length` 有**模偏差**，需评估）

**5. `src/features/data/repository.ts`**（50 行）

- localStorage 读写 + `structuredClone`
- `workspaceSchema.safeParse` 校验
- 订阅机制（listener set）

**6. `src/features/ai/ai-client.ts`**（53 行）

- OpenAI 兼容协议客户端
- 前端直连用户配置的接口
- `baseUrl` 拼接 `+ "/chat/completions"`
- 错误处理

## 三、已知/疑似问题点（供审查确认）

1. **【已修复】** `lib.rs` 插件注册包名旧值 `com.solaris.personal_terminal` → 已改为 `com.solaris.opensource`
2. **【已修复】** 重新 `tauri android init` 导致手写 `LaunchPlugin.kt` 丢失 → 已补回
3. **【已修复】** `Cargo.toml` 的 `license` / `repository` 已补 `MIT` + 占位仓库地址
4. **【待审查·重要】** 原生层（`launch.rs` + `LaunchPlugin.kt`）停留在 **v3**，缺以下六项加固（历史审计记录里的 v4/v5 加固代码未落在当前仓库，全盘搜索已确认）：
   - `call()` 用 `unwrap_or(true)`，异常响应会被误判为成功
   - `validate_url` 用字符串前缀判断，未用 `Url::parse` 严格校验
   - `list_android_apps` 返回裸 `Vec`，错误被吞成 `[]`
   - `LaunchPlugin.openUrl` 无 `ALLOWED_SCHEMES` scheme 白名单
   - `listInstalledApps` 跑主线程，有 ANR 风险
   - `iconToBase64` 的 `bitmap.recycle()` 不在 `finally` 里
5. **【待审查】** `crypto.ts` 的 `generatePassword` 用 `% pool.length` 存在模偏差
6. **【待审查】** `ai-client.ts` 直连用户配置的 URL，无请求超时、无重试、无流式支持
7. **【待审查】** `repository.ts` 的 `set()` 用 `workspaceSchema.parse`（会 throw），若前端传入非法数据会抛异常而非降级

## 四、安全要点总结

- ✅ URL 强制 `http/https`，拒绝 `file://`、`javascript:` 等
- ✅ 拒绝控制字符注入
- ✅ 可执行命令白名单（非 Android）
- ✅ 密码本用 Web Crypto 原生加密，密钥不落盘
- ✅ 无硬编码 API 密钥 / 端点
- ⚠️ 密码生成器有轻微模偏差（影响弱）
- ⚠️ AI 请求无超时控制

## 五、如何运行审查

```bash
# Rust 后端（需安装 cargo + Android targets）
cd src-tauri && cargo clippy --all-targets -- -D warnings

# TypeScript 业务逻辑
pnpm typecheck && pnpm lint && pnpm test
```
