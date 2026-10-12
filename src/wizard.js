// O wizard: poucas perguntas, nenhuma técnica. O resto tem default.
import os from 'node:os';
import { ui, c } from './ui.js';
import { MODULOS } from './modulos/index.js';
import { PACOTES } from './modulos/pacotes.js';
import { catalogo } from './modulos/mcps.js';

export async function wizard(ctx) {
  const salvo = ctx.estado.respostas || {};
  if (ctx.sim) {
    const usuario = os.userInfo().username.replace(/[._-]/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
    ctx.resp = { nome: usuario, trabalho: '', autonomia: 'equilibrado', modulos: MODULOS.filter((m) => m.padrao).map((m) => m.id), pacotes: ['escrita', 'negocios', 'pesquisa'], mcps: [], ...salvo };
    return ctx.resp;
  }

  ui.info('Vou preparar o seu Claude. Leva uns 10 minutos.\nEu aviso toda vez que precisar de você, e espero o tempo que for.');
  ui.linha();

  const nome = await ui.perguntar('Como você quer que o Claude te chame?', {
    padrao: salvo.nome,
    placeholder: 'Seu primeiro nome ou apelido',
    validar: (v) => (!v && !salvo.nome ? 'Só o nome, pode ser o apelido.' : undefined),
  });

  const trabalho = await ui.perguntar('Com o que você trabalha? Conta em uma frase.', {
    padrao: salvo.trabalho,
    placeholder: 'Ex.: tenho uma clínica de estética e cuido do marketing e das vendas',
  });

  const autonomia = await ui.escolher(
    'Como você prefere que o Claude trabalhe?',
    [
      { value: 'cauteloso', label: 'Me pergunta antes de cada coisa', hint: 'mais seguro, mais perguntas' },
      { value: 'equilibrado', label: 'Faz o básico sozinho e me pergunta no que importa', hint: 'recomendado' },
      { value: 'confiante', label: 'Faz tudo e me avisa no fim', hint: 'mais rápido' },
    ],
    { padrao: salvo.autonomia || 'equilibrado' },
  );

  const pacotes = await ui.escolherVarios(
    'Com o que você mais vai usar o Claude? (marca com espaço, confirma com Enter)',
    Object.entries(PACOTES).map(([value, p]) => ({ value, label: p.nome, hint: p.hint })),
    { padrao: salvo.pacotes || ['escrita', 'negocios', 'pesquisa'] },
  );

  const cat = catalogo(ctx);
  const mcps = await ui.escolherVarios(
    'Quais dessas ferramentas você já usa? (o Claude passa a mexer nelas pra você)',
    cat.filter((m) => !m.pacotes || m.pacotes.some((p) => pacotes.includes(p))).map((m) => ({ value: m.id, label: m.nome, hint: m.hint })),
    { padrao: salvo.mcps || [] },
  );

  let modulos = MODULOS.filter((m) => m.padrao).map((m) => m.id);
  const avancado = await ui.confirmar('Quer escolher o que entra na instalação? (se não, eu instalo tudo)', false);
  if (avancado) {
    modulos = await ui.escolherVarios(
      'O que você quer instalar?',
      MODULOS.filter((m) => !m.obrigatorio).map((m) => ({ value: m.id, label: m.nome, hint: m.descricao })),
      { padrao: modulos.filter((id) => !MODULOS.find((m) => m.id === id)?.obrigatorio) },
    );
    modulos = [...MODULOS.filter((m) => m.obrigatorio).map((m) => m.id), ...modulos];
  }

  ctx.resp = { nome, trabalho, autonomia, modulos, pacotes, mcps };
  ctx.estado.respostas = ctx.resp;
  ctx.salvarEstado();

  ui.linha();
  ui.ok(`Pronto, ${c.bold(nome)}. Agora é comigo. Vai aparecendo na tela o que estou fazendo.`);
  return ctx.resp;
}
