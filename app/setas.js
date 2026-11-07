// Setas por cima da tela: uma janela transparente, que não recebe cliques, aponta onde a pessoa tem que olhar.
// A posição das janelas dos outros programas vem do próprio sistema e não exige nenhuma permissão da pessoa.
import { execFile } from 'node:child_process';
import path from 'node:path';

const LISTAR = 'ObjC.import("CoreGraphics");ObjC.import("Foundation");const l=ObjC.deepUnwrap(ObjC.castRefToObject($.CGWindowListCopyWindowInfo(1|16,0)));JSON.stringify(l.filter(w=>w.kCGWindowLayer==0&&w.kCGWindowBounds.Width>80).map(w=>({d:w.kCGWindowOwnerName,p:w.kCGWindowOwnerPID,b:w.kCGWindowBounds})))';

function listarJanelas() {
  return new Promise((res) => {
    if (process.platform !== 'darwin') return res([]); // no Windows entra na etapa do app de Windows
    execFile('/usr/bin/osascript', ['-l', 'JavaScript', '-e', LISTAR], { timeout: 4000 }, (erro, saida) => {
      try { res(erro ? [] : JSON.parse(saida)); } catch { res([]); }
    });
  });
}
const pidDe = (padrao) => new Promise((res) => execFile('/usr/bin/pgrep', ['-f', padrao], { timeout: 3000 }, (erro, saida) => res(erro ? [] : saida.split('\n').filter(Boolean).map(Number))));
const dentro = (b, x, y) => x >= b.X && x <= b.X + b.Width && y >= b.Y && y <= b.Y + b.Height;

export function criarSetas({ BrowserWindow, screen, aqui, t, janelaGuia, moverGuia, aoSerCoberto }) {
  let vidro = null;
  let pronto = false;
  let alvos = [];
  let vigia = null;
  let ultimo = '';

  function criar() {
    if (vidro && !vidro.isDestroyed()) return vidro;
    const area = screen.getPrimaryDisplay().bounds;
    vidro = new BrowserWindow({
      ...area, frame: false, transparent: true, hasShadow: false, resizable: false, movable: false, focusable: false, skipTaskbar: true, show: false, enableLargerThanScreen: true,
      ...(process.platform === 'darwin' ? { type: 'panel' } : {}),
      webPreferences: { preload: path.join(aqui, 'preload.cjs'), contextIsolation: true, sandbox: true, backgroundThrottling: false },
    });
    vidro.setIgnoreMouseEvents(true);
    vidro.setAlwaysOnTop(true, 'floating');
    vidro.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true, skipTransformProcessType: true });
    pronto = false;
    vidro.loadFile(path.join(aqui, 'tela', 'setas.html'));
    vidro.webContents.once('did-finish-load', () => { pronto = true; ultimo = ''; atualizar(); });
    vidro.on('closed', () => { vidro = null; });
    return vidro;
  }

  function dock(display) {
    const { bounds: b, workArea: w } = display;
    if (w.y + w.height < b.y + b.height - 4) return { x: b.x + b.width / 2, y: b.y + b.height - 6 };
    if (w.x > b.x + 4) return { x: b.x + 6, y: b.y + b.height / 2 };
    if (w.x + w.width < b.x + b.width - 4) return { x: b.x + b.width - 6, y: b.y + b.height / 2 };
    return { x: b.x + b.width / 2, y: b.y + b.height - 6 };
  }

  // Onde cada alvo está agora. Janela que não abriu ou que está atrás de outra manda a pessoa pro Dock.
  async function resolver() {
    const janelas = await listarJanelas();
    const fora = janelas.filter((j) => j.p !== process.pid);
    const saida = [];
    let cobriu = false;
    for (const a of alvos) {
      const pids = a.pgrep ? await pidDe(a.pgrep) : [];
      const eDele = (j) => pids.includes(j.p) || (a.dono && a.dono.test(j.d));
      const j = fora.find(eDele);
      if (!j) { saida.push({ ...dock(screen.getPrimaryDisplay()), rotulo: t('Não achou a janela? Procura o ícone aqui embaixo'), dock: true }); continue; }
      const x = j.b.X + j.b.Width * (a.x ?? 0.5);
      const y = j.b.Y + j.b.Height * (a.y ?? 0.5);
      const atras = fora.slice(0, fora.indexOf(j)).some((o) => !eDele(o) && dentro(o.b, x, y));
      if (atras) { saida.push({ ...dock(screen.getDisplayNearestPoint({ x, y })), rotulo: t('Essa janela está atrás das outras. Clica no ícone dela aqui embaixo'), dock: true }); continue; }
      // A nossa própria janela não pode ficar na frente do que a pessoa tem que clicar.
      if (janelas.some((o) => o.p === process.pid && dentro(o.b, x, y))) cobriu = true;
      saida.push({ x, y, rotulo: a.rotulo });
    }
    return { saida, cobriu };
  }

  async function atualizar() {
    if (!alvos.length) return;
    const { saida, cobriu } = await resolver();
    if (!alvos.length || !saida.length) return;
    if (cobriu) aoSerCoberto();
    const display = screen.getDisplayNearestPoint({ x: saida[0].x, y: saida[0].y });
    const b = display.bounds;
    criar();
    if (!pronto) return;
    // O guia não pode ficar em cima do alvo: troca de canto.
    let g = janelaGuia()?.getBounds();
    if (g && saida.some((s) => !s.dock && s.x > g.x - 30 && s.x < g.x + g.width + 30 && s.y > g.y - 30 && s.y < g.y + g.height + 30)) { moverGuia(); g = janelaGuia()?.getBounds(); }
    const de = g && g.x >= b.x && g.x < b.x + b.width ? { x: g.x + (g.x > b.x + b.width / 2 ? 0 : g.width), y: g.y + Math.min(g.height, 200) / 2 } : { x: b.x + b.width / 2, y: b.y + 30 };
    const pacote = { setas: saida.map((s) => ({ x: s.x - b.x, y: s.y - b.y, rotulo: s.rotulo, dock: !!s.dock, de: { x: de.x - b.x, y: de.y - b.y } })) };
    const chave = JSON.stringify(pacote);
    if (chave !== ultimo) {
      ultimo = chave;
      vidro.setBounds(b);
      vidro.webContents.send('setas', pacote);
    }
    if (!vidro.isVisible()) vidro.showInactive();
  }

  return {
    mostrar(novos) {
      alvos = novos || [];
      clearInterval(vigia);
      if (!alvos.length) { if (vidro && !vidro.isDestroyed()) vidro.hide(); return; }
      ultimo = '';
      atualizar();
      vigia = setInterval(atualizar, 1200);
    },
    esconder() {
      alvos = [];
      clearInterval(vigia);
      if (vidro && !vidro.isDestroyed()) vidro.hide();
    },
    vidro: () => vidro,
  };
}
