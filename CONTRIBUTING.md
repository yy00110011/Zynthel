# 贡献指南

感谢你对 Zynthel 项目的关注！欢迎提交 Issue 和 Pull Request。

## 开发流程

1. **Fork** 本仓库并克隆到本地。
2. 创建功能分支：`git checkout -b feat/your-feature`。
3. 编写代码，遵循现有代码风格。
4. 运行验证：`pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm build`。
5. 提交代码并推送到你的 Fork。
6. 提交 Pull Request，描述你的改动与动机。

## 代码规范

- 使用 TypeScript，类型完整，不写 `any`。
- 组件使用函数式组件 + React Hooks。
- 数据模型使用 Zod schema 定义，集中在 `src/features/data/`。
- 图标统一使用 `lucide-react`（MIT 许可），禁止引入第三方品牌图标。
- 颜色使用主题系统变量，不写死色值。
- 界面文案使用简体中文。

## 数据与持久化

- 所有数据通过 `workspaceRepository`（localStorage）持久化。
- 新增数据字段时，在 `src/features/data/` 对应的 schema 文件中扩展 Zod schema，并确保 `.default()` 提供默认值，保证旧数据可平滑迁移。
- 密码本使用原生 Web Crypto（AES-GCM + PBKDF2），不引入额外加密依赖。

## 合规要求（必须遵守）

- **不得**引入任何人物图像、动漫素材或第三方品牌图标/商标。
- **不得**预置任何境外服务、境外链接或硬编码密钥/端点。
- **不得**内置任何默认 AI 服务；AI 仅提供纯配置入口。
- 界面资源使用纯几何图形与主题色块。

## 提交信息规范

提交信息使用约定式提交（Conventional Commits）：

```
feat: 新功能
fix: 修复
chore: 杂项
refactor: 重构
docs: 文档
```

## 行为准则

请保持友善、尊重，遵守社区行为准则。提交前请确保所有验证通过，且不包含任何敏感信息（密钥、绝对路径、个人数据）。
