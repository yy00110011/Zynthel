import { describe, expect, it } from "vitest";
import { greetingFor, moodFor } from "./mood";

function at(hour: number): Date {
  return new Date(2026, 8, 18, hour, 30, 0);
}

describe("moodFor", () => {
  it("walks through the whole day", () => {
    expect(moodFor(at(3)).key).toBe("night");
    expect(moodFor(at(6)).key).toBe("dawn");
    expect(moodFor(at(9)).key).toBe("morning");
    expect(moodFor(at(12)).key).toBe("noon");
    expect(moodFor(at(15)).key).toBe("afternoon");
    expect(moodFor(at(18)).key).toBe("dusk");
    expect(moodFor(at(22)).key).toBe("night");
  });

  it("gives every slot a distinct label", () => {
    const labels = [3, 6, 9, 12, 15, 18].map((hour) => moodFor(at(hour)).label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("never leaves the hint empty", () => {
    for (let hour = 0; hour < 24; hour += 1) {
      expect(moodFor(at(hour)).hint.length).toBeGreaterThan(0);
      expect(moodFor(at(hour)).Icon).toBeTruthy();
    }
  });
});

describe("greetingFor", () => {
  it("greets by time of day", () => {
    expect(greetingFor(at(2))).toBe("夜深了，");
    expect(greetingFor(at(9))).toBe("早上好，");
    expect(greetingFor(at(12))).toBe("中午好，");
    expect(greetingFor(at(15))).toBe("下午好，");
    expect(greetingFor(at(21))).toBe("晚上好，");
  });
});
