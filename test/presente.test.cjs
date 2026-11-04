// Modo presente (src/presente.js): leitura do presente.json, wizard sem as perguntas já respondidas,
// cópia do cofre sem sobrescrever e mescla do .obsidian do presente com o que o módulo escreve.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const src = (rel) => import(pathToFileURL(path.join(__dirname, '..', 'src', rel)).href);
const TEMPLATES = path.join(__dirname, '..', 'templates');

const PRESENTE = {
  pessoa: 'ana',
  nome: 'Ana',
  perfil: 'empresario',
  vault: 'Segundo Cérebro',
  respostas: {
    idade: '45', tecnologia: 'basico', ia: 'chat', trabalho: 'Tenho uma loja de roupas.',
    autonomia: 'equilibrado', pacotes: ['empresa', 'escrita'], mcps: [], modulos: 'tudo',
  },
  recado: { titulo: 'Ana, isto é seu.', texto: 'Montei o seu segundo cérebro.', assinatura: 'Nathan' },
  paraComecar: ['Primeiro pedido.', 'Segundo pedido.', 'Terceiro pedido.'],
};

function escrever(p, txt) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, typeof txt === 'string' ? txt : JSON.stringify(txt, null, 2));
}

// Uma pasta presente/ com presente.json e um cofre pequeno.
function pastaPresente(dados = PRESENTE) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'setuper-presente-'));
  escrever(path.join(dir, 'presente.json'), dados);
  const c = path.join(dir, 'cofre');
  escrever(path.join(c, 'Comece aqui.md'), 'Comece aqui do presente\n');
  escrever(path.join(c, 'CLAUDE', 'wiki', 'Como trabalhar comigo.md'), 'Regras da Ana, do presente.\n\n#claude #wiki\n');
  escrever(path.join(c, 'CLAUDE', 'wiki', 'pessoas', 'Bia.md'), 'Bia, sócia.\n\n#claude #wiki\n');
  escrever(path.join(c, 'CLAUDE', 'padrões', '2026-10-20 Prefere a recomendação primeiro.md'), 'Recomendação primeiro.\n\n#claude #padrão\n');
  escrever(path.join(c, 'CLAUDE', 'fontes', 'reuniões', '2026-10-22 Reunião.md'), 'Reunião.\n\n#claude #fonte\n');
  escrever(path.join(c, '.obsidian', 'snippets', 'elos.css'), '.theme-dark { --interactive-accent: #c8873c; }\n');
  escrever(path.join(c, '.obsidian', 'appearance.json'), { accentColor: '#c8873c', cssTheme: '', enabledCssSnippets: ['elos'] });
  escrever(path.join(c, '.obsidian', 'graph.json'), { colorGroups: [{ query: 'path:CLAUDE/wiki', color: { a: 1, rgb: 13141820 } }] });
  escrever(path.join(c, '.DS_Store'), 'lixo');
  escrever(path.join(c, '.git', 'HEAD'), 'ref: refs/heads/main\n');
  return dir;
}

async function ctxCom(presenteDir, extra = {}) {
  const { criarCtx } = await src('ctx.js');
  const casa = fs.mkdtempSync(path.join(os.tmpdir(), 'setuper-presente-casa-'));
  return criarCtx({ home: casa, semApps: true, presente: presenteDir, ...extra });
}

// ---------- leitura

test('lê o presente.json: nome, perfil, rótulo, recado, sugestões e respostas', async () => {
  const { lerPresente } = await src('presente.js');
  const dir = pastaPresente();
  const p = lerPresente(dir, { templates: TEMPLATES });
  assert.deepStrictEqual(p.problemas, []);
  assert.strictEqual(p.pessoa, 'ana');
  assert.strictEqual(p.rotulo, 'Segundo Cérebro do Ana');
  assert.strictEqual(p.vault, 'Segundo Cérebro');
  assert.strictEqual(p.recado.assinatura, 'Nathan');
  assert.strictEqual(p.paraComecar.length, 3);
  assert.strictEqual(p.respostas.nome, 'Ana');
  assert.strictEqual(p.respostas.perfil, 'empresario');
  assert.strictEqual(p.respostas.modulos, 'tudo');
  assert.strictEqual(p.cofre, path.join(dir, 'cofre'));
  // "da" muda o rótulo; sem pasta, não tem presente.
  assert.strictEqual(lerPresente(pastaPresente({ ...PRESENTE, artigo: 'da' })).rotulo, 'Segundo Cérebro da Ana');
  assert.strictEqual(lerPresente(fs.mkdtempSync(path.join(os.tmpdir(), 'vazio-'))), null);
  assert.strictEqual(lerPresente(''), null);
});

test('presente.json com problema: aponta cada um e não aproveita o valor errado', async () => {
  const { lerPresente } = await src('presente.js');
  const dir = pastaPresente({ ...PRESENTE, pessoa: 'Ana Souza', perfil: 'astronauta', vault: '../fora', respostas: { idade: 'quarenta', ia: 'muito', tecnologia: 'basico' }, paraComecar: ['só um'] });
  const p = lerPresente(dir, { templates: TEMPLATES });
  for (const campo of ['pessoa', 'perfil', 'vault', 'respostas.idade', 'respostas.ia', 'paraComecar']) {
    assert.ok(p.problemas.some((x) => x.startsWith(campo)), `faltou apontar ${campo}: ${p.problemas.join(' | ')}`);
  }
  assert.strictEqual(p.respostas.perfil, undefined);
  assert.strictEqual(p.respostas.idade, undefined);
  assert.strictEqual(p.respostas.tecnologia, 'basico');
  // JSON que não abre também é problema, não um erro que derruba a instalação.
  const quebrado = fs.mkdtempSync(path.join(os.tmpdir(), 'quebrado-'));
  fs.writeFileSync(path.join(quebrado, 'presente.json'), '{ nome: ');
  assert.match(lerPresente(quebrado).problemas[0], /não abre/);
});

test('o contexto acha o presente pela opção ou pela variável CLAUDE_SETUPER_PRESENTE', async () => {
  const dir = pastaPresente();
  assert.strictEqual((await ctxCom(dir)).presente.nome, 'Ana');
  process.env.CLAUDE_SETUPER_PRESENTE = dir;
  try {
    assert.strictEqual((await ctxCom(undefined)).presente.pessoa, 'ana');
  } finally {
    delete process.env.CLAUDE_SETUPER_PRESENTE;
  }
  assert.strictEqual((await ctxCom(undefined)).presente, null);
});

// ---------- wizard

async function rodarWizard(ctx, respostas = {}) {
  const { ui } = await src('ui.js');
  const { wizard } = await src('wizard.js');
  const original = { perguntar: ui.perguntar, escolher: ui.escolher, escolherVarios: ui.escolherVarios, confirmar: ui.confirmar, ok: ui.ok, info: ui.info, linha: ui.linha };
  const perguntas = [];
  const responder = (msg) => {
    perguntas.push(msg);
    const k = Object.keys(respostas).find((x) => msg.includes(x));
    if (k === undefined) throw new Error(`não devia perguntar: ${msg}`);
    return respostas[k];
  };
  Object.assign(ui, {
    perguntar: async (m) => responder(m), escolher: async (m) => responder(m), escolherVarios: async (m) => responder(m),
    confirmar: async (m) => responder(m), ok: () => {}, info: () => {}, linha: () => {},
  });
  try {
    return { r: await wizard(ctx), perguntas };
  } finally {
    Object.assign(ui, original);
  }
}

test('wizard com presente completo não pergunta nada e aponta o cofre do presente', async () => {
  const ctx = await ctxCom(pastaPresente());
  const { r, perguntas } = await rodarWizard(ctx);
  assert.deepStrictEqual(perguntas, []);
  assert.strictEqual(r.nome, 'Ana');
  assert.strictEqual(r.perfil, 'empresario');
  assert.strictEqual(r.idade, '45');
  assert.strictEqual(r.trabalho, 'Tenho uma loja de roupas.');
  assert.deepStrictEqual(r.pacotes, ['empresa', 'escrita']);
  assert.ok(r.modulos.includes('obsidian') && r.modulos.includes('base'));
  assert.strictEqual(r.vault, path.join(ctx.home, 'Documents', 'Segundo Cérebro'));
  assert.deepStrictEqual(ctx.estado.respostas, r);
});

test('wizard com presente pela metade pergunta só o que falta', async () => {
  const dados = { ...PRESENTE, respostas: { idade: '45', tecnologia: 'basico', ia: 'chat', modulos: ['obsidian'] } };
  const ctx = await ctxCom(pastaPresente(dados));
  const { r, perguntas } = await rodarWizard(ctx, {
    'Me conta da sua empresa': 'Uma padaria.',
    'Como você prefere': 'confiante',
    'Com o que você mais vai usar': ['escrita'],
    'Quais dessas ferramentas': [],
  });
  assert.strictEqual(perguntas.length, 4, perguntas.join(' | '));
  assert.strictEqual(r.trabalho, 'Uma padaria.');
  assert.strictEqual(r.autonomia, 'confiante');
  // Lista de passos do presente: entra com os obrigatórios, e não pergunta "posso instalar tudo?".
  assert.ok(r.modulos.includes('base') && r.modulos.includes('nucleo') && r.modulos.includes('obsidian'));
  assert.ok(!r.modulos.includes('vercel'));
});

test('wizard: abrindo de novo com presente, usa as respostas salvas sem perguntar', async () => {
  const ctx = await ctxCom(pastaPresente());
  ctx.estado.respostas = { nome: 'Ana', perfil: 'empresario', modulos: ['base', 'nucleo', 'obsidian'], vault: '/x/Segundo Cérebro' };
  const { r, perguntas } = await rodarWizard(ctx);
  assert.deepStrictEqual(perguntas, []);
  assert.strictEqual(ctx.reaproveitou, true);
  assert.strictEqual(r.vault, '/x/Segundo Cérebro');
});

// ---------- cofre

test('cofre: copia tudo, sem lixo de sistema nem .git, e não sobrescreve o que a pessoa já tinha', async () => {
  const { copiarCofre } = await src('presente.js');
  const ctx = await ctxCom(pastaPresente());
  const vault = path.join(ctx.home, 'Documents', 'Segundo Cérebro');
  // A pessoa já tinha um cofre com esse nome e uma nota dela com o mesmo nome de uma do presente.
  escrever(path.join(vault, 'Comece aqui.md'), 'Minha nota\n');
  escrever(path.join(vault, '2. ÁREAS', 'Minha loja.md'), 'Minha loja\n');
  const r = copiarCofre(ctx, vault);
  assert.strictEqual(fs.readFileSync(path.join(vault, 'Comece aqui.md'), 'utf8'), 'Minha nota\n');
  assert.ok(fs.existsSync(path.join(vault, '2. ÁREAS', 'Minha loja.md')));
  assert.ok(fs.existsSync(path.join(vault, 'CLAUDE', 'wiki', 'pessoas', 'Bia.md')));
  assert.ok(fs.existsSync(path.join(vault, 'CLAUDE', 'fontes', 'reuniões', '2026-10-22 Reunião.md')));
  assert.ok(fs.existsSync(path.join(vault, '.obsidian', 'snippets', 'elos.css')));
  assert.ok(!fs.existsSync(path.join(vault, '.DS_Store')) && !fs.existsSync(path.join(vault, '.git')));
  // Os JSONs do .obsidian não são copiados aqui: são mesclados depois.
  assert.ok(!fs.existsSync(path.join(vault, '.obsidian', 'appearance.json')));
  assert.strictEqual(r.mantidos, 1);
  assert.strictEqual(r.copiados, 5);
  // Uma vez só: o que a pessoa apagar depois não volta quando ela abre o Setuper de novo.
  fs.unlinkSync(path.join(vault, 'CLAUDE', 'wiki', 'pessoas', 'Bia.md'));
  assert.strictEqual(copiarCofre(ctx, vault).pulou, true);
  assert.ok(!fs.existsSync(path.join(vault, 'CLAUDE', 'wiki', 'pessoas', 'Bia.md')));
});

test('cofre: as páginas do presente prevalecem sobre os modelos em branco da wiki', async () => {
  const { copiarCofre } = await src('presente.js');
  const { montarWiki } = await src('modulos/wiki.js');
  const ctx = await ctxCom(pastaPresente());
  ctx.resp = { nome: 'Ana', perfil: 'empresario' };
  const vault = path.join(ctx.home, 'Documents', 'Segundo Cérebro');
  copiarCofre(ctx, vault);
  await montarWiki(ctx, vault);
  const w = path.join(vault, 'CLAUDE', 'wiki');
  assert.match(fs.readFileSync(path.join(w, 'Como trabalhar comigo.md'), 'utf8'), /do presente/);
  // O que o presente não trouxe vem do modelo, por cima.
  for (const f of ['SCHEMA.md', 'index.md', 'log.md', 'overview.md']) assert.ok(fs.existsSync(path.join(w, f)), f);
  assert.ok(fs.existsSync(path.join(vault, 'CLAUDE', 'inbox', 'README.md')));
  assert.ok(ctx.lerJson(path.join(vault, '.claude', 'settings.json'), {}).permissions.deny.length > 0);
});

test('.obsidian: o presente vence nas chaves em comum, o resto do módulo e da pessoa fica, e as listas somam', async () => {
  const { mesclarObsidian } = await src('presente.js');
  const ctx = await ctxCom(pastaPresente());
  const vault = path.join(ctx.home, 'Documents', 'Segundo Cérebro');
  const obs = path.join(vault, '.obsidian');
  // O que o módulo do Obsidian escreve (mais um snippet que a pessoa já tinha ligado).
  escrever(path.join(obs, 'appearance.json'), { theme: 'obsidian', baseFontSize: 16, accentColor: '#123456', showViewHeader: true, enabledCssSnippets: ['meu'] });
  assert.strictEqual(mesclarObsidian(ctx, vault), 2);
  const ap = ctx.lerJson(path.join(obs, 'appearance.json'));
  assert.strictEqual(ap.accentColor, '#c8873c');
  assert.strictEqual(ap.cssTheme, '');
  assert.strictEqual(ap.baseFontSize, 16);
  assert.strictEqual(ap.theme, 'obsidian');
  assert.deepStrictEqual(ap.enabledCssSnippets.sort(), ['elos', 'meu']);
  // graph.json não existia: entra o do presente inteiro.
  assert.strictEqual(ctx.lerJson(path.join(obs, 'graph.json')).colorGroups[0].query, 'path:CLAUDE/wiki');
  // Uma vez só: a pessoa muda a cor depois e ela fica.
  escrever(path.join(obs, 'appearance.json'), { ...ap, accentColor: '#00ff00' });
  assert.strictEqual(mesclarObsidian(ctx, vault), 0);
  assert.strictEqual(ctx.lerJson(path.join(obs, 'appearance.json')).accentColor, '#00ff00');
});

test('sem presente nada muda: nem cópia, nem mescla', async () => {
  const { copiarCofre, mesclarObsidian, presenteTemNotas } = await src('presente.js');
  const ctx = await ctxCom(undefined);
  const vault = path.join(ctx.home, 'Documents', 'Segundo Cérebro');
  assert.strictEqual(copiarCofre(ctx, vault).pulou, true);
  assert.strictEqual(mesclarObsidian(ctx, vault), 0);
  assert.strictEqual(presenteTemNotas(ctx, 'CLAUDE/padrões'), false);
  assert.ok(!fs.existsSync(vault));
});
