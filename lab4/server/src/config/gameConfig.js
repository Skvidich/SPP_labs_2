module.exports = {
  ROUND_DURATION: 60,          // секунд длится раунд
  INTERMISSION_DURATION: 15,   // секунд показываем лидерборд между раундами
  FIELD_WIDTH: 800,
  FIELD_HEIGHT: 600,
  PLAYER_SIZE: 40,
  PICKUP_RADIUS: 30,           // расстояние центра игрока до центра монеты
  INITIAL_COINS: 4,
  MAX_COINS: 8,
  COIN_SPAWN_INTERVAL_MS: 1500,
  GOLD_CHANCE: 0.25,
  GOLD_VALUE: 5,
  BRONZE_VALUE: 1,
  BROADCAST_INTERVAL_MS: 33,   // ~30 Hz
  DISCONNECT_GRACE_MS: 30000   // сколько держим отключившегося игрока в памяти
};