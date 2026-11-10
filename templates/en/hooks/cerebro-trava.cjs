#!/usr/bin/env node
// PreToolUse (Write|Edit|MultiEdit|NotebookEdit): blocks writing in the second brain outside CLAUDE/ before it happens.
// The rest of the second brain belongs to the person. This applies in any folder where the AI is opened, and on every system.
// Installed by Claude Setuper. Reads the second brain from CLAUDE_SETUPER_VAULT.
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

function main(entrada) {
  // CLAUDE_SETUPER_TESTE_WIN only exists in the tests: it simulates Windows (backslashes, C:\) on a Mac.
  const win = process.platform === 'win32' || process.env.CLAUDE_SETUPER_TESTE_WIN === '1';
  const P = win ? path.win32 : path.posix;
  // Forward slashes, no trailing slash, and accents in the same form (the Mac sometimes stores an accented letter as letter + accent).
  const norm = (s) => { const n = String(s || '').normalize('NFC').replace(/\\/g, '/').replace(/\/+$/, ''); return win ? n.toLowerCase() : n; };
  const vaultBruto = process.env.CLAUDE_SETUPER_VAULT;
  if (!vaultBruto) process.exit(0);
  const entradaTool = entrada.tool_input || {};
  let fpBruto = entradaTool.file_path || entradaTool.notebook_path || '';
  if (!fpBruto) process.exit(0);
  if (!P.isAbsolute(fpBruto)) fpBruto = P.resolve(entrada.cwd || process.cwd(), fpBruto);
  const fp = norm(P.normalize(fpBruto));
  const vault = norm(P.normalize(vaultBruto));
  const dentroDe = (base) => fp === base || fp.startsWith(base + '/');
  if (!dentroDe(vault)) process.exit(0);
  // On Windows everything is already lowercase; the CLAUDE/ folder belongs to the AI, and .obsidian/ holds the app's settings.
  if (dentroDe(vault + (win ? '/claude' : '/CLAUDE')) || dentroDe(vault + '/.obsidian')) process.exit(0);

  console.error(`Blocked: ${fpBruto} is in the second brain, outside the CLAUDE/ folder. That part of the second brain belongs to the person and the AI doesn't write in it. If the information matters, save it in ${P.join(vaultBruto, 'CLAUDE')} in the right subfolder. If the person asked for this change, explain in one sentence that this folder is theirs and show them the text so they can paste it themselves.`);
  process.exit(2);
}
