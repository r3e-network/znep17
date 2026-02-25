#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const { createRequire } = require("node:module");

const neonCorePkg = require.resolve("@cityofzion/neon-core/package.json");
const requireFromNeonCore = createRequire(neonCorePkg);
const { ec: EC } = requireFromNeonCore("elliptic");
const BN = requireFromNeonCore("elliptic/node_modules/bn.js");

function main() {
  const curve = new EC("p521");
  const bytes = curve.n.byteLength();
  const msg = new BN("1234", 16);
  const priv = new BN("1f1e1d1c1b1a19181716151413121110", 16);
  const key = curve.keyFromPrivate(priv);

  // Leading zero byte can cause BN byteLength shrinkage unless the caller
  // preserves source bit-length during truncation.
  const rawK = Buffer.alloc(bytes, 0);
  rawK[1] = 0xff;
  rawK[bytes - 1] = 0x42;
  const kInput = new BN(rawK);

  const truncatedMsg = curve._truncateToN(msg, false);
  const expectedK = curve._truncateToN(kInput, true, bytes * 8);

  assert(expectedK.cmpn(1) > 0, "expected k must be > 1");
  assert(expectedK.cmp(curve.n.subn(1)) < 0, "expected k must be < n - 1");

  const produced = curve.sign(msg, key, {
    canonical: false,
    k: () => kInput.clone(),
  });

  const kp = curve.g.mul(expectedK);
  const expectedR = kp.getX().umod(curve.n);
  const expectedS = expectedK
    .invm(curve.n)
    .mul(expectedR.mul(key.getPrivate()).add(truncatedMsg))
    .umod(curve.n);

  assert(
    produced.r.eq(expectedR) && produced.s.eq(expectedS),
    "elliptic signing must preserve full nonce bit-length when truncating k"
  );
}

main();
