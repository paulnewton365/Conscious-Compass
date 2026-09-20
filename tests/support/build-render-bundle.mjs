// Bundles App.jsx for Node so internal components can be rendered in tests.
// Supabase is stubbed; the internal components are exported only inside this
// test bundle, so the production module's exports are unchanged.
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const EXPOSE = ['Header', 'TeaserClientView', 'TeaserReport', 'TeaserPage', 'TrustLensPanel', 'exportTeaserPdf', 'ThesisPanel', 'ClientReportView', 'makeClientPayload'];

await build({
  entryPoints: [path.join(root, 'src/App.jsx')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  jsx: 'automatic',
  outfile: path.join(root, 'tests/.build/app.bundle.mjs'),
  loader: { '.png': 'dataurl', '.svg': 'dataurl', '.css': 'empty' },
  define: { 'import.meta.env.VITE_ANTHROPIC_API_KEY': '""' },
  // One React for tests and components, or hooks break.
  external: ['react', 'react-dom', 'react-dom/*', 'react/*'],
  // Bundled CommonJS deps call require('react'); give the ESM bundle a real require.
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
  logLevel: 'error',
  plugins: [{
    name: 'test-shims',
    setup(b) {
      // External, so the bundle and the tests share one stub instance and one call log.
      b.onResolve({ filter: /\/lib\/supabase$/ }, () => ({ path: path.join(root, 'tests/support/supabase.stub.mjs'), external: true }));
      b.onLoad({ filter: /src\/App\.jsx$/ }, (args) => ({
        contents: readFileSync(args.path, 'utf8') + `\nexport { ${EXPOSE.join(', ')} };\n`,
        loader: 'jsx',
      }));
    },
  }],
});
console.log('bundle ok');
