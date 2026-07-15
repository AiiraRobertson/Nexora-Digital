const test = require("node:test");
const assert = require("node:assert/strict");
const os = require("node:os");
const path = require("node:path");

// Isolate test writes from the real data/ directory. server.js resolves its
// data path once at module load, so this must run before requiring it.
process.env.DATA_DIR = path.join(os.tmpdir(), `nexora-test-${process.pid}`);

const { createServer } = require("../server");
const { serviceTitles } = require("../services");
const { request, postJson, withServer: withServerBase } = require("../testkit");

// Bind the shared harness to this file's configured server factory so the
// existing withServer(fn) call sites stay unchanged.
const withServer = (fn) => withServerBase(createServer, fn);

test("GET /api returns available endpoints", async () => {
  await withServer(async (server) => {
    const response = await request(server, "/api");
    assert.equal(response.statusCode, 200);

    const payload = JSON.parse(response.body);
    assert.equal(payload.ok, true);
    assert.ok(Array.isArray(payload.endpoints));

    // Endpoints are described objects: { method, path, description }.
    const paths = payload.endpoints.map((endpoint) => endpoint.path);
    assert.ok(paths.includes("/api/health"));
    assert.ok(paths.includes("/api/contact"));

    const health = payload.endpoints.find((endpoint) => endpoint.path === "/api/health");
    assert.equal(health.method, "GET");
    assert.ok(typeof health.description === "string" && health.description.length > 0);
  });
});

test("OPTIONS /api/contact responds with CORS headers", async () => {
  await withServer(async (server) => {
    const response = await request(server, "/api/contact", {
      method: "OPTIONS",
      headers: {
        Origin: "https://example.com"
      }
    });

    assert.equal(response.statusCode, 204);
    // With no ALLOWED_ORIGINS allowlist configured, the server reflects the
    // request origin (dev-friendly) rather than sending a blanket "*".
    assert.equal(response.headers["access-control-allow-origin"], "https://example.com");
    assert.match(response.headers["access-control-allow-methods"], /POST/i);
  });
});

test("GET /api/health reports the backend is running", async () => {
  await withServer(async (server) => {
    const response = await request(server, "/api/health");
    assert.equal(response.statusCode, 200);

    const payload = JSON.parse(response.body);
    assert.equal(payload.ok, true);
    assert.ok(typeof payload.timestamp === "string" && payload.timestamp.length > 0);
  });
});

test("GET /api/services returns the service catalogue", async () => {
  await withServer(async (server) => {
    const response = await request(server, "/api/services");
    assert.equal(response.statusCode, 200);

    const payload = JSON.parse(response.body);
    assert.ok(Array.isArray(payload.services));
    assert.equal(payload.services.length, serviceTitles.length);
    for (const service of payload.services) {
      assert.ok(service.slug && service.title && service.summary);
    }
  });
});

test("POST /api/contact rejects an invalid submission with field errors", async () => {
  await withServer(async (server) => {
    const response = await postJson(server, "/api/contact", {
      name: "",
      email: "not-an-email",
      service: "Nonexistent service",
      message: "too short"
    });

    assert.equal(response.statusCode, 400);
    const payload = JSON.parse(response.body);
    assert.equal(payload.ok, false);
    assert.ok(payload.errors.name);
    assert.ok(payload.errors.email);
    assert.ok(payload.errors.service);
    assert.ok(payload.errors.message);
  });
});

test("POST /api/contact accepts a valid submission", async () => {
  await withServer(async (server) => {
    const response = await postJson(server, "/api/contact", {
      name: "Ada Lovelace",
      email: "ada@example.com",
      service: serviceTitles[0],
      message: "I would like to discuss building a customer portal for my business."
    });

    assert.equal(response.statusCode, 201);
    const payload = JSON.parse(response.body);
    assert.equal(payload.ok, true);
    assert.ok(/^inq-/.test(payload.inquiryId));
  });
});

test("POST /api/contact silently accepts and discards honeypot spam", async () => {
  await withServer(async (server) => {
    const response = await postJson(server, "/api/contact", {
      name: "Spam Bot",
      email: "bot@example.com",
      service: serviceTitles[0],
      message: "This looks like a normal message but the honeypot is filled.",
      website: "http://spam.example"
    });

    // Honeypot hits pretend success so bots do not learn they were caught.
    assert.equal(response.statusCode, 200);
    const payload = JSON.parse(response.body);
    assert.equal(payload.ok, true);
  });
});

test("GET /api/inquiries requires an admin token", async () => {
  await withServer(async (server) => {
    const response = await request(server, "/api/inquiries");
    assert.equal(response.statusCode, 401);
    const payload = JSON.parse(response.body);
    assert.equal(payload.ok, false);
    assert.match(response.headers["www-authenticate"] || "", /Bearer/i);
  });
});

test("Unknown API paths return a JSON 404", async () => {
  await withServer(async (server) => {
    const response = await request(server, "/api/does-not-exist");
    assert.equal(response.statusCode, 404);
    const payload = JSON.parse(response.body);
    assert.equal(payload.ok, false);
  });
});

test("Wrong method on a known API path returns 405 with Allow header", async () => {
  await withServer(async (server) => {
    const response = await request(server, "/api/health", { method: "POST" });
    assert.equal(response.statusCode, 405);
    assert.match(response.headers["allow"] || "", /GET/i);
  });
});

test("POST /api/support returns a helpful reply", async () => {
  await withServer(async (server) => {
    const response = await postJson(server, "/api/support", {
      message: "How fast can you build my app?"
    });

    assert.equal(response.statusCode, 200);
    const payload = JSON.parse(response.body);
    assert.equal(payload.ok, true);
    assert.match(payload.reply, /timeline|launch|delivery/i);
  });
});

test("Static files advertise Accept-Ranges (media playback needs it)", async () => {
  await withServer(async (server) => {
    const response = await request(server, "/styles.css");
    assert.equal(response.statusCode, 200);
    assert.equal(response.headers["accept-ranges"], "bytes");
    assert.ok(Number(response.headers["content-length"]) > 0);
  });
});

test("A Range request yields 206 Partial Content with Content-Range", async () => {
  await withServer(async (server) => {
    const response = await request(server, "/styles.css", {
      headers: { Range: "bytes=0-99" }
    });
    assert.equal(response.statusCode, 206);
    assert.match(response.headers["content-range"] || "", /^bytes 0-99\/\d+$/);
    assert.equal(response.headers["content-length"], "100");
    assert.equal(Buffer.byteLength(response.body), 100);
  });
});

test("An unsatisfiable Range yields 416", async () => {
  await withServer(async (server) => {
    const response = await request(server, "/styles.css", {
      headers: { Range: "bytes=99999999-" }
    });
    assert.equal(response.statusCode, 416);
    assert.match(response.headers["content-range"] || "", /^bytes \*\/\d+$/);
  });
});
