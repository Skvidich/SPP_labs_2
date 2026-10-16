export class WSClient {
  constructor(user) {
    this.user = user;
    this.ws = null;
    this.onState = null;
    this.onStatus = null;
    this.reconnectDelay = 800;
    this.manualClose = false;
    this.hbTimer = null;
    this.pongTimer = null;
  }

  connect() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const url = `${proto}://${location.host}`;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.reconnectDelay = 800;
      this.onStatus?.(true);
      this.ws.send(JSON.stringify({
        type: 'JOIN',
        userId: this.user.id,
        username: this.user.username
      }));
      this.startHeartbeat();
    };

    this.ws.onmessage = (e) => {
      let msg;
      try { msg = JSON.parse(e.data); } catch { return; }
      if (msg.type === 'PONG') {
        clearTimeout(this.pongTimer);
        this.pongTimer = null;
        return;
      }
      if (msg.type === 'STATE') this.onState?.(msg);
    };

    this.ws.onclose = () => {
      this.onStatus?.(false);
      this.stopHeartbeat();
      if (this.manualClose) return;
      const delay = this.reconnectDelay;
      this.reconnectDelay = Math.min(this.reconnectDelay * 1.6, 8000);
      setTimeout(() => this.connect(), delay);
    };

    this.ws.onerror = () => { /* закроется через onclose */ };
  }

  startHeartbeat() {
    this.stopHeartbeat();
    this.hbTimer = setInterval(() => {
      if (this.ws?.readyState !== WebSocket.OPEN) return;

      this.ws.send(JSON.stringify({ type: 'PING', t: Date.now() }));

      // Если PONG не пришёл за 4 сек — считаем соединение мёртвым и рвём.
      // Это запустит onclose → reconnect.
      clearTimeout(this.pongTimer);
      this.pongTimer = setTimeout(() => {
        if (this.ws?.readyState === WebSocket.OPEN) {
          console.warn('⚠️  PONG timeout — closing dead connection');
          this.ws.close();
        }
      }, 4000);
    }, 5000);
  }

  stopHeartbeat() {
    if (this.hbTimer)   { clearInterval(this.hbTimer);   this.hbTimer = null; }
    if (this.pongTimer) { clearTimeout(this.pongTimer);  this.pongTimer = null; }
  }

  sendMove(x, y) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'MOVE', x, y }));
    }
  }

  close() {
    this.manualClose = true;
    this.stopHeartbeat();
    this.ws?.close();
  }
}