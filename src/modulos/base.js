// Módulo base: o que a máquina precisa ter antes de qualquer coisa.
import { ui } from '../ui.js';

export const id = 'base';
export const nome = 'Base da máquina';
export const descricao = 'Ferramentas de sistema, Node e o próprio Claude Code';
export const padrao = true;
export const obrigatorio = true;

export async function verificar(ctx) {
  const itens = [];
  if (ctx.plataforma === 'darwin') {
    itens.push({ item: 'Ferramentas da Apple (Xcode CLT)', ok: !!(await ctx.run('xcode-select', ['-p'], { ignorarErro: true, sempre: true })) });
    itens.push({ item: 'Homebrew', ok: await ctx.existeComando('brew'), dica: 'rode o instalador de novo' });
  }
  itens.push({ item: 'Node', ok: await ctx.existeComando('node') });
  itens.push({ item: 'git', ok: await ctx.existeComando('git') });
  itens.push({ item: 'Claude Code', ok: await ctx.existeComando('claude') });
  itens.push({ item: 'Login no Claude', ok: await logado(ctx), dica: 'rode: claude auth login' });
  return itens;
}

export async function instalar(ctx) {
  if (ctx.plataforma === 'darwin') await xcodeCLT(ctx);
  if (ctx.plataforma === 'darwin') await homebrew(ctx);
  await node(ctx);
  await git(ctx);
  await claudeCode(ctx);
  await loginClaude(ctx);
}

async function xcodeCLT(ctx) {
  const tem = await ctx.run('xcode-select', ['-p'], { ignorarErro: true, sempre: true });
  if (tem) return ui.ok('Ferramentas da Apple já estão instaladas');
  if (ctx.semApps) return;
  ui.pausa('O Mac vai abrir uma janela pedindo pra instalar as "ferramentas de linha de comando"', [
    'Clica em Instalar e aceita o contrato.',
    'Demora entre 3 e 10 minutos. Eu fico esperando aqui.',
  ]);
  await ctx.run('xcode-select', ['--install'], { ignorarErro: true });
  const ok = await ctx.esperar(async () => !!(await ctx.run('xcode-select', ['-p'], { ignorarErro: true, sempre: true })), { intervalo: 5, limite: 1800 });
  if (!ok) throw new Error('as ferramentas da Apple não terminaram de instalar');
  ui.ok('Ferramentas da Apple instaladas');
}

async function homebrew(ctx) {
  if (await ctx.existeComando('brew')) return ui.ok('Homebrew já está instalado');
  if (ctx.semApps) return;
  ui.pausa('O Mac vai pedir a sua senha', [
    'É a mesma senha que você usa pra ligar o computador.',
    'Ela não aparece enquanto você digita, é normal. Digita e aperta Enter.',
  ]);
  const script = await (await fetch('https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh')).text();
  await ctx.runVisivel('/bin/bash', ['-c', script], { env: { NONINTERACTIVE: '' } });
  // Homebrew novo não entra no PATH do processo atual; adiciona.
  for (const p of ['/opt/homebrew/bin', '/usr/local/bin']) if (!process.env.PATH.includes(p)) process.env.PATH = `${p}:${process.env.PATH}`;
  ui.ok('Homebrew instalado');
}

async function node(ctx) {
  if (await ctx.existeComando('node')) return ui.ok('Node já está instalado');
  if (ctx.semApps) return;
  await ui.tarefa('Instalando o Node', 'Node instalado', async () => {
    if (ctx.plataforma === 'darwin') await ctx.run('brew', ['install', 'node']);
    else await ctx.runVisivel('/bin/bash', ['-c', 'curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash - && sudo apt-get install -y nodejs']);
  }, { demora: 'uns 2 minutos, é normal' });
}

async function git(ctx) {
  if (await ctx.existeComando('git')) return;
  if (ctx.semApps) return;
  await ui.tarefa('Instalando o git', 'git instalado', async () => {
    if (ctx.plataforma === 'darwin') await ctx.run('brew', ['install', 'git']);
    else await ctx.runVisivel('/bin/bash', ['-c', 'sudo apt-get install -y git']);
  });
}

async function claudeCode(ctx) {
  if (await ctx.existeComando('claude')) return ui.ok('Claude Code já está instalado');
  if (ctx.semApps) return;
  await ui.tarefa('Instalando o Claude Code', 'Claude Code instalado', async () => {
    const script = await (await fetch('https://claude.ai/install.sh')).text();
    await ctx.run('/bin/bash', ['-c', script]);
    const local = `${ctx.homeReal}/.local/bin`;
    if (!process.env.PATH.includes(local)) process.env.PATH = `${local}:${process.env.PATH}`;
    if (!(await ctx.existeComando('claude'))) await ctx.run('npm', ['install', '-g', '@anthropic-ai/claude-code']);
  }, { demora: 'quase lá' });
}

async function loginClaude(ctx) {
  if (ctx.semApps || ctx.dryRun) return;
  if (await logado(ctx)) return ui.ok('Você já está logado no Claude');
  ui.pausa('Vou abrir o navegador pra você entrar na sua conta do Claude', [
    'Entra com o mesmo e-mail que você usa no Claude.',
    'Se ainda não tem conta, cria ali mesmo. Depois volta pra cá, eu continuo sozinho.',
  ]);
  await ctx.runVisivel('claude', ['auth', 'login'], { ignorarErro: true });
  const ok = await ctx.esperar(() => logado(ctx), { intervalo: 3, limite: 600 });
  if (!ok) throw new Error('o login no Claude não foi concluído');
  ui.ok('Login no Claude feito');
}

// `claude auth status` devolve JSON com loggedIn; versões antigas devolviam texto.
export async function logado(ctx) {
  if (!(await ctx.existeComando('claude'))) return false;
  const out = await ctx.run('claude', ['auth', 'status'], { ignorarErro: true, sempre: true, timeout: 20000 });
  try { return JSON.parse(out).loggedIn === true; } catch { return /logged in/i.test(out) && !/not logged/i.test(out); }
}
