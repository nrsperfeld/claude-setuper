// Atalho: no Windows e no Linux (sem Maestri), deixa um "Claude" na Área de Trabalho que abre o Claude com dois cliques,
// e no fim da instalação abre o Claude e o cofre do Obsidian lado a lado.
import path from 'node:path';
import fs from 'node:fs';
import { ui } from '../ui.js';

export const id = 'atalho';
export const nome = 'Atalho do Claude na Área de Trabalho';
export const descricao = 'Um ícone pra abrir o Claude sem precisar do terminal';
export const padrao = true;
export const plataformas = ['win32', 'linux'];

function caminhoAtalho(ctx) {
  return path.join(ctx.desktop(), ctx.win ? 'Claude.cmd' : 'Claude.sh');
}

export async function verificar(ctx) {
  return [{ item: 'Atalho "Claude" na Área de Trabalho', ok: ctx.existe(caminhoAtalho(ctx)) }];
}

export async function instalar(ctx) {
  const atalho = caminhoAtalho(ctx);
  const vault = ctx.resp.vault || ctx.estado.respostas?.vault || '';
  await ui.tarefa('Criando o atalho do Claude na Área de Trabalho', 'Atalho criado', async () => {
    fs.mkdirSync(ctx.desktop(), { recursive: true });
    const vars = { marcador: path.join(ctx.claudeDir, '.setuper-saudou'), trabalho: ctx.resp.trabalhoSeguro ?? ctx.resp.trabalho ?? '', vault, vaultUrl: `obsidian://open?path=${encodeURIComponent(vault)}` };
    ctx.escrever(atalho, ctx.template(ctx.win ? 'atalho/Claude.cmd' : 'atalho/Claude.sh', vars));
    if (!ctx.dryRun && !ctx.win) fs.chmodSync(atalho, 0o755);
  });

  if (ctx.semApps || ctx.dryRun) return;
  if (ctx.win) {
    if (vault) await ctx.abrirUrl(`obsidian://open?path=${encodeURIComponent(vault)}&file=${encodeURIComponent('Comece aqui')}`);
    await ctx.run('cmd.exe', ['/c', 'start', '""', atalho], { ignorarErro: true });
  } else {
    await ctx.run('x-terminal-emulator', ['-e', atalho], { ignorarErro: true });
  }
  ui.ok('O Claude está abrindo numa janela nova. Da próxima vez, é só dar dois cliques no "Claude" da Área de Trabalho.');
}

export async function remover(ctx) {
  fs.rmSync(caminhoAtalho(ctx), { force: true });
}
