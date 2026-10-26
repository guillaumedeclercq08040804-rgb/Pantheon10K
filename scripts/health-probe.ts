/**
 * Automated Health & Edge Telemetry Probe for Pantheon-10K (Phase 6)
 * Continuously verifies uptime across critical machine endpoints:
 * - /api/telemetry (Edge DB & Ingestion latency)
 * - /llms.txt (Machine protocol manifest)
 * - /mcp.json (Model Context Protocol catalog)
 * - /T_0000/S_00 (Thermostat & Core Coordinate)
 * Dispatches alerts to webhook (Discord / Slack / generic) if edge errors occur.
 */

const ORIGIN = process.env.PANTHEON_ORIGIN || "https://pantheon-10k.pseudonyx43.workers.dev";
const ALERT_WEBHOOK = process.env.ALERT_WEBHOOK_URL;

interface ProbeResult {
  endpoint: string;
  status: number;
  durationMs: number;
  healthy: boolean;
  details?: string;
}

async function probeUrl(path: string): Promise<ProbeResult> {
  const url = `${ORIGIN}${path}`;
  const start = performance.now();
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Pantheon10K-HealthProbe/2.1" } });
    const durationMs = Math.round(performance.now() - start);
    return {
      endpoint: path,
      status: res.status,
      durationMs,
      healthy: res.ok,
    };
  } catch (err: any) {
    return {
      endpoint: path,
      status: 0,
      durationMs: Math.round(performance.now() - start),
      healthy: false,
      details: err.message,
    };
  }
}

async function dispatchAlert(failures: ProbeResult[]) {
  if (!ALERT_WEBHOOK) {
    console.log(`[!] Alert Webhook URL not configured. Simulating dispatch:`);
    console.log(`    Detected ${failures.length} failing endpoints on ${ORIGIN}`);
    return;
  }

  const payload = {
    content: `🚨 **Pantheon-10K Edge Health Alert**\n` +
             `Gateway: \`${ORIGIN}\`\n` +
             `Failures:\n` +
             failures.map((f) => `- \`${f.endpoint}\`: HTTP ${f.status} (${f.durationMs}ms)`).join("\n"),
  };

  try {
    await fetch(ALERT_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    console.log(`[✓] Dispatched incident alert to webhook.`);
  } catch (e: any) {
    console.error(`[X] Failed sending alert webhook: ${e.message}`);
  }
}

async function runProbeCycle() {
  const endpoints = [
    "/",
    "/api/telemetry",
    "/llms.txt",
    "/mcp.json",
    "/.well-known/ai-plugin.json",
    "/T_0000/S_00",
    "/T_0501/S_00",
    "/solve/php2shell-cve-2026-109618",
  ];

  console.log(`\n🔍 [${new Date().toISOString()}] Initiating Edge Health Probe (${ORIGIN})...`);
  const results: ProbeResult[] = [];

  for (const ep of endpoints) {
    const r = await probeUrl(ep);
    results.push(r);
    const icon = r.healthy ? "✓" : "✗";
    console.log(`  [${icon}] ${r.endpoint.padEnd(35)} HTTP ${r.status} (${r.durationMs}ms)`);
  }

  const failures = results.filter((r) => !r.healthy);
  if (failures.length > 0) {
    console.error(`\n⚠️ Detected ${failures.length} health probe failures!`);
    await dispatchAlert(failures);
  } else {
    console.log(`\n🎉 All ${results.length} edge endpoints operational with 100% availability.`);
  }
}

async function main() {
  const isLoop = process.argv.includes("--loop");
  await runProbeCycle();

  if (isLoop) {
    console.log(`\nContinuous monitoring active. Probing every 60 seconds... (Press Ctrl+C to stop)`);
    setInterval(runProbeCycle, 60000);
  }
}

main().catch(console.error);
