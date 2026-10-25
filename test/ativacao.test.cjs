// Hook da primeira semana e do resumo semanal (templates/hooks/ativacao.cjs), com casa falsa e datas simuladas.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const HOOK = path.join(__dirname, '..', 'templates', 'hooks', 'ativacao.cjs');
const DIA = 24 * 3600 * 1000;
const INSTALADO = new Date('2026-10-20T15:00:00').getTime();

function casa(extra = {}) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ativacao-'));
  fs.writeFileSync(path.join(d, 'setuper-ativacao.json'), JSON.stringify({
    instalado: new Date(INSTALADO).toISOString(), nome: 'Ana', perfil: 'empresario',
    missoes: ['m1', 'm2', 'm3', 'm4', 'm5', 'm6'], cardapio: '/x/Cardápio do Claude.md', vault: '/cofre', ...extra,
  }));
  return d;
}
function abrir(d, quando, source = 'startup') {
  const out = execFileSync('node', [HOOK], { input: JSON.stringify({ source }), env: { ...process.env, CLAUDE_SETUPER_CLAUDE_DIR: d, CLAUDE_SETUPER_AGORA: String(quando) } }).toString();
  return out ? JSON.parse(out).hookSpecificOutput.additionalContext : '';
}

test('no dia da instalação não sugere nada', () => {
  assert.strictEqual(abrir(casa(), INSTALADO + 3600 * 1000), '');
});

test('uma missão por dia de uso, em ordem, mesmo pulando dias', () => {
  const d = casa();
  assert.match(abrir(d, INSTALADO + DIA), /m1/);
  assert.strictEqual(abrir(d, INSTALADO + DIA + 3600 * 1000), ''); // mesmo dia: nada
  assert.match(abrir(d, INSTALADO + 4 * DIA), /m2/); // sumiu 3 dias: continua da próxima
});

test('retomar ou limpar conversa não conta', () => {
  const d = casa();
  assert.strictEqual(abrir(d, INSTALADO + DIA, 'resume'), '');
  assert.match(abrir(d, INSTALADO + DIA), /m1/);
});

test('depois das 6 missões para de sugerir', () => {
  const d = casa();
  for (let i = 1; i <= 6; i++) assert.match(abrir(d, INSTALADO + i * DIA - 1), new RegExp(`m${i}`));
  assert.strictEqual(abrir(d, INSTALADO + 6 * DIA + 3600 * 1000), '');
});

test('resumo da semana conta conversas, pedidos, arquivos e notas, e vem no lugar da missão', () => {
  const d = casa();
  const proj = path.join(d, 'projects', '-Users-ana');
  fs.mkdirSync(proj, { recursive: true });
  const agora = INSTALADO + 8 * DIA;
  const ts = new Date(agora - DIA).toISOString();
  const linhas = [
    { type: 'user', timestamp: ts, message: { content: 'monta a proposta do cliente' } },
    { type: 'assistant', timestamp: ts, message: { content: [{ type: 'tool_use', name: 'Write', input: { file_path: '/cofre/CLAUDE/decisões/x.md' } }] } },
    { type: 'user', timestamp: ts, message: { content: [{ type: 'tool_result', content: 'ok' }] } },
    { type: 'user', timestamp: ts, message: { content: '<command-name>/clear</command-name>' } },
    { type: 'user', timestamp: ts, message: { content: [{ type: 'text', text: 'agora salva em pdf' }] } },
    { type: 'assistant', timestamp: ts, message: { content: [{ type: 'tool_use', name: 'Edit', input: { file_path: '/Users/ana/proposta.md' } }] } },
    { type: 'user', timestamp: new Date(agora - 9 * DIA).toISOString(), message: { content: 'velho, não conta' } },
  ];
  fs.writeFileSync(path.join(proj, 'a.jsonl'), linhas.map((l) => JSON.stringify(l)).join('\n'));
  fs.writeFileSync(path.join(proj, 'b.jsonl'), JSON.stringify({ type: 'user', timestamp: ts, message: { content: 'outra conversa' } }));
  const ctx = abrir(d, agora);
  assert.match(ctx, /2 conversas, 3 pedidos, 2 arquivos criados ou editados, 1 nota nova/);
  assert.doesNotMatch(ctx, /m1/);
  assert.match(abrir(d, agora + DIA), /m1/); // no dia seguinte volta a missão
  assert.doesNotMatch(abrir(d, agora + 2 * DIA), /Resumo/); // resumo só a cada 7 dias
});

test('sem conversas na semana, não mostra resumo', () => {
  const d = casa({ missoes: [] });
  assert.strictEqual(abrir(d, INSTALADO + 8 * DIA), '');
});

test('sem configuração do Setuper, não faz nada', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ativacao-'));
  assert.strictEqual(abrir(d, Date.now()), '');
});
