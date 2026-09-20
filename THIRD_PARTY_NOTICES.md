# THIRD PARTY NOTICES

本文件仅包含**许可证或版权条件要求（或合理需要）保留的第三方声明**。自愿性质的致谢见 README「❤️ 致谢」，两者不可互替。

完整的第三方许可证文本存放在 [`docs/licenses/`](docs/licenses/)。发布任何二进制（EXE / MSI / APK）时，建议将本文件与 `docs/licenses/` 一并附在 Release 资产中。

> 结论：本项目所有已确认的第三方组件均为宽松许可证（MIT / Apache-2.0 / ISC / BSD-2-Clause），**无任何 copyleft 组件进入分发物**。唯一待人工核验项为 Rust 传递依赖（见 docs/THIRD_PARTY_AUDIT.md）。

---

## pdf.js（pdfjs-dist）

- Copyright: © Mozilla and contributors
- License: Apache License 2.0（全文见 [docs/licenses/Apache-2.0-pdfjs.txt](docs/licenses/Apache-2.0-pdfjs.txt)）
- Source: https://mozilla.github.io/pdf.js/
- 分发形式：`public/pdf.worker.min.mjs` 为 pdfjs-dist 6.3.289 的**未修改**官方构建产物（与 npm 包内 `build/pdf.worker.min.mjs` 逐字节一致，md5 `ebbc6cf5cc66eb718f3ca35ecbc3b07e`），进入源码仓库、Windows EXE/MSI 与 Android APK。
- Required notice:

  > Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0. Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

- 上游未随包分发 NOTICE 文件，故无 NOTICE 传递义务；未做修改，无修改声明义务。
- Used by Zynthel for: 应用内 PDF 阅读器 worker。

## epub.js（epubjs）

- Copyright: Copyright (c) 2013, FuturePress (fchasen@gmail.com)
- License: BSD-2-Clause（全文见 [docs/licenses/BSD-2-Clause-epubjs.txt](docs/licenses/BSD-2-Clause-epubjs.txt)）
- Source: https://github.com/futurepress/epub.js
- 分发形式：打包进前端 bundle，随 EXE/MSI/APK 分发。
- Required notice（保留以上版权声明与许可证全文）。
- Used by Zynthel for: 应用内 EPUB 阅读。

## JSZip（jszip）

- Copyright: Copyright (c) 2011-2014 Stuart Knightley
- License: MIT **或** GPL-3.0-or-later（双许可，本项目选择 **MIT**，全文见 [docs/licenses/MIT-JSZip.txt](docs/licenses/MIT-JSZip.txt)）
- Source: https://stuk.github.io/jszip/
- 分发形式：打包进前端 bundle，随 EXE/MSI/APK 分发。
- Required notice（保留版权声明与 MIT 许可证文本）。
- Used by Zynthel for: 整包备份的 ZIP 打包与解压。

## Lucide Icons（lucide-react）

- Copyright: Copyright (c) 2026 Lucide Icons and Contributors（ISC 许可证文本与上游一致，见 [docs/licenses/ISC-Lucide.txt](docs/licenses/ISC-Lucide.txt)）
- License: ISC
- Source: https://lucide.dev/
- 分发形式：图标组件打包进前端 bundle，随 EXE/MSI/APK 分发。
- Required notice（保留以上版权声明与 ISC 许可证文本）。
- Used by Zynthel for: 全部 UI 图标。

## React / ReactDOM（react, react-dom）

- Copyright: Copyright (c) Meta Platforms, Inc. and affiliates
- License: MIT（文本见 [docs/licenses/MIT-generic.txt](docs/licenses/MIT-generic.txt)）
- Source: https://react.dev/
- 分发形式：打包进前端 bundle，随 EXE/MSI/APK 分发。
- Required notice（保留版权声明与 MIT 许可证文本）。
- Used by Zynthel for: UI 框架。

## Next.js（next）

- Copyright: Copyright (c) 2021 Vercel, Inc.
- License: MIT
- Source: https://nextjs.org/
- 分发形式：路由与运行时代码打包进前端 bundle（静态导出形态），随 EXE/MSI/APK 分发。
- Required notice（同上）。
- Used by Zynthel for: 前端框架（静态导出）。

## Zod（zod）

- Copyright: Copyright (c) 2020-2024 Colt Bartley 与贡献者
- License: MIT
- Source: https://zod.dev/
- 分发形式：打包进前端 bundle。
- Used by Zynthel for: 工作区数据模型校验。

## Framer Motion（framer-motion）

- Copyright: Copyright (c) 2018 Framer
- License: MIT
- Source: https://www.framer.com/motion/
- 分发形式：按 import 情况打包进前端 bundle。
- Used by Zynthel for: 交互动效。

## Tauri 前端 API（@tauri-apps/api）

- Copyright: Tauri Programme within The Commons Conservancy
- License: Apache-2.0 OR MIT
- Source: https://tauri.app/
- 分发形式：IPC 调用层打包进前端 bundle。
- Used by Zynthel for: 与 Rust 后端通信。

## Tauri（tauri / tauri-build / tauri-plugin-log / wry 等构建链）

- Copyright: Tauri Programme within The Commons Conservancy
- License: MIT OR Apache-2.0
- Source: https://github.com/tauri-apps/tauri
- 分发形式：Rust 编译产物链接进 `zynthel.exe` / `libzynthel_lib.so`；`src-tauri/gen/android/.../generated/` 中的 Kotlin 文件为 Tauri 模板代码，**文件头部的 SPDX-License-Identifier 注释（Apache-2.0 / MIT）必须保留，不得删除**。
- Used by Zynthel for: 跨平台应用框架。

## Rust 依赖（serde / serde_json / log / url 及全部传递依赖）

- 直接依赖（`src-tauri/Cargo.toml`）：serde、serde_json、log、url —— 均为 MIT OR Apache-2.0。
- 传递依赖（`src-tauri/Cargo.lock`，共 436 个 crate）：编写本报告时离线环境无法逐项核验 crates.io 许可证元数据，标记为 **MANUAL REVIEW**；核验命令：`cargo install cargo-deny && cargo deny --manifest-path src-tauri/Cargo.toml check licenses`（建议加入 CI）。
- Linux 桌面构建会引入 gtk/cairo/glib 等 Rust 绑定 crate（MIT），它们链接的 LGPL 系统库**不随本项目二进制分发**；Windows 与 Android 分发物不包含 GTK 栈。
- Used by Zynthel for: Rust 后端与构建链。

## Android 运行库（随 APK 分发）

| 库 | License | 分发形式 |
| --- | --- | --- |
| androidx.webkit / appcompat / activity / core / fragment / annotation / lifecycle | Apache-2.0 | 编译进 dex |
| com.google.android.material | Apache-2.0 | 编译进 dex |
| Kotlin 标准库 | Apache-2.0 | 编译进 dex |
| WebView（Android System WebView） | 系统组件，随设备提供 | **不随 APK 分发**，无义务 |

AndroidX / Material 均为 Apache-2.0 且上游未随二进制分发 NOTICE 文件；标准做法（携带许可证页面或随分发物附 Apache-2.0 文本）以 `docs/licenses/Apache-2.0-pdfjs.txt` 中的许可证全文为准。

## 仅开发期使用、不进入分发物（无随附义务，仅记录）

| 依赖 | License | 用途 |
| --- | --- | --- |
| TypeScript / ESLint / Vitest / Playwright / jsdom / Testing Library / Tailwind CSS / PostCSS | Apache-2.0 / MIT | 构建、测试、检查 |
| @tauri-apps/cli | Apache-2.0 OR MIT | Tauri CLI |
| junit 4.13.2 | EPL-1.0 | 仅 `testImplementation`，不进 APK |
| androidx.test.ext / espresso | Apache-2.0 | 仅 `androidTestImplementation`，不进 APK |
| Gradle / AGP | Apache-2.0 | 构建工具 |
| WebView2 | 系统运行时 | Windows 安装器仅引导下载官方安装器，不重新分发 WebView2 本体 |

---

**修改声明**：除上文注明者外，Zynthel 未修改任何第三方组件；`public/pdf.worker.min.mjs` 为未修改的官方构建产物（md5 与 npm 包一致）。

**禁删清单**（删除即可能违反许可证条件）：

1. `docs/licenses/` 下全部许可证文本；
2. `src-tauri/gen/android/.../generated/*.kt` 文件头部的 SPDX 许可证注释；
3. `public/pdf.worker.min.mjs`（若未来替换/修改，必须按 Apache-2.0 §4(b) 声明修改）；
4. 本文件。
