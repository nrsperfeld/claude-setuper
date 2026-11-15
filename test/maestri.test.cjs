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

// Computer Use do Maestri ligado desde a instalação, sem religar quem desligou por escolha.
function ctxFalso(valor, extra = {}) {
  const chamadas = [];
  return {
    chamadas, plataforma: 'darwin', semApps: false, ...extra,
    async run(cmd, args) {
      chamadas.push([cmd, ...args]);
      if (args[0] === 'read') return valor;
      return '';
    },
  };
}

test('liga o Computer Use do Maestri quando nunca foi configurado', async () => {
  const { ligarComputerUse } = await import(path.join(__dirname, '..', 'src', 'modulos', 'maestri.js'));
  const ctx = ctxFalso('');
  assert.strictEqual(await ligarComputerUse(ctx), true);
  assert.deepStrictEqual(ctx.chamadas.at(-1), ['defaults', 'write', 'com.evercraftlabs.Maestro', 'ComputerUseEnabled', '-bool', 'true']);
});

test('não mexe no Computer Use de quem já configurou, nem em teste sem apps ou fora do Mac', async () => {
  const { ligarComputerUse } = await import(path.join(__dirname, '..', 'src', 'modulos', 'maestri.js'));
  for (const ctx of [ctxFalso('0'), ctxFalso('1'), ctxFalso('', { semApps: true }), ctxFalso('', { plataforma: 'win32' })]) {
    assert.strictEqual(await ligarComputerUse(ctx), false);
    assert.ok(!ctx.chamadas.some((c) => c[1] === 'write'));
  }
});
