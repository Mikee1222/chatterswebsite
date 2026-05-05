const fs = require("fs");
const path = require("path");

const workerPath = path.join(__dirname, "../.open-next/worker.js");

if (!fs.existsSync(workerPath)) {
  console.error("Missing .open-next/worker.js — run opennextjs-cloudflare build first.");
  process.exit(1);
}

console.log("Appending RealtimeHub (deprecated stub) export to worker.js for DO migration…");

let workerContent = fs.readFileSync(workerPath, "utf8");

if (workerContent.includes("export { RealtimeHub }")) {
  console.log("RealtimeHub export already present, skipping.");
  process.exit(0);
}

const realtimeHubCode = `
class RealtimeHub {
  constructor(state, env) {}

  async fetch(request) {
    return new Response("Deprecated - realtime functionality removed", {
      status: 410,
    });
  }
}
`;

workerContent += "\n\n// === Durable Object export (temporary, migration cleanup) ===\n";
workerContent += realtimeHubCode;
workerContent += "\nexport { RealtimeHub };\n";

fs.writeFileSync(workerPath, workerContent);
console.log("Done.");
