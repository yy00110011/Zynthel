"use client";

import { Database, Download, FolderOpen, HardDriveDownload, HardDriveUpload, Info, Keyboard, RotateCcw, ShieldCheck, Upload, Image as ImageIcon, Bot, Plus, Trash2, Eye, EyeOff, BookOpen } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { GlassPanel, SectionTitle } from "@/components/ui/glass-panel";
import { useWorkspace } from "@/features/data/use-workspace";
import { workspaceRepository } from "@/features/data/repository";
import { exportWorkspace, importWorkspace, buildFullBackup, parseFullBackup, downloadBlob } from "@/features/data/transfer";
import { getAllBookFiles, putBookFiles } from "@/lib/book-storage";
import { getAllDriftWallImages, putDriftWallImages } from "@/lib/drift-wall-storage";
import { THEME_PRESETS } from "@/features/themes/registry";
import type { AiModelConfig } from "@/features/data/ai-schema";

export function FinalSettings() {
  const data = useWorkspace();
  const file = useRef<HTMLInputElement>(null);
  const bgFile = useRef<HTMLInputElement>(null);
  const fullFile = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  // AI 模型配置表单
  const [modelName, setModelName] = useState("");
  const [modelBaseUrl, setModelBaseUrl] = useState("");
  const [modelApiKey, setModelApiKey] = useState("");
  const [modelId, setModelId] = useState("");
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});

  const patch = (value: Partial<typeof data.settings>) =>
    workspaceRepository.update((current) => ({ ...current, settings: { ...current.settings, ...value } }));

  const download = () => {
    const blob = new Blob([exportWorkspace(data)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `zynthel-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const load = async (selected?: File) => {
    if (!selected) return;
    const result = importWorkspace(await selected.text());
    if (result.ok) { workspaceRepository.set(result.data); setMessage("数据已成功导入。"); }
    else setMessage("导入失败：文件格式无效或版本不受支持。");
  };

  // 完整备份：工作区数据 + 阅读清单书籍文件（IndexedDB）打包成 ZIP
  const downloadFull = async () => {
    setBusy(true);
    try {
      const files = await getAllBookFiles();
      const bookById = new Map(data.books.map((b) => [b.id, b.fileName]));
      const wallFiles = await getAllDriftWallImages();
      const blob = await buildFullBackup(
        data,
        files.map((f) => ({ ...f, fileName: bookById.get(f.bookId) ?? f.bookId })),
        wallFiles,
      );
      downloadBlob(blob, `zynthel-full-backup-${new Date().toISOString().slice(0, 10)}.zip`);
      setMessage(`完整备份已导出（含 ${files.length} 个书籍文件、${wallFiles.length} 张浮光墙图片）。`);
    } catch {
      setMessage("完整备份导出失败，请重试。");
    } finally {
      setBusy(false);
    }
  };

  const loadFull = async (selected?: File) => {
    if (!selected) return;
    setBusy(true);
    try {
      const result = await parseFullBackup(selected);
      if (!result.ok) {
        const messages: Record<typeof result.error, string> = {
          "invalid-zip": "恢复失败：备份文件损坏或格式无效。",
          "unsupported-data": "恢复失败：不是有效的完整备份文件。",
          "zip-too-large": "恢复失败：备份文件过大。",
          "too-many-files": "恢复失败：备份文件数量超限。",
          "file-too-large": "恢复失败：存在超大的书籍文件。",
          "total-too-large": "恢复失败：书籍文件总大小超限。",
        };
        setMessage(messages[result.error]);
        return;
      }
      // 保证数据一致性：先写书籍文件与浮光墙图片（全部成功）→ 最后写 workspace；失败回滚已写文件，不覆盖旧 workspace
      await putBookFiles(result.files.map((f) => ({ bookId: f.bookId, blob: f.blob })));
      await putDriftWallImages(result.driftWallFiles.map((f) => ({ itemId: f.itemId, blob: f.blob })));
      workspaceRepository.set(result.data);
      setMessage(`完整备份已恢复（含 ${result.files.length} 个书籍文件、${result.driftWallFiles.length} 张浮光墙图片）。`);
    } catch (err) {
      setMessage(`恢复失败：${err instanceof Error ? err.message : "文件读取错误"}。`);
    } finally {
      setBusy(false);
    }
  };

  const addModel = () => {
    const name = modelName.trim();
    const baseUrl = modelBaseUrl.trim();
    const key = modelApiKey.trim();
    const mid = modelId.trim();
    if (!name || !baseUrl || !mid) { setMessage("请填写模型名称、接口地址和模型标识。"); return; }
    const config: AiModelConfig = {
      id: crypto.randomUUID(),
      name,
      provider: "openai",
      baseUrl,
      apiKey: key,
      model: mid,
      createdAt: new Date().toISOString(),
    };
    workspaceRepository.update((d) => ({ ...d, aiModels: [...d.aiModels, config], updatedAt: new Date().toISOString() }));
    setModelName(""); setModelBaseUrl(""); setModelApiKey(""); setModelId("");
    setMessage("模型已添加。");
  };

  const removeModel = (id: string) => {
    workspaceRepository.update((d) => ({ ...d, aiModels: d.aiModels.filter((m) => m.id !== id) }));
  };

  const handleBgUpload = (selected?: File) => {
    if (!selected) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        patch({ backgroundImage: result });
        setMessage("背景图已更新。");
      }
    };
    reader.readAsDataURL(selected);
  };

  return (
    <div className="page-stack final-settings">
      <header className="page-heading"><p>Zynthel 本地配置</p><h1>设置</h1><span>管理本地路径、数据、安全偏好与 AI 模型。</span></header>
      <div className="settings-grid">

        <GlassPanel className="settings-card">
          <SectionTitle><><Info /> 外观</></SectionTitle>
          <label>自定义背景图<small>上传本地图片作为首页背景，保存在本机，不打包进 APK，仅作用于首页。</small></label>
          <div className="bg-upload-row">
            <button className="primary-action" onClick={() => bgFile.current?.click()}><ImageIcon /> {data.settings.backgroundImage ? "更换背景图" : "上传背景图"}</button>
            {data.settings.backgroundImage && (
              <button className="danger" onClick={() => { patch({ backgroundImage: "" }); setMessage("已恢复默认渐变背景。"); }}>清除</button>
            )}
            <input ref={bgFile} hidden type="file" accept="image/*" onChange={(e) => handleBgUpload(e.target.files?.[0])} />
          </div>
          {data.settings.backgroundImage && (
            <div className="bg-preview" style={{ backgroundImage: `url(${data.settings.backgroundImage})` }} />
          )}
          <label style={{ marginTop: 14 }}>主题颜色<small>选择一套配色，立即生效并自动保存；自定义背景图会覆盖主背景。</small></label>
          <div className="theme-grid">
            {THEME_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={`theme-card ${data.settings.theme === preset.id ? "active" : ""}`}
                aria-label={`使用主题 ${preset.label}`}
                aria-pressed={data.settings.theme === preset.id}
                onClick={() => { patch({ theme: preset.id }); setMessage(`已切换到「${preset.label}」主题。`); }}
              >
                <span className="theme-swatch" style={{ background: preset.gradient }} />
                <span>{preset.label}</span>
              </button>
            ))}
          </div>
        </GlassPanel>

        <GlassPanel className="settings-card">
          <SectionTitle><><FolderOpen /> 本地路径</></SectionTitle>
          <label>项目根目录<input value={data.settings.projectRoot} onChange={(e) => patch({ projectRoot: e.target.value })} placeholder="/Users/你/Projects" /></label>
          <p className="settings-copy">项目与终端操作会优先使用这些本地路径。</p>
        </GlassPanel>

        <GlassPanel className="settings-card">
          <SectionTitle><><ShieldCheck /> 体验与安全</></SectionTitle>
          <label className="switch-row"><span>减少动态效果<small>关闭非必要的淡入、滑动和弹簧反馈</small></span><input aria-label="减少动态效果" type="checkbox" checked={data.settings.reducedMotion} onChange={(e) => patch({ reducedMotion: e.target.checked })} /></label>
          <div className="info-row"><strong>本地优先</strong><span>数据保存在本机 WebView，不上传云端。</span></div>
          <div className="info-row"><strong>安全启动</strong><span>应用与路径通过受限 Tauri 命令打开，不执行任意 shell。</span></div>
        </GlassPanel>

        <GlassPanel className="settings-card wide">
          <SectionTitle><><Bot /> AI 模型配置</></SectionTitle>
          <p className="settings-copy">本应用不内置任何 AI 服务，也不预置任何端点或密钥。你可以自行接入任意服务：填入接口地址、API 密钥与模型标识即可，接入什么 API 就用什么模型。密钥明文保存在本机。</p>
          <div className="ai-model-form">
            <input aria-label="模型名称" value={modelName} onChange={(e) => setModelName(e.target.value)} placeholder="名称（如：我的模型）" />
            <input aria-label="接口地址" value={modelBaseUrl} onChange={(e) => setModelBaseUrl(e.target.value)} placeholder="接口地址（如 https://api.example.com/v1）" />
            <input aria-label="API 密钥" type="password" value={modelApiKey} onChange={(e) => setModelApiKey(e.target.value)} placeholder="API 密钥" />
            <input aria-label="模型标识" value={modelId} onChange={(e) => setModelId(e.target.value)} placeholder="模型标识（如 gpt-4o）" />
            <button className="primary-action" onClick={addModel}><Plus /> 添加模型</button>
          </div>
          {data.aiModels.length > 0 && (
            <div className="ai-model-list">
              {data.aiModels.map((m) => (
                <div key={m.id} className="ai-model-item">
                  <div>
                    <strong>{m.name}</strong>
                    <small>{m.baseUrl} · {m.model}</small>
                    <span className="ai-key">
                      {showKeys[m.id] ? m.apiKey || "（未填）" : m.apiKey ? "••••••••" : "（未填）"}
                    </span>
                  </div>
                  <button aria-label="显示密钥" onClick={() => setShowKeys((s) => ({ ...s, [m.id]: !s[m.id] }))}>{showKeys[m.id] ? <EyeOff /> : <Eye />}</button>
                  <button aria-label="删除模型" onClick={() => removeModel(m.id)}><Trash2 /></button>
                </div>
              ))}
            </div>
          )}
        </GlassPanel>

        <GlassPanel className="settings-card">
          <SectionTitle><><Keyboard /> 快捷键</></SectionTitle>
          <div className="shortcut-row"><span>打开命令面板</span><kbd>⌘ K</kbd></div>
          <div className="shortcut-row"><span>关闭面板或对话框</span><kbd>Esc</kbd></div>
          <div className="shortcut-row"><span>选择命令</span><kbd>↑ ↓ Enter</kbd></div>
        </GlassPanel>

        <GlassPanel className="settings-card">
          <SectionTitle><><Database /> 数据管理</></SectionTitle>
          <p className="settings-copy">完整备份包含任务、项目、日历、笔记、工具、生活工具数据、本地设置、阅读清单的书籍文件与浮光墙图片，打包为一个 ZIP 文件。云盘同步需要外部服务凭据，当前版本提供本地完整备份，备份文件可手动上传到任意网盘。</p>
          <div className="data-actions">
            <button onClick={() => void downloadFull()} disabled={busy}><HardDriveDownload /> 完整备份</button>
            <button onClick={() => fullFile.current?.click()} disabled={busy}><HardDriveUpload /> 恢复完整备份</button>
            <input ref={fullFile} hidden type="file" accept=".zip,application/zip" onChange={(e) => { void loadFull(e.target.files?.[0]); e.target.value = ""; }} />
            <button onClick={download}><Download /> 导出数据 (JSON)</button>
            <button onClick={() => file.current?.click()}><Upload /> 导入数据 (JSON)</button>
            <input ref={file} hidden type="file" accept="application/json" onChange={(e) => void load(e.target.files?.[0])} />
            <button className="danger" onClick={() => window.confirm("确定恢复默认数据？当前内容将被替换。") && workspaceRepository.reset()}><RotateCcw /> 恢复默认</button>
          </div>
          {message && <p className="inline-message">{message}</p>}
        </GlassPanel>

        <GlassPanel className="settings-card wide about-card">
          <SectionTitle><><Info /> 关于 Zynthel</></SectionTitle>
          <div>
            <h2>Zynthel <small>开源版 v0.2.0</small></h2>
            <p>本地优先个人工作台</p>
            <div className="about-section">
              <Link href="/help" className="primary-action" style={{ display: "inline-flex" }}><BookOpen /> 使用说明</Link>
            </div>
            <div className="about-section">
              <h3>所需权限</h3>
              <ul>
                <li><strong>网络（INTERNET）</strong>：用于你自行配置的 AI 模型接口调用。</li>
                <li><strong>查询已安装应用（QUERY_ALL_PACKAGES）</strong>：仅用于列出本机已安装应用以实现应用跳转，不收集、不上传应用列表。</li>
              </ul>
            </div>
            <div className="about-section">
              <h3>隐私声明</h3>
              <p className="settings-copy">所有数据（任务、项目、笔记、生活工具、密码本、AI 配置与对话记录）均存储在本机本地，不上传任何服务器，不收集任何个人隐私信息，不包含任何遥测或追踪。</p>
            </div>
            <div className="about-section">
              <h3>开源协议</h3>
              <p className="settings-copy">本项目基于 MIT 协议开源分发，可自由使用、修改与再分发。</p>
            </div>
          </div>
        </GlassPanel>

      </div>
    </div>
  );
}
