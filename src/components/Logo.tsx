// شعار منصة بانزين الأنبار
import { Fuel } from "lucide-react";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-[var(--shadow-glow-primary)]">
        <Fuel className="h-5 w-5" strokeWidth={2.5} />
      </div>
      <div className="leading-tight">
        <div className="text-sm font-extrabold tracking-tight">بانزين الأنبار</div>
        <div className="text-[10px] text-muted-foreground">توفر الوقود لحظياً</div>
      </div>
    </div>
  );
}
