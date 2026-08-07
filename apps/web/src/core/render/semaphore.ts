// A tiny counting semaphore — bounds how many async jobs run concurrently, queueing the
// rest (FIFO) until a slot frees up. No external dependency needed for this.
export function createSemaphore(limit: number) {
  let active = 0;
  const queue: Array<() => void> = [];

  function grantNext() {
    if (active >= limit) return;
    const resolve = queue.shift();
    if (!resolve) return;
    active += 1;
    resolve();
  }

  async function run<T>(fn: () => Promise<T>): Promise<T> {
    if (active < limit) {
      active += 1;
    } else {
      await new Promise<void>((resolve) => queue.push(resolve));
    }
    try {
      return await fn();
    } finally {
      active -= 1;
      grantNext();
    }
  }

  return { run };
}
