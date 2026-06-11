// خريطة الموقع الديناميكية
import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: stations } = await supabaseAdmin
          .from("stations").select("slug, updated_at").eq("status", "Active");

        const entries = [
          { path: "/", changefreq: "hourly", priority: "1.0" },
          ...(stations ?? []).map((s) => ({
            path: `/s/${s.slug}`,
            lastmod: (s as any).updated_at,
            changefreq: "hourly" as const,
            priority: "0.8",
          })),
        ];

        const urls = entries.map((e: any) => `  <url>
    <loc>${e.path}</loc>
    ${e.lastmod ? `<lastmod>${e.lastmod}</lastmod>` : ""}
    <changefreq>${e.changefreq}</changefreq>
    <priority>${e.priority}</priority>
  </url>`).join("\n");

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
        return new Response(xml, {
          headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=300" },
        });
      },
    },
  },
});
