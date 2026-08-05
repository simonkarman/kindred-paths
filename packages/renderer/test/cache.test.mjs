// Unit tests for the withCache decorator (../src/cache.js). Uses a mock inner Renderer (no
// real CC boot) and a tmp dir per test file run. Run via `pnpm -F @kindred-paths/renderer test`
// (node's built-in test runner — no extra devDependency needed).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';

import { withCache, computeCacheKey } from '../src/cache.js';

/** A tiny valid PNG (4x4, solid color) — sharp can decode this to make a real thumbnail. */
async function makePng(rgb = [200, 50, 50]) {
  return sharp({
    create: { width: 4, height: 4, channels: 3, background: { r: rgb[0], g: rgb[1], b: rgb[2] } },
  }).png().toBuffer();
}

/** Builds a mock Renderer whose render() returns a fresh PNG and counts invocations. */
function makeMockRenderer({ name = 'mock', version = 'v1' } = {}) {
  let calls = 0;
  const renderer = {
    name,
    version,
    async render(input, options) {
      calls++;
      const png = await makePng();
      return { png, width: 4, height: 4, timings: { totalMs: 1 } };
    },
  };
  return { renderer, getCalls: () => calls };
}

async function withTmpDir(fn) {
  const dir = await mkdtemp(join(tmpdir(), 'kp-render-cache-'));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test('miss then hit: second call for the same input/options is a cache hit and does not call inner', async () => {
  await withTmpDir(async (cacheDir) => {
    const { renderer, getCalls } = makeMockRenderer();
    const cached = withCache(renderer, { cacheDir });
    const input = { faces: [{ name: 'Card A' }] };

    const first = await cached.render(input, {});
    assert.equal(first.timings.cacheHit, false);
    assert.equal(getCalls(), 1);

    const second = await cached.render(input, {});
    assert.equal(second.timings.cacheHit, true);
    assert.equal(getCalls(), 1, 'inner renderer must not be called again on a cache hit');
    assert.deepEqual(second.png, first.png);
  });
});

test('writes both the full PNG and a thumbnail to <cacheDir>/renders/', async () => {
  await withTmpDir(async (cacheDir) => {
    const { renderer } = makeMockRenderer();
    const cached = withCache(renderer, { cacheDir });
    await cached.render({ faces: [{ name: 'Card B' }] }, {});

    const files = await readdir(join(cacheDir, 'renders'));
    assert.equal(files.length, 2);
    assert.ok(files.some((f) => f.endsWith('.png') && !f.includes('.thumb.')));
    assert.ok(files.some((f) => f.endsWith('.thumb.webp')));
  });
});

test('skipCache: true bypasses both read and write', async () => {
  await withTmpDir(async (cacheDir) => {
    const { renderer, getCalls } = makeMockRenderer();
    const cached = withCache(renderer, { cacheDir });
    const input = { faces: [{ name: 'Card C' }] };

    await cached.render(input, { skipCache: true });
    await cached.render(input, { skipCache: true });
    assert.equal(getCalls(), 2, 'inner renderer must be called every time when skipCache is true');

    const rendersDirExists = await readdir(join(cacheDir, 'renders')).catch(() => null);
    assert.equal(rendersDirExists, null, 'nothing should be written to disk when skipCache is true');
  });
});

test('skipCache does not affect the computed cache key', () => {
  const base = { rendererName: 'mock', rendererVersion: 'v1', input: { a: 1 } };
  const withoutFlag = computeCacheKey({ ...base, options: {} });
  const withTrue = computeCacheKey({ ...base, options: { skipCache: true } });
  const withFalse = computeCacheKey({ ...base, options: { skipCache: false } });
  assert.equal(withoutFlag, withTrue);
  assert.equal(withoutFlag, withFalse);
});

test('different input produces a different cache key (and a real cache miss)', async () => {
  await withTmpDir(async (cacheDir) => {
    const { renderer, getCalls } = makeMockRenderer();
    const cached = withCache(renderer, { cacheDir });

    await cached.render({ faces: [{ name: 'Card D' }] }, {});
    await cached.render({ faces: [{ name: 'Card E' }] }, {});
    assert.equal(getCalls(), 2);
  });
});

test('different (non-skipCache) options produce a different cache key', () => {
  const base = { rendererName: 'mock', rendererVersion: 'v1', input: { a: 1 } };
  const a = computeCacheKey({ ...base, options: { scale: 1 } });
  const b = computeCacheKey({ ...base, options: { scale: 2 } });
  assert.notEqual(a, b);
});

test('different renderer name does not collide even with identical input/version', () => {
  const options = {};
  const a = computeCacheKey({ rendererName: 'renderer-a', rendererVersion: 'v1', input: { x: 1 }, options });
  const b = computeCacheKey({ rendererName: 'renderer-b', rendererVersion: 'v1', input: { x: 1 }, options });
  assert.notEqual(a, b);
});

test('a version bump invalidates: same input/renderer name, different version misses cache', async () => {
  await withTmpDir(async (cacheDir) => {
    const { renderer: rendererV1 } = makeMockRenderer({ version: 'v1' });
    const { renderer: rendererV2, getCalls: getCallsV2 } = makeMockRenderer({ version: 'v2' });
    const input = { faces: [{ name: 'Card F' }] };

    const cachedV1 = withCache(rendererV1, { cacheDir });
    await cachedV1.render(input, {});

    const cachedV2 = withCache(rendererV2, { cacheDir });
    const result = await cachedV2.render(input, {});
    assert.equal(result.timings.cacheHit, false);
    assert.equal(getCallsV2(), 1, 'a different version must be treated as a fresh renderer, not a cache hit');
  });
});

test('decorated renderer preserves the inner name and resolved version', () => {
  const { renderer } = makeMockRenderer({ name: 'my-renderer', version: 'abc123' });
  const cached = withCache(renderer, { cacheDir: '/tmp/unused-in-this-test' });
  assert.equal(cached.name, 'my-renderer');
  assert.equal(cached.version, 'abc123');
});

test('explicit { version } option overrides inner.version', async () => {
  await withTmpDir(async (cacheDir) => {
    const { renderer } = makeMockRenderer({ version: 'inner-version' });
    const cached = withCache(renderer, { cacheDir, version: 'override-version' });
    assert.equal(cached.version, 'override-version');
  });
});

test('throws a clear error when neither inner.version nor an explicit version is provided', () => {
  const renderer = { name: 'no-version', async render() { return { png: Buffer.alloc(0) }; } };
  assert.throws(() => withCache(renderer, { cacheDir: '/tmp/unused' }), /requires a version/);
});

test('throws when cacheDir is missing', () => {
  const { renderer } = makeMockRenderer();
  assert.throws(() => withCache(renderer, {}), /requires a cacheDir/);
});
