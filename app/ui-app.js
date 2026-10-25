// A mesma interface do src/ui.js (Terminal), só que conversando com a janela do app.
// `enviar` manda um evento pra tela; `pedir` manda uma pergunta e espera a resposta da pessoa.
const ANSI = /\x1b\[[0-9;?]*[A-Za-z]/g;
const limpo = (s) => String(s ?? '').replace(ANSI, '');
// Igual ao src/ui.js: frase curta da tarefa vale; saída de comando nunca vai pra tela.
const mensagemFeito = (r, feito) => (typeof r === 'string' && r && r.length <= 100 && !r.includes('\n') && !r.includes('==>') ? r : feito);
const opcoesLimpas = (opcoes) => opcoes.map((o) => ({ value: o.value, label: limpo(o.label), hint: o.hint ? limpo(o.hint) : '' }));

export function criarUiApp(enviar, pedir) {
  let tarefas = 0;
  const msg = (nivel) => (texto) => enviar({ tipo: 'msg', nivel, texto: limpo(texto) });

  return {
    abertura(titulo, sub) {
      enviar({ tipo: 'abertura', titulo: limpo(titulo), sub: limpo(sub) });
    },
    encerramento(texto) {
      enviar({ tipo: 'encerramento', texto: limpo(texto) });
    },
    // Só o app usa: a lista de passos aparece inteira antes de começar.
    plano(nomes) {
      enviar({ tipo: 'plano', passos: nomes.map(limpo) });
    },
    passo(n, total, titulo, curto) {
      enviar({ tipo: 'passo', n, total, titulo: limpo(curto || titulo) });
    },
    ok: msg('ok'),
    info: msg('info'),
    aviso: msg('aviso'),
    erro: msg('erro'),
    pausa(titulo, linhas, { figura } = {}) {
      enviar({ tipo: 'pausa', titulo: limpo(titulo), linhas: (Array.isArray(linhas) ? linhas : [linhas]).map(limpo), figura });
    },

    async tarefa(fazendo, feito, fn, { demora } = {}) {
      const id = ++tarefas;
      const mostrar = (estado, texto) => enviar({ tipo: 'tarefa', id, estado, texto: limpo(texto) });
      mostrar('fazendo', fazendo);
      const timer = demora ? setTimeout(() => mostrar('fazendo', `${fazendo} (${demora})`), 60_000) : null;
      try {
        const r = await fn((m) => mostrar('fazendo', m));
        mostrar('feito', mensagemFeito(r, feito));
        return r;
      } catch (e) {
        mostrar('falhou', `Não consegui: ${limpo(fazendo).toLowerCase()}`);
        throw e;
      } finally {
        clearTimeout(timer);
      }
    },

    // Igual ao Terminal: a validação recebe o que a pessoa digitou; vazio com padrão vira o padrão.
    async perguntar(texto, { padrao, placeholder, validar } = {}) {
      let erro;
      for (;;) {
        const v = String((await pedir({ tipo: 'texto', msg: limpo(texto), padrao: padrao ?? '', placeholder: limpo(placeholder), erro })) ?? '').trim();
        erro = validar ? validar(v) : undefined;
        if (!erro) return String(v || padrao || '').trim();
      }
    },
    escolher(texto, opcoes, { padrao, explicacao } = {}) {
      return pedir({ tipo: 'escolher', msg: limpo(texto), explicacao: limpo(explicacao), opcoes: opcoesLimpas(opcoes), padrao: padrao ?? opcoes[0]?.value });
    },
    escolherVarios(texto, opcoes, { padrao = [], explicacao } = {}) {
      return pedir({ tipo: 'varios', msg: limpo(texto), explicacao: limpo(explicacao), opcoes: opcoesLimpas(opcoes), padrao });
    },
    // nao: '' deixa um botão só; figura é a ilustração de onde clicar.
    confirmar(texto, padrao = true, { sim = 'Sim', nao = 'Não', explicacao, figura } = {}) {
      return pedir({ tipo: 'confirmar', msg: limpo(texto), explicacao: limpo(explicacao), padrao, sim: limpo(sim), nao: limpo(nao), figura });
    },
    async senha(texto) {
      return String((await pedir({ tipo: 'senha', msg: limpo(texto) })) ?? '');
    },
    linha() {},
  };
}
