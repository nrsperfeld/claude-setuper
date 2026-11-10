// Instalação do Maestri quando o Homebrew aponta pra um arquivo que saiu do ar.
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

test('lê o arquivo certo do feed de atualização do Maestri', async () => {
  const { urlDoFeed } = await import(path.join(__dirname, '..', 'src', 'modulos', 'semBrew.js'));
  const xml = '<item><title>0.59.5</title><enclosure sparkle:version="1" url="https://updates.maestri.dev/downloads/Maestri-0.59.5.zip" length="1"/></item>';
  assert.strictEqual(urlDoFeed(xml), 'https://updates.maestri.dev/downloads/Maestri-0.59.5.zip');
  assert.strictEqual(urlDoFeed('<item></item>'), '');
});
