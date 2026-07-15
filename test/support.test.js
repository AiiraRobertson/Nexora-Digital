const test = require("node:test");
const assert = require("node:assert/strict");

// Pure logic module — no server, no network. Ensure the LLM path is disabled so
// generateSupportReply exercises the deterministic local fallback only.
delete process.env.DEEPSEEK_API_KEY;

const { generateSupportReply, buildLocalReply, STARTER_QUESTIONS } = require("../support");

test("An empty message returns the fallback reply and starter questions", () => {
  const result = buildLocalReply("");
  assert.match(result.reply, /web and mobile/i);
  assert.deepEqual(result.matchedIntents, []);
  assert.deepEqual(result.suggestedQuestions, STARTER_QUESTIONS);
});

test("Pricing keywords route to the pricing intent", () => {
  const result = buildLocalReply("How much does it cost? What is your pricing?");
  assert.ok(result.matchedIntents.includes("pricing"));
  assert.match(result.reply, /scope|timeline|milestone/i);
});

test("Timeline keywords route to the timeline intent", () => {
  const result = buildLocalReply("How long will it take to launch?");
  assert.ok(result.matchedIntents.includes("timeline"));
});

test("Training keywords route to the training intent", () => {
  const result = buildLocalReply("Do you offer coaching or a bootcamp course?");
  assert.ok(result.matchedIntents.includes("training"));
});

test("A message hitting two topics returns up to two matched intents", () => {
  const result = buildLocalReply("What is the pricing and how long is the timeline?");
  assert.ok(result.matchedIntents.length >= 1 && result.matchedIntents.length <= 2);
  assert.ok(result.matchedIntents.includes("pricing"));
  assert.ok(result.matchedIntents.includes("timeline"));
  // Suggested follow-ups are capped at three and de-duplicated.
  assert.ok(result.suggestedQuestions.length <= 3);
});

test("Unrecognized text falls back with no matched intents", () => {
  const result = buildLocalReply("purple monkey dishwasher");
  assert.deepEqual(result.matchedIntents, []);
  assert.match(result.reply, /web and mobile/i);
});

test("generateSupportReply uses the local source when no API key is set", async () => {
  const result = await generateSupportReply("How does pricing work?");
  assert.equal(result.source, "local");
  assert.ok(result.matchedIntents.includes("pricing"));
  assert.ok(typeof result.reply === "string" && result.reply.length > 0);
});
