import { build } from 'esbuild';
import { unlink } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const output = resolve('.test-records.generated.mjs');
try {
  await build({ entryPoints: ['tests/records.check.ts'], outfile: output, bundle: true, platform: 'node', format: 'esm', packages: 'external', define: { 'import.meta.env.BASE_URL': '"http://pirate.test/"' } });
  await import(pathToFileURL(output).href);
} finally { await unlink(output).catch(() => {}); }
