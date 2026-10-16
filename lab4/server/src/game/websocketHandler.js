const room = require('./roomInstance');

function handleWebSocketConnection(ws, req) {
  let userId = null;

  ws.on('message', (raw) => {
    let data;
    try { data = JSON.parse(raw); } catch { return; }

    if (data.type === 'JOIN') {
      const id = Number(data.userId);
      const name = String(data.username || '').slice(0, 50);
      if (!id || !name) return;

      userId = id;
      room.addPlayer({ id, username: name }, ws);
      room.sendTo(ws, { type: 'WELCOME', userId: id });
      ws.send(room.getState()); // мгновенный снапшот
      return;
    }

    if (data.type === 'MOVE' && userId != null) {
      const x = Number(data.x);
      const y = Number(data.y);
      if (Number.isFinite(x) && Number.isFinite(y)) {
        room.movePlayer(userId, x, y);
      }
      return;
    }

    if (data.type === 'PING') {
      room.sendTo(ws, { type: 'PONG', t: data.t });
    }
  });

  ws.on('close', () => {
    if (userId != null) room.markDisconnected(userId);
  });

  ws.on('error', () => {});
}

module.exports = { handleWebSocketConnection };