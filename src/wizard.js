// O wizard: poucas perguntas, nenhuma técnica. O resto tem default.
// Ordem: nome, pra que vai usar (perfil), idade, familiaridade com tecnologia e com IA; daí em diante o perfil manda.
import os from 'node:os';
import path from 'node:path';
import { ui, c } from './ui.js';
import { t } from './i18n.js';
import { MODULOS, SEMPRE, comSempre } from './modulos/index.js';
import { PACOTES } from './modulos/pacotes.js';
import { catalogo } from './modulos/mcps.js';
import { perfis, perfil as acharPerfil, IA_ANTIGA, ehMenor } from './perfis.js';
import { respostasDoPresente } from './presente.js';

const AUTONOMIAS = [
  { value: 'cauteloso', label: 'Me pergunta antes de cada coisa', hint: 'mais seguro, mais perguntas' },
  { value: 'equilibrado', label: 'Faz o básico sozinho e me pergunta no que importa', hint: 'um meio-termo' },
  { value: 'confiante', label: 'Faz tudo e me avisa no fim', hint: 'mais rápido' },
  { value: 'livre', label: 'Nunca me pede licença pra nada', hint: 'recomendado: o mais rápido; só as travas de segurança continuam (apagar tudo, senhas)' },
];

export async function wizard(ctx) {
  const salvo = ctx.estado.respostas || {};
  const doSistema = (m) => !m.plataformas || m.plataformas.includes(ctx.plataforma);
  // Modo presente: o que já veio respondido no presente.json não é perguntado. Só sobra o que depende da pessoa.
  const pre = respostasDoPresente(ctx);
  const tem = (k) => pre[k] !== undefined;
  const vaultPresente = ctx.presente ? { vault: path.join(ctx.home, 'Documents', ctx.presente.vault) } : {};
  // GitHub e a IA no Chrome não são escolha: entram em qualquer perfil, presente ou lista marcada à mão.
  const fixo = (m) => m.obrigatorio || SEMPRE.includes(m.id);
  const modulosDoPerfil = (p) => MODULOS.filter((m) => doSistema(m) && (SEMPRE.includes(m.id) || (m.padrao && !p.semModulos.includes(m.id)))).map((m) => m.id);
  const modulosDoPresente = (p) => (pre.modulos === 'tudo' ? modulosDoPerfil(p)
    : comSempre([...MODULOS.filter((m) => m.obrigatorio).map((m) => m.id), ...pre.modulos]).filter((id) => MODULOS.some((m) => m.id === id && doSistema(m))));

  if (ctx.sim) {
    const usuario = os.userInfo().username.replace(/[._-]/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
    const p = acharPerfil(ctx, ctx.perfil || pre.perfil || salvo.perfil);
    const { modulos: _m, ...preSemModulos } = pre;
    ctx.resp = {
      nome: usuario, trabalho: '', idade: '', tecnologia: 'basico', ia: 'chat', autonomia: 'livre',
      modulos: modulosDoPerfil(p),
      pacotes: p.pacotes, mcps: [], ...vaultPresente, ...salvo, ...preSemModulos, perfil: p.id,
      ...(tem('modulos') ? { modulos: modulosDoPresente(p) } : {}),
    };
    ctx.resp.modulos = comSempre(ctx.resp.modulos);
    // Guardadas como as do caminho com perguntas: a conferência (claude-setuper verificar) instala com elas.
    ctx.estado.respostas = ctx.resp;
    ctx.salvarEstado();
    return ctx.resp;
  }

  // Voltando pra terminar o que faltou: não refaz as perguntas, a não ser que a pessoa queira.
  // No presente as respostas são as do presente.json, então nem pergunta.
  if (salvo.nome && salvo.perfil && salvo.modulos?.length) {
    const mesmas = ctx.repetirDireto || !!ctx.presente || await ui.confirmar(`Que bom te ver de novo, ${salvo.nome}. Posso usar as mesmas respostas da outra vez?`, true, {
      sim: 'Pode, usa as mesmas', nao: 'Quero responder de novo',
      explicacao: 'Assim eu vou direto ao que ficou faltando, sem repetir o que já está pronto.',
    });
    if (mesmas) {
      // Respostas de uma versão anterior podem não ter o GitHub e o Chrome: agora eles entram sempre.
      ctx.resp = { ...vaultPresente, ...salvo, modulos: comSempre(salvo.modulos) };
      ctx.reaproveitou = true;
      return ctx.resp;
    }
  }

  // No app, a tela de boas-vindas já disse isso.
  if (!ctx.app) {
    ui.info('Vou preparar a sua IA. Leva uns 20 minutos.\nEu aviso toda vez que precisar de você, e espero o tempo que for.');
    ui.info('O que muda em relação ao chat: a IA vai trabalhar direto no seu computador, lembrar de você pelo segundo cérebro\n(o que você decidiu, como gosta das coisas, onde cada projeto parou) e já vir com comandos e rotinas prontos.\nÉ assim que trabalha o 1% que mais tira proveito do Claude.');
    ui.linha();
  }

  const nome = tem('nome') ? pre.nome : await ui.perguntar('Como você quer que a IA te chame?', {
    padrao: salvo.nome,
    placeholder: 'Seu primeiro nome ou apelido',
    validar: (v) => (!v && !salvo.nome ? t('Só o nome, pode ser o apelido.') : undefined),
  });

  // --perfil no comando já responde essa (útil pra mandar o link pra uma turma inteira).
  const idPerfil = ctx.perfil || pre.perfil || await ui.escolher(
    t('Pra que você vai usar a IA, {nome}?', { nome }),
    // O perfil da equipe da ELOS só entra pelo link direto (--perfil elos); quem já está nele continua vendo.
    perfis(ctx).filter((p) => p.id !== 'elos' || salvo.perfil === 'elos').map((p) => ({ value: p.id, label: p.nome, hint: p.hint })),
    { padrao: salvo.perfil || 'dia-a-dia', explicacao: 'Com isso eu já deixo pronto o que faz sentido pra você. Dá pra mudar depois.' },
  );
  const p = acharPerfil(ctx, idPerfil);

  // A idade serve pra proteger menor de idade, então só é perguntada a quem vai usar pra estudar.
  // No presente sem idade, ela também não é perguntada: fica em branco e a pessoa é tratada como adulta.
  const idade = tem('idade') ? pre.idade : (ctx.presente || p.id !== 'estudante') ? (salvo.idade || '') : await ui.perguntar('Quantos anos você tem?', {
    padrao: salvo.idade,
    placeholder: 'Só o número',
    explicacao: 'Uso só pra ajustar o jeito da IA falar com você. Fica guardado só no seu computador.',
    validar: (v) => (!v && salvo.idade) || /^\d{1,3}$/.test(String(v || '').trim()) && +v >= 6 && +v <= 110 ? undefined : 'Só o número, por exemplo 34.',
  });

  const tecnologia = tem('tecnologia') ? pre.tecnologia : await ui.escolher('Como você se dá com tecnologia?', [
    { value: 'pouco', label: 'Me viro pouco, prefiro que me expliquem tudo' },
    { value: 'basico', label: 'Uso o básico sem problema' },
    { value: 'avancado', label: 'Sou bem à vontade com computador' },
  ], { padrao: salvo.tecnologia || 'basico' });

  const ia = tem('ia') ? pre.ia : await ui.escolher('E como você usa IA hoje?', [
    { value: 'nunca', label: 'Nunca usei, ou quase nunca', hint: 'é a primeira vez, e tudo bem' },
    { value: 'chat', label: 'Uso o chat', hint: 'ChatGPT, Claude, Gemini: pergunto e copio a resposta' },
    { value: 'code', label: 'Já uso IA pra programar', hint: 'Claude Code, Codex, Cursor, no terminal ou no editor' },
  ], { padrao: IA_ANTIGA[salvo.ia] || salvo.ia || 'chat', explicacao: 'Assim a IA sabe o quanto explicar antes de fazer. Qualquer resposta serve.' });

  const trabalho = tem('trabalho') ? pre.trabalho : await ui.perguntar(p.trabalho.pergunta, {
    padrao: salvo.perfil === p.id ? salvo.trabalho : undefined,
    placeholder: p.trabalho.placeholder,
    explicacao: 'Ajuda a IA a entender o seu dia a dia. Se preferir, pode deixar em branco.',
  });

  // "Nunca pede licença" não aparece pra menor de idade nem pra quem ainda está começando com tecnologia ou IA.
  const semLivre = ehMenor(idade) || tecnologia === 'pouco' || ia === 'nunca';
  // "Livre" que veio no presente pra quem não pode ter essa opção vira "confiante".
  const autonomia = tem('autonomia') ? (semLivre && pre.autonomia === 'livre' ? 'confiante' : pre.autonomia) : await ui.escolher(
    'Como você prefere que a IA trabalhe?',
    AUTONOMIAS.filter((a) => !(semLivre && a.value === 'livre')),
    // O padrão é não pedir licença; quem não pode ter essa opção começa no equilibrado.
    { padrao: salvo.autonomia && !(semLivre && salvo.autonomia === 'livre') ? salvo.autonomia : semLivre ? 'equilibrado' : 'livre',
      explicacao: 'Dá pra mudar depois. Em qualquer opção ficam travados o comando mais comum de apagar pastas inteiras e os arquivos onde ficam as senhas dos sistemas. Essas travas não seguram tudo, então guarde uma cópia do que for importante.' },
  );

  const pacotes = tem('pacotes') ? pre.pacotes.filter((id) => PACOTES[id] && (!PACOTES[id].soPerfil || PACOTES[id].soPerfil === p.id)) : await ui.escolherVarios(
    ctx.app ? 'Com o que você mais vai usar a IA?' : 'Com o que você mais vai usar a IA? (marca com espaço, confirma com Enter)',
    Object.entries(PACOTES).filter(([, x]) => !x.soPerfil || x.soPerfil === p.id).map(([value, x]) => ({ value, label: x.nome, hint: x.hint })),
    { padrao: salvo.perfil === p.id && salvo.pacotes ? salvo.pacotes : p.pacotes, explicacao: 'Cada pacote ensina a IA a fazer um tipo de trabalho do seu jeito. Pode marcar vários; já deixei marcados os que combinam com você.' },
  );

  const cat = catalogo(ctx);
  const mcps = tem('mcps') ? pre.mcps.filter((id) => cat.some((m) => m.id === id)) : await ui.escolherVarios(
    'Quais dessas ferramentas você já usa?',
    cat.filter((m) => !m.pacotes || m.pacotes.some((x) => pacotes.includes(x))).map((m) => ({ value: m.id, label: m.nome, hint: m.hint })),
    { padrao: salvo.mcps || [], explicacao: 'A IA passa a conseguir ler e mexer nelas pra você. Marca só as que você usa; se não usar nenhuma, é só continuar.' },
  );

  let modulos = tem('modulos') ? modulosDoPresente(p) : modulosDoPerfil(p);
  // A resposta recomendada fica no "Sim": com ela no "Não", a pessoa lia "não" e achava que estava recusando a instalação.
  const tudo = tem('modulos') || await ui.confirmar('Posso instalar tudo o que faz sentido pro seu perfil?', true, {
    sim: 'Sim, pode instalar tudo (recomendado)', nao: 'Quero escolher o que vai ser instalado',
    explicacao: ctx.app ? 'É a lista que eu te mostrei antes de começar. Se preferir, escolhe item por item.' : ctx.plataforma === 'darwin'
      ? 'Vou instalar a IA (ela se chama Claude), o Obsidian (onde ficam as suas notas), o Maestri (a janela onde você conversa com ela) e o Google Chrome, se ainda não tiver. Também ligo o GitHub, que guarda uma cópia do seu trabalho, e deixo agendados um backup das notas e uma atualização por semana, e passo os seus prints de tela pra pasta Imagens > Prints, pro Claude conseguir ler. Nada que você já tem é apagado.'
      : 'Vou instalar a IA (ela se chama Claude), o Obsidian (onde ficam as suas notas) e o Google Chrome, se ainda não tiver, e deixo um atalho dela na Área de Trabalho. Também ligo o GitHub, que guarda uma cópia do seu trabalho, e deixo agendados um backup das notas e uma atualização por semana. Nada que você já tem é apagado.',
  });
  const avancado = !tudo;
  if (avancado) {
    modulos = await ui.escolherVarios(
      'O que você quer instalar?',
      MODULOS.filter((m) => !fixo(m) && doSistema(m)).map((m) => ({ value: m.id, label: m.nome, hint: m.descricao })),
      { padrao: modulos.filter((id) => !fixo(MODULOS.find((m) => m.id === id) || {})), explicacao: 'A base, o GitHub e a IA no Chrome entram sempre. O resto é você quem escolhe.' },
    );
    modulos = comSempre([...MODULOS.filter((m) => m.obrigatorio).map((m) => m.id), ...modulos]);
  }

  ctx.resp = { nome, perfil: p.id, idade, tecnologia, ia, trabalho, autonomia, modulos, pacotes, mcps, ...vaultPresente };
  ctx.estado.respostas = ctx.resp;
  ctx.salvarEstado();

  ui.linha();
  ui.ok(`Pronto, ${c.bold(nome)}. Agora é comigo. Vai aparecendo na tela o que estou fazendo.`);
  if (tecnologia === 'pouco') {
    ui.info(ctx.app
      ? 'Quando eu precisar de você, aparece uma janelinha na frente de tudo dizendo exatamente o que fazer. No resto do tempo, é só esperar.'
      : 'Vai aparecer bastante coisa escrita na tela, muitas vezes em inglês. É normal e não precisa ler.\nQuando eu precisar de você, aparece uma caixa amarela com a mão ✋ dizendo exatamente o que fazer.');
  }
  return ctx.resp;
}
