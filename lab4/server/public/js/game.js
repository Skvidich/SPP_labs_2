import { Bot } from './bot.js';

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const esc = (s) => String(s).replace(/[&<>"']/g,
  c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

export class Game {
  constructor(els, client, user) {
    this.els = els;
    this.client = client;
    this.userId = user.id;

    this.state = null;
    this.myPos = { x: 200, y: 200 };
    this.keys = Object.create(null);
    this.botMode = false;
    this.bot = new Bot();

    this.domCache = new Map();   // key -> element
    this.tickRate = 33;          // 30 Hz local loop
    this.lastSentPos = { x: -1, y: -1 };
    this.lastSentAt = 0;

    this.bindInput();
    this.startLocalLoop();
  }

  bindInput() {
    window.addEventListener('keydown', (e) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      this.keys[k] = true;
    });
    window.addEventListener('keyup', (e) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      this.keys[k] = false;
    });
  }

  startLocalLoop() {
    this.tickTimer = setInterval(() => this.localTick(), this.tickRate);
  }

  toggleBot() { this.botMode = !this.botMode; }

  localTick() {
    if (!this.state) return;
    if (this.state.status !== 'active') return;

    let moved = false;

    if (this.botMode) {
      const next = this.bot.nextMove(this.myPos, this.state.coins);
      if (next.x !== this.myPos.x || next.y !== this.myPos.y) {
        this.myPos = next;
        moved = true;
      }
    } else {
      const step = 12;
      let dx = 0, dy = 0;
      if (this.keys['ArrowUp']    || this.keys['w'] || this.keys['ц']) dy -= step;
      if (this.keys['ArrowDown']  || this.keys['s'] || this.keys['ы']) dy += step;
      if (this.keys['ArrowLeft']  || this.keys['a'] || this.keys['ф']) dx -= step;
      if (this.keys['ArrowRight'] || this.keys['d'] || this.keys['в']) dx += step;

      if (dx || dy) {
        const maxX = this.state.fieldWidth - this.state.playerSize;
        const maxY = this.state.fieldHeight - this.state.playerSize;
        this.myPos.x = clamp(this.myPos.x + dx, 0, maxX);
        this.myPos.y = clamp(this.myPos.y + dy, 0, maxY);
        moved = true;
      }
    }

    if (moved && (this.myPos.x !== this.lastSentPos.x || this.myPos.y !== this.lastSentPos.y)) {
      this.client.sendMove(this.myPos.x, this.myPos.y);
      this.lastSentPos = { ...this.myPos };
      this.lastSentAt = performance.now();
    }
  }

  render(state) {
  this.state = state;
  this.syncMyPos(state);
  this.renderRoundInfo(state);
  this.renderScoreboard(state);
  this.renderField(state);
  this.renderOverlay(state);
}

syncMyPos(s) {
  const me = s.players.find(p => p.userId === this.userId);
  if (!me) return;

  // Если мы только что отправили MOVE — доверяем локальной позиции,
  // чтобы не было резинового отката. Иначе — берём серверную.
  const idle = performance.now() - this.lastSentAt > 300;

  // В паузе между раундами и в finished синхронизируемся всегда.
  if (idle || s.status !== 'active') {
    this.myPos.x = me.x;
    this.myPos.y = me.y;
  }
}

  renderRoundInfo(s) {
    const el = this.els.roundInfo;
    if (s.status === 'active') {
      el.innerHTML = `
        <div class="big">⏱ ${s.timeLeft} сек</div>
        <div class="label">Раунд идёт</div>`;
    } else {
      el.innerHTML = `
        <div class="big">${s.timeLeft} сек</div>
        <div class="label">До следующего раунда</div>`;
    }
  }

  renderScoreboard(s) {
    const sorted = [...s.players].sort((a, b) => b.score - a.score);
    if (sorted.length === 0) {
      this.els.scoreboard.innerHTML = '<li class="muted">Пока никого нет</li>';
      return;
    }
    this.els.scoreboard.innerHTML = sorted.map(p => `
      <li>
        <span>${esc(p.username)}${p.userId === this.userId ? ' (вы)' : ''}
          ${p.connected ? '' : '<span class="off">offline</span>'}</span>
        <b>${p.score}</b>
      </li>
    `).join('');
  }

  renderField(s) {
    const field = this.els.field;
    const alive = new Set();

    // Игроки
    for (const p of s.players) {
      const key = `p-${p.userId}`;
      alive.add(key);
      let el = this.domCache.get(key);
      if (!el) {
        el = document.createElement('div');
        field.appendChild(el);
        this.domCache.set(key, el);
      }
      el.className = 'player'
        + (p.userId === this.userId ? ' me' : '')
        + (p.connected ? '' : ' disconnected');
      el.style.left = p.x + 'px';
      el.style.top  = p.y + 'px';
      el.textContent = p.username.slice(0, 3);
      el.title = `${p.username}: ${p.score}`;
    }

    // Монеты
    for (const c of s.coins) {
      const key = `c-${c.id}`;
      alive.add(key);
      let el = this.domCache.get(key);
      if (!el) {
        el = document.createElement('div');
        field.appendChild(el);
        this.domCache.set(key, el);
      }
      el.className = `coin ${c.type}`;
      el.style.left = c.x + 'px';
      el.style.top  = c.y + 'px';
    }

    // Убираем исчезнувшие
    for (const [key, el] of this.domCache) {
      if (!alive.has(key)) { el.remove(); this.domCache.delete(key); }
    }
  }

  renderOverlay(s) {
    const ov = this.els.overlay;
    if (s.status !== 'finished') { ov.hidden = true; return; }

    ov.hidden = false;
    const lb = s.leaderboard || { lastRound: [], overall: [] };

    const lastList = lb.lastRound.length
      ? lb.lastRound.map(r => `<li><span>${esc(r.username)}</span><span class="score">${r.score}</span></li>`).join('')
      : '<li class="muted">Пока нет результатов</li>';

    const overallList = lb.overall.length
      ? lb.overall.map(r => `<li><span>${esc(r.username)}</span><span class="score">${r.total_score}</span></li>`).join('')
      : '<li class="muted">Пока нет результатов</li>';

    ov.innerHTML = `
      <h1>🏁 Раунд завершён</h1>
      <div class="big">${s.timeLeft} сек</div>
      <p class="muted">до следующего раунда</p>
      <div class="two-cols">
        <div>
          <h2>Этот раунд</h2>
          <ul>${lastList}</ul>
        </div>
        <div>
          <h2>Общий зачёт</h2>
          <ul>${overallList}</ul>
        </div>
      </div>
    `;
  }
}