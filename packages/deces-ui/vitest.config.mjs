import { defineConfig } from 'vitest/config';
import { svelteTesting } from '@testing-library/svelte/vite';
import { compile } from 'svelte/compiler';

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

// Minimal Svelte 3 compiler plugin for Vitest.
// The official @sveltejs/vite-plugin-svelte only supports Svelte 3 in its 2.x
// line, which is pinned to Vite 4 (and therefore to an old Vitest with known
// advisories). This plugin compiles components with the Svelte compiler that
// the app already uses and injects the component CSS. When the app moves to
// Svelte 5, replace it with the official plugin; the tests stay unchanged.
const svelte3 = () => ({
  name: 'deces-ui:svelte3',
  enforce: 'pre',
  transform(code, id) {
    const [file] = id.split('?');
    if (!file.includes('/src/')) return null;
    if (!/\.(svelte|js)$/.test(file)) return null;
    const source = code.replace(placeholderPattern, (key) => placeholders[key]);
    if (!file.endsWith('.svelte')) {
      return source === code ? null : { code: source, map: null };
    }
    const { js } = compile(source, {
      filename: file,
      format: 'esm',
      dev: true,
      css: true
    });
    return { code: js.code, map: js.map };
  }
});

export default defineConfig({
  plugins: [svelte3(), svelteTesting()],
  resolve: {
    // Use Svelte's client runtime (not its SSR build) in jsdom.
    conditions: ['browser']
  },
  test: {
    environment: 'jsdom',
    include: ['test/unit/**/*.test.js'],
    setupFiles: ['test/unit/setup.js'],
    restoreMocks: true,
    server: {
      deps: {
        // ships extensionless ESM imports that only a bundler can resolve
        inline: ["svelte-scrolling"]
      }
    }
  }
});
