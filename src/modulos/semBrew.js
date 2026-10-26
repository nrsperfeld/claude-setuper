// Mac Intel: o instalador do Homebrew passou a recusar ("only supported on Apple Silicon processors").
// Aqui cada programa vem direto da fonte oficial, sem Homebrew e sem pedir senha:
// apps de janela vão pra /Applications (o usuário administrador pode gravar lá), e o Node e o gh
// ficam dentro da pasta da pessoa, em ~/.local.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ui } from '../ui.js';

let intel;

// Pelo processador de verdade, não pelo app: um app x64 rodando via Rosetta num Mac M1 continua usando o Homebrew.
export async function macIntel(ctx) {
  if (ctx.plataforma !== 'darwin') return false;
  if (intel === undefined) intel = (await ctx.run('sysctl', ['-in', 'hw.optional.arm64'], { ignorarErro: true, sempre: true })).trim() !== '1';
  return intel;
}

const AGENTE = 'Claude Setuper';

// Baixa gravando aos pedaços e mostra quanto já veio, pra tela nunca ficar parada sem dizer nada.
async function baixar(url, destino, nome) {
  const r = await fetch(url, { headers: { 'User-Agent': AGENTE } });
  if (!r.ok) throw new Error(`não consegui baixar (${r.status})`);
  const total = Number(r.headers.get('content-length')) || 0;
  const mb = (n) => Math.round(n / 1048576);
  const arquivo = fs.openSync(destino, 'w');
  let veio = 0;
  let ultimo = 0;
  try {
    for await (const pedaco of r.body) {
      fs.writeSync(arquivo, pedaco);
      veio += pedaco.length;
      if (nome && Date.now() - ultimo > 1000) {
        ultimo = Date.now();
        ui.andamento(total ? `Baixando ${nome}: ${mb(veio)} de ${mb(total)} MB (${Math.floor((veio / total) * 100)}%)` : `Baixando ${nome}: ${mb(veio)} MB até agora`);
      }
    }
  } finally {
    fs.closeSync(arquivo);
  }
}

// Copia o app mostrando a porcentagem: o Chrome tem quase 1 GB aberto e a cópia passa de um minuto.
async function copiarApp(ctx, origem, destino, nome) {
  const tamanho = async (p) => Number((await ctx.run('du', ['-sk', p], { ignorarErro: true, sempre: true })).split(/\s/)[0]) || 0;
  const total = await tamanho(origem);
  const vigia = setInterval(async () => {
    const feito = await tamanho(destino);
    if (total) ui.andamento(`Copiando o ${nome} pra pasta Aplicativos: ${Math.min(99, Math.floor((feito / total) * 100))}%`);
  }, 3000);
  try {
    await ctx.run('ditto', [origem, destino]);
  } finally {
    clearInterval(vigia);
  }
}

function pastaTemp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'setuper-'));
}

// Lê o endereço oficial do mesmo jeito que o Homebrew lê, pela ficha pública do cask.
async function instalarApp(ctx, cask) {
  const ficha = await (await fetch(`https://formulae.brew.sh/api/cask/${cask}.json`)).json();
  const nomeApp = ficha.artifacts.find((a) => a.app)?.app?.[0];
  if (!nomeApp) throw new Error(`não achei o aplicativo do ${cask}`);
  const destinoFinal = path.join('/Applications', nomeApp);
  if (fs.existsSync(destinoFinal)) return;
  const tmp = pastaTemp();
  const arquivo = path.join(tmp, path.basename(new URL(ficha.url).pathname) || 'download');
  const nome = (ficha.name?.[0] || nomeApp.replace('.app', ''));
  await baixar(ficha.url, arquivo, `o ${nome}`);
  ui.andamento(`Copiando o ${nome} pra pasta Aplicativos`);
  let origem;
  if (/\.dmg$/i.test(arquivo)) {
    const montagem = path.join(tmp, 'disco');
    await ctx.run('hdiutil', ['attach', '-nobrowse', '-readonly', '-noautoopen', '-mountpoint', montagem, arquivo]);
    try {
      await copiarApp(ctx, path.join(montagem, nomeApp), destinoFinal, nome);
    } finally {
      await ctx.run('hdiutil', ['detach', '-force', montagem], { ignorarErro: true });
    }
  } else {
    await ctx.run('ditto', ['-x', '-k', arquivo, tmp]);
    origem = path.join(tmp, nomeApp);
    await copiarApp(ctx, origem, destinoFinal, nome);
  }
  // Baixado fora do Homebrew, o Mac marca como "da internet" e pergunta antes de abrir. Tira a marca.
  await ctx.run('xattr', ['-dr', 'com.apple.quarantine', destinoFinal], { ignorarErro: true });
  ui.andamento(`Conferindo se o ${nome} ficou certo`);
  const exe = path.join(destinoFinal, 'Contents', 'MacOS');
  const binario = fs.existsSync(exe) ? fs.readdirSync(exe).map((f) => path.join(exe, f))[0] : null;
  if (binario && !(await ctx.run('lipo', ['-archs', binario], { ignorarErro: true, sempre: true })).includes('x86_64')) {
    fs.rmSync(destinoFinal, { recursive: true, force: true });
    throw Object.assign(new Error(`o ${nomeApp.replace('.app', '')} não funciona em Mac com processador Intel`), { continuar: true });
  }
  fs.rmSync(tmp, { recursive: true, force: true });
}

// Node oficial (versão LTS) desempacotado em ~/.local/node, com a pasta bin no PATH.
export async function instalarNode(ctx) {
  const lista = await (await fetch('https://nodejs.org/dist/index.json')).json();
  const v = lista.find((x) => x.lts).version;
  const tmp = pastaTemp();
  const arquivo = path.join(tmp, 'node.tar.gz');
  await baixar(`https://nodejs.org/dist/${v}/node-${v}-darwin-x64.tar.gz`, arquivo, 'as ferramentas de base');
  ui.andamento('Abrindo as ferramentas de base');
  const destino = path.join(ctx.homeReal, '.local', 'node');
  fs.rmSync(destino, { recursive: true, force: true });
  fs.mkdirSync(destino, { recursive: true });
  await ctx.run('tar', ['-xzf', arquivo, '-C', destino, '--strip-components', '1']);
  fs.rmSync(tmp, { recursive: true, force: true });
  colocarNoPath(path.join(destino, 'bin'));
}

// GitHub CLI oficial, só o executável, em ~/.local/bin.
async function instalarGh(ctx) {
  const rel = await (await fetch('https://api.github.com/repos/cli/cli/releases/latest', { headers: { 'User-Agent': AGENTE } })).json();
  const asset = rel.assets.find((a) => /macOS_amd64\.zip$/.test(a.name));
  if (!asset) throw new Error('não achei o GitHub CLI pra Mac Intel');
  const tmp = pastaTemp();
  const arquivo = path.join(tmp, asset.name);
  await baixar(asset.browser_download_url, arquivo, 'o GitHub');
  await ctx.run('ditto', ['-x', '-k', arquivo, tmp]);
  const pasta = fs.readdirSync(tmp).find((f) => f.startsWith('gh_') && !f.endsWith('.zip'));
  const bin = path.join(ctx.homeReal, '.local', 'bin');
  fs.mkdirSync(bin, { recursive: true });
  fs.copyFileSync(path.join(tmp, pasta, 'bin', 'gh'), path.join(bin, 'gh'));
  fs.chmodSync(path.join(bin, 'gh'), 0o755);
  fs.rmSync(tmp, { recursive: true, force: true });
  colocarNoPath(bin);
}

export function colocarNoPath(pasta) {
  if (!process.env.PATH.split(':').includes(pasta)) process.env.PATH = `${pasta}:${process.env.PATH}`;
}

// Mesmos argumentos do brew install: ['--cask', 'obsidian'] ou ['gh'].
export async function instalarSemBrew(ctx, args) {
  if (args[0] === '--cask') return instalarApp(ctx, args[1]);
  if (args[0] === 'gh') return instalarGh(ctx);
  if (args[0] === 'node') return instalarNode(ctx);
  throw new Error(`não sei instalar ${args.join(' ')} sem o Homebrew`);
}
