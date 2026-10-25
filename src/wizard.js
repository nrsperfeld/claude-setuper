// O wizard: poucas perguntas, nenhuma técnica. O resto tem default.
// Ordem: nome, pra que vai usar (perfil), idade, familiaridade com tecnologia e com IA; daí em diante o perfil manda.
import os from 'node:os';
import { ui, c } from './ui.js';
import { MODULOS } from './modulos/index.js';
import { PACOTES } from './modulos/pacotes.js';
import { catalogo } from './modulos/mcps.js';
import { perfis, perfil as acharPerfil, IA_ANTIGA } from './perfis.js';

const AUTONOMIAS = [
  { value: 'cauteloso', label: 'Me pergunta antes de cada coisa', hint: 'mais seguro, mais perguntas' },
  { value: 'equilibrado', label: 'Faz o básico sozinho e me pergunta no que importa', hint: 'recomendado' },
  { value: 'confiante', label: 'Faz tudo e me avisa no fim', hint: 'mais rápido' },
  { value: 'livre', label: 'Nunca me pede licença pra nada', hint: 'o mais rápido; só as travas de segurança continuam (apagar tudo, senhas)' },
];

export async function wizard(ctx) {
  const salvo = ctx.estado.respostas || {};
  const doSistema = (m) => !m.plataformas || m.plataformas.includes(ctx.plataforma);

  if (ctx.sim) {
    const usuario = os.userInfo().username.replace(/[._-]/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
    const p = acharPerfil(ctx, ctx.perfil || salvo.perfil);
    ctx.resp = {
      nome: usuario, trabalho: '', idade: '', tecnologia: 'basico', ia: 'chat', autonomia: 'equilibrado',
      modulos: MODULOS.filter((m) => m.padrao && doSistema(m) && !p.semModulos.includes(m.id)).map((m) => m.id),
      pacotes: p.pacotes, mcps: [], ...salvo, perfil: p.id,
    };
    return ctx.resp;
  }

  // No app, a tela de boas-vindas já disse isso.
  if (!ctx.app) {
    ui.info('Vou preparar o seu Claude. Leva uns 15 minutos.\nEu aviso toda vez que precisar de você, e espero o tempo que for.');
    ui.info('O que muda em relação ao chat: o Claude vai trabalhar direto no seu computador, lembrar de você pelo segundo cérebro\n(o que você decidiu, como gosta das coisas, onde cada projeto parou) e já vir com comandos e rotinas prontos.\nÉ assim que trabalha o 1% que mais tira proveito do Claude.');
    ui.linha();
  }

  const nome = await ui.perguntar('Como você quer que o Claude te chame?', {
    padrao: salvo.nome,
    placeholder: 'Seu primeiro nome ou apelido',
    validar: (v) => (!v && !salvo.nome ? 'Só o nome, pode ser o apelido.' : undefined),
  });

  // --perfil no comando já responde essa (útil pra mandar o link pra uma turma inteira).
  const idPerfil = ctx.perfil || await ui.escolher(
    `Pra que você vai usar o Claude, ${nome}?`,
    perfis(ctx).map((p) => ({ value: p.id, label: p.nome, hint: p.hint })),
    { padrao: salvo.perfil || 'dia-a-dia' },
  );
  const p = acharPerfil(ctx, idPerfil);

  const idade = await ui.perguntar('Quantos anos você tem?', {
    padrao: salvo.idade,
    placeholder: 'Só o número',
    validar: (v) => (!v && salvo.idade) || /^\d{1,3}$/.test(String(v || '').trim()) && +v >= 6 && +v <= 110 ? undefined : 'Só o número, por exemplo 34.',
  });

  const tecnologia = await ui.escolher('Como você se dá com tecnologia?', [
    { value: 'pouco', label: 'Me viro pouco, prefiro que me expliquem tudo' },
    { value: 'basico', label: 'Uso o básico sem problema' },
    { value: 'avancado', label: 'Sou bem à vontade com computador' },
  ], { padrao: salvo.tecnologia || 'basico' });

  const ia = await ui.escolher('E como você usa IA hoje?', [
    { value: 'nunca', label: 'Nunca usei, ou quase nunca' },
    { value: 'chat', label: 'Uso o chat', hint: 'ChatGPT, Claude, Gemini: pergunto e copio a resposta' },
    { value: 'code', label: 'Já uso IA pra programar', hint: 'Claude Code, Codex, Cursor, no terminal ou no editor' },
  ], { padrao: IA_ANTIGA[salvo.ia] || salvo.ia || 'chat' });

  const trabalho = await ui.perguntar(p.trabalho.pergunta, {
    padrao: salvo.perfil === p.id ? salvo.trabalho : undefined,
    placeholder: p.trabalho.placeholder,
  });

  const menor = Number(idade) < 18;
  const autonomia = await ui.escolher(
    'Como você prefere que o Claude trabalhe?',
    AUTONOMIAS.filter((a) => !(menor && a.value === 'livre')),
    // Quem já usa IA pra código costuma preferir menos interrupção; o resto começa no equilibrado.
    { padrao: salvo.autonomia && !(menor && salvo.autonomia === 'livre') ? salvo.autonomia : ia === 'code' && !menor ? 'confiante' : 'equilibrado' },
  );

  const pacotes = await ui.escolherVarios(
    ctx.app ? 'Com o que você mais vai usar o Claude?' : 'Com o que você mais vai usar o Claude? (marca com espaço, confirma com Enter)',
    Object.entries(PACOTES).filter(([, x]) => !x.soPerfil || x.soPerfil === p.id).map(([value, x]) => ({ value, label: x.nome, hint: x.hint })),
    { padrao: salvo.perfil === p.id && salvo.pacotes ? salvo.pacotes : p.pacotes, explicacao: 'Cada pacote ensina o Claude a fazer um tipo de trabalho do seu jeito. Pode marcar vários; já deixei marcados os que combinam com você.' },
  );

  const cat = catalogo(ctx);
  const mcps = await ui.escolherVarios(
    'Quais dessas ferramentas você já usa?',
    cat.filter((m) => !m.pacotes || m.pacotes.some((x) => pacotes.includes(x))).map((m) => ({ value: m.id, label: m.nome, hint: m.hint })),
    { padrao: salvo.mcps || [], explicacao: 'O Claude passa a conseguir ler e mexer nelas pra você. Marca só as que você usa; se não usar nenhuma, é só continuar.' },
  );

  let modulos = MODULOS.filter((m) => m.padrao && doSistema(m) && !p.semModulos.includes(m.id)).map((m) => m.id);
  const avancado = await ui.confirmar('Quer escolher o que entra na instalação?', false, { sim: 'Sim, quero escolher', nao: 'Não, pode instalar tudo' });
  if (avancado) {
    modulos = await ui.escolherVarios(
      'O que você quer instalar?',
      MODULOS.filter((m) => !m.obrigatorio && doSistema(m)).map((m) => ({ value: m.id, label: m.nome, hint: m.descricao })),
      { padrao: modulos.filter((id) => !MODULOS.find((m) => m.id === id)?.obrigatorio) },
    );
    modulos = [...MODULOS.filter((m) => m.obrigatorio).map((m) => m.id), ...modulos];
  }

  ctx.resp = { nome, perfil: p.id, idade, tecnologia, ia, trabalho, autonomia, modulos, pacotes, mcps };
  ctx.estado.respostas = ctx.resp;
  ctx.salvarEstado();

  ui.linha();
  ui.ok(`Pronto, ${c.bold(nome)}. Agora é comigo. Vai aparecendo na tela o que estou fazendo.`);
  if (tecnologia === 'pouco') {
    ui.info(ctx.app
      ? 'Quando eu precisar de você, aparece um cartão amarelo com a mão ✋ dizendo exatamente o que fazer. No resto do tempo, é só esperar.'
      : 'Vai aparecer bastante coisa escrita na tela, muitas vezes em inglês. É normal e não precisa ler.\nQuando eu precisar de você, aparece uma caixa amarela com a mão ✋ dizendo exatamente o que fazer.');
  }
  return ctx.resp;
}
