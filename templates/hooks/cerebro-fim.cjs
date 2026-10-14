#!/usr/bin/env node
// Stop: se a sessão mexeu em vários arquivos e não anotou nada no cérebro, pede pra anotar antes de encerrar.
// Instalado pelo Claude Setuper.
const fs = require('node:fs');

// Lê a entrada do hook de forma assíncrona: readFileSync(0) falha em silêncio no Windows quando a entrada vem por pipe.
function lerEntrada(cb) {
  let dados = '';
  let pronto = false;
  const fim = () => { if (pronto) return; pronto = true; let e = {}; try { e = JSON.parse(dados || '{}'); } catch {} cb(e); };
  if (process.stdin.isTTY) return fim();
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (c) => { dados += c; });
  process.stdin.on('end', fim);
  process.stdin.on('error', fim);
  setTimeout(fim, 3000);
}

lerEntrada(main);

function main(entrada) {
  if (entrada.stop_hook_active) process.exit(0); // já pedimos uma vez nesta parada

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
      reason: `Antes de encerrar: esta sessão alterou ${fora} arquivos e nada foi anotado no segundo cérebro. Escreva uma nota curta em ${vaultBruto}/CLAUDE/projetos/ dizendo onde o trabalho parou e o que falta (uma ideia por nota, sem título, terminando com #claude #projeto). Se houve alguma decisão ou correção, anote também em decisões/ ou feedback/. Depois pode encerrar.`,
    }));
  }
}
