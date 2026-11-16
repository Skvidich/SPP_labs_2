const levels = { debug: 10, info: 20, warn: 30, error: 40 };

export function createLogger(workerName, minLevel = 'info') {
  const threshold = levels[minLevel] ?? levels.info;

  function emit(level, message, attrs = {}) {
    const lvl = levels[level] ?? levels.info;
    if (lvl < threshold) return;
    let line = `[${level.toUpperCase()}] [${workerName}] ${message}`;
    if (attrs && Object.keys(attrs).length > 0) {
      line += ` ${JSON.stringify(attrs)}`;
    }
    if (lvl >= levels.warn) console.error(line);
    else console.log(line);
  }

  return {
    debug: (m, a) => emit('debug', m, a),
    info: (m, a) => emit('info', m, a),
    warn: (m, a) => emit('warn', m, a),
    error: (m, a) => emit('error', m, a),
  };
}