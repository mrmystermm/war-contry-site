const ALLOWED_ORIGINS = new Set([
  "https://play-warcontry.com",
  "https://www.play-warcontry.com"
]);
const API = "https://serveur-prive.net/api/v1/servers";
const VOTE_URL = "https://serveur-prive.net/minecraft/war-contry/vote";

function response(data, status = 200, origin = "") {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin"
  };
  if (ALLOWED_ORIGINS.has(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return new Response(JSON.stringify(data), { status, headers });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    if (request.method === "OPTIONS") return response({ ok: true }, 204, origin);
    if (!ALLOWED_ORIGINS.has(origin)) return response({ ok: false, error: "Origine non autorisée." }, 403, origin);
    if (!env.DB || !env.SERVEUR_PRIVE_TOKEN) return response({ ok: false, error: "Configuration Worker incomplète." }, 500, origin);

    try {
      if (url.pathname === "/start" && request.method === "POST") {
        const body = await request.json().catch(() => ({}));
        const pseudo = String(body.pseudo || "").trim();
        if (!/^[A-Za-z0-9_]{3,16}$/.test(pseudo)) {
          return response({ ok: false, error: "Entre un pseudo Minecraft valide (3 à 16 caractères)." }, 400, origin);
        }

        const apiUrl = `${API}/${encodeURIComponent(env.SERVEUR_PRIVE_TOKEN)}/otp`;
        const apiResponse = await fetch(apiUrl, { headers: { "Accept": "application/json" } });
        const apiData = await apiResponse.json().catch(() => null);
        if (!apiResponse.ok || !apiData?.success || !apiData?.data?.token) {
          return response({ ok: false, error: "Serveur Privé n'a pas pu créer le code de vote. Vérifie l'activation OTP et le token API." }, 502, origin);
        }

        const id = crypto.randomUUID();
        const createdAt = Math.floor(Date.now() / 1000);
        await env.DB.prepare(
          "INSERT INTO sp_vote_sessions (id, pseudo, otp_token, status, created_at) VALUES (?, ?, ?, 'pending', ?)"
        ).bind(id, pseudo, apiData.data.token, createdAt).run();

        return response({
          ok: true,
          session: id,
          vote_url: `${VOTE_URL}?token=${encodeURIComponent(apiData.data.token)}`
        }, 200, origin);
      }

      if (url.pathname === "/status" && request.method === "GET") {
        const id = url.searchParams.get("id") || "";
        if (!/^[0-9a-f-]{36}$/i.test(id)) return response({ ok: false, error: "Session invalide." }, 400, origin);

        const session = await env.DB.prepare(
          "SELECT id, pseudo, otp_token, status, created_at, voted_at, next_vote_seconds FROM sp_vote_sessions WHERE id = ?"
        ).bind(id).first();
        if (!session) return response({ ok: false, error: "Session introuvable." }, 404, origin);
        if (session.status === "confirmed") {
          return response({ ok: true, status: "confirmed", pseudo: session.pseudo, next_vote_seconds: session.next_vote_seconds }, 200, origin);
        }

        const now = Math.floor(Date.now() / 1000);
        if (now > session.created_at + 300) {
          await env.DB.prepare("UPDATE sp_vote_sessions SET status = 'expired' WHERE id = ?").bind(id).run();
          return response({ ok: true, status: "expired" }, 200, origin);
        }

        const checkUrl = `${API}/${encodeURIComponent(env.SERVEUR_PRIVE_TOKEN)}/votes/otp/${encodeURIComponent(session.otp_token)}`;
        const checkResponse = await fetch(checkUrl, { headers: { "Accept": "application/json" } });
        const checkData = await checkResponse.json().catch(() => null);

        if (checkResponse.ok && checkData?.success && checkData?.data?.voted_at) {
          const votedAt = Number(checkData.data.voted_at);
          const nextSeconds = Math.max(0, Number(checkData.data.next_vote_seconds) || 0);
          await env.DB.batch([
            env.DB.prepare(
              "UPDATE sp_vote_sessions SET status = 'confirmed', voted_at = ?, next_vote_seconds = ? WHERE id = ?"
            ).bind(votedAt, nextSeconds, id),
            env.DB.prepare(
              "INSERT OR IGNORE INTO sp_votes (pseudo, voted_at, next_vote_seconds, source) VALUES (?, ?, ?, 'serveur-prive')"
            ).bind(session.pseudo, votedAt, nextSeconds)
          ]);
          return response({ ok: true, status: "confirmed", pseudo: session.pseudo, next_vote_seconds: nextSeconds }, 200, origin);
        }

        return response({ ok: true, status: "pending", seconds_left: Math.max(0, session.created_at + 300 - now) }, 200, origin);
      }

      return response({ ok: false, error: "Route inconnue." }, 404, origin);
    } catch (error) {
      console.error("War Contry votes Worker error:", error);
      return response({ ok: false, error: "Erreur serveur. Réessaie plus tard." }, 500, origin);
    }
  }
};
