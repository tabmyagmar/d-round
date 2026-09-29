import assert from "node:assert/strict";
import { test } from "node:test";

import { applyReplacements, parseArgs, slugify } from "./init-template.mjs";

test("slugify turns a display name into a package/compose-safe slug", () => {
  assert.equal(slugify("My App"), "my-app");
  assert.equal(slugify("  Acme  Portal_2 "), "acme-portal-2");
});

test("parseArgs reads every option and derives the slug and db name from --name", () => {
  const options = parseArgs(["--name", "My App", "--lang", "en"]);
  assert.equal(options.name, "My App");
  assert.equal(options.slug, "my-app");
  assert.equal(options.db, "my_app");
  assert.equal(options.lang, "en");
  assert.equal(options.description, "My App");
  assert.equal(options.mailFrom, "My App <no-reply@my-app.local>");
});

test("parseArgs requires --name", () => {
  assert.throws(() => parseArgs([]), /--name/);
});

test("applyReplacements rewrites text placeholders and identifier defaults", () => {
  const options = parseArgs([
    "--name",
    "Acme Portal",
    "--db",
    "acme",
    "--lang",
    "de",
    "--description",
    "Acme internal portal",
    "--mail-from",
    "Acme <no-reply@acme.example>",
  ]);
  const input = [
    'title: "{{PROJECT_NAME}}"',
    "description: {{PROJECT_DESCRIPTION}}",
    'lang="{{HTML_LANG}}"',
    'MAIL_FROM="{{MAIL_FROM}}"',
    '"name": "app-template",',
    "name: app-template",
    "POSTGRES_DB=app",
    "postgresql://postgres:postgres@localhost:5433/app?schema=public",
    "POSTGRES_DB: ${POSTGRES_DB:-app}",
    'pg_isready -U postgres -d app"',
  ].join("\n");

  const output = applyReplacements(input, options);

  assert.equal(
    output,
    [
      'title: "Acme Portal"',
      "description: Acme internal portal",
      'lang="de"',
      'MAIL_FROM="Acme <no-reply@acme.example>"',
      '"name": "acme-portal",',
      "name: acme-portal",
      "POSTGRES_DB=acme",
      "postgresql://postgres:postgres@localhost:5433/acme?schema=public",
      "POSTGRES_DB: ${POSTGRES_DB:-acme}",
      'pg_isready -U postgres -d acme"',
    ].join("\n"),
  );
});

test("applyReplacements leaves unrelated words alone", () => {
  const options = parseArgs(["--name", "Thing"]);
  const input = "const app = createApp(); // app-templates apply here; happy path";
  assert.equal(applyReplacements(input, options), input);
});
