// atualizar: puxa a versão nova do Setuper e reaplica os módulos já instalados, sem perder o que a pessoa editou.
import path from 'node:path';
import fs from 'node:fs';
import { ui } from './ui.js';
import { modulosParaPlataforma } from './modulos/index.js';

export async function atualizar(ctx) {
  ui.abertura('Claude Setuper · atualizar', 'Puxando a versão nova e reaplicando o que você já tem');
  const emClone = fs.existsSync(path.join(ctx.raiz, '.git'));
  await ui.tarefa('Baixando a versão nova', 'Versão nova baixada', async () => {
    if (emClone) await ctx.run('git', ['-C', ctx.raiz, 'pull', '-q', '--ff-only'], { ignorarErro: true });
    else await ctx.run('npm', ['install', '-g', 'claude-setuper@latest'], { ignorarErro: true });
  });

  const ids = Object.keys(ctx.estado.modulos || {});
  if (!ids.length) return ui.encerramento('Nada instalado ainda. Rode: claude-setuper');
  ctx.sim = true;
  ctx.resp = { ...(ctx.estado.respostas || {}) };
  for (const m of modulosParaPlataforma(ids, ctx.plataforma)) {
    ui.linha();
    ui.passo('↻', '', m.nome);
    try {
      await m.instalar(ctx);
      ctx.estado.modulos[m.id] = { ok: true, em: new Date().toISOString() };
    } catch (e) {
      ui.erro(`${m.nome}: ${e.message}`);
    }
    ctx.salvarEstado();
  }
  ui.encerramento('Atualizado. Seus arquivos editados foram mantidos.');
}
