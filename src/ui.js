// Camada de interface: uma coisa por vez na tela, português do dia a dia, nada de log.
import * as p from '@clack/prompts';
import c from 'picocolors';

export const ui = {
  abertura(titulo, sub) {
    console.clear();
    p.intro(c.bgCyan(c.black(` ${titulo} `)));
    if (sub) p.log.message(c.dim(sub));
  },

  encerramento(msg) {
    p.outro(msg);
  },

  passo(n, total, titulo, _curto) {
    p.log.step(`${c.dim(`${n}/${total}`)}  ${c.bold(titulo)}`);
  },

  ok(msg) {
    p.log.success(msg);
  },

  info(msg) {
    p.log.info(msg);
  },

  aviso(msg) {
    p.log.warn(msg);
  },

  erro(msg) {
    p.log.error(msg);
  },

  // Caixa destacada, usada nas pausas: uma ação só.
  // `figura` é a ilustração de onde clicar; só o app desenha.
  pausa(titulo, linhas, _opcoes) {
    p.note(Array.isArray(linhas) ? linhas.join('\n') : linhas, c.yellow(`✋ ${titulo}`));
  },

  // Roda uma tarefa demorada mostrando uma frase no presente ("Instalando o Obsidian").
  // `fazendo` aparece durante ("Instalando o Obsidian"), `feito` no fim ("Obsidian instalado").
  async tarefa(fazendo, feito, fn, { demora } = {}) {
    const s = p.spinner();
    s.start(fazendo);
    let timer;
    if (demora) timer = setTimeout(() => s.message(`${fazendo}  ${c.dim(demora)}`), 60_000);
    try {
      const r = await fn((msg) => s.message(msg));
      s.stop(mensagemFeito(r, feito));
      return r;
    } catch (e) {
      s.stop(c.red(`Não consegui: ${fazendo.toLowerCase()}`));
      throw e;
    } finally {
      clearTimeout(timer);
    }
  },

  async perguntar(msg, { padrao, placeholder, validar } = {}) {
    const r = await p.text({ message: msg, defaultValue: padrao, placeholder, validate: validar });
    checar(r);
    return String(r ?? padrao ?? '').trim();
  },

  async escolher(msg, opcoes, { padrao, explicacao } = {}) {
    if (explicacao) p.log.message(explicacao);
    const r = await p.select({ message: msg, options: opcoes, initialValue: padrao });
    checar(r);
    return r;
  },

  async escolherVarios(msg, opcoes, { padrao = [], explicacao } = {}) {
    if (explicacao) p.log.message(explicacao);
    const r = await p.multiselect({ message: msg, options: opcoes, initialValues: padrao, required: false });
    checar(r);
    return r;
  },

  // `sim` e `nao` trocam o Sim/Não por botões que dizem o que acontece (ex.: "Não, pode instalar tudo").
  async confirmar(msg, padrao = true, { sim = 'Sim', nao = 'Não', explicacao } = {}) {
    if (explicacao) p.log.message(explicacao);
    const r = await p.confirm({ message: msg, initialValue: padrao, active: sim, inactive: nao });
    checar(r);
    return r;
  },

  async senha(msg) {
    const r = await p.password({ message: msg });
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
    p.cancel('Tudo bem, parei aqui. Pode rodar de novo quando quiser, eu continuo de onde parou.');
    process.exit(0);
  }
}

export { c };
