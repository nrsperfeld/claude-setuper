// Setas por cima da tela: uma janela transparente, que não recebe cliques, aponta onde a pessoa tem que olhar.
// A posição das janelas dos outros programas vem do próprio sistema e não exige nenhuma permissão da pessoa.
//
// No Windows as setas ficam desligadas: o guia mostra o ícone e o texto, e não fala em setas. Ler as janelas lá também não
// pede permissão (EnumWindows), e o código está aqui embaixo, mas nunca rodou num Windows. Seta no lugar errado atrapalha
// mais que seta nenhuma. Pra testar num PC, abre o app com CLAUDE_SETUPER_SETAS_WIN=1 (roteiro em docs/windows-estado.md).
import { execFile, spawn } from 'node:child_process';
import path from 'node:path';

const LISTAR = 'ObjC.import("CoreGraphics");ObjC.import("Foundation");const l=ObjC.deepUnwrap(ObjC.castRefToObject($.CGWindowListCopyWindowInfo(1|16,0)));JSON.stringify(l.filter(w=>w.kCGWindowLayer==0&&w.kCGWindowBounds.Width>80).map(w=>({d:w.kCGWindowOwnerName,p:w.kCGWindowOwnerPID,b:w.kCGWindowBounds})))';

// Um PowerShell fica aberto, sem janela, e responde uma linha por pedido: compilar o C# a cada 1,2 s pesaria no computador.
// Devolve as janelas da frente pra trás, como o Mac, com o tamanho em pixels reais e sem as janelas invisíveis do sistema.
const LISTAR_WIN = String.raw`
Add-Type -TypeDefinition @'
using System; using System.Text; using System.Diagnostics; using System.Runtime.InteropServices;
public static class Janelas {
  public struct R { public int L, T, Ri, B; }
  delegate bool Cb(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] static extern bool EnumWindows(Cb c, IntPtr l);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] static extern bool IsIconic(IntPtr h);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint p);
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("dwmapi.dll")] static extern int DwmGetWindowAttribute(IntPtr h, int a, out R r, int t);
  [DllImport("dwmapi.dll")] static extern int DwmGetWindowAttribute(IntPtr h, int a, out int r, int t);
  public static string Listar() {
    var s = new StringBuilder();
    EnumWindows((h, l) => {
      if (!IsWindowVisible(h) || IsIconic(h)) return true;
      int oculta; R r; uint p;
      if (DwmGetWindowAttribute(h, 14, out oculta, 4) == 0 && oculta != 0) return true;
      if (DwmGetWindowAttribute(h, 9, out r, 16) != 0 || r.Ri - r.L <= 80 || r.B - r.T <= 40) return true;
      GetWindowThreadProcessId(h, out p);
      string d; try { d = Process.GetProcessById((int)p).ProcessName; } catch { return true; }
      s.Append(d).Append("|").Append(p).Append("|").Append(r.L).Append("|").Append(r.T).Append("|").Append(r.Ri - r.L).Append("|").Append(r.B - r.T).Append(";");
      return true;
    }, IntPtr.Zero);
    return s.ToString();
  }
}
'@
[Janelas]::SetProcessDPIAware() | Out-Null
[Console]::OutputEncoding = [Text.Encoding]::UTF8
while ($null -ne [Console]::In.ReadLine()) { [Console]::Out.WriteLine([Janelas]::Listar()); [Console]::Out.Flush() }
`;
// "chrome|1234|0|0|800|600;" vira o mesmo formato do Mac. Os pixels reais passam pra medida do Electron, que muda com a escala do Windows (125%, 150%).
export function janelasDoWindows(linha, screen) {
  return linha.split(';').map((j) => j.trim()).filter(Boolean).map((j) => {
    const [d, p, x, y, width, height] = j.split('|');
    const r = screen.screenToDipRect(null, { x: +x, y: +y, width: +width, height: +height });
    return { d, p: +p, b: { X: r.x, Y: r.y, Width: r.width, Height: r.height } };
  });
}
let leitor = null;
let aoResponder = null;
function lerNoWindows(screen) {
  return new Promise((res) => {
    if (aoResponder) return res(null); // o pedido anterior ainda não voltou
    if (!leitor) {
      leitor = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', Buffer.from(LISTAR_WIN, 'utf16le').toString('base64')], { stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true });
      let resto = '';
      leitor.stdin.on('error', () => {});
      leitor.on('error', () => { leitor = null; aoResponder?.(null); });
      leitor.on('exit', () => { leitor = null; aoResponder?.(null); });
      leitor.stdout.on('data', (b) => {
        resto += b;
        const fim = resto.indexOf('\n');
        if (fim < 0) return;
        const linha = resto.slice(0, fim);
        resto = '';
        aoResponder?.(linha);
      });
    }
    const prazo = setTimeout(() => aoResponder?.(null), 6000);
    aoResponder = (linha) => {
      clearTimeout(prazo);
      aoResponder = null;
      try { res(linha == null ? null : janelasDoWindows(linha, screen)); } catch { res(null); }
    };
    leitor.stdin.write('\n');
  });
}
const pararLeitor = () => { leitor?.kill(); leitor = null; };

// null quer dizer "não deu pra saber": aí não aponta nada, em vez de mandar a pessoa procurar uma janela que está lá.
function listarJanelas(screen) {
  return new Promise((res) => {
    if (process.platform === 'win32') return lerNoWindows(screen).then(res);
    if (process.platform !== 'darwin') return res(null);
    execFile('/usr/bin/osascript', ['-l', 'JavaScript', '-e', LISTAR], { timeout: 4000 }, (erro, saida) => {
      try { res(erro ? [] : JSON.parse(saida)); } catch { res([]); }
    });
  });
}
const pidDe = (padrao) => new Promise((res) => process.platform !== 'darwin' ? res([]) : execFile('/usr/bin/pgrep', ['-f', padrao], { timeout: 3000 }, (erro, saida) => res(erro ? [] : saida.split('\n').filter(Boolean).map(Number))));
const dentro = (b, x, y) => x >= b.X && x <= b.X + b.Width && y >= b.Y && y <= b.Y + b.Height;

// Onde fica a barra de ícones (Dock no Mac, barra de tarefas no Windows) e se ela está escondida.
// Visível, ela aparece como a folga entre a tela e a área útil. Escondida não sobra folga nenhuma, e aí vale
// o que a pessoa escolheu nos ajustes do Mac (embaixo, esquerda ou direita). Antes a seta ia sempre pra baixo,
// e quem usa a barra do lado ou escondida via a seta apontando pro lugar errado (feedback do Nathan, 13/11/2026).
const LADOS = { left: 'esquerda', right: 'direita', bottom: 'baixo', top: 'cima' };
export function ondeFicaABarra(b, w, { orientacao = '', plataforma = process.platform } = {}) {
  const folga = { baixo: b.y + b.height - (w.y + w.height), esquerda: w.x - b.x, direita: b.x + b.width - (w.x + w.width), cima: w.y - b.y };
  // No Mac a folga de cima é a barra de menus, nunca a de ícones.
  const lados = plataforma === 'darwin' ? ['baixo', 'esquerda', 'direita'] : ['baixo', 'esquerda', 'direita', 'cima'];
  const visivel = lados.filter((l) => folga[l] > 4).sort((x, y) => folga[y] - folga[x])[0];
  const lado = visivel || LADOS[orientacao] || 'baixo';
  const esp = visivel ? folga[lado] : 10;
  const deitada = lado === 'baixo' || lado === 'cima';
  // O sistema não diz onde está cada ícone: acende a barra inteira, no lado em que ela está.
  const faixa = deitada
    ? { x: b.x + b.width * 0.08, y: lado === 'baixo' ? b.y + b.height - esp : b.y, width: b.width * 0.84, height: esp }
    : { x: lado === 'esquerda' ? b.x : b.x + b.width - esp, y: b.y + b.height * 0.12, width: esp, height: b.height * 0.76 };
  return { lado, oculta: !visivel, faixa };
}

// A seta pra barra de ícones é curta e fica no canto do guia, em vez de atravessar a tela por cima do que estiver aberto
// (feedback do Nathan, 10/11/2026: "podia ficar mais no canto, mais discreta"). b: a tela; g: o guia, se estiver aberto.
// Devolve o ponto da barra (x, y), de onde a seta sai (de) e a faixa que acende.
export function setaDaBarra(barra, b, g) {
  const f = barra.faixa;
  const TAM = 130;
  if (barra.lado === 'baixo' || barra.lado === 'cima') {
    // A seta corre na coluna do guia (no canto) até a barra.
    const x = Math.max(b.x + 160, Math.min(b.x + b.width - 160, g ? g.x + g.width / 2 : b.x + b.width - 220));
    const y = barra.lado === 'baixo' ? f.y + 18 : f.y + f.height - 18;
    return { x, y, de: { x, y: y + (barra.lado === 'baixo' ? -TAM : TAM) }, faixa: f };
  }
  const y = Math.max(b.y + 140, Math.min(b.y + b.height - 140, g ? g.y + Math.min(g.height, 200) / 2 : b.y + b.height / 2));
  const x = barra.lado === 'esquerda' ? f.x + f.width - 18 : f.x + 18;
  return { x, y, de: { x: x + (barra.lado === 'esquerda' ? TAM : -TAM), y }, faixa: f };
}

// O que o Mac guarda sobre a barra de ícones. Só importa quando ela está escondida; relido de tempos em tempos,
// porque a pessoa pode mudar isso com o app aberto.
let ajustesDaBarra = { orientacao: '', lido: 0 };
function lerAjustesDaBarra() {
  if (process.platform !== 'darwin' || Date.now() - ajustesDaBarra.lido < 15000) return Promise.resolve(ajustesDaBarra);
  return new Promise((res) => execFile('/usr/bin/defaults', ['read', 'com.apple.dock', 'orientation'], { timeout: 3000 }, (erro, saida) => {
    ajustesDaBarra = { orientacao: erro ? 'bottom' : String(saida).trim(), lido: Date.now() };
    res(ajustesDaBarra);
  }));
}

// A melhor posição pro guia quando o alvo é uma janela inteira: o canto da tela que tapa menos essa janela.
const sobreposicao = (a, j) => Math.max(0, Math.min(a.x + a.width, j.x + j.w) - Math.max(a.x, j.x)) * Math.max(0, Math.min(a.y + a.height, j.y + j.h) - Math.max(a.y, j.y));
export function cantoQueTapaMenos(g, area, janelas) {
  const M = 24;
  const tapa = (p) => janelas.reduce((soma, j) => soma + sobreposicao({ ...p, width: g.width, height: g.height }, j), 0);
  const atual = tapa(g);
  if (!atual) return null;
  const cantos = [
    { x: area.x + area.width - g.width - M, y: area.y + M }, { x: area.x + M, y: area.y + M },
    { x: area.x + area.width - g.width - M, y: area.y + area.height - g.height - M }, { x: area.x + M, y: area.y + area.height - g.height - M },
  ].map((p) => ({ ...p, tapa: tapa(p) })).sort((x, y) => x.tapa - y.tapa);
  // Só vale mudar de lugar se melhorar de verdade; por pouca coisa o guia fica onde a pessoa já viu.
  return cantos[0].tapa < atual * 0.6 ? { x: Math.round(cantos[0].x), y: Math.round(cantos[0].y) } : null;
}

export const setasDisponiveis = (plataforma = process.platform, env = process.env) => plataforma === 'darwin' || (plataforma === 'win32' && env.CLAUDE_SETUPER_SETAS_WIN === '1');

export function criarSetas({ BrowserWindow, screen, aqui, t, janelaGuia, moverGuia, aoSerCoberto }) {
  let vidro = null;
  let pronto = false;
  let alvos = [];
  let vigia = null;
  let ultimo = '';
  const trazidos = new Set(); // cada janela é trazida pra frente uma vez por passo; depois disso a pessoa manda
  let ajeitou = false; // o guia muda de canto sozinho uma vez por passo

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

  // A barra de ícones fica numa tela só: a que tem a folga dela. Sem folga em nenhuma (barra escondida), vale a principal.
  async function barra() {
    const { orientacao } = await lerAjustesDaBarra();
    const telas = [screen.getPrimaryDisplay(), ...screen.getAllDisplays()];
    const achadas = telas.map((d) => ({ d, ...ondeFicaABarra(d.bounds, d.workArea, { orientacao }) }));
    return achadas.find((x) => !x.oculta) || achadas[0];
  }
  const NOME_DO_LADO = { baixo: 'de baixo', cima: 'de cima', esquerda: 'esquerda', direita: 'direita' };
  // O recado da seta da barra. Escondida, a pessoa precisa saber em qual borda encostar o mouse pra ela aparecer.
  function recado(br, atras) {
    const win = process.platform === 'win32';
    if (br.oculta) {
      const lado = t(NOME_DO_LADO[br.lado]);
      return atras
        ? t('Essa janela está atrás das outras. Leva o mouse até a borda {lado} da tela, a barra de ícones aparece, e clica neste ícone', { lado })
        : t('Não achou a janela? Leva o mouse até a borda {lado} da tela, a barra de ícones aparece, e procura este ícone', { lado });
    }
    if (atras) return win ? t('Essa janela está atrás das outras. Clica neste ícone, na barra de tarefas') : t('Essa janela está atrás das outras. Clica neste ícone, na barra de ícones do Mac');
    return win ? t('Não achou a janela? Procura este ícone na barra de tarefas') : t('Não achou a janela? Procura este ícone na barra de ícones do Mac');
  }

  // Onde cada alvo está agora. Janela que não abriu ou que está atrás de outra manda a pessoa pro Dock.
  async function resolver() {
    const janelas = await listarJanelas(screen);
    if (!janelas) return { saida: [], cobriu: false };
    const fora = janelas.filter((j) => j.p !== process.pid);
    const saida = [];
    let cobriu = false;
    let br = null;
    const naBarra = async (a, atras) => {
      br ||= await barra();
      saida.push({ ...setaDaBarra(br, br.d.bounds, guiaNaTela(br.d.bounds)), tela: br.d, rotulo: recado(br, atras), icone: a.icone, dock: true });
    };
    for (const a of alvos) {
      const pids = a.pgrep ? await pidDe(a.pgrep) : [];
      const eDele = (j) => pids.includes(j.p) || (a.dono && a.dono.test(j.d));
      const j = fora.find(eDele);
      // Janela sem ícone na barra (a da senha): enquanto ela não aparece, nenhuma seta. O guia já diz o que fazer.
      if (!j && a.semDock) continue;
      if (!j) { await naBarra(a, false); continue; }
      // Janela de tamanho fixo (a da Apple, a da senha): dá pra apontar o botão. Nas outras (navegador, Obsidian,
      // Maestri) o lugar do botão muda com o tamanho da janela e da tela, e o sistema não conta onde ele está:
      // em vez de chutar um ponto, a moldura marca a janela certa e o recado diz o que fazer nela.
      const x = j.b.X + j.b.Width * (a.janela ? 0.5 : a.x ?? 0.5);
      const y = j.b.Y + j.b.Height * (a.janela ? 0.5 : a.y ?? 0.5);
      const atras = fora.slice(0, fora.indexOf(j)).some((o) => !eDele(o) && dentro(o.b, x, y));
      if (atras && a.semDock) continue;
      if (atras) {
        // Janela atrás das outras: a gente mesmo traz pra frente. Só se ela voltar pra trás é que a seta vai pra barra de ícones.
        if (process.platform === 'darwin' && a.caminho && !trazidos.has(a.caminho)) {
          trazidos.add(a.caminho);
          execFile('/usr/bin/open', ['-a', a.caminho], { timeout: 4000 }, () => {});
          continue;
        }
        await naBarra(a, true);
        continue;
      }
      // A nossa própria janela não pode ficar na frente do que a pessoa tem que clicar.
      if (janelas.some((o) => o.p === process.pid && dentro(o.b, x, y))) cobriu = true;
      saida.push({ x, y, rotulo: a.rotulo, ...(a.janela ? { janela: { x: j.b.X, y: j.b.Y, w: j.b.Width, h: j.b.Height } } : {}) });
    }
    return { saida, cobriu };
  }
  // O guia, se estiver nesta tela.
  function guiaNaTela(b) {
    const g = janelaGuia()?.getBounds();
    return g && g.x >= b.x && g.x < b.x + b.width && g.y >= b.y && g.y < b.y + b.height ? g : null;
  }

  async function atualizar() {
    if (!alvos.length) return;
    const { saida, cobriu } = await resolver();
    if (!alvos.length || !saida.length) return;
    if (cobriu) aoSerCoberto();
    const display = saida[0].tela || screen.getDisplayNearestPoint({ x: saida[0].x, y: saida[0].y });
    const b = display.bounds;
    criar();
    if (!pronto) return;
    let g = janelaGuia()?.getBounds();
    // O guia não pode ficar em cima do alvo: troca de canto.
    if (g && saida.some((s) => !s.dock && !s.janela && s.x > g.x - 30 && s.x < g.x + g.width + 30 && s.y > g.y - 30 && s.y < g.y + g.height + 30)) { moverGuia(); g = janelaGuia()?.getBounds(); }
    // Alvo que é a janela inteira: o guia vai pro canto que tapa menos essa janela. Uma vez por passo, pra não
    // brigar com a pessoa se ela arrastar o guia pra onde preferir.
    const molduras = saida.filter((s) => s.janela).map((s) => s.janela);
    if (g && molduras.length && !ajeitou) {
      ajeitou = true;
      const canto = cantoQueTapaMenos(g, display.workArea, molduras);
      if (canto) { moverGuia(canto); g = janelaGuia()?.getBounds(); }
    }
    const de = g && g.x >= b.x && g.x < b.x + b.width ? { x: g.x + (g.x > b.x + b.width / 2 ? 0 : g.width), y: g.y + Math.min(g.height, 200) / 2 } : { x: b.x + b.width / 2, y: b.y + 30 };
    const rel = (r) => (r ? { x: r.x - b.x, y: r.y - b.y, w: r.w ?? r.width, h: r.h ?? r.height } : null);
    const pacote = { guia: g ? { x: g.x - b.x, y: g.y - b.y, w: g.width, h: g.height } : null, setas: saida.map((s) => ({ x: s.x - b.x, y: s.y - b.y, rotulo: s.rotulo, icone: s.icone || '', dock: !!s.dock, faixa: rel(s.faixa), janela: rel(s.janela), de: { x: (s.de || de).x - b.x, y: (s.de || de).y - b.y } })) };
    const chave = JSON.stringify(pacote);
    // Mostra antes de mandar o desenho: janela escondida não pinta.
    if (!vidro.isVisible()) vidro.showInactive();
    if (chave !== ultimo) {
      ultimo = chave;
      vidro.setBounds(b);
      vidro.webContents.send('setas', pacote);
    }
    if (!vidro.isVisible()) vidro.showInactive();
    vidro.webContents.invalidate();
  }

  return {
    mostrar(novos) {
      alvos = setasDisponiveis() ? novos || [] : [];
      trazidos.clear();
      ajeitou = false;
      if (vidro && !vidro.isDestroyed() && pronto) vidro.webContents.send('setas', { setas: [], guia: null }); // a seta do passo anterior não fica na tela
      clearInterval(vigia);
      if (!alvos.length) { if (vidro && !vidro.isDestroyed()) vidro.hide(); return undefined; }
      ultimo = '';
      vigia = setInterval(atualizar, 1200);
      return atualizar();
    },
    esconder() {
      alvos = [];
      clearInterval(vigia);
      pararLeitor();
      if (vidro && !vidro.isDestroyed()) vidro.hide();
    },
    vidro: () => vidro,
  };
}
