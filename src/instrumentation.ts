// Runs once per server start, before requests are served.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { ensureWal } = await import("./server/db");
  const { loadClockOffset, MINUTE_MS } = await import("./server/clock");
  const { sweep } = await import("./server/sweep");

  await ensureWal();
  await loadClockOffset();

  // TRD §5.9: sweep every 60 s. unref() so the timer never keeps a process alive on its own.
  const store = globalThis as unknown as { svSweepTimer?: NodeJS.Timeout };
  if (!store.svSweepTimer) {
    const run = () => sweep().catch((err: unknown) => console.error("sweep failed", err));
    void run();
    store.svSweepTimer = setInterval(run, MINUTE_MS);
    store.svSweepTimer.unref();
  }
}
