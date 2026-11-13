// Registro dos módulos, na ordem em que rodam.
// Cada módulo exporta: id, nome, descricao, padrao, obrigatorio?, plataformas?,
// verificar(ctx) -> [{item, ok, dica}], instalar(ctx), remover?(ctx).
import * as base from './base.js';
import * as nucleo from './nucleo.js';
import * as effortless from './effortless.js';
import * as obsidian from './obsidian.js';
import * as github from './github.js';
import * as chrome from './chrome.js';
import * as vercel from './vercel.js';
import * as pacotes from './pacotes.js';
import * as mcps from './mcps.js';
import * as rotinas from './rotinas.js';
import * as sentinela from './sentinela.js';
import * as maestri from './maestri.js';
import * as atalho from './atalho.js';

export const MODULOS = [base, nucleo, effortless, obsidian, github, chrome, vercel, pacotes, mcps, rotinas, sentinela, maestri, atalho];

export function modulo(id) {
  return MODULOS.find((m) => m.id === id);
}

// GitHub e a IA no Chrome entram sempre, seja qual for o perfil, o presente ou o que a pessoa marcou.
export const SEMPRE = ['github', 'chrome'];

// A lista de passos com os de sempre dentro, na ordem em que rodam.
export function comSempre(ids = []) {
  const quer = new Set([...ids, ...SEMPRE]);
  return [...MODULOS.filter((m) => quer.has(m.id)).map((m) => m.id), ...ids.filter((id) => !modulo(id))];
}

// O que conferir nesta máquina: os passos que já rodaram aqui, mais os de sempre. Sem instalação nenhuma, o padrão.
// (O que a pessoa escolheu mas fica pro fim da aula, como a Vercel no app, só entra depois de rodar.)
export function modulosInstalados(ctx) {
  const ids = Object.keys(ctx.estado.modulos || {});
  return modulosParaPlataforma(comSempre(ids.length ? ids : MODULOS.filter((m) => m.padrao).map((m) => m.id)), ctx.plataforma);
}

export function modulosParaPlataforma(ids, plataforma) {
  return ids
    .map(modulo)
    .filter(Boolean)
    .filter((m) => !m.plataformas || m.plataformas.includes(plataforma));
}
