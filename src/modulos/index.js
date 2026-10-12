// Registro dos módulos, na ordem em que rodam.
// Cada módulo exporta: id, nome, descricao, padrao, obrigatorio?, plataformas?,
// verificar(ctx) -> [{item, ok, dica}], instalar(ctx), remover?(ctx).
import * as base from './base.js';
import * as nucleo from './nucleo.js';
import * as obsidian from './obsidian.js';
import * as github from './github.js';
import * as chrome from './chrome.js';
import * as vercel from './vercel.js';
import * as pacotes from './pacotes.js';
import * as mcps from './mcps.js';
import * as rotinas from './rotinas.js';
import * as maestri from './maestri.js';

export const MODULOS = [base, nucleo, obsidian, github, chrome, vercel, pacotes, mcps, rotinas, maestri];

export function modulo(id) {
  return MODULOS.find((m) => m.id === id);
}

export function modulosParaPlataforma(ids, plataforma) {
  return ids
    .map(modulo)
    .filter(Boolean)
    .filter((m) => !m.plataformas || m.plataformas.includes(plataforma));
}
