const { pool } = require('../config/db');
const config = require('../config/gameConfig');

class RoomInstance {
  constructor() {
    this.players = new Map();   // userId -> player
    this.coins = [];
    this.status = 'finished';   // начинаем с intermission перед первым раундом
    this.timeLeft = config.INTERMISSION_DURATION;
    this.currentGameId = null;
    this.lastRoundLeaderboard = null;
    this.overallLeaderboard = null;

    this.secondTimer = null;
    this.broadcastTimer = null;
    this.coinSpawnTimer = null;

    this.startSecondTimer();
    this.startBroadcastTimer();
  }

  startSecondTimer() {
    this.secondTimer = setInterval(() => this.onSecond(), 1000);
  }

  startBroadcastTimer() {
    this.broadcastTimer = setInterval(() => this.broadcast(), config.BROADCAST_INTERVAL_MS);
  }

  async onSecond() {
    if (this.status === 'finished') {
      this.timeLeft--;
      if (this.timeLeft <= 0) await this.startRound();
    } else if (this.status === 'active') {
      this.timeLeft--;
      if (this.timeLeft <= 0) await this.endRound();
    }
  }

  async startRound() {
    this.status = 'active';
    this.timeLeft = config.ROUND_DURATION;
    this.coins = [];
    this.lastRoundLeaderboard = null;

    // Сброс позиций и счёта
    for (const p of this.players.values()) {
      p.score = 0;
      p.x = Math.floor(Math.random() * (config.FIELD_WIDTH - config.PLAYER_SIZE));
      p.y = Math.floor(Math.random() * (config.FIELD_HEIGHT - config.PLAYER_SIZE));
    }

    for (let i = 0; i < config.INITIAL_COINS; i++) this.spawnCoin();

    if (this.coinSpawnTimer) clearInterval(this.coinSpawnTimer);
    this.coinSpawnTimer = setInterval(() => this.spawnCoin(), config.COIN_SPAWN_INTERVAL_MS);

    try {
      const res = await pool.query(
        "INSERT INTO games (status) VALUES ('active') RETURNING id"
      );
      this.currentGameId = res.rows[0].id;
    } catch (e) {
      console.error('Failed to create game row:', e);
      this.currentGameId = null;
    }

    console.log(`▶️  Round started (game #${this.currentGameId})`);
    this.broadcast();
  }

  async endRound() {
    if (this.coinSpawnTimer) { clearInterval(this.coinSpawnTimer); this.coinSpawnTimer = null; }

    this.status = 'finished';
    this.timeLeft = config.INTERMISSION_DURATION;
    this.coins = [];

    if (this.currentGameId) {
      try {
        await pool.query(
          "UPDATE games SET status='finished', ended_at=NOW() WHERE id=$1",
          [this.currentGameId]
        );
        for (const p of this.players.values()) {
          await pool.query(
            `INSERT INTO game_results (game_id, user_id, score)
             VALUES ($1, $2, $3)
             ON CONFLICT (game_id, user_id) DO UPDATE SET score = EXCLUDED.score`,
            [this.currentGameId, p.userId, p.score]
          );
        }
        await this.loadLeaderboards(this.currentGameId);
      } catch (e) {
        console.error('Failed to save round results:', e);
      }
    }

    console.log(`⏹  Round ended (game #${this.currentGameId})`);
    this.broadcast();
  }

  async loadLeaderboards(gameId) {
    try {
      const last = await pool.query(`
        SELECT u.username, gr.score
        FROM game_results gr
        JOIN users u ON u.id = gr.user_id
        WHERE gr.game_id = $1
        ORDER BY gr.score DESC
      `, [gameId]);

      const overall = await pool.query(`
        SELECT u.username,
               SUM(gr.score)::int AS total_score,
               COUNT(*)::int AS games_played
        FROM game_results gr
        JOIN users u ON u.id = gr.user_id
        GROUP BY u.id, u.username
        ORDER BY total_score DESC
        LIMIT 10
      `);

      this.lastRoundLeaderboard = last.rows;
      this.overallLeaderboard = overall.rows;
    } catch (e) {
      console.error('loadLeaderboards error:', e);
    }
  }

  spawnCoin() {
    if (this.status !== 'active') return;
    if (this.coins.length >= config.MAX_COINS) return;

    const isGold = Math.random() < config.GOLD_CHANCE;
    const pad = 20;
    this.coins.push({
      id: Math.random().toString(36).slice(2, 10),
      x: pad + Math.floor(Math.random() * (config.FIELD_WIDTH - pad * 2)),
      y: pad + Math.floor(Math.random() * (config.FIELD_HEIGHT - pad * 2)),
      value: isGold ? config.GOLD_VALUE : config.BRONZE_VALUE,
      type: isGold ? 'gold' : 'bronze'
    });
  }

  addPlayer(user, ws) {
    const existing = this.players.get(user.id);
    if (existing) {
      existing.ws = ws;
      existing.connected = true;
      if (existing.disconnectTimer) {
        clearTimeout(existing.disconnectTimer);
        existing.disconnectTimer = null;
      }
      console.log(`♻️  Reconnected: ${existing.username} (id=${user.id})`);
      return existing;
    }

    const player = {
      userId: user.id,
      username: user.username,
      x: Math.floor(Math.random() * (config.FIELD_WIDTH - config.PLAYER_SIZE)),
      y: Math.floor(Math.random() * (config.FIELD_HEIGHT - config.PLAYER_SIZE)),
      score: 0,
      ws,
      connected: true,
      disconnectTimer: null
    };
    this.players.set(user.id, player);
    console.log(`➕ Joined: ${user.username} (id=${user.id})`);
    return player;
  }

  markDisconnected(userId) {
    const p = this.players.get(userId);
    if (!p) return;
    p.connected = false;
    p.ws = null;
    if (p.disconnectTimer) clearTimeout(p.disconnectTimer);
    p.disconnectTimer = setTimeout(() => {
      this.players.delete(userId);
      console.log(`➖ Removed after grace: ${p.username}`);
      this.broadcast();
    }, config.DISCONNECT_GRACE_MS);
  }

  movePlayer(userId, x, y) {
    if (this.status !== 'active') return;
    const p = this.players.get(userId);
    if (!p) return;

    p.x = Math.max(0, Math.min(config.FIELD_WIDTH - config.PLAYER_SIZE, x));
    p.y = Math.max(0, Math.min(config.FIELD_HEIGHT - config.PLAYER_SIZE, y));

    // Конкурентный доступ: сервер — единственный источник истины.
    // Node.js однопоточный, поэтому два MOVE от разных игроков
    // обрабатываются строго последовательно. Монету забирает первый.
    const cx = p.x + config.PLAYER_SIZE / 2;
    const cy = p.y + config.PLAYER_SIZE / 2;
    for (let i = this.coins.length - 1; i >= 0; i--) {
      const c = this.coins[i];
      if (Math.hypot(cx - c.x, cy - c.y) < config.PICKUP_RADIUS) {
        p.score += c.value;
        this.coins.splice(i, 1);
      }
    }
  }

  getState() {
    const payload = {
      type: 'STATE',
      status: this.status,
      timeLeft: this.timeLeft,
      roundDuration: config.ROUND_DURATION,
      intermissionDuration: config.INTERMISSION_DURATION,
      fieldWidth: config.FIELD_WIDTH,
      fieldHeight: config.FIELD_HEIGHT,
      playerSize: config.PLAYER_SIZE,
      pickupRadius: config.PICKUP_RADIUS,
      players: Array.from(this.players.values()).map(p => ({
        userId: p.userId,
        username: p.username,
        x: p.x,
        y: p.y,
        score: p.score,
        connected: p.connected
      })),
      coins: this.coins
    };

    if (this.status === 'finished') {
      payload.leaderboard = {
        lastRound: this.lastRoundLeaderboard || [],
        overall: this.overallLeaderboard || []
      };
    }

    return JSON.stringify(payload);
  }

  broadcast() {
    const msg = this.getState();
    for (const p of this.players.values()) {
      if (p.ws && p.ws.readyState === 1) p.ws.send(msg);
    }
  }

  sendTo(ws, obj) {
    if (ws.readyState === 1) ws.send(JSON.stringify(obj));
  }
}

module.exports = new RoomInstance();