/**
 * Automated IndexNow Crawler Dispatcher for Pantheon-10K
 * Submits M_000 Crown URLs, /llms.txt, and endpoints directly to Bing, ChatGPT Search, Copilot, & Perplexity.
 */
async function main() {
  const host = "pantheon-10k.pseudonyx43.workers.dev";
  const origin = `https://${host}`;
  const key = "f4b79ad82f0be3ce5380759a6d9786ab";
  const keyLocation = `${origin}/${key}.txt`;

  console.log("=================================================");
  console.log("   PANTHEON-10K: INDEXNOW SEARCH CRAWLER PING    ");
  console.log("=================================================");
  console.log(`Host: ${host}`);
  console.log(`Key Location: ${keyLocation}\n`);

  // Verify key is live
  try {
    const keyCheck = await fetch(keyLocation);
    const keyText = (await keyCheck.text()).trim();
    if (keyText === key) {
      console.log(`[✓] Key verification file is LIVE at edge: ${keyLocation}`);
    } else {
      console.warn(`[!] Key mismatch: Expected '${key}', got '${keyText}'`);
    }
  } catch (e: any) {
    console.error(`[X] Could not fetch key: ${e.message}`);
  }

  // Generate URL list for static Crown pages (T_0000 to T_0501)
  const urlList: string[] = [
    `${origin}/`,
    `${origin}/llms.txt`,
    `${origin}/openapi.json`,
    `${origin}/.well-known/ai-plugin.json`,
    `${origin}/solve/php2shell-cve-2026-109618`,
    `${origin}/solve/cve-2024-4577-php-cgi`,
  ];

  for (let i = 0; i <= 501; i++) {
    const tCode = `T_${String(i).padStart(4, "0")}`;
    urlList.push(`${origin}/${tCode}/S_00`);
  }
  urlList.push(`${origin}/T_0501/S_01`);
  urlList.push(`${origin}/T_0501/S_02`);

  console.log(`Prepared ${urlList.length} Crown URLs for submission.`);

  const payload = {
    host,
    key,
    keyLocation,
    urlList,
  };

  const endpoints = [
    { name: "IndexNow Global (indexnow.org)", url: "https://api.indexnow.org/indexnow" },
    { name: "Microsoft Bing & Copilot & ChatGPT Search", url: "https://www.bing.com/indexnow" },
    { name: "Yandex IndexNow Gateway", url: "https://yandex.com/indexnow" },
  ];

  for (const ep of endpoints) {
    try {
      console.log(`\nSubmitting ${urlList.length} URLs to ${ep.name}...`);
      const res = await fetch(ep.url, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify(payload),
      });

      console.log(`Response: HTTP ${res.status} ${res.statusText}`);
      if (res.status === 200 || res.status === 202) {
        console.log(`[✓] SUCCESS: ${ep.name} accepted crawler batch queue.`);
      } else {
        const text = await res.text();
        console.log(`Status details: ${text.substring(0, 200)}`);
      }
    } catch (e: any) {
      console.log(`[!] Submission to ${ep.name} failed: ${e.message}`);
    }
  }

  console.log("\n=================================================");
  console.log("   INDEXNOW SUBMISSION PROTOCOL COMPLETE         ");
  console.log("=================================================");
}

main().catch(console.error);
