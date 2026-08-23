// Cloudflare Edge WebSocket Room & Matchmaking Relay
// Global in-memory rooms per worker instance with graceful handling
const rooms = new Map(); // roomCode -> Set of websockets
let waitingPlayer = null; // { ws, roomCode, playerName, peerId }

export async function onRequest(context) {
  const upgradeHeader = context.request.headers.get('Upgrade');
  if (upgradeHeader !== 'websocket') {
    return new Response('Expected WebSocket connection', { status: 426 });
  }

  const webSocketPair = new WebSocketPair();
  const [client, server] = Object.values(webSocketPair);

  server.accept();

  let myRoom = null;
  let myPeerId = null;
  let myName = null;

  server.addEventListener('message', (event) => {
    try {
      const data = JSON.parse(event.data);
      if (!data) return;

      // 1. Quick Match
      if (data.type === 'quickmatch') {
        myPeerId = data.peerId;
        myName = data.playerName;

        if (waitingPlayer && waitingPlayer.ws.readyState === 1 && waitingPlayer.peerId !== myPeerId) {
          // Pair with waiting player
          const host = waitingPlayer;
          waitingPlayer = null;
          myRoom = host.roomCode;

          if (!rooms.has(myRoom)) rooms.set(myRoom, new Set());
          rooms.get(myRoom).add(server);
          rooms.get(myRoom).add(host.ws);

          // Notify Host
          host.ws.send(JSON.stringify({
            type: 'matched',
            role: 'host',
            roomCode: myRoom,
            opponent: myName,
            opponentPeerId: myPeerId
          }));

          // Notify Joiner
          server.send(JSON.stringify({
            type: 'matched',
            role: 'joiner',
            roomCode: myRoom,
            opponent: host.playerName,
            opponentPeerId: host.peerId
          }));
        } else {
          // Become waiting host
          myRoom = Math.random().toString(36).substring(2, 6).toUpperCase();
          waitingPlayer = { ws: server, roomCode: myRoom, playerName: myName, peerId: myPeerId };

          server.send(JSON.stringify({
            type: 'waiting',
            role: 'host',
            roomCode: myRoom
          }));
        }
        return;
      }

      // 2. Create Room
      if (data.type === 'create_room') {
        myRoom = data.roomCode.toUpperCase();
        myPeerId = data.peerId;
        myName = data.playerName;

        if (!rooms.has(myRoom)) rooms.set(myRoom, new Set());
        rooms.get(myRoom).add(server);

        server.send(JSON.stringify({
          type: 'room_created',
          roomCode: myRoom
        }));
        return;
      }

      // 3. Join Room
      if (data.type === 'join_room') {
        myRoom = data.roomCode.toUpperCase();
        myPeerId = data.peerId;
        myName = data.playerName;

        if (!rooms.has(myRoom)) rooms.set(myRoom, new Set());
        rooms.get(myRoom).add(server);

        // Broadcast join to existing room occupants (Host)
        for (const ws of rooms.get(myRoom)) {
          if (ws !== server && ws.readyState === 1) {
            ws.send(JSON.stringify({
              type: 'player_joined',
              roomCode: myRoom,
              playerName: myName,
              peerId: myPeerId
            }));
          }
        }
        return;
      }

      // 4. Room Message Relay (Game Ticks, Inputs, WebRTC Signaling)
      if (myRoom && rooms.has(myRoom)) {
        for (const ws of rooms.get(myRoom)) {
          if (ws !== server && ws.readyState === 1) {
            ws.send(event.data);
          }
        }
      }
    } catch (e) {}
  });

  server.addEventListener('close', () => {
    if (waitingPlayer && waitingPlayer.ws === server) {
      waitingPlayer = null;
    }
    if (myRoom && rooms.has(myRoom)) {
      rooms.get(myRoom).delete(server);
      if (rooms.get(myRoom).size === 0) {
        rooms.delete(myRoom);
      } else {
        for (const ws of rooms.get(myRoom)) {
          if (ws.readyState === 1) {
            ws.send(JSON.stringify({ type: 'opponent_left' }));
          }
        }
      }
    }
  });

  return new Response(null, {
    status: 101,
    webSocket: client
  });
}
