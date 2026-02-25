#!/usr/bin/env node
"use strict";
/* eslint-disable @typescript-eslint/no-require-imports */

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const EXPECTED_SHA256 = {
  "public/zk/withdraw.wasm": "b8fa0c97194e5c788cd597bd3a017ae523787ed65251132590e07dad51d95895",
  "public/zk/withdraw_final.zkey": "40c619dff284d9a773b4108ebe1dd3b556bcf2a8c8523349d11545e8cb90751c",
  "public/zk/verification_key.json": "62b4ee39c0e77406a8b3a4ec217656c7666fe1957c4a4b0e09bab69d8c60b714",
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
