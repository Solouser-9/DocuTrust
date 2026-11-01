#!/usr/bin/env node
/**
 * DocuTrust end-to-end suite — plain Node 18+ (fetch / FormData / Blob built in).
 *
 *   node e2e/run.js
 *   API_URL=https://vault.example.com ADMIN_EMAIL=... ADMIN_PASSWORD=... node e2e/run.js
 *
 * 31 steps across the whole API surface:
 *   health -> register A+B -> login both -> A uploads multipart -> list+search ->
 *   link share (1h, maxViews 2) -> public open -> revoke -> open 409 ->
 *   verification request -> approve -> public verify -> admin login ->
 *   admin stats -> review queue -> notification read ->
 *   OTP password reset (forgot / wrong code / right code) ->
 *   step-up (gate, wrong code, verify, gated change-password) ->
 *   MFA email fallback (setup+TOTP enable, 440 challenge, verify-otp) ->
 *   OTP-gated share (401 gate, wrong recipient, open-with-otp) ->
 *   org invite via emailed OTP (accept-invite).
 *
 * OTP delivery: with MAIL_MODE=dev the server echoes each code in the X-Dev-OTP
 * response header (body never carries codes). Every step prints PASS/FAIL;
 * the process exits 1 if any step failed.
 */

const crypto = require('crypto');

const BASE = (process.env.API_URL || 'http://localhost:8080').replace(/\/+$/, '');
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@docutrust.app';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin#2024';

const STAMP = 'E2E'; // title marker used by the search assertion

let index = 0;
const failures = [];

function ok(msg) {
  console.log(`  \x1b[32mPASS\x1b[0m  ${msg}`);
}

function bad(msg) {
  failures.push(msg);
  console.log(`  \x1b[31mFAIL\x1b[0m  ${msg}`);
}

/** Runs one named step; catches and records any failure. */
async function step(name, fn) {
  index += 1;
  const label = `[${String(index).padStart(2, '0')}] ${name}`;
  try {
    await fn();
    ok(label);
  } catch (e) {
    bad(`${label} — ${e && e.message ? e.message : e}`);
  }
}

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

/** Thin fetch wrapper that unwraps the { ok, data, meta } envelope. */
async function call(method, path, { token, body, headers } = {}) {
  const h = { ...(headers || {}) };
  const isForm = body instanceof FormData;
  if (body !== undefined && !isForm) h['Content-Type'] = 'application/json';
  if (token) h.Authorization = `Bearer ${token}`;
  const res = await fetch(BASE + path, {
    method,
    headers: h,
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
  });
  let json = null;
  try {
    json = await res.json();
  } catch (e) {
    // 204s and streaming endpoints have no JSON body
  }
  return { res, status: res.status, json, devOtp: res.headers.get('x-dev-otp') };
}

function data(json, what) {
  assert(json && json.ok !== false && json.data !== undefined, `${what}: bad envelope ${JSON.stringify(json).slice(0, 160)}`);
  return json.data;
}

function errorCode(json) {
  return json && json.error && json.error.code;
}

// ---- TOTP (RFC 6238) computed in-process, mirroring MfaService (30s step, 6 digits, base32) ----
function base32Decode(s) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let buffer = 0, bits = 0;
  const out = [];
  for (const ch of s.replace(/=+$/, '')) {
    const v = alphabet.indexOf(ch);
    if (v < 0) throw new Error(`bad base32 char ${ch}`);
    buffer = (buffer << 5) | v;
    bits += 5;
    if (bits >= 8) {
      out.push((buffer >> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

function totp(secretBase32) {
  const key = base32Decode(secretBase32);
  const step = Math.floor(Date.now() / 1000 / 30);
  const msg = Buffer.alloc(8);
  msg.writeUInt32BE(Math.floor(step / 2 ** 32), 0);
  msg.writeUInt32BE(step >>> 0, 4);
  const h = crypto.createHmac('sha1', key).update(msg).digest();
  const off = h[h.length - 1] & 0xf;
  const bin = ((h[off] & 0x7f) << 24) | ((h[off + 1] & 0xff) << 16) | ((h[off + 2] & 0xff) << 8) | (h[off + 3] & 0xff);
  return String(bin % 1_000_000).padStart(6, '0');
}

const ctx = { A: {}, B: {}, admin: {} };

async function main() {
  console.log(`DocuTrust e2e — ${BASE}\n`);

  const runId = Date.now().toString(36);
  ctx.emailA = `e2e.a.${runId}@docutrust-test.dev`;
  ctx.emailB = `e2e.b.${runId}@docutrust-test.dev`;
  ctx.password = 'VaultPass2024';

  // 1 ------------------------------------------------------------- health
  await step('health: GET /api/health reports ok + db', async () => {
    const { res, json } = await call('GET', '/api/health');
    assert(res.status === 200, `status ${res.status}`);
    assert(json && json.ok === true, 'envelope not ok');
    assert(json.data && (json.data.db === true || json.data.db === undefined), 'db not healthy');
  });

  // 2 -------------------------------------------------------- register A
  await step('register A: POST /api/auth/register', async () => {
    const { res, json } = await call('POST', '/api/auth/register', {
      body: { email: ctx.emailA, password: ctx.password, fullName: 'Ada E2E' },
    });
    assert(res.status === 201, `status ${res.status}`);
    const d = data(json, 'register A');
    ctx.A.token = d.accessToken;
    ctx.A.refresh = d.refreshToken;
    ctx.A.user = d.user;
    assert(ctx.A.token, 'no accessToken');
  });

  // 3 -------------------------------------------------------- register B
  await step('register B: POST /api/auth/register', async () => {
    const { res, json } = await call('POST', '/api/auth/register', {
      body: { email: ctx.emailB, password: ctx.password, fullName: 'Grace E2E' },
    });
    assert(res.status === 201, `status ${res.status}`);
    const d = data(json, 'register B');
    ctx.B.token = d.accessToken;
    ctx.B.user = d.user;
    assert(ctx.B.token, 'no accessToken');
  });

  // 4 ---------------------------------------------------------- login A
  await step('login A: POST /api/auth/login (fresh tokens)', async () => {
    const { res, json } = await call('POST', '/api/auth/login', {
      body: { email: ctx.emailA, password: ctx.password },
    });
    assert(res.status === 200, `status ${res.status}`);
    const d = data(json, 'login A');
    ctx.A.token = d.accessToken;
    ctx.A.refresh = d.refreshToken;
  });

  // 5 ---------------------------------------------------------- login B
  await step('login B: POST /api/auth/login', async () => {
    const { res, json } = await call('POST', '/api/auth/login', {
      body: { email: ctx.emailB, password: ctx.password },
    });
    assert(res.status === 200, `status ${res.status}`);
    const d = data(json, 'login B');
    ctx.B.token = d.accessToken;
  });

  // 6 ---------------------------------------------- A uploads (multipart)
  await step('A uploads multipart: field "file" + fields', async () => {
    const bytes = Buffer.from(
      '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
        '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\nxref\n0 4\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n9\n%%EOF\n',
      'utf8'
    );
    const form = new FormData();
    form.append('file', new Blob([bytes], { type: 'application/pdf' }), 'e2e-quarterly-report.pdf');
    form.append('title', `${STAMP} Quarterly Report`);
    form.append('docType', 'other'); // non-sensitive type: no admin review gate on share/verify
    form.append('description', 'Uploaded by the e2e suite');

    const { res, json } = await call('POST', '/api/documents', { token: ctx.A.token, body: form });
    assert(res.status === 201, `status ${res.status}`);
    const d = data(json, 'upload');
    ctx.docId = d.id;
    ctx.docSha = d.sha256;
    assert(ctx.docId, 'no document id');
    assert(ctx.docSha && ctx.docSha.length === 64, 'no sha256 fingerprint');
  });

  // 7 ------------------------------------------------------- list+search
  await step('list + search: GET /api/documents?search=', async () => {
    const { res, json } = await call('GET', `/api/documents?search=${encodeURIComponent(STAMP)}&page=1&limit=20`, {
      token: ctx.A.token,
    });
    assert(res.status === 200, `status ${res.status}`);
    const d = data(json, 'list');
    assert(Array.isArray(d), 'data is not an array');
    const hit = d.find((row) => String(row.id) === String(ctx.docId));
    assert(hit, 'uploaded document missing from search results');
    assert(json.meta && json.meta.total >= 1, 'meta.total missing');
  });

  // 8 --------------------------------------------------- create link share
  await step('create link share: 1h expiry, maxViews 2', async () => {
    const { res, json } = await call('POST', '/api/shares', {
      token: ctx.A.token,
      body: { documentId: ctx.docId, permission: 'view', expiresInHours: 1, maxViews: 2 },
    });
    assert(res.status === 201, `status ${res.status}`);
    const d = data(json, 'share');
    ctx.shareId = d.id;
    ctx.shareToken = d.linkToken;
    assert(ctx.shareToken, 'no share token minted');
  });

  // 9 ---------------------------------------------------- B public open
  await step('public open (no auth): GET + POST /api/public/shares/:token/open', async () => {
    const peek = await call('GET', `/api/public/shares/${ctx.shareToken}`);
    assert(peek.status === 200, `peek status ${peek.status}`);
    const meta = data(peek.json, 'public share meta');
    assert(meta.passcodeRequired === false, 'share unexpectedly passcode-locked');
    assert(meta.otpRequired === false, 'plain share unexpectedly OTP-gated');

    const open = await call('POST', `/api/public/shares/${ctx.shareToken}/open`, { body: {} });
    assert(open.status === 200, `open status ${open.status}`);
    data(open.json, 'public open');
  });

  // 10 --------------------------------------------------------- revoke
  await step('A revokes the share: POST /api/shares/:id/revoke', async () => {
    const { res, json } = await call('POST', `/api/shares/${ctx.shareId}/revoke`, { token: ctx.A.token });
    assert(res.status === 200 || res.status === 204, `status ${res.status}`);
    if (res.status !== 204) data(json, 'revoke');
  });

  // 11 ---------------------------------------------- revoked open -> 409
  await step('open after revoke -> 409 SHARE_REVOKED', async () => {
    const { status, json } = await call('POST', `/api/public/shares/${ctx.shareToken}/open`, { body: {} });
    assert(status === 409, `expected 409, got ${status}`);
    assert(errorCode(json) === 'SHARE_REVOKED', `expected SHARE_REVOKED, got ${errorCode(json)}`);
  });

  // 12 ------------------------------------------------- verification req
  await step('A creates a verification request', async () => {
    const { res, json } = await call('POST', '/api/verification-requests', {
      token: ctx.A.token,
      body: {
        documentId: ctx.docId,
        verifierName: 'E2E Verifier',
        verifierOrg: 'E2E Bank',
        purpose: 'End-to-end proof',
        expiresInDays: 30,
      },
    });
    assert(res.status === 200 || res.status === 201, `status ${res.status}`);
    const payload = data(json, 'verification request');
    const request = payload.request || payload;
    ctx.vId = request.id;
    ctx.vToken = request.token;
    assert(ctx.vId, 'no verification id');
    assert(ctx.vToken, 'token not minted on creation');
  });

  // 13 ---------------------------------------------------------- approve
  await step('A approves the verification request', async () => {
    const { res, json } = await call('POST', `/api/verification-requests/${ctx.vId}/approve`, { token: ctx.A.token });
    assert(res.status === 200 || res.status === 204, `status ${res.status}`);
    if (res.status !== 204) data(json, 'approve');
  });

  // 14 --------------------------------------------------- public verify
  await step('public verify: JSON verdict is valid with proof', async () => {
    const { res, json } = await call('GET', `/api/public/verify/${ctx.vToken}`);
    assert(res.status === 200, `status ${res.status}`);
    const d = data(json, 'public verify');
    assert(d.status === 'valid', `verdict ${d.status}, expected valid`);
    assert(d.proof && d.proof.sha256, 'proof.sha256 missing');
    assert(d.proof.sha256 === ctx.docSha, 'proof hash differs from upload fingerprint');
  });

  // 15 ------------------------------------------------------ admin login
  await step('admin login: POST /api/auth/login', async () => {
    const { res, json } = await call('POST', '/api/auth/login', {
      body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    assert(res.status === 200, `status ${res.status} (set ADMIN_EMAIL/ADMIN_PASSWORD for this vault)`);
    const d = data(json, 'admin login');
    ctx.admin.token = d.accessToken;
    assert(d.user && d.user.role === 'admin', `role is ${d.user && d.user.role}, expected admin`);
  });

  // 16 ------------------------------------------------------ admin stats
  await step('admin stats: GET /api/admin/stats', async () => {
    const { res, json } = await call('GET', '/api/admin/stats', { token: ctx.admin.token });
    assert(res.status === 200, `status ${res.status}`);
    const d = data(json, 'admin stats');
    assert(d && typeof d === 'object', 'stats payload missing');
  });

  // 17 ------------------------------------------------------ review queue
  await step('review queue: GET /api/admin/review-queue?status=pending', async () => {
    const { res, json } = await call('GET', '/api/admin/review-queue?status=pending&page=1&limit=20', {
      token: ctx.admin.token,
    });
    assert(res.status === 200, `status ${res.status}`);
    const d = data(json, 'review queue');
    assert(Array.isArray(d), 'queue is not an array');
  });

  // 18 ------------------------------------------------- notification read
  await step('notification read: list then mark one read', async () => {
    const list = await call('GET', '/api/notifications?page=1&limit=10', { token: ctx.A.token });
    assert(list.status === 200, `list status ${list.status}`);
    const items = data(list.json, 'notifications');
    assert(Array.isArray(items), 'notifications not an array');

    const unread = items.find((n) => !n.read && !n.readAt);
    if (unread) {
      const marked = await call('POST', `/api/notifications/${unread.id}/read`, { token: ctx.A.token, body: {} });
      assert(marked.status === 200 || marked.status === 204, `read status ${marked.status}`);
    } else {
      const all = await call('POST', '/api/notifications/read-all', { token: ctx.A.token, body: {} });
      assert(all.status === 200 || all.status === 204, `read-all status ${all.status}`);
    }
  });

  // 19 ------------------------------------------- OTP password reset: request
  await step('forgot-password emails an OTP (X-Dev-OTP), body stays clean', async () => {
    const { res, status, devOtp, json } = await call('POST', '/api/auth/forgot-password', {
      body: { email: ctx.emailA },
    });
    assert(status === 200, `status ${status}`);
    assert(devOtp && /^\d{6}$/.test(devOtp), 'no 6-digit code in X-Dev-OTP header');
    assert(!JSON.stringify(json).includes('resetCode'), 'body must never carry a code');
    ctx.resetOtp = devOtp;
  });

  // 20 ------------------------------------------ OTP password reset: negative
  await step('reset-password-otp with a wrong code -> 400 OTP_INVALID', async () => {
    const { status, json } = await call('POST', '/api/auth/reset-password-otp', {
      body: { email: ctx.emailA, code: '000000', newPassword: 'ResetPass2024x' },
    });
    assert(status === 400, `status ${status}`);
    assert(errorCode(json) === 'OTP_INVALID', `expected OTP_INVALID, got ${errorCode(json)}`);
  });

  // 21 -------------------------------------------- OTP password reset: right
  await step('reset-password-otp with the emailed code -> 204, login works', async () => {
    const { status } = await call('POST', '/api/auth/reset-password-otp', {
      body: { email: ctx.emailA, code: ctx.resetOtp, newPassword: 'ResetPass2024x' },
    });
    assert(status === 204, `status ${status}`);
    const login = await call('POST', '/api/auth/login', { body: { email: ctx.emailA, password: 'ResetPass2024x' } });
    assert(login.status === 200, `login with new password status ${login.status}`);
    ctx.A.token = login.json.data.accessToken;
  });

  // 22 ------------------------------------------ change-password needs step-up
  await step('change-password without step-up -> 403 STEP_UP_REQUIRED', async () => {
    const { status, json } = await call('POST', '/api/auth/change-password', {
      token: ctx.A.token,
      body: { currentPassword: 'ResetPass2024x', newPassword: 'SteppedPass2024' },
    });
    assert(status === 403, `status ${status}`);
    assert(errorCode(json) === 'STEP_UP_REQUIRED', `expected STEP_UP_REQUIRED, got ${errorCode(json)}`);
  });

  // 23 --------------------------------------------- step-up: request + wrong
  await step('request-step-up emails a code; wrong code -> 400', async () => {
    const req = await call('POST', '/api/auth/request-step-up', { token: ctx.A.token, body: {} });
    assert(req.status === 200, `request status ${req.status}`);
    assert(req.devOtp && /^\d{6}$/.test(req.devOtp), 'no dev OTP header on step-up request');
    ctx.stepUpOtp = req.devOtp;
    const wrong = await call('POST', '/api/auth/verify-step-up', { token: ctx.A.token, body: { code: '999999' } });
    assert(wrong.status === 400, `wrong-code status ${wrong.status}`);
  });

  // 24 ------------------------------------------------- step-up: verify
  await step('verify-step-up with the emailed code -> short-lived stepUpToken', async () => {
    const { status, json } = await call('POST', '/api/auth/verify-step-up', {
      token: ctx.A.token,
      body: { code: ctx.stepUpOtp },
    });
    assert(status === 200, `status ${status}`);
    const d = data(json, 'verify-step-up');
    ctx.stepUpToken = d.stepUpToken;
    assert(ctx.stepUpToken && ctx.stepUpToken.split('.').length === 3, 'stepUpToken missing');
  });

  // 25 ---------------------------------- gated change-password with token
  await step('change-password with X-Step-Up-Token -> 204', async () => {
    const { status } = await call('POST', '/api/auth/change-password', {
      token: ctx.A.token,
      headers: { 'X-Step-Up-Token': ctx.stepUpToken },
      body: { currentPassword: 'ResetPass2024x', newPassword: 'SteppedPass2024' },
    });
    assert(status === 204, `status ${status}`);
    const login = await call('POST', '/api/auth/login', { body: { email: ctx.emailA, password: 'SteppedPass2024' } });
    assert(login.status === 200, `login status ${login.status}`);
    ctx.A.token = login.json.data.accessToken;
  });

  // 26 ------------------------------------------------ MFA setup + enable
  await step('mfa setup + enable with a computed TOTP', async () => {
    const setup = await call('POST', '/api/auth/mfa/setup', { token: ctx.A.token });
    assert(setup.status === 200, `setup status ${setup.status}`);
    ctx.mfaSecret = setup.json.data.secret;
    const enable = await call('POST', '/api/auth/mfa/enable', {
      token: ctx.A.token,
      body: { secret: ctx.mfaSecret, code: totp(ctx.mfaSecret) },
    });
    assert(enable.status === 200, `enable status ${enable.status}`);
  });

  // 27 ------------------------------- Phase 4: email MFA fallback -> 440
  await step('login with useEmailMfa -> 440 MFA_EMAIL_CHALLENGE + challenge', async () => {
    const { status, json, devOtp } = await call('POST', '/api/auth/login', {
      body: { email: ctx.emailA, password: 'SteppedPass2024', useEmailMfa: true },
    });
    assert(status === 440, `status ${status}`);
    assert(errorCode(json) === 'MFA_EMAIL_CHALLENGE', `expected MFA_EMAIL_CHALLENGE, got ${errorCode(json)}`);
    assert(json.challenge, 'no challenge token in 440 body');
    assert(devOtp && /^\d{6}$/.test(devOtp), 'no emailed code in X-Dev-OTP header');
    ctx.mfaChallenge = json.challenge;
    ctx.mfaOtp = devOtp;
  });

  // 28 ---------------------------------- Phase 4: verify-otp issues tokens
  await step('verify-otp: wrong code 400, right code -> session tokens', async () => {
    const wrong = await call('POST', '/api/auth/verify-otp', {
      body: { challenge: ctx.mfaChallenge, code: '000000' },
    });
    assert(wrong.status === 400, `wrong-code status ${wrong.status}`);
    const right = await call('POST', '/api/auth/verify-otp', {
      body: { challenge: ctx.mfaChallenge, code: ctx.mfaOtp },
    });
    assert(right.status === 200, `right-code status ${right.status}`);
    const d = data(right.json, 'verify-otp');
    assert(d.accessToken && d.user, 'no session from verify-otp');
    ctx.A.token = d.accessToken;
  });

  // 29 --------------------------- Phase 5: OTP-gated share + negative paths
  await step('create OTP-gated share; open -> 401; wrong recipient -> 403', async () => {
    const create = await call('POST', '/api/shares', {
      token: ctx.A.token,
      body: { documentId: ctx.docId, permission: 'view', expiresInHours: 1, requireOtp: true, recipientEmail: ctx.emailB },
    });
    assert(create.status === 201, `create status ${create.status}`);
    ctx.gatedToken = data(create.json, 'gated share').linkToken;
    assert(ctx.gatedToken, 'no gated link token');

    const meta = await call('GET', `/api/public/shares/${ctx.gatedToken}`);
    assert(meta.json.data.otpRequired === true, 'meta does not flag otpRequired');
    const open = await call('POST', `/api/public/shares/${ctx.gatedToken}/open`, { body: {} });
    assert(open.status === 401 && errorCode(open.json) === 'SHARE_OTP_REQUIRED', `open ${open.status} ${errorCode(open.json)}`);
    const wrong = await call('POST', `/api/public/shares/${ctx.gatedToken}/request-otp`, {
      body: { email: 'not.the.recipient@docutrust-test.dev' },
    });
    assert(wrong.status === 403, `wrong-recipient status ${wrong.status}`);
  });

  // 30 ----------------------------- Phase 5: request-otp + open-with-otp
  await step('request-otp emails the recipient; open-with-otp grants access', async () => {
    const req = await call('POST', `/api/public/shares/${ctx.gatedToken}/request-otp`, { body: { email: ctx.emailB } });
    assert(req.status === 200, `request-otp status ${req.status}`);
    assert(req.devOtp && /^\d{6}$/.test(req.devOtp), 'no share OTP in X-Dev-OTP header');
    const wrong = await call('POST', `/api/public/shares/${ctx.gatedToken}/open-with-otp`, {
      body: { email: ctx.emailB, code: '111111' },
    });
    assert(wrong.status === 400, `wrong-code status ${wrong.status}`);
    const open = await call('POST', `/api/public/shares/${ctx.gatedToken}/open-with-otp`, {
      body: { email: ctx.emailB, code: req.devOtp },
    });
    assert(open.status === 200, `open-with-otp status ${open.status}`);
    const d = data(open.json, 'open-with-otp');
    assert(d.title && d.viewCount === 1, `unexpected payload ${JSON.stringify(d).slice(0, 120)}`);
  });

  // 31 ------------------------------ org invite via emailed OTP + accept
  await step('invite emails an OTP (no temporaryPassword); accept-invite activates', async () => {
    const mgrReg = await call('POST', '/api/auth/register', {
      body: { email: `e2e.mgr.${runId}@docutrust-test.dev`, password: ctx.password, fullName: 'Morgan E2E', orgName: `E2E Org ${runId}` },
    });
    assert(mgrReg.status === 201, `manager register status ${mgrReg.status}`);
    const mgrToken = mgrReg.json.data.accessToken;

    const invite = await call('POST', '/api/org/invite', {
      token: mgrToken,
      body: { email: `e2e.invitee.${runId}@docutrust-test.dev`, role: 'member' },
    });
    assert(invite.status === 201, `invite status ${invite.status}`);
    assert(invite.devOtp && /^\d{6}$/.test(invite.devOtp), 'no invite code in X-Dev-OTP header');
    assert(!JSON.stringify(invite.json).includes('temporaryPassword'), 'body must never carry a temporary password');

    const accept = await call('POST', '/api/auth/accept-invite', {
      body: {
        email: `e2e.invitee.${runId}@docutrust-test.dev`,
        code: invite.devOtp,
        password: 'InviteePass2024',
        fullName: 'Ivy Invitee',
      },
    });
    assert(accept.status === 200, `accept status ${accept.status}`);
    const d = data(accept.json, 'accept-invite');
    assert(d.accessToken && d.user.status === 'active', 'invitee not activated with tokens');
  });

  // Summary -------------------------------------------------------------
  const total = index;
  const failed = failures.length;
  console.log(`\n${total} steps: ${total - failed} passed, ${failed} failed`);
  if (failed) {
    console.log('Failures:');
    failures.forEach((f) => console.log(`  - ${f}`));
    process.exit(1);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error('e2e suite crashed:', e);
  process.exit(1);
});
