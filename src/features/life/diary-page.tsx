"use client";

import { Plus, Trash2, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { GlassPanel, SectionTitle } from "@/components/ui/glass-panel";
import { useWorkspace } from "@/features/data/use-workspace";
import { workspaceRepository } from "@/features/data/repository";

// 心情用几何色块表达（不用人脸/表情符号，符合版权合规）
const MOODS = [
  { key: "great", label: "很好", color: "#f59e0b" },
  { key: "good", label: "不错", color: "#10b981" },
  { key: "okay", label: "一般", color: "#94a3b8" },
  { key: "low", label: "低落", color: "#60a5fa" },
  { key: "bad", label: "难过", color: "#8b5cf6" },
] as const;

type MoodKey = (typeof MOODS)[number]["key"];

const WEATHERS = ["晴", "多云", "阴", "雨", "雪", "风"];

export function DiaryPage() {
  const data = useWorkspace();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [mood, setMood] = useState<MoodKey>("okay");
  const [weather, setWeather] = useState(WEATHERS[0]);
  const [tagText, setTagText] = useState("");
  const [query, setQuery] = useState("");

  const entries = data.diaryEntries;

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    if (!q) return entries;
    return entries.filter((e) =>
      [e.title, e.body, ...e.tags].some((v) => v.toLocaleLowerCase().includes(q))
    );
  }, [entries, query]);

  const addEntry = () => {
    if (!body.trim() && !title.trim()) return;
    const now = new Date().toISOString();
    workspaceRepository.update((d) => ({
      ...d,
      diaryEntries: [{
        id: crypto.randomUUID(),
        date: new Date().toLocaleDateString("sv-SE"),
        title: title.trim(),
        body: body.trim(),
        mood,
        weather,
        tags: tagText.split(/[,，]/).map((v) => v.trim()).filter(Boolean),
        createdAt: now,
        updatedAt: now,
      }, ...d.diaryEntries],
      updatedAt: now,
    }));
    setTitle(""); setBody(""); setTagText("");
  };

  const removeEntry = (id: string) => {
    workspaceRepository.update((d) => ({ ...d, diaryEntries: d.diaryEntries.filter((e) => e.id !== id) }));
  };

  return (
    <div className="page-stack">
      <header className="page-heading"><p>每日记录</p><h1>日记</h1><span>记录每天的心情与点滴。</span></header>

      <GlassPanel>
        <SectionTitle>写日记</SectionTitle>
        <div className="diary-form">
          <input aria-label="标题" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="标题（可选）" />
          <textarea aria-label="正文" value={body} onChange={(e) => setBody(e.target.value)} placeholder="今天发生了什么…" />
          <div className="diary-mood-row">
            <span className="diary-label">心情</span>
            {MOODS.map((m) => (
              <button key={m.key} className={`diary-mood ${mood === m.key ? "active" : ""}`} onClick={() => setMood(m.key)} title={m.label}>
                <i style={{ background: m.color }} /><span>{m.label}</span>
              </button>
            ))}
          </div>
          <div className="diary-weather-row">
            <span className="diary-label">天气</span>
            <select aria-label="天气" value={weather} onChange={(e) => setWeather(e.target.value)}>
              {WEATHERS.map((w) => <option key={w} value={w}>{w}</option>)}
            </select>
          </div>
          <input aria-label="标签" value={tagText} onChange={(e) => setTagText(e.target.value)} placeholder="标签（逗号分隔）" />
          <button className="primary-action" onClick={addEntry}><Plus /> 保存</button>
        </div>
      </GlassPanel>

      <GlassPanel>
        <SectionTitle>
          时间线
          <div className="diary-search"><Search /><input aria-label="搜索日记" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索…" /></div>
        </SectionTitle>
        {filtered.length === 0 ? (
          <p className="ledger-empty">还没有日记。</p>
        ) : (
          <div className="diary-timeline">
            {filtered.map((e) => {
              const moodInfo = MOODS.find((m) => m.key === e.mood) ?? MOODS[2];
              return (
                <div key={e.id} className="diary-entry">
                  <div className="diary-entry-head">
                    <span className="diary-date">{e.date}</span>
                    <i className="diary-mood-dot" style={{ background: moodInfo.color }} title={moodInfo.label} />
                    {e.weather && <span className="diary-weather">{e.weather}</span>}
                    {e.tags.length > 0 && <span className="ledger-tags">{e.tags.map((t) => `#${t}`).join(" ")}</span>}
                    <button aria-label="删除" onClick={() => removeEntry(e.id)}><Trash2 /></button>
                  </div>
                  {e.title && <h3>{e.title}</h3>}
                  {e.body && <p>{e.body}</p>}
                </div>
              );
            })}
          </div>
        )}
      </GlassPanel>
    </div>
  );
}
