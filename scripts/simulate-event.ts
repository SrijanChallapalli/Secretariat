#!/usr/bin/env npx tsx
/**
 * Smoke test: simulate an event via the server pipeline and print results.
 * Usage: npx tsx scripts/simulate-event.ts [tokenId] [eventType]
 *
 * Requires the server running on localhost:4000 (or SERVER_URL env).
 */

const SERVER = process.env.SERVER_URL || process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:4000";
const TOKEN_ID = Number(process.argv[2] ?? 0);
const EVENT_TYPE = (process.argv[3] ?? "RACE_RESULT") as "RACE_RESULT" | "INJURY" | "NEWS";

const PARAMS: Record<string, object> = {
  RACE_RESULT: { finishPosition: 1, earningsADI: "500", raceClass: "Grade 1", track: "Churchill Downs" },
  INJURY: { severityBps: 1000, injuryType: "Tendon strain", expectedDaysOut: 60 },
  NEWS: { sentimentBps: 300, headline: "Horse featured in major racing publication" },
};

async function main() {
  console.log(`\n--- Simulate Event Pipeline ---`);
  console.log(`Server:    ${SERVER}`);
  console.log(`Token ID:  ${TOKEN_ID}`);
  console.log(`Type:      ${EVENT_TYPE}\n`);

  // Step 1: Simulate
  console.log("1) POST /events/simulate ...");
  const simRes = await fetch(`${SERVER}/events/simulate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tokenId: TOKEN_ID, type: EVENT_TYPE, params: PARAMS[EVENT_TYPE] }),
  });
  if (!simRes.ok) {
    const err = await simRes.text();
    console.error(`   FAILED (${simRes.status}): ${err}`);
    process.exit(1);
  }
  const simData = await simRes.json();
  console.log(`   eventId:   ${simData.event.eventId}`);
  console.log(`   eventHash: ${simData.eventHash}`);

  // Step 2: Apply
  console.log("\n2) POST /oracle/apply-event ...");
  const applyRes = await fetch(`${SERVER}/oracle/apply-event`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event: simData.event, uploadTo0g: false }),
  });
  if (!applyRes.ok) {
    const err = await applyRes.text();
    console.error(`   FAILED (${applyRes.status}): ${err}`);
    process.exit(1);
  }
  const result = await applyRes.json();

  console.log(`   eventHash:          ${result.eventHash}`);
  console.log(`   previousValuation:  ${result.previousValuationADI}`);
  console.log(`   newValuation:       ${result.newValuationADI}`);
  console.log(`   multiplier:         ${result.multiplier}x`);
  console.log(`   txHash:             ${result.txHash}`);
  console.log(`   ogRootHash:         ${result.ogRootHash ?? "(none)"}`);
  console.log(`   submittedAt:        ${result.submittedAt}`);

  if (result.valuationResult?.explanation) {
    const expl = typeof result.valuationResult.explanation === "string"
      ? result.valuationResult.explanation
      : result.valuationResult.explanation.summary;
    console.log(`   explanation:        ${expl}`);
  }

  console.log("\nDone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
