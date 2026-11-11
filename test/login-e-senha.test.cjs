// Feedback do Nathan de 10/11/2026 (itens 7 a 10): a janela da Apple e a senha não entram nas perguntas,
// o cartão da senha só aparece com a janela de senha aberta, a seta da barra de ícones fica no canto
// e o código do login do Claude tem onde ser colado.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const RAIZ = path.join(__dirname, '..');
const src = (arq) => import(pathToFileURL(path.join(RAIZ, 'src', arq)).href);
const app = (arq) => import(pathToFileURL(path.join(RAIZ, 'app', arq)).href);
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

test('durante as perguntas não abre a janela da Apple nem pede senha: só baixa a IA', async () => {
  const { adiantarPreparo } = await src('modulos/base.js');
  const { ui } = await src('ui.js');
  const originais = { pausa: ui.pausa, confirmarFora: ui.confirmarFora };
  const pedidos = [];
  ui.pausa = (titulo) => pedidos.push(`pausa:${titulo}`);
  ui.confirmarFora = async (g) => { pedidos.push(`fora:${g.rotulo}`); return true; };
  const casa = fs.mkdtempSync(path.join(os.tmpdir(), 'setuper-preparo-'));
  const comandos = [];
  const adiantados = [];
  const ctx = {
    app: true, plataforma: 'darwin', homeReal: casa,
    run: async (cmd, args) => { comandos.push([cmd, ...args].join(' ')); return ''; },
    adiantar: (chave) => adiantados.push(chave),
  };
  try {
    await adiantarPreparo(ctx);
    assert.deepStrictEqual(pedidos, []);
    assert.ok(!comandos.some((c) => /xcode-select|sudo|Homebrew/.test(c)), comandos.join('\n'));
    assert.deepStrictEqual(adiantados, ['claude']);
  } finally {
    Object.assign(ui, originais);
    fs.rmSync(casa, { recursive: true, force: true });
  }
});

test('o cartão da senha só aparece enquanto a janela de senha está aberta', async () => {
  const { comCartaoDaSenha, marcaDaSenha } = await src('modulos/base.js');
  const { ui } = await src('ui.js');
  const originais = { pausa: ui.pausa, fimDaPausa: ui.fimDaPausa };
  const ordem = [];
  ui.pausa = (_t, _l, o) => ordem.push(`pausa:${o.figura}`);
  ui.fimDaPausa = () => ordem.push('fim');
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'setuper-senha-'));
  const askpass = path.join(pasta, 'pedir-senha.sh');
  const marca = marcaDaSenha(askpass);
  try {
    await comCartaoDaSenha({ askpass }, async () => {
      await espera(80);
      ordem.push('baixando'); // o Homebrew trabalhando, sem precisar da senha: nada de cartão
      fs.writeFileSync(marca, '');
      await espera(80);
      fs.rmSync(marca);
      await espera(80);
      fs.writeFileSync(marca, ''); // a janela pode aparecer mais de uma vez
      await espera(80);
    }, { intervalo: 20 });
    // Terminou com a janela ainda marcada como aberta: o cartão não fica pendurado.
    assert.deepStrictEqual(ordem, ['baixando', 'pausa:senha', 'fim', 'pausa:senha', 'fim']);
  } finally {
    Object.assign(ui, originais);
    fs.rmSync(pasta, { recursive: true, force: true });
  }
});

test('o código do login: aceita o que a página mostra e o endereço da página, e recusa o resto', async () => {
  const { codigoDoLogin } = await src('modulos/base.js');
  assert.strictEqual(codigoDoLogin('  aBc123-_xyZ#St4te_ok \n'), 'aBc123-_xyZ#St4te_ok');
  assert.strictEqual(codigoDoLogin('aBc123 xyZ987#state'), 'aBc123xyZ987#state'); // quebra de linha ou espaço no meio, da cópia
  assert.strictEqual(codigoDoLogin('https://platform.claude.com/oauth/code/callback?code=CODIGO123abc&state=ESTADO456'), 'CODIGO123abc#ESTADO456');
  assert.strictEqual(codigoDoLogin('https://claude.ai/oauth/code/callback?state=so-o-estado'), '');
  assert.strictEqual(codigoDoLogin(''), '');
  assert.strictEqual(codigoDoLogin('oi'), '');
  assert.strictEqual(codigoDoLogin('minha senha é <isso>'), '');
});

// Login do Claude no app, com um `claude` de mentira: a primeira página dá um código vencido, a segunda um bom.
async function loginNoApp({ codigos, pulaDepois }) {
  const { instalar } = await src('modulos/base.js');
  const { ui } = await src('ui.js');
  const nomes = ['pausa', 'info', 'ok', 'aviso', 'tarefa', 'pulou', 'esperarCodigo'];
  const originais = Object.fromEntries(nomes.map((n) => [n, ui[n]]));
  const casa = fs.mkdtempSync(path.join(os.tmpdir(), 'setuper-login-'));
  const r = { infos: [], tentativas: 0, escritos: [], estados: [] };
  let logado = false;
  let receber = null;
  ui.pausa = () => {};
  ui.ok = () => {};
  ui.aviso = () => {};
  ui.info = (m) => r.infos.push(m);
  ui.tarefa = async (_a, _b, fn) => fn(() => {});
  const inicio = Date.now();
  ui.pulou = () => pulaDepois != null && Date.now() - inicio > pulaDepois; // "Entrar depois"
  ui.esperarCodigo = (fn) => { receber = fn; r.estados.push(!!fn); };
  const ctx = {
    app: true, plataforma: 'linux', homeReal: casa, temAdiantado: () => false,
    existeComando: async () => true,
    run: async (cmd, args) => (cmd === 'claude' && args[1] === 'status' ? JSON.stringify({ loggedIn: logado }) : ''),
    esperar: async (cond) => cond(),
    runVisivel: (cmd, args, opts) => new Promise((res) => {
      opts.sinal.addEventListener('abort', () => res(1));
      r.tentativas++;
      const vez = r.tentativas;
      // O que o `claude auth login` faz com o que chega pela entrada: código bom entra, ruim desiste.
      opts.aoIniciar((texto) => { r.escritos.push(texto); logado = texto === 'BOM123456#estado'; setTimeout(() => res(logado ? 0 : 1), 5); });
      setTimeout(() => receber(codigos[vez - 1] ?? ''), 5);
    }),
  };
  try {
    await instalar(ctx).then(() => { r.ok = true; }, (e) => { r.erro = e; });
  } finally {
    Object.assign(ui, originais);
    fs.rmSync(casa, { recursive: true, force: true });
  }
  return r;
}

test('login do Claude no app: o código colado vai pro login, e código vencido abre uma página nova', async () => {
  const r = await loginNoApp({ codigos: ['VENCIDO1234#estado', 'https://claude.ai/oauth/code/callback?code=BOM123456&state=estado'] });
  assert.ok(r.ok, r.erro?.message);
  assert.strictEqual(r.tentativas, 2);
  assert.deepStrictEqual(r.escritos, ['VENCIDO1234#estado', 'BOM123456#estado']);
  assert.ok(r.infos.some((m) => /Esse código não serviu/.test(m)));
  assert.ok(r.infos.some((m) => /Recebi o código/.test(m)));
  // O campo some da tela quando o login daquela página termina.
  assert.strictEqual(r.estados.at(-1), false);
});

test('login do Claude no app: o que não parece código não vai pro login e a pessoa sabe o que fazer', { timeout: 10000 }, async () => {
  const r = await loginNoApp({ codigos: ['oi'], pulaDepois: 50 });
  // Nada chegou no login, que continua esperando na mesma página até a pessoa clicar em "Entrar depois".
  assert.deepStrictEqual(r.escritos, []);
  assert.strictEqual(r.tentativas, 1);
  assert.ok(r.infos.some((m) => /Ainda não achei o código/.test(m)));
  assert.match(r.erro?.message || '', /login na IA ficou pra depois/);
  assert.strictEqual(r.erro.continuar, true);
});

test('três códigos recusados: para de tentar e não fica 15 minutos esperando um login que já desistiu', async () => {
  const r = await loginNoApp({ codigos: ['RUIM000001#a', 'RUIM000002#b', 'RUIM000003#c', 'BOM123456#estado'] });
  assert.strictEqual(r.tentativas, 3);
  assert.ok(!r.infos.some((m) => /Estou esperando você terminar o login/.test(m)));
  assert.match(r.erro?.message || '', /login na IA ficou pra depois/);
});

test('a ponte do app leva o código colado na tela até o login que está esperando', async () => {
  const { criarUiApp } = await app('ui-app.js');
  const eventos = [];
  const ui = criarUiApp((ev) => eventos.push(ev), async () => {});
  const recebidos = [];
  ui.colarCodigo('cedo demais'); // sem login esperando, não quebra nem guarda
  ui.esperarCodigo((c) => recebidos.push(c));
  ui.colarCodigo(' abc#def ');
  ui.esperarCodigo(null);
  ui.colarCodigo('tarde demais');
  assert.deepStrictEqual(recebidos, [' abc#def ']);
  assert.deepStrictEqual(eventos.filter((e) => e.tipo === 'colar-codigo').map((e) => e.ativo), [true, false]);
});

test('a seta da barra de ícones é curta e fica na coluna do guia, no canto, e não atravessa a tela', async () => {
  const { setaDoDock } = await app('setas.js');
  const tela = { x: 0, y: 0, width: 1512, height: 982 };
  const guia = { x: 1512 - 340 - 24, y: 24, width: 340, height: 420 };
  const s = setaDoDock({ x: 756, y: 976, rotulo: 'Não achou a janela?', dock: true }, tela, guia);
  assert.strictEqual(s.x, guia.x + guia.width / 2); // embaixo do guia, no canto direito
  assert.strictEqual(s.de.x, s.x);
  assert.ok(s.y - s.de.y <= 220, `a seta tem ${s.y - s.de.y} px`);
  assert.ok(s.de.y > tela.height / 2, 'a seta começa na metade de baixo, longe do meio da tela');
  // Sem guia aberto, fica no canto direito também.
  assert.ok(setaDoDock({ x: 756, y: 976, dock: true }, tela, null).x > tela.width * 0.75);
  // Barra de ícones do lado esquerdo: seta curta, deitada.
  const lado = setaDoDock({ x: 6, y: 491, dock: true }, tela, guia);
  assert.strictEqual(lado.de.y, lado.y);
  assert.ok(lado.de.x - lado.x <= 150);
});

test('a janela de senha não tem seta pra barra de ícones: sem achar a janela, nenhuma seta', () => {
  const main = fs.readFileSync(path.join(RAIZ, 'app', 'main.js'), 'utf8');
  const setas = fs.readFileSync(path.join(RAIZ, 'app', 'setas.js'), 'utf8');
  assert.match(main, /semDock: !!p\.proprio/);
  assert.match(setas, /if \(!j && a\.semDock\) continue;/);
  // O pedir-senha.sh marca a janela aberta e tira a marca quando ela fecha, com o mesmo nome que o base.js procura.
  assert.match(main, /const marca = `\$\{arquivo\}\.aberta`;/);
  assert.match(main, /: > "\$\{marca\}"[\s\S]*rm -f "\$\{marca\}"\nexit \$r/);
});
