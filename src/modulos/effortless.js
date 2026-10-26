// Effortless: plugin que escolhe sozinho o esforço do Claude a cada pedido (pouco pra coisa simples, muito pra coisa difícil).
import path from 'node:path';
import fs from 'node:fs';
import { ui } from '../ui.js';

export const id = 'effortless';
export const nome = 'Esforço automático (Effortless)';
export const nomeCurto = 'Ajuste automático';
export const descricao = 'O Claude escolhe sozinho quanto pensar em cada pedido';
export const padrao = true;

const MARKETPLACE = 'HeyCubit/effortless';
// Preferências validadas no Mac da Jackeline (24/10/2026): puxa um pouco pro lado de pensar mais e vale também pros ajudantes.
const ESCOLHAS = { effortBias: '1', helpers: 'on' };

async function instalado(ctx) {
  const out = await ctx.run('claude', ['plugin', 'list'], { ignorarErro: true, sempre: true, timeout: 60000 });
  return /effortless@effortless/.test(out);
}

export async function verificar(ctx) {
  if (!(await ctx.existeComando('claude'))) return [{ item: 'Effortless', ok: false, dica: 'instale o Claude Code primeiro' }];
  return [{ item: 'Effortless (esforço automático)', ok: await instalado(ctx), dica: 'rode: claude-setuper --modulos effortless' }];
}

export async function instalar(ctx) {
  if (ctx.semApps || ctx.dryRun) return;
  if (await instalado(ctx)) return ui.ok('O esforço automático já está ligado');
  await ui.tarefa('Ligando o esforço automático (Effortless)', 'Esforço automático ligado', async () => {
    const config = Object.entries(ESCOLHAS).flatMap(([k, v]) => ['--config', `${k}=${v}`]);
    await ctx.run('claude', ['plugin', 'install', 'effortless', '--marketplace', MARKETPLACE, '--scope', 'user', '-y', ...config], { timeout: 5 * 60 * 1000 });
    // Grava o padrão do próprio plugin nas outras opções, senão o Claude avisa que há opções sem configurar.
    const padroes = padroesDoPlugin(ctx);
    if (Object.keys(padroes).length) {
      await ctx.run('claude', ['plugin', 'configure', 'effortless@effortless', '--values-stdin'], { ignorarErro: true, input: JSON.stringify({ ...padroes, ...ESCOLHAS }) });
    }
  });
  ui.info('Se um dia o esforço parar de mudar sozinho (acontece quando você escolhe um esforço na mão), digite /effortless auto dentro do Claude.');
}

function padroesDoPlugin(ctx) {
  const base = path.join(ctx.homeReal, '.claude', 'plugins', 'cache', 'effortless', 'effortless');
  try {
    const versoes = fs.readdirSync(base).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    const manifesto = JSON.parse(fs.readFileSync(path.join(base, versoes.at(-1), '.claude-plugin', 'plugin.json'), 'utf8'));
    return Object.fromEntries(Object.entries(manifesto.userConfig || {}).filter(([, o]) => !o.sensitive && o.default !== undefined).map(([k, o]) => [k, String(o.default)]));
  } catch {
    return {};
  }
}

export async function remover(ctx) {
  await ctx.run('claude', ['plugin', 'uninstall', 'effortless@effortless'], { ignorarErro: true });
}
