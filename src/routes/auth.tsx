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

  // ترجمة رسائل الخطأ من Supabase إلى رسائل عربية واضحة مع خطوات الإصلاح
  const translateAuthError = (err: any): { title: string; hint?: string } => {
    const code = (err?.code ?? err?.error_code ?? "").toString().toLowerCase();
    const msg = (err?.message ?? "").toString().toLowerCase();

    if (code === "invalid_credentials" || msg.includes("invalid login credentials")) {
      return {
        title: "بيانات الدخول غير صحيحة",
        hint: "تأكّد من البريد وكلمة المرور. إن نسيت كلمة المرور، تواصل مع مدير المنصة لإعادة تعيينها.",
      };
    }
    if (code === "email_not_confirmed" || msg.includes("email not confirmed")) {
      return {
        title: "البريد الإلكتروني غير مُؤكَّد بعد",
        hint: "افتح بريدك واضغط رابط التأكيد الذي أرسلناه، ثم أعد المحاولة.",
      };
    }
    if (code === "user_already_exists" || msg.includes("already registered") || msg.includes("user already")) {
      return {
        title: "هذا البريد مُسجَّل مسبقاً",
        hint: "بدّل إلى وضع «دخول» وسجّل دخولك بكلمة المرور الخاصة بك.",
      };
    }
    if (code === "weak_password" || msg.includes("password should be at least") || msg.includes("weak password")) {
      return {
        title: "كلمة المرور ضعيفة",
        hint: "استخدم 6 أحرف على الأقل، ويُفضَّل خلط أحرف وأرقام ورموز.",
      };
    }
    if (code === "over_request_rate_limit" || msg.includes("rate limit") || msg.includes("too many")) {
      return {
        title: "محاولات كثيرة خلال وقت قصير",
        hint: "انتظر دقيقة واحدة ثم أعد المحاولة.",
      };
    }
    if (code === "user_banned" || msg.includes("banned")) {
      return {
        title: "الحساب موقوف",
        hint: "تواصل مع مدير المنصة لمراجعة حالة الحساب.",
      };
    }
    if (msg.includes("network") || msg.includes("failed to fetch")) {
      return {
        title: "تعذّر الاتصال بالخادم",
        hint: "تحقّق من اتصال الإنترنت ثم أعد المحاولة.",
      };
    }
    if (msg.includes("invalid email") || code === "validation_failed") {
      return {
        title: "صيغة البريد الإلكتروني غير صحيحة",
        hint: "أدخل بريداً صحيحاً مثل name@example.com.",
      };
    }
    return { title: err?.message ?? "حدث خطأ غير متوقّع", hint: "أعد المحاولة، وإن استمرّت المشكلة تواصل مع الدعم." };
  };

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
      const { title, hint } = translateAuthError(err);
      toast.error(title, { description: hint });
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
