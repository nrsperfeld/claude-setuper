// doctor: confere cada módulo instalado e mostra uma lista verde/vermelha com dica do que fazer.
import { ui, c } from './ui.js';
import { MODULOS, modulosParaPlataforma } from './modulos/index.js';
import { cuidados } from './cuidados.js';
import { t, traduzir } from './i18n.js';

export async function doctor(ctx) {
  ui.abertura('Claude Setuper · doctor', 'Conferindo se está tudo no lugar');
  const ids = Object.keys(ctx.estado.modulos || {});
  const lista = modulosParaPlataforma(ids.length ? ids : MODULOS.filter((m) => m.padrao).map((m) => m.id), ctx.plataforma);
  let faltando = 0;
  for (const m of lista) {
    let itens = [];
    try {
      itens = await m.verificar(ctx);
    } catch (e) {
      itens = [{ item: m.nome, ok: false, dica: e.message }];
    }
    if (!itens.length) continue;
    console.log(`\n  ${c.bold(traduzir(m.nome))}`);
    for (const i of itens) {
      if (!i.ok) faltando++;
      ctx.log('doctor', i.ok ? '✓' : '✗', m.id, i.item);
      console.log(`    ${i.ok ? c.green('✓') : c.red('✗')} ${traduzir(i.item)}${!i.ok && i.dica ? c.dim(`  → ${traduzir(i.dica)}`) : ''}`);
    }
  }
  // O que já existia no computador e atrapalha (chave da API solta, outra memória disputando com o cérebro).
  const extras = cuidados(ctx);
  console.log(`\n  ${c.bold(t('Cuidados'))}`);
  for (const i of extras) {
    if (!i.ok) faltando++;
    ctx.log('doctor', i.ok ? '✓' : '✗', 'cuidados', i.item);
    console.log(`    ${i.ok ? c.green('✓') : c.red('✗')} ${traduzir(i.item)}${!i.ok && i.dica ? c.dim(`  → ${traduzir(i.dica)}`) : ''}`);
  }
  console.log();
  if (!faltando) ui.encerramento(c.green(t('Tudo certo. Pode usar.')));
  else ui.encerramento(t(faltando === 1 ? '{n} item precisa de atenção. Rode {cmd} de novo que eu tento resolver, ou siga a dica ao lado de cada um.' : '{n} itens precisam de atenção. Rode {cmd} de novo que eu tento resolver, ou siga a dica ao lado de cada um.', { n: faltando, cmd: c.bold('claude-setuper') }));
  return faltando;
}
