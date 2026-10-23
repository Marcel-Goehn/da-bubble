// Builds the Keycloak login theme's assets from src/keycloak-theme.css and the self-hosted Nunito.
// The output is committed, so `--check` rebuilds into a temp dir and fails if it differs.
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const resources = '../keycloak/themes/da-bubble/login/resources';
const fonts = ['nunito-latin-wght-normal.woff2', 'nunito-latin-ext-wght-normal.woff2'];
const outputs = ['css/login.css', ...fonts.map((font) => `fonts/${font}`)];

function build(target) {
  mkdirSync(join(target, 'css'), { recursive: true });
  mkdirSync(join(target, 'fonts'), { recursive: true });
  execFileSync(
    'tailwindcss',
    ['--input', 'src/keycloak-theme.css', '--output', join(target, 'css/login.css'), '--minify'],
    { stdio: ['ignore', 'ignore', 'inherit'] },
  );
  for (const font of fonts) {
    copyFileSync(
      `node_modules/@fontsource-variable/nunito/files/${font}`,
      join(target, 'fonts', font),
    );
  }
}

if (process.argv.includes('--check')) {
  const fresh = mkdtempSync(join(tmpdir(), 'keycloak-theme-'));
  try {
    build(fresh);
    const stale = outputs.filter((file) => {
      try {
        return !readFileSync(join(fresh, file)).equals(readFileSync(join(resources, file)));
      } catch {
        return true;
      }
    });
    if (stale.length > 0) {
      console.error(
        `Keycloak theme assets are stale: ${stale.join(', ')}. Run npm run build:keycloak-theme.`,
      );
      process.exit(1);
    }
  } finally {
    rmSync(fresh, { recursive: true, force: true });
  }
} else {
  build(resources);
}
