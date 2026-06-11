// صفحة المصادقة - دخول / تسجيل
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "دخول مدير المحطة — بانزين الأنبار" },
      { name: "description", content: "تسجيل دخول مدراء المحطات لتحديث توفر الوقود لحظياً." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { name, phone },
          },
        });
        if (error) throw error;
        toast.success("تم إنشاء الحساب بنجاح");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate({ to: "/dashboard" });
    } catch (err: any) {
      toast.error(err?.message ?? "حدث خطأ");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-[100dvh] items-center justify-center p-4">
      <div className="glass-strong w-full max-w-md rounded-3xl p-6 shadow-2xl">
        <div className="flex justify-center"><Logo /></div>
        <h1 className="mt-6 text-center text-xl font-bold">
          {mode === "login" ? "دخول مدير المحطة" : "إنشاء حساب محطة جديد"}
        </h1>
        <p className="mt-1 text-center text-xs text-muted-foreground">
          {mode === "login" ? "أدخل بيانات حسابك لإدارة محطتك" : "سجّل لإضافة محطتك على المنصة"}
        </p>

        <form onSubmit={submit} className="mt-6 space-y-3">
          {mode === "signup" && (
            <>
              <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="الاسم الكامل"
                className="w-full rounded-xl border border-border bg-input px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary" />
              <input required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="رقم الهاتف" type="tel"
                className="w-full rounded-xl border border-border bg-input px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary" />
            </>
          )}
          <input required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="البريد الإلكتروني" type="email" dir="ltr"
            className="w-full rounded-xl border border-border bg-input px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary" />
          <input required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="كلمة المرور" type="password" minLength={6} dir="ltr"
            className="w-full rounded-xl border border-border bg-input px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary" />

          <button disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 font-bold text-primary-foreground shadow-[var(--shadow-glow-primary)] transition active:scale-95 disabled:opacity-50">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "login" ? "دخول" : "إنشاء حساب"}
          </button>
        </form>

        <button onClick={() => setMode(mode === "login" ? "signup" : "login")}
          className="mt-4 w-full text-center text-xs text-muted-foreground hover:text-foreground">
          {mode === "login" ? "ليس لديك حساب؟ سجّل محطتك" : "لديك حساب بالفعل؟ سجّل دخول"}
        </button>
      </div>
    </main>
  );
}
