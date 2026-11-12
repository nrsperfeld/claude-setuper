// Decisão do Nathan de 12/11/2026: GitHub e a IA no Chrome entram em toda instalação, e quando a IA abre pela
// primeira vez uma segunda janela confere tudo e instala o que estiver faltando (src/verificar.js, src/segundaJanela.js).
const { test } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const RAIZ = path.join(__dirname, '..');
const src = (arq) => import(pathToFileURL(path.join(RAIZ, 'src', arq)).href);
const casaNova = (nome) => fs.mkdtempSync(path.join(os.tmpdir(), `setuper-${nome}-`));
const BIN = path.join(RAIZ, 'bin', 'claude-setuper.js');

async function comUi(troca, fn) {
  const { ui } = await src('ui.js');
  const original = Object.fromEntries(Object.keys(troca).map((k) => [k, ui[k]]));
  Object.assign(ui, troca);
  try { return await fn(ui); } finally { Object.assign(ui, original); }
}

test('comSempre põe GitHub e Chrome em qualquer lista, na ordem em que rodam, sem repetir', async () => {
  const { comSempre, MODULOS } = await src('modulos/index.js');
  assert.deepStrictEqual(comSempre(['base', 'nucleo', 'obsidian']), ['base', 'nucleo', 'obsidian', 'github', 'chrome']);
  assert.deepStrictEqual(comSempre([]), ['github', 'chrome']);
  assert.deepStrictEqual(comSempre(), ['github', 'chrome']);
  const todos = MODULOS.map((m) => m.id);
  assert.deepStrictEqual(comSempre(todos), todos);
  assert.deepStrictEqual(comSempre(['maestri', 'chrome', 'base']), ['base', 'github', 'chrome', 'maestri']);
});

test('em todo perfil, com --sim, GitHub e Chrome estão nos passos (o estudante também)', async () => {
  const { criarCtx } = await src('ctx.js');
  const { wizard } = await src('wizard.js');
  for (const perfil of ['dia-a-dia', 'empresario', 'marketing', 'video', 'estudante', 'elos']) {
    for (const plataforma of ['darwin', 'win32', 'linux']) {
      const ctx = criarCtx({ home: casaNova('sempre'), semApps: true, sim: true, perfil, plataforma });
      const r = await wizard(ctx);
      assert.ok(r.modulos.includes('github') && r.modulos.includes('chrome'), `${perfil} ${plataforma}: ${r.modulos}`);
    }
  }
});

test('escolhendo item por item, GitHub e Chrome não aparecem pra desmarcar e entram do mesmo jeito', async () => {
  const { criarCtx } = await src('ctx.js');
  const { wizard } = await src('wizard.js');
  const ctx = criarCtx({ home: casaNova('sempre'), semApps: true, perfil: 'estudante', plataforma: 'darwin' });
  let oferecidos;
  await comUi({
    perguntar: async (msg) => (/anos/.test(msg) ? '20' : 'Ana'),
    escolher: async (_m, opcoes, o) => o?.padrao ?? opcoes[0].value,
    escolherVarios: async (msg, opcoes) => { if (/instalar/.test(msg)) { oferecidos = opcoes.map((x) => x.value); return ['obsidian']; } return []; },
    confirmar: async (msg) => !/instalar tudo/.test(msg), // "Quero escolher o que vai ser instalado"
    info() {}, ok() {}, linha() {},
  }, async () => {
    const r = await wizard(ctx);
    assert.ok(oferecidos.includes('obsidian') && oferecidos.includes('vercel'));
    assert.ok(!oferecidos.includes('github') && !oferecidos.includes('chrome') && !oferecidos.includes('base'), oferecidos.join());
    for (const id of ['base', 'obsidian', 'github', 'chrome']) assert.ok(r.modulos.includes(id), `${id}: ${r.modulos}`);
    assert.ok(!r.modulos.includes('vercel') && !r.modulos.includes('maestri'), r.modulos.join());
  });
});

test('respostas salvas por uma versão anterior, sem GitHub e Chrome, ganham os dois', async () => {
  const { criarCtx } = await src('ctx.js');
  const { wizard } = await src('wizard.js');
  const ctx = criarCtx({ home: casaNova('sempre'), semApps: true });
  ctx.estado.respostas = { nome: 'Ana', perfil: 'estudante', modulos: ['base', 'nucleo', 'obsidian'] };
  ctx.repetirDireto = true;
  const r = await wizard(ctx);
  assert.deepStrictEqual(r.modulos, ['base', 'nucleo', 'obsidian', 'github', 'chrome']);
});

test('presente com lista própria de passos também leva GitHub e Chrome', async () => {
  const { criarCtx } = await src('ctx.js');
  const { wizard } = await src('wizard.js');
  const pasta = casaNova('presente');
  fs.mkdirSync(path.join(pasta, 'cofre'));
  fs.writeFileSync(path.join(pasta, 'presente.json'), JSON.stringify({ versao: 1, para: { nome: 'Bia' }, vault: 'Segundo Cérebro', respostas: { perfil: 'empresario', modulos: ['obsidian'] } }));
  const ctx = criarCtx({ home: casaNova('sempre'), semApps: true, sim: true, presente: pasta, plataforma: 'darwin' });
  if (!ctx.presente) return; // o formato do presente é conferido em presente.test.cjs
  const r = await wizard(ctx);
  assert.ok(r.modulos.includes('github') && r.modulos.includes('chrome'), r.modulos.join());
});

test('instalação pelo comando: o estudante passa pelo GitHub e pelo Chrome; no app só a Vercel fica pro fim', async () => {
  const casa = casaNova('sempre');
  const r = spawnSync(process.execPath, [BIN, '--sem-apps', '--sim', '--home', casa, '--perfil', 'estudante', '--idioma', 'pt'], { encoding: 'utf8', timeout: 60000 });
  assert.strictEqual(r.status, 0, r.stderr);
  const estado = JSON.parse(fs.readFileSync(path.join(casa, 'Claude Setuper', 'estado.json'), 'utf8'));
  assert.ok(estado.modulos.github && estado.modulos.chrome, Object.keys(estado.modulos).join());
  assert.ok(!estado.modulos.vercel);
  assert.ok(!fs.existsSync(path.join(casa, 'Claude Setuper', '.instalando')), 'a trava da instalação ficou pra trás');
  const { OPCIONAIS_APP } = await src('cli.js');
  assert.deepStrictEqual(OPCIONAIS_APP, ['vercel']);
});

test('a pergunta do GitHub não tem mais como pular; sem login, o passo fica pendente sem quebrar a instalação', async () => {
  const github = await src('modulos/github.js');
  const casa = casaNova('github');
  let opcoes;
  const ctx = {
    app: true, plataforma: 'linux', home: casa, estado: { pulados: { github: true } }, pasta: (n) => n,
    existeComando: async () => true, run: async () => '', runVisivel: async () => 0, abrirUrl: async () => {},
  };
  await comUi({
    escolher: async (_m, o) => { opcoes = o.map((x) => x.value); return 'tenho'; },
    pausa() {}, pulou: () => true, pediuTentar: () => false, info() {}, ok() {},
  }, async () => {
    await assert.rejects(github.instalar(ctx), (e) => e.continuar === true);
  });
  assert.deepStrictEqual(opcoes, ['criar', 'tenho']);
  // Quem tinha pulado numa versão anterior volta a ser conferido.
  assert.ok(!('github' in ctx.estado.pulados));
  const itens = await github.verificar({ ...ctx, estado: { pulados: { github: true } }, existeComando: async () => false });
  assert.ok(itens.length >= 3 && itens.some((i) => !i.ok));
});

test('no app o Chrome instala sem perguntar e já pede a extensão, em vez de deixar pro fim da aula', async () => {
  const chrome = await src('modulos/chrome.js');
  const casa = casaNova('chrome');
  const pedidos = [];
  let instalou = false;
  const ctx = {
    app: true, plataforma: 'linux', home: casa, estado: {},
    existeComando: async () => instalou, existe: () => false, esperar: async () => true,
    run: async () => '', runVisivel: async () => { instalou = true; return 0; },
  };
  await comUi({
    confirmar: async (msg) => { throw new Error(`não devia perguntar: ${msg}`); },
    tarefa: async (_a, _b, fn) => fn(() => {}),
    pausa: (titulo) => pedidos.push(titulo), pulou: () => true, info() {}, ok() {}, aviso() {},
  }, async () => {
    await chrome.instalar(ctx);
  });
  assert.ok(instalou);
  assert.deepStrictEqual(pedidos, ['Clica em Usar no Chrome']);
});

// ---------- a conferência que conserta ----------
function moduloDeMentira(id, { falta = false, conserta = true, quebra = false } = {}) {
  const m = {
    id, nome: `Passo ${id}`, nomeCurto: id, conferencias: 0, instalacoes: 0,
    async verificar() { m.conferencias++; return [{ item: `item de ${id}`, ok: !falta, dica: 'dica' }]; },
    async instalar(ctx) {
      m.instalacoes++;
      m.ctx = { resp: ctx.resp, conferindo: ctx.conferindo };
      if (quebra) throw new Error('quebrou');
      if (conserta) falta = false;
    },
  };
  return m;
}
async function ctxInstalado(extra = {}) {
  const { criarCtx } = await src('ctx.js');
  const ctx = criarCtx({ home: casaNova('verificar'), semApps: true, plataforma: 'linux', ...extra });
  ctx.estado.respostas = { nome: 'Ana', perfil: 'dia-a-dia', modulos: ['base'] };
  return ctx;
}
const calado = async (fn) => {
  const original = console.log;
  console.log = () => {};
  try { return await comUi({ abertura() {}, encerramento() {}, passo() {}, aviso() {}, erro() {}, info() {}, ok() {}, linha() {} }, fn); } finally { console.log = original; }
};

test('verificar: com tudo no lugar, não chama instalador nenhum', async () => {
  const { verificar } = await src('verificar.js');
  const ctx = await ctxInstalado();
  const modulos = [moduloDeMentira('a'), moduloDeMentira('b')];
  const r = await calado(() => verificar(ctx, { modulos }));
  assert.deepStrictEqual(r, { faltando: 0, consertados: [], pendentes: [] });
  assert.deepStrictEqual(modulos.map((m) => m.instalacoes), [0, 0]);
  assert.deepStrictEqual(modulos.map((m) => m.conferencias), [1, 1]);
});

test('verificar: instala só o que falta, com as respostas da pessoa, confere de novo e guarda o estado', async () => {
  const { verificar } = await src('verificar.js');
  const ctx = await ctxInstalado();
  const [ok, falta, depende, quebra] = [moduloDeMentira('ok'), moduloDeMentira('falta', { falta: true }), moduloDeMentira('depende', { falta: true, conserta: false }), moduloDeMentira('quebra', { falta: true, quebra: true })];
  const r = await calado(() => verificar(ctx, { modulos: [ok, falta, depende, quebra] }));
  assert.deepStrictEqual([ok, falta, depende, quebra].map((m) => m.instalacoes), [0, 1, 1, 1]);
  assert.deepStrictEqual(r.consertados, ['falta']);
  assert.deepStrictEqual(r.pendentes, ['depende', 'quebra']);
  assert.strictEqual(r.faltando, 2);
  assert.strictEqual(falta.conferencias, 2);
  assert.strictEqual(ok.conferencias, 1);
  assert.deepStrictEqual(falta.ctx, { resp: ctx.estado.respostas, conferindo: true });
  const salvo = JSON.parse(fs.readFileSync(ctx.estadoPath, 'utf8')).modulos;
  assert.strictEqual(salvo.falta.ok, true);
  assert.strictEqual(salvo.quebra.ok, false);
  // Rodar de novo é seguro: o que foi consertado não é instalado outra vez.
  await calado(() => verificar(ctx, { modulos: [ok, falta] }));
  assert.strictEqual(falta.instalacoes, 1);
});

test('verificar: em --dry-run e sem instalação nenhuma, não instala nada', async () => {
  const { verificar } = await src('verificar.js');
  const falta = moduloDeMentira('falta', { falta: true });
  const teste = await ctxInstalado({ dryRun: true });
  assert.deepStrictEqual((await calado(() => verificar(teste, { modulos: [falta] }))).pendentes, ['falta']);
  const { criarCtx } = await src('ctx.js');
  const vazio = criarCtx({ home: casaNova('verificar'), semApps: true });
  assert.strictEqual((await calado(() => verificar(vazio, { modulos: [falta] }))).semInstalacao, true);
  assert.strictEqual(falta.instalacoes, 0);
});

test('verificar na segunda janela do Windows: com coisa faltando, pede pra janela abrir na frente antes de consertar', async () => {
  const { verificar, SAIDA_REABRIR } = await src('verificar.js');
  const ctx = await ctxInstalado({ plataforma: 'win32' });
  const falta = moduloDeMentira('falta', { falta: true });
  const r = await calado(() => verificar(ctx, { modulos: [falta], segundaJanela: true }));
  assert.strictEqual(r.reabrir, true);
  assert.strictEqual(falta.instalacoes, 0);
  assert.strictEqual(SAIDA_REABRIR, 3);
  assert.match(fs.readFileSync(path.join(RAIZ, 'templates', 'verificar', 'verificar.cmd'), 'utf8'), /if errorlevel 3 if not errorlevel 4 goto reabrir/);
});

test('a conferência e o doctor olham GitHub e Chrome mesmo em instalação antiga que não tinha os dois', async () => {
  const { modulosInstalados } = await src('modulos/index.js');
  const ids = (estado, plataforma = 'darwin') => modulosInstalados({ estado, plataforma }).map((m) => m.id);
  assert.deepStrictEqual(ids({ modulos: { base: { ok: true }, nucleo: { ok: true }, obsidian: { ok: false } }, respostas: { modulos: ['base', 'nucleo', 'obsidian', 'vercel'] } }), ['base', 'nucleo', 'obsidian', 'github', 'chrome']);
  assert.ok(!ids({ modulos: { base: {}, maestri: {} } }, 'win32').includes('maestri'));
  assert.ok(ids({ modulos: {} }).includes('maestri'));
});

test('claude-setuper verificar existe como comando e como npm run verificar', () => {
  const casa = casaNova('verificar');
  const instalou = spawnSync(process.execPath, [BIN, '--sem-apps', '--sim', '--home', casa, '--perfil', 'dia-a-dia', '--plataforma', 'linux', '--idioma', 'pt'], { encoding: 'utf8', timeout: 60000 });
  assert.strictEqual(instalou.status, 0, instalou.stderr);
  const r = spawnSync(process.execPath, [BIN, 'verificar', '--dry-run', '--home', casa, '--plataforma', 'linux'], { encoding: 'utf8', timeout: 60000 });
  assert.strictEqual(r.status, 0, r.stderr);
  assert.match(r.stdout, /CLAUDE\.md global/);
  assert.match(r.stdout, /GitHub CLI/);
  assert.match(r.stdout, /Google Chrome/);
  assert.strictEqual(JSON.parse(fs.readFileSync(path.join(RAIZ, 'package.json'), 'utf8')).scripts.verificar, 'node bin/claude-setuper.js verificar');
});

// ---------- a segunda janela ----------
test('o script que abre a IA dispara a conferência só na primeira vez, sem segurar a IA, nos três sistemas', async () => {
  const { criarCtx } = await src('ctx.js');
  const { escreverConferencia } = await src('segundaJanela.js');
  const atalho = await src('modulos/atalho.js');
  const { montarWorkspace } = await src('modulos/maestri.js');
  const RESP = { nome: 'Ana', perfil: 'dia-a-dia', tecnologia: 'basico', ia: 'chat', trabalho: '', modulos: ['base'] };

  // Mac: o abrir-claude.sh do Maestri.
  const mac = criarCtx({ home: casaNova('janela'), plataforma: 'darwin' });
  mac.resp = RESP;
  montarWorkspace(mac);
  const conferenciaMac = path.join(mac.pastaSetuper, 'verificar.command');
  const abrir = fs.readFileSync(path.join(mac.pastaSetuper, 'abrir-claude.sh'), 'utf8').split('\n');
  const iSe = abrir.findIndex((l) => l.includes('if [ ! -f "$MARCADOR" ]'));
  const iJanela = abrir.findIndex((l) => l.includes(`/bin/bash "${conferenciaMac}" --janela`));
  const iSenao = abrir.findIndex((l) => l.trim() === 'else');
  assert.ok(iSe < iJanela && iJanela < iSenao, 'a conferência tem de ficar dentro do ramo da primeira vez');
  assert.ok(iJanela < abrir.findIndex((l) => l.includes('exec claude "')), 'e antes de a IA abrir');
  assert.match(abrir[iJanela], /&$/, 'em segundo plano, pra não atrasar a apresentação');
  const script = fs.readFileSync(conferenciaMac, 'utf8');
  assert.ok(fs.statSync(conferenciaMac).mode & 0o100, 'o Terminal só roda .command executável');
  assert.match(script, /open -g -a Terminal "\$EU"/);
  assert.ok(!script.split('\n').some((l) => !l.trim().startsWith('#') && l.includes('osascript')), 'osascript pediria a permissão de controlar o Terminal');
  // Rodando do repositório, o comando é o deste repositório; no app, a cópia em ~/Claude Setuper/app.
  assert.ok(script.includes(`node "${BIN}" verificar --segunda-janela --home "${mac.home}"`), script);
  const noApp = criarCtx({ home: casaNova('janela'), plataforma: 'darwin', app: true });
  assert.ok(fs.readFileSync(escreverConferencia(noApp), 'utf8').includes(`"${path.join(noApp.pastaSetuper, 'app', 'bin', 'claude-setuper.js')}"`));

  // Windows e Linux: o atalho da Área de Trabalho.
  await calado(async () => {
    for (const [plataforma, arquivo, gatilho] of [['win32', 'Claude.cmd', /^if exist "(.+verificar\.cmd)" start "Claude Setuper" \/min cmd \/c ""\1""$/], ['linux', 'Claude.sh', /^\s*\[ -f "(.+verificar\.sh)" \] && \/bin\/bash "\1" --janela >\/dev\/null 2>&1 &$/]]) {
      const ctx = criarCtx({ home: casaNova('janela'), plataforma, semApps: true });
      ctx.resp = RESP;
      const { ui } = await src('ui.js');
      ui.tarefa = async (_a, _b, fn) => fn(() => {});
      await atalho.instalar(ctx);
      const linhas = fs.readFileSync(path.join(ctx.home, 'Desktop', arquivo), 'utf8').split(/\r?\n/);
      const i = linhas.findIndex((l) => gatilho.test(l));
      assert.ok(i > 0, `${arquivo}: ${linhas.join('|')}`);
      assert.ok(i < linhas.findIndex((l) => /^\s*claude "/.test(l)), arquivo);
      assert.ok(i > linhas.findIndex((l) => /MARCADOR/.test(l) && /if /.test(l)), arquivo);
      assert.ok(fs.existsSync(linhas[i].match(gatilho)[1]), 'o script da conferência tem de existir');
    }
  });
});

test('a conferência da segunda janela espera a instalação em andamento e roda o comando verificar', { skip: process.platform === 'win32' }, async () => {
  const { criarCtx } = await src('ctx.js');
  const { escreverConferencia, travar } = await src('segundaJanela.js');
  const ctx = criarCtx({ home: casaNova('janela'), plataforma: 'linux' });
  const arquivo = escreverConferencia(ctx);
  const rodar = () => spawnSync('/bin/bash', [arquivo], { encoding: 'utf8', timeout: 60000, input: '\n' });
  // Trava de um processo que já morreu não segura nada.
  fs.writeFileSync(path.join(ctx.pastaSetuper, '.instalando'), '999999999');
  const semInstalacao = rodar();
  assert.strictEqual(semInstalacao.status, 0, semInstalacao.stderr);
  assert.match(semInstalacao.stdout, /Ainda não tem instalação/);
  assert.doesNotMatch(semInstalacao.stdout, /Esperando a instalação/);
  // Com a instalação viva, espera; quando ela solta a trava, segue.
  const soltar = travar(ctx);
  setTimeout(soltar, 1500);
  const { spawn } = require('node:child_process');
  const saida = await new Promise((res) => {
    let txt = '';
    const p = spawn('/bin/bash', [arquivo], { stdio: ['pipe', 'pipe', 'ignore'] });
    p.stdout.on('data', (d) => { txt += d; });
    p.on('close', () => res(txt));
    p.stdin.end('\n');
  });
  assert.match(saida, /Esperando a instalação terminar/);
  assert.match(saida, /Ainda não tem instalação/);
});
