#!/usr/bin/env node
// PreToolUse (Write|Edit|MultiEdit|NotebookEdit): trava a escrita no cofre fora de CLAUDE/ antes de acontecer.
// O resto do cofre é da pessoa. Vale em qualquer pasta onde o Claude for aberto, e em todo sistema.
// Instalado pelo Claude Setuper. Lê o cofre em CLAUDE_SETUPER_VAULT.
const path = require('node:path');

// Lê a entrada do hook de forma assíncrona: readFileSync(0) falha em silêncio no Windows quando a entrada vem por pipe.
function lerEntrada(cb) {
  let dados = '';
  let pronto = false;
  const fim = () => { if (pronto) return; pronto = true; let e = {}; try { e = JSON.parse(dados.replace(/^﻿/, '') || '{}'); } catch {} cb(e); };
  if (process.stdin.isTTY) return fim();
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (c) => { dados += c; });
  process.stdin.on('end', fim);
  process.stdin.on('error', fim);
  setTimeout(fim, 3000).unref(); // unref: não segura o processo depois que a entrada chegou
}

lerEntrada(main);

function main(entrada) {
  // CLAUDE_SETUPER_TESTE_WIN só existe nos testes: simula o Windows (barras invertidas, C:\) num Mac.
  const win = process.platform === 'win32' || process.env.CLAUDE_SETUPER_TESTE_WIN === '1';
  const P = win ? path.win32 : path.posix;
  // Barras normais, sem barra no fim, e acentos na mesma forma (o Mac às vezes guarda "é" como "e" + acento).
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
  // No Windows tudo já está em minúsculas; a pasta CLAUDE/ é a do Claude, e .obsidian/ guarda as configurações do app.
  if (dentroDe(vault + (win ? '/claude' : '/CLAUDE')) || dentroDe(vault + '/.obsidian')) process.exit(0);

  console.error(`Bloqueado: ${fpBruto} fica no segundo cérebro, fora da pasta CLAUDE/. Essa parte do cofre é da pessoa e o Claude não escreve nela. Se a informação importa, grave em ${P.join(vaultBruto, 'CLAUDE')} na subpasta certa. Se a pessoa pediu essa mudança, explique em uma frase que essa pasta é dela e mostre o texto pra ela mesma colar.`);
  process.exit(2);
}
