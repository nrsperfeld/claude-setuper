// Página de download: a linha curta do Terminal serve docs/i, que precisa ser o install.sh de agora.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.join(__dirname, '..');

test('docs/i é cópia exata do install.sh (cp install.sh docs/i depois de mexer nele)', () => {
  assert.strictEqual(fs.readFileSync(path.join(RAIZ, 'docs', 'i'), 'utf8'), fs.readFileSync(path.join(RAIZ, 'install.sh'), 'utf8'));
});

test('a página mostra a linha curta que aponta pro docs/i', () => {
  const html = fs.readFileSync(path.join(RAIZ, 'docs', 'index.html'), 'utf8');
  assert.match(html, /curl -fsSL https:\/\/nrsperfeld\.github\.io\/claude-setuper\/i \| bash/);
});
