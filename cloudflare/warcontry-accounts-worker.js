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
async function emailCodeMac(env, challengeId, code) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(String(env.BREVO_API_KEY || "")), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(challengeId + ":" + code));
  return [...new Uint8Array(signature)].map(x => x.toString(16).padStart(2, "0")).join("");
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
  const headers = { "Vary": "Origin", "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Minecraft-Link-Secret", "Access-Control-Max-Age": "86400" };
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
      const account = await env.DB.prepare("SELECT id, email, username, password_hash, email_verified_at, email_2fa_enabled FROM accounts WHERE email = ?").bind(email).first();
      if (!account || !await verifyPassword(password, account.password_hash)) return json({ ok: false, error: "Adresse e-mail ou mot de passe incorrect." }, 401, cors);
      if (!account.email_verified_at) return json({ ok: false, error: "Vérifie d'abord ton adresse e-mail." }, 403, cors);
      if (account.email_2fa_enabled === 1) {
        const recent = await env.DB.prepare("SELECT created_at FROM email_2fa_challenges WHERE account_id = ? AND purpose = 'login' AND used_at IS NULL ORDER BY created_at DESC LIMIT 1").bind(account.id).first();
        if (recent && now() - recent.created_at < 45) return json({ ok: false, error: "Un code vient déjà d'être envoyé. Attends quelques secondes." }, 429, cors);
        const challengeId = crypto.randomUUID();
        const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, "0");
        const timestamp = now();
        await env.DB.prepare("INSERT INTO email_2fa_challenges (id, account_id, purpose, code_mac, expires_at, attempts, created_at) VALUES (?, ?, 'login', ?, ?, 0, ?)").bind(challengeId, account.id, await emailCodeMac(env, challengeId, code), timestamp + 600, timestamp).run();
        try {
          await sendEmail(env, account.email, "Ton code de connexion — War Contry", '<div style="background:#07111f;padding:32px;font-family:Arial,sans-serif;color:#edf2f8"><div style="max-width:560px;margin:auto;background:#111e30;border:1px solid #34445b;border-radius:14px;padding:30px"><p style="color:#e8c46b;font-weight:bold;letter-spacing:3px">WAR CONTRY</p><h1 style="color:#f4d58d">Code de connexion</h1><p>Voici ton code de sécurité :</p><p style="font-size:32px;letter-spacing:8px;font-weight:bold;color:#f4d58d">' + code + '</p><p>Ce code expire dans 10 minutes et ne peut être utilisé qu’une fois.</p></div></div>');
        } catch (error) {
          await env.DB.prepare("UPDATE email_2fa_challenges SET used_at = ? WHERE id = ?").bind(timestamp, challengeId).run();
          throw error;
        }
        return json({ ok: true, requires2FA: true, challengeId, message: "Un code de sécurité vient d'être envoyé à ton adresse e-mail." }, 200, cors);
      }
      const token = await createSession(env, account.id);
      return json({ ok: true, token, account: { username: account.username, email: account.email }, message: "Connexion réussie." }, 200, cors);
    }
    if (route === "/verify-login-code" && request.method === "POST") {
      const data = await readJson(request);
      const challengeId = String(data.challengeId || "");
      const code = String(data.code || "").trim();
      if (!/^[0-9]{6}$/.test(code) || challengeId.length > 80) return json({ ok: false, error: "Code invalide." }, 400, cors);
      const challenge = await env.DB.prepare("SELECT id, account_id, code_mac, expires_at, attempts, used_at FROM email_2fa_challenges WHERE id = ? AND purpose = 'login'").bind(challengeId).first();
      if (!challenge || challenge.used_at || challenge.expires_at < now() || challenge.attempts >= 5) return json({ ok: false, error: "Ce code est invalide ou expiré. Recommence la connexion." }, 400, cors);
      const expected = await emailCodeMac(env, challengeId, code);
      if (expected !== challenge.code_mac) {
        await env.DB.prepare("UPDATE email_2fa_challenges SET attempts = attempts + 1 WHERE id = ?").bind(challengeId).run();
        return json({ ok: false, error: "Code incorrect." }, 401, cors);
      }
      const timestamp = now();
      await env.DB.prepare("UPDATE email_2fa_challenges SET used_at = ? WHERE id = ? AND used_at IS NULL").bind(timestamp, challengeId).run();
      const account = await env.DB.prepare("SELECT id, email, username, email_2fa_enabled FROM accounts WHERE id = ?").bind(challenge.account_id).first();
      if (!account || account.email_2fa_enabled !== 1) return json({ ok: false, error: "La vérification de sécurité n'est plus valide. Recommence la connexion." }, 400, cors);
      const token = await createSession(env, account.id);
      return json({ ok: true, token, account: { username: account.username, email: account.email }, message: "Connexion réussie." }, 200, cors);
    }
    if (route === "/email-2fa-status" && request.method === "GET") {
      const account = await authenticatedAccount(request, env);
      if (!account) return json({ ok: false, error: "Session expirée. Reconnecte-toi." }, 401, cors);
      const row = await env.DB.prepare("SELECT email_2fa_enabled FROM accounts WHERE id = ?").bind(account.id).first();
      return json({ ok: true, enabled: row.email_2fa_enabled === 1 }, 200, cors);
    }
    if (route === "/email-2fa-request" && request.method === "POST") {
      const account = await authenticatedAccount(request, env);
      if (!account) return json({ ok: false, error: "Session expirée. Reconnecte-toi." }, 401, cors);
      if (!await rateLimit(env, "email-2fa:" + account.id, 5, 3600)) return json({ ok: false, error: "Trop de demandes. Réessaie dans une heure." }, 429, cors);
      const data = await readJson(request);
      const purpose = String(data.purpose || "");
      const password = String(data.password || "");
      if (!["enable", "disable"].includes(purpose)) return json({ ok: false, error: "Demande invalide." }, 400, cors);
      const current = await env.DB.prepare("SELECT password_hash, email_2fa_enabled FROM accounts WHERE id = ?").bind(account.id).first();
      if (!current || !await verifyPassword(password, current.password_hash)) return json({ ok: false, error: "Mot de passe actuel incorrect." }, 401, cors);
      if ((purpose === "enable" && current.email_2fa_enabled === 1) || (purpose === "disable" && current.email_2fa_enabled === 0)) return json({ ok: false, error: "Ce réglage est déjà dans cet état." }, 400, cors);
      const recent = await env.DB.prepare("SELECT created_at FROM email_2fa_challenges WHERE account_id = ? AND purpose = ? AND used_at IS NULL ORDER BY created_at DESC LIMIT 1").bind(account.id, purpose).first();
      if (recent && now() - recent.created_at < 45) return json({ ok: false, error: "Un code vient déjà d'être envoyé. Attends quelques secondes." }, 429, cors);
      const challengeId = crypto.randomUUID();
      const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, "0");
      const timestamp = now();
      await env.DB.prepare("INSERT INTO email_2fa_challenges (id, account_id, purpose, code_mac, expires_at, attempts, created_at) VALUES (?, ?, ?, ?, ?, 0, ?)").bind(challengeId, account.id, purpose, await emailCodeMac(env, challengeId, code), timestamp + 600, timestamp).run();
      const subject = purpose === "enable" ? "Activation de l'A2F — War Contry" : "Désactivation de l'A2F — War Contry";
      try {
        await sendEmail(env, account.email, subject, '<div style="background:#07111f;padding:32px;font-family:Arial,sans-serif;color:#edf2f8"><div style="max-width:560px;margin:auto;background:#111e30;border:1px solid #34445b;border-radius:14px;padding:30px"><p style="color:#e8c46b;font-weight:bold;letter-spacing:3px">WAR CONTRY</p><h1 style="color:#f4d58d">Confirmation de sécurité</h1><p>Voici ton code de confirmation :</p><p style="font-size:32px;letter-spacing:8px;font-weight:bold;color:#f4d58d">' + code + '</p><p>Ce code expire dans 10 minutes.</p></div></div>');
      } catch (error) {
        await env.DB.prepare("UPDATE email_2fa_challenges SET used_at = ? WHERE id = ?").bind(timestamp, challengeId).run();
        throw error;
      }
      return json({ ok: true, challengeId, message: "Un code de confirmation vient d'être envoyé à ton adresse e-mail." }, 200, cors);
    }
    if (route === "/email-2fa-confirm" && request.method === "POST") {
      const account = await authenticatedAccount(request, env);
      if (!account) return json({ ok: false, error: "Session expirée. Reconnecte-toi." }, 401, cors);
      const data = await readJson(request);
      const challengeId = String(data.challengeId || "");
      const code = String(data.code || "").trim();
      if (!/^[0-9]{6}$/.test(code) || challengeId.length > 80) return json({ ok: false, error: "Code invalide." }, 400, cors);
      const challenge = await env.DB.prepare("SELECT id, purpose, code_mac, expires_at, attempts, used_at FROM email_2fa_challenges WHERE id = ? AND account_id = ? AND purpose IN ('enable', 'disable')").bind(challengeId, account.id).first();
      if (!challenge || challenge.used_at || challenge.expires_at < now() || challenge.attempts >= 5) return json({ ok: false, error: "Ce code est invalide ou expiré. Recommence la demande." }, 400, cors);
      if (await emailCodeMac(env, challengeId, code) !== challenge.code_mac) {
        await env.DB.prepare("UPDATE email_2fa_challenges SET attempts = attempts + 1 WHERE id = ?").bind(challengeId).run();
        return json({ ok: false, error: "Code incorrect." }, 401, cors);
      }
      const timestamp = now();
      await env.DB.batch([
        env.DB.prepare("UPDATE email_2fa_challenges SET used_at = ? WHERE id = ? AND used_at IS NULL").bind(timestamp, challengeId),
        env.DB.prepare("UPDATE accounts SET email_2fa_enabled = ? WHERE id = ?").bind(challenge.purpose === "enable" ? 1 : 0, account.id)
      ]);
      return json({ ok: true, enabled: challenge.purpose === "enable", message: challenge.purpose === "enable" ? "L'authentification à deux facteurs est maintenant activée." : "L'authentification à deux facteurs a été désactivée." }, 200, cors);
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
    if (route === "/change-password" && request.method === "POST") {
      const account = await authenticatedAccount(request, env);
      if (!account) return json({ ok: false, error: "Session expirée. Reconnecte-toi." }, 401, cors);
      if (!await rateLimit(env, "password-change:" + account.id, 5, 3600)) return json({ ok: false, error: "Trop de tentatives. Réessaie dans une heure." }, 429, cors);
      const data = await readJson(request);
      const currentPassword = String(data.currentPassword || "");
      const newPassword = String(data.newPassword || "");
      if (!currentPassword || currentPassword.length > 128) return json({ ok: false, error: "Saisis ton mot de passe actuel." }, 400, cors);
      if (newPassword.length < 12 || newPassword.length > 128) return json({ ok: false, error: "Le nouveau mot de passe doit contenir entre 12 et 128 caractères." }, 400, cors);
      const credentials = await env.DB.prepare("SELECT password_hash FROM accounts WHERE id = ?").bind(account.id).first();
      if (!credentials || !await verifyPassword(currentPassword, credentials.password_hash)) return json({ ok: false, error: "Mot de passe actuel incorrect." }, 401, cors);
      if (await verifyPassword(newPassword, credentials.password_hash)) return json({ ok: false, error: "Le nouveau mot de passe doit être différent de l'ancien." }, 400, cors);
      const timestamp = now();
      const passwordHash = await hashPassword(newPassword);
      const authorization = request.headers.get("Authorization") || "";
      const currentToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
      const currentTokenHash = await sha256(currentToken);
      await env.DB.batch([
        env.DB.prepare("UPDATE accounts SET password_hash = ?, updated_at = ? WHERE id = ?").bind(passwordHash, timestamp, account.id),
        env.DB.prepare("UPDATE sessions SET revoked_at = ? WHERE account_id = ? AND token_hash != ? AND revoked_at IS NULL").bind(timestamp, account.id, currentTokenHash)
      ]);
      try {
        await sendEmail(env, account.email, "Mot de passe modifié — War Contry", emailTemplate("Mot de passe modifié", "Le mot de passe de ton compte War Contry vient d’être modifié. Les autres sessions de ton compte ont été déconnectées. Si tu n’es pas à l’origine de cette modification, utilise immédiatement la récupération de compte.", "Ouvrir War Contry", siteUrl(env, "connexion.html")));
      } catch (error) {
        console.error("Password change notification failed", error.message);
      }
      return json({ ok: true, message: "Ton mot de passe a été modifié. Les autres appareils ont été déconnectés." }, 200, cors);
    }
    if (route === "/request-account-deletion" && request.method === "POST") {
      const account = await authenticatedAccount(request, env);
      if (!account) return json({ ok: false, error: "Session expirée. Reconnecte-toi." }, 401, cors);
      if (!await rateLimit(env, "account-delete:" + account.id, 3, 86400)) return json({ ok: false, error: "Trop de demandes de suppression. Réessaie demain." }, 429, cors);
      const data = await readJson(request);
      const password = String(data.password || "");
      const confirmation = String(data.confirmation || "");
      if (!password || password.length > 128) return json({ ok: false, error: "Saisis ton mot de passe actuel." }, 400, cors);
      if (confirmation !== "SUPPRIMER") return json({ ok: false, error: "Saisis exactement SUPPRIMER pour confirmer ta demande." }, 400, cors);
      const credentials = await env.DB.prepare("SELECT password_hash FROM accounts WHERE id = ?").bind(account.id).first();
      if (!credentials || !await verifyPassword(password, credentials.password_hash)) return json({ ok: false, error: "Mot de passe actuel incorrect." }, 401, cors);
      const timestamp = now();
      const token = randomToken();
      const tokenHash = await sha256(token);
      await env.DB.batch([
        env.DB.prepare("UPDATE account_deletion_tokens SET used_at = ? WHERE account_id = ? AND used_at IS NULL").bind(timestamp, account.id),
        env.DB.prepare("INSERT INTO account_deletion_tokens (token_hash, account_id, expires_at, created_at) VALUES (?, ?, ?, ?)").bind(tokenHash, account.id, timestamp + 60 * 60, timestamp)
      ]);
      const link = siteUrl(env, "confirmer-suppression-compte.html") + "?token=" + encodeURIComponent(token);
      try {
        await sendEmail(env, account.email, "Confirme la suppression de ton compte — War Contry", emailTemplate(
          "Confirme la suppression de ton compte",
          "Une demande de suppression définitive a été effectuée pour le compte " + escapeHtml(account.username) + ". Si tu es à l'origine de cette demande, ouvre le lien ci-dessous puis confirme une dernière fois. Ce lien expire dans une heure. Si tu n'es pas à l'origine de cette demande, ignore cet e-mail : ton compte ne sera pas supprimé.",
          "Continuer la suppression",
          link
        ));
      } catch (error) {
        await env.DB.prepare("UPDATE account_deletion_tokens SET used_at = ? WHERE token_hash = ?").bind(now(), tokenHash).run();
        console.error("Account deletion email failed", error.message);
        return json({ ok: false, error: "L'e-mail de confirmation n'a pas pu être envoyé. Ton compte n'a pas été supprimé. Réessaie plus tard." }, 502, cors);
      }
      return json({ ok: true, message: "Un e-mail de confirmation a été envoyé à l'adresse de ton compte. Ton compte ne sera supprimé qu'après la confirmation depuis cet e-mail." }, 200, cors);
    }
    if (route === "/confirm-account-deletion" && request.method === "POST") {
      const data = await readJson(request);
      const token = String(data.token || "");
      if (token.length < 20 || token.length > 200) return json({ ok: false, error: "Lien de confirmation invalide." }, 400, cors);
      const tokenHash = await sha256(token);
      const deletion = await env.DB.prepare("SELECT account_id, expires_at, used_at FROM account_deletion_tokens WHERE token_hash = ?").bind(tokenHash).first();
      if (!deletion || deletion.used_at || deletion.expires_at < now()) return json({ ok: false, error: "Ce lien est invalide, déjà utilisé ou expiré. Recommence la demande depuis ton compte." }, 400, cors);
      const account = await env.DB.prepare("SELECT id, email, username FROM accounts WHERE id = ?").bind(deletion.account_id).first();
      if (!account) return json({ ok: false, error: "Ce compte n'existe plus." }, 404, cors);
      const timestamp = now();
      await env.DB.batch([
        env.DB.prepare("UPDATE account_deletion_tokens SET used_at = ? WHERE token_hash = ? AND used_at IS NULL").bind(timestamp, tokenHash),
        env.DB.prepare("DELETE FROM sessions WHERE account_id = ?").bind(account.id),
        env.DB.prepare("DELETE FROM email_verification_tokens WHERE account_id = ?").bind(account.id),
        env.DB.prepare("DELETE FROM password_reset_tokens WHERE account_id = ?").bind(account.id),
        env.DB.prepare("DELETE FROM email_change_tokens WHERE account_id = ?").bind(account.id),
        env.DB.prepare("DELETE FROM email_2fa_challenges WHERE account_id = ?").bind(account.id),
        env.DB.prepare("DELETE FROM account_preferences WHERE account_id = ?").bind(account.id),
        env.DB.prepare("DELETE FROM player_progress WHERE account_id = ?").bind(account.id),
        env.DB.prepare("DELETE FROM account_votes WHERE account_id = ?").bind(account.id),
        env.DB.prepare("DELETE FROM account_deletion_tokens WHERE account_id = ?").bind(account.id),
        env.DB.prepare("DELETE FROM auth_rate_limits WHERE rate_key IN (?, ?, ?, ?, ?, ?)").bind(
          "account-delete:" + account.id,
          "email-2fa:" + account.id,
          "password-change:" + account.id,
          "username:" + account.id,
          "email-change:" + account.id,
          "login-email:" + String(account.email).toLowerCase()
        ),
        env.DB.prepare("DELETE FROM accounts WHERE id = ?").bind(account.id)
      ]);
      try {
        await sendEmail(env, account.email, "Compte War Contry supprimé", emailTemplate(
          "Ton compte a été supprimé",
          "Le compte War Contry associé au pseudo " + escapeHtml(account.username) + " a été supprimé définitivement. Si tu n'es pas à l'origine de cette action, contacte l'équipe War Contry.",
          "Retourner sur War Contry",
          siteUrl(env, "index.html")
        ));
      } catch (error) {
        console.error("Account deletion notification failed", error.message);
      }
      return json({ ok: true, message: "Ton compte War Contry a été supprimé définitivement." }, 200, cors);
    }
    if (route === "/skin-status" && request.method === "GET") {
      const account = await authenticatedAccount(request, env);
      if (!account) return json({ ok: false, error: "Session expirée. Reconnecte-toi." }, 401, cors);
      if (!env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY) return json({ ok: false, error: "Le stockage des skins n'est pas configuré." }, 503, cors);
      const publicUrl = String(env.SUPABASE_URL).replace(/\/+$/, "") + "/storage/v1/object/public/minecraft-skins/" + encodeURIComponent(account.id) + "/skin.png";
      return json({ ok: true, skinUrl: publicUrl }, 200, cors);
    }
    if (route === "/skin-upload" && request.method === "POST") {
      const account = await authenticatedAccount(request, env);
      if (!account) return json({ ok: false, error: "Session expirée. Reconnecte-toi." }, 401, cors);
      if (!env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY) return json({ ok: false, error: "Le stockage des skins n'est pas configuré." }, 503, cors);
      if (!await rateLimit(env, "skin-upload:" + account.id, 10, 3600)) return json({ ok: false, error: "Tu as atteint la limite d'envoi. Réessaie dans une heure." }, 429, cors);
      const contentLength = Number(request.headers.get("Content-Length") || 0);
      if (contentLength > 1024 * 1024 + 16000) return json({ ok: false, error: "Le fichier est trop volumineux (1 Mo maximum)." }, 413, cors);
      const form = await request.formData();
      const file = form.get("skin");
      if (!file || typeof file.arrayBuffer !== "function") return json({ ok: false, error: "Sélectionne un fichier PNG." }, 400, cors);
      if (file.size < 100 || file.size > 1024 * 1024) return json({ ok: false, error: "Le skin doit peser entre 100 octets et 1 Mo." }, 400, cors);
      if (file.type !== "image/png" && !String(file.name || "").toLowerCase().endsWith(".png")) return json({ ok: false, error: "Seuls les fichiers PNG sont acceptés." }, 400, cors);
      const bytes = new Uint8Array(await file.arrayBuffer());
      const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10];
      if (!pngSignature.every((value, index) => bytes[index] === value)) return json({ ok: false, error: "Le fichier sélectionné n'est pas un PNG valide." }, 400, cors);
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      const width = view.getUint32(16);
      const height = view.getUint32(20);
      if (width !== 64 || height !== 64) return json({ ok: false, error: "Le skin doit avoir une taille de 64 × 64 pixels." }, 400, cors);
      const base = String(env.SUPABASE_URL).replace(/\/+$/, "");
      const objectPath = encodeURIComponent(account.id) + "/skin.png";
      const upload = await fetch(base + "/storage/v1/object/minecraft-skins/" + objectPath, {
        method: "PUT",
        headers: {
          "Authorization": "Bearer " + env.SUPABASE_SECRET_KEY,
          "apikey": env.SUPABASE_SECRET_KEY,
          "Content-Type": "image/png",
          "x-upsert": "true",
          "Cache-Control": "3600"
        },
        body: bytes
      });
      if (!upload.ok) {
        console.error("Supabase skin upload failed", upload.status, (await upload.text()).slice(0, 500));
        return json({ ok: false, error: "Le stockage Supabase a refusé le fichier. Réessaie plus tard." }, 502, cors);
      }
      const skinUrl = base + "/storage/v1/object/public/minecraft-skins/" + objectPath + "?v=" + now();
      return json({ ok: true, skinUrl, message: "Ton skin a été enregistré sur ton compte." }, 200, cors);
    }
    if (route === "/minecraft-link-create" && request.method === "POST") {
      const suppliedSecret = request.headers.get("X-Minecraft-Link-Secret") || "";
      if (!env.MINECRAFT_LINK_SECRET || String(env.MINECRAFT_LINK_SECRET).length < 32 ||
          !suppliedSecret || await sha256(suppliedSecret) !== await sha256(String(env.MINECRAFT_LINK_SECRET))) {
        return json({ ok: false, error: "Accès serveur refusé." }, 403, cors);
      }
      const data = await readJson(request);
      const minecraftUuid = String(data.minecraftUuid || "").trim().toLowerCase();
      const minecraftUsername = String(data.minecraftUsername || "").trim();
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(minecraftUuid)) {
        return json({ ok: false, error: "UUID Minecraft invalide." }, 400, cors);
      }
      if (!/^[A-Za-z0-9_]{3,16}$/.test(minecraftUsername)) {
        return json({ ok: false, error: "Pseudo Minecraft invalide." }, 400, cors);
      }
      if (!await rateLimit(env, "minecraft-code:" + minecraftUuid, 4, 300)) {
        return json({ ok: false, error: "Un code vient déjà d'être généré récemment. Réessaie dans quelques minutes." }, 429, cors);
      }
      const timestamp = now();
      await env.DB.prepare("DELETE FROM minecraft_link_codes WHERE expires_at <= ? OR used_at IS NOT NULL").bind(timestamp).run();
      const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 100000000).padStart(8, "0");
      await env.DB.prepare("INSERT INTO minecraft_link_codes (id, code_hash, minecraft_uuid, minecraft_username, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)")
        .bind(crypto.randomUUID(), await sha256(code), minecraftUuid, minecraftUsername, timestamp + 300, timestamp).run();
      return json({ ok: true, code, expiresIn: 300, message: "Code temporaire généré." }, 200, cors);
    }
    if (route === "/minecraft-link-status" && request.method === "GET") {
      const account = await authenticatedAccount(request, env);
      if (!account) return json({ ok: false, error: "Session expirée. Reconnecte-toi." }, 401, cors);
      const linked = await env.DB.prepare("SELECT minecraft_uuid, minecraft_username, linked_at FROM minecraft_links WHERE account_id = ?").bind(account.id).first();
      return json({ ok: true, linked: linked ? { uuid: linked.minecraft_uuid, username: linked.minecraft_username, linkedAt: linked.linked_at } : null }, 200, cors);
    }
    if (route === "/minecraft-link-redeem" && request.method === "POST") {
      const account = await authenticatedAccount(request, env);
      if (!account) return json({ ok: false, error: "Session expirée. Reconnecte-toi." }, 401, cors);
      if (!await rateLimit(env, "minecraft-redeem-account:" + account.id, 5, 900) ||
          !await rateLimit(env, "minecraft-redeem-ip:" + clientIp(request), 20, 900)) {
        return json({ ok: false, error: "Trop de tentatives. Réessaie dans 15 minutes." }, 429, cors);
      }
      const data = await readJson(request);
      const code = String(data.code || "").trim();
      if (!/^\d{8}$/.test(code)) return json({ ok: false, error: "Saisis un code valide à 8 chiffres." }, 400, cors);
      const existingLink = await env.DB.prepare("SELECT minecraft_username FROM minecraft_links WHERE account_id = ?").bind(account.id).first();
      if (existingLink) return json({ ok: false, error: "Un compte Minecraft est déjà associé à ton compte War Contry." }, 409, cors);
      const codeHash = await sha256(code);
      const row = await env.DB.prepare("SELECT id, minecraft_uuid, minecraft_username, expires_at, used_at FROM minecraft_link_codes WHERE code_hash = ?").bind(codeHash).first();
      if (!row || row.used_at !== null || row.expires_at <= now()) {
        return json({ ok: false, error: "Code invalide, expiré ou déjà utilisé. Demande un nouveau code en jeu." }, 400, cors);
      }
      const otherLink = await env.DB.prepare("SELECT account_id FROM minecraft_links WHERE minecraft_uuid = ?").bind(row.minecraft_uuid).first();
      if (otherLink) return json({ ok: false, error: "Ce compte Minecraft est déjà associé à un autre compte War Contry." }, 409, cors);
      const timestamp = now();
      const consumed = await env.DB.prepare("UPDATE minecraft_link_codes SET used_at = ? WHERE id = ? AND used_at IS NULL AND expires_at > ?")
        .bind(timestamp, row.id, timestamp).run();
      if (!consumed.meta || consumed.meta.changes !== 1) {
        return json({ ok: false, error: "Ce code vient d'être utilisé ou a expiré. Demande-en un nouveau en jeu." }, 409, cors);
      }
      try {
        await env.DB.prepare("INSERT INTO minecraft_links (account_id, minecraft_uuid, minecraft_username, linked_at) VALUES (?, ?, ?, ?)")
          .bind(account.id, row.minecraft_uuid, row.minecraft_username, timestamp).run();
      } catch {
        return json({ ok: false, error: "Ce compte Minecraft ou ce compte War Contry est déjà associé. Vérifie la liaison existante." }, 409, cors);
      }
      return json({ ok: true, linked: { uuid: row.minecraft_uuid, username: row.minecraft_username, linkedAt: timestamp }, message: "Ton compte Minecraft est maintenant associé à ton compte War Contry." }, 200, cors);
    }
    if (route === "/me" && request.method === "GET") {
      const account = await authenticatedAccount(request, env);
      if (!account) return json({ ok: false, error: "Session expirée. Reconnecte-toi." }, 401, cors);
      return json({ ok: true, account }, 200, cors);
    }
    if (route === "/request-email-change" && request.method === "POST") {
      const account = await authenticatedAccount(request, env);
      if (!account) return json({ ok: false, error: "Session expirée. Reconnecte-toi." }, 401, cors);
      if (!await rateLimit(env, "email-change:" + account.id, 3, 3600)) return json({ ok: false, error: "Trop de demandes. Réessaie dans une heure." }, 429, cors);
      const data = await readJson(request);
      const newEmail = String(data.email || "").trim().toLowerCase();
      const currentPassword = String(data.currentPassword || "");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail) || newEmail.length > 254) return json({ ok: false, error: "Adresse e-mail invalide." }, 400, cors);
      if (newEmail === String(account.email).toLowerCase()) return json({ ok: false, error: "Cette adresse est déjà celle de ton compte." }, 400, cors);
      if (!currentPassword || currentPassword.length > 128) return json({ ok: false, error: "Saisis ton mot de passe actuel pour confirmer." }, 400, cors);
      const credentials = await env.DB.prepare("SELECT password_hash FROM accounts WHERE id = ?").bind(account.id).first();
      if (!credentials || !await verifyPassword(currentPassword, credentials.password_hash)) return json({ ok: false, error: "Mot de passe actuel incorrect." }, 401, cors);
      const existing = await env.DB.prepare("SELECT id FROM accounts WHERE lower(email) = lower(?) AND id != ?").bind(newEmail, account.id).first();
      if (existing) return json({ ok: false, error: "Cette adresse e-mail est déjà utilisée par un autre compte." }, 409, cors);
      const timestamp = now();
      const token = randomToken();
      const tokenHash = await sha256(token);
      await env.DB.batch([
        env.DB.prepare("UPDATE email_change_tokens SET used_at = ? WHERE account_id = ? AND used_at IS NULL").bind(timestamp, account.id),
        env.DB.prepare("INSERT INTO email_change_tokens (token_hash, account_id, new_email, expires_at, created_at) VALUES (?, ?, ?, ?, ?)").bind(tokenHash, account.id, newEmail, timestamp + 60 * 60, timestamp)
      ]);
      const link = siteUrl(env, "verifier-email.html") + "?mode=email-change&token=" + encodeURIComponent(token);
      try {
        await sendEmail(env, account.email, "Confirme le changement d'adresse e-mail — War Contry", emailTemplate("Confirme le changement d'adresse", "Une demande de remplacement de ton adresse e-mail par " + escapeHtml(newEmail) + " a été effectuée sur ton compte War Contry. Si tu es à l'origine de cette demande, confirme-la en cliquant sur le bouton ci-dessous. Ta nouvelle adresse ne sera activée qu'après ce clic. Le lien expire dans une heure.", "Confirmer le changement", link));
      } catch (error) {
        await env.DB.prepare("UPDATE email_change_tokens SET used_at = ? WHERE token_hash = ?").bind(now(), tokenHash).run();
        console.error("Email change confirmation failed", error.message);
        return json({ ok: false, error: "L'e-mail de confirmation n'a pas pu être envoyé. Réessaie plus tard." }, 502, cors);
      }
      return json({ ok: true, message: "Un lien de confirmation a été envoyé à ton adresse e-mail actuelle. Ton adresse ne changera qu'après avoir cliqué sur ce lien." }, 200, cors);
    }
    if (route === "/confirm-email-change" && request.method === "POST") {
      const data = await readJson(request);
      const token = String(data.token || "");
      if (token.length < 20 || token.length > 200) return json({ ok: false, error: "Lien de confirmation invalide." }, 400, cors);
      const tokenHash = await sha256(token);
      const row = await env.DB.prepare("SELECT account_id, new_email, expires_at, used_at FROM email_change_tokens WHERE token_hash = ?").bind(tokenHash).first();
      if (!row || row.used_at || row.expires_at < now()) return json({ ok: false, error: "Ce lien est invalide, déjà utilisé ou expiré." }, 400, cors);
      const account = await env.DB.prepare("SELECT email, username FROM accounts WHERE id = ?").bind(row.account_id).first();
      if (!account) return json({ ok: false, error: "Compte introuvable." }, 404, cors);
      const existing = await env.DB.prepare("SELECT id FROM accounts WHERE lower(email) = lower(?) AND id != ?").bind(row.new_email, row.account_id).first();
      if (existing) return json({ ok: false, error: "Cette adresse e-mail est déjà utilisée par un autre compte." }, 409, cors);
      const timestamp = now();
      try {
        await env.DB.batch([
          env.DB.prepare("UPDATE accounts SET email = ?, email_verified_at = ?, updated_at = ? WHERE id = ?").bind(row.new_email, timestamp, timestamp, row.account_id),
          env.DB.prepare("UPDATE email_change_tokens SET used_at = ? WHERE token_hash = ? AND used_at IS NULL").bind(timestamp, tokenHash),
          env.DB.prepare("UPDATE email_change_tokens SET used_at = ? WHERE account_id = ? AND used_at IS NULL").bind(timestamp, row.account_id)
        ]);
      } catch (error) {
        console.error("Email change database update failed", error);
        return json({ ok: false, error: "Impossible de modifier l'adresse. Vérifie qu'elle n'est pas déjà utilisée." }, 409, cors);
      }
      try {
        await sendEmail(env, account.email, "Adresse e-mail de ton compte War Contry modifiée", emailTemplate("Adresse e-mail modifiée", "L’adresse e-mail de ton compte War Contry vient d’être remplacée par " + escapeHtml(row.new_email) + ". Si tu n’es pas à l’origine de cette modification, contacte l’équipe War Contry.", "Ouvrir War Contry", siteUrl(env, "mon-compte.html")));
      } catch (error) {
        console.error("Old email notification failed", error.message);
      }
      return json({ ok: true, account: { username: account.username, email: row.new_email }, message: "Ton adresse e-mail a bien été modifiée." }, 200, cors);
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