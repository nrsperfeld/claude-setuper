#!/usr/bin/env node
// SessionStart: carrega padrões, decisões recentes e o estado do projeto da pasta atual.
// Instalado pelo Claude Setuper. Lê o vault em CLAUDE_SETUPER_VAULT.
const fs = require('node:fs');
const path = require('node:path');

let entrada = {};
try { entrada = JSON.parse(fs.readFileSync(0, 'utf8') || '{}'); } catch {}

const vault = process.env.CLAUDE_SETUPER_VAULT;
if (!vault || !fs.existsSync(path.join(vault, 'CLAUDE'))) process.exit(0);

const cwd = entrada.cwd || process.cwd();
const projeto = path.basename(cwd).toLowerCase();

function notas(sub, max) {
  const dir = path.join(vault, 'CLAUDE', sub);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.md') && f !== 'README.md')
    .map((f) => ({ f, t: fs.statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t)
    .slice(0, max)
    .map(({ f }) => {
      const txt = fs.readFileSync(path.join(dir, f), 'utf8').trim();
      return `- ${f.replace(/\.md$/, '')}: ${txt.split('\n')[0].slice(0, 200)}`;
    });
}

const partes = [];
const padroes = notas('padrões', 12);
if (padroes.length) partes.push('Padrões de como a pessoa trabalha:\n' + padroes.join('\n'));
const decisoes = notas('decisões', 8);
if (decisoes.length) partes.push('Decisões recentes (não desfazer):\n' + decisoes.join('\n'));
const feedback = notas('feedback', 6);
if (feedback.length) partes.push('Correções que já aconteceram (não repetir):\n' + feedback.join('\n'));

const dirProj = path.join(vault, 'CLAUDE', 'projetos');
if (fs.existsSync(dirProj)) {
  const arq = fs.readdirSync(dirProj).find((f) => f.toLowerCase().includes(projeto) && f.endsWith('.md'));
  if (arq) partes.push(`Estado do projeto "${arq.replace(/\.md$/, '')}":\n` + fs.readFileSync(path.join(dirProj, arq), 'utf8').trim().slice(0, 3000));
}

if (!partes.length) process.exit(0);
process.stdout.write(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'SessionStart',
    additionalContext: `[Segundo cérebro em ${vault}]\n\n` + partes.join('\n\n'),
  },
}));
