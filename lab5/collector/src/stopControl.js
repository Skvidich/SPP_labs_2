export class StopControl {
  constructor(limit) {
    this.limit = limit;
    this.stop = false;
    this.total = 0;
    // Счётчик батчей между полными COUNT(*) для интервального пересчёта total.
    this.recountCounter = 0;
  }

  shouldStop() {
    return this.stop;
  }

  // Всегда запоминает максимум из виденного COUNT(*): параллельные воркеры
  // видят разные MVCC-снимки, поэтому результат может приходить не по порядку.
  setTotal(total) {
    if (total > this.total) this.total = total;
    if (this.total > this.limit) {
      this.stop = true;
      return true;
    }
    return false;
  }
}

export const stopControl = new StopControl(Number(process.env.COLLECTOR_STOP_LIMIT ?? 10000));