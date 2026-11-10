// Catálogo de MCPs: ferramentas externas que o Claude passa a saber usar (Gmail, Drive, Notion, Figma...).
import path from 'node:path';
import fs from 'node:fs';
import { ui } from '../ui.js';
import { t } from '../i18n.js';

export const id = 'mcps';
export const nome = 'Ferramentas conectadas (Gmail, Drive, Notion...)';
export const nomeCurto = 'Apps conectados';
export const descricao = 'Liga a IA às ferramentas que você já usa';
export const padrao = true;

export function catalogo(ctx) {
  return JSON.parse(fs.readFileSync(path.join(ctx.dirTemplates('mcps'), 'catalogo.json'), 'utf8'));
}

async function instalados(ctx) {
  const out = await ctx.run('claude', ['mcp', 'list'], { ignorarErro: true, sempre: true, timeout: 60000 });
  return out.split('\n').map((l) => l.split(':')[0].trim()).filter(Boolean);
}

export async function verificar(ctx) {
  const escolhidos = ctx.estado.respostas?.mcps || [];
  if (!escolhidos.length) return [];
  const lista = (await ctx.existeComando('claude')) ? await instalados(ctx) : [];
  // Os conectores do claude.ai (Gmail, Drive, Agenda) ficam na conta da pessoa, não dá pra conferir daqui.
  const conectores = catalogo(ctx).filter((m) => m.conector).map((m) => m.id);
  return escolhidos.filter((m) => !conectores.includes(m))
    .map((m) => ({ item: `Ferramenta ${m}`, ok: lista.includes(m), dica: 'rode: claude-setuper --modulos mcps' }));
}

export async function instalar(ctx) {
  const escolhidos = ctx.resp.mcps || [];
  if (!escolhidos.length) return ui.info(ctx.app ? 'Nenhuma ferramenta escolhida agora. Dá pra ligar depois abrindo o Claude Setuper de novo.' : 'Nenhuma ferramenta escolhida agora. Dá pra ligar depois com: claude-setuper --modulos mcps');
  if (ctx.semApps || ctx.dryRun) return;
  const cat = catalogo(ctx);
  // No app os conectores (Gmail, Agenda...) ficam pro fim da aula; o Terminal segue ligando aqui.
  if (!ctx.app || ctx.opcional) await ligarConectores(ctx, cat.filter((m) => m.conector && escolhidos.includes(m.id)));
  if (ctx.opcional) return;
  if (!escolhidos.some((mid) => cat.find((x) => x.id === mid && !x.conector))) return;
  const ja = await instalados(ctx);
  const comLogin = [];
  const semToken = [];
  await ui.tarefa('Ligando a IA às suas ferramentas', 'Ferramentas ligadas', async (msg) => {
    for (const mid of escolhidos) {
      const m = cat.find((x) => x.id === mid);
      if (!m || m.conector || (ja.includes(mid) && !m.token)) continue;
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
  for (const m of semToken) ui.aviso(`${m.nome}: fica pra depois, precisa da sua conta do GitHub conectada. ${ctx.app ? 'Quando conectar, abra o Claude Setuper de novo.' : 'Quando conectar, rode: claude-setuper --modulos github,mcps'}`);
}

// Gmail, Drive e Agenda são conectores do claude.ai: liga uma vez no site, com a conta do Google,
// e eles aparecem sozinhos no Claude Code de quem entrou com a mesma conta do Claude.
async function ligarConectores(ctx, conectores) {
  if (!conectores.length) return;
  const nomes = conectores.map((m) => m.nome).join(', ').replace(/, ([^,]*)$/, t(' e $1'));
  if (ctx.app) {
    await ctx.abrirUrl('https://claude.ai/settings/connectors');
    await ui.confirmarFora({ rotulo: 'Gmail e Agenda', passos: [{ titulo: 'Clica em Conectar em cada um', linhas: [`Faz isso em ${nomes}. Escolhe a sua conta do Google e, quando ele perguntar se o Claude, a sua IA, pode acessar, clica em Permitir. Faltou algum? Você volta nessa mesma página.`], figura: 'conectores' }], concluir: 'Terminei', nao: 'Deixar pra depois' });
    return;
  }
  ui.pausa(`Vou abrir a página de conectores do Claude pra ligar ${nomes}`, [
    'Entra com a mesma conta do Claude que você usou aqui.',
    `Pra cada um (${nomes}): clica nele, depois em Conectar, e escolhe a sua conta do Google.`,
    'O Google pergunta se o Claude pode acessar. Clica em Permitir.',
    'Depois volta pra cá. Da próxima vez que abrir a IA, eles já estão lá.',
  ]);
  await ctx.abrirUrl('https://claude.ai/settings/connectors');
  if (!ctx.sim) await ui.confirmar(`Terminou de ligar ${nomes}?`, true);
  ui.ok(`${nomes}: ligado no claude.ai. Se faltar algum, é só voltar em claude.ai > Configurações > Conectores.`);
}

export async function remover(ctx) {
  for (const mid of ctx.estado.respostas?.mcps || []) await ctx.run('claude', ['mcp', 'remove', '--scope', 'user', mid], { ignorarErro: true });
}
