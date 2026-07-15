// Shared test utilities. Not a *.test.js file, so `node --test` does not run it
// on its own; each test file imports what it needs.
const http = require("node:http");

// Issue a request against an already-listening server and buffer the response.
//
// options.expect100: send `Expect: 100-continue` and only write the body once
// the server answers with 100 (or a final status). This lets tests exercise
// the body-size cap and get a clean status instead of a connection reset,
// mirroring how well-behaved HTTP clients (curl, browsers) upload large bodies.
function request(server, path, options = {}) {
  return new Promise((resolve, reject) => {
    const headers = { ...(options.headers || {}) };
    if (options.expect100 && options.body != null) {
      headers["Expect"] = "100-continue";
      if (headers["Content-Length"] == null && headers["content-length"] == null) {
        headers["Content-Length"] = Buffer.byteLength(options.body);
      }
    }

    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: server.address().port,
        path,
        method: options.method || "GET",
        headers
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => {
          chunks.push(chunk);
        });
        res.on("end", () => {
          const buffer = Buffer.concat(chunks);
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: buffer.toString("utf8"),
            byteLength: buffer.length
          });
        });
      }
    );

    req.on("error", reject);

    if (options.expect100 && options.body != null) {
      // Wait for the server to invite the body before sending it. If the server
      // sends a final response first (e.g. 413), the response handler fires and
      // we never write the body.
      req.on("continue", () => req.end(options.body));
    } else {
      if (options.body) {
        req.write(options.body);
      }
      req.end();
    }
  });
}

// Convenience: POST a JSON payload.
function postJson(server, path, payload, headers = {}) {
  return request(server, path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(payload)
  });
}

// Spin up an ephemeral server, run `fn`, then tear it down.
async function withServer(createServer, fn) {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    return await fn(server);
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
  }
}

module.exports = { request, postJson, withServer };
