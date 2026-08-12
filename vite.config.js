import { createHash } from 'crypto';
import { readFileSync, readdirSync, writeFileSync } from 'fs';
import { join } from 'path';

// The service worker precaches the app shell, and since the build emits
// content-hashed filenames (assets/index-BTTk_GBF.js) that list cannot be
// written by hand. It is filled in here, after the bundle is on disk.
//
// This matters more than it looks: cache.addAll() rejects if a single entry
// 404s, which fails the install event, which means the worker never activates
// and the app is neither installable nor offline-capable. A stale name in that
// list is not a degraded cache, it is no cache at all.
function precacheServiceWorker() {
  return {
    name: 'precache-service-worker',
    apply: 'build',
    closeBundle() {
      const out = 'dist';
      const assets = readdirSync(join(out, 'assets')).map((f) => './assets/' + f);
      const shell = [
        './',
        './index.html',
        './manifest.webmanifest',
        './icon-192.png',
        './icon-512.png',
        './icon-maskable-512.png',
        './icon.svg',
        './apple-touch-icon.png',
        ...assets
      ];

      // The cache name is a digest of every hashed filename, so it changes when
      // and only when the build output does — which is what evicts the old
      // cache in the activate handler. Digesting rather than truncating matters:
      // slicing the joined list would have tracked whichever name happened to
      // sort last, leaving JS-only changes serving a stale cache forever.
      const version = createHash('sha256').update(assets.join('|')).digest('hex').slice(0, 12);

      const path = join(out, 'sw.js');
      const src = readFileSync(path, 'utf8');
      const start = '// build:shell-start';
      const end = '// build:shell-end';
      const a = src.indexOf(start);
      const b = src.indexOf(end);
      if (a < 0 || b < 0) throw new Error('sw.js is missing its build:shell markers');

      writeFileSync(path,
        src.slice(0, a) + start + '\n' +
        "var CACHE = 'voice-trainer-" + version + "';\n" +
        'var SHELL = ' + JSON.stringify(shell, null, 2) + ';\n' +
        src.slice(b));
    }
  };
}

export default {
  // Relative, not '/voicetrainer/'. GitHub Pages serves this repo from a
  // subpath, Vercel would serve it from the root, and `npm run preview` from
  // yet another — relative paths are correct under all three, so the built
  // output is not tied to one host.
  base: './',
  plugins: [precacheServiceWorker()]
};
