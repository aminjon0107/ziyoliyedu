const $ = (id) => document.getElementById(id);
let mode = "login";
let accessToken = localStorage.getItem("aiedu_token") || "";

$("year").textContent = new Date().getFullYear();

async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  const response = await fetch(path, { ...options, headers });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Server bilan aloqa xatosi.");
  return payload;
}

async function loadHealth() {
  try {
    const h = await api("/api/health");
    $("serverState").textContent = h.databaseConfigured ? "Server va baza ulangan" : "Demo rejim";
  } catch { $("serverState").textContent = "Server tekshiruvi kerak"; }
}

async function loadCourses() {
  try {
    const { courses } = await api("/api/courses");
    $("courseCount").textContent = `${courses.length} ta kurs`;
    $("courseList").innerHTML = courses.map((c) => `
      <article class="course-card">
        <span class="tag">${escapeHtml(c.subject || "Ta’lim")}</span>
        <h3>${escapeHtml(c.title)}</h3>
        <p>${escapeHtml(c.description || "")}</p>
        <small class="muted">${escapeHtml(c.level || "")}</small>
      </article>`).join("") || "<p>Hozircha kurslar yo‘q.</p>";
  } catch (e) { $("courseList").textContent = e.message; }
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
}

document.querySelectorAll("[data-tab]").forEach((button) => button.addEventListener("click", () => {
  mode = button.dataset.tab;
  document.querySelectorAll("[data-tab]").forEach((b) => b.classList.toggle("active", b === button));
  $("nameWrap").classList.toggle("hidden", mode !== "register");
  $("authSubmit").textContent = mode === "login" ? "Kirish" : "Hisob yaratish";
  $("password").autocomplete = mode === "login" ? "current-password" : "new-password";
  $("authMessage").textContent = "";
}));

$("authForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  $("authSubmit").disabled = true;
  $("authMessage").textContent = "Tekshirilmoqda…";
  try {
    const payload = mode === "login"
      ? await api("/api/auth/login", { method: "POST", body: JSON.stringify({ email: $("email").value, password: $("password").value }) })
      : await api("/api/auth/register", { method: "POST", body: JSON.stringify({ email: $("email").value, password: $("password").value, fullName: $("fullName").value }) });
    if (payload.accessToken) {
      accessToken = payload.accessToken;
      localStorage.setItem("aiedu_token", accessToken);
      await loadProfile();
    }
    $("authMessage").textContent = payload.message || "Muvaffaqiyatli bajarildi.";
  } catch (e) { $("authMessage").textContent = e.message; }
  finally { $("authSubmit").disabled = false; }
});

async function loadProfile() {
  if (!accessToken) return;
  try {
    const { user } = await api("/api/me");
    $("authMessage").textContent = `Xush kelibsiz, ${user.full_name || user.email}! Rol: ${user.role}.`;
    $("logoutBtn").classList.remove("hidden");
    if (user.role === "admin") await loadAdmin();
  } catch {
    accessToken = "";
    localStorage.removeItem("aiedu_token");
  }
}
async function loadAdmin() {
  $("adminArea").classList.remove("hidden");
  try {
    const overview = await api("/api/admin/overview");
    $("adminSummary").textContent = `Foydalanuvchilar: ${overview.users} · Kurslar: ${overview.courses} · To‘lov yozuvlari: ${overview.payments}`;
    const { users } = await api("/api/admin/users");
    $("userList").innerHTML = users.slice(0, 12).map((u) => `<div class="user-row">${escapeHtml(u.full_name || "Ismsiz")} — ${escapeHtml(u.role)}</div>`).join("");
  } catch (e) { $("adminSummary").textContent = e.message; }
}
$("logoutBtn").addEventListener("click", () => {
  accessToken = "";
  localStorage.removeItem("aiedu_token");
  $("logoutBtn").classList.add("hidden");
  $("adminArea").classList.add("hidden");
  $("authMessage").textContent = "Tizimdan chiqdingiz.";
});
loadHealth();
loadCourses();
loadProfile();