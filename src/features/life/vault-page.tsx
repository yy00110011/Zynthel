"use client";

import { Plus, Trash2, KeyRound, Lock, Shield, Eye, EyeOff, Wand2, Copy } from "lucide-react";
import { useState } from "react";
import { GlassPanel, SectionTitle } from "@/components/ui/glass-panel";
import { useWorkspace } from "@/features/data/use-workspace";
import { workspaceRepository } from "@/features/data/repository";
import {
  deriveKey, generateSalt, generateIv, encryptText, decryptText,
  makeVerifier, verifyMasterPassword, generatePassword,
} from "@/features/data/crypto";

export function VaultPage() {
  const data = useWorkspace();
  const vaultMeta = data.vaultMeta;
  const [masterPassword, setMasterPassword] = useState("");
  const [unlockedKey, setUnlockedKey] = useState<CryptoKey | null>(null);
  const [error, setError] = useState("");

  // 新建条目表单
  const [title, setTitle] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [category, setCategory] = useState("");
  const [revealId, setRevealId] = useState<string | null>(null);

  const hasVault = vaultMeta !== null;
  const isUnlocked = unlockedKey !== null;

  // 初始化主密码（首次使用）
  const initVault = async () => {
    const pw = masterPassword;
    if (!pw) return;
    const salt = generateSalt();
    const iv = generateIv();
    const iterations = 150000;
    const key = await deriveKey(pw, salt, iterations);
    const verifier = await makeVerifier(key, iv);
    workspaceRepository.update((d) => ({
      ...d,
      vaultMeta: { salt, iv, iterations, verifier },
      vaultEntries: [],
      updatedAt: new Date().toISOString(),
    }));
    setUnlockedKey(key);
    setMasterPassword("");
    setError("");
  };

  // 解锁
  const unlock = async () => {
    if (!vaultMeta) return;
    const ok = await verifyMasterPassword(masterPassword, vaultMeta.salt, vaultMeta.iterations, vaultMeta.iv, vaultMeta.verifier);
    if (!ok) {
      setError("主密码错误，请重试。");
      return;
    }
    const key = await deriveKey(masterPassword, vaultMeta.salt, vaultMeta.iterations);
    setUnlockedKey(key);
    setMasterPassword("");
    setError("");
  };

  const addEntry = async () => {
    if (!unlockedKey || !vaultMeta) return;
    const t = title.trim();
    if (!t || !password) return;
    // 每个敏感字段独立 IV，避免在同一 AES-GCM key 下重用 nonce。
    const passwordIv = generateIv();
    const urlIv = generateIv();
    const noteIv = generateIv();
    const passwordCipher = await encryptText(unlockedKey, passwordIv, password);
    const urlCipher = await encryptText(unlockedKey, urlIv, url.trim());
    const noteCipher = await encryptText(unlockedKey, noteIv, note.trim());
    workspaceRepository.update((d) => ({
      ...d,
      vaultEntries: [...d.vaultEntries, {
        id: crypto.randomUUID(),
        title: t,
        username: username.trim(),
        passwordCipher,
        urlCipher,
        noteCipher,
        passwordIv,
        urlIv,
        noteIv,
        category: category.trim(),
        createdAt: new Date().toISOString(),
      }],
      updatedAt: new Date().toISOString(),
    }));
    setTitle(""); setUsername(""); setPassword(""); setUrl(""); setNote(""); setCategory("");
  };

  const removeEntry = (id: string) => {
    workspaceRepository.update((d) => ({ ...d, vaultEntries: d.vaultEntries.filter((e) => e.id !== id) }));
  };

  const revealPassword = async (id: string) => {
    if (!unlockedKey || !vaultMeta) return;
    if (revealId === id) { setRevealId(null); return; }
    setRevealId(id);
  };

  const decryptPassword = async (entry: { passwordCipher: string; passwordIv: string }): Promise<string> => {
    if (!unlockedKey || !vaultMeta) return "";
    try {
      // 新数据用条目自己的 IV，旧数据（无独立 IV）回退 vaultMeta.iv。
      const iv = entry.passwordIv || vaultMeta.iv;
      return await decryptText(unlockedKey, iv, entry.passwordCipher);
    } catch {
      return "";
    }
  };

  const copyPassword = async (entry: { passwordCipher: string; passwordIv: string }) => {
    if (!unlockedKey || !vaultMeta) return;
    try {
      const iv = entry.passwordIv || vaultMeta.iv;
      const plain = await decryptText(unlockedKey, iv, entry.passwordCipher);
      await navigator.clipboard.writeText(plain);
    } catch {
      // ignore
    }
  };

  // 首次：设置主密码
  if (!hasVault) {
    return (
      <div className="page-stack">
        <header className="page-heading"><p>本地加密</p><h1>密码本</h1><span>所有密码使用本地主密码加密存储，不上传云端。</span></header>
        <GlassPanel className="vault-setup">
          <SectionTitle><><Lock /> 设置主密码</></SectionTitle>
          <p className="settings-copy">请设置一个主密码用于加密你的密码本。主密码不会被存储，忘记后数据将无法恢复。</p>
          <div className="vault-form">
            <input aria-label="主密码" type="password" value={masterPassword} onChange={(e) => setMasterPassword(e.target.value)} placeholder="输入主密码" />
            <button className="primary-action" onClick={() => void initVault()}><Shield /> 创建密码本</button>
          </div>
          {error && <p className="inline-message">{error}</p>}
        </GlassPanel>
      </div>
    );
  }

  // 已设置但未解锁
  if (!isUnlocked) {
    return (
      <div className="page-stack">
        <header className="page-heading"><p>本地加密</p><h1>密码本</h1><span>输入主密码解锁你的密码本。</span></header>
        <GlassPanel className="vault-setup">
          <SectionTitle><><Lock /> 解锁</></SectionTitle>
          <div className="vault-form">
            <input aria-label="主密码" type="password" value={masterPassword} onChange={(e) => setMasterPassword(e.target.value)} placeholder="输入主密码" onKeyDown={(e) => { if (e.key === "Enter") void unlock(); }} />
            <button className="primary-action" onClick={() => void unlock()}><KeyRound /> 解锁</button>
          </div>
          {error && <p className="inline-message">{error}</p>}
        </GlassPanel>
      </div>
    );
  }

  // 已解锁
  return (
    <div className="page-stack">
      <header className="page-heading"><p>本地加密</p><h1>密码本</h1><span>已解锁，敏感信息默认掩码显示。</span></header>

      <GlassPanel>
        <SectionTitle>添加密码</SectionTitle>
        <div className="vault-form">
          <input aria-label="标题" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="标题（如：邮箱、银行）" />
          <input aria-label="用户名" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="用户名" />
          <div className="vault-password-row">
            <input aria-label="密码" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="密码" />
            <button type="button" onClick={() => setPassword(generatePassword(16))} title="生成随机密码"><Wand2 /></button>
          </div>
          <input aria-label="网址" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="网址（可选）" />
          <input aria-label="分类" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="分类（可选）" />
          <input aria-label="备注" value={note} onChange={(e) => setNote(e.target.value)} placeholder="备注（可选）" />
          <button className="primary-action" onClick={() => void addEntry()}><Plus /> 保存</button>
        </div>
      </GlassPanel>

      <GlassPanel>
        <SectionTitle>密码列表</SectionTitle>
        {data.vaultEntries.length === 0 ? (
          <p className="ledger-empty">还没有保存的密码。</p>
        ) : (
          <div className="vault-list">
            {data.vaultEntries.map((e) => (
              <VaultRow
                key={e.id}
                entry={e}
                revealed={revealId === e.id}
                onToggleReveal={() => void revealPassword(e.id)}
                onCopy={() => void copyPassword({ passwordCipher: e.passwordCipher, passwordIv: e.passwordIv })}
                onRemove={() => removeEntry(e.id)}
                decryptPassword={(entry) => decryptPassword(entry)}
              />
            ))}
          </div>
        )}
      </GlassPanel>
    </div>
  );
}

function VaultRow({ entry, revealed, onToggleReveal, onCopy, onRemove, decryptPassword }: {
  entry: { id: string; title: string; username: string; passwordCipher: string; urlCipher: string; noteCipher: string; passwordIv: string; category: string };
  revealed: boolean;
  onToggleReveal: () => void;
  onCopy: () => void;
  onRemove: () => void;
  decryptPassword: (entry: { passwordCipher: string; passwordIv: string }) => Promise<string>;
}) {
  const [plain, setPlain] = useState<string | null>(null);
  return (
    <div className="vault-item">
      <span className="vault-icon"><Lock /></span>
      <div className="vault-main">
        <strong>{entry.title}</strong>
        {entry.username && <small>{entry.username}</small>}
        <span className="vault-password">{revealed ? (plain ?? "••••••••") : "••••••••"}</span>
      </div>
      {entry.category && <span className="vault-category">{entry.category}</span>}
      <button aria-label="显示/隐藏" onClick={() => {
        if (!revealed) void decryptPassword({ passwordCipher: entry.passwordCipher, passwordIv: entry.passwordIv }).then(setPlain);
        onToggleReveal();
      }}>{revealed ? <EyeOff /> : <Eye />}</button>
      <button aria-label="复制" onClick={onCopy}><Copy /></button>
      <button aria-label="删除" onClick={onRemove}><Trash2 /></button>
    </div>
  );
}
