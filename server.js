const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const { services, serviceSlugs, serviceTitles } = require("./services");
const { generateSupportReply } = require("./support");

const PORT = process.env.PORT || 3000;
const rootDir = path.join(__dirname, "outputs");
const dataDir = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(__dirname, "data");
const dataFile = path.join(dataDir, "inquiries.json");

const MAX_BODY_BYTES = 100 * 1024; // 100 KB cap on request bodies
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 5; // max sensitive requests per IP per window
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";

// Comma-separated allowlist, e.g. "https://nexoradigital.co,https://www.nexoradigital.co".
// Empty means "reflect any origin" (dev-friendly) for non-sensitive routes only.
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

// ---------------------------------------------------------------------------
// Data store: serialized, atomic writes with corruption quarantine.
// ---------------------------------------------------------------------------

function ensureDataFile() {
  fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(dataFile)) {
    fs.writeFileSync(dataFile, JSON.stringify([], null, 2));
  }
}

function readInquiries() {
  ensureDataFile();
  const raw = fs.readFileSync(dataFile, "utf8");
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    // Never silently drop data: quarantine the corrupt file so the next
    // write does not overwrite recoverable inquiries with an empty array.
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const quarantine = path.join(dataDir, `inquiries.corrupt-${stamp}.json`);
    try {
      fs.renameSync(dataFile, quarantine);
      console.error(`[data] Corrupt inquiries.json quarantined to ${quarantine}`);
    } catch (renameError) {
      console.error("[data] Failed to quarantine corrupt inquiries.json", renameError);
    }
    return [];
  }
}

function writeInquiriesAtomic(inquiries) {
  ensureDataFile();
  const tmpFile = path.join(dataDir, `.inquiries.${process.pid}.${Date.now()}.tmp`);
  fs.writeFileSync(tmpFile, JSON.stringify(inquiries, null, 2));
  fs.renameSync(tmpFile, dataFile); // atomic on same filesystem
}

// Serialize all mutations through a promise queue so concurrent POSTs cannot
// interleave read-modify-write and lose data.
let writeQueue = Promise.resolve();

function appendInquiry(inquiry) {
  writeQueue = writeQueue.then(() => {
    const inquiries = readInquiries();
    inquiries.push(inquiry);
    writeInquiriesAtomic(inquiries);
  });
  return writeQueue.then(() => inquiry);
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".js":
      return "application/javascript; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".webmanifest":
      return "application/manifest+json; charset=utf-8";
    case ".xml":
      return "application/xml; charset=utf-8";
    case ".txt":
      return "text/plain; charset=utf-8";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".avif":
      return "image/avif";
    case ".svg":
      return "image/svg+xml";
    case ".ico":
      return "image/x-icon";
    case ".mp4":
      return "video/mp4";
    case ".webm":
      return "video/webm";
    case ".woff2":
      return "font/woff2";
    case ".woff":
      return "font/woff";
    case ".ttf":
      return "font/ttf";
    default:
      return "application/octet-stream";
  }
}

function applyCors(request, response, { allowCredentials = false } = {}) {
  const origin = request.headers.origin;
  if (allowedOrigins.length > 0) {
    if (origin && allowedOrigins.includes(origin)) {
      response.setHeader("Access-Control-Allow-Origin", origin);
      response.setHeader("Vary", "Origin");
    }
  } else if (origin) {
    // No allowlist configured: reflect the origin (dev convenience). Sensitive
    // routes additionally require a token, so this does not expose PII.
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Vary", "Origin");
  }
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (allowCredentials) {
    response.setHeader("Access-Control-Allow-Credentials", "true");
  }
}

function applySecurityHeaders(response) {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  response.setHeader("X-Frame-Options", "SAMEORIGIN");
}

function sendJson(request, response, statusCode, payload, extraHeaders = {}) {
  applyCors(request, response);
  applySecurityHeaders(response);
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    ...extraHeaders
  });
  response.end(JSON.stringify(payload));
}

function parseBody(request) {
  return new Promise((resolve, reject) => {
    // Reject early when the declared length already exceeds the cap.
    const declared = Number(request.headers["content-length"]);
    if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
      const error = new Error("Request body too large");
      error.statusCode = 413;
      reject(error);
      return;
    }

    let size = 0;
    const chunks = [];
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        const error = new Error("Request body too large");
        error.statusCode = 413;
        request.destroy();
        reject(error);
        return;
      }
      chunks.push(chunk);
    });
    request.on("error", reject);
    request.on("end", () => {
      const body = Buffer.concat(chunks).toString("utf8");
      if (!body) {
        resolve({});
        return;
      }
      try {
        const contentType = request.headers["content-type"] || "";
        if (contentType.includes("application/json")) {
          resolve(JSON.parse(body));
          return;
        }
        const params = new URLSearchParams(body);
        resolve(Object.fromEntries(params.entries()));
      } catch (error) {
        const parseError = new Error("Invalid request body");
        parseError.statusCode = 400;
        reject(parseError);
      }
    });
  });
}

// ---------------------------------------------------------------------------
// Rate limiting (in-memory sliding window keyed by client IP)
// ---------------------------------------------------------------------------

const rateBuckets = new Map();

function clientIp(request) {
  // Only trust X-Forwarded-For behind a proxy you control.
  if (process.env.TRUST_PROXY === "1") {
    const forwarded = request.headers["x-forwarded-for"];
    if (forwarded) return String(forwarded).split(",")[0].trim();
  }
  return request.socket.remoteAddress || "unknown";
}

function checkRateLimit(request) {
  const ip = clientIp(request);
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  const hits = (rateBuckets.get(ip) || []).filter((ts) => ts > windowStart);

  if (hits.length >= RATE_LIMIT_MAX) {
    const retryAfter = Math.ceil((hits[0] + RATE_LIMIT_WINDOW_MS - now) / 1000);
    rateBuckets.set(ip, hits);
    return { allowed: false, retryAfter: Math.max(1, retryAfter) };
  }

  hits.push(now);
  rateBuckets.set(ip, hits);
  return { allowed: true };
}

// Periodically prune empty/expired buckets so the map does not grow unbounded.
const pruneTimer = setInterval(() => {
  const cutoff = Date.now() - RATE_LIMIT_WINDOW_MS;
  for (const [ip, hits] of rateBuckets) {
    const fresh = hits.filter((ts) => ts > cutoff);
    if (fresh.length === 0) rateBuckets.delete(ip);
    else rateBuckets.set(ip, fresh);
  }
}, RATE_LIMIT_WINDOW_MS);
pruneTimer.unref();

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CONTROL_CHARS_RE = /[\x00-\x1f\x7f]/;

function validateContact(payload) {
  const errors = {};
  const name = String(payload.name || "").trim();
  const email = String(payload.email || "").trim();
  const service = String(payload.service || "").trim();
  const message = String(payload.message || "").trim();

  if (!name) errors.name = "Name is required.";
  else if (name.length > 120) errors.name = "Name must be 120 characters or fewer.";
  else if (CONTROL_CHARS_RE.test(name)) errors.name = "Name contains invalid characters.";

  if (!email) errors.email = "Email is required.";
  else if (email.length > 254 || !EMAIL_RE.test(email)) errors.email = "Enter a valid email address.";

  if (!service) errors.service = "Please choose a service.";
  else if (!serviceTitles.includes(service) && !serviceSlugs.includes(service)) {
    errors.service = "Choose a service from the list.";
  }

  if (!message) errors.message = "Message is required.";
  else if (message.length < 10) errors.message = "Message must be at least 10 characters.";
  else if (message.length > 4000) errors.message = "Message must be 4000 characters or fewer.";
  else if (CONTROL_CHARS_RE.test(message)) errors.message = "Message contains invalid characters.";

  return { errors, values: { name, email, service, message } };
}

function isAuthorized(request) {
  if (!ADMIN_TOKEN) return false;
  const header = request.headers.authorization || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return false;
  const provided = Buffer.from(match[1]);
  const expected = Buffer.from(ADMIN_TOKEN);
  if (provided.length !== expected.length) return false;
  return crypto.timingSafeEqual(provided, expected);
}

// ---------------------------------------------------------------------------
// Static serving (hardened path resolution)
// ---------------------------------------------------------------------------

function serveStatic(request, response) {
  let pathname;
  try {
    pathname = decodeURIComponent(
      new URL(request.url, `http://${request.headers.host || "localhost"}`).pathname
    );
  } catch (error) {
    sendJson(request, response, 400, { error: "Bad request" });
    return;
  }

  if (pathname.includes(" ")) {
    sendJson(request, response, 400, { error: "Bad request" });
    return;
  }

  const safePath = pathname === "/" ? "/index.html" : pathname;
  const relativePath = safePath.replace(/^\/+/, "");
  const resolved = path.resolve(rootDir, relativePath);

  // Boundary-aware containment check: rootDir itself, or a path under rootDir + sep.
  if (resolved !== rootDir && !resolved.startsWith(rootDir + path.sep)) {
    sendJson(request, response, 403, { error: "Forbidden" });
    return;
  }

  if (!fs.existsSync(resolved)) {
    sendJson(request, response, 404, { error: "Not found" });
    return;
  }

  let target = resolved;
  const stat = fs.statSync(target);
  if (stat.isDirectory()) {
    target = path.join(target, "index.html");
    if (!fs.existsSync(target)) {
      sendJson(request, response, 404, { error: "Not found" });
      return;
    }
  }

  const data = fs.readFileSync(target);
  applyCors(request, response);
  applySecurityHeaders(response);
  const headers = { "Content-Type": getContentType(target) };
  // Cache immutable-ish static assets; keep HTML fresh.
  if (/\.(css|js|png|jpe?g|webp|avif|svg|ico|woff2?|ttf|mp4|webm)$/i.test(target)) {
    headers["Cache-Control"] = "public, max-age=86400";
  } else {
    headers["Cache-Control"] = "no-cache";
  }
  response.writeHead(200, headers);
  response.end(data);
}

// ---------------------------------------------------------------------------
// Route table + server
// ---------------------------------------------------------------------------

const routes = [
  { method: "GET", path: "/api", description: "API discovery" },
  { method: "GET", path: "/api/health", description: "Health check" },
  { method: "GET", path: "/api/services", description: "Service catalogue" },
  { method: "GET", path: "/api/inquiries", description: "List inquiries (admin token required)" },
  { method: "POST", path: "/api/contact", description: "Submit a contact inquiry" },
  { method: "POST", path: "/api/support", description: "Ask the support assistant" }
];

function handleRequest(request, response) {
  const start = Date.now();
  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  const { pathname } = url;

  response.on("finish", () => {
    const ms = Date.now() - start;
    console.log(`${request.method} ${pathname} -> ${response.statusCode} (${ms}ms)`);
  });

  if (request.method === "OPTIONS") {
    applyCors(request, response);
    applySecurityHeaders(response);
    response.writeHead(204);
    response.end();
    return;
  }

  if (request.method === "GET" && pathname === "/api") {
    sendJson(request, response, 200, {
      ok: true,
      service: "nexora-digital-backend",
      version: require("./package.json").version,
      endpoints: routes.map((r) => ({ method: r.method, path: r.path, description: r.description }))
    });
    return;
  }

  if (request.method === "GET" && pathname === "/api/health") {
    sendJson(request, response, 200, {
      ok: true,
      message: "Backend is running",
      timestamp: new Date().toISOString()
    });
    return;
  }

  if (request.method === "GET" && pathname === "/api/services") {
    sendJson(request, response, 200, { services });
    return;
  }

  if (request.method === "GET" && pathname === "/api/inquiries") {
    if (!isAuthorized(request)) {
      sendJson(request, response, 401, { ok: false, error: "Unauthorized" }, {
        "WWW-Authenticate": "Bearer"
      });
      return;
    }
    const all = readInquiries().slice().reverse(); // newest first
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 50, 1), 200);
    const offset = Math.max(Number(url.searchParams.get("offset")) || 0, 0);
    sendJson(request, response, 200, {
      ok: true,
      total: all.length,
      limit,
      offset,
      inquiries: all.slice(offset, offset + limit)
    });
    return;
  }

  if (request.method === "POST" && pathname === "/api/contact") {
    handleContact(request, response);
    return;
  }

  if (request.method === "POST" && pathname === "/api/support") {
    handleSupport(request, response);
    return;
  }

  // Wrong method on a known API path -> 405 with Allow header.
  const known = routes.filter((r) => r.path === pathname);
  if (known.length > 0) {
    sendJson(request, response, 405, { ok: false, error: "Method not allowed" }, {
      Allow: known.map((r) => r.method).join(", ")
    });
    return;
  }

  // Unknown API path -> JSON 404 (do not fall through to static serving).
  if (pathname.startsWith("/api/") || pathname === "/api") {
    sendJson(request, response, 404, { ok: false, error: "Unknown endpoint" });
    return;
  }

  serveStatic(request, response);
}

async function handleContact(request, response) {
  const limit = checkRateLimit(request);
  if (!limit.allowed) {
    sendJson(request, response, 429, { ok: false, message: "Too many requests. Please try again shortly." }, {
      "Retry-After": String(limit.retryAfter)
    });
    return;
  }

  try {
    const payload = await parseBody(request);

    // Honeypot: bots fill hidden fields. Pretend success, discard silently.
    if (String(payload.website || payload.company_url || "").trim()) {
      sendJson(request, response, 200, { ok: true, message: "Thanks. Your inquiry has been received." });
      return;
    }

    const { errors, values } = validateContact(payload);
    if (Object.keys(errors).length > 0) {
      sendJson(request, response, 400, {
        ok: false,
        message: "Please correct the highlighted fields.",
        errors
      });
      return;
    }

    const inquiry = {
      id: `inq-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`,
      createdAt: new Date().toISOString(),
      ...values
    };
    await appendInquiry(inquiry);

    sendJson(request, response, 201, {
      ok: true,
      message: `Thanks, ${values.name.split(" ")[0] || "there"}. Your inquiry has been received.`,
      inquiryId: inquiry.id
    });
  } catch (error) {
    const status = error.statusCode || 400;
    const message =
      status === 413
        ? "Your message is too large. Please shorten it."
        : error.message || "Unable to process your inquiry.";
    sendJson(request, response, status, { ok: false, message });
  }
}

async function handleSupport(request, response) {
  const limit = checkRateLimit(request);
  if (!limit.allowed) {
    sendJson(request, response, 429, { ok: false, message: "Too many requests. Please try again shortly." }, {
      "Retry-After": String(limit.retryAfter)
    });
    return;
  }

  try {
    const payload = await parseBody(request);
    const message = String(payload.message || "").trim();
    const result = await generateSupportReply(message);
    sendJson(request, response, 200, { ok: true, ...result });
  } catch (error) {
    const status = error.statusCode || 400;
    sendJson(request, response, status, { ok: false, message: error.message || "Unable to assist right now." });
  }
}

function createServer() {
  const server = http.createServer((request, response) => {
    try {
      handleRequest(request, response);
    } catch (error) {
      console.error("[server] Unhandled error in request handler", error);
      if (!response.headersSent) {
        sendJson(request, response, 500, { ok: false, error: "Internal server error" });
      } else {
        response.end();
      }
    }
  });

  // Abort stalled/slow-loris connections.
  server.requestTimeout = 15000;
  server.headersTimeout = 16000;
  return server;
}

if (require.main === module) {
  const server = createServer();

  server.on("error", (error) => {
    console.error("[server] Server error", error);
  });

  server.listen(PORT, () => {
    console.log(`Nexora Digital backend listening on http://localhost:${PORT}`);
  });

  const shutdown = (signal) => {
    console.log(`\n[server] ${signal} received, shutting down gracefully...`);
    clearInterval(pruneTimer);
    server.close(() => {
      // Let any queued writes settle before exiting.
      writeQueue.finally(() => process.exit(0));
    });
    // Hard stop if close hangs.
    setTimeout(() => process.exit(1), 10000).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("unhandledRejection", (reason) => console.error("[server] Unhandled rejection", reason));
  process.on("uncaughtException", (error) => console.error("[server] Uncaught exception", error));
}

module.exports = { createServer };
