#!/usr/bin/env node
// Stop: if the session touched several files and wrote nothing in the second brain, asks to write something before ending.
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
  if (entrada.stop_hook_active) process.exit(0); // we already asked once at this stop

  const norm = (s) => String(s || '').replace(/\\/g, '/').replace(/\/+$/, '');
  const vaultBruto = process.env.CLAUDE_SETUPER_VAULT;
  const vault = norm(vaultBruto);
  const eq = (a, b) => (process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b);
  const dentroDe = (fp, base) => (process.platform === 'win32' ? norm(fp).toLowerCase().startsWith((base + '/').toLowerCase()) : norm(fp).startsWith(base + '/'));
  const transcript = entrada.transcript_path;
  if (!vaultBruto || !transcript || !fs.existsSync(transcript)) process.exit(0);

  let fora = 0, dentro = 0;
  for (const linha of fs.readFileSync(transcript, 'utf8').split('\n')) {
    if (!linha.includes('"file_path"')) continue;
    let obj;
    try { obj = JSON.parse(linha); } catch { continue; }
    const conteudo = obj?.message?.content;
    if (!Array.isArray(conteudo)) continue;
    for (const b of conteudo) {
      if (b?.type !== 'tool_use' || !['Write', 'Edit', 'MultiEdit'].includes(b.name)) continue;
      const fp = b.input?.file_path || '';
      if (dentroDe(fp, vault + '/CLAUDE')) dentro++;
      else fora++;
    }
  }

  if (fora >= 3 && dentro === 0) {
    process.stdout.write(JSON.stringify({
      decision: 'block',
      reason: `Before ending: this session changed ${fora} files and nothing was written in the second brain. Write a short note in ${vaultBruto}/CLAUDE/projects/ saying where the work stopped and what's left (one idea per note, no heading, ending with #claude #project). If there was a decision or correction, also write it in decisions/ or feedback/. Then you can end.`,
    }));
  }
}
