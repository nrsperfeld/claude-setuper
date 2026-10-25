// Obsidian: instala o app, monta o vault com CLAUDE/, plugins e registra no app. Validado em 12/10/2026.
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { ui } from '../ui.js';

export const id = 'obsidian';
export const nome = 'Segundo cérebro (Obsidian)';
export const nomeCurto = 'Segundo cérebro';
export const descricao = 'Instala o Obsidian e monta o cofre de notas que o Claude vai alimentar';
export const padrao = true;

const PLUGINS = [
  { repo: 'blacksmithgu/obsidian-dataview', id: 'dataview' },
  { repo: 'SilentVoid13/Templater', id: 'templater-obsidian' },
];

export function dirConfigObsidian(ctx) {
  if (ctx.plataforma === 'darwin') return path.join(ctx.home, 'Library/Application Support/obsidian');
  if (ctx.plataforma === 'linux') return path.join(process.env.XDG_CONFIG_HOME || path.join(ctx.home, '.config'), 'obsidian');
  return path.join(ctx.appData(), 'obsidian');
}

function exeWindows(ctx) {
  return [...['Programs\\Obsidian\\Obsidian.exe', 'Obsidian\\Obsidian.exe'].map((r) => path.join(ctx.localAppData(), r)), 'C:\\Program Files\\Obsidian\\Obsidian.exe'].find((p) => ctx.existe(p));
}

function appInstalado(ctx) {
  if (ctx.plataforma === 'darwin') return ctx.existe('/Applications/Obsidian.app');
  if (ctx.win) return !!exeWindows(ctx);
  return false;
}

export async function verificar(ctx) {
  const vault = ctx.estado.respostas?.vault || path.join(ctx.home, 'Documents', 'Segundo Cérebro');
  const temApp = appInstalado(ctx) || (await ctx.existeComando('obsidian'));
  const reg = ctx.lerJson(path.join(dirConfigObsidian(ctx), 'obsidian.json'), { vaults: {} });
  const registrado = Object.values(reg.vaults || {}).some((v) => nfc(v.path) === nfc(vault));
  const itens = [
    { item: 'Obsidian instalado', ok: temApp },
    { item: 'Cofre com pasta CLAUDE/', ok: ctx.existe(path.join(vault, 'CLAUDE', 'projetos')) },
    { item: 'Cofre registrado no Obsidian', ok: registrado },
    { item: 'Plugins Dataview e Templater', ok: PLUGINS.every((p) => ctx.existe(path.join(vault, '.obsidian', 'plugins', p.id, 'main.js'))) },
  ];
  if (await ctx.existeComando('obsidian')) {
    const out = await ctx.run('obsidian', ['plugin', 'id=dataview', `vault=${path.basename(vault)}`], { ignorarErro: true, sempre: true, timeout: 15000 });
    itens.push({ item: 'Plugins habilitados (clique de confiança)', ok: /enabled\s+true/.test(out), dica: 'abra o Obsidian e clique em "Trust author and enable plugins"' });
  }
  return itens;
}

export async function instalar(ctx) {
  const vault = ctx.resp.vault || path.join(ctx.home, 'Documents', 'Segundo Cérebro');
  ctx.resp.vault = vault;

  await instalarApp(ctx);

  await ui.tarefa('Montando o seu cofre de notas', 'Cofre montado', async () => {
    const pastas = { feedback: 'feedback', 'decisões': 'decisão', 'padrões': 'padrão', descobertas: 'descoberta', projetos: 'projeto' };
    for (const [pasta, tag] of Object.entries(pastas)) {
      fs.mkdirSync(path.join(vault, 'CLAUDE', pasta), { recursive: true });
      ctx.escreverSeFaltar(path.join(vault, 'CLAUDE', pasta, 'README.md'), ctx.template('vault/README-pasta.md', { pasta, tag }));
    }
    for (const p of ['1. PROJETOS', '2. ÁREAS', '3. RECURSOS', '4. ARQUIVO', 'TEMPLATES', '_anexos']) fs.mkdirSync(path.join(vault, p), { recursive: true });
    ctx.escreverSeFaltar(path.join(vault, 'Comece aqui.md'), ctx.template('vault/Comece aqui.md'));
    ctx.escreverSeFaltar(path.join(vault, 'Painel do Claude.md'), ctx.template('vault/Painel do Claude.md'));
    ctx.escreverSeFaltar(path.join(vault, 'TEMPLATES', 'Nota do Claude.md'), ctx.template('vault/template-nota.md'));
    ctx.escreverSeFaltar(path.join(vault, 'CLAUDE', 'padrões', 'Como falar comigo.md'), ctx.template('vault/padrao-inicial.md'));

    const obs = path.join(vault, '.obsidian');
    ctx.escreverSeFaltar(path.join(obs, 'app.json'), { attachmentFolderPath: '_anexos', newFileLocation: 'root', useMarkdownLinks: false, alwaysUpdateLinks: true, showUnsupportedFiles: false });
    ctx.escreverSeFaltar(path.join(obs, 'appearance.json'), { theme: 'obsidian', baseFontSize: 16, accentColor: '#c8873c', showViewHeader: true });
    ctx.escreverSeFaltar(path.join(obs, 'core-plugins.json'), CORE_PLUGINS);
    ctx.escreverSeFaltar(path.join(obs, 'templates.json'), { folder: 'TEMPLATES', dateFormat: 'YYYY-MM-DD', timeFormat: 'HH:mm' });
    ctx.escreverSeFaltar(path.join(obs, 'hotkeys.json'), {});
    ctx.mesclarJson(path.join(obs, 'community-plugins.json'), PLUGINS.map((p) => p.id));
    ctx.escreverSeFaltar(path.join(obs, 'plugins', 'templater-obsidian', 'data.json'), { templates_folder: 'TEMPLATES', trigger_on_file_creation: false });
  });

  await ui.tarefa('Baixando os plugins do cofre', 'Plugins baixados', async (msg) => {
    for (const p of PLUGINS) {
      const dest = path.join(vault, '.obsidian', 'plugins', p.id);
      if (ctx.existe(path.join(dest, 'main.js'))) continue;
      msg(`Baixando ${p.id}`);
      const rel = await ctx.baixarJson(`https://api.github.com/repos/${p.repo}/releases/latest`);
      const assets = Object.fromEntries(rel.assets.map((a) => [a.name, a.browser_download_url]));
      for (const f of ['main.js', 'manifest.json', 'styles.css']) if (assets[f]) await ctx.baixar(assets[f], path.join(dest, f));
    }
  });

  await ui.tarefa('Registrando o cofre no Obsidian', 'Cofre registrado', async () => {
    registrarVault(ctx, vault);
  });

  await abrirEConfiar(ctx, vault);
}

async function instalarApp(ctx) {
  if (ctx.win) {
    if (appInstalado(ctx)) return ui.ok('Obsidian já está instalado');
    if (ctx.semApps) return;
    const { winget } = await import('./base.js');
    await ui.tarefa('Instalando o Obsidian, o seu segundo cérebro', 'Obsidian instalado', async () => { await winget(ctx, 'Obsidian.Obsidian'); }, { demora: 'uns 2 minutos, é normal' });
    return;
  }
  if (ctx.plataforma === 'darwin') {
    if (ctx.existe('/Applications/Obsidian.app')) return ui.ok('Obsidian já está instalado');
    if (ctx.semApps) return;
    await ui.tarefa('Instalando o Obsidian, o seu segundo cérebro', 'Obsidian instalado', async () => { await (await import('./base.js')).brewInstalar(ctx, 'obsidian', ['--cask', 'obsidian']); }, { demora: 'uns 2 minutos, é normal' });
  } else if (ctx.plataforma === 'linux') {
    if (await ctx.existeComando('obsidian')) return ui.ok('Obsidian já está instalado');
    if (ctx.semApps) return;
    await ui.tarefa('Instalando o Obsidian', 'Obsidian instalado', async () => {
      const rel = await ctx.baixarJson('https://api.github.com/repos/obsidianmd/obsidian-releases/releases/latest');
      const deb = rel.assets.find((a) => a.name.endsWith('amd64.deb'));
      if (deb && (await ctx.existeComando('apt-get'))) {
        const tmp = path.join(ctx.pastaSetuper, 'obsidian.deb');
        await ctx.baixar(deb.browser_download_url, tmp);
        await ctx.runVisivel('sudo', ['apt-get', 'install', '-y', tmp]);
      } else if (await ctx.existeComando('flatpak')) {
        await ctx.runVisivel('flatpak', ['install', '-y', 'flathub', 'md.obsidian.Obsidian']);
      } else throw new Error('não achei apt nem flatpak pra instalar o Obsidian');
    });
  }
}

export function registrarVault(ctx, vault) {
  const cfg = path.join(dirConfigObsidian(ctx), 'obsidian.json');
  const data = ctx.lerJson(cfg, { vaults: {} });
  data.vaults = data.vaults || {};
  let vid = Object.keys(data.vaults).find((k) => nfc(data.vaults[k].path) === nfc(vault)) || crypto.randomBytes(8).toString('hex');
  for (const v of Object.values(data.vaults)) delete v.open;
  data.vaults[vid] = { path: vault, ts: Date.now(), open: true };
  if (data.cli === undefined) data.cli = true;
  ctx.escrever(cfg, JSON.stringify(data, null, 2));
  return vid;
}

async function abrirEConfiar(ctx, vault) {
  if (ctx.semApps || ctx.dryRun || (ctx.plataforma !== 'darwin' && !ctx.win)) return;
  // Obsidian aberto não relê o obsidian.json: fecha antes de abrir.
  const rodando = async () => !!(await ctx.run('pgrep', ['-x', 'Obsidian'], { ignorarErro: true, sempre: true }));
  if (ctx.win) {
    await ctx.run('taskkill', ['/IM', 'Obsidian.exe', '/F'], { ignorarErro: true });
    await new Promise((r) => setTimeout(r, 2000));
  } else {
    // Espera fechar de verdade: um "open" enquanto o app ainda está saindo vai pro processo que está morrendo e nada abre.
    await ctx.run('pkill', ['-x', 'Obsidian'], { ignorarErro: true });
    if (!(await ctx.esperar(async () => !(await rodando()), { intervalo: 1, limite: 20 }))) await ctx.run('pkill', ['-9', '-x', 'Obsidian'], { ignorarErro: true });
    await new Promise((r) => setTimeout(r, 1000));
  }
  // O Obsidian abre em inglês: o botão é "Trust author and enable plugins", o primeiro da esquerda.
  const abrir = ctx.win ? 'Se o Windows perguntar se pode abrir o Obsidian, clica em Permitir.' : 'Se o Mac perguntar se quer abrir um app baixado da internet, clica em Abrir.';
  const sumiu = ctx.win ? 'Se o Obsidian não aparecer, abre ele pelo menu Iniciar. Eu espero você clicar.' : 'Se o Obsidian não aparecer, abre ele pela pasta Aplicativos. Eu espero você clicar.';
  ui.pausa('O Obsidian vai abrir e perguntar se pode ligar os complementos', ctx.app
    ? [abrir, 'No Obsidian, clica no botão marcado aqui embaixo.', sumiu]
    : [abrir, 'Na janela do Obsidian (em inglês), clica em "Trust author and enable plugins".',
      'Os complementos são o Dataview e o Templater, os dois mais usados do Obsidian. Pode confiar.', sumiu],
  { figura: 'obsidian-confiar' });
  // No Windows abre o programa direto: o link obsidian:// só funciona depois que o Obsidian abriu uma vez.
  // O cofre já está marcado como aberto no obsidian.json, então ele abre nele.
  if (ctx.win) {
    const exe = exeWindows(ctx);
    if (exe) spawn(exe, [], { detached: true, stdio: 'ignore' }).unref();
    else await ctx.abrirUrl(`obsidian://open?path=${encodeURIComponent(vault)}`);
  }
  else {
    // Confere se abriu e tenta de novo: o primeiro open depois de instalar às vezes se perde.
    for (let i = 0; i < 3; i++) {
      await ctx.run('open', ['-a', 'Obsidian'], { ignorarErro: true });
      if (await ctx.esperar(rodando, { intervalo: 1, limite: 15 })) break;
    }
  }
  const cli = await ctx.existeComando('obsidian');
  if (!cli) {
    ui.info('Quando terminar, ative também o "Command line interface" nas Configurações do Obsidian (General). Sigo em frente.');
    return;
  }
  const ok = await ctx.esperar(async () => {
    const out = await ctx.run('obsidian', ['plugin', 'id=dataview', `vault=${path.basename(vault)}`], { ignorarErro: true, sempre: true, timeout: 15000 });
    return /enabled\s+true/.test(out);
  }, { intervalo: 4, limite: 300 });
  if (ok) ui.ok('Plugins habilitados. Seu cofre está pronto.');
  else ui.aviso(ctx.app ? 'Não vi o clique no Obsidian. Sem problema, no fim eu te mostro o que ficou faltando.' : 'Não consegui confirmar o clique. Sem problema, dá pra fazer depois: o "doctor" avisa se faltar.');
}

function nfc(s) {
  return String(s || '').normalize('NFC');
}

const CORE_PLUGINS = {
  'file-explorer': true, 'global-search': true, switcher: true, graph: true, backlink: true, canvas: true, 'outgoing-link': true,
  'tag-pane': true, properties: true, 'page-preview': true, 'daily-notes': false, templates: true, 'note-composer': true,
  'command-palette': true, 'editor-status': true, bookmarks: true, outline: true, 'word-count': true, 'file-recovery': true,
  footnotes: false, 'slash-command': false, 'markdown-importer': false, 'zk-prefixer': false, 'random-note': false, slides: false,
  'audio-recorder': false, workspaces: false, publish: false, sync: false, webviewer: false, bases: true,
};
