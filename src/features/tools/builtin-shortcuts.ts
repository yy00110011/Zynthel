import { Bot, Music, Trophy, type LucideIcon } from "lucide-react";

export type BuiltinShortcut = {
  id: string;
  name: string;
  /** 第三方服务的官方 HTTPS 地址；本机未安装客户端时以网页形式打开。 */
  url: string;
  /**
   * 本机桌面客户端的关键词（小写）。
   * 点击时先在本机已安装应用里查找：命中 → 用本地客户端打开；未命中 → 回落到上面的官方网页。
   * 关键词只用于「读取本机应用目录做名称匹配」，不会被执行。
   */
  appKeywords: string[];
  Icon: LucideIcon;
};

// 首页「常用应用」内置快捷入口（仅 Windows 桌面端展示）。
// 安全与合规说明：
// - 这三个入口是 Windows 专属功能；Android / macOS 上不展示（见 final-dashboard 的 FavApps 平台判断）。
// - 优先打开用户自己安装的本地客户端；未安装时以官方 HTTPS 网页形式打开，
//   不下载、不安装、不捆绑任何第三方客户端本体。
// - 不暗示任何官方合作 / 推荐关系，UI 中标注为「第三方快捷入口」。
// - 未复制任何第三方 Logo 文件；统一使用 Zynthel 自带通用图标（lucide）。
// - 本地探测只读遍历系统应用目录（Rust 侧），不执行任何命令；启动仍走绝对路径校验。
export const BUILTIN_SHORTCUTS: BuiltinShortcut[] = [
  { id: "qishui", name: "汽水音乐", url: "https://www.qishui.com", appKeywords: ["汽水音乐", "qishui", "soda music", "sodamusic"], Icon: Music },
  { id: "hupu", name: "虎扑", url: "https://www.hupu.com", appKeywords: ["虎扑", "hupu"], Icon: Trophy },
  { id: "doubao", name: "豆包", url: "https://www.doubao.com", appKeywords: ["豆包", "doubao"], Icon: Bot },
];
