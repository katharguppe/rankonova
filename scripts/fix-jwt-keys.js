/**
 * Generates a fresh RS256-2048 key pair, verifies they match,
 * then writes both to .env in one atomic operation.
 * Run: node scripts/fix-jwt-keys.js
 */
const { generateKeyPairSync, createSign, createVerify } = require('crypto');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});

// Self-check: sign and verify with this exact pair
const sign = createSign('SHA256');
sign.update('aeo-suite-jwt-test');
const sig = sign.sign(privateKey);
const verify = createVerify('SHA256');
verify.update('aeo-suite-jwt-test');
if (!verify.verify(publicKey, sig)) {
  throw new Error('Generated key pair MISMATCH — aborting');
}
console.log('Key pair self-check: PASSED');

const priv64 = Buffer.from(privateKey).toString('base64');
const pub64  = Buffer.from(publicKey).toString('base64');

let env = fs.readFileSync(envPath, 'utf8');

if (env.match(/^JWT_PRIVATE_KEY=.*$/m)) {
  env = env.replace(/^JWT_PRIVATE_KEY=.*$/m, `JWT_PRIVATE_KEY=${priv64}`);
} else {
  env += `\nJWT_PRIVATE_KEY=${priv64}`;
}

if (env.match(/^JWT_PUBLIC_KEY=.*$/m)) {
  env = env.replace(/^JWT_PUBLIC_KEY=.*$/m, `JWT_PUBLIC_KEY=${pub64}`);
} else {
  env += `\nJWT_PUBLIC_KEY=${pub64}`;
}

fs.writeFileSync(envPath, env, 'utf8');
console.log('Written to .env:');
console.log(`  JWT_PRIVATE_KEY length: ${priv64.length}`);
console.log(`  JWT_PUBLIC_KEY  length: ${pub64.length}`);
console.log('Done. Restart the backend, then log in fresh.');
