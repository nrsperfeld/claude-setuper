// remover: desfaz o que o Setuper fez, perguntando antes de cada parte. Nunca apaga as notas da pessoa.
import path from 'node:path';
import fs from 'node:fs';
import { ui } from './ui.js';
import { MODULOS } from './modulos/index.js';
import { dirConfigObsidian } from './modulos/obsidian.js';

export async function remover(ctx) {
  ui.abertura('Claude Setuper · remover', 'Vou perguntar antes de cada parte. Suas notas nunca são apagadas.');
  const ids = Object.keys(ctx.estado.modulos || {});
  if (!ids.length) return ui.encerramento('Não encontrei nada instalado pelo Setuper nesta máquina.');

  for (const id of ids) {
    const m = MODULOS.find((x) => x.id === id);
    if (!m) continue;
    const quer = ctx.sim ? true : await ui.confirmar(`Remover "${m.nome}"?`, false);
    if (!quer) continue;
    try {
      if (m.remover) await m.remover(ctx);
      if (id === 'nucleo') removerHooksDoSettings(ctx);
      if (id === 'obsidian') desregistrarVault(ctx);
      if (id === 'maestri') removerWorkspace(ctx);
      delete ctx.estado.modulos[id];
      ctx.salvarEstado();
      ui.ok(`${m.nome} removido`);
    } catch (e) {
      ui.erro(`${m.nome}: ${e.message}`);
    }
  }
  ui.info('Os aplicativos (Obsidian, Maestri, Chrome, Claude Code) continuam instalados. Se quiser tirar, arraste pra Lixeira.');
  ui.encerramento('Pronto.');
}

function removerHooksDoSettings(ctx) {
  const p = path.join(ctx.claudeDir, 'settings.json');
  const s = ctx.lerJson(p, null);
  if (!s?.hooks) return;
  for (const ev of Object.keys(s.hooks)) {
    s.hooks[ev] = s.hooks[ev].filter((g) => !g.hooks?.some((h) => /cerebro-(inicio|fim|nota)\.c?js|Terminei, pode olhar/.test(h.command || '')));
    if (!s.hooks[ev].length) delete s.hooks[ev];
  }
  if (s.env) delete s.env.CLAUDE_SETUPER_VAULT;
  ctx.escrever(p, s);
}

function desregistrarVault(ctx) {
  const vault = ctx.estado.respostas?.vault;
  const cfg = path.join(dirConfigObsidian(ctx), 'obsidian.json');
  const d = ctx.lerJson(cfg, null);
  if (!d?.vaults || !vault) return;
  for (const k of Object.keys(d.vaults)) if (d.vaults[k].path.normalize('NFC') === vault.normalize('NFC')) delete d.vaults[k];
  ctx.escrever(cfg, JSON.stringify(d, null, 2));
  ui.info(`As notas continuam em ${vault}. Só tirei o cofre da lista do Obsidian.`);
}

function removerWorkspace(ctx) {
  const raiz = path.join(ctx.home, '.maestri');
  const m = ctx.lerJson(path.join(raiz, 'manifest.json'), null);
  if (!m?.workspaces) return;
  const ws = m.workspaces.find((w) => w.name === 'Meu Claude');
  if (!ws) return;
  m.workspaces = m.workspaces.filter((w) => w.id !== ws.id);
  ctx.escrever(path.join(raiz, 'manifest.json'), m);
  fs.rmSync(path.join(raiz, 'workspaces', ws.id), { recursive: true, force: true });
}
