const ALLOWED_ORIGINS = new Set(["https://play-warcontry.com", "https://www.play-warcontry.com"]);
const API = "https://serveur-prive.net/api/v1/servers";
const VOTE_URL = "https://serveur-prive.net/minecraft/war-contry/vote";
const SESSION_TTL_SECONDS = 900;
const VOTE_LOOKBACK_SECONDS = 89 * 60;
const EXTERNAL_COOLDOWNS = {
  "planet-minecraft": 24 * 60 * 60,
  "serveur-minecraft": 3 * 60 * 60,
  "minecraft-ip-list": 24 * 60 * 60
};
const encoder = new TextEncoder();

function now() {
  return Math.floor(Date.now() / 1000);
}

async function sha256(value) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, "0")).join("");
}

async function authenticatedAccount(request, env) {
  const header = request.headers.get("Authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token || token.length > 200) return null;
  const hash = await sha256(token);
  return await env.ACCOUNT_DB.prepare(
    "SELECT accounts.id, accounts.username FROM sessions JOIN accounts ON accounts.id = sessions.account_id WHERE sessions.token_hash = ? AND sessions.revoked_at IS NULL AND sessions.expires_at > ? AND accounts.email_verified_at IS NOT NULL"
  ).bind(hash, now()).first();
}

function json(data, status = 200, origin = "") {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Vary": "Origin"
  };
  if (ALLOWED_ORIGINS.has(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return new Response(status === 204 ? null : JSON.stringify(data), { status, headers });
}

async function getRecentVotes(serverToken) {
  const response = await fetch(`${API}/${encodeURIComponent(serverToken)}/votes`, {
    headers: { Accept: "application/json" },
    cache: "no-store"
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.success || !Array.isArray(data.data)) {
    const error = new Error("Impossible de récupérer les votes récents auprès de Serveur Privé.");
    error.status = response.status;
    throw error;
  }
  return data.data;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : "null",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Max-Age": "86400",
          "Vary": "Origin"
        }
      });
    }

    if (!ALLOWED_ORIGINS.has(origin)) return json({ ok: false, error: "Origine non autorisée." }, 403, origin);
    if (!env.DB || !env.ACCOUNT_DB || !env.SERVEUR_PRIVE_TOKEN) {
      return json({ ok: false, error: "Configuration Worker incomplète. Vérifie les liaisons DB, ACCOUNT_DB et le secret API." }, 500, origin);
    }

    try {
      if (url.pathname === "/leaderboard" && request.method === "GET") {
        const requestedMonth = url.searchParams.get("month") || "";
        const month = requestedMonth || new Date().toISOString().slice(0, 7);
        if (!/^\\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
          return json({ ok: false, error: "Mois invalide. Utilise le format AAAA-MM." }, 400, origin);
        }
        const start = Math.floor(Date.parse(month + "-01T00:00:00.000Z") / 1000);
        const parts = month.split("-").map(Number);
        const nextMonth = parts[1] === 12 ? (parts[0] + 1) + "-01" : parts[0] + "-" + String(parts[1] + 1).padStart(2, "0");
        const end = Math.floor(Date.parse(nextMonth + "-01T00:00:00.000Z") / 1000);
        const result = await env.ACCOUNT_DB.prepare(
          "SELECT current.account_id, (SELECT latest.pseudo FROM account_votes AS latest WHERE latest.account_id = current.account_id ORDER BY latest.voted_at DESC LIMIT 1) AS pseudo, COUNT(*) AS total FROM account_votes AS current WHERE current.voted_at >= ? AND current.voted_at < ? GROUP BY current.account_id ORDER BY total DESC, pseudo COLLATE NOCASE ASC LIMIT 100"
        ).bind(start, end).all();
        return json({ ok: true, month, leaderboard: (result.results || []).map((row, index) => ({ rank: index + 1, pseudo: row.pseudo || "Joueur", total: Number(row.total || 0) })) }, 200, origin);
      }
      if (url.pathname === "/external/status" && request.method === "GET") {
        const account = await authenticatedAccount(request, env);
        if (!account) return json({ ok: false, error: "Connecte-toi à ton compte War Contry." }, 401, origin);

        const source = url.searchParams.get("source") || "";
        if (!Object.prototype.hasOwnProperty.call(EXTERNAL_COOLDOWNS, source)) {
          return json({ ok: false, error: "Plateforme invalide." }, 400, origin);
        }

        const row = await env.ACCOUNT_DB.prepare(
          "SELECT last_opened_at, next_available_at FROM account_vote_cooldowns WHERE account_id = ? AND source = ?"
        ).bind(account.id, source).first();

        return json({
          ok: true,
          source,
          last_opened_at: row?.last_opened_at || null,
          next_available_at: row?.next_available_at || null,
          seconds_left: Math.max(0, Number(row?.next_available_at || 0) - now())
        }, 200, origin);
      }

      if (url.pathname === "/external/start" && request.method === "POST") {
        const account = await authenticatedAccount(request, env);
        if (!account) return json({ ok: false, error: "Connecte-toi à ton compte War Contry." }, 401, origin);

        const body = await request.json().catch(() => ({}));
        const source = String(body.source || "");
        const cooldown = EXTERNAL_COOLDOWNS[source];

        if (!cooldown) return json({ ok: false, error: "Plateforme invalide." }, 400, origin);

        const timestamp = now();
        const nextAvailableAt = timestamp + cooldown;
        const result = await env.ACCOUNT_DB.prepare(
          `INSERT INTO account_vote_cooldowns (account_id, source, last_opened_at, next_available_at)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(account_id, source) DO UPDATE SET
             last_opened_at = excluded.last_opened_at,
             next_available_at = excluded.next_available_at
           WHERE account_vote_cooldowns.next_available_at <= ?`
        ).bind(account.id, source, timestamp, nextAvailableAt, timestamp).run();

        if (!result.meta || result.meta.changes !== 1) {
          const current = await env.ACCOUNT_DB.prepare(
            "SELECT next_available_at FROM account_vote_cooldowns WHERE account_id = ? AND source = ?"
          ).bind(account.id, source).first();

          return json({
            ok: false,
            error: "Tu as déjà ouvert cette plateforme récemment.",
            next_available_at: current?.next_available_at || null,
            seconds_left: Math.max(0, Number(current?.next_available_at || 0) - timestamp)
          }, 429, origin);
        }

        await env.ACCOUNT_DB.prepare(
          "INSERT OR IGNORE INTO account_votes (account_id, source, voted_at, pseudo) VALUES (?, ?, ?, ?)"
        ).bind(account.id, source, timestamp, account.username).run();

        return json({
          ok: true,
          source,
          last_opened_at: timestamp,
          next_available_at: nextAvailableAt,
          seconds_left: cooldown
        }, 200, origin);
      }

      if (url.pathname === "/start" && request.method === "POST") {
        const account = await authenticatedAccount(request, env);
        if (!account) return json({ ok: false, error: "Connecte-toi à ton compte War Contry pour voter." }, 401, origin);

        const pseudo = String(account.username || "").trim();
        if (!/^[A-Za-z0-9_]{3,16}$/.test(pseudo)) {
          return json({ ok: false, error: "Le pseudo Minecraft associé à ton compte est invalide. Modifie-le dans ton compte War Contry." }, 400, origin);
        }

        const id = crypto.randomUUID();
        const createdAt = now();
        await env.DB.prepare(
          "INSERT INTO sp_vote_sessions (id, pseudo, otp_token, status, created_at, baseline_voted_at, account_id) VALUES (?, ?, ?, 'pending', ?, 0, ?)"
        ).bind(id, pseudo, `no-otp-${id}`, createdAt, account.id).run();

        const voteUrl = `${VOTE_URL}/${encodeURIComponent(pseudo)}`;
        return json({ ok: true, session: id, vote_url: voteUrl, pseudo }, 200, origin);
      }

      if (url.pathname === "/status" && request.method === "GET") {
        const account = await authenticatedAccount(request, env);
        if (!account) return json({ ok: false, error: "Connecte-toi à ton compte War Contry pour vérifier ton vote." }, 401, origin);

        const id = url.searchParams.get("id") || "";
        if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ ok: false, error: "Session invalide." }, 400, origin);

        const session = await env.DB.prepare(
          "SELECT id, account_id, pseudo, status, created_at, baseline_voted_at, voted_at FROM sp_vote_sessions WHERE id = ?"
        ).bind(id).first();

        if (!session) return json({ ok: false, error: "Session introuvable." }, 404, origin);
        if (session.account_id !== account.id) return json({ ok: false, error: "Cette session de vote n'appartient pas à ton compte." }, 403, origin);

        if (session.status === "confirmed") {
          return json({ ok: true, status: "confirmed", pseudo: session.pseudo }, 200, origin);
        }

        const timestamp = now();
        if (timestamp > session.created_at + SESSION_TTL_SECONDS) {
          await env.DB.prepare("UPDATE sp_vote_sessions SET status = 'expired' WHERE id = ?").bind(id).run();
          return json({ ok: true, status: "expired" }, 200, origin);
        }

        const votes = await getRecentVotes(env.SERVEUR_PRIVE_TOKEN);
        const oldestAcceptedVote = timestamp - VOTE_LOOKBACK_SECONDS;
        const matchingVote = votes
          .filter(v =>
            String(v.username || "").toLowerCase() === session.pseudo.toLowerCase() &&
            Number(v.voted_at) >= oldestAcceptedVote &&
            Number(v.voted_at) >= session.created_at &&
            Number(v.voted_at) <= timestamp
          )
          .sort((a, b) => Number(b.voted_at) - Number(a.voted_at))[0];

        if (matchingVote) {
          const votedAt = Number(matchingVote.voted_at);

          // La source de vérité est la base des comptes : le vote est rattaché à l'identifiant du compte.
          await env.ACCOUNT_DB.prepare(
            "INSERT OR IGNORE INTO account_votes (account_id, source, voted_at, pseudo) VALUES (?, 'serveur-prive', ?, ?)"
          ).bind(account.id, votedAt, session.pseudo).run();

          await env.DB.batch([
            env.DB.prepare(
              "UPDATE sp_vote_sessions SET status = 'confirmed', voted_at = ?, next_vote_seconds = 0 WHERE id = ?"
            ).bind(votedAt, id),
            env.DB.prepare(
              "INSERT OR IGNORE INTO sp_votes (pseudo, voted_at, next_vote_seconds, source) VALUES (?, ?, 0, 'serveur-prive')"
            ).bind(session.pseudo, votedAt)
          ]);
          return json({ ok: true, status: "confirmed", pseudo: session.pseudo }, 200, origin);
        }

        return json({
          ok: true,
          status: "pending",
          seconds_left: Math.max(0, session.created_at + SESSION_TTL_SECONDS - timestamp)
        }, 200, origin);
      }

      if (url.pathname === "/history" && request.method === "GET") {
        const account = await authenticatedAccount(request, env);
        if (!account) return json({ ok: false, error: "Connecte-toi à ton compte War Contry pour consulter ton historique." }, 401, origin);

        const result = await env.ACCOUNT_DB.prepare(
          "SELECT id, source, voted_at, pseudo FROM account_votes WHERE account_id = ? ORDER BY voted_at DESC LIMIT 100"
        ).bind(account.id).all();
        const count = await env.ACCOUNT_DB.prepare(
          "SELECT COUNT(*) AS total FROM account_votes WHERE account_id = ?"
        ).bind(account.id).first();
        const participations = await env.ACCOUNT_DB.prepare(
          "SELECT source, last_opened_at, next_available_at FROM account_vote_cooldowns WHERE account_id = ? ORDER BY last_opened_at DESC"
        ).bind(account.id).all();
        return json({
          ok: true,
          votes: result.results || [],
          participations: participations.results || [],
          total: Number(count?.total || 0)
        }, 200, origin);
      }

      return json({ ok: false, error: "Route inconnue." }, 404, origin);
    } catch (error) {
      console.error("War Contry votes Worker error:", error);
      return json({
        ok: false,
        error: error.status
          ? `Serveur Privé a répondu avec le code HTTP ${error.status}.`
          : "Erreur serveur. Réessaie plus tard."
      }, 502, origin);
    }
  }
};
