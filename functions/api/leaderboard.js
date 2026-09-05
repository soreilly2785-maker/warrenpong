// Cloudflare Pages Function: /api/leaderboard
// Persistent Global KV Leaderboard & H2H Rivalry Engine running on Cloudflare Edge

function getTop5(players) {
  const list = Object.entries(players || {}).map(([name, data]) => {
    const wins = data.wins || 0;
    const losses = data.losses || 0;
    const total = data.totalGames || (wins + losses);
    const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
    return {
      name,
      wins,
      losses,
      totalGames: total,
      winRate,
      streak: data.streak || 0,
      bestStreak: data.bestStreak || 0
    };
  });

  list.sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.winRate !== a.winRate) return b.winRate - a.winRate;
    return b.totalGames - a.totalGames;
  });

  return list.slice(0, 5);
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json"
};

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders });
}

export async function onRequestGet({ env }) {
  try {
    let data = null;
    if (env && env.LEADERBOARD_KV) {
      data = await env.LEADERBOARD_KV.get("global_leaderboard", "json");
    }
    if (!data) data = { players: {}, h2h: {} };
    if (!data.players) data.players = {};
    if (!data.h2h) data.h2h = {};

    const top5 = getTop5(data.players);
    return new Response(JSON.stringify({ success: true, top5, players: data.players, h2h: data.h2h }), {
      headers: corsHeaders
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message, top5: [], players: {}, h2h: {} }), {
      headers: corsHeaders
    });
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const { winnerName, loserName } = body;

    let data = null;
    if (env && env.LEADERBOARD_KV) {
      data = await env.LEADERBOARD_KV.get("global_leaderboard", "json");
    }
    if (!data) data = { players: {}, h2h: {} };
    if (!data.players) data.players = {};
    if (!data.h2h) data.h2h = {};

    const now = Date.now();

    if (winnerName && loserName && winnerName !== loserName && winnerName !== 'Draw') {
      const w = winnerName.trim();
      const l = loserName.trim();

      // Winner
      if (!data.players[w]) {
        data.players[w] = { wins: 0, losses: 0, totalGames: 0, streak: 0, bestStreak: 0, lastPlayed: now };
      }
      data.players[w].wins = (data.players[w].wins || 0) + 1;
      data.players[w].totalGames = (data.players[w].totalGames || 0) + 1;
      data.players[w].streak = (data.players[w].streak || 0) + 1;
      data.players[w].bestStreak = Math.max(data.players[w].bestStreak || 0, data.players[w].streak);
      data.players[w].lastPlayed = now;

      // Loser
      if (!data.players[l]) {
        data.players[l] = { wins: 0, losses: 0, totalGames: 0, streak: 0, bestStreak: 0, lastPlayed: now };
      }
      data.players[l].losses = (data.players[l].losses || 0) + 1;
      data.players[l].totalGames = (data.players[l].totalGames || 0) + 1;
      data.players[l].streak = 0;
      data.players[l].lastPlayed = now;

      // Head-to-Head record
      const pairKey = [w, l].sort().join(':::');
      if (!data.h2h[pairKey]) {
        data.h2h[pairKey] = { [w]: 0, [l]: 0, totalGames: 0 };
      }
      data.h2h[pairKey][w] = (data.h2h[pairKey][w] || 0) + 1;
      if (data.h2h[pairKey][l] === undefined) data.h2h[pairKey][l] = 0;
      data.h2h[pairKey].totalGames = (data.h2h[pairKey].totalGames || 0) + 1;

      if (env && env.LEADERBOARD_KV) {
        await env.LEADERBOARD_KV.put("global_leaderboard", JSON.stringify(data));
      }
    }

    const top5 = getTop5(data.players);
    return new Response(JSON.stringify({ success: true, top5, players: data.players, h2h: data.h2h }), {
      headers: corsHeaders
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 400,
      headers: corsHeaders
    });
  }
}
