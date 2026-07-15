const test = require("node:test");
const assert = require("node:assert/strict");
const os = require("node:os");
const path = require("node:path");

// Isolated process: this file deliberately exhausts the module-global rate
// limiter, so it must not share a process with other request tests.
process.env.DATA_DIR = path.join(os.tmpdir(), `nexora-rl-${process.pid}`);

const { createServer } = require("../server");
const { postJson, withServer: withServerBase } = require("../testkit");

const withServer = (fn) => withServerBase(createServer, fn);

// Mirrors RATE_LIMIT_MAX in server.js.
const RATE_LIMIT_MAX = 5;

test("Sensitive routes rate-limit after the window max (429 + Retry-After)", async () => {
  await withServer(async (server) => {
    // The first RATE_LIMIT_MAX support requests are allowed.
    for (let i = 0; i < RATE_LIMIT_MAX; i += 1) {
      const response = await postJson(server, "/api/support", { message: "hello" });
      assert.equal(response.statusCode, 200, `request ${i + 1} should be allowed`);
    }

    // The next request from the same client is throttled.
    const throttled = await postJson(server, "/api/support", { message: "hello again" });
    assert.equal(throttled.statusCode, 429);
    assert.ok(Number(throttled.headers["retry-after"]) >= 1);
    const payload = JSON.parse(throttled.body);
    assert.equal(payload.ok, false);
  });
});
