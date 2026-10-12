#!/usr/bin/env node
// PostToolUse (Write|Edit): garante que o Claude só escreve dentro de CLAUDE/ no vault e no formato certo.
// Instalado pelo Claude Setuper.
const fs = require('node:fs');

let entrada = {};
try { entrada = JSON.parse(fs.readFileSync(0, 'utf8') || '{}'); } catch {}

const vault = process.env.CLAUDE_SETUPER_VAULT;
const fp = entrada.tool_input?.file_path || '';
if (!vault || !fp.startsWith(vault + '/')) process.exit(0);

const dentro = fp.startsWith(vault + '/CLAUDE/');
if (!dentro) {
  if (fp.includes('/.obsidian/')) process.exit(0);
  console.error(`Você escreveu em ${fp}, que fica fora de CLAUDE/. O resto do segundo cérebro é da pessoa. Desfaça essa alteração (restaure o conteúdo anterior) e, se a informação importa, grave em ${vault}/CLAUDE/ na subpasta certa.`);
  process.exit(2);
}

if (!fp.endsWith('.md') || fp.endsWith('/README.md')) process.exit(0);
let txt = '';
try { txt = fs.readFileSync(fp, 'utf8'); } catch { process.exit(0); }

const problemas = [];
if (txt.trimStart().startsWith('---')) problemas.push('tem frontmatter (---), e as notas do cérebro não levam');
if (/^#{1,6}\s/m.test(txt)) problemas.push('tem título com # e as notas não usam título, a primeira linha já é a ideia');
if (!/#claude\b/.test(txt)) problemas.push('falta a tag #claude');
const pasta = fp.slice(vault.length + '/CLAUDE/'.length).split('/')[0];
const tagPasta = { feedback: '#feedback', 'decisões': '#decisão', 'padrões': '#padrão', descobertas: '#descoberta', projetos: '#projeto' }[pasta];
if (tagPasta && !txt.includes(tagPasta)) problemas.push(`falta a tag ${tagPasta}`);

if (problemas.length) {
  console.error(`A nota ${fp} está fora do padrão do segundo cérebro: ${problemas.join('; ')}. Corrija o arquivo agora.`);
  process.exit(2);
}
