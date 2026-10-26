// Voltar pra terminar o que faltou: o wizard oferece as mesmas respostas e não refaz as perguntas (src/wizard.js).
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const src = (rel) => import(pathToFileURL(path.join(__dirname, '..', 'src', rel)).href);

async function preparar(respostas) {
  const { criarCtx } = await src('ctx.js');
  const { ui } = await src('ui.js');
  const { wizard } = await src('wizard.js');
  const casa = fs.mkdtempSync(path.join(os.tmpdir(), 'setuper-reaproveitar-'));
  const ctx = criarCtx({ home: casa, semApps: true });
  ctx.estado.respostas = respostas;
  return { ctx, ui, wizard };
}

const SALVO = { nome: 'Ana', perfil: 'estudante', idade: '19', tecnologia: 'basico', ia: 'chat', trabalho: '', autonomia: 'equilibrado', modulos: ['base', 'nucleo', 'obsidian'], pacotes: [], mcps: [] };

test('com respostas salvas, pergunta uma vez só e usa as mesmas', async () => {
  const { ctx, ui, wizard } = await preparar(SALVO);
  const original = { confirmar: ui.confirmar, perguntar: ui.perguntar };
  const perguntas = [];
  ui.confirmar = async (msg) => { perguntas.push(msg); return true; };
  ui.perguntar = async (msg) => { throw new Error(`não devia perguntar: ${msg}`); };
  try {
    const r = await wizard(ctx);
    assert.strictEqual(perguntas.length, 1);
    assert.match(perguntas[0], /Ana/);
    assert.strictEqual(ctx.reaproveitou, true);
    assert.deepStrictEqual(r.modulos, SALVO.modulos);
  } finally {
    Object.assign(ui, original);
  }
});

test('sem respostas salvas, não oferece reaproveitar', async () => {
  const { ctx, ui, wizard } = await preparar(undefined);
  const original = { confirmar: ui.confirmar, perguntar: ui.perguntar };
  ui.confirmar = async (msg) => { throw new Error(`não devia oferecer: ${msg}`); };
  ui.perguntar = async () => { throw new Error('chegou nas perguntas'); };
  try {
    await assert.rejects(wizard(ctx), /chegou nas perguntas/);
    assert.ok(!ctx.reaproveitou);
  } finally {
    Object.assign(ui, original);
  }
});
