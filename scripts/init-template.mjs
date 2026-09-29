#!/usr/bin/env node
/**
 * One-shot template initialiser: rewrites every placeholder in the repository for a new project.
 *
 *   node scripts/init-template.mjs --name "My App" [--db my_app] [--lang en]
 *     [--description "..."] [--mail-from "My App <no-reply@my-app.local>"] [--dry-run]
 *
 * Text placeholders ({{PROJECT_NAME}}, {{PROJECT_DESCRIPTION}}, {{HTML_LANG}}, {{MAIL_FROM}})
 * live wherever a literal string is fine (TSX, Markdown, .env.example). Machine-parsed
 * identifiers cannot carry braces, so they ship with valid defaults that this script rewrites:
 * the package / compose name `app-template` and the database name `app`.
 *
 * Delete this script (and its test) once it has run.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const DEFAULT_SLUG = "app-template";
export const DEFAULT_DB = "app";

/** Never rewritten: this script, the audit that documents the placeholders, binaries. */
const SELF = ["scripts/init-template.mjs", "scripts/init-template.test.mjs", "TEMPLATE_AUDIT.md"];
const SKIP = [/\.(png|jpg|jpeg|gif|ico|woff2?|pdf)$/i];

export const isRewritable = (file) =>
  Boolean(file) && !SELF.includes(file) && !SKIP.some((pattern) => pattern.test(file));

export const slugify = (value) =>
  value
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-+|-+$/g, "");

const readOption = (argv, flag) => {
  const index = argv.indexOf(flag);
  if (index === -1) {
    return undefined;
  }
  const value = argv[index + 1];
  if (value === undefined || value.startsWith("--")) {
    throw new Error(`${flag} needs a value`);
  }
  return value;
};

export const parseArgs = (argv) => {
  const name = readOption(argv, "--name");
  if (!name) {
    throw new Error('Missing --name "<project display name>"');
  }
  const slug = slugify(name);
  if (!slug) {
    throw new Error("--name must contain at least one letter or digit");
  }
  return {
    name,
    slug,
    db: readOption(argv, "--db") ?? slug.replaceAll("-", "_"),
    lang: readOption(argv, "--lang") ?? "en",
    description: readOption(argv, "--description") ?? name,
    mailFrom: readOption(argv, "--mail-from") ?? `${name} <no-reply@${slug}.local>`,
    dryRun: argv.includes("--dry-run"),
  };
};

const escapeRegExp = (value) => value.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const applyReplacements = (content, options) => {
  const slug = new RegExp(`\\b${escapeRegExp(DEFAULT_SLUG)}\\b`, "g");
  const db = escapeRegExp(DEFAULT_DB);
  return content
    .replaceAll("{{PROJECT_NAME}}", options.name)
    .replaceAll("{{PROJECT_DESCRIPTION}}", options.description)
    .replaceAll("{{HTML_LANG}}", options.lang)
    .replaceAll("{{MAIL_FROM}}", options.mailFrom)
    .replace(slug, options.slug)
    .replace(new RegExp(`(POSTGRES_DB[=:]\\s*)${db}\\b`, "g"), `$1${options.db}`)
    .replace(new RegExp(`(POSTGRES_DB:-)${db}\\}`, "g"), `$1${options.db}}`)
    .replace(new RegExp(`(/)${db}(\\?schema=)`, "g"), `$1${options.db}$2`)
    .replace(new RegExp(`(-d )${db}\\b`, "g"), `$1${options.db}`);
};

const trackedFiles = (root) =>
  execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8" })
    .split("\0")
    .filter(isRewritable);

export const run = (argv, root) => {
  const options = parseArgs(argv);
  const changed = [];
  for (const file of trackedFiles(root)) {
    const path = `${root}/${file}`;
    const before = readFileSync(path, "utf8");
    const after = applyReplacements(before, options);
    if (after !== before) {
      changed.push(file);
      if (!options.dryRun) {
        writeFileSync(path, after);
      }
    }
  }
  return { options, changed };
};

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const root = fileURLToPath(new URL("..", import.meta.url)).replace(/\/$/, "");
  const { options, changed } = run(process.argv.slice(2), root);
  const verb = options.dryRun ? "would rewrite" : "rewrote";
  process.stdout.write(
    `${verb} ${String(changed.length)} file(s) for "${options.name}" (slug ${options.slug}, db ${options.db}, lang ${options.lang}):\n` +
      changed.map((file) => `  ${file}\n`).join("") +
      (options.dryRun
        ? ""
        : "next: `yarn` (refreshes yarn.lock for the new package name), `cp .env.example .env`, " +
          "then `git rm scripts/init-template.mjs scripts/init-template.test.mjs`\n"),
  );
}
