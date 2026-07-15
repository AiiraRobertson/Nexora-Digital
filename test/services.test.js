const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { services, serviceSlugs, serviceTitles } = require("../services");

const html = fs.readFileSync(
  path.join(__dirname, "..", "outputs", "index.html"),
  "utf8"
);

// Decode the handful of HTML entities used in the contact-form option labels so
// they can be compared against the raw catalogue titles.
function decodeEntities(text) {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

test("Every service has the required fields", () => {
  assert.ok(services.length >= 1);
  for (const service of services) {
    assert.ok(service.slug, "slug");
    assert.ok(service.title, "title");
    assert.ok(service.summary, "summary");
    assert.ok(Array.isArray(service.highlights) && service.highlights.length > 0, "highlights");
  }
});

test("Slugs are unique and kebab-case", () => {
  const seen = new Set();
  for (const slug of serviceSlugs) {
    assert.match(slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, `"${slug}" should be kebab-case`);
    assert.ok(!seen.has(slug), `duplicate slug "${slug}"`);
    seen.add(slug);
  }
});

test("serviceSlugs and serviceTitles stay in sync with services", () => {
  assert.deepEqual(serviceSlugs, services.map((s) => s.slug));
  assert.deepEqual(serviceTitles, services.map((s) => s.title));
});

test("Every contact-form service option maps to a catalogue title", () => {
  // Extract the <select name="service"> block, then its <option> labels.
  const selectMatch = html.match(/<select[^>]*name="service"[\s\S]*?<\/select>/i);
  assert.ok(selectMatch, "contact form should contain a service <select>");

  const optionLabels = [...selectMatch[0].matchAll(/<option[^>]*>([\s\S]*?)<\/option>/gi)]
    .map((m) => decodeEntities(m[1].trim()))
    .filter((label) => label && !/select one/i.test(label));

  assert.ok(optionLabels.length > 0, "should have selectable service options");
  for (const label of optionLabels) {
    assert.ok(
      serviceTitles.includes(label),
      `form option "${label}" is not a known service title (catalogue drift)`
    );
  }

  // And every catalogue title should be offered in the form.
  for (const title of serviceTitles) {
    assert.ok(optionLabels.includes(title), `service "${title}" is missing from the form`);
  }
});
