/** Serialize Airtable traffic — max concurrent requests to reduce 429 bursts. */

type QueuedJob = () => Promise<void>;

class AirtableQueue {
  private readonly queue: QueuedJob[] = [];
  private running = 0;
  private readonly maxConcurrent = 4;

  add<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          resolve(await fn());
        } catch (e) {
          reject(e);
        }
      });
      this.pump();
    });
  }

  private pump(): void {
    if (this.running >= this.maxConcurrent) return;
    const job = this.queue.shift();
    if (!job) return;
    this.running++;
    void Promise.resolve(job())
      .catch(() => {
        /* rejection already forwarded to add() consumer */
      })
      .finally(() => {
        this.running--;
        this.pump();
      });
  }
}

export const airtableQueue = new AirtableQueue();
