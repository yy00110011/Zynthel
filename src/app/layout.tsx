import type { Metadata, Viewport } from "next";
import { AppShell } from "@/components/shell/app-shell";
import "./globals.css";
import "./workspace.css";
import "./visual-revision.css";
import "./v2.css";
import "./final-ui.css";
import "./final-layout-fix.css";
import "./final-polish.css";
import "./final-settings.css";
import "./life.css";

export const metadata: Metadata = {
  title: "Zynthel",
  description: "Personal workspace terminal",
};

// 禁止页面缩放（双指捏合），固定视口为设备宽度；页面内容超出时仅允许垂直滚动。
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body><AppShell>{children}</AppShell></body>
    </html>
  );
}
