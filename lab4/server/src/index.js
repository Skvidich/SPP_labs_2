const express = require('express');
const { createServer } = require('http');
const { WebSocketServer } = require('ws');
const path = require('path');
require('dotenv').config();

const { initDB } = require('./config/db');
const { loginUser } = require('./controllers/authController');
const { getLeaderboard } = require('./controllers/leaderboardController');
const { handleWebSocketConnection } = require('./game/websocketHandler');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.post('/api/login', loginUser);
app.get('/api/leaderboard', getLeaderboard);

const server = createServer(app);
const wss = new WebSocketServer({ server });
wss.on('connection', handleWebSocketConnection);

const PORT = process.env.PORT || 5000;
initDB().then(() => {
  server.listen(PORT, () => {
    console.log(`🚀 Coin Rush server: http://localhost:${PORT}`);
  });
});