const test = require("node:test");
const assert = require("node:assert/strict");
const os = require("node:os");
const path = require("node:path");

// ALLOWED_ORIGINS is read once at server load, so it must be set before the
// module is required. With an allowlist configured, only listed origins are
// reflected (production mode) rather than any origin (dev mode).
const ALLOWED = "https://nexoradigital.co";
process.env.ALLOWED_ORIGINS = `${ALLOWED},https://www.nexoradigital.co`;
process.env.DATA_DIR = path.join(os.tmpdir(), `nexora-cors-${process.pid}`);

const { createServer } = require("../server");
const { request, withServer: withServerBase } = require("../testkit");

const withServer = (fn) => withServerBase(createServer, fn);

test("An allowlisted origin is reflected with Vary: Origin", async () => {
  await withServer(async (server) => {
    const response = await request(server, "/api/health", {
      headers: { Origin: ALLOWED }
    });
    assert.equal(response.statusCode, 200);
    assert.equal(response.headers["access-control-allow-origin"], ALLOWED);
    assert.match(response.headers["vary"] || "", /Origin/i);
  });
});

test("A non-allowlisted origin is NOT reflected", async () => {
  await withServer(async (server) => {
    const response = await request(server, "/api/health", {
      headers: { Origin: "https://evil.example" }
    });
    assert.equal(response.statusCode, 200);
    // The allowlist is enforced: no ACAO header for an unlisted origin.
    assert.equal(response.headers["access-control-allow-origin"], undefined);
  });
});

test("OPTIONS preflight returns 204 with method and header allowances", async () => {
  await withServer(async (server) => {
    const response = await request(server, "/api/contact", {
      method: "OPTIONS",
      headers: { Origin: ALLOWED }
    });
    assert.equal(response.statusCode, 204);
    assert.equal(response.headers["access-control-allow-origin"], ALLOWED);
    assert.match(response.headers["access-control-allow-methods"], /POST/i);
    assert.match(response.headers["access-control-allow-headers"], /Content-Type/i);
  });
});
