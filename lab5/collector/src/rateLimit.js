export class RateLimiter {
  constructor(rateMs) {
    this.rateMs = rateMs;
    this.nextAllowed = 0;
  }

  async wait() {
    const now = Date.now();
    const wait = this.nextAllowed - now;
    if (wait > 0) {
      await sleep(wait);
    }
    this.nextAllowed = Date.now() + this.rateMs;
  }
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}