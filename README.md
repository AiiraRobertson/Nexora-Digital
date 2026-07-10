# Nexora Digital

Marketing landing page and lightweight backend for **Nexora Digital**, a
technology solutions and consulting company (web & mobile development,
full-stack training, cloud management, portfolio setup, QA engineering, and
career design).

The static site lives in [`outputs/`](outputs/) and is served by a dependency-free
Node `http` server ([`server.js`](server.js)) that also exposes a small JSON API
for the contact form and support assistant.

## Requirements

- Node.js **20.6+** (for the built-in `--env-file` flag; the server itself has
  no runtime dependencies)

## Quick start

```bash
npm install            # installs vite/react for the optional SPA scaffold + dev tooling
npm start              # starts the server on http://localhost:3000
```

Then open <http://localhost:3000>.

To load configuration from a `.env` file, use Node's built-in flag:

```bash
cp .env.example .env   # then edit .env
node --env-file=.env server.js
```

> The server reads `process.env` directly (no `dotenv` dependency), so either
> use `--env-file` as above or export the variables in your shell.

## Scripts

| Command         | Description                                              |
| --------------- | -------------------------------------------------------- |
| `npm start`     | Run the production server (`node server.js`)             |
| `npm test`      | Run the test suite (`node --test`, 11 tests)             |
| `npm run dev`   | Vite dev server for the React scaffold in `src/`         |
| `npm run build` | Vite production build into `dist/`                       |

## Configuration

All environment variables are **optional**; the server runs with sane defaults.
See [`.env.example`](.env.example) for the full list.

| Variable          | Default  | Purpose                                                        |
| ----------------- | -------- | -------------------------------------------------------------- |
| `PORT`            | `3000`   | HTTP listen port                                               |
| `DATA_DIR`        | `./data` | Where `inquiries.json` is persisted                            |
| `ADMIN_TOKEN`     | *(empty)*| Bearer token required by `GET /api/inquiries`; empty locks it  |
| `ALLOWED_ORIGINS` | *(empty)*| Comma-separated CORS allowlist; empty reflects any origin      |
| `TRUST_PROXY`     | `0`      | Set `1` behind a trusted proxy to honor `X-Forwarded-For`      |
| `DEEPSEEK_API_KEY`| *(empty)*| Enables the LLM-backed support assistant; falls back to local  |
| `DEEPSEEK_MODEL`  | `deepseek-chat` | DeepSeek model for the support assistant                |

## API

| Method | Path              | Description                                              |
| ------ | ----------------- | -------------------------------------------------------- |
| `GET`  | `/api`            | API discovery — lists available endpoints                |
| `GET`  | `/api/health`     | Health check                                             |
| `GET`  | `/api/services`   | Service catalogue                                        |
| `GET`  | `/api/inquiries`  | List submitted inquiries — **requires admin token**      |
| `POST` | `/api/contact`    | Submit a contact inquiry (validated, rate-limited)       |
| `POST` | `/api/support`    | Ask the support assistant                                |

### Examples

Submit a contact inquiry:

```bash
curl -X POST http://localhost:3000/api/contact \
  -H "Content-Type: application/json" \
  -d '{"name":"Ada Lovelace","email":"ada@example.com","service":"web-mobile-development","message":"I need a customer portal."}'
```

Read inquiries (admin token required):

```bash
curl http://localhost:3000/api/inquiries \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

Ask the support assistant:

```bash
curl -X POST http://localhost:3000/api/support \
  -H "Content-Type: application/json" \
  -d '{"message":"How long would my project take?"}'
```

## Project layout

```
Nexora-Digital/
├── outputs/          # Static site actually served (HTML/CSS/JS, images, SEO files)
├── server.js         # Node http server: static serving + JSON API
├── services.js       # Single source of truth for the service catalogue
├── support.js        # Support assistant: DeepSeek LLM + local fallback
├── test/             # node --test suite
├── src/              # Optional React/Vite SPA scaffold (not wired into the server)
├── vite.config.js    # Vite config for the SPA scaffold
└── data/             # Runtime inquiry storage (gitignored, created on first write)
```

## Design notes

- **No runtime dependencies.** The server uses only Node built-ins
  (`http`, `fs`, `path`, `crypto`, `https`).
- **Hardened static serving** — path-traversal-safe resolution with a
  boundary-aware containment check.
- **Security defaults** — `X-Content-Type-Options`, `Referrer-Policy`,
  `X-Frame-Options`, CORS allowlist, 100 KB request-body cap, in-memory
  sliding-window rate limiting, and timing-safe admin-token comparison.
- **Durable writes** — inquiries are persisted via serialized, atomic writes
  with corruption quarantine so concurrent submissions can't lose data.
- **Graceful degradation** — the support assistant uses DeepSeek when
  `DEEPSEEK_API_KEY` is set and silently falls back to a local keyword matcher
  otherwise, so the widget works offline and in tests.

## Testing

```bash
npm test
```

Runs [`test/server.test.js`](test/server.test.js) against an in-process server —
no network or ports required.

## License

Proprietary — © Nexora Digital. All rights reserved.
