# Zynthel 第三方材料合规审计（THIRD_PARTY_AUDIT）

> 审计日期：2026-09-20
> 审计对象：GitHub 源码发布、Windows EXE/MSI、Android APK 的**实际打包内容**
> 状态只使用：PASS / FIX REQUIRED / MANUAL REVIEW

## 一、合规总表

| 第三方内容 | 类型 | License | 进入源码发布 | 进入 EXE/MSI | 进入 APK | 必须署名 | 必须 LICENSE | 必须 NOTICE | 其他义务 | 当前状态 |
|---|---|---|---|---|---|---|---|---|---|---|
| pdfjs-dist 6.3.289（`public/pdf.worker.min.mjs`） | vendored 构建产物 | Apache-2.0 | 是 | 是 | 是 | 是 | 是 | 上游无 NOTICE，无传递义务 | 未修改（md5 与上游一致），无修改声明义务 | **PASS**（THIRD_PARTY_NOTICES.md + docs/licenses/ 已补齐；建议随 Release 附上） |
| epubjs 0.3.93 | npm 运行时依赖（打包进 bundle） | BSD-2-Clause | 是（依赖清单） | 是 | 是 | 是 | 是 | 否 | — | **PASS**（notice 已写入） |
| jszip 3.10.2 | npm 运行时依赖 | MIT OR GPL-3.0-or-later（**选 MIT**） | 是（依赖清单） | 是 | 是 | 是 | 是 | 否 | 双许可择一 | **PASS**（notice 已写入） |
| lucide-react 1.47.0 | npm 运行时依赖（UI 图标） | ISC | 是（依赖清单） | 是 | 是 | 是 | 是 | 否 | — | **PASS**（notice 已写入） |
| react / react-dom 19.3.0 | npm 运行时依赖 | MIT | 是（依赖清单） | 是 | 是 | 是 | 是 | 否 | — | **PASS**（版权行已列明） |
| next 16.3.5 | npm 运行时依赖（静态导出运行时） | MIT | 是（依赖清单） | 是 | 是 | 是 | 是 | 否 | — | **PASS** |
| zod 4.6.5 | npm 运行时依赖 | MIT | 是（依赖清单） | 是 | 是 | 是 | 是 | 否 | — | **PASS** |
| framer-motion 13.4.0 | npm 运行时依赖 | MIT | 是（依赖清单） | 是 | 是 | 是 | 是 | 否 | — | **PASS** |
| @tauri-apps/api 2.11.1 | npm 运行时依赖 | Apache-2.0 OR MIT | 是（依赖清单） | 是 | 是 | 是 | 是 | 否 | — | **PASS** |
| Tauri 2（tauri / tauri-build / tauri-plugin-log / wry 等） | Rust 构建与运行框架 | MIT OR Apache-2.0 | 是（Cargo 清单） | 是（静态链接） | 是（静态链接） | 是 | 是 | 否 | `gen/android/**/generated/*.kt` 的 SPDX 头**必须保留** | **PASS**（SPDX 头完整保留，已列入禁删清单） |
| Rust 直接依赖（serde / serde_json / log / url） | Cargo 直接依赖 | MIT OR Apache-2.0 | 是 | 是 | 是 | 是 | 是 | 否 | — | **PASS** |
| Rust 传递依赖（Cargo.lock 全量 436 crate） | Cargo 传递依赖 | 待核验 | 是（lock 文件） | 是 | 是 | 视各 crate 而定 | 视各 crate 而定 | 未知 | 编写时离线无法访问 crates.io 元数据 | **MANUAL REVIEW**（见三） |
| androidx.webkit / appcompat / activity / lifecycle 等 | Android 运行库 | Apache-2.0 | 否（Gradle 拉取） | 否 | 是（dex） | 是 | 是 | 上游无 NOTICE | — | **PASS**（docs/licenses 含 Apache-2.0 全文；建议 Release 附上） |
| com.google.android.material | Android 运行库 | Apache-2.0 | 否 | 否 | 是 | 是 | 是 | 否 | — | **PASS** |
| Kotlin 标准库 | Android 运行库 | Apache-2.0 | 否 | 否 | 是 | 是 | 是 | 否 | — | **PASS** |
| junit 4.13.2（EPL-1.0） | 仅测试依赖 | EPL-1.0 | 是（构建脚本） | **否** | **否**（testImplementation） | 否（不分发即无随附义务） | — | — | 弱 copyleft，但不进分发物 | **PASS**（已确认不进入任何分发物） |
| androidx.test / espresso | 仅测试依赖 | Apache-2.0 | 是（构建脚本） | 否 | 否 | 否 | — | — | — | **PASS** |
| WebView2 | Windows 系统运行时 | 微软系统组件 | 否 | 否（安装器仅引导官方下载） | 否 | 否 | 否 | 否 | 不重新分发本体 | **PASS** |
| Android System WebView | Android 系统组件 | 系统组件 | 否 | 否 | 否 | 否 | 否 | 否 | — | **PASS** |
| 应用图标（src-tauri/icons、mipmap-*） | 二进制资源 | 项目自有原创 | 是 | 是 | 是 | 否 | 否 | 否 | — | **PASS** |
| UI 图形 / 主题色块 / 背景 | 代码生成 | 项目原创 | 是 | 是 | 是 | 否 | 否 | 否 | — | **PASS** |
| 字体 | — | **不存在**（全部系统字体） | 否 | 否 | 否 | — | — | — | — | **PASS**（仓库字体文件数为 0） |
| 截图（docs/screenshots） | 文档图片 | 项目自制（虚构 Demo 数据 / 用户提供的真机截图） | 是 | 否 | 否 | 否 | 否 | 否 | — | **PASS** |
| 复制的第三方代码片段 | — | **未发现**（全库无 SO/教程/gist 来源痕迹，仅 Tauri 生成代码带 SPDX 头） | 否 | — | — | — | — | — | — | **PASS** |

## 二、分发物内容核验（实际打开二进制检查）

- **Android APK**（CI 实测产物 `app-universal-debug.apk`，929 个条目）：
  - 前端整体（含 React/Next/pdfjs worker/epubjs/JSZip/lucide/zod 打包产物）**嵌入在 `lib/*/libzynthel_lib.so` 内**（Tauri 2 机制，已在 .so 中检索到 `index.html`/`_next`/`drift-wall` 等特征串确认）；
  - `assets/tauri.conf.json` 存在；
  - dex 含 AndroidX / Material / Kotlin 标准库；
  - `assets/` 中**未**发现任何第三方独立资源文件。
- **Windows EXE/MSI**：基于 `out/`（含 35 个 `_next` chunk、`pdf.worker.min.mjs`）打包，前端与上述 npm 组件全部内嵌；WebView2 不随安装包分发。
- **源码仓库**：仅 `public/pdf.worker.min.mjs` 为 vendored 第三方文件；其余第三方均以依赖清单（package.json / Cargo.toml / build.gradle.kts）形式声明。

## 三、MANUAL REVIEW 项与核验方法

**Rust 传递依赖（Cargo.lock 全量 436 个 crate）**

- 现状：直接依赖（tauri、serde、serde_json、log、url、tauri-build、tauri-plugin-log）均已确认为 MIT OR Apache-2.0；传递依赖中已知包含 gtk/cairo/glib 等 Rust 绑定（crate 本身 MIT），其链接的 LGPL 系统库**不随 Windows/Android 分发物分发**（GTK 栈仅用于 Linux 桌面构建路径）。
- 风险：理论上存在混入非常规许可 crate 的可能，离线环境无法逐项核验。
- 核验命令（建议加入 CI）：

```bash
cargo install cargo-deny
cargo deny --manifest-path src-tauri/Cargo.toml check licenses
```

- 处理建议：在转 Public 前跑一次上述命令；如全部为 MIT/Apache-2.0/ISC/BSD/Zlib 等宽松许可即转 PASS。

## 四、结论

| 判定 | 数量 |
| --- | --- |
| PASS | 全部已核验项 |
| FIX REQUIRED | 0（pdfjs/epubjs/jszip/lucide 的 notice 缺失问题已在本次审计中通过 THIRD_PARTY_NOTICES.md + docs/licenses/ 修复） |
| MANUAL REVIEW | 1（Rust 传递依赖许可证全量核验） |

**没有发现任何 copyleft（GPL/AGPL/LGPL/MPL）代码进入分发物。**
