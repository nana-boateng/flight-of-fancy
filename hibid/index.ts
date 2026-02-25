import { runOnce, startScheduler } from "./src/scheduler";

if (Bun.argv.includes("--run-once")) {
  await runOnce();
  process.exit(0);
}

startScheduler();
