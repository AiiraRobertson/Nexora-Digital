const test = require("node:test");
const assert = require("node:assert/strict");
const os = require("node:os");
const path = require("node:path");

// ADMIN_TOKEN and DATA_DIR are read once at server load, so both must be set
// before requiring the module.
const ADMIN_TOKEN = "test-admin-token-123";
process.env.ADMIN_TOKEN = ADMIN_TOKEN;
process.env.DATA_DIR = path.join(os.tmpdir(), `nexora-auth-${process.pid}`);

const { createServer } = require("../server");
const { serviceTitles } = require("../services");
const { request, postJson, withServer: withServerBase } = require("../testkit");

const withServer = (fn) => withServerBase(createServer, fn);

const auth = { Authorization: `Bearer ${ADMIN_TOKEN}` };

function validInquiry(overrides = {}) {
  return {
    name: "Ada Lovelace",
    email: "ada@example.com",
    service: serviceTitles[0],
    message: "I would like to discuss building a customer portal for my business.",
    ...overrides
  };
}

test("GET /api/inquiries with a valid admin token returns 200", async () => {
  await withServer(async (server) => {
    const response = await request(server, "/api/inquiries", { headers: auth });
    assert.equal(response.statusCode, 200);
    const payload = JSON.parse(response.body);
    assert.equal(payload.ok, true);
    assert.ok(Array.isArray(payload.inquiries));
  });
});

test("A wrong token is rejected (401)", async () => {
  await withServer(async (server) => {
    const response = await request(server, "/api/inquiries", {
      headers: { Authorization: "Bearer wrong-token" }
    });
    assert.equal(response.statusCode, 401);
  });
});

test("A malformed Authorization header is rejected (401)", async () => {
  await withServer(async (server) => {
    const response = await request(server, "/api/inquiries", {
      headers: { Authorization: ADMIN_TOKEN } // missing "Bearer " prefix
    });
    assert.equal(response.statusCode, 401);
  });
});

test("A submitted inquiry is persisted and read back newest-first", async () => {
  await withServer(async (server) => {
    const before = JSON.parse(
      (await request(server, "/api/inquiries", { headers: auth })).body
    );

    const created = await postJson(server, "/api/contact", validInquiry({ name: "First Person" }));
    assert.equal(created.statusCode, 201);
    const created2 = await postJson(server, "/api/contact", validInquiry({ name: "Second Person" }));
    assert.equal(created2.statusCode, 201);

    const after = JSON.parse(
      (await request(server, "/api/inquiries", { headers: auth })).body
    );
    assert.equal(after.total, before.total + 2);
    // Newest first: the most recently submitted inquiry leads the list.
    assert.equal(after.inquiries[0].name, "Second Person");
    assert.equal(after.inquiries[1].name, "First Person");
    assert.ok(/^inq-/.test(after.inquiries[0].id));
  });
});

test("Pagination clamps limit and honors offset", async () => {
  await withServer(async (server) => {
    // Seed a handful of inquiries.
    for (let i = 0; i < 5; i += 1) {
      await postJson(server, "/api/contact", validInquiry({ name: `Seed ${i}`, email: `seed${i}@example.com` }));
    }

    // A missing/zero limit falls back to the default of 50 (0 is falsy).
    const defaulted = JSON.parse(
      (await request(server, "/api/inquiries?limit=0", { headers: auth })).body
    );
    assert.equal(defaulted.limit, 50);

    // A negative limit is truthy, so it hits the floor clamp of 1.
    const clampedLow = JSON.parse(
      (await request(server, "/api/inquiries?limit=-5", { headers: auth })).body
    );
    assert.equal(clampedLow.limit, 1);
    assert.equal(clampedLow.inquiries.length, 1);

    // limit above the ceiling is clamped down to 200.
    const clampedHigh = JSON.parse(
      (await request(server, "/api/inquiries?limit=9999", { headers: auth })).body
    );
    assert.equal(clampedHigh.limit, 200);

    // offset skips the requested number of (newest-first) records.
    const page = JSON.parse(
      (await request(server, "/api/inquiries?limit=2&offset=1", { headers: auth })).body
    );
    assert.equal(page.limit, 2);
    assert.equal(page.offset, 1);
    assert.equal(page.inquiries.length, 2);
  });
});
