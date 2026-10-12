// Vercel: publicar páginas e sites na internet com um pedido ao Claude.
import path from 'node:path';
import { ui } from '../ui.js';

export const id = 'vercel';
export const nome = 'Vercel (publicar sites na internet)';
export const descricao = 'Deixa o Claude colocar páginas no ar com um pedido seu';
export const padrao = true;

export async function verificar(ctx) {
  const tem = await ctx.existeComando('vercel');
  const quem = tem ? await ctx.run('vercel', ['whoami'], { ignorarErro: true, sempre: true, timeout: 20000 }) : '';
  return [
    { item: 'Vercel CLI', ok: tem },
    { item: `Login na Vercel${quem && !/error/i.test(quem) ? ': ' + quem.split('\n').pop() : ''}`, ok: !!quem && !/error|not/i.test(quem), dica: 'rode: vercel login' },
    { item: 'Skill /publicar', ok: ctx.existe(path.join(ctx.claudeDir, 'skills', 'publicar', 'SKILL.md')) },
  ];
}

export async function instalar(ctx) {
  ctx.copiarTemplate('skills/publicar.md', path.join(ctx.claudeDir, 'skills', 'publicar', 'SKILL.md'));
  if (!(await ctx.existeComando('vercel'))) {
    if (ctx.semApps) return;
    await ui.tarefa('Instalando a ferramenta da Vercel', 'Ferramenta da Vercel instalada', () => ctx.run('npm', ['install', '-g', 'vercel']));
  }
  if (ctx.semApps || ctx.dryRun) return;

  const quem = await ctx.run('vercel', ['whoami'], { ignorarErro: true, sempre: true, timeout: 20000 });
  if (quem && !/error|not/i.test(quem)) return ui.ok(`Você já está logado na Vercel como ${quem.split('\n').pop()}`);

  if (!ctx.sim) {
    const tem = await ui.confirmar('Você já tem conta na Vercel? (é onde os sites ficam hospedados, de graça)', false);
    if (!tem) {
      ui.pausa('Vou abrir a página pra criar sua conta na Vercel', [
        'Escolhe "Continue with GitHub" e autoriza. Fica tudo ligado numa conta só.',
        'Quando terminar, volta aqui e aperta Enter.',
      ]);
      await ctx.abrirUrl('https://vercel.com/signup');
      await ui.perguntar('Criou a conta? Aperta Enter pra continuar.', { padrao: 'ok' });
    }
  }
  ui.pausa('Vou abrir o navegador pra conectar a Vercel', ['Escolhe "Continue with GitHub" e autoriza.', 'Depois volta pra cá.']);
  await ctx.runVisivel('vercel', ['login'], { ignorarErro: true });
  const ok = await ctx.esperar(async () => {
    const q = await ctx.run('vercel', ['whoami'], { ignorarErro: true, sempre: true, timeout: 20000 });
    return !!q && !/error|not/i.test(q);
  }, { intervalo: 3, limite: 300 });
  if (ok) ui.ok('Vercel conectada. Agora é só pedir pro Claude "publica isso na internet".');
  else ui.aviso('Não consegui confirmar o login na Vercel. Dá pra fazer depois com: vercel login');
}

export async function remover(ctx) {
  const { rmSync } = await import('node:fs');
  rmSync(path.join(ctx.claudeDir, 'skills', 'publicar'), { recursive: true, force: true });
}
