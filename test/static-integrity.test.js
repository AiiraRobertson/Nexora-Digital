const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const outputsDir = path.join(__dirname, "..", "outputs");
const html = fs.readFileSync(path.join(outputsDir, "index.html"), "utf8");

// Count opening vs. closing tags for an element name. Opening tags may carry
// attributes (`<article ...>`), so match the name followed by whitespace or `>`.
function tagBalance(name) {
  const open = (html.match(new RegExp(`<${name}(?:\\s[^>]*)?>`, "gi")) || []).length;
  const close = (html.match(new RegExp(`</${name}>`, "gi")) || []).length;
  return { open, close };
}

test("<section> tags are balanced", () => {
  const { open, close } = tagBalance("section");
  assert.ok(open > 0, "expected at least one <section>");
  assert.equal(open, close, `section: ${open} open vs ${close} close`);
});

test("<article> tags are balanced (guards the </a> corruption regression)", () => {
  const { open, close } = tagBalance("article");
  assert.ok(open > 0, "expected at least one <article>");
  assert.equal(open, close, `article: ${open} open vs ${close} close`);
});

test("Every internal #anchor link resolves to a real element id", () => {
  const anchors = [...html.matchAll(/href="#([a-zA-Z0-9_-]+)"/g)].map((m) => m[1]);
  assert.ok(anchors.length > 0, "expected internal anchor links");

  const uniqueAnchors = [...new Set(anchors)];
  for (const anchor of uniqueAnchors) {
    if (anchor === "top") {
      // #top is the page top; satisfied by an id OR name on any element.
      const hasTop = new RegExp(`id="top"|name="top"`, "i").test(html);
      assert.ok(hasTop, "#top has no matching id");
      continue;
    }
    const hasId = new RegExp(`id="${anchor}"`).test(html);
    assert.ok(hasId, `#${anchor} has no matching id in the page`);
  }
});

test("Every referenced local asset exists on disk", () => {
  // Collect href/src/poster values, ignore external and non-file schemes.
  const refs = [...html.matchAll(/(?:href|src|poster)="([^"]+)"/g)].map((m) => m[1]);
  const localAssets = refs.filter((ref) => {
    if (/^(https?:)?\/\//i.test(ref)) return false; // external / protocol-relative
    if (/^(mailto:|tel:|#|data:)/i.test(ref)) return false; // non-file
    return /\.[a-z0-9]+$/i.test(ref); // has a file extension
  });

  assert.ok(localAssets.length > 0, "expected local asset references");

  for (const asset of localAssets) {
    // Strip any query string and leading slash; resolve under outputs/.
    const clean = asset.split(/[?#]/)[0].replace(/^\//, "");
    const filePath = path.join(outputsDir, clean);
    assert.ok(fs.existsSync(filePath), `referenced asset missing on disk: ${asset}`);
  }
});

test("SEO/manifest files exist and are non-empty", () => {
  for (const file of ["robots.txt", "sitemap.xml", "site.webmanifest"]) {
    const filePath = path.join(outputsDir, file);
    assert.ok(fs.existsSync(filePath), `${file} is missing`);
    assert.ok(fs.statSync(filePath).size > 0, `${file} is empty`);
  }
});
