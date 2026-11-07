// Idioma do Setuper. O texto em português é a chave: t('Frase com {nome}', { nome }). Sem tradução, sai em português.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
export const IDIOMAS = ['pt', 'en'];
let idioma = 'pt';
let catalogo = {};

export function definirIdioma(novo) {
  idioma = IDIOMAS.includes(novo) ? novo : 'pt';
  catalogo = {};
  if (idioma !== 'pt') {
    try { catalogo = JSON.parse(fs.readFileSync(path.join(AQUI, 'idiomas', `${idioma}.json`), 'utf8')); } catch {}
  }
  return idioma;
}
export const idiomaAtual = () => idioma;
export const catalogoAtual = () => catalogo;

export function t(texto, vars) {
  const base = catalogo[texto] ?? texto;
  return vars ? base.replace(/\{(\w+)\}/g, (m, k) => (vars[k] ?? m)) : base;
}
