// GitHub: instala o gh, conecta uma ou duas contas e deixa cada pasta na conta certa.
import path from 'node:path';
import fs from 'node:fs';
import { ui } from '../ui.js';

export const id = 'github';
export const nome = 'GitHub (guardar e versionar o trabalho)';
export const descricao = 'Conecta a sua conta do GitHub (e uma segunda, se tiver)';
export const padrao = true;

export async function verificar(ctx) {
  const temGh = await ctx.existeComando('gh');
  const status = temGh ? await ctx.run('gh', ['auth', 'status'], { ignorarErro: true, sempre: true }) : '';
  const contas = (status.match(/account (\S+)/g) || []).map((s) => s.replace('account ', ''));
  const nomeGit = await ctx.run('git', ['config', '--global', 'user.name'], { ignorarErro: true, sempre: true });
  return [
    { item: 'GitHub CLI (gh)', ok: temGh },
    { item: `${contas.length > 1 ? 'Contas conectadas' : 'Conta conectada'}${contas.length ? ': ' + contas.join(', ') : ''}`, ok: contas.length > 0, dica: 'rode: gh auth login' },
    { item: 'git sabe o seu nome e e-mail', ok: !!nomeGit },
  ];
}

export async function instalar(ctx) {
  if (!(await ctx.existeComando('gh'))) {
    if (ctx.semApps) return;
    await ui.tarefa('Instalando a ferramenta do GitHub', 'Ferramenta do GitHub instalada', async () => {
      if (ctx.plataforma === 'darwin') await ctx.run('brew', ['install', 'gh']);
      else if (ctx.win) await (await import('./base.js')).winget(ctx, 'GitHub.cli');
      else await ctx.runVisivel('/bin/bash', ['-c', 'sudo apt-get install -y gh || (type -p curl >/dev/null || sudo apt-get install -y curl) && curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null && sudo apt-get update && sudo apt-get install -y gh']);
    });
  }
  if (ctx.semApps || ctx.dryRun) return;

  const status = await ctx.run('gh', ['auth', 'status'], { ignorarErro: true, sempre: true });
  let contas = (status.match(/account (\S+)/g) || []).map((s) => s.replace('account ', ''));

  if (!contas.length) {
    if (!ctx.sim) {
      const tem = await ui.confirmar('Você já tem uma conta no GitHub?', false);
      if (!tem) {
        ui.pausa('Vou abrir a página pra criar sua conta no GitHub', [
          'É de graça. Usa o seu e-mail principal e escolhe um nome de usuário.',
          'Quando terminar de criar, volta aqui e aperta Enter.',
        ]);
        await ctx.abrirUrl('https://github.com/signup');
        await ui.perguntar('Criou a conta? Aperta Enter pra continuar.', { padrao: 'ok' });
      }
    }
    await login(ctx, 'a sua conta');
    contas = await listarContas(ctx);
  } else ui.ok(`Conta do GitHub já conectada: ${contas.join(', ')}`);

  await configurarGit(ctx, contas[0]);
  fs.mkdirSync(path.join(ctx.home, 'Projetos'), { recursive: true });

  if (!ctx.sim && contas.length < 2) {
    const segunda = await ui.confirmar('Quer conectar uma segunda conta do GitHub (por exemplo, a da empresa)?', false);
    if (segunda) {
      await login(ctx, 'a segunda conta');
      const novas = (await listarContas(ctx)).filter((c) => !contas.includes(c));
      if (novas[0]) await segundaConta(ctx, novas[0]);
    }
  }
}

async function login(ctx, qual) {
  ui.pausa(`Vou abrir o navegador pra conectar ${qual} do GitHub`, [
    'Vão aparecer duas perguntas em inglês aqui. Nas duas, só aperta Enter.',
    'Depois aparece um código de 8 letras. Copia ele.',
    'No navegador, cola o código, clica em Continuar e depois em Autorizar.',
    'Depois volta pra cá, eu continuo.',
  ]);
  await ctx.runVisivel('gh', ['auth', 'login', '--hostname', 'github.com', '--git-protocol', 'https', '--web', '--skip-ssh-key'], { ignorarErro: true });
}

async function listarContas(ctx) {
  const status = await ctx.run('gh', ['auth', 'status'], { ignorarErro: true, sempre: true });
  return (status.match(/account (\S+)/g) || []).map((s) => s.replace('account ', ''));
}

async function configurarGit(ctx, login) {
  if (!login) return;
  const nomeAtual = await ctx.run('git', ['config', '--global', 'user.name'], { ignorarErro: true, sempre: true });
  if (!nomeAtual) {
    const user = JSON.parse((await ctx.run('gh', ['api', 'user'], { ignorarErro: true })) || '{}');
    await ctx.run('git', ['config', '--global', 'user.name', user.name || login]);
    await ctx.run('git', ['config', '--global', 'user.email', user.email || `${user.id}+${login}@users.noreply.github.com`]);
  }
  await ctx.run('git', ['config', '--global', 'init.defaultBranch', 'main']);
  await ctx.run('gh', ['auth', 'setup-git'], { ignorarErro: true });
  ui.ok('git configurado com a sua conta');
}

async function segundaConta(ctx, login) {
  const pasta = path.join(ctx.home, 'Projetos', login);
  fs.mkdirSync(pasta, { recursive: true });
  const user = JSON.parse((await ctx.run('gh', ['api', 'user', '-H', `Authorization: token ${await ctx.run('gh', ['auth', 'token', '--user', login], { ignorarErro: true })}`], { ignorarErro: true })) || '{}');
  const cfg = path.join(ctx.home, `.gitconfig-${login}`);
  ctx.escrever(cfg, `[user]\n\tname = ${user.name || login}\n\temail = ${user.email || `${user.id}+${login}@users.noreply.github.com`}\n[credential "https://github.com"]\n\tusername = ${login}\n`);
  await ctx.run('git', ['config', '--global', `includeIf.gitdir/i:${ctx.posix(pasta)}/.path`, ctx.posix(cfg)]);
  // Volta a conta principal como ativa no gh.
  const contas = await listarContas(ctx);
  const principal = contas.find((c) => c !== login);
  if (principal) await ctx.run('gh', ['auth', 'switch', '--user', principal], { ignorarErro: true });
  ui.ok(`Segunda conta pronta: tudo que ficar em ${pasta} usa a conta ${login}`);
  ui.info('Dica: pra fazer o Claude usar a segunda conta num projeto, basta criar o projeto dentro dessa pasta.');
}
