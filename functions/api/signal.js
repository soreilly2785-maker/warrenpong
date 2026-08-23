// In-memory / Edge matchmaking and signaling store
let waitingPlayers = [];
let roomSignals = new Map(); // roomCode -> [messages]

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const action = url.searchParams.get('action');
  const room = url.searchParams.get('room');
  const player = url.searchParams.get('player');
  const peerId = url.searchParams.get('peerId');

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  if (context.request.method === 'OPTIONS') {
    return new Response(null, { headers });
  }

  // 1. Quick Match
  if (action === 'quickmatch') {
    const now = Date.now();
    // Clean old waiting players (> 10s)
    waitingPlayers = waitingPlayers.filter(p => now - p.time < 10000 && p.peerId !== peerId);

    if (waitingPlayers.length > 0) {
      // Pair with waiting host
      const host = waitingPlayers.shift();
      return new Response(JSON.stringify({
        status: 'matched',
        role: 'joiner',
        roomCode: host.roomCode,
        opponent: host.player,
        hostPeerId: host.peerId
      }), { headers });
    } else {
      // Register as host
      const roomCode = Math.random().toString(36).substring(2, 6).toUpperCase();
      waitingPlayers.push({ roomCode, player, peerId, time: now });
      return new Response(JSON.stringify({
        status: 'waiting',
        role: 'host',
        roomCode: roomCode
      }), { headers });
    }
  }

  // 2. Poll Messages
  if (action === 'poll' && room) {
    const messages = roomSignals.get(room) || [];
    const forMe = messages.filter(m => m.target === peerId || !m.target && m.from !== peerId);
    // Keep messages for other peers
    roomSignals.set(room, messages.filter(m => m.target !== peerId));
    return new Response(JSON.stringify({ messages: forMe }), { headers });
  }

  // 3. Send Message
  if (action === 'send' && room && context.request.method === 'POST') {
    const body = await context.request.json();
    if (!roomSignals.has(room)) roomSignals.set(room, []);
    roomSignals.get(room).push({ ...body, from: peerId, time: Date.now() });

    // Prune old messages (> 30s)
    const active = roomSignals.get(room).filter(m => Date.now() - m.time < 30000);
    roomSignals.set(room, active);

    return new Response(JSON.stringify({ ok: true }), { headers });
  }

  return new Response(JSON.stringify({ status: 'ok', time: Date.now() }), { headers });
}
