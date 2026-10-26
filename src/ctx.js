// Contexto compartilhado por todos os módulos: caminhos, flags, execução de comandos e registro.
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const execFileP = promisify(execFile);
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function criarCtx(flags = {}) {
  const home = flags.home ? path.resolve(flags.home) : os.homedir();
  const pastaSetuper = path.join(home, 'Claude Setuper');
  fs.mkdirSync(pastaSetuper, { recursive: true });
  const logPath = path.join(pastaSetuper, 'registro.log');
  const estadoPath = path.join(pastaSetuper, 'estado.json');
  const adiantados = new Map();

  const ctx = {
    raiz: RAIZ,
    templates: path.join(RAIZ, 'templates'),
    home,
    homeReal: os.homedir(),
    plataforma: flags.plataforma || process.platform, // 'darwin' | 'linux' | 'win32' (override só pra testes)
    win: (flags.plataforma || process.platform) === 'win32',
    dryRun: !!flags.dryRun,
    semApps: !!flags.semApps, // não instala aplicativos (só escreve arquivos). Usado em testes.
    sim: !!flags.sim, // aceita todos os defaults sem perguntar
    assistido: !!flags.assistido,
    perfil: flags.perfil || '',
    app: !!flags.app, // rodando dentro do app do Mac (sem Terminal)
    askpass: flags.askpass || '', // programa que pede a senha numa janela do Mac (app)
    pastaSetuper,
    logPath,
    estadoPath,
    claudeDir: path.join(home, '.claude'),
    resp: {}, // respostas do wizard
    estado: lerJson(estadoPath, { modulos: {}, versao: null }),

    log(...partes) {
      const linha = `[${new Date().toISOString()}] ${partes.map(String).join(' ')}\n`;
      fs.appendFileSync(logPath, linha);
    },

    salvarEstado() {
      escreverJson(estadoPath, ctx.estado);
    },

    // Executa um comando e devolve stdout. Em dry-run só registra.
    async run(cmd, args = [], opts = {}) {
      ctx.log('$', cmd, resumoArgs(args));
      if (ctx.dryRun && !opts.sempre) return '';
      try {
        if (process.platform === 'win32') {
          const linha = [cmd, ...args].map(aspasWin).join(' ');
          const { stdout } = await execFileP('cmd.exe', ['/d', '/s', '/c', `"${linha}"`], {
            env: { ...process.env, ...opts.env }, windowsVerbatimArguments: true,
            maxBuffer: 50 * 1024 * 1024, timeout: opts.timeout ?? 15 * 60 * 1000, cwd: opts.cwd,
          });
          return (stdout || '').trim();
        }
        // opts.env soma ao ambiente; espalhado por último ele apagava o PATH inteiro (brew: ENOENT).
        const { env: extra, ...resto } = opts;
        const execucao = execFileP(cmd, args, {
          maxBuffer: 50 * 1024 * 1024,
          ...resto,
          timeout: opts.timeout ?? 15 * 60 * 1000,
          env: { ...process.env, HOME: ctx.homeReal, ...extra },
        });
        if (opts.input != null) execucao.child.stdin.end(opts.input);
        const { stdout } = await execucao;
        return (stdout || '').trim();
      } catch (e) {
        // Com ignorarErro a falha é esperada (app fechado, ainda sem login): vai como aviso, não como ERRO.
        ctx.log(opts.ignorarErro ? 'aviso' : 'ERRO', cmd, resumoArgs([e.message]));
        if (opts.ignorarErro) return '';
        throw e;
      }
    },

    // Trabalho adiantado em segundo plano (um download enquanto a pessoa faz um login, por exemplo).
    // Nunca derruba a instalação: quem precisa do resultado espera com `adiantado` e, se não deu certo,
    // faz do jeito normal. O resultado é true só quando o trabalho terminou sem erro.
    adiantar(chave, fn) {
      if (ctx.dryRun || ctx.semApps || adiantados.has(chave)) return;
      ctx.log('adiantando', chave);
      adiantados.set(chave, Promise.resolve().then(fn).then(
        () => { ctx.log('adiantado', chave); return true; },
        (e) => { ctx.log('aviso', 'adiantar', chave, resumoArgs([e.message])); return false; },
      ));
    },
    adiantado(chave) {
      return adiantados.get(chave) ?? Promise.resolve(false);
    },
    temAdiantado(chave) {
      return adiantados.has(chave);
    },

    // Executa mostrando a saída no terminal (pra instaladores interativos como Homebrew).
    runVisivel(cmd, args = [], opts = {}) {
      ctx.log('$ (visível)', cmd, resumoArgs(args));
      if (ctx.dryRun) return Promise.resolve(0);
      return new Promise((res, rej) => {
        const p = process.platform === 'win32'
          ? spawn('cmd.exe', ['/d', '/s', '/c', `"${[cmd, ...args].map(aspasWin).join(' ')}"`], { stdio: 'inherit', env: { ...process.env, ...opts.env }, windowsVerbatimArguments: true })
          : spawn(cmd, args, { stdio: 'inherit', env: { ...process.env, ...opts.env }, shell: opts.shell });
        opts.sinal?.addEventListener('abort', () => p.kill());
        p.on('exit', (c) => (c === 0 || opts.ignorarErro ? res(c) : rej(new Error(`${cmd} saiu com código ${c}`))));
        p.on('error', rej);
      });
    },

    async existeComando(nome) {
      try {
        if (process.platform === 'win32') await execFileP('where.exe', [nome], { env: process.env });
        else await execFileP('/bin/sh', ['-c', `command -v ${nome}`], { env: process.env });
        return true;
      } catch {
        return false;
      }
    },

    // Texto da pessoa que vai dentro de aspas em bash e cmd: tira o que quebraria o script.
    seguro(s, padrao = '') {
      return String(s || '').replace(/["'`$%&|<>^!\\]/g, ' ').replace(/\s+/g, ' ').trim() || padrao;
    },

    // Caminho com barras normais, que funciona em bash, cmd e PowerShell.
    posix(p) {
      return String(p).replace(/\\/g, '/');
    },

    // Pastas de dados por sistema (respeitam --home nos testes).
    appData() {
      if (ctx.win) return flags.home ? path.join(ctx.home, 'AppData', 'Roaming') : (process.env.APPDATA || path.join(ctx.home, 'AppData', 'Roaming'));
      return path.join(ctx.home, 'Library', 'Application Support');
    },
    localAppData() {
      if (ctx.win) return flags.home ? path.join(ctx.home, 'AppData', 'Local') : (process.env.LOCALAPPDATA || path.join(ctx.home, 'AppData', 'Local'));
      return path.join(ctx.home, 'Library', 'Application Support');
    },
    desktop() {
      return path.join(ctx.home, 'Desktop');
    },

    existe(p) {
      return fs.existsSync(p);
    },

    // Escreve arquivo criando pastas. Em dry-run só registra.
    escrever(p, conteudo) {
      ctx.log('escrever', p);
      if (ctx.dryRun) return;
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, typeof conteudo === 'string' ? conteudo : JSON.stringify(conteudo, null, 2) + '\n', 'utf8');
    },

    // Escreve só se não existir (nunca sobrescreve o que a pessoa editou).
    escreverSeFaltar(p, conteudo) {
      if (fs.existsSync(p)) {
        ctx.log('mantido (já existe)', p);
        return false;
      }
      ctx.escrever(p, conteudo);
      return true;
    },

    lerJson(p, padrao) {
      return lerJson(p, padrao);
    },

    // Faz merge raso+profundo de um objeto num JSON existente, sem perder chaves da pessoa.
    mesclarJson(p, patch) {
      const atual = lerJson(p, {});
      const novo = mesclar(atual, patch);
      ctx.escrever(p, novo);
      return novo;
    },

    template(nomeRel, vars = {}) {
      let txt = fs.readFileSync(path.join(ctx.templates, nomeRel), 'utf8');
      const todas = { ...ctx.resp, ...vars };
      return txt.replace(/\{\{(\w+)\}\}/g, (_, k) => (todas[k] ?? ''));
    },

    copiarTemplate(nomeRel, destino, vars = {}) {
      ctx.escrever(destino, ctx.template(nomeRel, vars));
    },

    async baixar(url, destino) {
      ctx.log('baixar', url, '->', destino);
      if (ctx.dryRun) return;
      const r = await fetch(url, { headers: { 'User-Agent': 'claude-setuper' }, redirect: 'follow' });
      if (!r.ok) throw new Error(`Falha ao baixar ${url}: ${r.status}`);
      fs.mkdirSync(path.dirname(destino), { recursive: true });
      fs.writeFileSync(destino, Buffer.from(await r.arrayBuffer()));
    },

    async baixarJson(url) {
      const r = await fetch(url, { headers: { 'User-Agent': 'claude-setuper', Accept: 'application/vnd.github+json' } });
      if (!r.ok) throw new Error(`Falha ao consultar ${url}: ${r.status}`);
      return r.json();
    },

    async abrirUrl(url) {
      ctx.log('abrir', url);
      if (ctx.dryRun) return;
      if (ctx.win) return ctx.run('cmd.exe', ['/c', 'start', '""', url.replace(/&/g, '^&')], { ignorarErro: true, timeout: 30000 });  // sem app pro link, o start pode ficar preso
      const cmd = ctx.plataforma === 'darwin' ? 'open' : 'xdg-open';
      await ctx.run(cmd, [url], { ignorarErro: true });
    },

    // Espera uma condição ficar verdadeira (polling), com limite em segundos.
    async esperar(cond, { intervalo = 3, limite = 600, semEncurtar = false } = {}) {
      if (ctx.dryRun) return true;
      // Só pra teste na VM, onde ninguém faz login: encurta as esperas (menos as que a VM consegue cumprir).
      if (process.env.CLAUDE_SETUPER_ESPERA_MAX && !semEncurtar) limite = Math.min(limite, Number(process.env.CLAUDE_SETUPER_ESPERA_MAX));
      const fim = Date.now() + limite * 1000;
      while (Date.now() < fim) {
        if (await cond()) return true;
        await new Promise((r) => setTimeout(r, intervalo * 1000));
      }
      return false;
    },
  };
  return ctx;
}

// Argumento gigante (um script inteiro passado pro bash -c) suja o registro: guarda só o começo.
function resumoArgs(args) {
  return args.map((a) => { a = String(a); return a.length > 200 ? `${a.slice(0, 120).replace(/\s+/g, ' ')}… (${a.length} caracteres)` : a; }).join(' ');
}

function aspasWin(a) {
  a = String(a);
  if (a === '""') return a;
  return /[\s&|<>^()"]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a;
}

function lerJson(p, padrao) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return padrao;
  }
}

function escreverJson(p, obj) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n');
}

export function mesclar(base, patch) {
  if (Array.isArray(base) && Array.isArray(patch)) {
    const out = [...base];
    for (const item of patch) {
      const chave = JSON.stringify(item);
      if (!out.some((x) => JSON.stringify(x) === chave)) out.push(item);
    }
    return out;
  }
  if (base && typeof base === 'object' && patch && typeof patch === 'object' && !Array.isArray(patch)) {
    const out = { ...base };
    for (const [k, v] of Object.entries(patch)) out[k] = k in out ? mesclar(out[k], v) : v;
    return out;
  }
  return patch;
}
