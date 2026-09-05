// Cloudflare Pages Function: /api/leaderboard
// Persistent Global KV Leaderboard running on Cloudflare Edge

const DEFAULT_LEADERBOARD = {
  players: {
    "NeonStriker": { wins: 18, losses: 4, totalGames: 22, streak: 5, bestStreak: 7, lastPlayed: 1725500000000 },
    "CyberAce": { wins: 14, losses: 5, totalGames: 19, streak: 3, bestStreak: 6, lastPlayed: 1725500000000 },
    "Vortex": { wins: 11, losses: 4, totalGames: 15, streak: 2, bestStreak: 5, lastPlayed: 1725500000000 },
    "Viper": { wins: 8, losses: 6, totalGames: 14, streak: 1, bestStreak: 4, lastPlayed: 1725500000000 },
    "Nova": { wins: 6, losses: 5, totalGames: 11, streak: 0, bestStreak: 3, lastPlayed: 1725500000000 }
  },
  h2h: {}
};

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
    if (!data || !data.players) {
      data = DEFAULT_LEADERBOARD;
      if (env && env.LEADERBOARD_KV) {
        await env.LEADERBOARD_KV.put("global_leaderboard", JSON.stringify(DEFAULT_LEADERBOARD));
      }
    }
    const top5 = getTop5(data.players);
    return new Response(JSON.stringify({ success: true, top5, players: data.players }), {
      headers: corsHeaders
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message, top5: getTop5(DEFAULT_LEADERBOARD.players) }), {
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
    if (!data || !data.players) {
      data = JSON.parse(JSON.stringify(DEFAULT_LEADERBOARD));
    }

    const now = Date.now();

    if (winnerName && loserName && winnerName !== loserName && winnerName !== 'Draw') {
      const w = winnerName.trim();
      const l = loserName.trim();

      if (!data.players[w]) {
        data.players[w] = { wins: 0, losses: 0, totalGames: 0, streak: 0, bestStreak: 0, lastPlayed: now };
      }
      data.players[w].wins = (data.players[w].wins || 0) + 1;
      data.players[w].totalGames = (data.players[w].totalGames || 0) + 1;
      data.players[w].streak = (data.players[w].streak || 0) + 1;
      data.players[w].bestStreak = Math.max(data.players[w].bestStreak || 0, data.players[w].streak);
      data.players[w].lastPlayed = now;

      if (!data.players[l]) {
        data.players[l] = { wins: 0, losses: 0, totalGames: 0, streak: 0, bestStreak: 0, lastPlayed: now };
      }
      data.players[l].losses = (data.players[l].losses || 0) + 1;
      data.players[l].totalGames = (data.players[l].totalGames || 0) + 1;
      data.players[l].streak = 0;
      data.players[l].lastPlayed = now;

      if (env && env.LEADERBOARD_KV) {
        await env.LEADERBOARD_KV.put("global_leaderboard", JSON.stringify(data));
      }
    }

    const top5 = getTop5(data.players);
    return new Response(JSON.stringify({ success: true, top5, players: data.players }), {
      headers: corsHeaders
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 400,
      headers: corsHeaders
    });
  }
}
