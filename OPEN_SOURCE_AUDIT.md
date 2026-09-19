# Zynthel Open Source Release Audit

> 本报告基于代码、许可证、资源来源、仓库扫描和 Git 历史的工程审计结果。
> 对于无法仅凭代码审计确认的法律事项（商标、具体司法辖区合规），一律标记为
> `LEGAL REVIEW REQUIRED`，不擅自宣称为「100% 法律合规」。

---

## 1. License

**PASS**

- 根目录存在 `LICENSE`，为标准完整 MIT License 文本。
- 版权声明：`Copyright (c) 2026 SOLARIS Project Contributors`（真实、适当的集体署名，未虚构公司/组织）。
- `src-tauri/Cargo.toml` 声明 `license = "MIT"`，与根目录 LICENSE 一致。
- `package.json` 已声明 `"license": "MIT"`，与 LICENSE 一致。
- `README.md` 声明「基于 MIT License 分发」。
- 四者（LICENSE / Cargo.toml / package.json / README）无许可证冲突。

## 2. Third-Party Dependencies

**PASS**

已扫描全部生产依赖，无 copyleft 许可证（GPL/AGPL/LGPL/MPL/EPL/SSPL/BUSL/Commons Clause/Non-Commercial/No-Derivatives/Source-Available 均未发现）。

运行时依赖（npm）：

| Package | Version | License | Compatibility |
| --- | --- | --- | --- |
| next | latest | MIT | ✅ permissive |
| react | latest | MIT | ✅ permissive |
| react-dom | latest | MIT | ✅ permissive |
| zod | latest | MIT | ✅ permissive |
| lucide-react | latest | ISC | ✅ permissive |
| framer-motion | latest | MIT | ✅ permissive |
| @tauri-apps/api | ^2.11.1 | Apache-2.0 OR MIT | ✅ permissive |

Rust 依赖（Cargo.toml）：serde、serde_json、log、url、tauri、tauri-plugin-log —— 均为 MIT / Apache-2.0 permissive 许可证。

完整第三方许可证列表与 attribution 已记录于 `NOTICE.md`。

## 3. Third-Party Assets

**PASS**

- `public/` 目录为空（无任何静态图片资源）。
- 无 `characters/`、`backgrounds/`、`wallpapers/`、`app-icons/` 目录。
- 无动漫角色、游戏 CG、官方立绘、第三方壁纸、第三方 Logo、网络下载图片。
- 界面全部使用纯几何图形与 CSS 主题色块。

## 4. Fonts

**PASS**

- 仓库内无任何字体文件（ttf / otf / woff / woff2 均为 0）。
- 应用使用系统默认字体，不打包任何商用或禁止再分发的字体。

## 5. Icons / Logos

**PASS**

- UI 图标全部来自 `lucide-react`（ISC 许可证，Tabler Icons 风格）。
- 应用图标为 Tauri 默认生成的图标（`src-tauri/icons/`），不含第三方商标字形。
- 无第三方品牌 Logo 被用作项目组成部分。

## 6. Secrets

**PASS**

- 全仓库（当前工作树 + Git 历史）扫描，未发现硬编码 API Key、Token、私钥（`BEGIN PRIVATE KEY`）、`sk-`、`AIza`、Bearer 凭据、密码等。
- 签名密钥 `solaris-open-release.jks` 位于 `src-tauri/gen/android/`，已被 `.gitignore` 排除，**从未进入 Git 历史**。
- `keystore.properties`、`local.properties`、`.env`、`.env.local`、`.pem`、`.key` 均已在 `.gitignore` 排除。

## 7. Git History

**PASS**

- Git 历史中从未提交过 `.jks`、`.keystore`、`keystore.properties`、`.env`、`.pem`、`.apk`、`local.properties` 等敏感文件。
- 历史中仅含源码与配置（package.json / tsconfig.json / tauri.conf.json / capabilities/default.json）。
- 无需清理历史（无敏感内容残留）。

## 8. Personal Data

**PASS**

- 已扫描并清理开发者本机绝对路径与用户名残留：
  - `scripts/build-android.sh`：原硬编码 `/Users/yanzhi/...` 路径与内测版项目路径，已改为通用 `$(pwd)` 相对定位 + 环境变量。
  - `scripts/tablet-preview.mjs`：原硬编码截图输出目录 `/Users/yanzhi/WorkBuddy/...`，已改为项目内 `screenshots/` 或 `SCREENSHOT_DIR` 环境变量。
- 代码中仅剩一处测试示例路径 `/Users/example/My Project`（虚构数据，非真实用户路径）。
- 无手机号、邮箱、家庭地址、学号、聊天记录、密码本数据、日记、课程、记账数据、数据导出 JSON、含个人信息的截图。

## 9. Trademark / Project Name

**NO OBVIOUS CONFLICT FOUND（新名称）**

- **旧名称**：`SOLARIS` / `SOLARIS Open` / `SOLARIS Personal Resonance Terminal`
  - 处理：已确认在软件/计算机领域存在值得规避的在先权利（Oracle/Sun 的 `SOLARIS` 操作系统商标，USPTO Class 9，状态 Registered and Renewed），公开版已**停止使用**该名称。
- **新名称**：`Zynthel`
  - WIPO / CNIPA / USPTO / EUIPO / JPO：联网检索未发现同名或高近似商标（NO OBVIOUS CONFLICT FOUND）。
  - Web / GitHub / 软件产品同名搜索：未发现同名软件、GitHub 项目、公司或产品。
  - 查询日期：2026-09-18。
- **重要声明**：`NO OBVIOUS CONFLICT FOUND` **不等于**法律保证可注册，也不等于全球 100% 无侵权。搜索引擎检索无法覆盖所有官方商标数据库（部分数据库为动态页面，需人工进系统精确复核）。
- **仍待人工法律复核**：建议在正式注册前，由商标律师在 USPTO / EUIPO / CNIPA / JPO 官方数据库做最终 clearance；Logo 尚未评审（`LOGO NOT REVIEWED`）。

## 10. Third-Party Brand References

**PASS**

- 无 Obsidian 默认集成、无 Codex / Gemini / WorkBuddy / 豆包默认服务。
- 无 `md.obsidian`、无 `obsidian://` scheme。
- 无「Official」「官方支持」「官方合作」等暗示 endorsement / sponsorship / affiliation 的表述。
- 无第三方官方 Logo 冒充项目组成部分。

## 11. Privacy / Data Flow

**PASS**

- 应用为 local-first：工作区数据默认保存在用户设备本地（localStorage）。
- 项目本身不运营 SOLARIS 云后端，维护者默认不会收到用户工作区数据。
- README 已增加 `Data & Privacy` 说明，明确第三方 AI 服务的数据处理受其自身条款约束。
- README 明确说明 API Key 保存在设备本地应用存储，非操作系统安全密钥库级别保护，未做「绝对安全」等虚假承诺。

## 12. AI API Integration

**PASS**

- AI 为纯配置入口：用户自行填写 provider / baseUrl / apiKey / model。
- 无默认 API Key、无项目运营者代理 API、无预置第三方账户、无硬编码私有 endpoint。
- README 已增加 AI 第三方服务说明（含英文声明：项目不提供/转售/代理第三方 API，用户请求直连所选服务，项目与第三方无隶属/背书关系）。
- AI baseUrl 已加 http/https 严格校验；请求已加 60s 超时；CSP `connect-src` 已加 `https:`。

## 13. Android Permissions

**REVIEW REQUIRED**

- `INTERNET`：用于用户自行配置的 AI 模型接口调用。
- `QUERY_ALL_PACKAGES`：仅用于 App Picker 枚举本机已安装应用（Android 11+ 枚举完整应用列表所必需）。
  - 是否仅因 App Picker 枚举应用：**是**。
  - 是否存在权限更小的替代实现：可用 `<queries>` 声明具体包名，但 App Picker 需枚举**任意**已安装应用，无法预知包名，故需 `QUERY_ALL_PACKAGES`。
  - 是否触发 Google Play 政策审核：**是**，该权限为受限权限，上架 Google Play 会触发额外审核。
- `<queries>`：已声明 http/https 的 `ACTION_VIEW` intent（Android 11+ 打开链接必需），未包含任何内测专属 `md.obsidian` / `obsidian://`。

## 14. Google Play Policy

**NOT REVIEWED**

- 本项目当前定位为 GitHub 开源 + APK sideload 分发。
- **GitHub/open-source distribution reviewed separately from Google Play policy compliance.**
- 未审核 Google Play 政策，不宣称 `Google Play compliant`。
- README 已注明：含 `QUERY_ALL_PACKAGES`，仅支持本地编译安装（如需上架 Play，需另行评估并可能改用 `<queries>` 白名单方案）。

## 15. Technical Security

**PASS**

已完成 12 项安全/稳定性修复（与内测版验证过的加固对齐）：

1. ✅ AES-GCM 每字段独立 IV（password/url/note 各用独立 IV，旧数据回退 vaultMeta.iv）
2. ✅ Android 应用枚举移出主线程（IO 协程 + try/catch + 生命周期安全 resolve/reject + onDestroy cancel）
3. ✅ Bitmap finally recycle
4. ✅ Rust URL 严格解析（url crate，仅 http/https + 合法 host）
5. ✅ Kotlin URL scheme 白名单（http/https）
6. ✅ IPC 错误传播（Result<Vec,LaunchError>，区分空列表 vs 失败）
7. ✅ repository 先持久化再更新 cache
8. ✅ PBKDF2 iterations 范围（100k–1M）
9. ✅ 密码生成 rejection sampling
10. ✅ CSP connect-src 加 https:
11. ✅ AI baseUrl http/https 校验
12. ✅ AI 请求 60s 超时

验证：typecheck 0 / lint 0 / vitest 32/32 / next build 20 页 / cargo test 7/7 / cargo check（desktop + aarch64）✓ / APK build ✓。

## 16. Remaining Release Blockers

**技术 blocker：无。**

**法律复核 blocker（需人工处理，无法代码审计确认）：**

| 项 | 位置 | 问题 | 依据 | 建议处理 |
| --- | --- | --- | --- | --- | --- |
| 商标 | 项目名称 `SOLARIS` | 是否与软件领域现有商标冲突 | 商标法 | 人工检索商标库，确认无冲突或更名 |
| 司法辖区合规 | 整体 | 各司法辖区的具体法律适用 | 各国法律 | 法律专业人士复核（尤其 AI 数据跨境、隐私法） |

## 17. Final Release Status

**NOT READY — BLOCKERS REMAIN**

技术层面已满足公开发布标准（许可证、依赖、素材、字体、图标、Secrets、Git 历史、个人数据、隐私说明、品牌引用、技术安全全部 PASS）。

仍存在 **LEGAL REVIEW REQUIRED** 项（商标/项目名称、司法辖区合规），这些无法仅凭代码审计解决，需人工法律复核。在完成商标检索与法律复核前，不建议对外正式宣称「100% 法律合规」或「完全可发布」。

---

*本报告由工程审计生成，不构成法律意见。商标与司法辖区问题请咨询专业律师。*
