// Maestri: o canvas onde a pessoa vai conversar com o Claude. É a última etapa e o momento de prova.
// Semeia ~/.maestri com um workspace já montado: terminal do Claude + notas explicativas ao lado.
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { ui } from '../ui.js';

export const id = 'maestri';
export const nome = 'Maestri (o seu painel com o Claude)';
export const descricao = 'Instala o Maestri e deixa o Claude aberto com notas e lembretes do lado';
export const padrao = true;
export const plataformas = ['darwin'];

const NOTAS = [
  { arquivo: 'comece-aqui.md', tpl: 'maestri/comece-aqui.md', cor: 'yellow', tam: [360, 300] },
  { arquivo: 'o-que-pedir.md', tpl: 'maestri/o-que-pedir.md', cor: 'green', tam: [360, 300] },
  { arquivo: 'lembretes.md', tpl: 'maestri/lembretes.md', cor: 'blue', tam: [360, 300] },
  { arquivo: 'se-algo-der-errado.md', tpl: 'maestri/se-algo-der-errado.md', cor: 'pink', tam: [360, 260] },
];

export async function verificar(ctx) {
  const m = ctx.lerJson(path.join(ctx.home, '.maestri', 'manifest.json'), null);
  return [
    { item: 'Maestri instalado', ok: ctx.existe('/Applications/Maestri.app') || ctx.existe('/Applications/Setapp/Maestri.app') },
    { item: 'Workspace "Meu Claude" montado', ok: !!m?.workspaces?.some((w) => w.name === 'Meu Claude') },
  ];
}

export async function instalar(ctx) {
  const instalado = ctx.existe('/Applications/Maestri.app') || ctx.existe('/Applications/Setapp/Maestri.app');
  if (instalado) ui.ok('Maestri já está instalado');
  else if (!ctx.semApps) {
    await ui.tarefa('Instalando o Maestri, o seu painel com o Claude', 'Maestri instalado', () => ctx.run('brew', ['install', '--cask', 'maestri']), { demora: 'uns 2 minutos, é normal' });
  }

  await ui.tarefa('Preparando o painel com o Claude e as suas notas', 'Painel pronto', async () => {
    montarWorkspace(ctx);
  });

  if (ctx.semApps || ctx.dryRun) return;
  const rodando = await ctx.run('pgrep', ['-x', 'Maestri'], { ignorarErro: true, sempre: true });
  if (rodando) {
    await ctx.run('osascript', ['-e', 'tell application "Maestri" to quit'], { ignorarErro: true });
    await ctx.esperar(async () => !(await ctx.run('pgrep', ['-x', 'Maestri'], { ignorarErro: true, sempre: true })), { intervalo: 1, limite: 15 });
  }
  await ctx.run('open', ['-a', 'Maestri'], { ignorarErro: true });
  ui.ok('O Maestri está abrindo. O Claude vai se apresentar sozinho na janela da esquerda.');
}

export function montarWorkspace(ctx) {
  const raiz = path.join(ctx.home, '.maestri');
  const manifest = ctx.lerJson(path.join(raiz, 'manifest.json'), {
    app: 'Maestro', appVersion: '0.51.0', dataFormat: 'json', schemaVersion: 1,
    files: { appState: 'app-state.json', preferences: 'preferences.json', sidebarLayout: 'sidebar-layout.json' },
    workspaces: [],
  });
  manifest.workspaces = manifest.workspaces || [];
  let ws = manifest.workspaces.find((w) => w.name === 'Meu Claude');
  const wid = ws?.id || crypto.randomUUID().toUpperCase();
  if (!ws) manifest.workspaces.push({ id: wid, name: 'Meu Claude', path: `workspaces/${wid}/workspace.json` });

  const dir = path.join(raiz, 'workspaces', wid);
  for (const sub of ['files', 'notes', 'snapshots', 'terminals']) fs.mkdirSync(path.join(dir, sub), { recursive: true });

  // Script que abre o Claude e, só na primeira vez, manda a apresentação.
  const abrir = path.join(ctx.pastaSetuper, 'abrir-claude.sh');
  ctx.escrever(abrir, ctx.template('maestri/abrir-claude.sh', { marcador: path.join(ctx.claudeDir, '.setuper-saudou'), nome: ctx.seguro(ctx.resp.nome, 'eu'), trabalho: ctx.seguro(ctx.resp.trabalho, 'o meu trabalho do dia a dia') }));
  if (!ctx.dryRun) fs.chmodSync(abrir, 0o755);

  const agora = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const X = 10000, Y = 8000;
  const termId = crypto.randomUUID().toUpperCase();
  const nodes = [
    {
      content: { terminal: { _0: {
        activeChatThread: 0, agentType: 'claude_code', autoScrollLocked: false, chatThreads: [termId],
        codexDaemonMigration: 'untouched', color: '#007AFF', command: `/bin/bash "${abrir}"`, icon: 'seal', id: termId,
        isManager: true, isUnloaded: false, lastActiveAt: agora, monitorWithOmbro: true, name: 'Claude',
        prefersChatMode: false, scrollbackFile: `${termId}.scrollback`, scrollbackLineCount: 0, shellPath: '/bin/zsh',
        shortcutMode: { kind: 'automatic' }, showsShellWindowDuringTurns: true, startInChatMode: false, status: 'stopped',
        workingDirectory: ctx.resp.pastaTrabalho || ctx.home,
      } } },
      createdAt: agora, frame: [[X, Y], [1100, 820]], id: crypto.randomUUID().toUpperCase(), isLocked: false, isRedacted: false, lastModifiedAt: agora, zIndex: 10,
    },
  ];

  let ny = Y;
  const colunas = [[X + 1150, Y], [X + 1150 + 380, Y], [X + 1150, Y + 330], [X + 1150 + 380, Y + 330]];
  NOTAS.forEach((n, i) => {
    ctx.escreverSeFaltar(path.join(dir, 'notes', n.arquivo), ctx.template(n.tpl));
    nodes.push({
      content: { stickyNote: { _0: { color: n.cor, fileName: n.arquivo, fontSize: 14, hasCustomName: false, isContentLocked: false, isPreviewing: true, storageMode: { managed: {} }, textModifiedAt: agora } } },
      createdAt: agora, frame: [colunas[i], n.tam], id: crypto.randomUUID().toUpperCase(), isLocked: false, isRedacted: false, lastModifiedAt: agora, zIndex: 20 + i,
    });
    ny += 330;
  });
  if (ctx.resp.vault) {
    nodes.push({
      content: { link: { _0: { title: 'Abrir o meu segundo cérebro (Obsidian)', url: `obsidian://open?path=${encodeURIComponent(ctx.resp.vault)}` } } },
      createdAt: agora, frame: [[X, Y + 840], [420, 48]], id: crypto.randomUUID().toUpperCase(), isLocked: false, isRedacted: false, lastModifiedAt: agora, zIndex: 30,
    });
  }

  const wsPath = path.join(dir, 'workspace.json');
  const existente = ctx.lerJson(wsPath, null);
  if (!existente) {
    ctx.escrever(wsPath, {
      schemaVersion: 2, type: 'workspace',
      payload: {
        cableTies: [], canvasOrigin: [X - 120, Y - 120], canvasZoom: 0.62, color: '#C8873C', connections: [], createdAt: agora,
        crossFloorConnections: [], crossWorkspaceConnections: [], dockEdge: 'trailing', drawings: [], floors: [], groups: [],
        icon: 'brain', id: wid, isPinned: true, lastOpenedAt: agora, locationType: 'local', name: 'Meu Claude', nodes,
        noteConnections: [], noteToNoteConnections: [], portalConnections: [], portalToPortalConnections: [], syncConfigFiles: false,
        workingDirectory: ctx.resp.pastaTrabalho || ctx.home,
      },
    });
  }

  ctx.escrever(path.join(raiz, 'manifest.json'), manifest);
  const estado = ctx.lerJson(path.join(raiz, 'app-state.json'), { schemaVersion: 1, type: 'appState', payload: {} });
  estado.payload = { ...estado.payload, activeWorkspaceId: wid, hasCompletedOnboarding: true, hasSeenFloorOnboarding: true, recentWorkspaceIds: [wid, ...(estado.payload.recentWorkspaceIds || []).filter((x) => x !== wid)] };
  ctx.escrever(path.join(raiz, 'app-state.json'), estado);
  return wid;
}
