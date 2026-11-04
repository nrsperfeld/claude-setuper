// Confere a pasta presente/ antes do build e devolve, separados por tab: pessoa, nome, rótulo e caminho do signo.
//   node app/presente/info.mjs <pasta-presente>
// Sai com erro (e a lista do que está errado) se o presente.json tiver problema: o app não sai com presente quebrado.
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const { lerPresente } = await import(pathToFileURL(path.join(raiz, 'src', 'presente.js')).href);
const dir = process.argv[2];
const p = lerPresente(dir, { templates: path.join(raiz, 'templates') });
if (!p) {
  console.error(`Não achei presente.json em ${dir}`);
  process.exit(1);
}
if (p.problemas.length) {
  console.error(`presente.json com problema:\n- ${p.problemas.join('\n- ')}`);
  process.exit(1);
}
const notas = (d) => fs.readdirSync(d, { withFileTypes: true }).reduce((n, e) => n + (e.isDirectory() ? notas(path.join(d, e.name)) : e.name.endsWith('.md') ? 1 : 0), 0);
console.error(`presente de ${p.nome}: ${notas(p.cofre)} notas no cofre`);
console.log([p.pessoa, p.nome, p.rotulo, p.signo].join('\t'));
