// Idioma do Setuper. O texto em português é a chave: t('Frase com {nome}', { nome }). Sem tradução, sai em português.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
export const IDIOMAS = ['pt', 'en'];
let idioma = 'pt';
let catalogo = {};

// No presente o app se chama Segundo Cérebro: o nome comum não aparece pra pessoa.
let nomeApp = '';
export function definirNomeApp(n) { nomeApp = n; }
const comNome = (s) => (nomeApp && typeof s === 'string' ? s.replaceAll('Claude Setuper', nomeApp) : s);

export function definirIdioma(novo) {
  idioma = IDIOMAS.includes(novo) ? novo : 'pt';
  catalogo = {};
  moldes = null;
  if (idioma !== 'pt') {
    try { catalogo = JSON.parse(fs.readFileSync(path.join(AQUI, 'idiomas', `${idioma}.json`), 'utf8')); } catch {}
  }
  return idioma;
}
export const idiomaAtual = () => idioma;
export const catalogoAtual = () => catalogo;

// Frase que já veio montada ("Instalando o Chrome: 45%"): procura o molde dela no catálogo.
// Molde com pouco texto fixo fica de fora, porque casaria com qualquer coisa.
let moldes = null;
function compilarMoldes() {
  moldes = Object.keys(catalogo)
    .filter((k) => k.includes('{') && k.replace(/\{\w+\}/g, '').trim().length >= 8)
    .sort((a, b) => b.length - a.length)
    .map((k) => {
      const nomes = [];
      const fonte = k.split(/(\{\w+\})/).map((p) => {
        const m = p.match(/^\{(\w+)\}$/);
        if (m) { nomes.push(m[1]); return '(.+?)'; }
        return p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      }).join('');
      return { re: new RegExp(`^${fonte}$`, 's'), nomes, modelo: catalogo[k] };
    });
}
export function traduzir(texto) {
  if (idioma === 'pt' || !texto) return comNome(texto);
  if (catalogo[texto] !== undefined) return comNome(catalogo[texto]);
  if (!moldes) compilarMoldes();
  for (const { re, nomes, modelo } of moldes) {
    const m = String(texto).match(re);
    if (m) return comNome(modelo.replace(/\{(\w+)\}/g, (x, k) => { const i = nomes.indexOf(k); return i >= 0 ? m[i + 1] : x; }));
  }
  return comNome(texto);
}

export function t(texto, vars) {
  const base = catalogo[texto] ?? texto;
  return comNome(vars ? base.replace(/\{(\w+)\}/g, (m, k) => (vars[k] ?? m)) : base);
}
