const { io } = require('socket.io-client');

const SERVER_URL = 'http://localhost:1337';

let socket = null;
let currentToken = null;

function log(msg) {
  console.log(`[Realtime Agent] ${msg}`);
}

function connect(token) {
  if (socket?.connected) {
    log('Already connected');
    return;
  }

  currentToken = token;

  socket = io(SERVER_URL, {
    auth: { token, clientType: 'agent' },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 30000,
    reconnectionAttempts: Infinity,
  });

  socket.on('connect', () => {
    log('Connected');
  });

  socket.on('disconnect', (reason) => {
    log(`Disconnected: ${reason}`);
  });

  socket.on('reconnect_attempt', (attempt) => {
    log(`Reconnecting... (attempt ${attempt})`);
  });

  socket.on('reconnect', (attempt) => {
    log(`Reconnected (after ${attempt} attempts)`);
  });

  socket.on('reconnect_failed', () => {
    log('Reconnection failed — all attempts exhausted');
  });

  socket.on('connect_error', (err) => {
    log(`Connection error: ${err.message}`);
  });
}

function disconnect() {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
    currentToken = null;
    log('Disconnected');
  }
}

function isConnected() {
  return socket?.connected === true;
}

function getToken() {
  return currentToken;
}

module.exports = { connect, disconnect, isConnected, getToken };
