// Pedido de ajuda: o arquivo vai pra outra pessoa, então nenhum segredo pode sair (src/ajuda.js, limpar).
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const carregar = () => import(pathToFileURL(path.join(__dirname, '..', 'src', 'ajuda.js')).href);

test('apaga tokens, senhas e códigos de login', async () => {
  const { limpar } = await carregar();
  const texto = [
    'token: gho_abcdefghijklmnopqrstuvwxyz123',
    'GH: ghp_0123456789abcdefghijABCDEFGHIJ',
    'chave sk-ant-api03-abcdefghijklmno',
    '{"senha":"admin"}',
    'password=abc123',
    'Authorization: Bearer abc.def.ghi',
    '[evento] {"tipo":"codigo","codigo":"07D6-0B19"}',
    'First copy your one-time code: 07D6-0B19',
    'cola aqui: xYz_abcdefghijklmnopqrstuvwxyz0123456#abcdefghijkl',
  ].join('\n');
  const limpo = limpar(texto);
  for (const segredo of ['gho_abc', 'ghp_012', 'sk-ant-api03', 'admin', 'abc123', 'abc.def.ghi', '07D6-0B19', 'xYz_abc']) {
    assert.ok(!limpo.includes(segredo), `vazou: ${segredo}\n${limpo}`);
  }
});

test('não estraga o texto normal', async () => {
  const { limpar } = await carregar();
  const normal = 'O Mac vai pedir a sua senha agora. Instalado em 2026-10-25. Node v24.11.0.';
  assert.strictEqual(limpar(normal), normal);
});
