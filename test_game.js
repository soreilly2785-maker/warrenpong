const { io } = require('socket.io-client');

const SERVER_URL = 'http://localhost:3000';

console.log('--- Starting Verification Test for Streamlined Brick Clash ---');

const socket1 = io(SERVER_URL);
let socket2 = null;
let roomCode = null;

socket1.on('connect', () => {
  console.log('Player 1 connected');
  socket1.emit('create_room', { playerName: 'Alice' });
});

socket1.on('room_joined', (data) => {
  roomCode = data.roomCode;
  console.log(`Player 1 joined room: ${roomCode} slot: ${data.slot}`);

  // Connect Player 2
  socket2 = io(SERVER_URL);
  socket2.on('connect', () => {
    console.log(`Player 2 joining room: ${roomCode}`);
    socket2.emit('join_room', { roomCode: roomCode, playerName: 'Bob' });
  });

  socket2.on('room_joined', (p2Data) => {
    console.log(`Player 2 joined room: ${roomCode} slot: ${p2Data.slot}`);
  });
});

socket1.on('game_countdown', ({ count }) => {
  console.log(`Countdown: ${count}`);
});

let tickCount = 0;
socket1.on('game_start', ({ bricks }) => {
  console.log(`Game started! Initial bricks received: ${bricks.length}`);

  socket1.on('game_tick', (tick) => {
    tickCount++;
    if (tickCount === 1) {
      console.log(`Delta tick payload: ball count=${tick.b.length}, p1 score=${tick.p1[2]}, p2 score=${tick.p2[2]}`);
    }
    if (tickCount >= 10) {
      console.log('Verified 10 high-speed delta ticks successfully!');
      console.log('--- STREAMLINED PROTOCOL TEST PASSED! ---');
      socket1.disconnect();
      socket2.disconnect();
      process.exit(0);
    }
  });
});

setTimeout(() => {
  console.error('Test timed out!');
  process.exit(1);
}, 10000);
