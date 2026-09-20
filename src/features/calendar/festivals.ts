// 中国节日数据：公历固定节日 + 农历节日（农历节日用公历对照表，覆盖 2024–2027 年）。
// 农历节日每年公历日期会变，这里内置一份近似对照表；超出范围则跳过农历节日。

export type Festival = { name: string; type: "solar" | "lunar" | "term"; note?: string };

// 公历固定节日（每月重复，无需年份）
const SOLAR_FESTIVALS: Record<string, Festival> = {
  "01-01": { name: "元旦", type: "solar" },
  "02-14": { name: "情人节", type: "solar" },
  "03-08": { name: "妇女节", type: "solar" },
  "03-12": { name: "植树节", type: "solar" },
  "04-01": { name: "愚人节", type: "solar" },
  "05-01": { name: "劳动节", type: "solar" },
  "05-04": { name: "青年节", type: "solar" },
  "05-12": { name: "护士节", type: "solar" },
  "06-01": { name: "儿童节", type: "solar" },
  "07-01": { name: "建党节", type: "solar" },
  "08-01": { name: "建军节", type: "solar" },
  "09-10": { name: "教师节", type: "solar" },
  "10-01": { name: "国庆节", type: "solar" },
  "12-24": { name: "平安夜", type: "solar" },
  "12-25": { name: "圣诞节", type: "solar" },
};

// 农历节日对照表：年份 -> "MM-DD" -> 节日名
// 数据来源：万年历（农历节日对应公历日期），覆盖 2024–2027。
const LUNAR_FESTIVALS: Record<number, Record<string, string>> = {
  2024: {
    "02-10": "春节",
    "02-24": "元宵节",
    "04-04": "清明节",
    "06-10": "端午节",
    "08-10": "七夕",
    "09-17": "中秋节",
    "10-11": "重阳节",
  },
  2025: {
    "01-29": "春节",
    "02-12": "元宵节",
    "04-04": "清明节",
    "05-31": "端午节",
    "08-29": "七夕",
    "10-06": "中秋节",
    "10-29": "重阳节",
  },
  2026: {
    "02-17": "春节",
    "03-03": "元宵节",
    "04-05": "清明节",
    "06-19": "端午节",
    "08-19": "七夕",
    "09-25": "中秋节",
    "10-18": "重阳节",
  },
  2027: {
    "02-06": "春节",
    "02-20": "元宵节",
    "04-05": "清明节",
    "06-09": "端午节",
    "08-08": "七夕",
    "09-15": "中秋节",
    "10-08": "重阳节",
  },
};

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** 返回某一天（公历）对应的节日数组 */
export function festivalsForDate(year: number, month: number, day: number): Festival[] {
  const key = `${pad(month)}-${pad(day)}`;
  const result: Festival[] = [];
  const solar = SOLAR_FESTIVALS[key];
  if (solar) result.push(solar);
  const lunar = LUNAR_FESTIVALS[year]?.[key];
  if (lunar) result.push({ name: lunar, type: "lunar" });
  return result;
}
