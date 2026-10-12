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

  const ctx = {
    raiz: RAIZ,
    templates: path.join(RAIZ, 'templates'),
    home,
    homeReal: os.homedir(),
    plataforma: process.platform, // 'darwin' | 'linux' | 'win32'
    dryRun: !!flags.dryRun,
    semApps: !!flags.semApps, // não instala aplicativos (só escreve arquivos). Usado em testes.
    sim: !!flags.sim, // aceita todos os defaults sem perguntar
    assistido: !!flags.assistido,
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
      ctx.log('$', cmd, args.join(' '));
      if (ctx.dryRun && !opts.sempre) return '';
      try {
        const { stdout } = await execFileP(cmd, args, {
          env: { ...process.env, HOME: ctx.homeReal, ...opts.env },
          maxBuffer: 50 * 1024 * 1024,
          timeout: opts.timeout ?? 15 * 60 * 1000,
          ...opts,
        });
        return (stdout || '').trim();
      } catch (e) {
        ctx.log('ERRO', cmd, e.message);
        if (opts.ignorarErro) return '';
        throw e;
      }
    },

    // Executa mostrando a saída no terminal (pra instaladores interativos como Homebrew).
    runVisivel(cmd, args = [], opts = {}) {
      ctx.log('$ (visível)', cmd, args.join(' '));
      if (ctx.dryRun) return Promise.resolve(0);
      return new Promise((res, rej) => {
        const p = spawn(cmd, args, { stdio: 'inherit', env: { ...process.env, ...opts.env }, shell: opts.shell });
        p.on('exit', (c) => (c === 0 || opts.ignorarErro ? res(c) : rej(new Error(`${cmd} saiu com código ${c}`))));
        p.on('error', rej);
      });
    },

    async existeComando(nome) {
      try {
        await execFileP('/bin/sh', ['-c', `command -v ${nome}`], { env: process.env });
        return true;
      } catch {
        return false;
      }
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
      const cmd = ctx.plataforma === 'darwin' ? 'open' : 'xdg-open';
      await ctx.run(cmd, [url], { ignorarErro: true });
    },

    // Espera uma condição ficar verdadeira (polling), com limite em segundos.
    async esperar(cond, { intervalo = 3, limite = 600 } = {}) {
      if (ctx.dryRun) return true;
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
