// Wiki viva do segundo cérebro (padrão "LLM Wiki"): uma camada por cima das notas atômicas, com SCHEMA, índice,
// registro, "onde a pessoa está agora" e a página "Como trabalhar comigo", que junta as regras das correções.
// Também monta a pasta de entrada (inbox), a pasta de fontes, a trava do cofre e o histórico local (git).
// Não é um passo da instalação: o Obsidian chama na instalação nova e o núcleo chama nas que já existiam.
// Nunca sobrescreve nada: só cria o que falta.
import path from 'node:path';
import fs from 'node:fs';
import { perfil, ehMenor } from '../perfis.js';
import { GITIGNORE } from './rotinas.js';

const PAGINAS = ['SCHEMA.md', 'index.md', 'log.md', 'overview.md'];
export const REGRAS = 'Como trabalhar comigo.md';

// Pastas que são da pessoa. A trava do cofre (.claude/settings.json) vale pra sessão aberta dentro do cofre,
// inclusive as rotinas automáticas. Em qualquer outra pasta quem trava é o hook cerebro-trava.cjs.
// Edit(...) cobre todas as ferramentas de escrita; Write(...) em deny gera aviso no Claude Code.
// A .obsidian/ fica de fora de propósito: o Claude pode ajustar o Obsidian quando a pessoa pede.
export const TRAVAS = ['1. PROJETOS', '2. ÁREAS', '3. RECURSOS', '4. ARQUIVO', 'TEMPLATES', '_anexos', '.git']
  .map((p) => `Edit(/${p}/**)`).concat(['Edit(/*.md)', 'Edit(/*.canvas)', 'Edit(/*.base)']);

export function verificarWiki(ctx, vault) {
  const w = path.join(vault, 'CLAUDE', 'wiki');
  return [
    { item: 'Wiki do segundo cérebro (índice, registro e regras)', ok: [...PAGINAS, REGRAS].every((f) => ctx.existe(path.join(w, f))) },
    { item: 'Pasta de entrada pra guardar material (inbox)', ok: ctx.existe(path.join(vault, 'CLAUDE', 'inbox', 'README.md')) },
    { item: 'Trava das suas pastas no cofre', ok: TRAVAS.every((t) => (ctx.lerJson(path.join(vault, '.claude', 'settings.json'), {}).permissions?.deny || []).includes(t)) },
  ];
}

export async function montarWiki(ctx, vault) {
  const claude = path.join(vault, 'CLAUDE');
  const w = path.join(claude, 'wiki');
  const p = perfil(ctx, ctx.resp.perfil || ctx.estado.respostas?.perfil);
  const nome = ctx.resp.nome || ctx.estado.respostas?.nome || 'a pessoa';
  const menor = ehMenor(ctx.resp.idade || ctx.estado.respostas?.idade);
  const hoje = new Date();
  const dataIso = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
  const trabalho = String(ctx.resp.trabalho || ctx.estado.respostas?.trabalho || '').trim();
  const vars = {
    nome,
    dataIso,
    tiposWiki: (p.wiki || [{ pasta: 'pessoas', oQue: 'gente com quem você trabalha ou convive' }, { pasta: 'assuntos', oQue: 'temas que voltam sempre' }])
      .map((t) => `\`${t.pasta}/\`: ${t.oQue}.`).join('\n'),
    cuidadoMenor: menor ? ` Como ${nome} tem menos de 18 anos, a wiki não guarda dados pessoais de ninguém: endereço, documento, telefone, foto ou senha.` : '',
    estadoInicial: trabalho
      ? `Na instalação, ${nome} contou: "${trabalho.replace(/"/g, "'")}". Ainda não tem mais nada anotado sobre o momento atual.`
      : 'Ainda não tem nada anotado sobre o momento atual.',
    gerenciador: ctx.win ? 'pelo Explorador de Arquivos' : ctx.plataforma === 'darwin' ? 'pelo Finder' : 'pelo gerenciador de arquivos',
  };

  for (const f of PAGINAS) ctx.escreverSeFaltar(path.join(w, f), ctx.template(`vault/wiki/${f}`, vars));
  // Na instalação que já tinha notas, a página de regras nasce com uma linha por correção e por padrão, cada uma com
  // o link da nota de origem. A revisão semanal depois junta as repetidas. Sem notas, fica só o aviso.
  ctx.escreverSeFaltar(path.join(w, ctx.arq(REGRAS)), ctx.template(`vault/wiki/${REGRAS}`, { ...vars, regras: regrasIniciais(claude, ctx) }));

  ctx.escreverSeFaltar(path.join(claude, 'inbox', 'README.md'), ctx.template('vault/inbox-README.md', vars));
  if (!ctx.dryRun) fs.mkdirSync(path.join(claude, 'inbox', 'processados'), { recursive: true });
  ctx.escreverSeFaltar(path.join(claude, ctx.pasta('fontes'), 'README.md'), ctx.template('vault/README-pasta.md', { pasta: ctx.pasta('fontes'), tag: ctx.tag('fonte') }));

  // Mescla: se a pessoa já tinha regras próprias no cofre, ficam todas.
  ctx.mesclarJson(path.join(vault, '.claude', 'settings.json'), { permissions: { deny: TRAVAS } });

  await historicoLocal(ctx, vault);
}

function regrasIniciais(claude, ctx) {
  const linhas = [];
  for (const sub of ['feedback', ctx.pasta('padrões')]) {
    const dir = path.join(claude, sub);
    if (!fs.existsSync(dir)) continue;
    const notas = fs.readdirSync(dir).filter((f) => f.endsWith('.md') && f !== 'README.md')
      .map((f) => ({ f, t: fs.statSync(path.join(dir, f)).mtimeMs })).sort((a, b) => a.t - b.t);
    for (const { f } of notas) {
      let primeira = '';
      try { primeira = fs.readFileSync(path.join(dir, f), 'utf8').replace(/^﻿/, '').split('\n').map((l) => l.trim()).find((l) => l && !l.startsWith('#')) || ''; } catch {}
      if (primeira) linhas.push(`- ${primeira.slice(0, 300)} [[${f.replace(/\.md$/, '')}]]`);
    }
  }
  // Limite da página (ela entra em toda conversa): o resto a revisão semanal compila.
  let out = '';
  for (const l of linhas) { if (out.length + l.length > 7000) break; out += l + '\n'; }
  return out.trimEnd() || 'Ainda não tem regra anotada. A primeira correção que você fizer no Claude aparece aqui.';
}

// Histórico local do cofre: a wiki é reescrita, e o git guarda cada versão. Sem remoto (o backup no GitHub é
// outra coisa, opcional). Só se o git existir de verdade: no Mac sem as ferramentas da Apple, chamar o git
// abre uma janela pedindo pra instalar.
async function historicoLocal(ctx, vault) {
  if (ctx.dryRun || ctx.existe(path.join(vault, '.git'))) return;
  if (!(await temGit(ctx))) return ctx.log('sem git: cofre fica sem histórico local');
  await ctx.run('git', ['init', '-q'], { cwd: vault, ignorarErro: true });
  if (!ctx.existe(path.join(vault, '.git'))) return;
  ctx.escreverSeFaltar(path.join(vault, '.gitignore'), GITIGNORE);
  await ctx.run('git', ['add', '-A'], { cwd: vault, ignorarErro: true });
  await ctx.run('git', ['-c', 'user.name=Claude Setuper', '-c', 'user.email=setuper@localhost', 'commit', '-q', '-m', 'Cofre montado pelo Claude Setuper'], { cwd: vault, ignorarErro: true });
}

async function temGit(ctx) {
  if (ctx.plataforma === 'darwin') {
    if (ctx.existe('/opt/homebrew/bin/git') || ctx.existe('/usr/local/bin/git')) return true;
    return !!(await ctx.run('xcode-select', ['-p'], { ignorarErro: true, sempre: true }));
  }
  return ctx.existeComando('git');
}

export function removerTrava(ctx, vault) {
  const p = path.join(vault, '.claude', 'settings.json');
  const s = ctx.lerJson(p, null);
  if (!s?.permissions?.deny) return;
  s.permissions.deny = s.permissions.deny.filter((r) => !TRAVAS.includes(r));
  if (!s.permissions.deny.length) delete s.permissions.deny;
  if (!Object.keys(s.permissions).length) delete s.permissions;
  if (!Object.keys(s).length) fs.rmSync(p, { force: true });
  else ctx.escrever(p, s);
}
