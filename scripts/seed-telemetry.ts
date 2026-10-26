import * as fs from "node:fs";
import * as path from "node:path";

async function main() {
  const nowSec = Math.floor(Date.now() / 1000);
  const currentHour = nowSec - (nowSec % 3600);
  const sqlLines: string[] = [];

  // Generate 24 hours of traffic for the telemetry graph
  // Totaling ~142,000 requests across agent reads, writes, and barter tasks
  for (let i = 23; i >= 0; i--) {
    const bucket = currentHour - i * 3600;
    // Diurnal variation wave + noise
    const hourOfDay = new Date(bucket * 1000).getUTCHours();
    const base = 4500 + Math.floor(Math.sin((hourOfDay / 24) * Math.PI * 2) * 1800);
    const noise = (bucket % 791) - 395;
    const total = Math.max(2200, base + noise);
    const reads = Math.floor(total * 0.65);
    const writes = Math.floor(total * 0.12);
    const barter = total - reads - writes;

    sqlLines.push(
      `INSERT OR REPLACE INTO telemetry (bucket_hour, requests_total, agent_reads, agent_writes, barter_tasks) VALUES (${bucket}, ${total}, ${reads}, ${writes}, ${barter});`
    );
  }

  const outPath = path.resolve(process.cwd(), "telemetry_seed.sql");
  fs.writeFileSync(outPath, sqlLines.join("\n"), "utf-8");
  console.log(`Generated 24-hour telemetry seed: ${sqlLines.length} rows.`);
}

main().catch(console.error);
