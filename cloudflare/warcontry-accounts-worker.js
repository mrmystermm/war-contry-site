const encoder = new TextEncoder();
const PASSWORD_ITERATIONS = 100000;
const SESSION_TTL = 30 * 24 * 60 * 60;
const VERIFY_TTL = 24 * 60 * 60;
const RESET_TTL = 60 * 60;

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers }
  });
}
function now() { return Math.floor(Date.now() / 1000); }
function randomToken(bytes = 32) {
  const value = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...value)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
async function sha256(value) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, "0")).join("");
}
function bytesToBase64(bytes) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function base64ToBytes(value) {
  const raw = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}
async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: PASSWORD_ITERATIONS }, key, 256);
  return "pbkdf2$" + PASSWORD_ITERATIONS + "$" + bytesToBase64(salt) + "$" + bytesToBase64(new Uint8Array(bits));
}
async function verifyPassword(password, stored) {
  try {
    const [kind, rounds, saltText, hashText] = stored.split("$");
    if (kind !== "pbkdf2" || Number(rounds) !== PASSWORD_ITERATIONS) return false;
    const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: base64ToBytes(saltText), iterations: Number(rounds) }, key, 256);
    const actual = bytesToBase64(new Uint8Array(bits));
    return actual === hashText;
  } catch { return false; }
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}
function siteUrl(env, path) {
  const base = String(env.SITE_URL || "").replace(/\/+$/, "");
  return base + "/" + path.replace(/^\/+/, "");
}
function corsHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowed = new Set([String(env.SITE_URL || "").replace(/\/+$/, ""), String(env.SITE_URL || "").replace(/\/+$/, "").replace("://", "://www.")]);
  const headers = { "Vary": "Origin", "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Max-Age": "86400" };
  if (allowed.has(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}
async function readJson(request) {
  const length = Number(request.headers.get("Content-Length") || 0);
  if (length > 12000) throw new Error("Requête trop volumineuse.");
  const text = await request.text();
  if (text.length > 12000) throw new Error("Requête trop volumineuse.");
  try { return JSON.parse(text || "{}"); } catch { throw new Error("Format de données invalide."); }
}
function clientIp(request) { return request.headers.get("CF-Connecting-IP") || "unknown"; }
async function rateLimit(env, key, limit, windowSeconds) {
  const timestamp = now();
  const row = await env.DB.prepare("SELECT attempts, window_started_at, blocked_until FROM auth_rate_limits WHERE rate_key = ?").bind(key).first();
  if (row && row.blocked_until && row.blocked_until > timestamp) return false;
  let attempts = row && timestamp - row.window_started_at < windowSeconds ? row.attempts : 0;
  attempts++;
  const blockedUntil = attempts > limit ? timestamp + windowSeconds : null;
  await env.DB.prepare("INSERT INTO auth_rate_limits (rate_key, attempts, window_started_at, blocked_until) VALUES (?, ?, ?, ?) ON CONFLICT(rate_key) DO UPDATE SET attempts = excluded.attempts, window_started_at = excluded.window_started_at, blocked_until = excluded.blocked_until")
    .bind(key, attempts, row && timestamp - row.window_started_at < windowSeconds ? row.window_started_at : timestamp, blockedUntil).run();
  return !blockedUntil;
}
async function sendEmail(env, to, subject, html) {
  if (!env.BREVO_API_KEY) throw new Error("Le service e-mail n'est pas configuré.");
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "accept": "application/json", "api-key": env.BREVO_API_KEY, "content-type": "application/json" },
    body: JSON.stringify({
      sender: { name: "War Contry", email: "noreply@play-warcontry.com" },
      to: [{ email: to }],
      subject,
      htmlContent: html
    })
  });
  if (!response.ok) {
    console.error("Brevo email error", response.status, (await response.text()).slice(0, 500));
    throw new Error("L'envoi de l'e-mail a échoué. Réessaie plus tard.");
  }
}
function emailTemplate(title, message, buttonText, url) {
  return '<div style="background:#07111f;padding:32px;font-family:Arial,sans-serif;color:#edf2f8"><div style="max-width:560px;margin:auto;background:#111e30;border:1px solid #34445b;border-radius:14px;padding:30px"><p style="color:#e8c46b;font-weight:bold;letter-spacing:3px">WAR CONTRY</p><h1 style="color:#f4d58d">' + title + '</h1><p style="line-height:1.7">' + message + '</p><p style="margin:28px 0"><a href="' + url + '" style="background:#e8c46b;color:#211806;padding:13px 20px;border-radius:8px;text-decoration:none;font-weight:bold">' + buttonText + '</a></p><p style="font-size:12px;color:#a9b6c8">Si tu n’es pas à l’origine de cette demande, ignore cet e-mail.</p></div></div>';
}
async function createSession(env, accountId) {
  const token = randomToken();
  const timestamp = now();
  await env.DB.prepare("INSERT INTO sessions (token_hash, account_id, expires_at, created_at) VALUES (?, ?, ?, ?)")
    .bind(await sha256(token), accountId, timestamp + SESSION_TTL, timestamp).run();
  return token;
}
async function authenticatedAccount(request, env) {
  const header = request.headers.get("Authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token || token.length > 200) return null;
  const hash = await sha256(token);
  return await env.DB.prepare(
    "SELECT accounts.id, accounts.email, accounts.username FROM sessions JOIN accounts ON accounts.id = sessions.account_id WHERE sessions.token_hash = ? AND sessions.revoked_at IS NULL AND sessions.expires_at > ? AND accounts.email_verified_at IS NOT NULL"
  ).bind(hash, now()).first();
}
async function handle(request, env) {
  if (!env.DB) return json({ ok: false, error: "La base de données n'est pas reliée." }, 500);
  const url = new URL(request.url);
  const route = url.pathname.replace(/\/+$/, "") || "/";
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(request, env) });
  const cors = corsHeaders(request, env);
  const origin = request.headers.get("Origin");
  if (origin && !cors["Access-Control-Allow-Origin"]) return json({ ok: false, error: "Origine non autorisée." }, 403);
  try {
    if (route === "/register" && request.method === "POST") {
      const data = await readJson(request);
      const username = String(data.username || "").trim();
      const email = String(data.email || "").trim().toLowerCase();
      const password = String(data.password || "");
      if (!/^[A-Za-z0-9_]{3,16}$/.test(username)) return json({ ok: false, error: "Le pseudo doit contenir de 3 à 16 lettres, chiffres ou underscores." }, 400, cors);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return json({ ok: false, error: "Adresse e-mail invalide." }, 400, cors);
      if (password.length < 12 || password.length > 128) return json({ ok: false, error: "Le mot de passe doit contenir entre 12 et 128 caractères." }, 400, cors);
      if (!await rateLimit(env, "register:" + clientIp(request), 5, 3600)) return json({ ok: false, error: "Trop de tentatives. Réessaie dans une heure." }, 429, cors);
      const id = crypto.randomUUID();
      const timestamp = now();
      const passwordHash = await hashPassword(password);
      try {
        await env.DB.prepare("INSERT INTO accounts (id, email, username, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
          .bind(id, email, username, passwordHash, timestamp, timestamp).run();
      } catch {
        return json({ ok: false, error: "Cette adresse e-mail ou ce pseudo est déjà utilisé." }, 409, cors);
      }
      const token = randomToken();
      await env.DB.prepare("INSERT INTO email_verification_tokens (token_hash, account_id, expires_at, created_at) VALUES (?, ?, ?, ?)")
        .bind(await sha256(token), id, timestamp + VERIFY_TTL, timestamp).run();
      const link = siteUrl(env, "verifier-email.html") + "?token=" + encodeURIComponent(token);
      try {
        await sendEmail(env, email, "Vérifie ton adresse e-mail — War Contry", emailTemplate("Bienvenue sur War Contry !", "Pour activer ton compte, confirme ton adresse e-mail en cliquant sur le bouton ci-dessous.", "Vérifier mon adresse", link));
      } catch (error) {
        console.error("Registration email failed", error.message);
        return json({ ok: true, message: "Compte créé, mais l'e-mail n'a pas pu être envoyé. Contacte l'équipe pour obtenir un nouveau lien." }, 200, cors);
      }
      return json({ ok: true, message: "Compte créé ! Consulte tes e-mails pour vérifier ton adresse." }, 201, cors);
    }
    if (route === "/verify" && request.method === "POST") {
      const data = await readJson(request);
      const token = String(data.token || "");
      if (token.length < 20 || token.length > 200) return json({ ok: false, error: "Lien de vérification invalide." }, 400, cors);
      const hash = await sha256(token);
      const row = await env.DB.prepare("SELECT account_id, expires_at, used_at FROM email_verification_tokens WHERE token_hash = ?").bind(hash).first();
      if (!row || row.used_at || row.expires_at < now()) return json({ ok: false, error: "Ce lien est invalide ou expiré." }, 400, cors);
      const timestamp = now();
      await env.DB.batch([
        env.DB.prepare("UPDATE accounts SET email_verified_at = ?, updated_at = ? WHERE id = ?").bind(timestamp, timestamp, row.account_id),
        env.DB.prepare("UPDATE email_verification_tokens SET used_at = ? WHERE token_hash = ?").bind(timestamp, hash)
      ]);
      const account = await env.DB.prepare("SELECT id, email, username FROM accounts WHERE id = ?").bind(row.account_id).first();
      const sessionToken = await createSession(env, row.account_id);
      return json({ ok: true, token: sessionToken, account: { username: account.username, email: account.email }, message: "Adresse e-mail vérifiée ! Tu es maintenant connecté." }, 200, cors);
    }
    if (route === "/login" && request.method === "POST") {
      const data = await readJson(request);
      const email = String(data.email || "").trim().toLowerCase();
      const password = String(data.password || "");
      const ipKey = "login-ip:" + clientIp(request);
      const emailKey = "login-email:" + email;
      if (!await rateLimit(env, ipKey, 20, 900) || !await rateLimit(env, emailKey, 10, 900)) return json({ ok: false, error: "Trop de tentatives. Réessaie dans 15 minutes." }, 429, cors);
      const account = await env.DB.prepare("SELECT id, email, username, password_hash, email_verified_at FROM accounts WHERE email = ?").bind(email).first();
      if (!account || !await verifyPassword(password, account.password_hash)) return json({ ok: false, error: "Adresse e-mail ou mot de passe incorrect." }, 401, cors);
      if (!account.email_verified_at) return json({ ok: false, error: "Vérifie d'abord ton adresse e-mail." }, 403, cors);
      const token = await createSession(env, account.id);
      return json({ ok: true, token, account: { username: account.username, email: account.email }, message: "Connexion réussie." }, 200, cors);
    }
    if (route === "/forgot-password" && request.method === "POST") {
      const data = await readJson(request);
      const email = String(data.email || "").trim().toLowerCase();
      if (!await rateLimit(env, "forgot:" + clientIp(request), 5, 3600)) return json({ ok: false, error: "Trop de demandes. Réessaie plus tard." }, 429, cors);
      const generic = "Si un compte vérifié correspond à cette adresse, un e-mail de récupération va être envoyé.";
      const account = await env.DB.prepare("SELECT id, email FROM accounts WHERE email = ? AND email_verified_at IS NOT NULL").bind(email).first();
      if (account) {
        const timestamp = now();
        const recent = await env.DB.prepare("SELECT created_at FROM password_reset_tokens WHERE account_id = ? ORDER BY created_at DESC LIMIT 1").bind(account.id).first();
        if (recent && timestamp - recent.created_at < 60) return json({ ok: true, message: generic }, 200, cors);
        const token = randomToken();
        await env.DB.prepare("INSERT INTO password_reset_tokens (token_hash, account_id, expires_at, created_at) VALUES (?, ?, ?, ?)").bind(await sha256(token), account.id, timestamp + RESET_TTL, timestamp).run();
        const link = siteUrl(env, "reinitialiser-mot-de-passe.html") + "?token=" + encodeURIComponent(token);
        try { await sendEmail(env, account.email, "Réinitialisation du mot de passe — War Contry", emailTemplate("Réinitialiser ton mot de passe", "Une demande de changement de mot de passe a été effectuée pour ton compte. Le lien expire dans une heure.", "Choisir un nouveau mot de passe", link)); }
        catch (error) { console.error("Reset email failed", error.message); }
      }
      return json({ ok: true, message: generic }, 200, cors);
    }
    if (route === "/reset-password" && request.method === "POST") {
      const data = await readJson(request);
      const token = String(data.token || "");
      const password = String(data.password || "");
      if (password.length < 12 || password.length > 128) return json({ ok: false, error: "Le mot de passe doit contenir entre 12 et 128 caractères." }, 400, cors);
      const hash = await sha256(token);
      const row = await env.DB.prepare("SELECT account_id, expires_at, used_at FROM password_reset_tokens WHERE token_hash = ?").bind(hash).first();
      if (!row || row.used_at || row.expires_at < now()) return json({ ok: false, error: "Ce lien est invalide ou expiré." }, 400, cors);
      const timestamp = now();
      const passwordHash = await hashPassword(password);
      await env.DB.batch([
        env.DB.prepare("UPDATE accounts SET password_hash = ?, updated_at = ? WHERE id = ?").bind(passwordHash, timestamp, row.account_id),
        env.DB.prepare("UPDATE password_reset_tokens SET used_at = ? WHERE token_hash = ?").bind(timestamp, hash),
        env.DB.prepare("UPDATE sessions SET revoked_at = ? WHERE account_id = ? AND revoked_at IS NULL").bind(timestamp, row.account_id)
      ]);
      return json({ ok: true, message: "Mot de passe modifié. Tu peux maintenant te connecter." }, 200, cors);
    }
    if (route === "/me" && request.method === "GET") {
      const account = await authenticatedAccount(request, env);
      if (!account) return json({ ok: false, error: "Session expirée. Reconnecte-toi." }, 401, cors);
      return json({ ok: true, account }, 200, cors);
    }
    if (route === "/username" && request.method === "PUT") {
      const account = await authenticatedAccount(request, env);
      if (!account) return json({ ok: false, error: "Session expirée. Reconnecte-toi." }, 401, cors);
      if (!await rateLimit(env, "username:" + account.id, 5, 3600)) return json({ ok: false, error: "Trop de tentatives. Réessaie dans une heure." }, 429, cors);
      const data = await readJson(request);
      const username = String(data.username || "").trim();
      const currentPassword = String(data.currentPassword || "");
      if (!/^[A-Za-z0-9_]{3,16}$/.test(username)) return json({ ok: false, error: "Le pseudo doit contenir de 3 à 16 lettres, chiffres ou underscores." }, 400, cors);
      if (!currentPassword || currentPassword.length > 128) return json({ ok: false, error: "Saisis ton mot de passe actuel pour confirmer." }, 400, cors);
      const credentials = await env.DB.prepare("SELECT password_hash FROM accounts WHERE id = ?").bind(account.id).first();
      if (!credentials || !await verifyPassword(currentPassword, credentials.password_hash)) return json({ ok: false, error: "Mot de passe actuel incorrect." }, 401, cors);
      const existing = await env.DB.prepare("SELECT id FROM accounts WHERE lower(username) = lower(?) AND id != ?").bind(username, account.id).first();
      if (existing) return json({ ok: false, error: "Ce pseudo est déjà utilisé." }, 409, cors);
      try {
        await env.DB.prepare("UPDATE accounts SET username = ?, updated_at = ? WHERE id = ?").bind(username, now(), account.id).run();
      } catch {
        return json({ ok: false, error: "Ce pseudo est déjà utilisé." }, 409, cors);
      }
      return json({ ok: true, account: { username, email: account.email }, message: "Ton pseudo a bien été modifié." }, 200, cors);
    }
    if (route === "/preferences" && (request.method === "GET" || request.method === "PUT")) {
      const account = await authenticatedAccount(request, env);
      if (!account) return json({ ok: false, error: "Session expirée. Reconnecte-toi." }, 401, cors);
      if (request.method === "GET") {
        const preferences = await env.DB.prepare("SELECT language, theme FROM account_preferences WHERE account_id = ?").bind(account.id).first();
        return json({ ok: true, preferences: { language: preferences?.language || "fr", theme: preferences?.theme || "dark" } }, 200, cors);
      }
      const data = await readJson(request);
      const language = String(data.language || "");
      const theme = String(data.theme || "");
      if (!["fr", "en"].includes(language)) return json({ ok: false, error: "Langue non prise en charge." }, 400, cors);
      if (!["dark", "light"].includes(theme)) return json({ ok: false, error: "Thème non pris en charge." }, 400, cors);
      await env.DB.prepare("INSERT INTO account_preferences (account_id, language, theme, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(account_id) DO UPDATE SET language = excluded.language, theme = excluded.theme, updated_at = excluded.updated_at")
        .bind(account.id, language, theme, now()).run();
      return json({ ok: true, preferences: { language, theme }, message: "Préférences enregistrées." }, 200, cors);
    }
    if (route === "/logout" && request.method === "POST") {
      const header = request.headers.get("Authorization") || "";
      const token = header.startsWith("Bearer ") ? header.slice(7) : "";
      if (token) await env.DB.prepare("UPDATE sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL").bind(now(), await sha256(token)).run();
      return json({ ok: true, message: "Déconnexion effectuée." }, 200, cors);
    }
    if (route === "/progress" && (request.method === "GET" || request.method === "PUT")) {
      const account = await authenticatedAccount(request, env);
      if (!account) return json({ ok: false, error: "Session expirée. Reconnecte-toi." }, 401, cors);
      if (request.method === "GET") {
        const row = await env.DB.prepare("SELECT data_json, updated_at FROM player_progress WHERE account_id = ?").bind(account.id).first();
        return json({ ok: true, progress: row ? JSON.parse(row.data_json) : {}, updated_at: row ? row.updated_at : null }, 200, cors);
      }
      const data = await readJson(request);
      const serialized = JSON.stringify(data.progress ?? {});
      if (serialized.length > 50000) return json({ ok: false, error: "Les données envoyées sont trop volumineuses." }, 413, cors);
      await env.DB.prepare("INSERT INTO player_progress (account_id, data_json, updated_at) VALUES (?, ?, ?) ON CONFLICT(account_id) DO UPDATE SET data_json = excluded.data_json, updated_at = excluded.updated_at")
        .bind(account.id, serialized, now()).run();
      return json({ ok: true, message: "Progression sauvegardée." }, 200, cors);
    }
    return json({ ok: false, error: "Route introuvable." }, 404, cors);
  } catch (error) {
    console.error("Worker error", error && error.stack ? error.stack : error);
    return json({ ok: false, error: error.message || "Erreur interne." }, 500, cors);
  }
}
export default {
  async fetch(request, env, ctx) {
    return handle(request, env);
  }
};