import type { Metadata } from "next";
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

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body><AppShell>{children}</AppShell></body>
    </html>
  );
}
