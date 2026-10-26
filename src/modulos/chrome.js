// Chrome: a extensão "Claude" no Google Chrome, pro Claude navegar e preencher coisas na internet.
import path from 'node:path';
import fs from 'node:fs';
import { ui } from '../ui.js';

export const id = 'chrome';
export const nome = 'Claude no Chrome (navegar na internet)';
export const nomeCurto = 'Claude no Chrome';
export const descricao = 'Extensão que deixa o Claude usar o seu navegador';
export const padrao = true;

const EXT_ID = 'fcoeoabgfenejglbffodgkkbkcdhcgfn';
const LOJA = `https://chromewebstore.google.com/detail/${EXT_ID}`;

function dirChrome(ctx) {
  if (ctx.plataforma === 'darwin') return path.join(ctx.home, 'Library/Application Support/Google/Chrome');
  if (ctx.win) return path.join(ctx.localAppData(), 'Google', 'Chrome', 'User Data');
  return path.join(ctx.home, '.config/google-chrome');
}

function chromeInstalado(ctx) {
  if (ctx.plataforma === 'darwin') return ctx.existe('/Applications/Google Chrome.app');
  if (ctx.win) return ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe', path.join(ctx.localAppData(), 'Google', 'Chrome', 'Application', 'chrome.exe')].some((p) => ctx.existe(p));
  return false;
}

function extensaoInstalada(ctx) {
  const d = dirChrome(ctx);
  if (!fs.existsSync(d)) return false;
  return fs.readdirSync(d).some((perfil) => fs.existsSync(path.join(d, perfil, 'Extensions', EXT_ID)));
}

export async function verificar(ctx) {
  const temChrome = chromeInstalado(ctx) || (await ctx.existeComando('google-chrome'));
  return [
    { item: 'Google Chrome', ok: temChrome },
    { item: 'Extensão Claude no Chrome', ok: extensaoInstalada(ctx), dica: `instale em ${LOJA}` },
  ];
}

export async function instalar(ctx) {
  const temChrome = chromeInstalado(ctx) || (await ctx.existeComando('google-chrome'));
  if (!temChrome) {
    if (ctx.semApps) return;
    const quer = ctx.sim ? true : await ui.confirmar('Posso instalar o Google Chrome?', true, {
      sim: 'Sim, pode instalar', nao: 'Agora não',
      explicacao: 'O Chrome é o navegador que o Claude sabe usar sozinho: ele abre sites, preenche formulários e pesquisa por você. Você continua usando o seu navegador de sempre no dia a dia.',
    });
    if (!quer) return ui.info(ctx.app ? 'Tudo bem, deixei o Chrome pra depois.' : 'Tudo bem, pulei o Chrome. Dá pra instalar depois com: claude-setuper --modulos chrome');
    await ui.tarefa('Instalando o Google Chrome', 'Chrome instalado', async () => {
      if (ctx.plataforma === 'darwin') await (await import('./base.js')).brewInstalar(ctx, 'chrome', ['--cask', 'google-chrome']);
      else if (ctx.win) await (await import('./base.js')).winget(ctx, 'Google.Chrome');
      else await ctx.runVisivel('/bin/bash', ['-c', 'wget -qO /tmp/chrome.deb https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb && sudo apt-get install -y /tmp/chrome.deb']);
    }, { demora: 'uns 2 minutos, é normal' });
  }

  if (extensaoInstalada(ctx)) return ui.ok('Extensão do Claude já está no Chrome');
  if (ctx.semApps || ctx.dryRun) return;

  ui.pausa('Agora é no Chrome: adicionar a extensão do Claude', ctx.app ? [
    'Abri o Chrome na página da extensão do Claude.',
    'Lá no Chrome, clica em "Usar no Chrome" e depois em "Adicionar extensão". Quando ela entrar, eu sigo sozinho.',
    'O Chrome não abriu nessa página? Clica em "Abrir a página da extensão", aqui embaixo.',
  ] : [
    'Vou abrir o Chrome na página da extensão do Claude.',
    'Lá no Chrome, clica no botão azul "Usar no Chrome" (ou "Adicionar ao Chrome") e depois em "Adicionar extensão".',
    `Se o Chrome não abrir nessa página, abre este link nele: ${LOJA}`,
    'Quando a extensão entrar, eu sigo sozinho.',
  ], { figura: 'chrome-extensao', acoes: [{ rotulo: 'Abrir a página da extensão', url: LOJA }], pular: 'Seguir sem a extensão' });
  await abrirLoja(ctx);
  const lembrete = setTimeout(() => ui.info('Ainda não vi a extensão chegar. Se travou, clica em "Abrir a página da extensão" ou em "Pedir ajuda".'), 90_000);
  const ok = await ctx.esperar(async () => extensaoInstalada(ctx) || ui.pulou(), { intervalo: 3, limite: 600 }).finally(() => clearTimeout(lembrete));
  if (ok && !extensaoInstalada(ctx)) return ui.info('Tudo bem, a extensão fica pra depois. No fim eu te mostro como fazer.');
  if (ok) ui.ok('Extensão instalada. O Claude já pode usar o seu Chrome.');
  else ui.aviso('Não vi a extensão aparecer. Sem problema: dá pra instalar depois pelo link que fica nas notas do Maestri.');
}

// Chrome recém-instalado abre na tela de boas-vindas e engole o link da loja. Abre sem essa tela e,
// se ele acabou de ser aberto, manda o link de novo quando a janela já existe.
async function abrirLoja(ctx) {
  if (ctx.plataforma !== 'darwin') {
    if (ctx.win) await ctx.run('cmd.exe', ['/c', 'start', 'chrome', '--no-first-run', '--no-default-browser-check', LOJA], { ignorarErro: true });
    else await ctx.run('google-chrome', ['--no-first-run', LOJA], { ignorarErro: true });
    return;
  }
  const rodando = async () => !!(await ctx.run('pgrep', ['-x', 'Google Chrome'], { ignorarErro: true, sempre: true }));
  const jaAberto = await rodando();
  await ctx.run('open', ['-a', 'Google Chrome', '--args', '--no-first-run', '--no-default-browser-check', LOJA], { ignorarErro: true });
  if (jaAberto) return ctx.run('open', ['-a', 'Google Chrome', LOJA], { ignorarErro: true });
  for (let i = 0; i < 3 && !(await ctx.esperar(rodando, { intervalo: 1, limite: 20 })); i++) {
    await ctx.run('open', ['-a', 'Google Chrome', LOJA], { ignorarErro: true });
  }
  await new Promise((r) => setTimeout(r, 6000));
  if (!extensaoInstalada(ctx)) await ctx.run('open', ['-a', 'Google Chrome', LOJA], { ignorarErro: true });
}
