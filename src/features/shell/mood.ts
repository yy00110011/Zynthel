import { CloudSun, Moon, Sparkles, Sun, Sunrise, Sunset } from "lucide-react";

export type MoodKey = "dawn" | "morning" | "noon" | "afternoon" | "dusk" | "night";

export type Mood = {
  key: MoodKey;
  label: string;
  hint: string;
  Icon: typeof Sun;
};

const MOODS: Array<{ startsAt: number; key: MoodKey; label: string; hint: string; Icon: typeof Sun }> = [
  { startsAt: 20, key: "night", label: "夜晚 · 沉静", hint: "把今天放下", Icon: Moon },
  { startsAt: 17, key: "dusk", label: "黄昏 · 余晖", hint: "回看今天的进度", Icon: Sunset },
  { startsAt: 14, key: "afternoon", label: "午后 · 松弛", hint: "把剩下的收个尾", Icon: Sparkles },
  { startsAt: 11, key: "noon", label: "正午 · 静谧", hint: "留一段空白给自己", Icon: CloudSun },
  { startsAt: 8, key: "morning", label: "上午 · 清朗", hint: "趁清醒做难的事", Icon: Sun },
  { startsAt: 5, key: "dawn", label: "清晨 · 微光", hint: "今天刚刚开始", Icon: Sunrise },
];

const NIGHT = MOODS[0];

export function moodFor(date: Date): Mood {
  return MOODS.find((mood) => date.getHours() >= mood.startsAt) ?? NIGHT;
}

export function greetingFor(date: Date): string {
  const hour = date.getHours();
  if (hour < 5) return "夜深了，";
  if (hour < 11) return "早上好，";
  if (hour < 14) return "中午好，";
  if (hour < 18) return "下午好，";
  return "晚上好，";
}
