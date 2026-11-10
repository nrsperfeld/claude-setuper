// Caminho do Windows, testado a partir do Mac: tudo que dá pra conferir sem um Windows de verdade.
// O que só um PC físico confirma está em docs/windows-estado.md.
const { test } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const RAIZ = path.join(__dirname, '..');
const app = (arq) => import(pathToFileURL(path.join(RAIZ, 'app', arq)).href);
const src = (arq) => import(pathToFileURL(path.join(RAIZ, 'src', arq)).href);
const ler = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8');

test('o PATH do Windows não se parte no dois-pontos de C:\\ e ganha as pastas do que a instalação põe', async () => {
  const { pathDoWindows } = await app('windows.js');
  const saida = pathDoWindows({ PATH: 'C:\\Windows\\system32;C:\\Windows', ProgramFiles: 'C:\\Program Files', APPDATA: 'C:\\Users\\Zé\\AppData\\Roaming', USERPROFILE: 'C:\\Users\\Zé', LOCALAPPDATA: 'C:\\Users\\Zé\\AppData\\Local' }).split(';');
  assert.deepStrictEqual(saida.slice(0, 2), ['C:\\Windows\\system32', 'C:\\Windows']);
  for (const p of ['C:\\Program Files\\nodejs', 'C:\\Program Files\\Git\\cmd', 'C:\\Users\\Zé\\AppData\\Roaming\\npm', 'C:\\Users\\Zé\\.local\\bin']) assert.ok(saida.includes(p), p);
  // Maiúscula e minúscula são a mesma pasta no Windows: não repete.
  assert.strictEqual(pathDoWindows({ PATH: 'c:\\program files\\nodejs' }).toLowerCase().split('c:\\program files\\nodejs').length, 2);
});

test('o terminal invisível no Windows roda pelo cmd, sem janela e sem o pty.sh do Mac', async () => {
  const { comoRodar } = await app('terminal.js');
  const win = comoRodar('win32', 'gh', ['auth', 'login', '--hostname', 'github.com'], { A: '1' });
  assert.strictEqual(win.arquivo, 'cmd.exe');
  assert.deepStrictEqual(win.args, ['/d', '/s', '/c', '"gh auth login --hostname github.com"']);
  assert.strictEqual(win.opcoes.windowsHide, true);
  assert.strictEqual(win.opcoes.windowsVerbatimArguments, true);
  // Caminho com espaço entra entre aspas, dentro das aspas de fora do /s /c.
  assert.deepStrictEqual(comoRodar('win32', 'C:\\Program Files\\a b.cmd', ['x y'], {}).args[3], '""C:\\Program Files\\a b.cmd" "x y""');
  const mac = comoRodar('darwin', 'gh', ['auth'], {});
  assert.ok(mac.arquivo.endsWith('pty.sh'));
  assert.deepStrictEqual(mac.args, ['gh', 'auth']);
});

test('a aula no Windows não aponta pro painel do Maestri nem fala dele; no Mac continua igual', async () => {
  const { criarAula } = await app('aula.js');
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'setuper-aula-'));
  for (const [mac, appId, comSetas] of [[false, 'ia', false], [true, 'maestri', true]]) {
    let cena;
    const aula = criarAula({ claudeDir: pasta, pasta, t: (s) => s, mostrar: (c) => { cena = c; }, esconder() {}, aoTerminar() {}, respostas: () => ({ nome: 'Zé' }), mac });
    aula.redesenhar();
    assert.strictEqual(cena.appId, appId);
    for (let i = 0; i < 9; i++) {
      const p = cena.passos[0];
      assert.strictEqual(!!p.alvos?.length, comSetas && !p.fim, p.titulo);
      if (!mac) assert.ok(!/Maestri|Command|à esquerda/.test(JSON.stringify(p)), p.titulo);
      aula.acao('avancar');
      if (p.fim) break;
    }
    fs.rmSync(path.join(pasta, 'aula.json'), { force: true });
  }
});

test('setas: ligadas no Mac, desligadas no Windows até alguém ligar pra testar', async () => {
  const { setasDisponiveis, janelasDoWindows } = await app('setas.js');
  assert.strictEqual(setasDisponiveis('darwin', {}), true);
  assert.strictEqual(setasDisponiveis('win32', {}), false);
  assert.strictEqual(setasDisponiveis('win32', { CLAUDE_SETUPER_SETAS_WIN: '1' }), true);
  // Escala de 150%: os pixels reais são divididos antes de chegar no desenho.
  const tela = { screenToDipRect: (_j, r) => ({ x: r.x / 1.5, y: r.y / 1.5, width: r.width / 1.5, height: r.height / 1.5 }) };
  assert.deepStrictEqual(janelasDoWindows('chrome|12|0|0|1500|900;Obsidian|7|150|150|300|300;\r', tela), [
    { d: 'chrome', p: 12, b: { X: 0, Y: 0, Width: 1000, Height: 600 } },
    { d: 'Obsidian', p: 7, b: { X: 100, Y: 100, Width: 200, Height: 200 } },
  ]);
  assert.deepStrictEqual(janelasDoWindows('', tela), []);
});

test('dono da janela e comando claude-setuper no Windows', async () => {
  const { donoDoExecutavel, comandoDoSetuper, programasWindows } = await app('windows.js');
  assert.ok(donoDoExecutavel('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe').test('chrome'));
  assert.ok(donoDoExecutavel('C:\\x\\msedge.exe').test('MSEDGE'));
  assert.strictEqual(donoDoExecutavel(''), null);
  // Só ASCII e CRLF: o cmd lê o arquivo fora de UTF-8 e o nome da pasta do usuário pode ter acento.
  assert.match(comandoDoSetuper(), /^[\x00-\x7f]+$/);
  assert.match(comandoDoSetuper(), /%USERPROFILE%.*%\*\r\n$/);
  const p = programasWindows({ LOCALAPPDATA: 'C:\\Users\\Zé\\AppData\\Local', ProgramFiles: 'C:\\Program Files' }, (s) => s);
  assert.ok(p.obsidian.caminhos.includes('C:\\Users\\Zé\\AppData\\Local\\Programs\\Obsidian\\Obsidian.exe'));
  assert.strictEqual(p.ia.nome(), 'Janela da IA');
});

test('o winget avisa do UAC só no que pede licença, e fecha o aviso quando termina', async () => {
  const { winget } = await src('modulos/base.js');
  const { ui } = await src('ui.js');
  const originais = { pausa: ui.pausa, fimDaPausa: ui.fimDaPausa };
  const ordem = [];
  ui.pausa = (titulo, _l, o) => ordem.push(`pausa:${o.figura}`);
  ui.fimDaPausa = () => ordem.push('fim');
  const ctx = { app: true, run: async (cmd) => { ordem.push(cmd); return ''; } };
  try {
    await winget(ctx, 'Git.Git');
    assert.deepStrictEqual(ordem, ['pausa:windows-sim', 'winget', 'fim']);
    ordem.length = 0;
    await winget(ctx, 'Obsidian.Obsidian'); // instala só na conta da pessoa
    assert.deepStrictEqual(ordem, ['winget']);
    ordem.length = 0;
    await winget({ ...ctx, app: false }, 'Git.Git'); // no Terminal fica como era
    assert.deepStrictEqual(ordem, ['winget']);
  } finally { Object.assign(ui, originais); }
});

test('sem winget, o app guia pela Microsoft Store e para com uma frase, em vez de seguir sem instalar nada', async () => {
  const { instalar } = await src('modulos/base.js');
  const { ui } = await src('ui.js');
  const original = ui.confirmarFora;
  const guias = [];
  const abertos = [];
  ui.confirmarFora = async (g) => { guias.push(g); return true; };
  const ctx = { app: true, win: true, plataforma: 'win32', temAdiantado: () => false, existeComando: async () => false, abrirUrl: async (u) => abertos.push(u), run: async () => '' };
  try {
    await assert.rejects(instalar(ctx), /Instalador de Aplicativo/);
    assert.match(abertos[0], /^ms-windows-store:/);
    assert.strictEqual(guias.length, 1);
  } finally { ui.confirmarFora = original; }
});

test('instalação simulada no Windows: nada de comando de Mac, atalho com CRLF e sem abrir nada', () => {
  const casa = fs.mkdtempSync(path.join(os.tmpdir(), 'setuper-win-'));
  const r = spawnSync(process.execPath, [path.join(RAIZ, 'bin', 'claude-setuper.js'), '--plataforma', 'win32', '--sem-apps', '--sim', '--home', casa, '--perfil', 'dia-a-dia', '--idioma', 'pt'], { encoding: 'utf8', timeout: 60000 });
  assert.strictEqual(r.status, 0, r.stderr);
  const atalho = fs.readFileSync(path.join(casa, 'Desktop', 'Claude.cmd'), 'utf8');
  assert.match(atalho, /\r\n/);
  assert.doesNotMatch(atalho, /[^\r]\n/);
  const registro = fs.readFileSync(path.join(casa, 'Claude Setuper', 'registro.log'), 'utf8');
  assert.doesNotMatch(registro, /osascript|launchctl|\/Applications|plutil|\bsips\b|\$ open /);
  const estado = JSON.parse(fs.readFileSync(path.join(casa, 'Claude Setuper', 'estado.json'), 'utf8'));
  assert.ok(estado.modulos.atalho.ok);
  assert.ok(!('maestri' in estado.modulos));
});

test('todo arquivo que o main.js importa entra nos três builds, e o instalador é por usuário', async () => {
  const importados = [...ler('app/main.js').matchAll(/from '\.\/([\w-]+\.js)'/g)].map((m) => m[1]);
  assert.ok(importados.includes('windows.js'));
  for (const script of ['app/build.sh', 'app/build-presente.sh', 'app/build-win.sh']) {
    const linha = ler(script).split('\n').find((l) => l.includes('cp main.js'));
    for (const arq of importados) assert.ok(linha.includes(arq), `${script} não copia ${arq}`);
  }
  const { INSTALADOR } = await app('windows.js');
  assert.ok(ler('app/build-win.sh').includes(INSTALADOR));
  assert.match(ler('app/win/instalador.nsi'), /^RequestExecutionLevel user$/m);
  assert.ok(!ler('app/build-win.sh').split('\n').find((l) => l.includes('cp main.js')).includes('pty.sh'));
});

// O main.js de verdade, com um Electron de mentira: nenhuma janela abre e nada é instalado (--sem-apps numa casa de teste).
const temHooks = typeof require('node:module').registerHooks === 'function';
function simular(plataforma) {
  const casa = fs.mkdtempSync(path.join(os.tmpdir(), 'setuper-sim-'));
  const r = spawnSync(process.execPath, [path.join(__dirname, 'win-sim', 'rodar-main.mjs'), plataforma, casa], { encoding: 'utf8', timeout: 90000 });
  const linha = r.stdout.split('\n').find((l) => l.startsWith('@@'));
  assert.ok(linha, `o main.js não terminou: ${r.stderr.slice(-800)}`);
  return { casa, ...JSON.parse(linha.slice(2)) };
}

test('main.js no ramo do Windows: janela com moldura, instalação até o fim, atalho aberto e guia sem falar em setas', { skip: !temHooks, timeout: 120000 }, () => {
  const r = simular('win32');
  assert.deepStrictEqual(r.erros, []);
  assert.strictEqual(r.falha, undefined);
  assert.strictEqual(r.inicio.plataforma, 'win32');
  const [janela, guia] = r.janelas;
  assert.strictEqual(janela.titleBarStyle, undefined);
  assert.strictEqual(janela.autoHideMenuBar, true);
  assert.strictEqual(guia.focusable, false);
  assert.ok(r.fim, 'não chegou na conferência');
  assert.ok(r.path.split(';').includes('C:\\Windows\\system32'));
  // O fim do fluxo é o atalho da IA, e não o Maestri.
  assert.ok(r.abertos.length >= 1 && r.abertos.every((p) => p.endsWith(path.join('Desktop', 'Claude.cmd'))));
  const aula = r.guia.find((c) => c.aula);
  assert.strictEqual(aula.passos[0].app.nome, 'Janela da IA');
  assert.strictEqual(aula.passos[0].app.dica, '');
  assert.ok(!JSON.stringify(r.guia).includes('setas na tela'));
  // Sem o arquivo no release, a atualização cai na página de downloads, em vez de não fazer nada.
  assert.ok(r.externos.some((u) => u.endsWith('/releases/latest')));
  assert.ok(!fs.existsSync(path.join(r.casa, 'Claude Setuper', 'pedir-senha.sh')));
});

test('main.js no ramo do Mac continua igual: janela hiddenInset, sem nada do Windows', { skip: !temHooks, timeout: 120000 }, () => {
  const r = simular('darwin');
  assert.deepStrictEqual(r.erros, []);
  assert.strictEqual(r.inicio.plataforma, 'darwin');
  assert.strictEqual(r.janelas[0].titleBarStyle, 'hiddenInset');
  assert.strictEqual(r.janelas[0].useContentSize, undefined);
  assert.strictEqual(r.janelas[0].height, 640);
});
