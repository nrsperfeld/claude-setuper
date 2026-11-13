// verificar: a conferência do doctor, e mais o conserto. O que estiver faltando é instalado na hora pelo
// instalar() do próprio módulo, e depois conferido de novo. É o que roda na segunda janela do primeiro dia
// (src/segundaJanela.js) e também à mão: claude-setuper verificar. Pode rodar quantas vezes quiser:
// com tudo no lugar, só confere.
import { ui, c } from './ui.js';
import { modulosInstalados } from './modulos/index.js';
import { conferir, mostrarItens } from './doctor.js';
import { cuidados } from './cuidados.js';
import { t, traduzir } from './i18n.js';

// Na segunda janela, quando falta alguma coisa no Windows, a conferência sai com este código:
// a janela (que nasce minimizada) se abre de novo na frente pra pessoa acompanhar o conserto.
export const SAIDA_REABRIR = 3;

// Pendências que só a pessoa resolve: entrar numa conta, adicionar a extensão, dar o clique de confiança.
const DEPENDE_DA_PESSOA = /^Login no Claude|^Contas? conectadas?|^git sabe|^Extensão Claude no Chrome|^Complementos do Obsidian ligados|^Login na Vercel/;

export async function verificar(ctx, { modulos = modulosInstalados(ctx), segundaJanela = false } = {}) {
  ui.abertura('Claude Setuper · conferência', segundaJanela
    ? 'Conferindo se ficou tudo instalado e funcionando. Pode continuar conversando com a IA na outra janela.'
    : 'Conferindo se está tudo instalado e funcionando');
  if (!ctx.estado.respostas?.nome) {
    ui.encerramento(t('Ainda não tem instalação neste computador. Rode {cmd} pra instalar.', { cmd: c.bold('claude-setuper') }));
    return { semInstalacao: true, faltando: 0, consertados: [], pendentes: [] };
  }
  // Os módulos instalam com as respostas da pessoa, as mesmas da instalação.
  ctx.resp = ctx.estado.respostas;
  // Conserto no meio de uma conversa: nada de fechar e reabrir a janela da IA, nem de oferecer extras.
  ctx.conferindo = true;

  const comFalta = [];
  const daPessoa = [];
  for (const m of modulos) {
    const itens = await conferir(ctx, m);
    if (!mostrarItens(ctx, m.id, m.nome, itens, 'verificar')) continue;
    // A segunda janela abre sozinha, no meio da aula. O que a pessoa deixou pra depois (um login, a extensão, o clique
    // do Obsidian) ela não refaz: mexer nisso ali era desfazer a escolha da pessoa e disputar a tela com a aula.
    if (segundaJanela && itens.filter((i) => !i.ok).every((i) => DEPENDE_DA_PESSOA.test(i.item))) daPessoa.push(m);
    else comFalta.push(m);
  }
  // Os cuidados só aparecem: quem decide o que fazer com eles é a pessoa (ou quem ajuda ela).
  const avisos = mostrarItens(ctx, 'cuidados', t('Cuidados'), cuidados(ctx), 'verificar');
  console.log();

  if (!comFalta.length && daPessoa.length) {
    ui.encerramento(t('Está tudo instalado. Ficou pendente só o que depende de você: {nomes}. Quando quiser terminar, abre o Claude Setuper de novo. Pode fechar esta janela.', { nomes: daPessoa.map((m) => traduzir(m.nomeCurto || m.nome)).join(', ') }));
    return { faltando: 0, consertados: [], pendentes: daPessoa.map((m) => m.id) };
  }
  if (!comFalta.length) {
    ui.encerramento(c.green(t(avisos ? 'Está tudo instalado e funcionando. Só dá uma olhada nos cuidados aí em cima.' : 'Está tudo instalado e funcionando. Pode fechar esta janela.')));
    return { faltando: 0, consertados: [], pendentes: [] };
  }
  const nomes = comFalta.map((m) => traduzir(m.nomeCurto || m.nome)).join(', ');
  if (ctx.dryRun) {
    ui.encerramento(t('Modo de teste: eu instalaria de novo {nomes}.', { nomes }));
    return { faltando: comFalta.length, consertados: [], pendentes: comFalta.map((m) => m.id) };
  }
  if (segundaJanela && ctx.win) return { reabrir: true, faltando: comFalta.length, consertados: [], pendentes: comFalta.map((m) => m.id) };
  // A janela nasce atrás da conversa. Agora que tem o que fazer (e talvez um login), ela vem pra frente.
  if (segundaJanela && ctx.plataforma === 'darwin') await ctx.run('open', ['-a', 'Terminal'], { ignorarErro: true });
  ui.aviso(t('Achei coisa faltando em: {nomes}. Vou instalar agora, e aviso se precisar de você.', { nomes }));

  let n = 0;
  for (const m of comFalta) {
    n++;
    ui.linha();
    ui.passo(n, comFalta.length, m.nome, m.nomeCurto);
    try {
      await m.instalar(ctx);
      ctx.estado.modulos[m.id] = { ok: true, em: new Date().toISOString() };
    } catch (e) {
      const motivo = String(e.message || e).split('\n')[0].slice(0, 220);
      ctx.log('FALHA verificar', m.id, e.stack || e.message);
      ctx.estado.modulos[m.id] = { ok: false, em: new Date().toISOString(), erro: e.message };
      // Pendência que depende da pessoa (um login) é aviso, não erro.
      if (e.continuar) ui.aviso(`${m.nomeCurto || m.nome}: ${motivo}`);
      else ui.erro(`${m.nome}: não deu certo agora (${motivo}).`);
    }
    ctx.salvarEstado();
  }

  // Com o GitHub ligado agora, o backup das notas passa a poder ser ligado também (o app faz o mesmo no botão Ligar).
  if (comFalta.some((m) => m.id === 'github') && modulos.some((m) => m.id === 'rotinas') && ctx.estado.modulos.github?.ok) {
    try { await modulos.find((m) => m.id === 'rotinas').instalar(ctx); } catch (e) { ctx.log('FALHA verificar', 'rotinas', e.stack || e.message); }
  }

  // Confere de novo só o que foi mexido.
  ui.linha();
  const consertados = [];
  const pendentes = [];
  let faltando = 0;
  for (const m of comFalta) {
    const falta = mostrarItens(ctx, m.id, m.nome, await conferir(ctx, m), 'verificar');
    faltando += falta;
    (falta ? pendentes : consertados).push(m.id);
  }
  console.log();
  if (!faltando) ui.encerramento(c.green(t('Pronto: instalei o que faltava e conferi de novo. Está tudo funcionando. Pode fechar esta janela.')));
  else ui.encerramento(t(faltando === 1
    ? 'Ainda falta {n} item, marcado com ✗ aí em cima. Ele depende de você: siga a dica ao lado dele, ou rode {cmd} de novo quando puder.'
    : 'Ainda faltam {n} itens, marcados com ✗ aí em cima. Eles dependem de você: siga a dica ao lado de cada um, ou rode {cmd} de novo quando puder.', { n: faltando, cmd: c.bold('claude-setuper verificar') }));
  return { faltando, consertados, pendentes };
}
