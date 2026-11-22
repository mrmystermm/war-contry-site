const ALLOWED_ORIGINS = new Set(["https://play-warcontry.com", "https://www.play-warcontry.com"]);
const API = "https://serveur-prive.net/api/v1/servers";
const VOTE_URL = "https://serveur-prive.net/minecraft/war-contry/vote";
const SESSION_TTL_SECONDS = 900;

function json(data, status = 200, origin = "") {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
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
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Max-Age": "86400",
          "Vary": "Origin"
        }
      });
    }

    if (!ALLOWED_ORIGINS.has(origin)) return json({ ok: false, error: "Origine non autorisée." }, 403, origin);
    if (!env.DB || !env.SERVEUR_PRIVE_TOKEN) return json({ ok: false, error: "Configuration Worker incomplète." }, 500, origin);

    try {
      if (url.pathname === "/start" && request.method === "POST") {
        const body = await request.json().catch(() => ({}));
        const pseudo = String(body.pseudo || "").trim();

        if (!/^[A-Za-z0-9_]{3,16}$/.test(pseudo)) {
          return json({ ok: false, error: "Entre un pseudo Minecraft valide (3 à 16 caractères)." }, 400, origin);
        }

        // Snapshot du dernier vote déjà présent pour ce pseudo : il ne sera pas recompté.
        const votes = await getRecentVotes(env.SERVEUR_PRIVE_TOKEN);
        const baseline = votes
          .filter(v => String(v.username || "").toLowerCase() === pseudo.toLowerCase())
          .reduce((latest, v) => Math.max(latest, Number(v.voted_at) || 0), 0);

        const id = crypto.randomUUID();
        const createdAt = Math.floor(Date.now() / 1000);
        await env.DB.prepare(
          "INSERT INTO sp_vote_sessions (id, pseudo, otp_token, status, created_at, baseline_voted_at) VALUES (?, ?, ?, 'pending', ?, ?)"
        ).bind(id, pseudo, `no-otp-${id}`, createdAt, baseline).run();

        const voteUrl = `${VOTE_URL}/${encodeURIComponent(pseudo)}`;
        return json({ ok: true, session: id, vote_url: voteUrl }, 200, origin);
      }

      if (url.pathname === "/status" && request.method === "GET") {
        const id = url.searchParams.get("id") || "";
        if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ ok: false, error: "Session invalide." }, 400, origin);

        const session = await env.DB.prepare(
          "SELECT id, pseudo, status, created_at, baseline_voted_at, voted_at FROM sp_vote_sessions WHERE id = ?"
        ).bind(id).first();

        if (!session) return json({ ok: false, error: "Session introuvable." }, 404, origin);
        if (session.status === "confirmed") {
          return json({ ok: true, status: "confirmed", pseudo: session.pseudo }, 200, origin);
        }

        const now = Math.floor(Date.now() / 1000);
        if (now > session.created_at + SESSION_TTL_SECONDS) {
          await env.DB.prepare("UPDATE sp_vote_sessions SET status = 'expired' WHERE id = ?").bind(id).run();
          return json({ ok: true, status: "expired" }, 200, origin);
        }

        const votes = await getRecentVotes(env.SERVEUR_PRIVE_TOKEN);
        const matchingVote = votes
          .filter(v =>
            String(v.username || "").toLowerCase() === session.pseudo.toLowerCase() &&
            Number(v.voted_at) > Number(session.baseline_voted_at || 0) &&
            Number(v.voted_at) >= session.created_at
          )
          .sort((a, b) => Number(b.voted_at) - Number(a.voted_at))[0];

        if (matchingVote) {
          const votedAt = Number(matchingVote.voted_at);
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
          seconds_left: Math.max(0, session.created_at + SESSION_TTL_SECONDS - now)
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
