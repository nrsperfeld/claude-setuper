// A aula por cima do Maestri (no Windows, por cima da janela aberta pelo atalho): o guia flutuante ensina o básico enquanto a pessoa faz de verdade.
// O avanço vem dos hooks do Claude (templates/hooks/aula.cjs). Toda lição tem saída, pra ninguém ficar preso.
import fs from 'node:fs';
import path from 'node:path';

const OPCOES = (t, feitos) => [
  { id: 'github', titulo: t('Guardar cópia do trabalho'), sub: 'GitHub' },
  { id: 'chrome', titulo: t('Usar o seu navegador'), sub: t('Extensão do Chrome') },
  { id: 'vercel', titulo: t('Publicar sites'), sub: 'Vercel' },
  { id: 'conectores', titulo: t('Gmail, Drive e Agenda'), sub: t('Conectores da IA') },
].map((o) => ({ ...o, feito: feitos.includes(o.id) }));

function licoes(t, { nome, autonomia, mac, feitos }) {
  const semPedidoDeLicenca = ['confiante', 'livre'].includes(autonomia);
  const atalhoNovo = mac ? '⌘' : 'Ctrl';
  const lista = [
    { titulo: t('Isso aqui é um terminal'), linhas: [t('É uma janela de conversa por texto com o computador. Parece coisa de programador, mas aqui dentro quem responde é a sua IA, que se chama Claude, então você só precisa escrever como escreve no WhatsApp.')], tela: mac ? t('Janela grande à esquerda') : t('A janela preta que abriu'), botao: t('Entendi'), alvos: [{ janela: true, rotulo: t('A janela da IA é a grande, do lado esquerdo. As notas do lado são lembretes pra você') }] },
    { titulo: t('Manda a sua primeira mensagem'), linhas: [t('Clica na janela da IA, escreve o que quiser e aperta Enter. Se não souber o que escrever, usa a frase aí de cima.')], tela: t('❯ oi, me explica o que você consegue fazer aqui'), teclas: ['Enter'], espera: ['mensagem'], status: t('Quando você mandar, eu sigo sozinho.'), alvos: [{ janela: true, rotulo: t('Clica na janela grande, a da IA, e escreve') }] },
    semPedidoDeLicenca
      ? { titulo: t('Usa as setinhas pra escolher'), linhas: [t('Escreve /resume e aperta Enter. Aparece a lista das suas conversas: sobe e desce com as setas do teclado e aperta Enter na que quiser. Toda escolha aqui funciona assim.')], tela: '/resume', teclas: ['↑', '↓', 'Enter'], espera: ['sessao-resume'], status: t('Quando você escolher, eu sigo sozinho.'), alvos: [{ janela: true, rotulo: t('Escreve /resume na janela grande, a da IA') }] }
      : { titulo: t('Usa as setinhas pra responder'), linhas: [t('Quando a IA pede permissão, ela mostra opções numeradas. Sobe e desce com as setas do teclado e aperta Enter, ou aperta direto o número da opção. Se ainda não pediu, pede pra ela criar um arquivo de teste.')], tela: t('❯ 1. Sim\n  2. Sim, e não pergunta de novo\n  3. Não'), teclas: ['↑', '↓', 'Enter'], espera: ['permissao'], status: t('Quando ela pedir permissão, você responde e eu sigo sozinho.'), alvos: [{ janela: true, rotulo: t('As opções aparecem na janela grande, a da IA') }] },
    { titulo: t('Se preferir, fala em vez de digitar'), linhas: [t('Clica na janela da IA, segura a barra de espaço, fala e solta. O que você falou aparece escrito, e aí é só conferir e apertar Enter. Na primeira vez o computador pergunta se pode usar o microfone: clica em Permitir.')], tela: t('Segura, fala e solta'), teclas: [t('barra de espaço')], botao: t('Entendi'), alvos: [{ janela: true, rotulo: t('Clica na janela grande, a da IA, e segura a barra de espaço') }] },
    { titulo: t('Pra parar a IA, aperta Esc'), linhas: [t('Uma vez faz ela parar o que está fazendo. Duas vezes volta pra sua mensagem anterior, pra você corrigir e mandar de novo.')], tela: t('Uma vez para, duas vezes volta'), teclas: ['Esc'], botao: t('Entendi'), alvos: [{ janela: true, rotulo: t('Vale com a janela grande, a da IA, selecionada') }] },
    { titulo: t('Abre uma segunda conversa'), linhas: [mac ? t('Aperta Command e T. Se aparecer uma lista de agentes, escolhe Claude Code. Se abrir só uma tela preta, escreve claude e aperta Enter. Cada janela é uma conversa separada, cada uma no seu trabalho.') : t('Clica de novo no atalho da IA na sua Área de Trabalho. Cada janela é uma conversa separada, cada uma no seu trabalho.')], tela: t('Uma janela nova da IA'), teclas: mac ? [atalhoNovo, 'T'] : [], espera: ['sessao-startup'], status: t('Quando a janela nova abrir, eu sigo sozinho.'), alvos: [{ janela: true, rotulo: t('A janela nova aparece aqui dentro') }] },
    { titulo: t('Começar do zero ou voltar numa conversa'), linhas: [t('O /clear começa uma conversa limpa, e o que ela anotou nas suas notas continua guardado. O /resume mostra as conversas anteriores, e nessa lista você escolhe com as setinhas.')], tela: t('/clear    conversa nova\n/resume   conversas antigas'), espera: ['sessao-clear', 'sessao-resume'], status: t('Quando você usar um dos dois, eu sigo sozinho.'), alvos: [{ janela: true, rotulo: t('Escreve na janela grande, a da IA') }] },
    { titulo: t('A barra em cima da sua mensagem'), linhas: [t('Ela mostra quanto a IA vai pensar nesse pedido, e ela escolhe isso sozinha, pouco pra coisa simples e muito pra coisa difícil. Também mostra quanto da conversa já foi usado. Se um dia parar de mudar, escreve /effortless auto.')], tela: 'effortless · Medium', botao: t('Entendi'), alvos: [{ janela: true, rotulo: t('A barra fica logo acima da linha onde você escreve') }] },
    { fim: true, titulo: nome ? t('O básico é isso, {nome}', { nome }) : t('O básico é isso'), linhas: [t('O resto você vai pegando com o uso, e pode perguntar pra própria IA. O que ainda estiver com o botão Ligar aqui embaixo dá pra ligar agora ou depois, abrindo o Claude Setuper de novo.')], opcoes: OPCOES(t, feitos), botao: t('Fechar a aula') },
  ];
  // O Maestri abre num tamanho e num zoom diferentes em cada tela, então nada de apontar um ponto dentro dele: a moldura
  // marca a janela e o recado diz onde olhar em palavras. No Windows a janela é outra, então não marca nada.
  return mac ? lista : lista.map(({ alvos: _a, ...licao }) => licao);
}

export function criarAula({ claudeDir, pasta, t, mostrar, esconder, aoTerminar, respostas, mac }) {
  const ativa = path.join(claudeDir, 'setuper-aula-ativa');
  const eventos = path.join(claudeDir, 'setuper-aula-eventos.jsonl');
  const arqEstado = path.join(pasta, 'aula.json');
  const lerEstado = () => { try { return JSON.parse(fs.readFileSync(arqEstado, 'utf8')); } catch { return { i: 0, feitos: [] }; } };
  let e = lerEstado();
  let lidos = 0;
  let vigia = null;
  const salvar = () => { try { fs.writeFileSync(arqEstado, JSON.stringify(e)); } catch {} };
  const lista = () => licoes(t, { nome: respostas().nome || '', autonomia: respostas().autonomia, mac, feitos: e.feitos });

  function desenhar() {
    const l = lista();
    const atual = l[Math.min(e.i, l.length - 1)];
    const total = l.length - 1;
    mostrar({
      rotulo: t('Aula'), contagem: atual.fim ? t('Fim') : t('{i} de {n}', { i: e.i + 1, n: total }), aula: true, volta: e.i > 0 && !atual.fim,
      // Lição que avança pelo hook também tem saída, caso o hook não dispare.
      appId: mac ? 'maestri' : 'ia', passos: [{ ...atual, botao: atual.botao || t('Já fiz') }],
    });
  }
  function ir(n) {
    e.i = Math.max(0, n);
    salvar();
    desenhar();
  }
  function verEventos() {
    let txt;
    try { txt = fs.readFileSync(eventos, 'utf8'); } catch { return; }
    const linhas = txt.split('\n').filter(Boolean);
    const novos = linhas.slice(lidos);
    lidos = linhas.length;
    const atual = lista()[e.i];
    if (!atual?.espera) return;
    for (const linha of novos) {
      let ev;
      try { ev = JSON.parse(linha); } catch { continue; }
      if (atual.espera.includes(ev.evento)) return ir(e.i + 1);
    }
  }
  function terminar() {
    clearInterval(vigia);
    try { fs.rmSync(ativa, { force: true }); fs.rmSync(eventos, { force: true }); } catch {}
    esconder();
    aoTerminar();
  }
  return {
    iniciar() {
      fs.mkdirSync(claudeDir, { recursive: true });
      fs.writeFileSync(ativa, String(Date.now()));
      try { lidos = fs.readFileSync(eventos, 'utf8').split('\n').filter(Boolean).length; } catch { lidos = 0; }
      desenhar();
      clearInterval(vigia);
      vigia = setInterval(verEventos, 1000);
    },
    redesenhar: desenhar,
    acao(a) {
      const l = lista();
      if (a === 'avancar') { if (l[e.i]?.fim) return terminar(); return ir(e.i + 1); }
      if (a === 'voltar') return ir(e.i - 1);
      if (a === 'pular') return ir(l.length - 1);
      return undefined;
    },
    marcarFeito(id) { if (!e.feitos.includes(id)) e.feitos.push(id); salvar(); },
    ativa: () => fs.existsSync(ativa),
  };
}
