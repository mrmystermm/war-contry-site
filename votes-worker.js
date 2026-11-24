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


const REWARD_POOLS = {
  0: [
    { key: "missile-repulsif", name: "Un Missile Repulsif", rarity: "Légendaire", probability: 0.749 },
    { key: "emeralds-16", name: "16 émeraudes", rarity: "Épique", probability: 2.497 },
    { key: "notch-apples-2", name: "2 pommes de notch", rarity: "Épique", probability: 3.121 },
    { key: "steel-16", name: "16 acier", rarity: "Rare", probability: 6.242 },
    { key: "dollars-200", name: "200 dollars", rarity: "Rare", probability: 12.484 },
    { key: "dollars-100", name: "100 dollars", rarity: "Commun", probability: 74.906 }
  ],
  1: [
    { key: "missile-repulsif", name: "Un Missile Repulsif", rarity: "Mythique", probability: 0.25 },
    { key: "dollars-5000", name: "5000 dollars", rarity: "Mythique", probability: 0.499 },
    { key: "netherite-sword", name: "Une épée en netherite", rarity: "Épique", probability: 2.497 },
    { key: "diamond-sword", name: "Une épée en diamant", rarity: "Épique", probability: 3.121 },
    { key: "dollars-210", name: "210 dollars", rarity: "Commun", probability: 18.727 },
    { key: "dollars-110", name: "110 dollars", rarity: "Commun", probability: 74.906 }
  ],
  2: [
    { key: "missile-shrapnel", name: "Un missile Shrapnel", rarity: "Mythique", probability: 0.25 },
    { key: "missile-launcher-t2", name: "Un lanceur de missile T2", rarity: "Mythique", probability: 0.499 },
    { key: "notch-apples-2", name: "2 pommes de notch", rarity: "Épique", probability: 2.497 },
    { key: "dollars-220", name: "220 dollars", rarity: "Commun", probability: 18.727 },
    { key: "dollars-120", name: "120 dollars", rarity: "Commun", probability: 74.906 }
  ],
  3: [
    { key: "missile-repulsif", name: "Un Missile repulsif", rarity: "Mythique", probability: 0.25 },
    { key: "missile-incendiary", name: "Un missile Incendiary", rarity: "Mythique", probability: 0.499 },
    { key: "emeralds-16", name: "16 émeraudes", rarity: "Épique", probability: 2.497 },
    { key: "missile-condensed", name: "Un missile Condensed", rarity: "Épique", probability: 3.121 },
    { key: "dollars-230", name: "230 dollars", rarity: "Commun", probability: 18.727 },
    { key: "dollars-130", name: "130 dollars", rarity: "Commun", probability: 74.906 }
  ],
  4: [
    { key: "missile-fragmentation", name: "Un Missile fragmentation", rarity: "Mythique", probability: 0.25 },
    { key: "missile-incendiary", name: "Un Missile Incendiary", rarity: "Mythique", probability: 0.499 },
    { key: "hazmat-torso", name: "Un torse hazmat", rarity: "Épique", probability: 2.497 },
    { key: "dollars-240", name: "240 dollars", rarity: "Commun", probability: 18.727 },
    { key: "dollars-140", name: "140 dollars", rarity: "Commun", probability: 74.906 }
  ],
  5: [
    { key: "missile-nuclear", name: "Un missile nucléaire", rarity: "Mythique", probability: 0.25 },
    { key: "emeralds-16-legendary", name: "16 émeraudes", rarity: "Légendaire", probability: 1.248 },
    { key: "missile-contagious", name: "Un missile contagious", rarity: "Légendaire", probability: 1.623 },
    { key: "missile-launch-kit-t3", name: "Un kit de lancement de missile T3", rarity: "Épique", probability: 2.497 },
    { key: "dollars-250", name: "250 dollars", rarity: "Commun", probability: 18.727 },
    { key: "dollars-150", name: "150 dollars", rarity: "Commun", probability: 74.906 }
  ]
};

function getVoteMonthBounds(month) {
  const start = Math.floor(Date.parse(month + "-01T00:00:00.000Z") / 1000);
  const [year, monthNumber] = month.split("-").map(Number);
  const nextMonth = monthNumber === 12
    ? (year + 1) + "-01"
    : year + "-" + String(monthNumber + 1).padStart(2, "0");
  const end = Math.floor(Date.parse(nextMonth + "-01T00:00:00.000Z") / 1000);
  return { start, end };
}

function tierForVoteCount(total) {
  if (total >= 100) return 5;
  if (total >= 90) return 4;
  if (total >= 70) return 3;
  if (total >= 50) return 2;
  if (total >= 20) return 1;
  return 0;
}

function chooseReward(tier) {
  const rewards = REWARD_POOLS[tier];
  const noneProbability = Math.max(0, 100 - rewards.reduce((sum, reward) => sum + reward.probability, 0));
  const randomValues = new Uint32Array(1);
  crypto.getRandomValues(randomValues);
  const roll = (randomValues[0] / 0x100000000) * 100;
  let cursor = 0;
  for (const reward of rewards) {
    cursor += reward.probability;
    if (roll < cursor) return reward;
  }
  return { key: null, name: null, rarity: null, probability: noneProbability, noReward: true };
}

async function processRewardDraws(env, accountId, month) {
  const { start, end } = getVoteMonthBounds(month);
  const countRow = await env.ACCOUNT_DB.prepare(
    "SELECT COUNT(*) AS total FROM account_votes WHERE account_id = ? AND voted_at >= ? AND voted_at < ?"
  ).bind(accountId, start, end).first();
  const totalVotes = Number(countRow?.total || 0);
  const drawCount = Math.floor(totalVotes / 2);

  for (let drawNumber = 1; drawNumber <= drawCount; drawNumber++) {
    const existing = await env.ACCOUNT_DB.prepare(
      "SELECT id FROM vote_rewards WHERE account_id = ? AND month = ? AND draw_number = ?"
    ).bind(accountId, month, drawNumber).first();
    if (existing) continue;

    const secondVote = await env.ACCOUNT_DB.prepare(
      "SELECT id, voted_at FROM account_votes WHERE account_id = ? AND voted_at >= ? AND voted_at < ? ORDER BY voted_at ASC, id ASC LIMIT 1 OFFSET ?"
    ).bind(accountId, start, end, drawNumber * 2 - 1).first();
    if (!secondVote) continue;

    const countAtDraw = await env.ACCOUNT_DB.prepare(
      "SELECT COUNT(*) AS total FROM account_votes WHERE account_id = ? AND voted_at >= ? AND voted_at < ? AND (voted_at < ? OR (voted_at = ? AND id <= ?))"
    ).bind(accountId, start, end, secondVote.voted_at, secondVote.voted_at, secondVote.id).first();
    const tier = tierForVoteCount(Number(countAtDraw?.total || drawNumber * 2));
    const reward = chooseReward(tier);
    const id = crypto.randomUUID();

    if (reward.noReward) {
      await env.ACCOUNT_DB.prepare(
        "INSERT OR IGNORE INTO vote_rewards (id, account_id, month, draw_number, tier, reward_key, reward_name, rarity, probability, status, created_at) VALUES (?, ?, ?, ?, ?, NULL, NULL, NULL, ?, 'no_reward', ?)"
      ).bind(id, accountId, month, drawNumber, tier, reward.probability, now()).run();
    } else {
      await env.ACCOUNT_DB.prepare(
        "INSERT OR IGNORE INTO vote_rewards (id, account_id, month, draw_number, tier, reward_key, reward_name, rarity, probability, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)"
      ).bind(id, accountId, month, drawNumber, tier, reward.key, reward.name, reward.rarity, reward.probability, now()).run();
    }
  }
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

    const isPublicLeaderboard = request.method === "GET" && url.pathname === "/leaderboard";
    if (!ALLOWED_ORIGINS.has(origin) && !(isPublicLeaderboard && !origin)) {
      return json({ ok: false, error: "Origine non autorisée." }, 403, origin);
    }
    if (isPublicLeaderboard && !env.ACCOUNT_DB) {
      return json({ ok: false, error: "La base des comptes (ACCOUNT_DB) est introuvable." }, 500, origin);
    }
    if (!isPublicLeaderboard && (!env.DB || !env.ACCOUNT_DB || !env.SERVEUR_PRIVE_TOKEN)) {
      return json({ ok: false, error: "Configuration Worker incomplète. Vérifie les liaisons DB, ACCOUNT_DB et le secret API." }, 500, origin);
    }

    try {
      if (url.pathname === "/leaderboard" && request.method === "GET") {
        const requestedMonth = url.searchParams.get("month") || "";
        const month = requestedMonth || new Date().toISOString().slice(0, 7);
        if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
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
        await processRewardDraws(env, account.id, new Date(timestamp * 1000).toISOString().slice(0, 7));

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
          await processRewardDraws(env, account.id, new Date(Number(session.voted_at || session.created_at) * 1000).toISOString().slice(0, 7));
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
          await processRewardDraws(env, account.id, new Date(votedAt * 1000).toISOString().slice(0, 7));

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

      if (url.pathname === "/rewards" && request.method === "GET") {
        const account = await authenticatedAccount(request, env);
        if (!account) return json({ ok: false, error: "Connecte-toi à ton compte War Contry pour consulter tes récompenses." }, 401, origin);

        const month = new Date().toISOString().slice(0, 7);
        const { start, end } = getVoteMonthBounds(month);
        const countRow = await env.ACCOUNT_DB.prepare(
          "SELECT COUNT(*) AS total FROM account_votes WHERE account_id = ? AND voted_at >= ? AND voted_at < ?"
        ).bind(account.id, start, end).first();
        const totalVotes = Number(countRow?.total || 0);
        const rewardsResult = await env.ACCOUNT_DB.prepare(
          "SELECT id, month, draw_number, tier, reward_key, reward_name, rarity, probability, status, created_at, delivered_at, delivery_reference FROM vote_rewards WHERE account_id = ? AND month = ? ORDER BY draw_number DESC"
        ).bind(account.id, month).all();

        return json({
          ok: true,
          month,
          total_votes: totalVotes,
          votes_toward_next_reward: totalVotes % 2,
          votes_remaining: totalVotes % 2 === 0 ? 2 : 1,
          next_draw_at_vote: totalVotes + (totalVotes % 2 === 0 ? 2 : 1),
          current_tier: tierForVoteCount(totalVotes),
          rewards: rewardsResult.results || []
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
