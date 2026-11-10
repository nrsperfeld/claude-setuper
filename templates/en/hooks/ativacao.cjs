#!/usr/bin/env node
// SessionStart: in the first weeks, suggests the day's mission; after that, once a week, shows a summary of what
// The AI did for the person. Installed by Claude Setuper. It doesn't depend on the second brain.
// Config in ~/.claude/setuper-ativacao.json (written by Setuper); state in ~/.claude/setuper-ativacao-estado.json.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const CLAUDE = process.env.CLAUDE_SETUPER_CLAUDE_DIR || path.join(os.homedir(), '.claude');
const CONFIG = path.join(CLAUDE, 'setuper-ativacao.json');
const ESTADO = path.join(CLAUDE, 'setuper-ativacao-estado.json');
const DIA = 24 * 3600 * 1000;

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

const ler = (p, padrao) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return padrao; } };
const hoje = (agora) => { const d = new Date(agora); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

lerEntrada((entrada) => {
  // Only when the person opens the AI, not when they resume or clear a conversation.
  if (entrada.source && entrada.source !== 'startup') process.exit(0);
  // An automatic routine (weekly review, daily read) isn't the person opening the AI: it doesn't use up the day's mission.
  if (process.env.CLAUDE_SETUPER_ROTINA) process.exit(0);
  const config = ler(CONFIG, null);
  if (!config?.instalado) process.exit(0);
  const estado = ler(ESTADO, { missoesFeitas: 0, ultimoDia: '', ultimoResumo: 0 });
  const agora = Number(process.env.CLAUDE_SETUPER_AGORA) || Date.now(); // this variable only exists in the tests
  const dia = hoje(agora);
  const instalado = new Date(config.instalado).getTime();
  const nome = config.nome || 'the person';
  const cardapio = config.cardapio ? ` (the Claude menu is at ${config.cardapio})` : '';
  let contexto = '';

  // On installation day the first conversation was already the first task; the rest start the next day, one per day of use.
  if (dia !== hoje(instalado) && dia !== estado.ultimoDia) {
    if (agora - instalado >= 7 * DIA && agora - (estado.ultimoResumo || 0) >= 7 * DIA) {
      estado.ultimoResumo = agora;
      const r = resumoDaSemana(agora, config.vault);
      if (r.pedidos > 0) {
        estado.ultimoDia = dia;
        contexto = `[Claude Setuper] Summary of ${nome}'s last 7 days with you: ${r.conversas} ${r.conversas === 1 ? 'conversation' : 'conversations'}, `
          + `${r.pedidos} ${r.pedidos === 1 ? 'request' : 'requests'}, ${r.arquivos} ${r.arquivos === 1 ? 'file created or edited' : 'files created or edited'}`
          + (config.vault ? `, ${r.notas} ${r.notas === 1 ? 'new or updated note' : 'new or updated notes'} in the second brain` : '') + '. '
          + 'In your first reply today, after handling what the person asked, show this summary in up to 3 lines, in plain English, '
          + `and suggest something from the menu that seems useful to them and that you haven't done together yet${cardapio}. Use only these numbers, without estimating hours saved.`;
      }
    }
    const missoes = config.missoes || [];
    if (!contexto && estado.missoesFeitas < missoes.length && agora - instalado < 21 * DIA) {
      const n = estado.missoesFeitas;
      estado.missoesFeitas = n + 1;
      estado.ultimoDia = dia;
      contexto = `[Claude Setuper] Suggestion for day ${n + 2} of ${nome}'s first week with you: ${missoes[n]} `
        + 'In your first reply, after handling what the person asked, make this suggestion in one sentence, as an invitation. '
        + `If they don't want to, that's fine, don't insist${cardapio ? ` and remind them there are more ideas in the menu${cardapio}` : ''}.`;
    }
  }

  try { fs.writeFileSync(ESTADO, JSON.stringify(estado, null, 2) + '\n'); } catch {}
  if (!contexto) process.exit(0);
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: contexto } }));
});

// Counts, in Claude Code's records from the last 7 days, conversations, the person's requests and files touched.
// It has a time and size limit: the hook can never delay the AI from opening.
function resumoDaSemana(agora, vault) {
  const r = { conversas: 0, pedidos: 0, arquivos: 0, notas: 0 };
  const desde = agora - 7 * DIA;
  const prazo = Date.now() + 2500;
  let lidos = 0;
  const arquivos = new Set();
  const jsonls = [];
  const varrer = (dir, nivel) => {
    let itens = [];
    try { itens = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const i of itens) {
      const p = path.join(dir, i.name);
      if (i.isDirectory() && nivel < 3) varrer(p, nivel + 1);
      else if (i.isFile() && i.name.endsWith('.jsonl')) {
        try { const s = fs.statSync(p); if (s.mtimeMs >= desde) jsonls.push({ p, t: s.mtimeMs, tam: s.size }); } catch {}
      }
    }
  };
  varrer(path.join(CLAUDE, 'projects'), 0);
  jsonls.sort((a, b) => b.t - a.t);
  for (const { p, tam } of jsonls) {
    if (Date.now() > prazo || lidos + tam > 60 * 1024 * 1024) break;
    lidos += tam;
    let pedidosAqui = 0;
    let texto = '';
    try { texto = fs.readFileSync(p, 'utf8'); } catch { continue; }
    for (const linha of texto.split('\n')) {
      if (!linha.includes('"timestamp"')) continue;
      let e;
      try { e = JSON.parse(linha); } catch { continue; }
      if (!e.timestamp || new Date(e.timestamp).getTime() < desde) continue;
      const c = e.message?.content;
      if (e.type === 'user' && !e.isMeta && !e.isSidechain) {
        const t = typeof c === 'string' ? c : Array.isArray(c) ? c.filter((x) => x.type === 'text').map((x) => x.text).join(' ') : '';
        // Internal commands and tool responses aren't requests from the person.
        if (t.trim() && !t.trim().startsWith('<')) pedidosAqui++;
      } else if (e.type === 'assistant' && Array.isArray(c)) {
        for (const x of c) if (x.type === 'tool_use' && /^(Write|Edit|MultiEdit|NotebookEdit)$/.test(x.name) && x.input?.file_path) arquivos.add(x.input.file_path);
      }
    }
    if (pedidosAqui) { r.conversas++; r.pedidos += pedidosAqui; }
  }
  r.arquivos = arquivos.size;
  if (vault) {
    const v = String(vault).replace(/\\/g, '/').toLowerCase();
    r.notas = [...arquivos].filter((f) => String(f).replace(/\\/g, '/').toLowerCase().startsWith(v + '/') && f.endsWith('.md')).length;
  }
  return r;
}
