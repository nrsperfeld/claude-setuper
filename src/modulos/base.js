// Módulo base: o que a máquina precisa ter antes de qualquer coisa.
import fs from 'node:fs';
import { ui } from '../ui.js';

export const id = 'base';
export const nome = 'Base da máquina';
export const nomeCurto = 'Preparar o computador';
export const descricao = 'Ferramentas de sistema, Node e o próprio Claude Code';
export const padrao = true;
export const obrigatorio = true;

export async function verificar(ctx) {
  const itens = [];
  if (ctx.plataforma === 'darwin') {
    itens.push({ item: 'Ferramentas da Apple (Xcode CLT)', ok: !!(await ctx.run('xcode-select', ['-p'], { ignorarErro: true, sempre: true })) });
    itens.push({ item: 'Homebrew', ok: await ctx.existeComando('brew'), dica: 'rode o instalador de novo' });
  }
  if (ctx.win) {
    itens.push({ item: 'winget (instalador do Windows)', ok: await ctx.existeComando('winget'), dica: 'instale o "Instalador de Aplicativo" pela Microsoft Store' });
    itens.push({ item: 'Git Bash (vem com o Git)', ok: await ctx.existeComando('bash') || ctx.existe('C:\\Program Files\\Git\\bin\\bash.exe'), dica: 'winget install -e --id Git.Git' });
  }
  itens.push({ item: 'Node', ok: await ctx.existeComando('node') });
  itens.push({ item: 'git', ok: await ctx.existeComando('git') });
  itens.push({ item: 'Claude Code', ok: await ctx.existeComando('claude') });
  itens.push({ item: 'Login no Claude', ok: await logado(ctx), dica: 'rode: claude auth login' });
  return itens;
}

export async function instalar(ctx) {
  if (ctx.plataforma === 'darwin') {
    await xcodeCLT(ctx);
    // O instalador do Claude Code só precisa da internet: roda junto com o Homebrew e o Node.
    pathLocalNoPerfil(ctx);
    ctx.adiantar('claude', () => instalarClaudeScript(ctx));
    await homebrew(ctx);
    adiantarDownloads(ctx);
  }
  await node(ctx);
  await git(ctx);
  await claudeCode(ctx);
  await loginClaude(ctx);
}

// Só no app: pede as ferramentas da Apple antes das perguntas, e a pessoa responde enquanto o Mac instala.
export async function adiantarFerramentasApple(ctx) {
  if (ctx.plataforma !== 'darwin' || ctx.semApps || ctx.dryRun) return;
  if (await cltPronto(ctx)) return;
  await ctx.run('xcode-select', ['--install'], { ignorarErro: true });
  ctx.cltPedido = true;
  await ui.confirmar('O Mac vai abrir uma janela pedindo pra instalar umas ferramentas da Apple', true, {
    sim: 'Já cliquei em Instalar', nao: '', figura: 'apple-ferramentas',
    explicacao: 'Clica em Instalar e depois em Concordo. O Mac leva de 3 a 10 minutos pra instalar, e enquanto isso eu te faço umas perguntas.',
  });
}

async function cltPronto(ctx) {
  return !!(await ctx.run('xcode-select', ['-p'], { ignorarErro: true, sempre: true }));
}

async function xcodeCLT(ctx) {
  if (await cltPronto(ctx)) return ui.ok('Ferramentas da Apple já estão instaladas');
  if (ctx.semApps) return;
  if (ctx.cltPedido) {
    ui.pausa('Esperando as ferramentas da Apple terminarem de instalar', [
      'Elas estão instalando numa janela da Apple, que pode estar atrás desta.',
      'Se você ainda não clicou em Instalar, procura essa janela e clica lá. Sem essas ferramentas eu não consigo seguir.',
    ], { figura: 'apple-ferramentas' });
  } else {
    ui.pausa('O Mac vai abrir uma janela pedindo pra instalar umas ferramentas da Apple', [
      'Clica em Instalar.',
      'Depois aparece o contrato: clica em Concordo.',
      'Demora entre 3 e 10 minutos. Eu fico esperando aqui.',
    ], { figura: 'apple-ferramentas' });
    await ctx.run('xcode-select', ['--install'], { ignorarErro: true });
  }
  // Se a pessoa fechar a janela da Apple sem instalar, ela volta a aparecer, em vez de eu esperar meia hora por nada.
  let semJanela = 0;
  const ok = await ctx.esperar(async () => {
    if (await cltPronto(ctx)) return true;
    semJanela = (await ctx.run('pgrep', ['-f', 'Install Command Line Developer Tools'], { ignorarErro: true, sempre: true })) ? 0 : semJanela + 1;
    if (semJanela >= 3) {
      semJanela = 0;
      await ctx.run('xcode-select', ['--install'], { ignorarErro: true });
    }
    return false;
  }, { intervalo: 5, limite: 1800, semEncurtar: true });
  if (!ok) throw new Error(ctx.app ? 'as ferramentas da Apple não terminaram de instalar. Se a janela da Apple sumiu, clica em Tentar de novo que ela aparece outra vez' : 'as ferramentas da Apple não terminaram de instalar');
  ui.ok('Ferramentas da Apple instaladas');
}

// Downloads dos próximos passos, em fila, enquanto a pessoa faz o login do Claude. Só baixa: cada passo
// continua instalando e conferindo do jeito de sempre, e baixa sozinho se o download adiantado não deu certo.
const DOWNLOADS_MAC = [
  { modulo: 'obsidian', args: ['--cask', 'obsidian'], apps: ['/Applications/Obsidian.app'] },
  { modulo: 'github', args: ['gh'], apps: ['/opt/homebrew/bin/gh', '/usr/local/bin/gh'] },
  { modulo: 'chrome', args: ['--cask', 'google-chrome'], apps: ['/Applications/Google Chrome.app'] },
  { modulo: 'maestri', args: ['--cask', 'maestri'], apps: ['/Applications/Maestri.app', '/Applications/Setapp/Maestri.app'] },
];

function adiantarDownloads(ctx) {
  const modulos = ctx.resp.modulos || [];
  let anterior = Promise.resolve(true);
  for (const d of DOWNLOADS_MAC) {
    if (!modulos.includes(d.modulo) || d.apps.some((a) => ctx.existe(a))) continue;
    const vez = anterior;
    ctx.adiantar(`brew:${d.modulo}`, async () => {
      await vez;
      await ctx.run('brew', ['fetch', ...d.args], { env: { HOMEBREW_NO_AUTO_UPDATE: '1' }, timeout: 15 * 60 * 1000 });
    });
    anterior = ctx.adiantado(`brew:${d.modulo}`);
  }
  ctx.adiantar('brew:fila', () => anterior);
}

// brew install depois do download adiantado. Se esbarrar num download que ainda corre em segundo plano,
// espera a fila terminar e tenta de novo uma vez.
export async function brewInstalar(ctx, modulo, args) {
  await ctx.adiantado(`brew:${modulo}`);
  try {
    await ctx.run('brew', ['install', ...args]);
  } catch (e) {
    if (!ctx.temAdiantado('brew:fila')) throw e;
    await ctx.adiantado('brew:fila');
    await ctx.run('brew', ['install', ...args]);
  }
}

async function homebrew(ctx) {
  brewNoPerfil(ctx);
  if (await ctx.existeComando('brew')) return ui.ok('Homebrew já está instalado');
  if (ctx.semApps) return;
  if (!(await ctx.run('id', ['-Gn'], { ignorarErro: true, sempre: true })).split(/\s+/).includes('admin')) {
    throw new Error('esse usuário do Mac não é administrador, e o Homebrew precisa de um. Peça acesso de administrador (Ajustes > Usuários e Grupos) e rode de novo');
  }
  ui.pausa('O Mac vai pedir a sua senha', ctx.app ? [
    'Vai aparecer uma janela pedindo a senha. É a mesma que você usa pra ligar o computador.',
    'Digita e clica em OK. Pode aparecer mais de uma vez.',
  ] : [
    'É a mesma senha que você usa pra ligar o computador.',
    'Ela não aparece enquanto você digita, é normal. Digita e aperta Enter.',
  ]);
  const script = await (await fetch('https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh')).text();
  // No app não tem Terminal: o instalador do Homebrew pede a senha pelo SUDO_ASKPASS, numa janela do Mac.
  const env = ctx.app && ctx.askpass ? { NONINTERACTIVE: '1', SUDO_ASKPASS: ctx.askpass } : { NONINTERACTIVE: '' };
  await ctx.runVisivel('/bin/bash', ['-c', script], { env });
  // Homebrew novo não entra no PATH do processo atual; adiciona.
  for (const p of ['/opt/homebrew/bin', '/usr/local/bin']) if (!process.env.PATH.includes(p)) process.env.PATH = `${p}:${process.env.PATH}`;
  brewNoPerfil(ctx);
  ui.ok('Homebrew instalado');
}

export async function winget(ctx, id) {
  await ctx.run('winget', ['install', '-e', '--id', id, '--source', 'winget', '--silent', '--accept-source-agreements', '--accept-package-agreements', '--disable-interactivity'], { ignorarErro: true, timeout: 20 * 60 * 1000 });
  atualizarPathWindows();
}

// Programas recém-instalados não entram no PATH do processo atual; acrescenta os lugares comuns.
function atualizarPathWindows() {
  if (process.platform !== 'win32') return;
  const extras = [
    'C:\\Program Files\\nodejs', 'C:\\Program Files\\Git\\cmd', 'C:\\Program Files\\Git\\bin', 'C:\\Program Files\\GitHub CLI',
    `${process.env.LOCALAPPDATA}\\Programs\\Git\\cmd`, `${process.env.APPDATA}\\npm`, `${process.env.USERPROFILE}\\.local\\bin`,
    `${process.env.LOCALAPPDATA}\\Microsoft\\WinGet\\Links`,
  ];
  for (const e of extras) if (!process.env.PATH.includes(e)) process.env.PATH = `${e};${process.env.PATH}`;
}

async function node(ctx) {
  if (await ctx.existeComando('node')) return ui.ok('Node já está instalado');
  if (ctx.semApps) return;
  await ui.tarefa('Instalando o Node', 'Node instalado', async () => {
    if (ctx.plataforma === 'darwin') await ctx.run('brew', ['install', 'node']);
    else if (ctx.win) await winget(ctx, 'OpenJS.NodeJS.LTS');
    else await ctx.runVisivel('/bin/bash', ['-c', 'curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash - && sudo apt-get install -y nodejs']);
  }, { demora: 'uns 2 minutos, é normal' });
}

async function git(ctx) {
  if (await ctx.existeComando('git')) {
    // No Windows o Claude Code precisa do Git Bash, que vem junto com o Git.
    if (ctx.win && !(await ctx.existeComando('bash')) && !ctx.existe('C:\\Program Files\\Git\\bin\\bash.exe') && !ctx.semApps) await winget(ctx, 'Git.Git');
    return;
  }
  if (ctx.semApps) return;
  await ui.tarefa('Instalando o git', 'git instalado', async () => {
    if (ctx.plataforma === 'darwin') await ctx.run('brew', ['install', 'git']);
    else if (ctx.win) await winget(ctx, 'Git.Git');
    else await ctx.runVisivel('/bin/bash', ['-c', 'sudo apt-get install -y git']);
  });
}

// O Homebrew não entra sozinho no perfil do shell, e o Claude fica em ~/.local/bin, fora do PATH padrão.
// Sem gravar os dois, uma janela nova do Terminal dá "command not found: claude" e os hooks não acham o node.
function gravarNoPerfil(ctx, marca, linha) {
  if (ctx.win || ctx.dryRun) return;
  for (const f of ['.zshrc', '.zprofile', '.bash_profile', '.bashrc']) {
    const p = `${ctx.homeReal}/${f}`;
    const atual = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
    if (atual.includes(marca)) continue;
    if (!atual && !['.zshrc', '.zprofile'].includes(f)) continue;
    fs.appendFileSync(p, `${atual && !atual.endsWith('\n') ? '\n' : ''}\n# Claude Setuper\n${linha}\n`);
  }
}

function brewNoPerfil(ctx) {
  const brew = ['/opt/homebrew/bin/brew', '/usr/local/bin/brew'].find((b) => fs.existsSync(b));
  if (brew) gravarNoPerfil(ctx, 'brew shellenv', `eval "$(${brew} shellenv)"`);
}

function pathLocalNoPerfil(ctx) {
  if (ctx.win) return;
  const local = `${ctx.homeReal}/.local/bin`;
  if (!process.env.PATH.split(':').includes(local)) process.env.PATH = `${local}:${process.env.PATH}`;
  gravarNoPerfil(ctx, '.local/bin', 'export PATH="$HOME/.local/bin:$PATH"');
}

// Instalador oficial (Mac e Linux). No Mac roda adiantado, junto com o Homebrew.
async function instalarClaudeScript(ctx) {
  if (await ctx.existeComando('claude')) return;
  const script = await (await fetch('https://claude.ai/install.sh')).text();
  await ctx.run('/bin/bash', ['-c', script]);
  const local = `${ctx.homeReal}/.local/bin`;
  if (!process.env.PATH.includes(local)) process.env.PATH = `${local}:${process.env.PATH}`;
}

async function claudeCode(ctx) {
  pathLocalNoPerfil(ctx);
  const adiantado = ctx.temAdiantado('claude');
  if (!adiantado && await ctx.existeComando('claude')) return ui.ok('Claude Code já está instalado');
  if (ctx.semApps) return;
  await ui.tarefa('Instalando o Claude Code', 'Claude Code instalado', async () => {
    // No Mac ele já veio instalando junto com o Homebrew; só confere e, se não deu, instala agora.
    if (adiantado && (await ctx.adiantado('claude')) && (await ctx.existeComando('claude'))) return;
    if (ctx.win) {
      await ctx.run('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', 'irm https://claude.ai/install.ps1 | iex'], { ignorarErro: true, timeout: 10 * 60 * 1000 });
      atualizarPathWindows();
    } else await instalarClaudeScript(ctx);
    if (!(await ctx.existeComando('claude'))) await ctx.run('npm', ['install', '-g', '@anthropic-ai/claude-code']);
    if (ctx.win) {
      // Grava .local\bin e a pasta do npm no PATH do usuário, senão janelas novas não acham o claude.
      const pastas = [`${process.env.USERPROFILE}\\.local\\bin`, `${process.env.APPDATA}\\npm`].map((p) => p.replace(/'/g, "''"));
      await ctx.run('powershell', ['-NoProfile', '-Command', `$a=[Environment]::GetEnvironmentVariable('Path','User'); foreach($p in @('${pastas.join("','")}')){ if((Test-Path $p) -and (($a -split ';') -notcontains $p)){ $a=$a.TrimEnd(';')+';'+$p } }; [Environment]::SetEnvironmentVariable('Path',$a,'User')`], { ignorarErro: true });
    }
  }, { demora: 'quase lá' });
}

async function loginClaude(ctx) {
  if (ctx.semApps || ctx.dryRun) return;
  if (await logado(ctx)) return ui.ok('Você já está logado no Claude');
  ui.pausa('Vou abrir o navegador pra você entrar na sua conta do Claude', [
    'Entra com o mesmo e-mail que você usa no Claude.',
    'Se ainda não tem conta, cria ali mesmo. Depois volta pra cá, eu continuo sozinho.',
    'Não feche esta janela: eu espero até 15 minutos.',
  ]);
  await ctx.runVisivel('claude', ['auth', 'login'], { ignorarErro: true });
  if (!(await logado(ctx))) ui.info('Estou esperando você terminar o login no navegador...');
  const ok = await ctx.esperar(() => logado(ctx), { intervalo: 3, limite: 900 });
  if (!ok) {
    // Sem login o resto ainda instala; o módulo fica marcado como pendente pra próxima rodada.
    const e = new Error(ctx.app
      ? 'o login no Claude ficou pra depois. No fim eu te mostro como terminar'
      : 'o login no Claude não terminou. Quando terminar, rode claude-setuper de novo, eu continuo de onde parei');
    e.continuar = true;
    throw e;
  }
  ui.ok('Login no Claude feito');
}

// `claude auth status` devolve JSON com loggedIn; versões antigas devolviam texto.
export async function logado(ctx) {
  if (!(await ctx.existeComando('claude'))) return false;
  const out = await ctx.run('claude', ['auth', 'status'], { ignorarErro: true, sempre: true, timeout: 20000 });
  try { return JSON.parse(out).loggedIn === true; } catch { return /logged in/i.test(out) && !/not logged/i.test(out); }
}
