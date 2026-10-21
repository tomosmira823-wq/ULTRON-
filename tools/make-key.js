// Make a Kivo Ultron licence key.  Usage:  node tools/make-key.js path/to/kivo-licence-private.pem "Customer name or email"
// Keep the private key file somewhere safe and never commit it: anyone with it can make keys.
const fs = require('fs'), crypto = require('crypto');
const [pem, who] = process.argv.slice(2);
if (!pem || !who) { console.error('Usage: node tools/make-key.js kivo-licence-private.pem "Customer name or email"'); process.exit(1); }
const payload = Buffer.from(JSON.stringify({ n: who, p: 'pro', t: Date.now() })).toString('base64url');
const sig = crypto.sign(null, Buffer.from(payload), crypto.createPrivateKey(fs.readFileSync(pem))).toString('base64url');
console.log(`KIVO-${payload}.${sig}`);
