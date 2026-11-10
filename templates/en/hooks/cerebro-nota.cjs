#!/usr/bin/env node
// PostToolUse (Write|Edit): makes sure the AI only writes inside CLAUDE/ in the second brain and in the right format.
// Installed by Claude Setuper.
const fs = require('node:fs');

// Reads the hook input asynchronously: readFileSync(0) fails silently on Windows when the input comes through a pipe.
function lerEntrada(cb) {
  let dados = '';
  let pronto = false;
  const fim = () => { if (pronto) return; pronto = true; let e = {}; try { e = JSON.parse(dados.replace(/^\uFEFF/, '') || '{}'); } catch {} cb(e); };
  if (process.stdin.isTTY) return fim();
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (c) => { dados += c; });
  process.stdin.on('end', fim);
  process.stdin.on('error', fim);
  setTimeout(fim, 3000).unref(); // unref: doesn't hold the process open after the input has arrived
}

lerEntrada(main);

function main(entrada) {

  const norm = (s) => String(s || '').normalize('NFC').replace(/\\/g, '/').replace(/\/+$/, '');
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
    console.error(`You wrote to ${fpBruto}, which is outside CLAUDE/. The rest of the second brain belongs to the person. Undo that change (restore the previous content) and, if the information matters, save it in ${vaultBruto}/CLAUDE/ in the right subfolder.`);
    process.exit(2);
  }

  if (!fp.endsWith('.md') || fp.endsWith('/README.md')) process.exit(0);
  const pasta = fp.slice(vault.length + '/CLAUDE/'.length).split('/')[0];
  // The inbox folder receives outside material (Web Clipper saves with frontmatter): it isn't a note written by the AI.
  if (pasta.toLowerCase() === 'inbox') process.exit(0);
  let txt = '';
  try { txt = fs.readFileSync(fpBruto, 'utf8'); } catch { process.exit(0); }

  const problemas = [];
  if (txt.trimStart().startsWith('---')) problemas.push('it has frontmatter (---), and second brain notes do not use it');
  if (/^#{1,6}\s/m.test(txt)) problemas.push('it has a # heading and notes do not use headings, the first line is already the idea');
  if (!/#claude\b/.test(txt)) problemas.push('the #claude tag is missing');
  const tagPasta = { feedback: '#feedback', decisions: '#decision', patterns: '#pattern', discoveries: '#discovery', projects: '#project', wiki: '#wiki', sources: '#source' }[pasta];
  if (tagPasta && !txt.includes(tagPasta)) problemas.push(`the ${tagPasta} tag is missing`);

  if (problemas.length) {
    console.error(`The note ${fpBruto} doesn't follow the second brain format: ${problemas.join('; ')}. Fix the file now.`);
    process.exit(2);
  }
}
