import "dotenv/config";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const app = express();
const PORT = Number(process.env.PORT || 3000);
const root = path.dirname(fileURLToPath(import.meta.url));
const supabaseReady = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY);

app.disable("x-powered-by");
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false }));
app.use("/api/", rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: "draft-8", legacyHeaders: false }));
app.use(express.static(path.join(root, "public")));

const db = supabaseReady
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    })
  : null;

const authClient = () => createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const demoCourses = [
  { id: "demo-1", title: "Dasturlash asoslari", subject: "IT", level: "Boshlang‘ich", description: "HTML, CSS va JavaScript asoslari." },
  { id: "demo-2", title: "Matematika", subject: "Aniq fanlar", level: "Barcha darajalar", description: "Mantiqiy fikrlash va masalalar yechish." },
  { id: "demo-3", title: "Ingliz tili", subject: "Tillar", level: "Boshlang‘ich", description: "Lug‘at, grammatika va muloqot." },
  { id: "demo-4", title: "Raqamli savodxonlik", subject: "Texnologiya", level: "Boshlang‘ich", description: "Internetdan xavfsiz foydalanish." }
];

function needSupabase(res) {
  if (!supabaseReady) {
    res.status(503).json({ error: "Supabase hali sozlanmagan. README qo‘llanmasidagi sozlashni bajaring." });
    return false;
  }
  return true;
}

function getBearer(req) {
  const value = req.headers.authorization || "";
  return value.startsWith("Bearer ") ? value.slice(7) : "";
}

async function requireUser(req, res, next) {
  if (!needSupabase(res)) return;
  const token = getBearer(req);
  if (!token) return res.status(401).json({ error: "Avval tizimga kiring." });
  const { data, error } = await authClient().auth.getUser(token);
  if (error || !data?.user) return res.status(401).json({ error: "Sessiya yaroqsiz. Qayta kiring." });
  req.user = data.user;
  next();
}

async function requireAdmin(req, res, next) {
  if (!needSupabase(res)) return;
  const { data, error } = await db.from("profiles").select("role").eq("id", req.user.id).single();
  if (error || data?.role !== "admin") return res.status(403).json({ error: "Bu bo‘lim faqat boshqaruvchilar uchun." });
  next();
}

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", app: "AIEdu", version: "2.1.0", databaseConfigured: supabaseReady });
});

app.get("/api/courses", async (_req, res) => {
  if (!supabaseReady) return res.json({ courses: demoCourses, demo: true });
  const { data, error } = await db.from("courses")
    .select("id,title,description,subject,level,created_at")
    .eq("published", true)
    .order("created_at", { ascending: false });
  if (error) return res.status(500).json({ error: "Kurslarni yuklashda xatolik." });
  res.json({ courses: data || [] });
});

app.post("/api/auth/register", async (req, res) => {
  if (!needSupabase(res)) return;
  const { email, password, fullName } = req.body || {};
  if (!email || !password || !fullName) return res.status(400).json({ error: "Ism, email va parolni to‘ldiring." });
  if (String(password).length < 8) return res.status(400).json({ error: "Parol kamida 8 belgidan iborat bo‘lsin." });
  const { data, error } = await authClient().auth.signUp({
    email: String(email).trim().toLowerCase(),
    password: String(password),
    options: { data: { full_name: String(fullName).trim(), role: "student" } }
  });
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json({
    message: data.session ? "Hisob yaratildi. Tizimga kirdingiz." : "Hisob yaratildi. Emailingizni tasdiqlang.",
    accessToken: data.session?.access_token || null,
    user: data.user ? { id: data.user.id, email: data.user.email } : null
  });
});

app.post("/api/auth/login", async (req, res) => {
  if (!needSupabase(res)) return;
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "Email va parolni kiriting." });
  const { data, error } = await authClient().auth.signInWithPassword({
    email: String(email).trim().toLowerCase(), password: String(password)
  });
  if (error) return res.status(401).json({ error: "Email yoki parol noto‘g‘ri." });
  res.json({ accessToken: data.session.access_token, user: { id: data.user.id, email: data.user.email } });
});

app.get("/api/me", requireUser, async (req, res) => {
  const { data, error } = await db.from("profiles")
    .select("id,full_name,role,created_at").eq("id", req.user.id).single();
  if (error) return res.status(404).json({ error: "Profil topilmadi." });
  res.json({ user: { ...data, email: req.user.email } });
});

app.get("/api/admin/overview", requireUser, requireAdmin, async (_req, res) => {
  const [users, courses, payments] = await Promise.all([
    db.from("profiles").select("id", { count: "exact", head: true }),
    db.from("courses").select("id", { count: "exact", head: true }),
    db.from("payments").select("id", { count: "exact", head: true })
  ]);
  res.json({
    users: users.count ?? 0,
    courses: courses.count ?? 0,
    payments: payments.count ?? 0
  });
});

app.get("/api/admin/users", requireUser, requireAdmin, async (_req, res) => {
  const { data, error } = await db.from("profiles")
    .select("id,full_name,role,created_at").order("created_at", { ascending: false }).limit(200);
  if (error) return res.status(500).json({ error: "Foydalanuvchilarni olishda xatolik." });
  res.json({ users: data || [] });
});

app.post("/api/admin/courses", requireUser, requireAdmin, async (req, res) => {
  const { title, description, subject, level } = req.body || {};
  if (!title || !subject) return res.status(400).json({ error: "Kurs nomi va fanini kiriting." });
  const { data, error } = await db.from("courses").insert({
    title: String(title).trim(), description: String(description || "").trim(),
    subject: String(subject).trim(), level: String(level || "Barcha darajalar"), published: true,
    created_by: req.user.id
  }).select().single();
  if (error) return res.status(400).json({ error: "Kursni saqlab bo‘lmadi." });
  res.status(201).json({ course: data });
});

// Payment endpoints intentionally stay disabled until merchant credentials and contracts are issued.
// Never collect or store raw bank-card numbers in AIEdu.
app.post("/api/payments/create", requireUser, async (_req, res) => {
  res.status(503).json({
    error: "Click va Payme hali merchant hisoblari bilan ulanmagan. Admin panelda faqat test rejimi yoqiladi; haqiqiy to‘lov uchun provayder kalitlari kerak."
  });
});

app.post("/api/ai/ask", requireUser, async (req, res) => {
  const question = String(req.body?.question || "").trim();
  if (!question || question.length > 4000) return res.status(400).json({ error: "Savol 1–4000 belgi oralig‘ida bo‘lsin." });
  if (!process.env.AI_API_KEY) return res.json({ answer: "AI xizmati hali ulanmagan. Administrator serverga AI_API_KEY va AI_MODEL qiymatlarini qo‘shishi kerak." });
  try {
    const response = await fetch(process.env.AI_API_URL || "https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.AI_API_KEY}` },
      body: JSON.stringify({
        model: process.env.AI_MODEL || "gpt-4o-mini",
        messages: [
          { role: "system", content: "Siz AIEdu ta'lim yordamchisisiz. O'zbek tilida aniq, yoshga mos va tushunarli javob bering." },
          { role: "user", content: question }
        ],
        temperature: 0.4
      })
    });
    const payload = await response.json();
    if (!response.ok) return res.status(502).json({ error: "AI provayderidan javob olishda xatolik." });
    res.json({ answer: payload.choices?.[0]?.message?.content || "Javob olinmadi." });
  } catch {
    res.status(502).json({ error: "AI xizmatiga ulanib bo‘lmadi." });
  }
});

app.use("/api", (_req, res) => res.status(404).json({ error: "API manzili topilmadi." }));
app.get("/{*splat}", (_req, res) => res.sendFile(path.join(root, "public", "index.html")));

app.listen(PORT, () => console.log(`AIEdu ishga tushdi: ${PORT}`));
