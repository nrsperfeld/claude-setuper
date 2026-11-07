#!/usr/bin/env node
// Avisa o guia flutuante do que a pessoa acabou de fazer no Claude, enquanto a aula do Setuper está aberta.
// Sem a aula aberta, sai sem fazer nada. Instalado pelo Claude Setuper.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const CLAUDE = process.env.CLAUDE_SETUPER_CLAUDE_DIR || path.join(os.homedir(), '.claude');
if (!fs.existsSync(path.join(CLAUDE, 'setuper-aula-ativa'))) process.exit(0);

let dados = '';
let pronto = false;
const fim = () => {
  if (pronto) return;
  pronto = true;
  let e = {};
  try { e = JSON.parse(dados.replace(/^﻿/, '') || '{}'); } catch {}
  const nome = e.hook_event_name;
  let evento = null;
  if (nome === 'UserPromptSubmit') evento = 'mensagem';
  else if (nome === 'SessionStart') evento = `sessao-${e.source || 'startup'}`;
  else if (nome === 'Notification' && (e.notification_type === 'permission_prompt' || /permission/i.test(e.message || ''))) evento = 'permissao';
  if (evento) {
    try { fs.appendFileSync(path.join(CLAUDE, 'setuper-aula-eventos.jsonl'), `${JSON.stringify({ evento, sessao: e.session_id || '', em: Date.now() })}\n`); } catch {}
  }
  process.exit(0);
};
if (process.stdin.isTTY) fim();
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => { dados += c; });
process.stdin.on('end', fim);
process.stdin.on('error', fim);
setTimeout(fim, 2000).unref();
