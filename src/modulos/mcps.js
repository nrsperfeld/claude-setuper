// Catálogo de MCPs: ferramentas externas que o Claude passa a saber usar (Notion, Figma, Canva...).
import path from 'node:path';
import fs from 'node:fs';
import { ui } from '../ui.js';

export const id = 'mcps';
export const nome = 'Ferramentas conectadas (Notion, Figma, Canva...)';
export const descricao = 'Liga o Claude às ferramentas que você já usa';
export const padrao = true;

export function catalogo(ctx) {
  return JSON.parse(fs.readFileSync(path.join(ctx.templates, 'mcps', 'catalogo.json'), 'utf8'));
}

async function instalados(ctx) {
  const out = await ctx.run('claude', ['mcp', 'list'], { ignorarErro: true, sempre: true, timeout: 60000 });
  return out.split('\n').map((l) => l.split(':')[0].trim()).filter(Boolean);
}

export async function verificar(ctx) {
  const escolhidos = ctx.estado.respostas?.mcps || [];
  if (!escolhidos.length) return [];
  const lista = (await ctx.existeComando('claude')) ? await instalados(ctx) : [];
  return escolhidos.map((m) => ({ item: `Ferramenta ${m}`, ok: lista.includes(m), dica: 'rode: claude-setuper --modulos mcps' }));
}

export async function instalar(ctx) {
  const escolhidos = ctx.resp.mcps || [];
  if (!escolhidos.length) return ui.info('Nenhuma ferramenta escolhida agora. Dá pra ligar depois com: claude-setuper --modulos mcps');
  if (ctx.semApps || ctx.dryRun) return;
  const cat = catalogo(ctx);
  const ja = await instalados(ctx);
  const comLogin = [];
  const semToken = [];
  await ui.tarefa('Ligando o Claude às suas ferramentas', 'Ferramentas ligadas', async (msg) => {
    for (const mid of escolhidos) {
      const m = cat.find((x) => x.id === mid);
      if (!m || (ja.includes(mid) && !m.token)) continue;
      msg(`Ligando ${m.nome}`);
      const args = ['mcp', 'add', '--scope', 'user'];
      // O MCP do GitHub não aceita o login pelo /mcp (não tem registro dinâmico de cliente): vai com o token do gh.
      if (m.token === 'gh') {
        await ctx.run('claude', ['mcp', 'remove', '--scope', 'user', m.id], { ignorarErro: true });
        const token = await ctx.run('gh', ['auth', 'token'], { ignorarErro: true });
        if (!token) { semToken.push(m); continue; }
        args.push('--header', `Authorization: Bearer ${token}`);
      }
      if (m.transporte === 'http') args.push('--transport', 'http', m.id, m.url);
      else args.push(m.id, '--', ...m.comando);
      await ctx.run('claude', args, { ignorarErro: true });
      if (m.login) comLogin.push(m);
    }
  });
  for (const m of comLogin) ui.info(`${m.nome}: ${m.login}`);
  for (const m of semToken) ui.aviso(`${m.nome}: fica pra depois, precisa da sua conta do GitHub conectada. Quando conectar, rode: claude-setuper --modulos github,mcps`);
}

export async function remover(ctx) {
  for (const mid of ctx.estado.respostas?.mcps || []) await ctx.run('claude', ['mcp', 'remove', '--scope', 'user', mid], { ignorarErro: true });
}
