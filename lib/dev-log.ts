/** Logs only in development (`next dev`, local scripts with NODE_ENV=development). No-op in production. */
export function devLog(...args: unknown[]): void {
  if (process.env.NODE_ENV === "development") {
    // eslint-disable-next-line no-console -- intentional dev-only sink
    console.log(...args);
  }
}

export function devDebug(...args: unknown[]): void {
  if (process.env.NODE_ENV === "development") {
    // eslint-disable-next-line no-console -- intentional dev-only sink
    console.debug(...args);
  }
}
