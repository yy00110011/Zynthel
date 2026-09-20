# ADR 0005 · 用 GitHub Actions 云端构建产出 EXE / MSI / APK

## Decision

Windows 与 Android 的正式安装包**只由 GitHub Actions 云端构建产出**，作为 Actions Artifact 与 Release 资产分发；源码 ZIP 不作为发布资产。发布流程为：先在 Private 仓库验证双平台构建，再转 Public 并发 Release。

## Context

Windows 安装包（NSIS/MSI）只能在 Windows 上产出，而开发环境是 macOS —— 本机无法生成 Windows 二进制。Android 构建则需要 JDK + SDK + NDK 的固定组合，环境漂移会直接导致构建失败。

此外，若把源码 ZIP 当成「Windows 版下载」，普通用户会拿到无法安装的东西。

## Alternatives

- **开发者本机构建后手动上传**：可控，但依赖个人环境，产物不可复现，且 macOS 无法产出 Windows 包。
- **只发布源码，让用户自己编译**：把构建成本转嫁给用户，与「普通用户下载 EXE / APK」的目标相悖。
- **第三方 CI（非 GitHub）**：可行但引入额外账号与凭据，收益不明显。

## Consequences

**优点**

- 构建环境固化在 workflow 中，产物可复现；
- Windows x64 与 Android 都有真实日志可查（本次实测：EXE / MSI / APK 均成功产出）；
- APK / EXE / MSI 不进 Git 历史，仓库保持干净；
- arm64 设为 Experimental 且 `continue-on-error`，失败不阻塞 x64 发布。

**代价**

- 首次构建耗时较长（约 15 分钟，主要是 Rust 与 Gradle 编译）；
- Windows 包未做商业代码签名（需付费证书），SmartScreen 会提示「未知发布者」—— 作为已知限制记录在文档中，不以降低系统安全性来规避；
- Android Release 签名需要作者的密钥，只能通过 GitHub Secrets 或本地签名完成，keystore 与签名密码绝不入库。

## Contributors

- 决策：项目作者
- 方案设计：ChatGPT 参与（作者确认，仓库未保留逐项记录）
- 实现与验证：既有 workflow（早期会话）+ WorkBuddy 本轮核对、修正在 Linux runner 缺失的 Tauri 系统依赖、并实测两套云端构建
- 审查：GitHub Actions 真实运行日志
