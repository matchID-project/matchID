// Static checks of the build and PWA configuration (rollup.config.js,
// public/index.html, public/manifest.json, Docker build args). Files are
// read as text so that the vitest placeholder replacement does not apply.
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';

const root = path.resolve(__dirname, '../../..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const rollupConfig = read('rollup.config.js');
const indexHtml = read('public/index.html');

const listFiles = (dir, base = dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
  const p = path.join(dir, entry.name);
  return entry.isDirectory() ? listFiles(p, base) : [path.relative(base, p).split(path.sep).join('/')];
});

// Minimal glob support for the workbox patterns: {a,b} alternatives and *.
const expandBraces = (pattern) => {
  const match = pattern.match(/\{([^{}]*)\}/);
  if (!match) return [pattern];
  return match[1].split(',').flatMap(alt => expandBraces(pattern.replace(match[0], alt)));
};
const globToRegExp = (glob) => new RegExp(`^${glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*')}$`);
const matches = (pattern, file) => expandBraces(pattern).some(p => globToRegExp(p).test(file));

const stringArray = (name) => {
  const block = rollupConfig.match(new RegExp(`${name}:\\s*\\[([^\\]]*)\\]`));
  return [...block[1].matchAll(/'([^']*)'/g)].map(m => m[1]);
};

const placeholderKeys = [
  'AB_THRESHOLD', 'API_EMAIL', 'API_MAX_BODY', 'ES_MAX_RESULTS', 'BACKEND_TOKEN_USER', 'BACKEND_PROXY_PATH',
  'DATAGOUV_PROXY_PATH', 'DATAGOUV_CATALOG_URL', 'DATAGOUV_RESOURCES_URL', 'MITM_URL', 'APP_FRONTEND',
  'APP_VERSION', 'THEME_DNUM'
];

describe('CO-094 build-time placeholders', () => {
  const replaced = Object.fromEntries(
    [...rollupConfig.matchAll(/__([A-Z_]+)__\s*:\s*process\.env\.([A-Z_]+)/g)].map(m => [m[1], m[2]])
  );

  it('CO-094 rollup replaces the 13 placeholders, each from the environment variable of the same name', () => {
    expect(Object.keys(replaced).sort()).toEqual([...placeholderKeys].sort());
    Object.entries(replaced).forEach(([key, env]) => expect(env).toBe(key));
  });

  it('CO-094 every placeholder used in src/ is replaced by rollup (and by the vitest config)', () => {
    const srcDir = path.join(root, 'src');
    const used = new Set(listFiles(srcDir)
      .filter(f => /\.(js|svelte)$/.test(f))
      .flatMap(f => [...fs.readFileSync(path.join(srcDir, f), 'utf8').matchAll(/__([A-Z][A-Z_]*[A-Z])__/g)].map(m => m[1])));
    expect([...used].filter(key => !(key in replaced))).toEqual([]);
    const vitestKeys = [...read('vitest.config.mjs').matchAll(/^\s*__([A-Z_]+)__:/gm)].map(m => m[1]);
    expect(vitestKeys.sort()).toEqual([...placeholderKeys].sort());
  });

  it('CO-094 the Docker build stage receives every placeholder value', () => {
    const dockerfile = read('Dockerfile');
    const compose = read('docker-compose-build.yml');
    placeholderKeys.filter(k => !['APP_FRONTEND', 'APP_VERSION'].includes(k)).forEach(key => {
      expect(dockerfile).toMatch(new RegExp(`^ARG ${key}$`, 'm'));
      expect(dockerfile).toMatch(new RegExp(`^ENV ${key} \\$\\{${key}\\}$`, 'm'));
      expect(compose).toMatch(new RegExp(`^\\s+${key}: \\$\\{${key}\\}$`, 'm'));
    });
    // APP_FRONTEND / APP_VERSION come from the app_name / app_ver build args
    expect(dockerfile).toMatch(/^ENV APP_FRONTEND \$\{app_name\}$/m);
    expect(dockerfile).toMatch(/^ENV APP_VERSION \$\{app_ver\}$/m);
  });
});

describe('CO-088 module / nomodule loader', () => {
  it('CO-088 rollup emits an ES module build and an IIFE legacy build', () => {
    expect(rollupConfig).toMatch(/format: 'es',\s*name: 'app',\s*dir: 'public\/build\/module'/);
    expect(rollupConfig).toMatch(/format: 'iife',\s*inlineDynamicImports: true,\s*name: 'app',\s*dir: 'public\/build\/nomodule'/);
    expect(rollupConfig).toMatch(/production \? \[targets\[0\], targets\[1\]\] : \[targets\[0\]\]/);
  });

  const runLoader = ({ dynamicImport, noModule }) => {
    const dom = new JSDOM(indexHtml, {
      runScripts: 'outside-only',
      beforeParse(window) {
        // jsdom does not implement HTMLScriptElement.noModule
        if (noModule) Object.defineProperty(window.HTMLScriptElement.prototype, 'noModule', { value: false, configurable: true, writable: true });
        else delete window.HTMLScriptElement.prototype.noModule;
      }
    });
    const loader = [...dom.window.document.querySelectorAll('script:not([src])')]
      .find(s => s.textContent.includes('supportsDynamicImport')).textContent;
    const fn = dynamicImport ? loader : loader.replace(/new Function\('import\(""\)'\);/, 'throw new Error("no dynamic import");');
    dom.window.eval(fn);
    const script = [...dom.window.document.head.querySelectorAll('script[src*="/build/"]')].pop();
    return { src: script.getAttribute('src'), type: script.type };
  };

  it('CO-088 modern browsers load /build/module/main.js as a module', () => {
    expect(runLoader({ dynamicImport: true, noModule: true })).toEqual({ src: '/build/module/main.js', type: 'module' });
  });

  it('CO-088 legacy browsers (no dynamic import, or no noModule) load /build/nomodule/main.js', () => {
    expect(runLoader({ dynamicImport: false, noModule: true })).toEqual({ src: '/build/nomodule/main.js', type: '' });
    expect(runLoader({ dynamicImport: true, noModule: false })).toEqual({ src: '/build/nomodule/main.js', type: '' });
  });

  it('CO-088 index.html links the extracted component CSS of the module build', () => {
    expect(indexHtml).toContain("href='/build/module/bundle.css'");
    expect(rollupConfig).toMatch(/css\.write\('bundle\.css'\)/);
  });
});

describe('CO-087 / CO-089 static fallbacks in index.html', () => {
  const doc = new JSDOM(indexHtml).window.document;

  it('CO-087 #infoNotWorking is hidden by CSS and revealed by a 5 s timer', () => {
    expect(doc.getElementById('infoNotWorking').textContent).toMatch(/votre navigateur est incompatible/);
    expect(indexHtml).toMatch(/#infoNotWorking\s*\{[^}]*display:\s*none/);
    expect(indexHtml).toMatch(/getElementById\("infoNotWorking"\)[\s\S]*display = "block"[\s\S]*\}, 5000\)/);
  });

  it('CO-089 <noscript> describes the service', () => {
    const noscript = doc.querySelector('noscript').textContent;
    expect(noscript).toContain('Moteur de recherche des décès');
    expect(noscript).toContain("A qui s'adresse le service ?");
    expect(noscript).toContain('Qui sommes nous ?');
  });
});

describe('CO-090 / CO-091 service worker (workbox generateSW)', () => {
  const globPatterns = stringArray('globPatterns');
  const publicFiles = listFiles(path.join(root, 'public'));

  it('CO-090 precache list', () => {
    expect(rollupConfig).toMatch(/swDest: 'public\/sw\.js'/);
    expect(rollupConfig).toMatch(/cleanupOutdatedCaches: true/);
    expect(globPatterns).toEqual([
      'index.html', 'build/module/main.js', 'manifest.json', 'build/module/{main,Link,Default}-*.js',
      'favicon*{png,svg}', '{male,female}.svg', 'fonts/Marianne-{Bold,Regular}.woff2',
      'css/{global,dsfr.min}.css', 'build/module/bundle.css'
    ]);
    expect(stringArray('globIgnores')).toEqual(['{Geo,LinkCheck,Line,Bar}-*.js']);
  });

  it('CO-090 the static precache patterns match the shell files in public/', () => {
    ['index.html', 'manifest.json', 'favicon.svg', 'favicon.png', 'favicon-apple.png', 'male.svg', 'female.svg', 'css/global.css']
      .forEach(file => expect(globPatterns.some(p => matches(p, file)), file).toBe(true));
    expect(publicFiles).toEqual(expect.arrayContaining(['index.html', 'manifest.json', 'css/global.css']));
  });

  // BUG: the precache globs still target the old DSFR assets
  // (css/dsfr.min.css, fonts/Marianne-*.woff2) that are not in public/,
  // while the stylesheet and script that index.html actually loads
  // (css/matchid.min.css, js/matchid.min.js) are not precached: offline,
  // the app shell comes back unstyled.
  it.fails('CO-090 BUG: every asset linked by index.html is precached', () => {
    const doc = new JSDOM(indexHtml).window.document;
    const linked = [...doc.querySelectorAll('link[rel=stylesheet][href], script[src]')]
      .map(el => (el.getAttribute('href') || el.getAttribute('src')).replace(/^\//, ''));
    expect(linked).toEqual(expect.arrayContaining(['css/matchid.min.css', 'js/matchid.min.js']));
    linked.forEach(file => expect(globPatterns.some(p => matches(p, file)), file).toBe(true));
  });

  it('CO-090 the DSFR patterns currently match no file in public/', () => {
    expect(publicFiles.filter(f => matches('fonts/Marianne-{Bold,Regular}.woff2', f) || f === 'css/dsfr.min.css')).toEqual([]);
  });

  it('CO-091 navigation falls back to /index.html except for the backend and data.gouv proxy paths', () => {
    expect(rollupConfig).toMatch(/navigateFallback: '\/index\.html'/);
    const denylist = rollupConfig.match(/navigateFallbackDenylist:\s*\[([\s\S]*?)\]/)[1];
    expect(denylist).toContain('new RegExp(`${process.env.BACKEND_PROXY_PATH}.*`)');
    expect(denylist).toContain('new RegExp(`${process.env.DATAGOUV_PROXY_PATH}.*`)');
  });
});

describe('CO-093 PWA manifest', () => {
  const manifest = JSON.parse(read('public/manifest.json'));

  it('CO-093 standalone app with icons that exist and the theme colour of index.html', () => {
    expect(manifest).toMatchObject({ short_name: 'matchID', display: 'standalone', start_url: '.', background_color: '#ffffff' });
    const themeColor = new JSDOM(indexHtml).window.document.querySelector('meta[name=theme-color]').content;
    expect(manifest.theme_color).toBe(themeColor);
    expect(manifest.icons.length).toBeGreaterThan(0);
    manifest.icons.forEach(icon => {
      expect(fs.existsSync(path.join(root, 'public', icon.src)), icon.src).toBe(true);
      expect(icon.sizes).toMatch(/^\d+x\d+$/);
    });
    expect(indexHtml).toContain('<link rel="manifest" href="/manifest.json" />');
  });
});
