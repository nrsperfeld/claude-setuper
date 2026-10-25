// App do Claude Setuper no Mac: a mesma instalação do Terminal (src/), com telas no lugar do texto.
// Desenho em docs/superpowers/specs/2026-10-24-app-mac-design.md.
import { app, BrowserWindow, ipcMain, shell, clipboard, dialog } from 'electron';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { criarUiApp } from './ui-app.js';
import { criarTerminal } from './terminal.js';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
// Empacotado, o Setuper vem dentro do app (setuper/); rodando do repositório, é a pasta de cima.
const SETUPER = fs.existsSync(path.join(AQUI, 'setuper', 'src')) ? path.join(AQUI, 'setuper') : path.join(AQUI, '..');
const REPO = process.env.CLAUDE_SETUPER_REPO || 'nrsperfeld/claude-setuper';
const VERSAO = JSON.parse(fs.readFileSync(path.join(SETUPER, 'package.json'), 'utf8')).version;
const HOME = os.homedir();
const PASTA = path.join(HOME, 'Claude Setuper');
const TESTE = lerJson(path.join(PASTA, '.teste-auto.json')); // só existe nos testes da VM

// Aberto pelo Finder, o app herda um PATH mínimo; sem isso não acha brew, node, claude, gh.
process.env.PATH = [...new Set([
  '/opt/homebrew/bin', '/opt/homebrew/sbin', '/usr/local/bin', path.join(HOME, '.local', 'bin'),
  ...(process.env.PATH || '').split(':').filter(Boolean), '/usr/bin', '/bin', '/usr/sbin', '/sbin',
])].join(':');
process.env.LANG ||= 'pt_BR.UTF-8';
// Nos testes da VM os logins esperam só uns segundos (não tem pessoa pra fazer o login).
if (TESTE?.esperaMax) process.env.CLAUDE_SETUPER_ESPERA_MAX = String(TESTE.esperaMax);

const perfil = (() => { const i = process.argv.indexOf('--perfil'); return i > 0 ? process.argv[i + 1] : ''; })();
const semApps = process.argv.includes('--sem-apps'); // só pra testar as telas sem instalar nada
let janela;
let rodando = false;
const pendentes = new Map();
let proximoPedido = 0;

function enviar(ev) {
  if (TESTE) fs.appendFileSync(path.join(PASTA, 'registro.log'), `[evento] ${JSON.stringify(ev).slice(0, 160)}\n`);
  if (janela && !janela.isDestroyed()) janela.webContents.send('ui', ev);
}

function pedir(pergunta) {
  const id = ++proximoPedido;
  return new Promise((resolver) => {
    pendentes.set(id, resolver);
    enviar({ tipo: 'pedido', id, pergunta });
  });
}

function lerJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

// Janela nativa do Mac pedindo a senha, usada pelo sudo do instalador do Homebrew (SUDO_ASKPASS).
function criarAskpass() {
  fs.mkdirSync(PASTA, { recursive: true });
  const arquivo = path.join(PASTA, 'pedir-senha.sh');
  const teste = path.join(PASTA, '.teste-auto.json');
  fs.writeFileSync(arquivo, `#!/bin/sh
# Pede a senha do Mac numa janela. Criado pelo Claude Setuper (app).
if [ -f "${teste}" ]; then sed -n 's/.*"senha" *: *"\\([^"]*\\)".*/\\1/p' "${teste}"; exit 0; fi
exec /usr/bin/osascript \\
  -e 'display dialog "O Claude Setuper precisa da senha do seu Mac pra instalar o Homebrew. É a mesma senha que você usa pra ligar o computador." default answer "" with hidden answer with title "Claude Setuper" with icon caution buttons {"Cancelar", "OK"} default button "OK"' \\
  -e 'text returned of result'
`, { mode: 0o700 });
  fs.chmodSync(arquivo, 0o700);
  return arquivo;
}

async function importarSetuper(rel) {
  return import(pathToFileURL(path.join(SETUPER, 'src', rel)).href);
}

async function instalarTudo() {
  const { criarCtx } = await importarSetuper('ctx.js');
  const { instalar } = await importarSetuper('cli.js');
  const ctx = criarCtx({ app: true, askpass: criarAskpass(), perfil, semApps });
  ctx.runVisivel = criarTerminal(ctx, enviar);
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
      if (fs.existsSync(path.join(dest, '.git'))) await ctx.run('git', ['-C', dest, 'pull', '-q', '--ff-only'], { ignorarErro: true });
      else {
        fs.rmSync(dest, { recursive: true, force: true });
        const clonou = await ctx.run('git', ['clone', '-q', '--depth', '1', `https://github.com/${REPO}.git`, dest], { ignorarErro: true }).then(() => fs.existsSync(path.join(dest, 'bin')));
        // Sem internet pro GitHub: usa a cópia que vem dentro do app (sem o "atualizar", que precisa do git).
        if (!clonou) fs.cpSync(SETUPER, dest, { recursive: true });
      }
      if (!fs.existsSync(path.join(dest, 'node_modules'))) await ctx.run('npm', ['install', '--silent', '--no-audit', '--no-fund', '--omit=dev'], { cwd: dest, ignorarErro: true });
      const bin = path.join(HOME, '.local', 'bin');
      fs.mkdirSync(bin, { recursive: true });
      const link = path.join(bin, 'claude-setuper');
      fs.rmSync(link, { force: true });
      fs.symlinkSync(path.join(dest, 'bin', 'claude-setuper.js'), link);
      fs.chmodSync(path.join(dest, 'bin', 'claude-setuper.js'), 0o755);
    });
  } catch (e) {
    ctx.log('aviso comando claude-setuper', e.message);
  }
}

// Mesma conferência do "claude-setuper doctor", devolvida em dados pra tela.
async function conferencia() {
  const { criarCtx } = await importarSetuper('ctx.js');
  const { MODULOS, modulosParaPlataforma } = await importarSetuper('modulos/index.js');
  const ctx = criarCtx({ app: true });
  const ids = Object.keys(ctx.estado.modulos || {});
  const lista = modulosParaPlataforma(ids.length ? ids : MODULOS.filter((m) => m.padrao).map((m) => m.id), ctx.plataforma);
  const grupos = [];
  for (const m of lista) {
    let itens;
    try { itens = await m.verificar(ctx); } catch (e) { itens = [{ item: m.nome, ok: false, dica: e.message }]; }
    if (itens.length) grupos.push({ nome: m.nome, itens: itens.map((i) => ({ item: i.item, ok: !!i.ok, dica: i.dica || '' })) });
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

function abrirClaude() {
  const maestri = ['/Applications/Maestri.app', '/Applications/Setapp/Maestri.app'].find((p) => fs.existsSync(p));
  if (maestri) spawn('open', [maestri], { detached: true, stdio: 'ignore' }).unref();
  else spawn('osascript', ['-e', 'tell application "Terminal" to do script "claude"', '-e', 'tell application "Terminal" to activate'], { detached: true, stdio: 'ignore' }).unref();
}

function criarJanela() {
  janela = new BrowserWindow({
    width: 960, height: 680, minWidth: 820, minHeight: 600,
    title: 'Claude Setuper', titleBarStyle: 'hiddenInset', backgroundColor: '#0f0f10', show: false,
    webPreferences: { preload: path.join(AQUI, 'preload.cjs'), contextIsolation: true, sandbox: true, backgroundThrottling: false },
  });
  janela.loadFile(path.join(AQUI, 'tela', 'index.html'));
  janela.once('ready-to-show', () => janela.show());
  // Erros da tela vão pro registro, junto com o resto.
  janela.webContents.on('console-message', (ev) => {
    if (ev.level === 'error' || ev.level === 'warning') fs.appendFileSync(path.join(PASTA, 'registro.log'), `[tela] ${ev.message}\n`);
  });
  janela.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  janela.on('close', (e) => {
    if (!rodando || TESTE) return;
    const escolha = dialog.showMessageBoxSync(janela, {
      type: 'warning', buttons: ['Continuar instalando', 'Fechar mesmo assim'], defaultId: 0, cancelId: 0,
      message: 'A instalação ainda está rodando.',
      detail: 'Se fechar agora, é só abrir o Claude Setuper de novo depois: eu continuo de onde parei.',
    });
    if (escolha === 0) e.preventDefault();
  });
}

ipcMain.on('pronto', async () => {
  // Só pra conferir o visual dos cartões sem rodar uma instalação inteira.
  if (process.argv.includes('--demo-cartoes')) {
    const passos = ['Base da máquina', 'Núcleo do Claude', 'GitHub (guardar e versionar o trabalho)', 'Vercel (publicar sites na internet)'];
    const seq = [
      { tipo: 'inicio', versao: VERSAO, temInstalacao: false, nome: '', auto: null },
      { tipo: 'plano', passos }, { tipo: 'passo', n: 3, total: 4, titulo: passos[2] },
      { tipo: 'tarefa', id: 1, estado: 'feito', texto: 'Ferramenta do GitHub instalada' },
      { tipo: 'pausa', titulo: 'Vou abrir o navegador pra conectar a sua conta do GitHub', linhas: ['Vai aparecer aqui um código de 8 letras, com um botão pra copiar.', 'O navegador abre sozinho. Lá, cola o código, clica em Continuar e depois em Autorizar.', 'Depois volta pra cá, eu continuo.'] },
      { tipo: 'link', url: 'https://github.com/login/device' }, { tipo: 'codigo', codigo: '07D6-0B19' },
    ];
    for (const ev of seq) enviar(ev);
    setTimeout(async () => {
      fs.mkdirSync(path.join(PASTA, 'telas'), { recursive: true });
      fs.writeFileSync(path.join(PASTA, 'telas', 'demo-cartoes.png'), (await janela.webContents.capturePage()).toPNG());
    }, 1500);
    return;
  }
  const estado = lerJson(path.join(PASTA, 'estado.json'));
  enviar({ tipo: 'inicio', versao: VERSAO, temInstalacao: !!estado?.respostas, nome: estado?.respostas?.nome || '', auto: TESTE || null });
  const nova = await versaoNova();
  if (nova && app.isPackaged) enviar({ tipo: 'atualizacao', versao: nova });
});

ipcMain.on('iniciar', async (_e, modo) => {
  if (rodando) return;
  rodando = true;
  try {
    if (modo === 'instalar') await instalarTudo();
    enviar({ tipo: 'tarefa', id: 0, estado: 'fazendo', texto: 'Conferindo se ficou tudo no lugar' });
    enviar({ tipo: 'fim', grupos: await conferencia(), soConferiu: modo !== 'instalar' });
  } catch (e) {
    fs.appendFileSync(path.join(PASTA, 'registro.log'), `[app] ${e.stack || e.message}\n`);
    enviar({ tipo: 'falha', texto: String(e.message || e).split('\n')[0] });
  } finally {
    rodando = false;
  }
});

ipcMain.on('resposta', (_e, { id, valor }) => {
  const r = pendentes.get(id);
  if (r) { pendentes.delete(id); r(valor); }
});
ipcMain.on('abrir-link', (_e, url) => { if (/^https?:\/\//.test(url)) shell.openExternal(url); });
ipcMain.on('copiar', (_e, texto) => clipboard.writeText(String(texto)));
ipcMain.on('abrir-claude', () => abrirClaude());
ipcMain.on('atualizar', () => atualizarApp());
ipcMain.on('mostrar-registro', () => shell.openPath(path.join(PASTA, 'registro.log')));
// Nos testes, guarda um print de cada tela pra conferir o visual depois.
ipcMain.handle('print', async (_e, nome) => {
  if (!TESTE || !janela) return;
  const dir = path.join(PASTA, 'telas');
  fs.mkdirSync(dir, { recursive: true });
  const img = await janela.webContents.capturePage();
  fs.writeFileSync(path.join(dir, `${String(fs.readdirSync(dir).length + 1).padStart(2, '0')}-${nome}.png`), img.toPNG());
});

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (janela) { if (janela.isMinimized()) janela.restore(); janela.focus(); } });
  app.whenReady().then(async () => {
    const { ui } = await importarSetuper('ui.js');
    Object.assign(ui, criarUiApp(enviar, pedir));
    criarJanela();
  });
  app.on('window-all-closed', () => app.quit());
}
