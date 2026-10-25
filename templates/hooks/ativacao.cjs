#!/usr/bin/env node
// SessionStart: nas primeiras semanas, sugere a missão do dia; depois, uma vez por semana, mostra o resumo do que o
// Claude fez pela pessoa. Instalado pelo Claude Setuper. Não depende do segundo cérebro.
// Config em ~/.claude/setuper-ativacao.json (escrito pelo Setuper); estado em ~/.claude/setuper-ativacao-estado.json.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const CLAUDE = process.env.CLAUDE_SETUPER_CLAUDE_DIR || path.join(os.homedir(), '.claude');
const CONFIG = path.join(CLAUDE, 'setuper-ativacao.json');
const ESTADO = path.join(CLAUDE, 'setuper-ativacao-estado.json');
const DIA = 24 * 3600 * 1000;

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

const ler = (p, padrao) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return padrao; } };
const hoje = (agora) => { const d = new Date(agora); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

lerEntrada((entrada) => {
  // Só quando a pessoa abre o Claude, não quando retoma ou limpa uma conversa.
  if (entrada.source && entrada.source !== 'startup') process.exit(0);
  const config = ler(CONFIG, null);
  if (!config?.instalado) process.exit(0);
  const estado = ler(ESTADO, { missoesFeitas: 0, ultimoDia: '', ultimoResumo: 0 });
  const agora = Number(process.env.CLAUDE_SETUPER_AGORA) || Date.now(); // a variável só existe nos testes
  const dia = hoje(agora);
  const instalado = new Date(config.instalado).getTime();
  const nome = config.nome || 'a pessoa';
  const cardapio = config.cardapio ? ` (o Cardápio do Claude fica em ${config.cardapio})` : '';
  let contexto = '';

  // No dia da instalação a primeira conversa já foi a primeira tarefa; o resto começa no dia seguinte, um por dia de uso.
  if (dia !== hoje(instalado) && dia !== estado.ultimoDia) {
    if (agora - instalado >= 7 * DIA && agora - (estado.ultimoResumo || 0) >= 7 * DIA) {
      estado.ultimoResumo = agora;
      const r = resumoDaSemana(agora, config.vault);
      if (r.pedidos > 0) {
        estado.ultimoDia = dia;
        contexto = `[Claude Setuper] Resumo dos últimos 7 dias de ${nome} com você: ${r.conversas} ${r.conversas === 1 ? 'conversa' : 'conversas'}, `
          + `${r.pedidos} ${r.pedidos === 1 ? 'pedido' : 'pedidos'}, ${r.arquivos} ${r.arquivos === 1 ? 'arquivo criado ou editado' : 'arquivos criados ou editados'}`
          + (config.vault ? `, ${r.notas} ${r.notas === 1 ? 'nota nova ou atualizada' : 'notas novas ou atualizadas'} no segundo cérebro` : '') + '. '
          + 'Na sua primeira resposta de hoje, depois de atender o que a pessoa pediu, mostre esse resumo em até 3 linhas, em português simples, '
          + `e sugira uma coisa do cardápio que pareça útil pra ela e que vocês ainda não tenham feito${cardapio}. Use só esses números, sem estimar horas economizadas.`;
      }
    }
    const missoes = config.missoes || [];
    if (!contexto && estado.missoesFeitas < missoes.length && agora - instalado < 21 * DIA) {
      const n = estado.missoesFeitas;
      estado.missoesFeitas = n + 1;
      estado.ultimoDia = dia;
      contexto = `[Claude Setuper] Sugestão do dia ${n + 2} da primeira semana de ${nome} com você: ${missoes[n]} `
        + 'Na sua primeira resposta, depois de atender o que a pessoa pediu, faça essa sugestão em uma frase, como convite. '
        + `Se ela não quiser, tudo bem, não insista${cardapio ? ` e lembre que tem mais ideias no cardápio${cardapio}` : ''}.`;
    }
  }

  try { fs.writeFileSync(ESTADO, JSON.stringify(estado, null, 2) + '\n'); } catch {}
  if (!contexto) process.exit(0);
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: contexto } }));
});

// Conta, nos registros do Claude Code dos últimos 7 dias, conversas, pedidos da pessoa e arquivos mexidos.
// Tem limite de tempo e de tamanho: o hook nunca pode atrasar a abertura do Claude.
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
        // Comandos internos e respostas de ferramenta não são pedidos da pessoa.
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
