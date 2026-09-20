# ADR 0003 · Windows 与 Android 共用单一 GitHub 仓库

## Decision

Windows 版与 Android 版放在**同一个 GitHub 仓库 `Zynthel`**，不拆成 `Zynthel-Windows` 与 `Zynthel-Android` 两个仓库。

## Context

两个版本共用同一套前端、数据层与业务逻辑，只有少量平台差异（Rust 条件编译 + 前端 `detectPlatform()`）。拆仓库会导致：

- 同一份前端代码出现两个副本，改动需要手工同步；
- 公共 Bug 要修两次，且容易出现版本漂移；
- 用户要找两个仓库才知道自己该下载什么。

## Alternatives

- **两个独立仓库**：平台边界清晰，但代码同步成本高，与「共用同一前端」的事实冲突。
- **Monorepo（packages/ 拆分）**：理论上更整洁，但当前代码结构并非按包划分，重构成本大于收益，且会牵动构建配置。

## Consequences

**优点**

- 一份源码、一套 CI，改动同时作用于两个平台；
- README / Issue / Release 集中在一处，普通用户只需要找 Releases 页面；
- 两个平台的构建在同一个仓库的 Actions 中并排呈现，回归风险可见。

**代价**

- 单个 Release 里同时存在 Windows 与 Android 资产，需要在 Release Notes 与 README 中写清「该下哪个」；
- CI 需要同时准备 Windows 与 Android 两套构建环境（Android 侧依赖 SDK/NDK，构建时间较长）。

## Contributors

- 决策：项目作者
- 方案设计：ChatGPT 参与（作者确认，仓库未保留逐项记录）
- 执行：WorkBuddy 建立 Private 仓库、推送源码并验证双平台云端构建
- 验证：GitHub Actions 实测（Windows EXE+MSI、Android APK 均成功产出）
