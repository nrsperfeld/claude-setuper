// doctor: confere cada módulo instalado e mostra uma lista verde/vermelha com dica do que fazer.
import { ui, c } from './ui.js';
import { MODULOS, modulosParaPlataforma } from './modulos/index.js';

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
    console.log(`\n  ${c.bold(m.nome)}`);
    for (const i of itens) {
      if (!i.ok) faltando++;
      ctx.log('doctor', i.ok ? '✓' : '✗', m.id, i.item);
      console.log(`    ${i.ok ? c.green('✓') : c.red('✗')} ${i.item}${!i.ok && i.dica ? c.dim(`  → ${i.dica}`) : ''}`);
    }
  }
  console.log();
  if (!faltando) ui.encerramento(c.green('Tudo certo. Pode usar.'));
  else ui.encerramento(`${faltando} ${faltando === 1 ? 'item precisa' : 'itens precisam'} de atenção. Rode ${c.bold('claude-setuper')} de novo que eu tento resolver, ou siga a dica ao lado de cada um.`);
  return faltando;
}
