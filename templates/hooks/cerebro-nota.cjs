#!/usr/bin/env node
// PostToolUse (Write|Edit): garante que o Claude só escreve dentro de CLAUDE/ no vault e no formato certo.
// Instalado pelo Claude Setuper.
const fs = require('node:fs');

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
  setTimeout(fim, 3000);
}

lerEntrada(main);

function main(entrada) {

  const norm = (s) => String(s || '').replace(/\\/g, '/').replace(/\/+$/, '');
  const vaultBruto = process.env.CLAUDE_SETUPER_VAULT;
  const vault = norm(vaultBruto);
  const eq = (a, b) => (process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b);
  const dentroDe = (fp, base) => (process.platform === 'win32' ? norm(fp).toLowerCase().startsWith((base + '/').toLowerCase()) : norm(fp).startsWith(base + '/'));
  const fpBruto = entrada.tool_input?.file_path || '';
  const fp = norm(fpBruto);
  if (!vaultBruto || !dentroDe(fp, vault)) process.exit(0);

  const dentro = dentroDe(fp, vault + '/CLAUDE');
  if (!dentro) {
    if (fp.includes('/.obsidian/')) process.exit(0);
    console.error(`Você escreveu em ${fpBruto}, que fica fora de CLAUDE/. O resto do segundo cérebro é da pessoa. Desfaça essa alteração (restaure o conteúdo anterior) e, se a informação importa, grave em ${vaultBruto}/CLAUDE/ na subpasta certa.`);
    process.exit(2);
  }

  if (!fp.endsWith('.md') || fp.endsWith('/README.md')) process.exit(0);
  let txt = '';
  try { txt = fs.readFileSync(fpBruto, 'utf8'); } catch { process.exit(0); }

  const problemas = [];
  if (txt.trimStart().startsWith('---')) problemas.push('tem frontmatter (---), e as notas do cérebro não levam');
  if (/^#{1,6}\s/m.test(txt)) problemas.push('tem título com # e as notas não usam título, a primeira linha já é a ideia');
  if (!/#claude\b/.test(txt)) problemas.push('falta a tag #claude');
  const pasta = fp.slice(vault.length + '/CLAUDE/'.length).split('/')[0];
  const tagPasta = { feedback: '#feedback', 'decisões': '#decisão', 'padrões': '#padrão', descobertas: '#descoberta', projetos: '#projeto' }[pasta];
  if (tagPasta && !txt.includes(tagPasta)) problemas.push(`falta a tag ${tagPasta}`);

  if (problemas.length) {
    console.error(`A nota ${fpBruto} está fora do padrão do segundo cérebro: ${problemas.join('; ')}. Corrija o arquivo agora.`);
    process.exit(2);
  }
}
