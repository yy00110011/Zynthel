"use client";

import { Plus, Trash2, Wallet, TrendingUp, TrendingDown } from "lucide-react";
import { useMemo, useState } from "react";
import { GlassPanel, SectionTitle } from "@/components/ui/glass-panel";
import { useWorkspace } from "@/features/data/use-workspace";
import { workspaceRepository } from "@/features/data/repository";
import type { LedgerTransaction } from "@/features/data/life-schema";

const CATEGORIES = ["餐饮", "交通", "购物", "居住", "娱乐", "医疗", "教育", "其他"];

function fmtFen(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function LedgerPage() {
  const data = useWorkspace();
  const [accountName, setAccountName] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<"expense" | "income">("expense");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [accountId, setAccountId] = useState("");
  const [note, setNote] = useState("");
  const [tagText, setTagText] = useState("");

  const accounts = data.ledgerAccounts;
  const transactions = data.ledgerTransactions;

  const totalIncome = useMemo(() => transactions.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0), [transactions]);
  const totalExpense = useMemo(() => transactions.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0), [transactions]);
  const balance = totalIncome - totalExpense;

  const expenseByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of transactions) {
      if (t.type !== "expense") continue;
      map.set(t.category, (map.get(t.category) ?? 0) + t.amount);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [transactions]);

  const addAccount = () => {
    const name = accountName.trim();
    if (!name) return;
    workspaceRepository.update((d) => ({
      ...d,
      ledgerAccounts: [...d.ledgerAccounts, { id: crypto.randomUUID(), name, icon: "wallet", createdAt: new Date().toISOString() }],
      updatedAt: new Date().toISOString(),
    }));
    setAccountName("");
  };

  const addTransaction = () => {
    const cents = Math.round(parseFloat(amount) * 100);
    if (!Number.isFinite(cents) || cents <= 0) return;
    const tx: LedgerTransaction = {
      id: crypto.randomUUID(),
      amount: cents,
      type,
      category: type === "income" ? "收入" : category,
      accountId: accountId || accounts[0]?.id || "",
      date: new Date().toLocaleDateString("sv-SE"),
      note: note.trim(),
      tags: tagText.split(/[,，]/).map((v) => v.trim()).filter(Boolean),
      createdAt: new Date().toISOString(),
    };
    workspaceRepository.update((d) => ({ ...d, ledgerTransactions: [tx, ...d.ledgerTransactions], updatedAt: new Date().toISOString() }));
    setAmount(""); setNote(""); setTagText("");
  };

  const removeTransaction = (id: string) => {
    workspaceRepository.update((d) => ({ ...d, ledgerTransactions: d.ledgerTransactions.filter((t) => t.id !== id) }));
  };

  return (
    <div className="page-stack">
      <header className="page-heading"><p>收支管理</p><h1>记账本</h1><span>记录每一笔收支，掌握月度财务状况。</span></header>

      <GlassPanel className="ledger-summary">
        <div className="ledger-stat"><TrendingUp /><span>收入</span><strong>¥{fmtFen(totalIncome)}</strong></div>
        <div className="ledger-stat"><TrendingDown /><span>支出</span><strong>¥{fmtFen(totalExpense)}</strong></div>
        <div className="ledger-stat"><Wallet /><span>结余</span><strong>¥{fmtFen(balance)}</strong></div>
      </GlassPanel>

      <div className="ledger-grid">
        <GlassPanel>
          <SectionTitle>记一笔</SectionTitle>
          <div className="ledger-form">
            <div className="ledger-type-toggle">
              <button className={type === "expense" ? "active" : ""} onClick={() => setType("expense")}>支出</button>
              <button className={type === "income" ? "active" : ""} onClick={() => setType("income")}>收入</button>
            </div>
            <input aria-label="金额" type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="金额" />
            {type === "expense" && (
              <select aria-label="分类" value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
            <select aria-label="账户" value={accountId || accounts[0]?.id || ""} onChange={(e) => setAccountId(e.target.value)}>
              {accounts.length === 0 && <option value="">（无账户）</option>}
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <input aria-label="备注" value={note} onChange={(e) => setNote(e.target.value)} placeholder="备注" />
            <input aria-label="标签" value={tagText} onChange={(e) => setTagText(e.target.value)} placeholder="标签（逗号分隔）" />
            <button className="primary-action" onClick={addTransaction}><Plus /> 添加</button>
          </div>
        </GlassPanel>

        <GlassPanel>
          <SectionTitle>账户</SectionTitle>
          <div className="ledger-account-form">
            <input aria-label="账户名称" value={accountName} onChange={(e) => setAccountName(e.target.value)} placeholder="新账户名称" />
            <button className="primary-action" onClick={addAccount}><Plus /> 添加账户</button>
          </div>
          <div className="ledger-account-list">
            {accounts.map((a) => <div key={a.id}><Wallet />{a.name}</div>)}
            {accounts.length === 0 && <p className="ledger-empty">还没有账户，先添加一个吧。</p>}
          </div>
        </GlassPanel>
      </div>

      <GlassPanel>
        <SectionTitle>支出分类占比</SectionTitle>
        {expenseByCategory.length === 0 ? (
          <p className="ledger-empty">暂无支出记录。</p>
        ) : (
          <div className="ledger-category-bars">
            {expenseByCategory.map(([cat, cents]) => {
              const pct = totalExpense > 0 ? (cents / totalExpense) * 100 : 0;
              return (
                <div key={cat} className="ledger-category-row">
                  <span className="ledger-category-name">{cat}</span>
                  <div className="ledger-category-bar"><i style={{ width: `${pct}%` }} /></div>
                  <span className="ledger-category-value">¥{fmtFen(cents)}</span>
                </div>
              );
            })}
          </div>
        )}
      </GlassPanel>

      <GlassPanel>
        <SectionTitle>明细</SectionTitle>
        {transactions.length === 0 ? (
          <p className="ledger-empty">还没有记录。</p>
        ) : (
          <div className="ledger-list">
            {transactions.map((t) => (
              <div key={t.id} className="ledger-row">
                <span className={t.type === "income" ? "income" : "expense"}>{t.type === "income" ? "+" : "-"}¥{fmtFen(t.amount)}</span>
                <span>{t.category}</span>
                <span>{t.date}</span>
                {t.note && <small>{t.note}</small>}
                {t.tags.length > 0 && <span className="ledger-tags">{t.tags.map((tag) => `#${tag}`).join(" ")}</span>}
                <button aria-label="删除" onClick={() => removeTransaction(t.id)}><Trash2 /></button>
              </div>
            ))}
          </div>
        )}
      </GlassPanel>
    </div>
  );
}
