const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, ...p.split('/')));
const text = (p) => read(p).toString('utf8');
const sha256 = (p) => crypto.createHash('sha256').update(read(p)).digest('hex');
const sri384 = (p) => `sha384-${crypto.createHash('sha384').update(read(p)).digest('base64')}`;

const html = text('index.html');
const launcher = text('Run-Garden-v0_21.ps1');

function assetTags() {
  const tags = [];
  for (const match of html.matchAll(/<(script|link)\b([^>]*)>/g)) {
    const attrs = match[2];
    const url = attrs.match(/\b(?:src|href)="([^"]+)"/i)?.[1];
    if (!url || url.startsWith('http:') || url.startsWith('https:') || url.startsWith('//')) continue;
    const integrity = attrs.match(/\bintegrity="([^"]+)"/i)?.[1];
    tags.push({ kind: match[1].toLowerCase(), url, path: url.split(/[?#]/)[0], integrity, source: match[0] });
  }
  return tags;
}

function inlineScripts() {
  return [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
}

test('CSP is restrictive, same-origin and explicitly allows only the exact inline bootstrap', () => {
  const raw = html.match(/<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)"/i)?.[1];
  assert.ok(raw, 'CSP meta missing');
  for (const required of [
    "default-src 'self'",
    "base-uri 'none'",
    "object-src 'none'",
    "script-src 'self'",
    "connect-src 'self' blob:",
    "frame-src 'none'",
    "form-action 'none'"
  ]) assert.ok(raw.includes(required), `CSP missing ${required}`);
  assert.doesNotMatch(raw, /https?:|\*/);
  assert.doesNotMatch(raw, /script-src[^;]*'unsafe-inline'/);

  const scripts = inlineScripts();
  assert.equal(scripts.length, 1, 'Expected one inline bootstrap script');
  const expected = `'sha256-${crypto.createHash('sha256').update(Buffer.from(scripts[0], 'utf8')).digest('base64')}'`;
  assert.ok(raw.includes(expected), `CSP does not contain exact inline script hash ${expected}`);
});

test('all local CSS/JS resources have byte-matching SHA-384 SRI', () => {
  const tags = assetTags();
  assert.ok(tags.length >= 6, `Expected at least six local CSS/JS tags, got ${tags.length}`);
  for (const tag of tags) {
    assert.ok(fs.existsSync(path.join(root, ...tag.path.split('/'))), `Missing asset ${tag.path}`);
    assert.equal(tag.integrity, sri384(tag.path), `SRI mismatch for ${tag.path}`);
    assert.match(tag.source, /\bcrossorigin="anonymous"/i, `Missing crossorigin on ${tag.path}`);
  }
});

test('SRI and inline CSP hashes fail closed when bytes change', () => {
  const sitePath = 'assets/site.js';
  const declared = assetTags().find((tag) => tag.path === sitePath)?.integrity;
  assert.ok(declared);
  const tampered = Buffer.concat([read(sitePath), Buffer.from('\n// tamper-probe\n')]);
  const tamperedSri = `sha384-${crypto.createHash('sha384').update(tampered).digest('base64')}`;
  assert.notEqual(tamperedSri, declared);

  const bootstrap = inlineScripts()[0];
  const currentHash = crypto.createHash('sha256').update(Buffer.from(bootstrap, 'utf8')).digest('base64');
  const changedHash = crypto.createHash('sha256').update(Buffer.from(`${bootstrap} `, 'utf8')).digest('base64');
  assert.notEqual(changedHash, currentHash);
});

test('first-party browser code contains no dynamic HTML/code execution sinks', () => {
  for (const file of ['assets/site.js', 'assets/site-data.js', 'assets/material-profiles.js', 'assets/calculator-core.js']) {
    const source = text(file);
    for (const forbidden of [
      /\beval\s*\(/,
      /\bnew\s+Function\s*\(/,
      /\bdocument\.write\s*\(/,
      /\.innerHTML\s*=/,
      /\.outerHTML\s*=/,
      /\.insertAdjacentHTML\s*\(/
    ]) assert.doesNotMatch(source, forbidden, `${file} contains ${forbidden}`);
  }
});

test('runtime application sources do not declare external network endpoints', () => {
  for (const file of ['index.html', 'assets/site.js', 'assets/site-data.js', 'assets/material-profiles.js', 'assets/calculator-core.js']) {
    const source = text(file);
    assert.doesNotMatch(source, /(?:https?:)?\/\/[^\s"'<>]+/i, `${file} contains an external runtime URL`);
  }
});

test('local launcher binds Python HTTP server to loopback only', () => {
  assert.match(launcher, /['\"]--bind['\"]\s*,\s*['\"]127\.0\.0\.1['\"]/);
  assert.match(launcher, /http:\/\/127\.0\.0\.1:/);
  assert.doesNotMatch(launcher, /['\"]--bind['\"]\s*,\s*['\"](?:0\.0\.0\.0|::)['\"]/);
});

test('vendored model-viewer has explicit third-party licensing records', () => {
  assert.ok(fs.existsSync(path.join(root, 'THIRD-PARTY-NOTICES.txt')));
  assert.ok(fs.existsSync(path.join(root, 'licenses', 'model-viewer-4.3.1-Apache-2.0.txt')));
  assert.match(text('THIRD-PARTY-NOTICES.txt'), /@google\/model-viewer\s+4\.3\.1/i);
  assert.match(text('licenses/model-viewer-4.3.1-Apache-2.0.txt'), /Apache License\s+Version 2\.0/i);
});

test('protected model, solar source, seasonal maps and report remain byte-identical', () => {
  const expected = {
    '3d/garden_v0_18_primary_interactive_model_r4.glb': '37721f8b5d4c650cc4314a90f31887998cbbe080acff58c81fd2980562d06845',
    'data/garden_v0_15_solar_results_r4.json': '28fcbf0a11912c02be0abeb19d426b0e83b2becc35ff22340e3aabe2a6b49ad0',
    'solar/v0_18/garden_v0_18_solar_summer_likely_b330_r1.png': '473c16e6bc92c815bada70ded36d12fd2e896f91c8f10034e57eec04894a4fae',
    'solar/v0_18/garden_v0_18_solar_autumn_likely_b330_r1.png': '4a505ddea88d1d8f77f576067ecdcbf5c77dc0b1794f5569a804222cd0500042',
    'solar/v0_18/garden_v0_18_solar_winter_likely_b330_r1.png': 'ee7e21d2ab1f6fd6eb941ad83a5fe8afaba5968f22ee50a00629a455af0c39bc',
    'solar/v0_18/garden_v0_18_solar_spring_likely_b330_r1.png': '626fa2a167776b932d9685e639d86feafa1b14ca5893d878e58dbba70bd1f652',
    'documents/garden_v0_20_four_season_solar_summary_r6.pdf': 'da17984373c3e9bc607804f9f244bb24393a7c056da620fd00c2f3dfafb2c1e6'
  };
  for (const [file, expectedHash] of Object.entries(expected)) assert.equal(sha256(file), expectedHash, file);
});

test('vendored runtime directory contains no source maps', () => {
  const vendorDir = path.join(root, 'assets', 'vendor');
  const files = fs.readdirSync(vendorDir);
  assert.ok(files.includes('model-viewer-4.3.1.min.js'));
  assert.equal(files.filter((name) => name.endsWith('.map')).length, 0);
});
