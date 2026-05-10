import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Run `fn` over `items` in chunks of `batchSize`, with an optional pause between batches. */
export async function batchAsync<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  batchSize = 3,
  delayMsBetweenBatches = 200
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map((item) => fn(item)));
    results.push(...batchResults);
    if (i + batchSize < items.length) {
      await new Promise((r) => setTimeout(r, delayMsBetweenBatches));
    }
  }
  return results;
}
