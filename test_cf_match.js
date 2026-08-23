const WebSocket = require('ws');

const client1 = new WebSocket('wss://warrenpong.pages.dev/api/ws');
let client2 = null;

client1.on('open', () => {
  console.log("[Client 1] Connected! Sending quickmatch...");
  client1.send(JSON.stringify({ type: 'quickmatch', peerId: 'p1_test', playerName: 'PlayerOne' }));
});

client1.on('message', (data) => {
  const msg = JSON.parse(data);
  console.log("[Client 1] Msg:", msg);

  if (msg.type === 'waiting') {
    console.log("[Client 1] Waiting in room:", msg.roomCode);
    // Connect Client 2
    client2 = new WebSocket('wss://warrenpong.pages.dev/api/ws');
    client2.on('open', () => {
      console.log("[Client 2] Connected! Sending quickmatch...");
      client2.send(JSON.stringify({ type: 'quickmatch', peerId: 'p2_test', playerName: 'PlayerTwo' }));
    });
    client2.on('message', (d2) => {
      const m2 = JSON.parse(d2);
      console.log("[Client 2] Msg:", m2);
      if (m2.type === 'matched') {
        console.log("MATCH SUCCESSFUL! Room:", m2.roomCode, "Opponent:", m2.opponent);
        process.exit(0);
      }
    });
  }
});
