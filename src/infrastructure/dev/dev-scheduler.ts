import { env } from "@/config/env";

const globalForScheduler = globalThis as unknown as {
  __devEmailSchedulerActive?: boolean;
  __devEmailSchedulerTimeout?: NodeJS.Timeout;
};

export function startDevEmailOutboxScheduler() {
  if (env.NODE_ENV !== "development") return;
  if (typeof window !== "undefined") return;
  if (globalForScheduler.__devEmailSchedulerActive) return;
  
  globalForScheduler.__devEmailSchedulerActive = true;
  console.log("?? [Dev Scheduler] Starting automatic crons (email & reconciler)...");

  const triggerCron = async () => {
    try {
      const port = process.env.PORT || 3000;
      const headers = { authorization: `Bearer ${env.CRON_SECRET}` };
      
      const urls = [
        `http://127.0.0.1:${port}/api/cron/email-outbox`,
        `http://127.0.0.1:${port}/api/cron/reconciler`
      ];

      for (const url of urls) {
        try {
          const res = await fetch(url, { method: "GET", headers });
          if (!res.ok) {
            console.error(`? [Dev Scheduler] Cron ${url} returned status ${res.status}`);
          }
        } catch (e) {
          console.error(`? [Dev Scheduler] Failed to fetch ${url}:`, e instanceof Error ? e.message : String(e));
        }
      }
    } catch (error) {
      console.error("? [Dev Scheduler] Failed to trigger dev crons:", error);
    } finally {
      globalForScheduler.__devEmailSchedulerTimeout = setTimeout(triggerCron, 20000);
    }
  };

  globalForScheduler.__devEmailSchedulerTimeout = setTimeout(triggerCron, 20000);
}
