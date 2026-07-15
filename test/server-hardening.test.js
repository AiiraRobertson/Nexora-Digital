const test = require("node:test");
const assert = require("node:assert/strict");
const os = require("node:os");
const path = require("node:path");

// Isolate any writes; set before requiring the server (env read at load).
process.env.DATA_DIR = path.join(os.tmpdir(), `nexora-harden-${process.pid}`);

const { createServer } = require("../server");
const { request, withServer: withServerBase } = require("../testkit");

const withServer = (fn) => withServerBase(createServer, fn);

test("Directory traversal outside the web root is forbidden (403)", async () => {
  await withServer(async (server) => {
    // Encoded backslashes survive URL normalization and resolve above rootDir,
    // tripping the boundary-aware containment check in serveStatic.
    const response = await request(server, "/..%5c..%5cserver.js");
    assert.equal(response.statusCode, 403);
    const payload = JSON.parse(response.body);
    assert.equal(payload.error, "Forbidden");
  });
});

test("A null-byte in the path is rejected (400)", async () => {
  await withServer(async (server) => {
    // Null-byte injection guard (defends against path truncation attacks).
    const response = await request(server, "/styles%00.css");
    assert.equal(response.statusCode, 400);
  });
});

test("A missing static file returns 404", async () => {
  await withServer(async (server) => {
    const response = await request(server, "/does-not-exist.css");
    assert.equal(response.statusCode, 404);
  });
});

test("An existing asset is served with correct type and long cache", async () => {
  await withServer(async (server) => {
    const response = await request(server, "/styles.css");
    assert.equal(response.statusCode, 200);
    assert.match(response.headers["content-type"], /text\/css/);
    assert.match(response.headers["cache-control"], /max-age=86400/);
    assert.ok(response.byteLength > 0);
  });
});

test("HTML is served but kept fresh (no-cache)", async () => {
  await withServer(async (server) => {
    const response = await request(server, "/");
    assert.equal(response.statusCode, 200);
    assert.match(response.headers["content-type"], /text\/html/);
    assert.match(response.headers["cache-control"], /no-cache/);
  });
});

test("Responses carry hardening security headers", async () => {
  await withServer(async (server) => {
    const response = await request(server, "/styles.css");
    assert.equal(response.headers["x-content-type-options"], "nosniff");
    assert.equal(response.headers["referrer-policy"], "strict-origin-when-cross-origin");
    assert.equal(response.headers["x-frame-options"], "SAMEORIGIN");
  });
});

test("HEAD on an asset returns headers with an empty body", async () => {
  await withServer(async (server) => {
    const response = await request(server, "/styles.css", { method: "HEAD" });
    assert.equal(response.statusCode, 200);
    assert.ok(Number(response.headers["content-length"]) > 0);
    assert.equal(response.byteLength, 0);
  });
});

test("A body over the size cap is rejected (413)", async () => {
  await withServer(async (server) => {
    // >100 KB body. Using Expect: 100-continue, the server rejects on the
    // declared Content-Length before the body is sent, so we get a clean 413.
    const body = JSON.stringify({ message: "x".repeat(101 * 1024) });
    const response = await request(server, "/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      expect100: true
    });
    assert.equal(response.statusCode, 413);
    const payload = JSON.parse(response.body);
    assert.equal(payload.ok, false);
  });
});

test("A streamed body over the cap is aborted mid-upload", async () => {
  await withServer(async (server) => {
    // Without Expect:100, the client streams the oversize body; parseBody trips
    // the running byte guard and destroys the socket, which the client observes
    // as a connection reset. Asserting this documents the real abort behavior.
    const body = JSON.stringify({ message: "y".repeat(101 * 1024) });
    await assert.rejects(
      () =>
        request(server, "/api/contact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body
        }),
      (error) => error.code === "ECONNRESET" || error.code === "EPIPE"
    );
  });
});
