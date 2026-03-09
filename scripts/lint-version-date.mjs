#!/usr/bin/env node
import { readFileSync } from "node:fs";

function fail(message) {
  console.error(`version-date-lint: ${message}`);
  process.exit(1);
}

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf-8"));
const version = String(pkg.version ?? "").trim();

const match = /^(\d{4})\.(\d{1,2})\.(\d{1,2})(?:-(\d+|beta\.\d+))?$/.exec(version);
if (!match) {
  fail(`invalid version format "${version}". Expected YYYY.M.D, YYYY.M.D-N, or YYYY.M.D-beta.N`);
}

const now = new Date();
const today = `${now.getFullYear()}.${now.getMonth() + 1}.${now.getDate()}`;
const versionDate = `${Number(match[1])}.${Number(match[2])}.${Number(match[3])}`;

if (versionDate !== today) {
  fail(
    `version date must match today (${today}). Got ${versionDate}. Use today's date with an optional sub-version suffix (example: ${today}-1).`,
  );
}

console.log(`version-date-lint: ok (${version})`);
