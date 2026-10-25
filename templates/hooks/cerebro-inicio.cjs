#!/usr/bin/env node
// SessionStart: carrega padrões, decisões recentes e o estado do projeto da pasta atual.
// Instalado pelo Claude Setuper. Lê o vault em CLAUDE_SETUPER_VAULT.
const fs = require('node:fs');
const path = require('node:path');

// Lê a entrada do hook de forma assíncrona: readFileSync(0) falha em silêncio no Windows quando a entrada vem por pipe.
function lerEntrada(cb) {
  let dados = '';
  let pronto = false;
  const fim = () => { if (pronto) return; pronto = true; let e = {}; try { e = JSON.parse(dados.replace(/^\uFEFF/, '') || '{}'); } catch {} cb(e); };
  if (process.stdin.isTTY) return fim();
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (c) => { dados += c; });
  process.stdin.on('end', fim);
  process.stdin.on('error', fim);
  setTimeout(fim, 3000).unref(); // unref: não segura o processo depois que a entrada chegou
}

lerEntrada(main);

function main(entrada) {

  const norm = (s) => String(s || '').replace(/\\/g, '/').replace(/\/+$/, '');
  const vaultBruto = process.env.CLAUDE_SETUPER_VAULT;
  const vault = norm(vaultBruto);
  const eq = (a, b) => (process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b);
  const dentroDe = (fp, base) => (process.platform === 'win32' ? norm(fp).toLowerCase().startsWith((base + '/').toLowerCase()) : norm(fp).startsWith(base + '/'));
  if (!vaultBruto || !fs.existsSync(path.join(vaultBruto, 'CLAUDE'))) process.exit(0);

  const cwd = entrada.cwd || process.cwd();
  const projeto = path.basename(cwd).toLowerCase();

  function notas(sub, max) {
    const dir = path.join(vaultBruto, 'CLAUDE', sub);
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

  const dirProj = path.join(vaultBruto, 'CLAUDE', 'projetos');
  if (fs.existsSync(dirProj)) {
    const arq = fs.readdirSync(dirProj).find((f) => f.toLowerCase().includes(projeto) && f.endsWith('.md'));
    if (arq) partes.push(`Estado do projeto "${arq.replace(/\.md$/, '')}":\n` + fs.readFileSync(path.join(dirProj, arq), 'utf8').trim().slice(0, 3000));
  }

  if (!partes.length) process.exit(0);
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: `[Segundo cérebro em ${vaultBruto}]\n\n` + partes.join('\n\n'),
    },
  }));
}
