"use client";

import { Plus, Send, Trash2, Bot, User, MessageSquare } from "lucide-react";
import { useMemo, useState } from "react";
import { GlassPanel, SectionTitle } from "@/components/ui/glass-panel";
import { useWorkspace } from "@/features/data/use-workspace";
import { workspaceRepository } from "@/features/data/repository";
import { chatCompletion, AiClientError } from "./ai-client";
import type { AiConversation, AiMessage } from "../data/ai-schema";

// 极简 Markdown 渲染（代码块 + 粗体 + 列表 + 换行），避免引入额外依赖
function renderMarkdown(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function MarkdownView({ content }: { content: string }) {
  const html = useMemo(() => {
    const escaped = renderMarkdown(content);
    return escaped
      .replace(/```([\s\S]*?)```/g, "<pre><code>$1</code></pre>")
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/^\s*###\s+(.+)$/gm, "<h4>$1</h4>")
      .replace(/^\s*##\s+(.+)$/gm, "<h3>$1</h3>")
      .replace(/^\s*#\s+(.+)$/gm, "<h2>$1</h2>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>")
      .replace(/^\s*[-*]\s+(.+)$/gm, "<li>$1</li>")
      .replace(/\n/g, "<br/>");
  }, [content]);
  return <div className="markdown-body" dangerouslySetInnerHTML={{ __html: html }} />;
}

export function AiChatPage() {
  const data = useWorkspace();
  const models = data.aiModels;
  const conversations = data.aiConversations;

  const [modelId, setModelId] = useState("");
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState("");

  const activeModel = models.find((m) => m.id === modelId) ?? models[0];
  const activeConv = conversations.find((c) => c.id === activeConvId) ?? null;

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(""), 3000);
  };

  const newConversation = () => {
    if (!activeModel) return;
    const now = new Date().toISOString();
    const conv: AiConversation = { id: crypto.randomUUID(), modelId: activeModel.id, title: "", messages: [], createdAt: now, updatedAt: now };
    workspaceRepository.update((d) => ({ ...d, aiConversations: [conv, ...d.aiConversations], updatedAt: now }));
    setActiveConvId(conv.id);
  };

  const clearConversations = () => {
    if (!window.confirm("确定清空所有对话记录？")) return;
    workspaceRepository.update((d) => ({ ...d, aiConversations: [], updatedAt: new Date().toISOString() }));
    setActiveConvId(null);
  };

  const send = async () => {
    const text = input.trim();
    if (!text || !activeModel) return;
    if (!activeConv) {
      showToast("请先新建一个对话");
      return;
    }
    const userMsg: AiMessage = { id: crypto.randomUUID(), role: "user", content: text, createdAt: new Date().toISOString() };
    // 先写入用户消息
    let updated = { ...activeConv, messages: [...activeConv.messages, userMsg], updatedAt: new Date().toISOString() };
    if (!activeConv.title) updated = { ...updated, title: text.slice(0, 30) };
    workspaceRepository.update((d) => ({ ...d, aiConversations: d.aiConversations.map((c) => c.id === updated.id ? updated : c) }));
    setInput("");
    setLoading(true);
    try {
      const reply = await chatCompletion(activeModel, updated.messages.map((m) => ({ role: m.role, content: m.content })));
      const assistantMsg: AiMessage = { id: crypto.randomUUID(), role: "assistant", content: reply, createdAt: new Date().toISOString() };
      workspaceRepository.update((d) => ({
        ...d,
        aiConversations: d.aiConversations.map((c) => c.id === updated.id ? { ...c, messages: [...c.messages, assistantMsg], updatedAt: new Date().toISOString() } : c),
      }));
    } catch (err) {
      const message = err instanceof AiClientError ? `请求失败：${err.message}` : "网络异常，请检查接口地址或网络连接。";
      showToast(message);
    } finally {
      setLoading(false);
    }
  };

  if (models.length === 0) {
    return (
      <div className="page-stack">
        <header className="page-heading"><p>智能对话</p><h1>AI</h1><span>自定义模型对话，本地存储历史。</span></header>
        <GlassPanel className="vault-setup">
          <SectionTitle><><Bot /> 尚未配置模型</></SectionTitle>
          <p className="settings-copy">请先在「设置 → AI 模型配置」中添加一个模型（接口地址、API 密钥、模型标识），即可开始对话。</p>
        </GlassPanel>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <header className="page-heading"><p>智能对话</p><h1>AI</h1><span>自定义模型对话，本地存储历史。</span></header>

      <div className="ai-chat-layout">
        <GlassPanel className="ai-chat-sidebar">
          <SectionTitle action={<button className="ai-icon-btn" onClick={newConversation} title="新建对话"><Plus /></button>}>
            <MessageSquare /> 对话
          </SectionTitle>
          <div className="ai-chat-model-select">
            <select aria-label="选择模型" value={activeModel?.id ?? ""} onChange={(e) => setModelId(e.target.value)}>
              {models.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div className="ai-chat-list">
            {conversations.filter((c) => c.modelId === (activeModel?.id ?? "")).map((c) => (
              <button key={c.id} className={c.id === activeConvId ? "active" : ""} onClick={() => setActiveConvId(c.id)}>
                {c.title || "新对话"}
              </button>
            ))}
            {conversations.filter((c) => c.modelId === (activeModel?.id ?? "")).length === 0 && (
              <p className="ledger-empty">暂无对话</p>
            )}
          </div>
          {conversations.length > 0 && (
            <button className="ai-clear-btn" onClick={clearConversations}><Trash2 /> 清空所有对话</button>
          )}
        </GlassPanel>

        <GlassPanel className="ai-chat-main">
          {!activeConv ? (
            <div className="ai-chat-empty">
              <Bot />
              <p>选择或新建一个对话，开始与模型交流。</p>
            </div>
          ) : (
            <>
              <div className="ai-chat-messages">
                {activeConv.messages.map((m) => (
                  <div key={m.id} className={`ai-message ${m.role}`}>
                    <span className="ai-message-avatar">{m.role === "user" ? <User /> : <Bot />}</span>
                    <div className="ai-message-content">
                      {m.role === "assistant" ? <MarkdownView content={m.content} /> : <p>{m.content}</p>}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="ai-message assistant">
                    <span className="ai-message-avatar"><Bot /></span>
                    <div className="ai-message-content"><p className="ai-typing">思考中…</p></div>
                  </div>
                )}
              </div>
              <div className="ai-chat-input">
                <input aria-label="消息" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }} placeholder="输入消息…" />
                <button onClick={() => void send()} disabled={loading || !input.trim()}><Send /></button>
              </div>
            </>
          )}
        </GlassPanel>
      </div>

      {toast && <div className="ai-toast">{toast}</div>}
    </div>
  );
}
