// Roda o app/main.js de verdade com um Electron de mentira e o process.platform trocado, sem abrir janela nenhuma.
// Pega erro de código nos ramos do Windows, que neste Mac nunca executariam. Não diz nada sobre como o Windows se comporta.
//   node test/win-sim/rodar-main.mjs <win32|darwin> <casa de teste>
// Em darwin só sobe e manda a primeira tela: instalar de verdade mexeria no perfil do shell deste Mac.
import { registerHooks } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const [plataforma, casa] = process.argv.slice(2);
const registro = { janelas: [], abertos: [], externos: [], eventos: [], guia: [], erros: [] };
process.on('unhandledRejection', (e) => registro.erros.push(String(e?.stack || e)));
process.on('uncaughtException', (e) => registro.erros.push(String(e?.stack || e)));

const handlers = new Map();
function emitir(canal, ...args) { for (const fn of handlers.get(canal) || []) fn({}, ...args); }
class JanelaFalsa {
  constructor(opcoes) { this.opcoes = opcoes; this.visivel = false; this.destruida = false; registro.janelas.push(opcoes);
    this.webContents = { send: (canal, ev) => this.receber(canal, ev), on() {}, once(_n, fn) { setTimeout(fn, 0); }, setWindowOpenHandler() {}, invalidate() {}, capturePage: async () => ({ toPNG: () => Buffer.alloc(0) }) }; }
  receber(canal, ev) {
    if (canal === 'guia') { if (ev.cena) registro.guia.push(ev.cena); return; }
    if (canal !== 'ui') return;
    registro.eventos.push(ev.tipo);
    if (ev.tipo === 'inicio') registro.inicio = { plataforma: ev.plataforma, idioma: ev.idioma };
    if (ev.tipo === 'pedido') {
      const p = ev.pergunta;
      const valor = /chame|call you/i.test(p.msg) ? 'Zé' : /anos|how old/i.test(p.msg) ? '40' : p.padrao ?? '';
      setTimeout(() => emitir('resposta', { id: ev.id, valor }), 0);
    }
    if (ev.tipo === 'falha') registro.falha = ev.texto;
    if (ev.tipo === 'fim') registro.fim = ev;
  }
  on() {} once(n, fn) { if (n === 'ready-to-show') setTimeout(fn, 0); }
  loadFile(a) { this.arquivo = a; if (a.endsWith('guia.html')) setTimeout(() => emitir('guia-pronto'), 0); }
  show() { this.visivel = true; } showInactive() { this.visivel = true; } hide() { this.visivel = false; } minimize() {} restore() {} focus() {} close() { this.destruida = true; }
  isVisible() { return this.visivel; } isDestroyed() { return this.destruida; } isMinimized() { return false; }
  setAlwaysOnTop() {} setVisibleOnAllWorkspaces() {} setIgnoreMouseEvents() {} setOpacity() {} setSize() {} setBounds() {} setPosition() {}
  getBounds() { return { x: 900, y: 24, width: 340, height: 420 }; }
}
const area = { x: 0, y: 0, width: 1280, height: 720 };
const tela = { bounds: area, workArea: { ...area, height: 680 } };
globalThis.__electron_falso = {
  app: {
    getLocale: () => 'pt-BR', getPath: () => path.join(casa, 'MesaDoWindows'), setPath() {}, setName() {}, isPackaged: false, quit() { registro.saiu = true; },
    commandLine: { appendSwitch() {} }, requestSingleInstanceLock: () => true, on() {}, whenReady: () => Promise.resolve(),
    getApplicationInfoForProtocol: async () => ({ name: 'Google Chrome', path: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', icon: { toDataURL: () => 'data:image/png;base64,AA' } }),
    getFileIcon: async () => { throw new Error('nada de getFileIcon sem arquivo'); },
  },
  BrowserWindow: JanelaFalsa,
  ipcMain: { on: (c, fn) => { handlers.set(c, [...(handlers.get(c) || []), fn]); }, handle: (c, fn) => { handlers.set(c, [fn]); } },
  shell: { openPath: async (p) => { registro.abertos.push(p); return ''; }, openExternal: async (u) => { registro.externos.push(u); }, beep() {} },
  clipboard: { writeText() {} }, dialog: { showMessageBoxSync: () => 0 }, nativeTheme: {},
  nativeImage: { createFromPath: () => ({ resize: () => ({ toDataURL: () => 'data:image/png;base64,PROPRIO' }) }) },
  Menu: { buildFromTemplate: (t) => t, setApplicationMenu() {} },
  screen: { getPrimaryDisplay: () => tela, getDisplayNearestPoint: () => tela, screenToDipRect: (_j, r) => r },
};
const NOMES = Object.keys(globalThis.__electron_falso);
registerHooks({
  resolve(spec, ctx, proximo) { return spec === 'electron' ? { url: 'data:text/javascript,' + encodeURIComponent(NOMES.map((n) => `export const ${n} = globalThis.__electron_falso.${n};`).join('\n')), shortCircuit: true } : proximo(spec, ctx); },
});

// Nada de rede: a procura por versão nova e a atualização dão "não achei", e aí o app abre a página de downloads.
globalThis.fetch = async () => ({ ok: false, status: 404, json: async () => ({ version: '0.0.0' }) });
Object.defineProperty(process, 'platform', { value: plataforma });
process.env.PATH = plataforma === 'win32' ? 'C:\\Windows\\system32' : process.env.PATH;
process.argv.push('--home', casa, '--sem-apps', '--perfil', 'dia-a-dia');
await import(pathToFileURL(path.join(AQUI, '..', '..', 'app', 'main.js')).href);
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const ate = async (cond, ms = 40000) => { const fim = Date.now() + ms; while (!cond() && Date.now() < fim) await espera(50); return cond(); };

await ate(() => handlers.has('pronto') && registro.janelas.length);
emitir('pronto');
await ate(() => registro.inicio);
if (plataforma === 'win32') {
  registro.path = process.env.PATH;
  emitir('iniciar', 'instalar');
  await ate(() => registro.fim || registro.falha);
  emitir('abrir-claude');
  await espera(200);
  emitir('concluir');
  await ate(() => registro.guia.some((c) => c.aula));
  await espera(300);
  emitir('abrir-link', 'obsidian://open', 'obsidian');
  emitir('atualizar');
  await espera(300);
}
process.stdout.write(`\n@@${JSON.stringify(registro)}\n`);
process.exit(0);
