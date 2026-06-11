// مكوّن اختيار الوقت بالعربي — صباحاً / مساءً
import type React from "react";

const SEL = "rounded-lg border border-border bg-input px-1.5 py-1 text-[11px] text-foreground outline-none";

function to12h(t24: string): { h: number; m: string; p: "صباحاً" | "مساءً" } {
  const [hStr, mStr] = (t24 ?? "08:00").split(":");
  let h = parseInt(hStr, 10) || 0;
  const p: "صباحاً" | "مساءً" = h < 12 ? "صباحاً" : "مساءً";
  if (h === 0) h = 12;
  else if (h > 12) h = h - 12;
  return { h, m: mStr ?? "00", p };
}

function to24h(h: number, m: string, p: "صباحاً" | "مساءً"): string {
  let h24 = h;
  if (p === "صباحاً" && h === 12) h24 = 0;
  else if (p === "مساءً" && h !== 12) h24 = h + 12;
  return `${String(h24).padStart(2, "0")}:${m}`;
}

export function TimePickerAr({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const { h, m, p } = to12h(value);

  return (
    <div className="flex items-center gap-1" dir="ltr">
      {/* الفترة: صباحاً / مساءً */}
      <select
        value={p}
        onChange={(e) => onChange(to24h(h, m, e.target.value as any))}
        className={SEL}
        style={{ colorScheme: "dark" }}
      >
        <option value="صباحاً">صباحاً</option>
        <option value="مساءً">مساءً</option>
      </select>

      {/* الدقائق */}
      <select
        value={m}
        onChange={(e) => onChange(to24h(h, e.target.value, p))}
        className={SEL}
        style={{ colorScheme: "dark" }}
      >
        {["00", "15", "30", "45"].map((n) => (
          <option key={n} value={n}>{n}</option>
        ))}
      </select>

      <span className="text-[10px] text-muted-foreground">:</span>

      {/* الساعة */}
      <select
        value={h}
        onChange={(e) => onChange(to24h(Number(e.target.value), m, p))}
        className={SEL}
        style={{ colorScheme: "dark" }}
      >
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
          <option key={n} value={n}>{n}</option>
        ))}
      </select>
    </div>
  );
}
