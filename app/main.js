// App do Claude Setuper: a mesma instalação do Terminal (src/), com telas no lugar do texto.
// Desenho em docs/superpowers/specs/2026-11-07-redesenho-experiencia-design.md.
import { app, BrowserWindow, ipcMain, shell, clipboard, dialog, nativeTheme, nativeImage, Menu, screen } from 'electron';
import { spawn, execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { criarUiApp } from './ui-app.js';
import { criarTerminal } from './terminal.js';
import { criarAula } from './aula.js';
import { criarSetas, setasDisponiveis } from './setas.js';
import { INSTALADOR, pathDoWindows, programasWindows, donoDoExecutavel, comandoDoSetuper } from './windows.js';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
// Empacotado, o Setuper vem dentro do app (setuper/); rodando do repositório, é a pasta de cima.
const SETUPER = fs.existsSync(path.join(AQUI, 'setuper', 'src')) ? path.join(AQUI, 'setuper') : path.join(AQUI, '..');
const REPO = process.env.CLAUDE_SETUPER_REPO || 'nrsperfeld/claude-setuper';
const VERSAO = JSON.parse(fs.readFileSync(path.join(SETUPER, 'package.json'), 'utf8')).version;
const argumento = (nome) => { const i = process.argv.indexOf(nome); return i > 0 ? process.argv[i + 1] : ''; };
// --home só pra testar sem tocar na casa de verdade (como no Terminal): respostas, estado e cofre ficam lá.
const HOME_TESTE = argumento('--home') ? path.resolve(argumento('--home')) : '';
const HOME = HOME_TESTE || os.homedir();
const PASTA = path.join(HOME, 'Claude Setuper');
const CLAUDE_DIR = path.join(HOME, '.claude');
// Modo presente: um segundo cérebro pronto dentro do app (Contents/Resources/presente) ou apontado por --presente.
const PRESENTE = (() => {
  const dir = argumento('--presente') || process.env.CLAUDE_SETUPER_PRESENTE || path.join(process.resourcesPath || '', 'presente');
  return fs.existsSync(path.join(dir, 'presente.json')) ? path.resolve(dir) : '';
})();
const NOME_APP = PRESENTE ? 'Segundo Cérebro' : 'Claude Setuper';
const NO_WINDOWS = process.platform === 'win32';
// Qual programa cada ação pede, pra mostrar o ícone dele no guia e apontar a seta pra janela dele.
const PROGRAMAS = {
  apple: { nome: () => i18n.t('Instalador da Apple'), caminho: '/System/Library/CoreServices/Install Command Line Developer Tools.app', pgrep: 'Install Command Line Developer Tools' },
  // A janela de senha é do osascript, que não tem ícone na barra de ícones: sem achar a janela, a seta não aponta pra lá.
  senha: { nome: () => i18n.t('Janela de senha'), proprio: true, dono: /^osascript$/ },
  navegador: { navegador: true },
  chrome: { nome: () => 'Google Chrome', caminho: '/Applications/Google Chrome.app', dono: /^Google Chrome$/ },
  obsidian: { nome: () => 'Obsidian', caminho: '/Applications/Obsidian.app', dono: /^Obsidian$/ },
  maestri: { nome: () => 'Maestri', caminhos: ['/Applications/Maestri.app', '/Applications/Setapp/Maestri.app'], dono: /^Maestri$/ },
  ...(NO_WINDOWS ? programasWindows(process.env, (s) => i18n.t(s)) : {}),
};
// Pra onde apontar em cada janela conhecida. x e y são a proporção da janela; o texto diz o que fazer ali.
const POR_FIGURA = {
  'apple-ferramentas': { programa: 'apple', alvos: [{ x: 0.86, y: 0.84, rotulo: 'Clica em Instalar' }] },
  'apple-contrato': { programa: 'apple', alvos: [{ x: 0.9, y: 0.92, rotulo: 'Clica em Concordo' }] },
  senha: { programa: 'senha', alvos: [{ x: 0.5, y: 0.62, rotulo: 'Digita a senha aqui' }] },
  'claude-login': { programa: 'navegador', alvos: [{ x: 0.5, y: 0.45, rotulo: 'Entra na sua conta aqui' }] },
  'obsidian-confiar': { programa: 'obsidian', alvos: [{ x: 0.5, y: 0.56, rotulo: 'Clica em Trust author and enable plugins' }] },
  'chrome-extensao': { programa: 'chrome', alvos: [{ x: 0.8, y: 0.3, rotulo: 'Clica em Usar no Chrome' }] },
  'github-criar': { programa: 'navegador', alvos: [{ x: 0.5, y: 0.42, rotulo: 'Cria a sua conta aqui' }] },
  'github-codigo': { programa: 'navegador', alvos: [{ x: 0.5, y: 0.42, rotulo: 'Cola o código aqui' }] },
  vercel: { programa: 'navegador', alvos: [{ x: 0.5, y: 0.42, rotulo: 'Entra aqui' }] },
  conectores: { programa: 'navegador', alvos: [{ x: 0.5, y: 0.42, rotulo: 'Clica em Conectar aqui' }] },
};
// O ícone de verdade do programa, lido do próprio app. (app.getFileIcon derruba o Electron 44 no Mac.)
const rodar = (cmd, args) => new Promise((res) => execFile(cmd, args, { timeout: 8000 }, (erro, saida) => res(erro ? '' : String(saida).trim())));
async function iconeDoApp(caminho) {
  if (!caminho || !fs.existsSync(caminho)) return '';
  if (NO_WINDOWS) { try { return (await app.getFileIcon(caminho, { size: 'large' })).toDataURL(); } catch { return ''; } }
  if (process.platform !== 'darwin') return '';
  let nome = await rodar('/usr/bin/plutil', ['-extract', 'CFBundleIconFile', 'raw', path.join(caminho, 'Contents', 'Info.plist')]);
  if (!nome) return '';
  if (!nome.endsWith('.icns')) nome += '.icns';
  const icns = path.join(caminho, 'Contents', 'Resources', nome);
  if (!fs.existsSync(icns)) return '';
  const saida = path.join(os.tmpdir(), `setuper-icone-${process.pid}-${path.basename(caminho, '.app').replace(/\W/g, '')}.png`);
  await rodar('/usr/bin/sips', ['-s', 'format', 'png', '-Z', '104', icns, '--out', saida]);
  try { const dados = fs.readFileSync(saida); fs.rmSync(saida, { force: true }); return `data:image/png;base64,${dados.toString('base64')}`; } catch { return ''; }
}
const icones = new Map();
const buscando = new Map(); // dois passos do mesmo programa não leem o ícone ao mesmo tempo
function dadosDoPrograma(id) {
  if (icones.has(id)) return Promise.resolve(icones.get(id));
  if (!buscando.has(id)) buscando.set(id, lerDadosDoPrograma(id).finally(() => buscando.delete(id)));
  return buscando.get(id);
}
async function lerDadosDoPrograma(id) {
  const p = PROGRAMAS[id];
  const dados = { nome: p.nome ? p.nome() : '', icone: '', dono: p.dono, pgrep: p.pgrep, caminho: p.caminho || p.caminhos?.find((c) => fs.existsSync(c)) || '', semDock: !!p.proprio };
  try {
    if (p.navegador) {
      const info = await app.getApplicationInfoForProtocol('https://example.com');
      dados.nome = info.name.replace(/\.app$/, '');
      dados.caminho = info.path;
      dados.icone = (await iconeDoApp(info.path)) || info.icon?.toDataURL() || '';
      dados.dono = NO_WINDOWS ? donoDoExecutavel(info.path) : new RegExp(`^${dados.nome.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
    } else if (p.proprio) {
      dados.icone = nativeImage.createFromPath(path.join(AQUI, 'tela', 'icone.png')).resize({ width: 104, height: 104 }).toDataURL();
    } else {
      dados.icone = await iconeDoApp(p.caminho || p.caminhos.find((c) => fs.existsSync(c)));
    }
  } catch {}
  // Programa recém-instalado: tenta o ícone de novo na próxima vez.
  if (dados.icone) icones.set(id, dados);
  return dados;
}
// Completa a cena do guia: ícone do programa em cada passo e, pra cada passo, as setas.
async function completarCena(cena) {
  cena.passos = await Promise.all(cena.passos.map(async (p) => {
    const fig = POR_FIGURA[p.figura];
    const id = p.programa || fig?.programa || cena.appId;
    if (!id) return p;
    const d = await dadosDoPrograma(id);
    const lista = p.alvos || fig?.alvos || [];
    return { ...p, app: { nome: d.nome, icone: d.icone, dica: lista.length && setasDisponiveis() ? i18n.t('As setas na tela mostram onde olhar') : '' }, setas: lista.map((a) => ({ ...a, rotulo: i18n.t(a.rotulo), dono: d.dono, pgrep: d.pgrep, caminho: d.caminho, icone: d.icone, semDock: d.semDock })) };
  }));
  return cena;
}
function apontarPasso() {
  if (!setas) return undefined;
  const p = cenaGuia?.passos?.[Math.min(passoAtual, (cenaGuia.passos.length || 1) - 1)];
  return setas.mostrar(p?.setas || []);
}

const flagsBase = () => ({ app: true, idioma: i18n.idiomaAtual(), ...(HOME_TESTE ? { home: HOME_TESTE } : {}), ...(NO_WINDOWS && !HOME_TESTE ? { desktop: app.getPath('desktop') } : {}), ...(PRESENTE ? { presente: PRESENTE } : {}) });
const TESTE = lerJson(path.join(PASTA, '.teste-auto.json')); // só existe nos testes da VM
const SO_AULA = process.argv.includes('--aula'); // aberto pelo Maestri pra continuar a aula

// Aberto pelo Finder, o app herda um PATH mínimo; sem isso não acha brew, node, claude, gh.
if (NO_WINDOWS) process.env.PATH = pathDoWindows(process.env);
else process.env.PATH = [...new Set([
  '/opt/homebrew/bin', '/opt/homebrew/sbin', '/usr/local/bin', path.join(os.homedir(), '.local', 'bin'), path.join(os.homedir(), '.local', 'node', 'bin'),
  ...(process.env.PATH || '').split(':').filter(Boolean), '/usr/bin', '/bin', '/usr/sbin', '/sbin',
])].join(':');
process.env.LANG ||= 'pt_BR.UTF-8';
// Nos testes da VM os logins esperam só uns segundos (não tem pessoa pra fazer o login).
if (TESTE?.esperaMax) process.env.CLAUDE_SETUPER_ESPERA_MAX = String(TESTE.esperaMax);

const perfil = argumento('--perfil');
const semApps = process.argv.includes('--sem-apps'); // só pra testar as telas sem instalar nada
let janela;
let guia = null;
let guiaProntoJa = false;
let cenaGuia = null;
let rodando = false;
let emOpcional = false;
const pendentes = new Map();
let proximoPedido = 0;
let i18n = { t: (s) => s, catalogoAtual: () => ({}), idiomaAtual: () => 'pt' };
let aula = null;
let setas = null;
let passoAtual = 0;
let minimizamos = false;

function lerJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

// ---------- idioma ----------
const arqIdioma = () => path.join(PASTA, 'idioma.txt');
function idiomaInicial() {
  const dito = argumento('--idioma');
  if (dito) return dito;
  try { return fs.readFileSync(arqIdioma(), 'utf8').trim(); } catch {}
  return (app.getLocale() || 'pt').toLowerCase().startsWith('pt') ? 'pt' : 'en';
}
function escolherIdioma(id) {
  i18n.definirIdioma(id);
  fs.mkdirSync(PASTA, { recursive: true });
  fs.writeFileSync(arqIdioma(), i18n.idiomaAtual());
}

// ---------- eventos para a janela e para o guia ----------
function enviar(ev) {
  if (TESTE) fs.appendFileSync(path.join(PASTA, 'registro.log'), `[evento] ${JSON.stringify(ev).slice(0, 160)}\n`);
  if (janela && !janela.isDestroyed()) janela.webContents.send('ui', ev);
  aoEventoDoGuia(ev);
}
function aoEventoDoGuia(ev) {
  if (ev.tipo === 'pausa') {
    if (ev.espera) return esconderGuia();
    return mostrarGuia({ rotulo: ev.rotulo || i18n.t('Sua vez'), contagem: ev.opcional ? i18n.t('Opcional') : '', passos: [{ titulo: ev.titulo, linhas: ev.linhas, figura: ev.figura, print: printDe(ev.figura) }], acoes: ev.acoes, pular: ev.pular });
  }
  if (ev.tipo === 'colar-codigo') {
    if (!cenaGuia) return;
    cenaGuia.colar = ev.ativo;
    return mandarAoGuia(ev);
  }
  if (ev.tipo === 'link' || ev.tipo === 'codigo') {
    if (!cenaGuia) return;
    if (ev.tipo === 'link') cenaGuia.link = ev.url; else cenaGuia.codigo = ev.codigo;
    return mandarAoGuia(ev);
  }
  if (ev.tipo === 'msg') {
    if (ev.nivel === 'info') { if (cenaGuia && !cenaGuia.aula) mandarAoGuia({ tipo: 'status', texto: ev.texto }); return; }
    if (cenaGuia && !cenaGuia.aula && !cenaGuia.id) esconderGuia();
    return;
  }
  if (ev.tipo === 'fimpausa' && cenaGuia && !cenaGuia.aula && !cenaGuia.id) return esconderGuia();
  if ((ev.tipo === 'passo' || ev.tipo === 'fim' || ev.tipo === 'falha') && cenaGuia && !cenaGuia.aula) esconderGuia();
}
// Print real da janela, se já existir para este idioma.
function printDe(figura) {
  if (!figura) return '';
  const p = path.join(AQUI, 'tela', 'prints', i18n.idiomaAtual(), `${figura}.png`);
  return fs.existsSync(p) ? pathToFileURL(p).href : '';
}
function criarGuia() {
  if (guia && !guia.isDestroyed()) return guia;
  const area = screen.getPrimaryDisplay().workArea;
  guia = new BrowserWindow({
    width: 340, height: 420, x: area.x + area.width - 340 - 24, y: area.y + 24,
    frame: false, resizable: false, minimizable: false, maximizable: false, fullscreenable: false, skipTaskbar: true, show: false,
    alwaysOnTop: true, backgroundColor: '#1B1B25', hasShadow: true, roundedCorners: true, title: NOME_APP,
    ...(process.platform === 'darwin' ? { type: 'panel' } : {}),
    // No Windows o clique no guia não tira o foco da janela da IA, que é onde a pessoa digita em seguida.
    ...(NO_WINDOWS ? { focusable: false } : {}),
    webPreferences: { preload: path.join(AQUI, 'preload.cjs'), contextIsolation: true, sandbox: true, backgroundThrottling: false },
  });
  // Fica na frente de tudo, em qualquer mesa e também sobre app em tela cheia.
  guia.setAlwaysOnTop(true, 'pop-up-menu'); // acima das setas
  guia.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true, skipTransformProcessType: true });
  guiaProntoJa = false;
  guia.loadFile(path.join(AQUI, 'tela', 'guia.html'));
  guia.on('closed', () => { guia = null; });
  return guia;
}
// O que vai pro guia não leva as setas: elas têm expressões regulares e ficam só aqui.
const semSetas = (cena) => ({ ...cena, passos: cena.passos.map(({ setas: _s, ...p }) => p) });
function mandarAoGuia(ev) {
  if (guia && !guia.isDestroyed() && guiaProntoJa) guia.webContents.send('guia', { ...ev, ...(ev.cena ? { cena: semSetas(ev.cena) } : {}), catalogo: i18n.catalogoAtual(), nomeApp: NOME_APP });
}
// Pergunta aberta na janela principal (as do guia não contam).
const perguntaNaTela = () => [...pendentes.keys()].some((id) => id !== cenaGuia?.id);
let guiaAdiado = false;
async function mostrarGuia(cena) {
  const pedida = cena;
  cenaGuia = cena;
  passoAtual = 0;
  await completarCena(cena);
  if (cenaGuia !== pedida) return; // outra cena já entrou no lugar
  // O guia fica na frente de tudo. Com uma pergunta aberta na janela principal, ele espera a resposta em vez de
  // aparecer por cima dela (feedback do Nathan, 10/11/2026: o cartão da senha tapava o questionário).
  guiaAdiado = !cena.id && !cena.aula && perguntaNaTela();
  if (guiaAdiado) return;
  if (!TESTE && !cena.aula && !process.argv.includes('--demo-telas')) shell.beep(); // a pessoa pode estar fazendo outra coisa
  criarGuia();
  if (guiaProntoJa) mandarAoGuia({ tipo: 'cena', cena });
  // O guia só aparece desenhado e já no canto certo: nada de retângulo vazio nem de pulo.
  await Promise.race([apontarPasso(), new Promise((r) => setTimeout(r, 1200))]);
  await new Promise((r) => setTimeout(r, guiaProntoJa ? 120 : 500));
  if (cenaGuia === pedida && guia && !guia.isDestroyed()) guia.showInactive();
}
function esconderGuia() {
  cenaGuia = null;
  guiaAdiado = false;
  setas?.esconder();
  if (guia && !guia.isDestroyed()) guia.hide();
  if (minimizamos && janela && !janela.isDestroyed() && !aula) { minimizamos = false; janela.restore(); }
}
function criarVidro() {
  setas = criarSetas({
    BrowserWindow, screen, aqui: AQUI, t: i18n.t, janelaGuia: () => (guia && !guia.isDestroyed() ? guia : null),
    // Troca o guia de canto quando ele está em cima do que a pessoa tem que clicar.
    moverGuia: () => { const a = screen.getPrimaryDisplay().workArea; const b = guia.getBounds(); guia.setPosition(b.x > a.x + a.width / 2 ? a.x + 24 : a.x + a.width - b.width - 24, b.y); },
    // A nossa janela não fica na frente do que a pessoa tem que clicar, a não ser que esteja respondendo uma pergunta.
    aoSerCoberto: () => { if (janela && !janela.isDestroyed() && janela.isVisible() && ![...pendentes.keys()].some((id) => id !== cenaGuia?.id)) { minimizamos = true; janela.minimize(); } },
  });
}

function pedir(pergunta) {
  const id = ++proximoPedido;
  return new Promise((resolver) => {
    pendentes.set(id, resolver);
    if (pergunta.tipo === 'fora') {
      // Ação fora do app: fica no guia até a pessoa responder, e a janela principal diz pra olhar pra ele.
      mostrarGuia({ id, rotulo: pergunta.rotulo || i18n.t('Sua vez'), passos: pergunta.passos.map((p) => ({ ...p, print: printDe(p.figura) })), concluir: pergunta.concluir, nao: pergunta.nao });
      enviar({ tipo: 'pausa-fora', titulo: pergunta.passos[0]?.titulo || '' });
      // Nos testes da VM ninguém clica: responde sozinho, como a pessoa faria.
      if (TESTE) setTimeout(() => responderPedido(id, true), 3000);
      return;
    }
    if (emOpcional) janela?.show();
    enviar({ tipo: 'pedido', id, pergunta });
  });
}
function responderPedido(id, valor) {
  const r = pendentes.get(id);
  if (!r) return;
  pendentes.delete(id);
  if (cenaGuia?.id === id) { esconderGuia(); enviar({ tipo: 'fimpausa' }); }
  enviar({ tipo: 'fimpedido', id });
  if (emOpcional) { janela?.hide(); if (aula) aula.redesenhar(); }
  r(valor);
  if (guiaAdiado && cenaGuia && !perguntaNaTela()) mostrarGuia(cenaGuia);
}

// Janela nativa pedindo a senha do computador, usada pelo sudo do instalador do Homebrew (SUDO_ASKPASS).
// Enquanto a janela está aberta, existe o arquivo pedir-senha.sh.aberta (marcaDaSenha, em src/modulos/base.js):
// é por ele que o app sabe a hora de mostrar o cartão da senha, e de tirar.
function criarAskpass() {
  fs.mkdirSync(PASTA, { recursive: true });
  const arquivo = path.join(PASTA, 'pedir-senha.sh');
  const marca = `${arquivo}.aberta`;
  fs.rmSync(marca, { force: true }); // sobra de uma janela que não fechou direito (app fechado no meio)
  const teste = path.join(PASTA, '.teste-auto.json');
  const texto = i18n.t('O {app} precisa da senha do seu computador pra instalar as ferramentas de base. É a senha que você digita na tela de bloqueio, pra desbloquear o computador (não é a do e-mail nem a do iCloud). Ela não fica guardada em lugar nenhum.', { app: NOME_APP }).replace(/"/g, '');
  fs.writeFileSync(arquivo, `#!/bin/sh
# Pede a senha do computador numa janela. Criado pelo Claude Setuper (app).
if [ -f "${teste}" ]; then sed -n 's/.*"senha" *: *"\\([^"]*\\)".*/\\1/p' "${teste}"; exit 0; fi
: > "${marca}"
/usr/bin/osascript \\
  -e 'display dialog "${texto}" default answer "" with hidden answer with title "${NOME_APP}" with icon note buttons {"${i18n.t('Cancelar')}", "OK"} default button "OK"' \\
  -e 'text returned of result'
r=$?
rm -f "${marca}"
exit $r
`, { mode: 0o700 });
  fs.chmodSync(arquivo, 0o700);
  return arquivo;
}

async function importarSetuper(rel) {
  return import(pathToFileURL(path.join(SETUPER, 'src', rel)).href);
}

let jaTentou = false;

async function novoCtx(extra = {}) {
  const { criarCtx } = await importarSetuper('ctx.js');
  const ctx = criarCtx({ ...flagsBase(), askpass: NO_WINDOWS ? '' : criarAskpass(), perfil, semApps, ...extra });
  ctx.runVisivel = criarTerminal(ctx, enviar);
  return ctx;
}

async function instalarTudo() {
  const { instalar } = await importarSetuper('cli.js');
  const ctx = await novoCtx();
  // "Tentar de novo" na mesma abertura do app: as respostas acabaram de ser dadas, vai direto ao que falta.
  ctx.repetirDireto = true; // quem clicou em continuar já disse que quer as mesmas respostas
  jaTentou = true;
  ctx.log('--- app', VERSAO, perfil);
  const r = await instalar(ctx, { perfil });
  if (r?.parou) throw new Error(`${r.parou}: ${r.motivo}`);
  if (!semApps) await instalarComando(ctx);
  return ctx;
}

// O comando claude-setuper (doctor, atualizar) continua existindo pra quem ajuda a pessoa pelo Terminal.
async function instalarComando(ctx) {
  const { ui } = await importarSetuper('ui.js');
  const dest = path.join(PASTA, 'app');
  try {
    await ui.tarefa('Deixando o comando claude-setuper pronto', 'Comando claude-setuper pronto', async () => {
      // O comando é sempre a cópia que veio dentro deste app: a mesma versão e o mesmo idioma do que foi instalado.
      fs.rmSync(dest, { recursive: true, force: true });
      fs.cpSync(SETUPER, dest, { recursive: true });
      if (!fs.existsSync(path.join(dest, 'node_modules'))) await ctx.run('npm', ['install', '--silent', '--no-audit', '--no-fund', '--omit=dev'], { cwd: dest, ignorarErro: true });
      const bin = path.join(HOME, '.local', 'bin');
      fs.mkdirSync(bin, { recursive: true });
      // No Windows link simbólico pede administrador; um .cmd faz o mesmo papel.
      if (NO_WINDOWS) { fs.writeFileSync(path.join(bin, 'claude-setuper.cmd'), comandoDoSetuper()); return; }
      const link = path.join(bin, 'claude-setuper');
      fs.rmSync(link, { force: true });
      fs.symlinkSync(path.join(dest, 'bin', 'claude-setuper.js'), link);
      fs.chmodSync(path.join(dest, 'bin', 'claude-setuper.js'), 0o755);
    });
  } catch (e) {
    ctx.log('aviso comando claude-setuper', e.message);
  }
}

const respostasSalvas = () => lerJson(path.join(PASTA, 'estado.json'))?.respostas || {};
function exemplosDoPerfil(r = respostasSalvas()) {
  try {
    const raiz = path.join(SETUPER, 'templates');
    const en = path.join(raiz, 'en', 'cardapio', `${r.perfil || 'dia-a-dia'}.md`);
    const arq = i18n.idiomaAtual() === 'en' && fs.existsSync(en) ? en : path.join(raiz, 'cardapio', `${r.perfil || 'dia-a-dia'}.md`);
    return fs.readFileSync(arq, 'utf8').split('\n').filter((l) => l.startsWith('- ') && !l.includes('[')).map((l) => l.slice(2).trim());
  } catch { return []; }
}
function paraComecar() {
  const r = respostasSalvas();
  const maestri = ['/Applications/Maestri.app', '/Applications/Setapp/Maestri.app'].some((p) => fs.existsSync(p));
  return { nome: r.nome || '', maestri };
}

// Mesma conferência do "claude-setuper doctor", devolvida em dados pra tela.
async function conferencia() {
  const { criarCtx } = await importarSetuper('ctx.js');
  const { MODULOS, modulosParaPlataforma } = await importarSetuper('modulos/index.js');
  const ctx = criarCtx(flagsBase());
  const ids = Object.keys(ctx.estado.modulos || {});
  const lista = modulosParaPlataforma(ids.length ? ids : MODULOS.filter((m) => m.padrao).map((m) => m.id), ctx.plataforma);
  const grupos = [];
  for (const m of lista) {
    let itens;
    try { itens = await m.verificar(ctx); } catch (e) { itens = [{ item: m.nome, ok: false, dica: e.message }]; }
    if (itens.length) grupos.push({ nome: i18n.traduzir(m.nomeCurto || m.nome), itens: itens.map((i) => ({ chave: i.item, item: i18n.traduzir(i.item), ok: !!i.ok, dica: i18n.traduzir(i.dica || '') })) });
  }
  return grupos;
}

async function versaoNova() {
  try {
    const r = await fetch(`https://raw.githubusercontent.com/${REPO}/main/package.json`, { signal: AbortSignal.timeout(6000) });
    const v = (await r.json()).version;
    const n = (s) => s.split('.').map(Number);
    const [a, b] = [n(v), n(VERSAO)];
    for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i] ? v : null;
  } catch {}
  return null;
}

// Baixa o app novo, troca este e reabre. Só faz sentido no app empacotado.
function atualizarApp() {
  if (NO_WINDOWS) return atualizarNoWindows();
  const appPath = path.resolve(process.execPath, '..', '..', '..');
  if (!appPath.endsWith('.app')) return;
  const script = `set -e
ARQ=arm64; [ "$(uname -m)" = x86_64 ] && ARQ=x64
T=$(mktemp -d)
curl -fsSL -o "$T/app.zip" "https://github.com/${REPO}/releases/latest/download/Claude-Setuper-mac-$ARQ.zip"
ditto -x -k "$T/app.zip" "$T/x"
sleep 1
rm -rf "${appPath}"
ditto "$T/x/Claude Setuper.app" "${appPath}"
open "${appPath}"`;
  spawn('/bin/bash', ['-c', script], { detached: true, stdio: 'ignore' }).unref();
  app.quit();
}

// No Windows quem troca o app é o próprio instalador: roda em silêncio, espera este fechar e abre o novo.
async function atualizarNoWindows() {
  try {
    const r = await fetch(`https://github.com/${REPO}/releases/latest/download/${INSTALADOR}`, { signal: AbortSignal.timeout(10 * 60000) });
    if (!r.ok) throw new Error(`download ${r.status}`);
    const destino = path.join(os.tmpdir(), INSTALADOR);
    fs.writeFileSync(destino, Buffer.from(await r.arrayBuffer()));
    spawn(destino, ['/S'], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
    app.quit();
  } catch (e) {
    fs.appendFileSync(path.join(PASTA, 'registro.log'), `[atualizar] ${e.message}\n`);
    shell.openExternal(`https://github.com/${REPO}/releases/latest`);
  }
}

// No Windows o fluxo termina no atalho da IA que o módulo atalho deixou na Área de Trabalho.
async function abrirAtalhoDaIA() {
  const { criarCtx } = await importarSetuper('ctx.js');
  const erro = await shell.openPath(path.join(criarCtx(flagsBase()).desktop(), 'Claude.cmd'));
  if (erro) {
    fs.appendFileSync(path.join(PASTA, 'registro.log'), `[abrir a IA] ${erro}\n`);
    spawn('cmd.exe', ['/c', 'start "Claude" cmd /k claude'], { detached: true, stdio: 'ignore', cwd: HOME, windowsVerbatimArguments: true }).unref();
  }
}

function abrirClaude() {
  if (NO_WINDOWS) return abrirAtalhoDaIA().catch((e) => fs.appendFileSync(path.join(PASTA, 'registro.log'), `[abrir a IA] ${e.message}\n`));
  const maestri = ['/Applications/Maestri.app', '/Applications/Setapp/Maestri.app'].find((p) => fs.existsSync(p));
  if (maestri) spawn('open', [maestri], { detached: true, stdio: 'ignore' }).unref();
  else if (process.platform === 'darwin') spawn('osascript', ['-e', 'tell application "Terminal" to do script "claude"', '-e', 'tell application "Terminal" to activate'], { detached: true, stdio: 'ignore' }).unref();
}

function montarMenu() {
  const t = i18n.t;
  const paraTela = (acao) => () => janela?.webContents.send('menu', acao);
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    ...(process.platform === 'darwin' ? [{ label: NOME_APP, submenu: [
      { role: 'about', label: t('Sobre {app}', { app: NOME_APP }) },
      { type: 'separator' },
      { role: 'hide', label: t('Ocultar {app}', { app: NOME_APP }) },
      { role: 'hideOthers', label: t('Ocultar os outros') },
      { role: 'unhide', label: t('Mostrar todos') },
      { type: 'separator' },
      { role: 'quit', label: t('Sair de {app}', { app: NOME_APP }) },
    ] }] : []),
    { label: t('Editar'), submenu: [
      { role: 'undo', label: t('Desfazer') },
      { role: 'redo', label: t('Refazer') },
      { type: 'separator' },
      { role: 'cut', label: t('Recortar') },
      { role: 'copy', label: t('Copiar') },
      { role: 'paste', label: t('Colar') },
      { role: 'selectAll', label: t('Selecionar tudo') },
    ] },
    { label: t('Janela'), submenu: [
      { role: 'minimize', label: t('Minimizar') },
      { role: 'close', label: t('Fechar') },
    ] },
    { role: 'help', label: t('Ajuda'), submenu: [
      { label: t('Ver o que já foi feito'), click: paraTela('detalhes') },
      { label: t('Pedir ajuda'), click: paraTela('ajuda') },
      { label: t('Abrir o registro técnico'), click: () => shell.openPath(path.join(PASTA, 'registro.log')) },
    ] },
  ]));
}

function criarJanela() {
  janela = new BrowserWindow({
    width: 960, height: 640, minWidth: 820, minHeight: 600,
    title: NOME_APP, backgroundColor: '#08080D', show: false,
    // hiddenInset é só do Mac: no Windows ele tiraria os botões de fechar e minimizar, sem pôr nada no lugar.
    // Notebook com tela pequena e escala de 125%: a janela não pode nascer maior que a área útil.
    ...(NO_WINDOWS ? { useContentSize: true, autoHideMenuBar: true, height: Math.min(640, screen.getPrimaryDisplay().workArea.height - 40), minHeight: Math.min(600, screen.getPrimaryDisplay().workArea.height - 40) } : { titleBarStyle: 'hiddenInset' }),
    webPreferences: { preload: path.join(AQUI, 'preload.cjs'), contextIsolation: true, sandbox: true, backgroundThrottling: false },
  });
  janela.on('page-title-updated', (e) => e.preventDefault()); // o título é o nome do app, inclusive no presente
  janela.loadFile(path.join(AQUI, 'tela', 'index.html'));
  janela.once('ready-to-show', () => { if (!SO_AULA) janela.show(); });
  // Erros da tela vão pro registro, junto com o resto.
  janela.webContents.on('console-message', (ev) => {
    if (ev.level === 'error' || ev.level === 'warning') { fs.mkdirSync(PASTA, { recursive: true }); fs.appendFileSync(path.join(PASTA, 'registro.log'), `[tela] ${ev.message}\n`); }
  });
  janela.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  janela.on('close', (e) => {
    if (!rodando || TESTE) return;
    const escolha = dialog.showMessageBoxSync(janela, {
      type: 'warning', buttons: [i18n.t('Continuar instalando'), i18n.t('Fechar mesmo assim')], defaultId: 0, cancelId: 0,
      message: i18n.t('A instalação ainda está rodando.'),
      detail: i18n.t('Se fechar agora, é só abrir o {app} de novo depois: eu continuo de onde parei.', { app: NOME_APP }),
    });
    if (escolha === 0) e.preventDefault();
  });
}

async function mandarInicio() {
  const estadoSalvo = lerJson(path.join(PASTA, 'estado.json'));
  const feitos = Object.values(estadoSalvo?.modulos || {}).filter((m) => m.ok).length;
  const total = Object.keys(estadoSalvo?.respostas?.modulos || {}).length || 1;
  const video = path.join(AQUI, 'tela', 'video', `abertura-${i18n.idiomaAtual()}.mp4`);
  enviar({
    tipo: 'inicio', versao: VERSAO, temInstalacao: !!estadoSalvo?.respostas, nome: estadoSalvo?.respostas?.nome || '', auto: TESTE || null,
    presente: await dadosDoPresente(), idioma: i18n.idiomaAtual(), catalogo: i18n.catalogoAtual(), plataforma: process.platform,
    video: fs.existsSync(video) ? `video/abertura-${i18n.idiomaAtual()}.mp4` : '', progresso: Math.min(99, Math.round((feitos / total) * 100)),
    primeiraAbertura: !estadoSalvo, tudoPronto: !!estadoSalvo?.terminou && Object.values(estadoSalvo?.modulos || {}).every((m) => m.ok),
  });
}

ipcMain.on('pronto', async () => {
  if (process.argv.includes('--demo-telas')) return demoTelas();
  if (SO_AULA) return comecarAula();
  await mandarInicio();
  // O app do presente não se troca pelo Claude Setuper comum: a versão nova dos releases não traz o cofre.
  if (PRESENTE) return;
  const nova = await versaoNova();
  if (nova && app.isPackaged) enviar({ tipo: 'atualizacao', versao: nova });
});
ipcMain.on('trocar-idioma', async (_e, id) => {
  escolherIdioma(id);
  const { ui } = await importarSetuper('ui.js');
  Object.assign(ui, criarUiApp(enviar, pedir, i18n.traduzir));
  montarMenu();
  await mandarInicio();
});

// O que a tela de boas-vindas do presente mostra: o recado, a assinatura e o signo (como imagem embutida).
async function dadosDoPresente() {
  if (!PRESENTE) return null;
  try {
    const { lerPresente } = await importarSetuper('presente.js');
    const p = lerPresente(PRESENTE);
    if (!p || p.invalido) return null;
    let signo = '';
    if (p.signo) signo = `data:${p.signo.endsWith('.svg') ? 'image/svg+xml' : 'image/png'};base64,${fs.readFileSync(p.signo).toString('base64')}`;
    return { nome: p.nome, rotulo: p.rotulo, artigo: p.artigo, recado: p.recado, signo };
  } catch (e) {
    fs.appendFileSync(path.join(PASTA, 'registro.log'), `[presente] ${e.stack || e.message}\n`);
    return null;
  }
}

// O erro técnico fica no registro; na tela vai o que aconteceu, em português comum.
function falhaEmLinguagemComum(e) {
  const m = String(e.message || e).split('\n')[0];
  const internet = /ENOTFOUND|ECONN|ETIMEDOUT|EAI_AGAIN|internet|network|baixar/i.test(m);
  if (/ENOSPC/.test(m)) return { texto: i18n.t('O disco do computador encheu. Libera um pouco de espaço e tenta de novo.'), internet: false };
  if (/EACCES|EPERM/.test(m)) return { texto: i18n.t('O computador não me deixou gravar numa pasta. Clica em Pedir ajuda que quem te ajuda vê o motivo.'), internet: false };
  if (internet && /\bE[A-Z]{4,}\b/.test(m)) return { texto: i18n.t('A internet caiu no meio de um download.'), internet: true };
  if (/\bE[A-Z]{4,}\b|[/\\]\w+[/\\]/.test(m)) return { texto: i18n.t('Uma parte da instalação não terminou. Clica em Tentar de novo, e se voltar a acontecer, em Pedir ajuda.'), internet: false };
  return { texto: m, internet };
}
ipcMain.on('iniciar', async (_e, modo) => {
  if (rodando) return;
  rodando = true;
  try {
    if (modo === 'instalar') {
      await instalarTudo();
      const arq = path.join(PASTA, 'estado.json');
      fs.writeFileSync(arq, JSON.stringify({ ...lerJson(arq), terminou: true }, null, 2));
    }
    enviar({ tipo: 'tarefa', id: 0, estado: 'fazendo', texto: i18n.t('Conferindo se ficou tudo no lugar') });
    enviar({ tipo: 'fim', grupos: await conferencia(), soConferiu: modo !== 'instalar', comecar: paraComecar() });
  } catch (e) {
    fs.appendFileSync(path.join(PASTA, 'registro.log'), `[app] ${e.stack || e.message}\n`);
    const { texto, internet } = falhaEmLinguagemComum(e);
    enviar({ tipo: 'falha', texto, internet });
    if (janela && !janela.isDestroyed() && !TESTE) { janela.show(); janela.focus(); shell.beep(); }
  } finally {
    rodando = false;
  }
});

ipcMain.on('resposta', (_e, { id, valor }) => responderPedido(id, valor));
// programa: 'chrome' abre no Chrome mesmo que o navegador padrão seja outro (a loja de extensões só serve no Chrome).
ipcMain.on('abrir-link', (_e, url, programa) => {
  // programa: 'obsidian' abre o próprio app (recém-instalado, o link obsidian:// ainda pode não funcionar).
  if (programa === 'obsidian' && /^obsidian:\/\//.test(url)) {
    if (process.platform === 'darwin') return execFile('open', ['-a', '/Applications/Obsidian.app'], (erro) => erro && shell.openExternal(url));
    const exe = NO_WINDOWS && PROGRAMAS.obsidian.caminhos.find((c) => fs.existsSync(c));
    return exe ? shell.openPath(exe) : shell.openExternal(url);
  }
  if (!/^https?:\/\//.test(url)) return;
  if (programa === 'chrome' && process.platform === 'darwin') return execFile('open', ['-a', '/Applications/Google Chrome.app', url], (erro) => erro && shell.openExternal(url));
  if (programa === 'chrome' && NO_WINDOWS) {
    const exe = PROGRAMAS.chrome.caminhos.find((c) => fs.existsSync(c));
    if (exe) return execFile(exe, [url], { windowsHide: true }, () => {});
  }
  shell.openExternal(url);
});
ipcMain.on('pular', async () => (await importarSetuper('ui.js')).ui.marcarPulado?.());
// O código do login do Claude: digitado na janela principal ou, pelo botão do guia, o que estiver copiado.
ipcMain.on('codigo-login', async (_e, texto) => (await importarSetuper('ui.js')).ui.colarCodigo?.(typeof texto === 'string' ? texto : clipboard.readText()));
ipcMain.on('copiar', (_e, texto) => clipboard.writeText(String(texto)));
ipcMain.on('abrir-claude', () => abrirClaude());
ipcMain.on('atualizar', () => atualizarApp());
ipcMain.on('mostrar-registro', () => shell.openPath(path.join(PASTA, 'registro.log')));
ipcMain.on('fechar', () => app.quit());
// O portal e o vídeo ficam na frente do Maestri, que já abriu atrás.
ipcMain.on('portal', () => {
  if (!janela || TESTE) return;
  janela.setAlwaysOnTop(true, 'floating');
  janela.show();
  if (!fs.existsSync(path.join(AQUI, 'tela', 'video', `abertura-${i18n.idiomaAtual()}.mp4`))) abrirBranco();
});
// O branco toma a tela inteira, junto com o clarão da janela: é isso que dá a sensação de entrar.
let branco = null;
function abrirBranco() {
  branco = new BrowserWindow({
    ...screen.getPrimaryDisplay().bounds, frame: false, backgroundColor: '#FFFFFF', hasShadow: false, resizable: false, movable: false, focusable: false, skipTaskbar: true, show: false, enableLargerThanScreen: true,
    ...(process.platform === 'darwin' ? { type: 'panel' } : {}),
  });
  branco.setIgnoreMouseEvents(true);
  branco.setAlwaysOnTop(true, 'screen-saver');
  branco.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true, skipTransformProcessType: true });
  branco.setOpacity(0);
  branco.showInactive();
  branco.on('closed', () => { branco = null; });
  setTimeout(() => esmaecer(branco, 0, 1, 1700), 2000);
}
function esmaecer(j, de, para, ms) {
  return new Promise((res) => {
    const passos = Math.max(1, Math.round(ms / 30));
    let i = 0;
    const r = setInterval(() => {
      i += 1;
      if (!j || j.isDestroyed()) { clearInterval(r); return res(); }
      j.setOpacity(de + (para - de) * (i / passos));
      if (i >= passos) { clearInterval(r); res(); }
    }, 30);
  });
}
ipcMain.on('concluir', () => comecarAula());
ipcMain.on('guia-pronto', () => { guiaProntoJa = true; if (cenaGuia) mandarAoGuia({ tipo: 'cena', cena: cenaGuia }); });
ipcMain.on('guia-altura', (_e, altura) => {
  if (!guia || guia.isDestroyed()) return;
  const limite = screen.getPrimaryDisplay().workArea.height - 48;
  guia.setSize(340, Math.min(limite, Math.max(140, Math.ceil(altura) + 2)));
});
ipcMain.on('guia-passo', (_e, i) => { passoAtual = i; apontarPasso(); });
ipcMain.on('guia-acao', async (_e, acao) => { if (acao === 'tentar') (await importarSetuper('ui.js')).ui.marcarTentar?.(); });
ipcMain.on('aula', (_e, acao) => {
  aula?.acao(acao);
  // O clique no guia não pode tirar o foco: a próxima coisa que a pessoa digita é na janela da IA.
  const maestri = ['/Applications/Maestri.app', '/Applications/Setapp/Maestri.app'].find((p) => fs.existsSync(p));
  if (maestri && !TESTE) execFile('/usr/bin/open', ['-a', maestri], () => {});
});
ipcMain.on('ligar-opcional', (_e, id) => ligarOpcional(id));
// Pedir ajuda: gera o arquivo do `claude-setuper pedir-ajuda`, na Mesa, e abre o WhatsApp com o registro já escrito.
ipcMain.handle('pedir-ajuda', async () => {
  try {
    const { criarCtx } = await importarSetuper('ctx.js');
    const { gerarPedidoDeAjuda, mensagemWhatsApp, linkWhatsApp } = await importarSetuper('ajuda.js');
    const arquivo = await gerarPedidoDeAjuda(criarCtx(flagsBase()), VERSAO);
    const temApp = fs.existsSync('/Applications/WhatsApp.app');
    await shell.openExternal(linkWhatsApp(mensagemWhatsApp(fs.readFileSync(arquivo, 'utf8')), temApp));
    return { arquivo, nome: path.basename(arquivo), pasta: path.basename(path.dirname(arquivo)) };
  } catch (e) {
    fs.appendFileSync(path.join(PASTA, 'registro.log'), `[ajuda] ${e.stack || e.message}\n`);
    return { erro: String(e.message || e) };
  }
});
// Nos testes, guarda um print de cada tela pra conferir o visual depois.
ipcMain.handle('print', async (_e, nome) => {
  if (!TESTE || !janela) return;
  const dir = path.join(PASTA, 'telas');
  fs.mkdirSync(dir, { recursive: true });
  const img = await janela.webContents.capturePage();
  fs.writeFileSync(path.join(dir, `${String(fs.readdirSync(dir).length + 1).padStart(2, '0')}-${nome}.png`), img.toPNG());
});

// ---------- a aula por cima do Maestri ----------
// O fim do portal: a janela está toda branca por cima de tudo. O Maestri vem pra frente atrás dela, e o branco se desfaz em cima dele.
async function sairPeloBranco() {
  abrirClaude();
  if (!janela || janela.isDestroyed()) return;
  await new Promise((r) => setTimeout(r, TESTE ? 0 : 900));
  if (branco) { janela.hide(); await esmaecer(branco, 1, 0, 600); branco?.close(); }
  else if (!TESTE) await esmaecer(janela, 1, 0, 450);
  if (janela.isDestroyed()) return;
  janela.setAlwaysOnTop(false);
  janela.hide();
  janela.setOpacity(1);
}
async function comecarAula() {
  await sairPeloBranco();
  if (!aula) {
    aula = criarAula({
      claudeDir: CLAUDE_DIR, pasta: PASTA, t: i18n.t, mac: process.platform === 'darwin', respostas: respostasSalvas,
      mostrar: (cena) => mostrarGuia(cena), esconder: esconderGuia, aoTerminar: () => app.quit(),
    });
  }
  aula.iniciar();
}
// As opções do fim da aula rodam o mesmo módulo do Terminal, com o guia e as perguntas do app.
async function ligarOpcional(id) {
  if (emOpcional) return;
  emOpcional = true;
  try {
    const { modulo } = await importarSetuper('modulos/index.js');
    const ctx = await novoCtx();
    ctx.resp = ctx.estado.respostas || {};
    ctx.opcional = true;
    const m = modulo(id === 'conectores' ? 'mcps' : id);
    if (id === 'conectores' && !(ctx.resp.mcps || []).length) ctx.resp = { ...ctx.resp, mcps: ['gmail', 'google-calendar'] };
    await m.instalar(ctx);
    ctx.salvarEstado();
    // Com o GitHub ligado, o backup das notas passa a poder ser ligado também.
    if (id === 'github') await modulo('rotinas').instalar(ctx);
    aula?.marcarFeito(id);
  } catch (e) {
    fs.appendFileSync(path.join(PASTA, 'registro.log'), `[opcional ${id}] ${e.stack || e.message}\n`);
  } finally {
    emOpcional = false;
    if (janela && !janela.isDestroyed()) janela.hide();
    aula?.redesenhar();
  }
}

// ---------- só pra conferir o visual sem instalar nada: cada cena vira um print em telas/ ----------
async function demoTelas() {
  const dir = path.join(PASTA, 'telas');
  fs.mkdirSync(dir, { recursive: true });
  const print = async (nome, alvo = janela) => {
    await new Promise((r) => setTimeout(r, 900));
    // O guia agora só aparece quando está pronto; janela escondida não devolve a captura.
    for (let i = 0; i < 30 && !alvo.isVisible(); i += 1) await new Promise((r) => setTimeout(r, 100));
    const foto = await Promise.race([alvo.webContents.capturePage(), new Promise((r) => setTimeout(r, 4000))]);
    if (foto) fs.writeFileSync(path.join(dir, `${nome}.png`), foto.toPNG());
  };
  const js = (c) => janela.webContents.executeJavaScript(c);
  const passos = ['Preparar o computador', 'Configurar a IA', 'Ajuste automático', 'Segundo cérebro', 'Google Chrome', 'Comandos prontos', 'Apps conectados', 'Rotinas', 'Manter atualizado', 'Janela da IA'];
  const pesos = [45, 2, 2, 10, 10, 2, 2, 2, 2, 10];
  enviar({ tipo: 'inicio', versao: VERSAO, temInstalacao: false, nome: '', auto: null, idioma: i18n.idiomaAtual(), catalogo: i18n.catalogoAtual(), plataforma: process.platform, primeiraAbertura: true });
  await new Promise((r) => setTimeout(r, 2800));
  await print('01-abertura');
  await js("[...document.querySelectorAll('.btn')].at(-1).click()");
  await new Promise((r) => setTimeout(r, 2200));
  await print('02-demo');
  await js("[...document.querySelectorAll('.btn')].at(-1).click()");
  await print('03-confirma');
  const { ui } = await importarSetuper('ui.js');
  const p1 = ui.perguntar('Como você quer que a IA te chame?', { placeholder: 'Seu primeiro nome ou apelido' });
  await print('05-pergunta-nome');
  for (const [id] of pendentes) responderPedido(id, 'Marina');
  await p1;
  const p2 = ui.escolher('Pra que você vai usar a IA, Marina?', [{ value: 'a', label: 'Pro meu trabalho no dia a dia', hint: 'e-mails, textos, planilhas, pesquisa' }, { value: 'b', label: 'Pra minha empresa', hint: 'decisões, números, propostas, equipe' }, { value: 'c', label: 'Pro marketing', hint: 'copy, posts, campanhas, roteiros' }, { value: 'd', label: 'Pra edição de vídeo', hint: 'cortes, roteiros, títulos, legendas' }, { value: 'e', label: 'Pros estudos', hint: 'escola, faculdade, cursinho, vestibular' }], { padrao: 'a' });
  await print('06-pergunta-perfil');
  for (const [id] of pendentes) responderPedido(id, 'a');
  await p2;
  enviar({ tipo: 'plano', passos: passos.map(i18n.t), pesos, exemplos: exemplosDoPerfil({ perfil: 'dia-a-dia' }) });
  // As ferramentas da Apple vêm depois das perguntas, no primeiro passo.
  enviar({ tipo: 'passo', n: 1, total: passos.length, titulo: passos[0] });
  ui.pausa('Clica em Instalar, na janela da Apple', ['Depois aparece o contrato: clica em Concordo.', 'Demora entre 3 e 10 minutos. Eu fico esperando aqui.'], { figura: 'apple-ferramentas', rotulo: 'Ferramentas da Apple' });
  await print('04-apple-principal');
  await print('04-apple-guia', guia);
  enviar({ tipo: 'passo', n: 2, total: passos.length, titulo: passos[1] });
  enviar({ tipo: 'tarefa', id: 2, estado: 'fazendo', texto: i18n.t('Instalando a IA'), demora: 'de 2 a 5 minutos' });
  await print('07-instalando');
  enviar({ tipo: 'passo', n: 4, total: passos.length, titulo: passos[3] });
  ui.pausa('Clica no primeiro botão do Obsidian', ['A janela vem em inglês. Ela só pergunta se pode ligar dois complementos das suas notas, e pode confiar.'], { rotulo: 'Suas notas', figura: 'obsidian-confiar', acoes: [{ rotulo: 'Abrir o Obsidian', url: 'obsidian://open', app: 'obsidian' }], pular: 'Fazer isso depois' });
  await print('08-pausa-principal');
  await print('08-pausa-guia', guia);
  enviar({ tipo: 'passo', n: 5, total: passos.length, titulo: passos[4] });
  ui.pausa('Cola este código no GitHub', ['Depois clica em Continue e em Authorize.'], { rotulo: 'Conectar o GitHub', figura: 'github-codigo', pular: 'Deixar pra depois', acoes: [{ rotulo: 'Tentar de novo', reabrir: 'tentar' }], opcional: true });
  enviar({ tipo: 'codigo', codigo: '07D6-0B19' });
  enviar({ tipo: 'link', url: 'https://github.com/login/device' });
  await new Promise((r) => setTimeout(r, 1500));
  await print('09-github-guia', guia);
  if (setas.vidro()) await print('09-github-setas', setas.vidro());
  // Login do Claude que terminou na página "Authentication code": o campo pra colar o código, na janela e no guia.
  ui.pausa('Entra na sua conta do Claude', ['Claude é o nome da IA que estou instalando. Abri a página no navegador: se ainda não tem conta, dá pra criar ali mesmo. Ela precisa de plano pago (Pro ou maior), e a própria página mostra como assinar. Quando disser que deu certo, eu sigo sozinho.'], { pular: 'Entrar depois', figura: 'claude-login', rotulo: 'Conta do Claude' });
  ui.esperarCodigo(() => {});
  await print('09-login-codigo-principal');
  await print('09-login-codigo-guia', guia);
  ui.esperarCodigo(null);
  enviar({ tipo: 'passo', n: 5, total: passos.length, titulo: passos[4] });
  enviar({ tipo: 'tarefa', id: 90, estado: 'fazendo', texto: i18n.t('Instalando o Google Chrome'), demora: 'de 2 a 10 minutos', atras: 5 * 60000 });
  await js('desenhar()');
  await print('10-parado');
  enviar({ tipo: 'falha', texto: i18n.t('Não consegui baixar o Google Chrome.') });
  await print('11-falha');
  await print('12-falha-folha');
  enviar({ tipo: 'fim', soConferiu: false, comecar: { nome: 'Marina' }, grupos: [{ nome: 'Base', itens: [{ item: 'Login no Claude', ok: false, dica: '' }] }] });
  await print('13-sem-login');
  enviar({ tipo: 'fim', soConferiu: true, comecar: { nome: 'Marina' }, grupos: [{ nome: 'Segundo cérebro', itens: [{ item: 'Complementos do Obsidian ligados (clique de confiança)', ok: false, dica: '' }] }, ...['Preparar o computador', 'Configurar a IA', 'Comandos prontos', 'Rotinas', 'Janela da IA'].map((nome) => ({ nome, itens: [{ item: nome, ok: true }] }))] });
  await print('14-conferencia');
  enviar({ tipo: 'fim', soConferiu: false, comecar: { nome: 'Marina' }, grupos: [{ nome: 'Base', itens: [{ item: 'Claude Code', ok: true }] }] });
  await new Promise((r) => setTimeout(r, 1500));
  await print('15-portal-meio');
  await new Promise((r) => setTimeout(r, 3400));
  fs.writeFileSync(path.join(PASTA, 'estado.json'), JSON.stringify({ respostas: { nome: 'Marina', autonomia: 'equilibrado' }, modulos: {} }));
  await print('16-aula-1', guia);
  aula.acao('avancar');
  await print('17-aula-2', guia);
  aula.acao('avancar');
  await print('18-aula-3', guia);
  aula.acao('pular');
  await print('19-aula-fim', guia);
  fs.writeFileSync(path.join(dir, 'pronto.txt'), 'ok');
  app.quit();
}

// Testando com --home, os dados do Electron também ficam na casa de teste.
// A janela transparente das setas não pode parar de pintar por o sistema achar que ela está coberta.
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
if (HOME_TESTE) app.setPath('userData', path.join(HOME_TESTE, 'Library', 'Application Support', NOME_APP));
if (PRESENTE) app.setName(NOME_APP);

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => {
    if (aula?.ativa()) return aula.redesenhar();
    if (janela) { if (janela.isMinimized()) janela.restore(); janela.show(); janela.focus(); }
  });
  app.whenReady().then(async () => {
    nativeTheme.themeSource = 'dark'; // o app é sempre escuro, a abertura depende disso
    i18n = await importarSetuper('i18n.js');
    if (PRESENTE) i18n.definirNomeApp(NOME_APP);
    escolherIdioma(idiomaInicial());
    const { ui } = await importarSetuper('ui.js');
    Object.assign(ui, criarUiApp(enviar, pedir, i18n.traduzir));
    montarMenu();
    criarVidro();
    criarJanela();
  });
  app.on('window-all-closed', () => { if (!aula) app.quit(); });
}
