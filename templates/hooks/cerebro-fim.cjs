#!/usr/bin/env node
// Stop: se a sessão mexeu em vários arquivos e não anotou nada no cérebro, pede pra anotar antes de encerrar.
// Instalado pelo Claude Setuper.
const fs = require('node:fs');

let entrada = {};
try { entrada = JSON.parse(fs.readFileSync(0, 'utf8') || '{}'); } catch {}
if (entrada.stop_hook_active) process.exit(0); // já pedimos uma vez nesta parada

const vault = process.env.CLAUDE_SETUPER_VAULT;
const transcript = entrada.transcript_path;
if (!vault || !transcript || !fs.existsSync(transcript)) process.exit(0);

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
    if (fp.startsWith(vault + '/CLAUDE/')) dentro++;
    else fora++;
  }
}

if (fora >= 3 && dentro === 0) {
  process.stdout.write(JSON.stringify({
    decision: 'block',
    reason: `Antes de encerrar: esta sessão alterou ${fora} arquivos e nada foi anotado no segundo cérebro. Escreva uma nota curta em ${vault}/CLAUDE/projetos/ dizendo onde o trabalho parou e o que falta (uma ideia por nota, sem título, terminando com #claude #projeto). Se houve alguma decisão ou correção, anote também em decisões/ ou feedback/. Depois pode encerrar.`,
  }));
}
