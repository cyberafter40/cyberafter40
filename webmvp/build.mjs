/**
 * Builds the web MVP into one self-contained HTML file.
 *
 * Single file on purpose: it can be opened from a phone over any link, mailed
 * as an attachment, or dropped on static hosting with no build step, no server
 * and no network at runtime. That makes it the only way to put this game in a
 * real person's hands before the Apple Developer account exists.
 *
 *   node webmvp/build.mjs          →  webmvp/dist/mindcode.html
 */

import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '..');
const outDir = resolve(here, 'dist');

/**
 * Resolves the app's `@/*` path alias the same way tsconfig does.
 *
 * It hands the rewritten path back to esbuild rather than returning it
 * directly, so extensions and directory `index` files still resolve — `@/games`
 * has to find `src/games/index.ts` on its own.
 */
const aliasPlugin = {
  name: 'app-alias',
  setup(pluginBuild) {
    pluginBuild.onResolve({ filter: /^@\// }, async (args) => {
      if (args.pluginData === 'alias') return undefined;
      return pluginBuild.resolve(`./${args.path.slice(2)}`, {
        kind: args.kind,
        resolveDir: resolve(repo, 'src'),
        pluginData: 'alias',
      });
    });
  },
};

const bundle = await build({
  entryPoints: [resolve(here, 'app.ts')],
  bundle: true,
  format: 'iife',
  target: ['es2020'],
  platform: 'browser',
  minify: true,
  // `__DEV__` is a React Native global; the i18n runtime guards on it, and the
  // guard resolves at build time here rather than leaving a free identifier.
  define: { __DEV__: 'false' },
  plugins: [aliasPlugin],
  write: false,
  resolveExtensions: ['.ts', '.tsx', '.js'],
  logLevel: 'warning',
});

const js = bundle.outputFiles[0].text;
const css = await readFile(resolve(here, 'styles.css'), 'utf8');

/* An inline SVG favicon keeps the file genuinely self-contained. */
const favicon =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
      '<rect width="64" height="64" rx="14" fill="#0E1116"/>' +
      '<text x="32" y="44" font-size="34" font-family="system-ui,sans-serif" ' +
      'font-weight="700" fill="#7C6BFF" text-anchor="middle">±</text></svg>',
  );

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="color-scheme" content="dark light">
<meta name="description" content="MindCode — a five-minute daily logic game. Crack the hidden code.">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="MindCode">
<title>MindCode</title>
<link rel="icon" href="${favicon}">
<style>${css}</style>
</head>
<body>
<div id="app"></div>
<script>${js}</script>
</body>
</html>
`;

/*
 * A second, head-less output for hosts that supply their own document shell
 * (the Claude artifact publisher is one). Same bundle, no <html>/<head>/<body>
 * — those get rejected or duplicated when the host wraps the file itself.
 */
const fragment = `<title>MindCode</title>
<style>${css}</style>
<div id="app"></div>
<script>${js}</script>
`;

await mkdir(outDir, { recursive: true });

const standalone = resolve(outDir, 'mindcode.html');
const embedded = resolve(outDir, 'mindcode.fragment.html');
await writeFile(standalone, html, 'utf8');
await writeFile(embedded, fragment, 'utf8');

const kb = (bytes) => (Buffer.byteLength(bytes, 'utf8') / 1024).toFixed(0);
console.log(`webmvp → ${standalone} (${kb(html)} KB, self-contained)`);
console.log(`webmvp → ${embedded} (${kb(fragment)} KB, for an embedding host)`);
