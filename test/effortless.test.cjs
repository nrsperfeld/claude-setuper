// Effortless: o plugin reabre o guia de configuração em toda conversa nova até ver setupDone no arquivo de estado dele.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const MODULO = path.join(__dirname, '..', 'src', 'modulos', 'effortless.js');
// Nome real do arquivo, conferido no Mac com o plugin 1.71.0.
const ARQUIVO = 'effortless_effortless-5bc474ce2005.json';

function ctxDe(claudeDir, extra = {}) {
  const lerJson = (p, padrao) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return padrao; } };
  return { claudeDir, lerJson, dryRun: false, ...extra };
}

test('marca a configuração como feita no arquivo que o plugin lê e mantém o resto do estado', async () => {
  const { marcarSetupFeito } = await import(MODULO);
  const claudeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'effortless-'));
  const store = path.join(claudeDir, 'plugins', 'store');
  fs.mkdirSync(store, { recursive: true });
  fs.writeFileSync(path.join(store, ARQUIVO), JSON.stringify({ judge: 'x' }));
  marcarSetupFeito(ctxDe(claudeDir));
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(path.join(store, ARQUIVO), 'utf8')), { judge: 'x', setupDone: true });
});

test('cria o arquivo quando o plugin ainda não criou, e no modo de teste não escreve nada', async () => {
  const { marcarSetupFeito } = await import(MODULO);
  const claudeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'effortless-'));
  marcarSetupFeito(ctxDe(claudeDir, { dryRun: true }));
  assert.ok(!fs.existsSync(path.join(claudeDir, 'plugins')));
  marcarSetupFeito(ctxDe(claudeDir));
  assert.strictEqual(JSON.parse(fs.readFileSync(path.join(claudeDir, 'plugins', 'store', ARQUIVO), 'utf8')).setupDone, true);
});
