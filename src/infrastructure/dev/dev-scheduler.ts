import { env } from "@/config/env";

const globalForScheduler = globalThis as unknown as {
  __devEmailSchedulerActive?: boolean;
  __devEmailSchedulerTimeout?: NodeJS.Timeout;
};

export function startDevEmailOutboxScheduler() {
  // 1. Only run in development
  if (env.NODE_ENV !== "development") return;
  
  // 2. Do not run on client side
  if (typeof window !== "undefined") return;

  // 3. Prevent duplicate loops during hot-reloads
  if (globalForScheduler.__devEmailSchedulerActive) {
    return;
  }
  
  globalForScheduler.__devEmailSchedulerActive = true;

  console.log("???  [Dev Scheduler] Starting automatic email outbox scheduler...");

  const triggerCron = async () => {
    try {
      const port = process.env.PORT || 3000;
      const url = `http://127.0.0.1:${port}/api/cron/email-outbox`;

      const response = await fetch(url, {
        method: "GET",
        headers: {
          authorization: `Bearer ${env.CRON_SECRET}`,
        },
      });
      
      if (!response.ok) {
        console.error(`???  [Dev Scheduler] Email outbox cron returned status ${response.status}`);
      }
    } catch (error) {
      console.error("???  [Dev Scheduler] Failed to trigger email outbox cron:", error);
    } finally {
      // 4. Avoid overlapping worker invocations by chaining timeouts
      globalForScheduler.__devEmailSchedulerTimeout = setTimeout(triggerCron, 20000);
    }
  };

  // Start the loop (initial delay 20s)
  globalForScheduler.__devEmailSchedulerTimeout = setTimeout(triggerCron, 20000);
}
