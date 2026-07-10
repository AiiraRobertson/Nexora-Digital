// Support-assistant logic for POST /api/support.
//
// Primary path: a real LLM via DeepSeek (OpenAI-compatible chat completions),
// used when DEEPSEEK_API_KEY is set. Falls back to a local scored, multi-intent
// keyword matcher when the key is absent or the API call fails, so the widget
// always returns something useful and the site works offline / in tests.

const https = require("https");

const SYSTEM_PROMPT = [
  "You are the customer-support assistant for Nexora Digital, a technology",
  "solutions and consulting company. Nexora designs, builds, manages, and",
  "improves web and mobile products for fintech, SaaS, e-commerce, banking,",
  "ride-hailing, courier, and service-led businesses. Services: web & mobile",
  "development, full-stack programming training, cloud management, business",
  "portfolio setup, maintenance & QA engineering, and career management & design.",
  "Answer questions about timelines, pricing approach, training, QA, support,",
  "and scope. Be warm, concise (2-4 sentences), and practical. Never invent",
  "specific prices or dates; frame them around scope and milestones. If asked",
  "something unrelated to Nexora, gently steer back to how Nexora can help."
].join(" ");

// Intent rules for the offline fallback. Each message is scored against every
// intent by counting keyword hits; the top-scoring intents win.
const intents = [
  {
    intent: "pricing",
    keywords: ["price", "pricing", "cost", "budget", "quote", "how much", "rate", "fee"],
    reply:
      "We tailor delivery around your scope and timeline. A lightweight website usually starts from a focused sprint, while a full product build is planned around milestones and support needs.",
    followUps: ["What is the scope of your project?", "Do you have a target launch date?"]
  },
  {
    intent: "timeline",
    keywords: ["timeline", "how fast", "how long", "launch", "deadline", "when", "duration", "quick"],
    reply:
      "A polished launch can often be prepared quickly when the scope is clear. We usually map discovery, design, delivery, and launch support so the timeline stays realistic and predictable.",
    followUps: ["Is there a fixed launch date you are working toward?", "How defined is the scope today?"]
  },
  {
    intent: "training",
    keywords: ["training", "learn", "course", "coaching", "mentor", "bootcamp", "upskill", "teach"],
    reply:
      "We offer hands-on full-stack programming training for individuals and teams, covering frontend, backend, databases, deployment, and delivery practices in a practical way.",
    followUps: ["Is the training for an individual or a team?", "Which stack or goal are you focused on?"]
  },
  {
    intent: "qa",
    keywords: ["qa", "testing", "test", "quality", "bug", "maintenance", "support", "reliability"],
    reply:
      "Yes, we can help with QA, maintenance, release checks, and ongoing support so your product remains reliable after launch.",
    followUps: ["Is this for an existing product or a new build?", "Do you need automated or manual test coverage?"]
  },
  {
    intent: "cloud",
    keywords: ["cloud", "hosting", "deploy", "deployment", "server", "infrastructure", "devops", "scaling"],
    reply:
      "We handle hosting, deployment pipelines, monitoring, backups, and cost controls so your infrastructure stays reliable and efficient as you grow.",
    followUps: ["Which cloud provider are you using or considering?", "What does your current deployment look like?"]
  },
  {
    intent: "design",
    keywords: ["design", "graphics", "brand", "branding", "logo", "portfolio", "ui", "ux", "visual"],
    reply:
      "Our design and career support covers brand systems, graphics, product UI/UX, portfolios, and profile positioning to help you present professionally.",
    followUps: ["Are you looking for product design or brand assets?", "Do you have existing brand guidelines?"]
  }
];

const FALLBACK_REPLY =
  "We help businesses with web and mobile development, cloud operations, QA, design, portfolio setup, and ongoing support. Tell us what you need, and we can shape a clear delivery plan.";

const STARTER_QUESTIONS = [
  "How long would my project take?",
  "How does pricing work?",
  "Do you offer training?"
];

function scoreIntent(intent, prompt) {
  let score = 0;
  for (const keyword of intent.keywords) {
    if (prompt.includes(keyword)) score += 1;
  }
  return score;
}

// Local, deterministic fallback: scores all intents, returns the top 1-2.
function buildLocalReply(message) {
  const prompt = String(message || "").trim().toLowerCase();

  if (!prompt) {
    return { reply: FALLBACK_REPLY, matchedIntents: [], suggestedQuestions: STARTER_QUESTIONS };
  }

  const scored = intents
    .map((intent) => ({ intent, score: scoreIntent(intent, prompt) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    return { reply: FALLBACK_REPLY, matchedIntents: [], suggestedQuestions: STARTER_QUESTIONS };
  }

  const top = scored.slice(0, 2);
  const reply = top.map((entry) => entry.intent.reply).join(" ");
  const matchedIntents = top.map((entry) => entry.intent.intent);
  const suggestedQuestions = [];
  for (const entry of top) {
    for (const question of entry.intent.followUps) {
      if (!suggestedQuestions.includes(question)) suggestedQuestions.push(question);
    }
  }

  return { reply, matchedIntents, suggestedQuestions: suggestedQuestions.slice(0, 3) };
}

// Calls DeepSeek's OpenAI-compatible chat completions endpoint.
function callDeepSeek(message, apiKey) {
  const payload = JSON.stringify({
    model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: String(message).slice(0, 2000) }
    ],
    max_tokens: 220,
    temperature: 0.4
  });

  const options = {
    method: "POST",
    hostname: "api.deepseek.com",
    path: "/chat/completions",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(payload),
      Authorization: `Bearer ${apiKey}`
    },
    timeout: 12000
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        body += chunk;
      });
      res.on("end", () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`DeepSeek responded with status ${res.statusCode}`));
          return;
        }
        try {
          const parsed = JSON.parse(body);
          const reply = parsed?.choices?.[0]?.message?.content?.trim();
          if (!reply) {
            reject(new Error("DeepSeek returned an empty reply"));
            return;
          }
          resolve(reply);
        } catch (error) {
          reject(new Error("Could not parse DeepSeek response"));
        }
      });
    });

    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy(new Error("DeepSeek request timed out"));
    });
    req.write(payload);
    req.end();
  });
}

// Public entry point. Uses DeepSeek when configured, otherwise the local
// matcher. Any LLM error degrades gracefully to the local reply.
async function generateSupportReply(message) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  const local = buildLocalReply(message);

  if (!apiKey) {
    return { ...local, source: "local" };
  }

  try {
    const reply = await callDeepSeek(message, apiKey);
    return {
      reply,
      matchedIntents: local.matchedIntents,
      suggestedQuestions: local.suggestedQuestions,
      source: "deepseek"
    };
  } catch (error) {
    // Fall back silently so the widget stays functional.
    return { ...local, source: "local", degraded: true };
  }
}

module.exports = { generateSupportReply, buildLocalReply, STARTER_QUESTIONS };
