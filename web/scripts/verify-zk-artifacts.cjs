#!/usr/bin/env node
"use strict";
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const EXPECTED_SHA256 = {
  "public/zk/withdraw.wasm": "72ce3e5ea2fbc36aa5c7aaee6086d2a42089a0c04f4f9c937fe610f2e9036861",
  "public/zk/withdraw_final.zkey": "b1f8e32f035314fb2c6e3d34f3243c4828d76ab95ac3aaa66817e5abe17ab6b2",
  "public/zk/verification_key.json": "57f6b84ef71c6bf76a09894ed1601d4823b9971ad742d3be9a4629e09afbd130",
};

function sha256File(filePath) {
  const hash = crypto.createHash("sha256");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex");
}

function main() {
  const projectRoot = path.resolve(__dirname, "..");
  const mismatches = [];

  for (const [relativePath, expectedHash] of Object.entries(EXPECTED_SHA256)) {
    const fullPath = path.join(projectRoot, relativePath);
    if (!fs.existsSync(fullPath)) {
      mismatches.push(`${relativePath}: missing file`);
      continue;
    }
    const actualHash = sha256File(fullPath);
    if (actualHash !== expectedHash) {
      mismatches.push(`${relativePath}: expected ${expectedHash}, got ${actualHash}`);
    }
  }

  if (mismatches.length > 0) {
    console.error("ZK artifact integrity check failed:");
    for (const mismatch of mismatches) {
      console.error(`- ${mismatch}`);
    }
    process.exit(1);
  }

  console.log("ZK artifact integrity check passed.");
}

main();
