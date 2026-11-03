// Segundo cérebro: hooks (trava, início, nota, ativação nas rotinas), wiki e o bloco do CLAUDE.md.
// Os hooks recebem a entrada também com BOM na frente, como o pipe do PowerShell 5.1 manda no Windows.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const HOOKS = path.join(__dirname, '..', 'templates', 'hooks');
const RAIZ = path.join(__dirname, '..');

function hook(nome, entrada, env = {}, bom = false) {
  const txt = (bom ? '\uFEFF' : '') + JSON.stringify(entrada);
  const r = spawnSync('node', [path.join(HOOKS, nome)], { input: txt, env: { ...process.env, ...env }, encoding: 'utf8' });
  return { codigo: r.status, saida: r.stdout, erro: r.stderr };
}

function cofre() {
  const v = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cerebro-')), 'Segundo Cérebro');
  for (const p of ['CLAUDE/feedback', 'CLAUDE/padrões', 'CLAUDE/decisões', 'CLAUDE/projetos', 'CLAUDE/wiki', 'CLAUDE/inbox', '2. ÁREAS']) fs.mkdirSync(path.join(v, p), { recursive: true });
  return v;
}
const nota = (v, rel, txt, mtime) => { const p = path.join(v, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, txt); if (mtime) fs.utimesSync(p, mtime / 1000, mtime / 1000); return p; };

// ---------- trava (PreToolUse)

test('trava: bloqueia escrita nas pastas da pessoa e libera CLAUDE/, .obsidian e fora do cofre', () => {
  const v = cofre();
  const env = { CLAUDE_SETUPER_VAULT: v };
  const t = (fp, extra) => hook('cerebro-trava.cjs', { tool_name: 'Write', tool_input: { file_path: fp, ...extra } }, env).codigo;
  assert.strictEqual(t(path.join(v, '2. ÁREAS', 'x.md')), 2);
  assert.strictEqual(t(path.join(v, 'Comece aqui.md')), 2);
  assert.strictEqual(t(path.join(v, 'CLAUDE', 'wiki', 'pessoas', 'Ana.md')), 0);
  assert.strictEqual(t(path.join(v, '.obsidian', 'app.json')), 0);
  assert.strictEqual(t(path.join(os.homedir(), 'Documents', 'outro.md')), 0);
  // Mesmo caminho com o acento decomposto (como o Mac às vezes guarda): continua travado.
  assert.strictEqual(t(path.join(v, '2. ÁREAS', 'x.md').normalize('NFD')), 2);
  // Uma pasta com nome parecido, ao lado do cofre, não é o cofre.
  assert.strictEqual(t(v + ' antigo/x.md'), 0);
  // Caminho relativo, resolvido a partir da pasta da sessão.
  assert.strictEqual(hook('cerebro-trava.cjs', { cwd: v, tool_input: { file_path: '2. ÁREAS/y.md' } }, env).codigo, 2);
  // NotebookEdit usa notebook_path.
  assert.strictEqual(hook('cerebro-trava.cjs', { tool_input: { notebook_path: path.join(v, 'a.ipynb') } }, env).codigo, 2);
});

test('trava: mensagem explica pro Claude e não trava sem cofre configurado', () => {
  const v = cofre();
  const r = hook('cerebro-trava.cjs', { tool_input: { file_path: path.join(v, '2. ÁREAS', 'x.md') } }, { CLAUDE_SETUPER_VAULT: v });
  assert.match(r.erro, /fora da pasta CLAUDE/);
  assert.strictEqual(hook('cerebro-trava.cjs', { tool_input: { file_path: path.join(v, '2. ÁREAS', 'x.md') } }, { CLAUDE_SETUPER_VAULT: '' }).codigo, 0);
});

test('trava no formato do Windows: BOM na entrada, barras invertidas e maiúsculas diferentes', () => {
  const env = { CLAUDE_SETUPER_VAULT: 'C:\\Users\\Ana\\Documents\\Segundo Cérebro', CLAUDE_SETUPER_TESTE_WIN: '1' };
  const t = (fp) => hook('cerebro-trava.cjs', { tool_input: { file_path: fp } }, env, true).codigo;
  assert.strictEqual(t('C:\\Users\\Ana\\Documents\\Segundo Cérebro\\2. ÁREAS\\x.md'), 2);
  assert.strictEqual(t('c:/users/ana/documents/segundo cérebro/2. áreas/x.md'), 2);
  assert.strictEqual(t('C:\\Users\\Ana\\Documents\\Segundo Cérebro\\claude\\wiki\\x.md'), 0);
  assert.strictEqual(t('C:\\Users\\Ana\\Desktop\\x.md'), 0);
});

// ---------- início (SessionStart)

function inicio(v, entrada = {}, env = {}, bom = false) {
  const r = hook('cerebro-inicio.cjs', { source: 'startup', cwd: os.homedir(), ...entrada }, { CLAUDE_SETUPER_VAULT: v, ...env }, bom);
  assert.strictEqual(r.codigo, 0, r.erro);
  return r.saida ? JSON.parse(r.saida).hookSpecificOutput.additionalContext : '';
}

test('início: com a página de regras, injeta a página e só as correções mais novas que ela', () => {
  const v = cofre();
  const agora = Date.now();
  nota(v, 'CLAUDE/feedback/velha.md', 'Correção velha que já está na página.\n#claude #feedback', agora - 3600e3);
  nota(v, 'CLAUDE/wiki/Como trabalhar comigo.md', 'Como trabalhar com Ana\n\n**Regras**\n- Regra compilada [[velha]]\n\n#claude #wiki', agora - 1800e3);
  nota(v, 'CLAUDE/feedback/nova.md', 'Correção nova ainda fora da página.\n#claude #feedback', agora);
  nota(v, 'CLAUDE/wiki/overview.md', 'Ana está fechando o balanço do mês.\n#claude #wiki');
  nota(v, 'CLAUDE/wiki/index.md', '- [[overview]]\n#claude #wiki');
  const c = inicio(v);
  assert.match(c, /Regra compilada/);
  assert.match(c, /Correção nova ainda fora da página/);
  assert.doesNotMatch(c, /Correção velha que já está na página/);
  assert.match(c, /fechando o balanço/);
  assert.match(c, /CLAUDE\/wiki\/index\.md/);
});

test('início: instalação antiga, sem a página, continua como antes', () => {
  const v = cofre();
  nota(v, 'CLAUDE/padrões/p.md', 'Prefere opções antes da recomendação.\n#claude #padrão');
  nota(v, 'CLAUDE/feedback/f.md', 'Não usar emoji.\n#claude #feedback');
  const c = inicio(v, {}, {}, true); // com BOM
  assert.match(c, /Prefere opções/);
  assert.match(c, /Não usar emoji/);
});

test('início: página gigante é cortada e o contexto total tem limite', () => {
  const v = cofre();
  nota(v, 'CLAUDE/wiki/Como trabalhar comigo.md', 'Regras\n' + '- regra repetida pra encher a página [[x]]\n'.repeat(800) + '#claude #wiki');
  const c = inicio(v);
  assert.ok(c.length <= 14100, `contexto com ${c.length} caracteres`);
  assert.match(c, /a página continua/);
});

test('início: avisa de arquivo novo na inbox, menos nas rotinas automáticas', () => {
  const v = cofre();
  nota(v, 'CLAUDE/inbox/README.md', 'leia-me');
  nota(v, 'CLAUDE/inbox/artigo.pdf', 'pdf');
  assert.match(inicio(v), /1 arquivo novo em CLAUDE\/inbox/);
  assert.doesNotMatch(inicio(v, {}, { CLAUDE_SETUPER_ROTINA: '1' }), /inbox esperando/);
});

test('início: rápido mesmo com cofre cheio', () => {
  const v = cofre();
  for (let i = 0; i < 400; i++) nota(v, `CLAUDE/descobertas/d${i}.md`, `Ideia ${i}.\n#claude #descoberta`);
  for (let i = 0; i < 150; i++) nota(v, `CLAUDE/feedback/f${i}.md`, `Correção ${i}.\n#claude #feedback`);
  nota(v, 'CLAUDE/wiki/Como trabalhar comigo.md', 'Regras\n' + '- r [[f1]]\n'.repeat(300) + '#claude #wiki');
  const t0 = Date.now();
  inicio(v);
  const ms = Date.now() - t0;
  assert.ok(ms < 1500, `levou ${ms} ms`);
});

// ---------- nota (PostToolUse)

test('nota: página da wiki precisa de #wiki, fonte de #fonte, e a inbox não é conferida', () => {
  const v = cofre();
  const env = { CLAUDE_SETUPER_VAULT: v };
  const n = (rel, txt) => hook('cerebro-nota.cjs', { tool_input: { file_path: nota(v, rel, txt) } }, env).codigo;
  assert.strictEqual(n('CLAUDE/wiki/pessoas/Ana.md', '**Resumo**\nAna cuida do caixa.\n#claude'), 2);
  assert.strictEqual(n('CLAUDE/wiki/pessoas/Ana.md', '**Resumo**\nAna cuida do caixa.\n#claude #wiki'), 0);
  assert.strictEqual(n('CLAUDE/fontes/Artigo (2026-11-02).md', 'Resumo do artigo.\n#claude'), 2);
  assert.strictEqual(n('CLAUDE/fontes/Artigo (2026-11-02).md', 'Resumo do artigo.\n#claude #fonte'), 0);
  assert.strictEqual(n('CLAUDE/inbox/Página salva.md', '---\ntitle: x\n---\n# Título\ntexto'), 0);
  assert.strictEqual(n('CLAUDE/wiki/log.md', 'Registro. #claude #wiki\n\n[2026-11-02] ingest | x'), 0);
});

test('os modelos da wiki passam na conferência de formato', () => {
  const v = cofre();
  const env = { CLAUDE_SETUPER_VAULT: v };
  for (const f of fs.readdirSync(path.join(RAIZ, 'templates', 'vault', 'wiki'))) {
    const txt = fs.readFileSync(path.join(RAIZ, 'templates', 'vault', 'wiki', f), 'utf8').replace(/\{\{\w+\}\}/g, 'x');
    const r = hook('cerebro-nota.cjs', { tool_input: { file_path: nota(v, `CLAUDE/wiki/${f}`, txt) } }, env);
    assert.strictEqual(r.codigo, 0, `${f}: ${r.erro}`);
  }
});

// ---------- ativação nas rotinas

test('ativação: rotina automática não gasta a missão do dia', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ativacao-'));
  const instalado = Date.now() - 2 * 24 * 3600e3;
  fs.writeFileSync(path.join(d, 'setuper-ativacao.json'), JSON.stringify({ instalado: new Date(instalado).toISOString(), nome: 'Ana', missoes: ['m1', 'm2'] }));
  const env = { CLAUDE_SETUPER_CLAUDE_DIR: d };
  assert.strictEqual(hook('ativacao.cjs', { source: 'startup' }, { ...env, CLAUDE_SETUPER_ROTINA: '1' }).saida, '');
  assert.match(hook('ativacao.cjs', { source: 'startup' }, env).saida, /m1/);
});

// ---------- wiki e CLAUDE.md (módulos ES, rodados num processo à parte)

function esm(codigo) {
  const r = spawnSync('node', ['--input-type=module', '-e', codigo], { cwd: RAIZ, encoding: 'utf8' });
  assert.strictEqual(r.status, 0, r.stderr);
  return r.stdout;
}

test('wiki de estudante de 15 anos: sem página de pessoas e com o cuidado de dados pessoais', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'wiki-'));
  const v = path.join(home, 'Cofre');
  fs.mkdirSync(path.join(v, 'CLAUDE', 'padrões'), { recursive: true });
  fs.writeFileSync(path.join(v, 'CLAUDE', 'padrões', 'Como falar comigo.md'), 'Prefere exemplos do dia a dia.\n\n#claude #padrão\n');
  esm(`
    import { criarCtx } from './src/ctx.js';
    import { montarWiki } from './src/modulos/wiki.js';
    const ctx = criarCtx({ home: ${JSON.stringify(home)} });
    ctx.resp = { nome: 'Bia', perfil: 'estudante', idade: '15', trabalho: '1º ano do ensino médio' };
    await montarWiki(ctx, ${JSON.stringify(v)});
  `);
  const schema = fs.readFileSync(path.join(v, 'CLAUDE', 'wiki', 'SCHEMA.md'), 'utf8');
  assert.match(schema, /matérias\//);
  assert.doesNotMatch(schema, /`pessoas\/`/);
  assert.match(schema, /menos de 18 anos/);
  assert.doesNotMatch(schema, /\{\{/);
  const regras = fs.readFileSync(path.join(v, 'CLAUDE', 'wiki', 'Como trabalhar comigo.md'), 'utf8');
  assert.match(regras, /Prefere exemplos do dia a dia\. \[\[Como falar comigo\]\]/);
  assert.match(fs.readFileSync(path.join(v, 'CLAUDE', 'wiki', 'overview.md'), 'utf8'), /1º ano do ensino médio/);
  const deny = JSON.parse(fs.readFileSync(path.join(v, '.claude', 'settings.json'), 'utf8')).permissions.deny;
  assert.ok(deny.includes('Edit(/2. ÁREAS/**)') && !deny.some((d) => /^Write/.test(d)));
});

test('CLAUDE.md: troca só o bloco do Setuper, guarda cópia e não mexe se nada mudou', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'claudemd-'));
  const arq = path.join(home, 'CLAUDE.md');
  fs.writeFileSync(arq, 'Minhas regras.\n\n<!-- claude-setuper -->\nbloco velho\n<!-- /claude-setuper -->\n\nDepois do bloco, meu.\n');
  const rodar = (bloco) => esm(`
    import { criarCtx } from './src/ctx.js';
    import { escreverClaudeMd } from './src/modulos/nucleo.js';
    const ctx = criarCtx({ home: ${JSON.stringify(home)} });
    escreverClaudeMd(ctx, ${JSON.stringify(arq)}, ${JSON.stringify(bloco)});
  `);
  const bloco = '<!-- claude-setuper -->\nbloco novo\n<!-- /claude-setuper -->\n';
  rodar(bloco);
  const txt = fs.readFileSync(arq, 'utf8');
  assert.match(txt, /^Minhas regras\./);
  assert.match(txt, /bloco novo/);
  assert.doesNotMatch(txt, /bloco velho/);
  assert.match(txt, /Depois do bloco, meu\.\n$/);
  const backups = () => fs.readdirSync(path.join(home, 'Claude Setuper', 'backups'));
  assert.strictEqual(backups().length, 1);
  rodar(bloco);
  assert.strictEqual(backups().length, 1);
  assert.strictEqual(fs.readFileSync(arq, 'utf8'), txt);
});

test('remover tira só o bloco e deixa o que a pessoa escreveu antes e depois', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'remover-'));
  fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
  const arq = path.join(home, '.claude', 'CLAUDE.md');
  fs.writeFileSync(arq, 'Antes.\n\n<!-- claude-setuper -->\nbloco\n<!-- /claude-setuper -->\n\nDepois.\n');
  esm(`
    import { criarCtx } from './src/ctx.js';
    import { remover } from './src/modulos/nucleo.js';
    const ctx = criarCtx({ home: ${JSON.stringify(home)} });
    await remover(ctx);
  `);
  assert.strictEqual(fs.readFileSync(arq, 'utf8'), 'Antes.\n\nDepois.\n');
});
