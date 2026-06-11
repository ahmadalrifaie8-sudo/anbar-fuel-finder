// توليد صورة OG ديناميكية للمحطة - SVG → PNG via SVG response
// نعيد SVG مباشرة لأنه يُعرض كصورة مشاركة في معظم المنصات الحديثة
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/og/$slug")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: station } = await supabaseAdmin
          .from("stations").select("id,name,slug,status").eq("slug", params.slug).maybeSingle();
        if (!station) return new Response("Not found", { status: 404 });

        const { data: statuses } = await supabaseAdmin
          .from("station_fuel_status").select("is_available, fuel_types(name)").eq("station_id", station.id);

        const items = (statuses ?? []).map((s: any) => ({
          name: s.fuel_types?.name as string,
          ok: !!s.is_available,
        }));

        const svg = renderOG(station.name, items);
        return new Response(svg, {
          headers: {
            "Content-Type": "image/svg+xml; charset=utf-8",
            "Cache-Control": "public, max-age=60, s-maxage=60",
          },
        });
      },
    },
  },
});

function renderOG(name: string, items: { name: string; ok: boolean }[]) {
  const w = 1200, h = 630;
  const esc = (s: string) => s.replace(/[<>&"]/g, (c) => ({"<":"&lt;",">":"&gt;","&":"&amp;","\"":"&quot;"}[c]!));
  const rows = items.map((it, i) => {
    const x = 80 + (i % 2) * 520;
    const y = 360 + Math.floor(i / 2) * 110;
    const fill = it.ok ? "#34d399" : "#f87171";
    const status = it.ok ? "متوفر" : "غير متوفر";
    return `
      <g transform="translate(${x},${y})">
        <rect width="480" height="90" rx="18" fill="${it.ok ? "#0f3d2c" : "#3d1414"}" stroke="${fill}" stroke-opacity="0.4"/>
        <circle cx="50" cy="45" r="18" fill="${fill}"/>
        <text x="90" y="42" font-size="28" font-weight="700" fill="#f8fafc" font-family="Cairo, sans-serif">${esc(it.name)}</text>
        <text x="90" y="72" font-size="20" fill="${fill}" font-family="Cairo, sans-serif">${status}</text>
      </g>`;
  }).join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0c1624"/>
      <stop offset="1" stop-color="#15293f"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.15" cy="0.0" r="0.6">
      <stop offset="0" stop-color="#34d399" stop-opacity="0.35"/>
      <stop offset="1" stop-color="#34d399" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#bg)"/>
  <rect width="${w}" height="${h}" fill="url(#glow)"/>
  <g transform="translate(80,80)" font-family="Cairo, sans-serif">
    <circle cx="30" cy="30" r="30" fill="#34d399"/>
    <text x="80" y="28" font-size="26" font-weight="700" fill="#34d399">منصة بانزين الأنبار</text>
    <text x="80" y="58" font-size="18" fill="#94a3b8">توفر الوقود لحظياً</text>
  </g>
  <text x="80" y="280" font-size="56" font-weight="900" fill="#f8fafc" font-family="Cairo, sans-serif">${esc(name)}</text>
  <text x="80" y="330" font-size="22" fill="#94a3b8" font-family="Cairo, sans-serif">حالة الوقود الحالية</text>
  ${rows}
</svg>`;
}
