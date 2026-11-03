#!/usr/bin/env node
// SessionStart: carrega as regras de como trabalhar com a pessoa, decisões recentes, onde ela está agora
// e o estado do projeto da pasta atual. Instalado pelo Claude Setuper. Lê o cofre em CLAUDE_SETUPER_VAULT.
const fs = require('node:fs');
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

// A página de regras entra em toda conversa: limite pra ela não pesar no contexto.
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
  // Página compilada de regras (CLAUDE/wiki/Como trabalhar comigo.md). Com ela, entram só as correções e os padrões
  // mais novos que a página, que ainda não foram passados pra lista. Sem ela (instalação antiga), o jeito de antes.
  const pagina = path.join(claude, 'wiki', 'Como trabalhar comigo.md');
  const regras = ler(pagina);
  if (regras) {
    const corte = regras.length > LIMITE_REGRAS ? regras.slice(0, LIMITE_REGRAS) + '\n(… a página continua; leia o arquivo inteiro se precisar)' : regras;
    partes.push(`Como trabalhar com a pessoa (página ${pagina}; as notas linkadas são a fonte de verdade):\n${corte}`);
    const t = mtime(pagina);
    const novas = [...notas('feedback', 8, t), ...notas('padrões', 8, t)];
    if (novas.length) partes.push('Correções e padrões novos, que ainda não estão na página acima (valem do mesmo jeito):\n' + novas.join('\n'));
  } else {
    const padroes = notas('padrões', 12);
    if (padroes.length) partes.push('Padrões de como a pessoa trabalha:\n' + padroes.join('\n'));
    const feedback = notas('feedback', 6);
    if (feedback.length) partes.push('Correções que já aconteceram (não repetir):\n' + feedback.join('\n'));
  }
  const decisoes = notas('decisões', 8);
  if (decisoes.length) partes.push('Decisões recentes (não desfazer):\n' + decisoes.join('\n'));

  const overview = ler(path.join(claude, 'wiki', 'overview.md'));
  if (overview) partes.push('Onde a pessoa está agora (CLAUDE/wiki/overview.md):\n' + overview.slice(0, 1500));
  if (fs.existsSync(path.join(claude, 'wiki', 'index.md'))) {
    partes.push('Para perguntas sobre uma pessoa, um assunto ou um projeto, leia primeiro CLAUDE/wiki/index.md e a página certa. Regras da wiki em CLAUDE/wiki/SCHEMA.md.');
  }

  const dirProj = path.join(claude, 'projetos');
  if (fs.existsSync(dirProj)) {
    const arq = fs.readdirSync(dirProj).find((f) => f.toLowerCase().includes(projeto) && f.endsWith('.md'));
    if (arq) partes.push(`Estado do projeto "${arq.replace(/\.md$/, '')}":\n` + ler(path.join(dirProj, arq)).slice(0, 3000));
  }

  const inbox = path.join(claude, 'inbox');
  if (!process.env.CLAUDE_SETUPER_ROTINA && fs.existsSync(inbox)) {
    const chegou = fs.readdirSync(inbox).filter((f) => !f.startsWith('.') && f !== 'README.md' && fs.statSync(path.join(inbox, f)).isFile());
    if (chegou.length) partes.push(`Tem ${chegou.length} ${chegou.length === 1 ? 'arquivo novo' : 'arquivos novos'} em CLAUDE/inbox esperando leitura. Se fizer sentido no começo da conversa, ofereça guardar com /guardar, em uma frase.`);
  }

  if (!partes.length) process.exit(0);
  let texto = `[Segundo cérebro em ${vaultBruto}]\n\n` + partes.join('\n\n');
  if (texto.length > LIMITE_TOTAL) texto = texto.slice(0, LIMITE_TOTAL) + '\n(…)';
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: texto,
    },
  }));
}
