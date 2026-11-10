// Módulo base: o que a máquina precisa ter antes de qualquer coisa.
import fs from 'node:fs';
import { ui } from '../ui.js';
import { macIntel, instalarSemBrew, colocarNoPath } from './semBrew.js';

export const id = 'base';
export const nome = 'Base da máquina';
export const nomeCurto = 'Preparar o computador';
export const descricao = 'Ferramentas de sistema, Node e a IA';
export const padrao = true;
export const obrigatorio = true;

export async function verificar(ctx) {
  const itens = [];
  if (ctx.plataforma === 'darwin') {
    itens.push({ item: 'Ferramentas da Apple (Xcode CLT)', ok: !!(await ctx.run('xcode-select', ['-p'], { ignorarErro: true, sempre: true })) });
    if (!(await macIntel(ctx))) itens.push({ item: 'Homebrew', ok: await ctx.existeComando('brew'), dica: 'rode o instalador de novo' });
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
  // O que correu durante as perguntas: termina antes de seguir. Se falhou, os passos abaixo refazem do jeito normal.
  if (ctx.temAdiantado('preparo')) await ctx.adiantado('preparo');
  if (ctx.plataforma === 'darwin') {
    await xcodeCLT(ctx);
    // O instalador do Claude Code só precisa da internet: roda junto com o Homebrew e o Node.
    pathLocalNoPerfil(ctx);
    ctx.adiantar('claude', () => instalarClaudeScript(ctx));
    nodeLocalNoPerfil(ctx);
    if (!(await macIntel(ctx))) {
      await homebrew(ctx);
      adiantarDownloads(ctx);
    }
  }
  if (ctx.win && ctx.app) await garantirWinget(ctx);
  await node(ctx);
  await git(ctx);
  await claudeCode(ctx);
  await loginClaude(ctx);
}

// Só no app: pede as ferramentas da Apple e deixa o preparo correndo atrás enquanto a pessoa responde as perguntas.
// Depois de clicar em Instalar, ela responde e o Mac instala, baixa o Claude e o Homebrew, tudo ao mesmo tempo.
export async function adiantarPreparo(ctx) {
  if (ctx.plataforma !== 'darwin' || ctx.semApps || ctx.dryRun) return;
  if (!(await cltPronto(ctx))) {
    ctx.cltPedido = true;
    for (let vez = 0; vez < 3; vez++) {
      await ctx.run('xcode-select', ['--install'], { ignorarErro: true });
      trazerJanelaApple(ctx);
      const viu = await ui.confirmarFora({
        rotulo: 'Ferramentas da Apple',
        passos: [
          { titulo: 'Clica em Instalar, na janela da Apple', linhas: [vez === 0 ? 'Ela é do próprio Mac, pode confiar.' : 'Pedi a janela de novo. Ela pode estar atrás das outras janelas abertas.'], figura: 'apple-ferramentas' },
          { titulo: 'Clica em Concordo', linhas: ['Depois é só esperar: a Apple leva de 3 a 10 minutos, e enquanto isso eu te faço umas perguntas.'], figura: 'apple-contrato' },
        ],
        concluir: 'Já cliquei', nao: vez < 2 ? 'Não apareceu' : '',
      });
      if (viu || await cltPronto(ctx)) break;
    }
  }
  ctx.adiantar('preparo', async () => {
    await xcodeCLT(ctx);
    pathLocalNoPerfil(ctx);
    ctx.adiantar('claude', () => instalarClaudeScript(ctx));
    nodeLocalNoPerfil(ctx);
    if (!(await macIntel(ctx))) {
      await homebrew(ctx);
      adiantarDownloads(ctx);
    }
  });
}

// A janela da Apple costuma abrir atrás das outras. Tenta trazer pra frente; se não der, o guia explica onde procurar.
function trazerJanelaApple(ctx) {
  setTimeout(() => ctx.run('osascript', ['-e', 'tell application id "com.apple.dt.CommandLineTools.installondemand" to activate'], { ignorarErro: true, timeout: 5000 }), 1500);
}

async function cltPronto(ctx) {
  return !!(await ctx.run('xcode-select', ['-p'], { ignorarErro: true, sempre: true }));
}

async function xcodeCLT(ctx) {
  if (await cltPronto(ctx)) return ui.ok('Ferramentas da Apple já estão instaladas');
  if (ctx.semApps) return;
  if (ctx.cltPedido) {
    // Aqui a pessoa já clicou: é espera, não pedido. Sem a mão e sem o desenho, pra não parecer que ela errou.
    ui.pausa('As ferramentas da Apple estão instalando', [
      'Leva de 3 a 10 minutos. Você não precisa fazer nada, é só esperar.',
      'A janela da Apple mostra uma barrinha andando. Quando ela terminar, pode clicar em Concluído.',
      'Se a janela da Apple sumiu antes de terminar, eu abro ela de novo sozinho.',
    ], { espera: true });
  } else {
    ui.pausa('Clica em Instalar, na janela da Apple', [
      'Depois aparece o contrato: clica em Concordo.',
      'Demora entre 3 e 10 minutos. Eu fico esperando aqui.',
    ], { figura: 'apple-ferramentas', rotulo: 'Ferramentas da Apple' });
    await ctx.run('xcode-select', ['--install'], { ignorarErro: true });
    trazerJanelaApple(ctx);
  }
  // Se a pessoa fechar a janela da Apple sem instalar, ela volta a aparecer, em vez de eu esperar meia hora por nada.
  // Enquanto isso, o cartão diz o que está acontecendo e há quanto tempo, pra ninguém achar que travou.
  let semJanela = 0;
  let viuJanela = !!ctx.cltPedido;
  let ultimoAviso = '';
  const inicio = Date.now();
  const ok = await ctx.esperar(async () => {
    if (await cltPronto(ctx)) return true;
    const janela = !!(await ctx.run('pgrep', ['-f', 'Install Command Line Developer Tools'], { ignorarErro: true, sempre: true }));
    semJanela = janela ? 0 : semJanela + 1;
    if (janela && !viuJanela) {
      // A pessoa já clicou em Instalar: troca o cartão de pedido pelo de espera.
      viuJanela = true;
      ui.pausa('As ferramentas da Apple estão instalando', [
        'Leva de 3 a 10 minutos. Você não precisa fazer nada, é só esperar.',
        'A janela da Apple mostra uma barrinha andando. Quando ela terminar, pode clicar em Concluído.',
        'Assim que a Apple terminar, eu sigo sozinho pro próximo passo.',
      ], { espera: true });
    }
    if (semJanela >= 3) {
      semJanela = 0;
      await ctx.run('xcode-select', ['--install'], { ignorarErro: true });
    }
    const min = Math.floor((Date.now() - inicio) / 60000);
    const quanto = min < 1 ? 'menos de 1 minuto' : min === 1 ? '1 minuto' : `${min} minutos`;
    const aviso = janela
      ? `Esperando a Apple terminar de instalar. Já faz ${quanto}, costuma levar de 3 a 10 minutos.`
      : `Esperando a janela da Apple. Se ela não estiver na frente, procure nas outras janelas abertas. Já faz ${quanto}.`;
    if (aviso !== ultimoAviso) { ultimoAviso = aviso; ui.info(aviso); }
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
  // Durante as perguntas ainda não dá pra saber o perfil: baixa o que a maioria usa, e só baixa, sem instalar nada.
  const modulos = ctx.resp.modulos || ['obsidian', 'chrome', 'maestri'];
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
  if (await macIntel(ctx)) return instalarSemBrew(ctx, args);
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
  if (await ctx.existeComando('brew')) return ui.ok('Ferramentas de base já estão instaladas');
  if (ctx.semApps) return;
  if (!(await ctx.run('id', ['-Gn'], { ignorarErro: true, sempre: true })).split(/\s+/).includes('admin')) {
    throw new Error('esse usuário do Mac não é administrador, e o Homebrew precisa de um. Peça acesso de administrador (Ajustes > Usuários e Grupos) e rode de novo');
  }
  ui.pausa(ctx.app ? 'Digita a senha do computador' : 'O Mac vai pedir a sua senha', ctx.app ? [
    'É a mesma da tela de bloqueio, não a do e-mail nem a do iCloud. Ela não fica guardada em lugar nenhum. A janela pode aparecer mais de uma vez, é normal.',
  ] : [
    'É a senha que você digita na tela de bloqueio, pra desbloquear o computador. Não é a senha do e-mail, do iCloud nem do Claude.',
    'Ela não aparece enquanto você digita, é normal. Digita e aperta Enter.',
  ], { figura: 'senha', rotulo: 'Senha do computador' });
  const script = await (await fetch('https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh')).text();
  // No app não tem Terminal: o instalador do Homebrew pede a senha pelo SUDO_ASKPASS, numa janela do Mac.
  const env = ctx.app && ctx.askpass ? { NONINTERACTIVE: '1', SUDO_ASKPASS: ctx.askpass } : { NONINTERACTIVE: '' };
  await ctx.runVisivel('/bin/bash', ['-c', script], { env });
  // Homebrew novo não entra no PATH do processo atual; adiciona.
  for (const p of ['/opt/homebrew/bin', '/usr/local/bin']) if (!process.env.PATH.includes(p)) process.env.PATH = `${p}:${process.env.PATH}`;
  brewNoPerfil(ctx);
  ui.ok('Ferramentas de base instaladas');
}

// Estes instalam pra todas as contas do computador, e o Windows pede licença numa janela (o UAC).
const PEDEM_LICENCA = new Set(['Git.Git', 'OpenJS.NodeJS.LTS', 'GitHub.cli', 'Google.Chrome']);

export async function winget(ctx, id) {
  const avisar = ctx.app && !ctx.dryRun && PEDEM_LICENCA.has(id);
  if (avisar) {
    ui.pausa('Se o Windows perguntar, clica em Sim', [
      'É o próprio Windows pedindo licença pra instalar, e pode aparecer mais de uma vez. Se a janela não vier pra frente, procura um escudo piscando na barra de tarefas.',
    ], { figura: 'windows-sim', rotulo: 'Permissão do Windows' });
  }
  await ctx.run('winget', ['install', '-e', '--id', id, '--source', 'winget', '--silent', '--accept-source-agreements', '--accept-package-agreements', '--disable-interactivity'], { ignorarErro: true, timeout: 20 * 60 * 1000 });
  if (avisar) ui.fimDaPausa?.();
  atualizarPathWindows();
}

// O winget vem no Windows 10 e 11, mas numa máquina nova pode faltar até a Microsoft Store atualizar o "Instalador de Aplicativo".
async function garantirWinget(ctx) {
  if (ctx.semApps || ctx.dryRun || (await ctx.existeComando('winget'))) return;
  await ctx.abrirUrl('ms-windows-store://pdp/?ProductId=9NBLGGH4NNS1');
  await ui.confirmarFora({
    rotulo: 'Microsoft Store',
    passos: [{ titulo: 'Clica em Instalar ou Atualizar, na Microsoft Store', linhas: ['É o "Instalador de Aplicativo", do próprio Windows. Eu uso ele pra instalar o resto. Quando terminar, clica no botão aqui embaixo.'] }],
    concluir: 'Já terminou',
  });
  if (!(await ctx.existeComando('winget'))) throw new Error('o Instalador de Aplicativo da Microsoft ainda não está pronto. Espera a Microsoft Store terminar e clica em Tentar de novo');
}

// No app ninguém vê o erro do winget (a pessoa disse Não, ou a conta não tem licença): aqui ele vira uma frase e para.
async function conferirNoWindows(ctx, comando) {
  if (!ctx.win || !ctx.app || ctx.semApps || ctx.dryRun || (await ctx.existeComando(comando))) return;
  throw new Error('o Windows não deixou instalar uma parte que a IA precisa. Clica em Tentar de novo e, quando o Windows perguntar, clica em Sim. Se ele pedir uma senha de administrador que você não tem, chama quem cuida deste computador');
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
  if (await ctx.existeComando('node')) return ui.ok('Ferramentas de base já estão instaladas');
  if (ctx.semApps) return;
  await ui.tarefa('Instalando as ferramentas de base', 'Ferramentas de base instaladas', async () => {
    if (await macIntel(ctx)) await instalarSemBrew(ctx, ['node']);
    else if (ctx.plataforma === 'darwin') await ctx.run('brew', ['install', 'node']);
    else if (ctx.win) await winget(ctx, 'OpenJS.NodeJS.LTS');
    else await ctx.runVisivel('/bin/bash', ['-c', 'curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash - && sudo apt-get install -y nodejs']);
  }, { demora: 'uns 2 minutos, é normal' });
  await conferirNoWindows(ctx, 'node');
  nodeLocalNoPerfil(ctx);
}

async function git(ctx) {
  if (await ctx.existeComando('git')) {
    // No Windows o Claude Code precisa do Git Bash, que vem junto com o Git.
    if (ctx.win && !(await ctx.existeComando('bash')) && !ctx.existe('C:\\Program Files\\Git\\bin\\bash.exe') && !ctx.semApps) await winget(ctx, 'Git.Git');
    return;
  }
  if (ctx.semApps) return;
  await ui.tarefa('Instalando as ferramentas de base', 'Ferramentas de base instaladas', async () => {
    if (ctx.plataforma === 'darwin') await ctx.run('brew', ['install', 'git']);
    else if (ctx.win) await winget(ctx, 'Git.Git');
    else await ctx.runVisivel('/bin/bash', ['-c', 'sudo apt-get install -y git']);
  });
  await conferirNoWindows(ctx, 'git');
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

// Mac Intel: o Node vem do site oficial pra ~/.local/node, fora do PATH padrão.
function nodeLocalNoPerfil(ctx) {
  const bin = `${ctx.homeReal}/.local/node/bin`;
  if (!fs.existsSync(bin)) return;
  colocarNoPath(bin);
  gravarNoPerfil(ctx, '.local/node/bin', 'export PATH="$HOME/.local/node/bin:$PATH"');
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
  if (!adiantado && await ctx.existeComando('claude')) return ui.ok('O Claude já está instalado');
  if (ctx.semApps) return;
  await ui.tarefa('Instalando a IA', 'A IA foi instalada', async () => {
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
  }, { demora: 'uns 2 minutos' });
}

async function loginClaude(ctx) {
  if (ctx.semApps || ctx.dryRun) return;
  if (await logado(ctx)) return ui.ok('Você já está logado no Claude');
  ui.pausa(ctx.app ? 'Entra na sua conta do Claude' : 'Vou abrir o navegador pra você entrar na sua conta do Claude', ctx.app ? [
    'Claude é o nome da IA que estou instalando. Abri a página no navegador: se ainda não tem conta, dá pra criar ali mesmo. Ela precisa de plano pago (Pro ou maior), e a própria página mostra como assinar. Quando disser que deu certo, eu sigo sozinho.',
  ] : [
    'Entra com o mesmo e-mail que você usa no Claude.',
    'Pra usar a IA no computador, a conta precisa ter um plano pago (Pro ou maior).',
    'Se ainda não tem conta, cria ali mesmo. Depois volta pra cá, eu continuo sozinho. Eu espero até 15 minutos.',
  ], { pular: 'Entrar depois', figura: 'claude-login', rotulo: 'Conta do Claude' });
  // "Fazer o login depois" encerra o login que está esperando no navegador; o resto da instalação segue.
  const parar = new AbortController();
  const vigia = setInterval(() => ui.pulou() && parar.abort(), 1000);
  try {
    await ctx.runVisivel('claude', ['auth', 'login'], { ignorarErro: true, sinal: parar.signal });
    if (!(await logado(ctx)) && !ui.pulou()) ui.info('Estou esperando você terminar o login no navegador...');
    await ctx.esperar(async () => ui.pulou() || (await logado(ctx)), { intervalo: 3, limite: 900 });
  } finally {
    clearInterval(vigia);
  }
  if (!(await logado(ctx))) {
    // Sem login o resto ainda instala; o módulo fica marcado como pendente pra próxima rodada.
    const e = new Error(ctx.app
      ? 'o login na IA ficou pra depois. No fim eu te mostro como terminar'
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
