#!/usr/bin/env node
// SessionStart: loads the rules for working with the person, recent decisions, where they are right now
// and the state of the current folder's project. Installed by Claude Setuper. Reads the second brain from CLAUDE_SETUPER_VAULT.
const fs = require('node:fs');
const path = require('node:path');

// Reads the hook input asynchronously: readFileSync(0) fails silently on Windows when the input comes through a pipe.
function lerEntrada(cb) {
  let dados = '';
  let pronto = false;
  const fim = () => { if (pronto) return; pronto = true; let e = {}; try { e = JSON.parse(dados.replace(/^﻿/, '') || '{}'); } catch {} cb(e); };
  if (process.stdin.isTTY) return fim();
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (c) => { dados += c; });
  process.stdin.on('end', fim);
  process.stdin.on('error', fim);
  setTimeout(fim, 3000).unref(); // unref: doesn't hold the process open after the input has arrived
}

lerEntrada(main);

// The rules page goes into every conversation: a limit so it doesn't weigh down the context.
const LIMITE_REGRAS = 9000;
const LIMITE_TOTAL = 14000;

function main(entrada) {
  const vaultBruto = process.env.CLAUDE_SETUPER_VAULT;
  if (!vaultBruto || !fs.existsSync(path.join(vaultBruto, 'CLAUDE'))) process.exit(0);
  const claude = path.join(vaultBruto, 'CLAUDE');

  const cwd = entrada.cwd || process.cwd();
  const projeto = path.basename(cwd).toLowerCase();
  const ler = (p) => { try { return fs.readFileSync(p, 'utf8').replace(/^﻿/, '').trim(); } catch { return ''; } };
  const mtime = (p) => { try { return fs.statSync(p).mtimeMs; } catch { return 0; } };

  function notas(sub, max, depoisDe = 0) {
    const dir = path.join(claude, sub);
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
      .filter((f) => f.endsWith('.md') && f !== 'README.md')
      .map((f) => ({ f, t: mtime(path.join(dir, f)) }))
      .filter(({ t }) => t > depoisDe)
      .sort((a, b) => b.t - a.t)
      .slice(0, max)
      .map(({ f }) => `- ${f.replace(/\.md$/, '')}: ${ler(path.join(dir, f)).split('\n')[0].slice(0, 200)}`);
  }

  const partes = [];
  // Compiled rules page (CLAUDE/wiki/How to work with me.md). With it, only the corrections and patterns
  // newer than the page, not yet carried over to the list, go in. Without it (older installation), the old way.
  const pagina = path.join(claude, 'wiki', 'How to work with me.md');
  const regras = ler(pagina);
  if (regras) {
    const corte = regras.length > LIMITE_REGRAS ? regras.slice(0, LIMITE_REGRAS) + '\n(… the page continues; read the whole file if you need to)' : regras;
    partes.push(`How to work with the person (page ${pagina}; the linked notes are the source of truth):\n${corte}`);
    const t = mtime(pagina);
    const novas = [...notas('feedback', 8, t), ...notas('patterns', 8, t)];
    if (novas.length) partes.push('New corrections and patterns, not yet on the page above (they apply all the same):\n' + novas.join('\n'));
  } else {
    const padroes = notas('patterns', 12);
    if (padroes.length) partes.push('Patterns in how the person works:\n' + padroes.join('\n'));
    const feedback = notas('feedback', 6);
    if (feedback.length) partes.push('Corrections that have already happened (do not repeat):\n' + feedback.join('\n'));
  }
  const decisoes = notas('decisions', 8);
  if (decisoes.length) partes.push('Recent decisions (do not undo):\n' + decisoes.join('\n'));

  const overview = ler(path.join(claude, 'wiki', 'overview.md'));
  if (overview) partes.push('Where the person is right now (CLAUDE/wiki/overview.md):\n' + overview.slice(0, 1500));
  if (fs.existsSync(path.join(claude, 'wiki', 'index.md'))) {
    partes.push('For questions about a person, a topic or a project, first read CLAUDE/wiki/index.md and the right page. Wiki rules are in CLAUDE/wiki/SCHEMA.md.');
  }

  const dirProj = path.join(claude, 'projects');
  if (fs.existsSync(dirProj)) {
    const arq = fs.readdirSync(dirProj).find((f) => f.toLowerCase().includes(projeto) && f.endsWith('.md'));
    if (arq) partes.push(`State of the project "${arq.replace(/\.md$/, '')}":\n` + ler(path.join(dirProj, arq)).slice(0, 3000));
  }

  const inbox = path.join(claude, 'inbox');
  if (!process.env.CLAUDE_SETUPER_ROTINA && fs.existsSync(inbox)) {
    const chegou = fs.readdirSync(inbox).filter((f) => !f.startsWith('.') && f !== 'README.md' && fs.statSync(path.join(inbox, f)).isFile());
    if (chegou.length) partes.push(`There ${chegou.length === 1 ? 'is' : 'are'} ${chegou.length} ${chegou.length === 1 ? 'new file' : 'new files'} in CLAUDE/inbox waiting to be read. If it makes sense at the start of the conversation, offer to save with /save, in one sentence.`);
  }

  if (!partes.length) process.exit(0);
  let texto = `[Second brain at ${vaultBruto}]\n\n` + partes.join('\n\n');
  if (texto.length > LIMITE_TOTAL) texto = texto.slice(0, LIMITE_TOTAL) + '\n(…)';
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: texto,
    },
  }));
}
