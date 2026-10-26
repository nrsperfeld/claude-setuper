// Mac Intel: o instalador do Homebrew passou a recusar ("only supported on Apple Silicon processors").
// Aqui cada programa vem direto da fonte oficial, sem Homebrew e sem pedir senha:
// apps de janela vão pra /Applications (o usuário administrador pode gravar lá), e o Node e o gh
// ficam dentro da pasta da pessoa, em ~/.local.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let intel;

// Pelo processador de verdade, não pelo app: um app x64 rodando via Rosetta num Mac M1 continua usando o Homebrew.
export async function macIntel(ctx) {
  if (ctx.plataforma !== 'darwin') return false;
  if (intel === undefined) intel = (await ctx.run('sysctl', ['-in', 'hw.optional.arm64'], { ignorarErro: true, sempre: true })).trim() !== '1';
  return intel;
}

const AGENTE = 'Claude Setuper';

async function baixar(url, destino) {
  const r = await fetch(url, { headers: { 'User-Agent': AGENTE } });
  if (!r.ok) throw new Error(`não consegui baixar (${r.status})`);
  fs.writeFileSync(destino, Buffer.from(await r.arrayBuffer()));
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
  await baixar(ficha.url, arquivo);
  let origem;
  if (/\.dmg$/i.test(arquivo)) {
    const montagem = path.join(tmp, 'disco');
    await ctx.run('hdiutil', ['attach', '-nobrowse', '-readonly', '-noautoopen', '-mountpoint', montagem, arquivo]);
    try {
      await ctx.run('ditto', [path.join(montagem, nomeApp), destinoFinal]);
    } finally {
      await ctx.run('hdiutil', ['detach', '-force', montagem], { ignorarErro: true });
    }
  } else {
    await ctx.run('ditto', ['-x', '-k', arquivo, tmp]);
    origem = path.join(tmp, nomeApp);
    await ctx.run('ditto', [origem, destinoFinal]);
  }
  // Baixado fora do Homebrew, o Mac marca como "da internet" e pergunta antes de abrir. Tira a marca.
  await ctx.run('xattr', ['-dr', 'com.apple.quarantine', destinoFinal], { ignorarErro: true });
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
  await baixar(`https://nodejs.org/dist/${v}/node-${v}-darwin-x64.tar.gz`, arquivo);
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
  await baixar(asset.browser_download_url, arquivo);
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
