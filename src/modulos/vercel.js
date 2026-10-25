// Vercel: publicar páginas e sites na internet com um pedido ao Claude.
import path from 'node:path';
import { ui } from '../ui.js';

export const id = 'vercel';
export const nome = 'Vercel (publicar sites na internet)';
export const nomeCurto = 'Publicar sites';
export const descricao = 'Deixa o Claude colocar páginas no ar com um pedido seu';
export const padrao = true;

export async function verificar(ctx) {
  if (ctx.estado.pulados?.vercel) return [];
  const tem = await ctx.existeComando('vercel');
  const quem = tem ? await ctx.run('vercel', ['whoami'], { ignorarErro: true, sempre: true, timeout: 20000 }) : '';
  return [
    { item: 'Vercel CLI', ok: tem },
    { item: `Login na Vercel${quem && !/error/i.test(quem) ? ': ' + quem.split('\n').pop() : ''}`, ok: !!quem && !/error|not/i.test(quem), dica: 'rode: vercel login' },
    { item: 'Skill /publicar', ok: ctx.existe(path.join(ctx.claudeDir, 'skills', 'publicar', 'SKILL.md')) },
  ];
}

const PRA_QUE = 'A Vercel coloca na internet as páginas e sites que você pedir pro Claude criar: uma página de vendas, um cardápio, um formulário. Você pede "publica isso" e ele te devolve o link. É de graça e é opcional.';

export async function instalar(ctx) {
  let escolha = 'tenho';
  if (!ctx.sim && !ctx.semApps && !ctx.dryRun && !(await logadoNaVercel(ctx))) {
    escolha = await ui.escolher('Quer que o Claude consiga publicar sites pra você?', [
      { value: 'criar', label: 'Sim, e quero criar uma conta na Vercel', hint: 'é de graça; dá pra entrar com o GitHub' },
      { value: 'tenho', label: 'Sim, já tenho conta na Vercel' },
      { value: 'pular', label: 'Agora não', hint: 'dá pra ligar depois, abrindo o Claude Setuper de novo' },
    ], { padrao: 'criar', explicacao: PRA_QUE });
  }
  ctx.estado.pulados = { ...ctx.estado.pulados, vercel: escolha === 'pular' };
  if (escolha === 'pular') return ui.info('Tudo bem, deixei a publicação de sites pra depois.');
  ctx.copiarTemplate('skills/publicar.md', path.join(ctx.claudeDir, 'skills', 'publicar', 'SKILL.md'));
  if (!(await ctx.existeComando('vercel'))) {
    if (ctx.semApps) return;
    await ui.tarefa('Instalando a ferramenta da Vercel', 'Ferramenta da Vercel instalada', async () => { await ctx.run('npm', ['install', '-g', 'vercel']); });
  }
  if (!ctx.semApps && !ctx.dryRun) await ctx.run('vercel', ['telemetry', 'disable'], { ignorarErro: true, timeout: 30000 });
  if (ctx.semApps || ctx.dryRun) return;

  const quem = await ctx.run('vercel', ['whoami'], { ignorarErro: true, sempre: true, timeout: 20000 });
  if (quem && !/error|not/i.test(quem)) return ui.ok(`Você já está logado na Vercel como ${quem.split('\n').pop()}`);

  if (!ctx.sim) {
    if (escolha === 'criar') {
      ui.pausa('Vou abrir a página pra criar sua conta na Vercel', [
        'Escolhe "Continue with GitHub" e autoriza. Fica tudo ligado numa conta só.',
        ctx.app ? 'Quando terminar, volta pra cá.' : 'Quando terminar, volta aqui e aperta Enter.',
      ]);
      await ctx.abrirUrl('https://vercel.com/signup');
      if (ctx.app) await ui.confirmar('Já criou a conta na Vercel?', true);
      else await ui.perguntar('Criou a conta? Aperta Enter pra continuar.', { padrao: 'ok' });
    }
  }
  ui.pausa('Vou abrir o navegador pra conectar a Vercel', [
    'Vai aparecer aqui um link e um código (a tela fica em inglês, é normal).',
    ctx.app ? 'Se o navegador não abrir sozinho, clica no botão do link aqui embaixo.' : 'Se o navegador não abrir sozinho, segura a tecla Cmd e clica no link.',
    'No navegador, escolhe "Continue with GitHub" e autoriza. Depois volta pra cá.',
  ]);
  await ctx.runVisivel('vercel', ['login'], { ignorarErro: true });
  const ok = await ctx.esperar(async () => {
    const q = await ctx.run('vercel', ['whoami'], { ignorarErro: true, sempre: true, timeout: 20000 });
    return !!q && !/error|not/i.test(q);
  }, { intervalo: 3, limite: 300 });
  if (ok) ui.ok('Vercel conectada. Agora é só pedir pro Claude "publica isso na internet".');
  else ui.aviso(ctx.app ? 'Não vi o login na Vercel terminar. Sem problema, no fim eu te mostro o que ficou faltando.' : 'Não consegui confirmar o login na Vercel. Dá pra fazer depois com: vercel login');
}

async function logadoNaVercel(ctx) {
  if (!(await ctx.existeComando('vercel'))) return false;
  const q = await ctx.run('vercel', ['whoami'], { ignorarErro: true, sempre: true, timeout: 20000 });
  return !!q && !/error|not/i.test(q);
}

export async function remover(ctx) {
  const { rmSync } = await import('node:fs');
  rmSync(path.join(ctx.claudeDir, 'skills', 'publicar'), { recursive: true, force: true });
}
