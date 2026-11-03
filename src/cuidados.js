// Cuidados com o que já existia no computador e atrapalha o Claude. Não mexe em nada: só aponta.
// Aparecem no doctor e no pedido de ajuda, não na tela final do app (quem resolve é quem dá suporte).
import fs from 'node:fs';
import path from 'node:path';

const ARQUIVOS_DO_TERMINAL = ['.zshrc', '.zprofile', '.zshenv', '.bash_profile', '.bashrc', '.profile', '.config/fish/config.fish'];

// Onde está a chave da API da Anthropic, se estiver. Com ela o `claude` cobra pela API em vez da assinatura e
// desliga os conectores do claude.ai. Devolve um pedaço de frase ("no arquivo .zshrc") ou ''.
export function chaveDaApi(ctx) {
  for (const f of ARQUIVOS_DO_TERMINAL) {
    let txt = '';
    try { txt = fs.readFileSync(path.join(ctx.home, f), 'utf8'); } catch { continue; }
    if (/^\s*(export\s+|set\s+-gx\s+|set\s+-x\s+)?ANTHROPIC_API_KEY[\s=]/m.test(txt)) return `no arquivo ${f} da sua pasta pessoal`;
  }
  const s = ctx.lerJson(path.join(ctx.claudeDir, 'settings.json'), {});
  if (s?.env?.ANTHROPIC_API_KEY) return 'nas configurações do Claude (settings.json)';
  // A variável do sistema só conta na casa de verdade (nos testes, --home aponta pra uma pasta falsa).
  if (ctx.home === ctx.homeReal && process.env.ANTHROPIC_API_KEY) return ctx.win ? 'nas variáveis de ambiente do Windows' : 'no ambiente do Terminal';
  return '';
}

// Skills e plugins de memória de outros sistemas disputam com o segundo cérebro: cada um acha que é o lugar
// certo de guardar, e as anotações se espalham.
export function outrasMemorias(ctx) {
  const nomes = [];
  const parece = (n) => /(memory|mem[oó]ria|para-memory|cass-memory|mem0|supermemory)/i.test(n);
  try {
    for (const n of fs.readdirSync(path.join(ctx.claudeDir, 'skills'))) if (parece(n)) nomes.push(n);
  } catch {}
  const plugins = ctx.lerJson(path.join(ctx.claudeDir, 'plugins', 'installed_plugins.json'), {});
  for (const n of Object.keys(plugins?.plugins || plugins || {})) if (parece(n)) nomes.push(n.split('@')[0]);
  return [...new Set(nomes)];
}

export function cuidados(ctx) {
  const chave = chaveDaApi(ctx);
  const outras = outrasMemorias(ctx);
  return [
    {
      item: 'O Claude usa a sua assinatura (sem chave de API solta)',
      ok: !chave,
      dica: `achei ANTHROPIC_API_KEY ${chave}. Com ela o Claude cobra pela API e os conectores do claude.ai somem. Se não foi de propósito, apague essa linha e abra o Terminal de novo`,
    },
    {
      item: 'Uma memória só: o segundo cérebro',
      ok: !outras.length,
      dica: `outras ferramentas de memória instaladas (${outras.join(', ')}) disputam com o segundo cérebro. Se não usa, dá pra tirar`,
    },
  ];
}
