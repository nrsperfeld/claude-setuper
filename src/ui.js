// Camada de interface: uma coisa por vez na tela, português do dia a dia, nada de log.
import * as p from '@clack/prompts';
import c from 'picocolors';
import { traduzir } from './i18n.js';

let andamentoAtual = null;

// Tudo que vai pra tela passa pelo catálogo, igual ao app. Sem tradução, a frase sai como veio, com a cor dela.
const ANSI = /\x1b\[[0-9;?]*[A-Za-z]/g;
const tr = (s) => {
  if (!s) return s;
  const limpo = String(s).replace(ANSI, '');
  const dito = traduzir(limpo);
  return dito === limpo ? s : dito;
};
const trOpcoes = (opcoes) => opcoes.map((o) => ({ ...o, label: tr(o.label), hint: o.hint ? tr(o.hint) : o.hint }));

export const ui = {
  abertura(titulo, sub) {
    console.clear();
    p.intro(c.bgCyan(c.black(` ${tr(titulo)} `)));
    if (sub) p.log.message(c.dim(tr(sub)));
  },

  encerramento(msg) {
    p.outro(tr(msg));
  },

  passo(n, total, titulo, _curto) {
    p.log.step(`${c.dim(`${n}/${total}`)}  ${c.bold(tr(titulo))}`);
  },

  ok(msg) {
    p.log.success(tr(msg));
  },

  info(msg) {
    p.log.info(tr(msg));
  },

  aviso(msg) {
    p.log.warn(tr(msg));
  },

  erro(msg) {
    p.log.error(tr(msg));
  },

  // Caixa destacada, usada nas pausas: uma ação só.
  // `figura` é a ilustração de onde clicar; só o app desenha.
  pulou: () => false,
  pediuTentar: () => false,

  // No app isso vira o guia flutuante; no Terminal, uma caixa e uma confirmação.
  async confirmarFora({ passos, concluir = 'Pronto', nao = 'Não' }) {
    p.note(passos.map((x) => [x.titulo, ...(x.linhas || [])].map(tr).join('\n')).join('\n\n'), c.yellow(`✋ ${tr('Sua vez')}`));
    const r = await p.confirm({ message: tr(concluir), initialValue: true, active: tr(concluir), inactive: tr(nao || 'Não') });
    checar(r);
    return r;
  },

  pausa(titulo, linhas, _opcoes) {
    p.note((Array.isArray(linhas) ? linhas : [linhas]).map(tr).join('\n'), c.yellow(`✋ ${tr(titulo)}`));
  },

  // Roda uma tarefa demorada mostrando uma frase no presente ("Instalando o Obsidian").
  // `fazendo` aparece durante ("Instalando o Obsidian"), `feito` no fim ("Obsidian instalado").
  async tarefa(fazendo, feito, fn, { demora } = {}) {
    const s = p.spinner();
    s.start(tr(fazendo));
    andamentoAtual = (msg) => s.message(tr(msg));
    let timer;
    if (demora) timer = setTimeout(() => s.message(`${tr(fazendo)}  ${c.dim(tr(demora))}`), 60_000);
    try {
      const r = await fn((msg) => s.message(tr(msg)));
      s.stop(tr(mensagemFeito(r, feito)));
      return r;
    } catch (e) {
      s.stop(c.red(tr(`Não consegui: ${String(tr(fazendo)).toLowerCase()}`)));
      throw e;
    } finally {
      clearTimeout(timer);
      andamentoAtual = null;
    }
  },

  // Atualiza a frase da tarefa em andamento ("Baixando o Chrome: 120 de 250 MB").
  andamento(msg) { andamentoAtual?.(msg); },

  async perguntar(msg, { padrao, placeholder, validar, explicacao } = {}) {
    if (explicacao) p.log.message(tr(explicacao));
    const r = await p.text({ message: tr(msg), defaultValue: padrao, placeholder: tr(placeholder), validate: validar });
    checar(r);
    return String(r ?? padrao ?? '').trim();
  },

  async escolher(msg, opcoes, { padrao, explicacao } = {}) {
    if (explicacao) p.log.message(tr(explicacao));
    const r = await p.select({ message: tr(msg), options: trOpcoes(opcoes), initialValue: padrao });
    checar(r);
    return r;
  },

  async escolherVarios(msg, opcoes, { padrao = [], explicacao } = {}) {
    if (explicacao) p.log.message(tr(explicacao));
    const r = await p.multiselect({ message: tr(msg), options: trOpcoes(opcoes), initialValues: padrao, required: false });
    checar(r);
    return r;
  },

  // `sim` e `nao` trocam o Sim/Não por botões que dizem o que acontece (ex.: "Sim, pode instalar tudo").
  async confirmar(msg, padrao = true, { sim = 'Sim', nao = 'Não', explicacao } = {}) {
    if (explicacao) p.log.message(tr(explicacao));
    const r = await p.confirm({ message: tr(msg), initialValue: padrao, active: tr(sim), inactive: tr(nao) });
    checar(r);
    return r;
  },

  async senha(msg) {
    const r = await p.password({ message: tr(msg) });
    checar(r);
    return String(r ?? '');
  },

  linha() {
    console.log();
  },
};

// A tarefa pode devolver uma frase curta pro fim ("Obsidian instalado"); saída de comando nunca vai pra tela.
export function mensagemFeito(r, feito) {
  return typeof r === 'string' && r && r.length <= 100 && !r.includes('\n') && !r.includes('==>') ? r : feito;
}

function checar(r) {
  if (p.isCancel(r)) {
    p.cancel(tr('Tudo bem, parei aqui. Pode rodar de novo quando quiser, eu continuo de onde parou.'));
    process.exit(0);
  }
}

export { c };
