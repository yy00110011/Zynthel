# 贡献指南

感谢你对 Zynthel 的关注！欢迎提交 Issue 和 Pull Request。

本项目当前开源 **Windows** 与 **Android** 两个版本，共用同一套 Next.js 前端、数据层与业务逻辑，平台能力通过 Tauri 2 条件编译与前端 `detectPlatform()` 隔离。**改动公共层时会同时影响两个平台**，请确保两边都验证过。

## 开发流程

1. **Fork** 本仓库并克隆到本地。
2. 创建功能分支：`git checkout -b feat/your-feature`。
3. 编写代码，遵循现有代码风格。
4. 运行验证：`pnpm typecheck`、`pnpm lint`、`pnpm test`、`pnpm build`。
5. 提交代码并推送到你的 Fork。
6. 提交 Pull Request，描述你的改动与动机。

## 代码规范

- 使用 TypeScript，类型完整，不写 `any`。
- 组件使用函数式组件 + React Hooks。
- 数据模型使用 Zod schema 定义，集中在 `src/features/data/`。
- 图标统一使用 `lucide-react`（ISC 许可），禁止引入第三方品牌图标。
- 颜色使用主题系统变量，不写死色值。
- 界面文案使用简体中文。

## 数据与持久化

- 所有数据通过 `workspaceRepository` 持久化（localStorage），图片等大对象走 IndexedDB。
- 新增数据字段时，在 `src/features/data/` 对应的 schema 文件中扩展 Zod schema，并确保 `.default()` 提供默认值，保证旧数据可平滑迁移。
- 密码本使用原生 Web Crypto（AES-GCM + PBKDF2），不引入额外加密依赖。

## 平台构建

```bash
# Windows（需在 Windows 上执行）
pnpm tauri build --bundles nsis,msi

# Android
pnpm tauri android build --apk --debug
```

Windows x64 是主目标；arm64 为实验性，CI 中允许失败且不阻塞 x64。不要为了适配单一平台而破坏另一个平台的构建。

## 合规要求（必须遵守）

- **不得**引入任何人物图像、动漫素材或第三方品牌图标 / 商标。
- **不得**预置任何默认 AI 服务、端点或硬编码密钥；AI 只能是纯配置入口。
- **不得**引入不在本次开源范围内的内容：任何内测版代码、macOS 私有版本、私有第三方集成、私有配置与私有数据。
- 界面资源使用纯几何图形与主题色块。

## 提交前检查（硬性要求）

**以下任何一项出现在 PR 中都会被直接拒绝：**

- API Key、Token、Password、Bearer 凭据等任何真实凭据；
- `.env` / `.env.local` 等环境变量文件；
- `.jks` / `.keystore` / `.p12` / `keystore.properties` 等签名材料与签名密码；
- 私钥文件（`*.pem` / `*.key`）；
- 构建产物：`.apk` / `.aab` / `.msi` / `.exe` / `src-tauri/target/` / `out/` / `.next/`；
- 开发者本机绝对路径、用户名、邮箱等个人信息；
- 用户真实数据（工作区导出 JSON、笔记、日记、密码本内容等）。

仓库的 `.gitignore` 已排除上述内容，但请**不要**使用 `git add -f` 绕过。如果不小心提交了凭据，请立即在 PR 中说明 —— 提交到公开仓库的凭据必须视为已泄露并立刻轮换。

## 提交信息规范

提交信息使用约定式提交（Conventional Commits）：

```text
feat: 新功能
fix: 修复
chore: 杂项
refactor: 重构
docs: 文档
```

## 行为准则

请保持友善、尊重。提交前请确保所有验证通过，且不包含任何敏感信息（密钥、绝对路径、个人数据）。

## 许可

贡献即表示你同意你的代码按本仓库的 [MIT License](LICENSE) 分发。
