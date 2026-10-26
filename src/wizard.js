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

  // Voltando pra terminar o que faltou: não refaz as perguntas, a não ser que a pessoa queira.
  if (salvo.nome && salvo.perfil && salvo.modulos?.length) {
    const mesmas = await ui.confirmar(`Que bom te ver de novo, ${salvo.nome}. Posso usar as mesmas respostas da outra vez?`, true, {
      sim: 'Pode, usa as mesmas', nao: 'Quero responder de novo',
      explicacao: 'Assim eu vou direto ao que ficou faltando, sem repetir o que já está pronto.',
    });
    if (mesmas) {
      ctx.resp = { ...salvo };
      ctx.reaproveitou = true;
      return ctx.resp;
    }
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
    explicacao: 'Uso só pra ajustar o jeito do Claude falar com você. Fica guardado só no seu computador.',
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
    explicacao: 'Ajuda o Claude a entender o seu dia a dia. Se preferir, pode deixar em branco.',
  });

  // "Nunca pede licença" não aparece pra menor de idade nem pra quem ainda está começando com tecnologia ou IA.
  const semLivre = Number(idade) < 18 || tecnologia === 'pouco' || ia === 'nunca';
  const autonomia = await ui.escolher(
    'Como você prefere que o Claude trabalhe?',
    AUTONOMIAS.filter((a) => !(semLivre && a.value === 'livre')),
    // Quem já usa IA pra código costuma preferir menos interrupção; o resto começa no equilibrado.
    { padrao: salvo.autonomia && !(semLivre && salvo.autonomia === 'livre') ? salvo.autonomia : ia === 'code' && !semLivre ? 'confiante' : 'equilibrado',
      explicacao: 'Dá pra mudar depois. Em qualquer opção, o Claude nunca apaga pastas inteiras nem mexe nas suas senhas.' },
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
  // A resposta recomendada fica no "Sim": com ela no "Não", a pessoa lia "não" e achava que estava recusando a instalação.
  const tudo = await ui.confirmar('Posso instalar tudo o que faz sentido pro seu perfil?', true, {
    sim: 'Sim, pode instalar tudo (recomendado)', nao: 'Quero escolher o que vai ser instalado',
    explicacao: ctx.plataforma === 'darwin'
      ? 'Vou instalar o Claude, o Obsidian (onde ficam as suas notas), o Maestri (a janela onde você conversa com o Claude) e o Google Chrome, se ainda não tiver. Também deixo agendados um backup das notas e uma atualização por semana, e passo os seus prints de tela pra pasta Imagens > Prints, pro Claude conseguir ler. Nada que você já tem é apagado.'
      : 'Vou instalar o Claude, o Obsidian (onde ficam as suas notas) e o Google Chrome, se ainda não tiver, e deixo um atalho do Claude na Área de Trabalho. Também deixo agendados um backup das notas e uma atualização por semana. Nada que você já tem é apagado.',
  });
  const avancado = !tudo;
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
