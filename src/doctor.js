// doctor: confere cada módulo instalado e mostra uma lista verde/vermelha com dica do que fazer.
import { ui, c } from './ui.js';
import { modulosInstalados } from './modulos/index.js';
import { cuidados } from './cuidados.js';
import { t, traduzir } from './i18n.js';

// A conferência de um módulo. Conferência que quebra conta como item faltando, com o erro na dica.
export async function conferir(ctx, m) {
  try {
    return await m.verificar(ctx);
  } catch (e) {
    return [{ item: m.nome, ok: false, dica: e.message }];
  }
}

// Mostra um grupo de itens (um módulo, ou os cuidados) e devolve quantos estão faltando.
export function mostrarItens(ctx, id, nome, itens, origem = 'doctor') {
  if (!itens.length) return 0;
  console.log(`\n  ${c.bold(traduzir(nome))}`);
  for (const i of itens) {
    ctx.log(origem, i.ok ? '✓' : '✗', id, i.item);
    console.log(`    ${i.ok ? c.green('✓') : c.red('✗')} ${traduzir(i.item)}${!i.ok && i.dica ? c.dim(`  → ${traduzir(i.dica)}`) : ''}`);
  }
  return itens.filter((i) => !i.ok).length;
}

export async function doctor(ctx) {
  ui.abertura('Claude Setuper · doctor', 'Conferindo se está tudo no lugar');
  let faltando = 0;
  for (const m of modulosInstalados(ctx)) faltando += mostrarItens(ctx, m.id, m.nome, await conferir(ctx, m));
  // O que já existia no computador e atrapalha (chave da API solta, outra memória disputando com o cérebro).
  faltando += mostrarItens(ctx, 'cuidados', t('Cuidados'), cuidados(ctx));
  console.log();
  if (!faltando) ui.encerramento(c.green(t('Tudo certo. Pode usar.')));
  else ui.encerramento(t(faltando === 1 ? '{n} item precisa de atenção. Rode {cmd} que eu tento resolver, ou siga a dica ao lado de cada um.' : '{n} itens precisam de atenção. Rode {cmd} que eu tento resolver, ou siga a dica ao lado de cada um.', { n: faltando, cmd: c.bold('claude-setuper verificar') }));
  return faltando;
}
