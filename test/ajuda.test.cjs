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

test('a mensagem do WhatsApp cabe no limite e leva o que falhou e o fim do registro', async () => {
  const { limpar, mensagemWhatsApp, linkWhatsApp } = await carregar();
  const conteudo = limpar([
    'Pedido de ajuda do Claude Setuper', 'Gerado em hoje', '', 'Versão do Setuper: 1.8.0', 'Sistema: darwin 25 (arm64)', 'Pessoa: Ana', '',
    'Conferência:', '  Base', '    ✓ Node', '    ✗ Login no Claude  (rode: claude auth login)', '',
    'Fim do registro da instalação:', ...Array.from({ length: 2000 }, (_, i) => `linha ${i} token: gho_abcdefghijklmnopqrstuvwxyz123`), 'o erro que importa', '',
    'Fim do registro da atualização semanal:', '(não existe)',
  ].join('\n'));
  const m = mensagemWhatsApp(conteudo);
  assert.ok(m.length <= 3000, `grande demais: ${m.length}`);
  assert.ok(m.includes('Versão do Setuper: 1.8.0'));
  assert.ok(m.includes('✗ Login no Claude'));
  assert.ok(m.includes('o erro que importa'));
  assert.ok(!m.includes('gho_abc'));
  assert.ok(linkWhatsApp('oi tudo', true).startsWith('whatsapp://send?phone=5548991168047&text=oi%20tudo'));
  assert.ok(linkWhatsApp('oi', false).startsWith('https://api.whatsapp.com/send?phone=5548991168047'));
});

test('não estraga o texto normal', async () => {
  const { limpar } = await carregar();
  const normal = 'O Mac vai pedir a sua senha agora. Instalado em 2026-10-25. Node v24.11.0.';
  assert.strictEqual(limpar(normal), normal);
});
