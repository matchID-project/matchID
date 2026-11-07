import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { svelteTesting } from '@testing-library/svelte/vite';

// Values injected in place of the `__X__` build placeholders, mirroring what
// @rollup/plugin-replace does in rollup.config.js (plain text replacement,
// including inside string literals, which Vite's `define` would not do).
export const placeholders = {
  __AB_THRESHOLD__: '100',
  __API_EMAIL__: 'test@example.org',
  __API_MAX_BODY__: '100m',
  __ES_MAX_RESULTS__: '10000',
  __BACKEND_TOKEN_USER__: 'admin@example.org',
  __BACKEND_PROXY_PATH__: '/deces/api/v1',
  __DATAGOUV_PROXY_PATH__: '/data.gouv.fr',
  __DATAGOUV_CATALOG_URL__: '/data.gouv.fr/catalog',
  __DATAGOUV_RESOURCES_URL__: '/data.gouv.fr/resources',
  __MITM_URL__: '/mitm/mitm.html',
  __APP_FRONTEND__: 'deces-ui',
  __APP_VERSION__: 'test',
  __THEME_DNUM__: '0'
};

const placeholderPattern = new RegExp(Object.keys(placeholders).join('|'), 'g');

const srcDir = fileURLToPath(new URL('./src/', import.meta.url));

// Replace the placeholders in the app sources (src/ of this package only),
// before the Svelte compiler sees them.
const placeholdersPlugin = () => ({
  name: 'deces-ui:placeholders',
  enforce: 'pre',
  transform(code, id) {
    const [file] = id.split('?');
    if (!file.startsWith(srcDir) || !/\.(svelte|js)$/.test(file)) return null;
    const source = code.replace(placeholderPattern, (key) => placeholders[key]);
    return source === code ? null : { code: source, map: null };
  }
});

export default defineConfig({
  plugins: [
    placeholdersPlugin(),
    // Official Svelte plugin; dev checks on and component CSS injected in
    // the document, as with the former in-house Svelte 3 plugin.
    svelte({ compilerOptions: { dev: true, css: 'injected' }, emitCss: false }),
    svelteTesting()
  ],
  resolve: {
    // Use Svelte's client runtime (not its SSR build) in jsdom.
    conditions: ['browser']
  },
  test: {
    environment: 'jsdom',
    include: ['test/unit/**/*.test.js'],
    setupFiles: ['test/unit/setup.js'],
    restoreMocks: true
  }
});
