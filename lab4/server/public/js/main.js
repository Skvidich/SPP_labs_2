import { WSClient } from './ws.js';
import { Game } from './game.js';

const $ = (id) => document.getElementById(id);

const els = {
  loginScreen: $('login-screen'),
  gameScreen: $('game-screen'),
  loginForm: $('login-form'),
  loginInput: $('login-username'),
  loginError: $('login-error'),
  connStatus: $('conn-status'),
  myName: $('my-name'),
  btnBot: $('btn-bot'),
  btnLogout: $('btn-logout'),
  field: $('field'),
  overlay: $('field-overlay'),
  roundInfo: $('round-info'),
  scoreboard: $('scoreboard')
};

let user = JSON.parse(sessionStorage.getItem('coin_rush_user') || 'null');
let client = null;
let game = null;

function setScreen(name) {
  els.loginScreen.hidden = name !== 'login';
  els.gameScreen.hidden = name !== 'game';
}

async function doLogin(username) {
  const res = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username })
  });
  if (!res.ok) throw new Error((await res.json()).error || 'Login failed');
  return res.json();
}

els.loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  els.loginError.textContent = '';
  const name = els.loginInput.value.trim();
  if (!name) return;
  try {
    const u = await doLogin(name);
    user = u;
    sessionStorage.setItem('coin_rush_user', JSON.stringify(u));
    startGame();
  } catch (err) {
    els.loginError.textContent = err.message;
  }
});

els.btnLogout.addEventListener('click', () => {
  if (client) client.close();
  sessionStorage.removeItem('coin_rush_user');
  user = null;
  client = null;
  game = null;
  els.loginInput.value = '';
  setScreen('login');
});

els.btnBot.addEventListener('click', () => {
  if (!game) return;
  game.toggleBot();
  const on = game.botMode;
  els.btnBot.textContent = `🤖 Бот: ${on ? 'вкл' : 'выкл'}`;
  els.btnBot.classList.toggle('secondary', !on);
});

function startGame() {
  // На случай повторного вызова — закрываем старое соединение
  if (client) { client.close(); client = null; }

  setScreen('game');
  els.myName.textContent = `👤 ${user.username}`;
  els.btnBot.textContent = '🤖 Бот: выкл';
  els.btnBot.classList.add('secondary');

  client = new WSClient(user);
  game = new Game(els, client, user);

  client.onState = (s) => game.render(s);
  client.onStatus = (online) => {
    els.connStatus.textContent = online ? '🟢 Подключено' : '🔴 Переподключение...';
    els.connStatus.className = `conn ${online ? 'online' : 'offline'}`;
  };

  client.connect();
}

// Автологин при перезагрузке
if (user) startGame();
else setScreen('login');