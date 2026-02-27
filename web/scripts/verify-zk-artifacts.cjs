#!/usr/bin/env node
"use strict";
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const EXPECTED_SHA256 = {
  "public/zk/withdraw.wasm": "c329494842e19a64636c2016e146f8acdc183dfa020e1cc17f1178709335b3f4",
  "public/zk/withdraw_final.zkey": "4cb86b892500ee8373e87af086330a978543045e636ea9190130aee2e5ad2c35",
  "public/zk/verification_key.json": "8406e77843e66c547a2ddba380e601b71d4c35d9bc80dd4f71a3f52bf888626f",
  "public/zk/tree_update.wasm": "f710722e4425509d6a3828b7ed840cffd4fe7743d1476e1b15aa41500c8ae55c",
  "public/zk/tree_update_final.zkey": "59c98b2debac5bedcf6f4590b39dbb4ac13b09e0f8a3c1d5132867cda37f0d43",
  "public/zk/verification_key_update.json": "c5eb64e31408435ecaa64433e777c9abf8f20296d92e794c70c5ca6cbe5385a3",
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
