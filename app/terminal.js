// Terminal invisível: no app não existe Terminal, mas alguns programas precisam de um (logins do Claude,
// GitHub e Vercel, instalador do Homebrew). Rodamos eles dentro do pty.sh, lemos o que imprimem e
// levamos pra tela o que importa pra pessoa: o link, o código e as perguntas de "aperte Enter".
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PTY = path.join(path.dirname(fileURLToPath(import.meta.url)), 'pty.sh');
const ANSI = /\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b[=>()][0-9A-Za-z]?|\r/g;
const LINK = /https?:\/\/[^\s"'<>)\]]+/g;
const CODIGO = /\b([A-Z0-9]{4}-[A-Z0-9]{4})\b/g;
const ENTER = /press (?:\[?enter\]?|return)|\(y\/n\)|\[y\/n\]/i;

export function criarTerminal(ctx, enviar) {
  return function runVisivel(cmd, args = [], opts = {}) {
    ctx.log('$ (terminal do app)', cmd, args.join(' ').slice(0, 200));
    if (ctx.dryRun) return Promise.resolve(0);
    // Só nos logins o link e o código interessam; o Homebrew também imprime links, mas de documentação.
    const login = args.includes('login');
    return new Promise((res, rej) => {
      const p = spawn(PTY, [cmd, ...args], { env: { ...process.env, TERM: 'xterm-256color', ...opts.env }, stdio: ['pipe', 'pipe', 'pipe'] });
      const vistos = new Set();
      let recente = '';
      let ultimoEnter = 0;
      const ler = (buf) => {
        const texto = buf.toString().replace(ANSI, '');
        fs.appendFile(ctx.logPath, texto, () => {});
        enviar({ tipo: 'saida', texto });
        recente = (recente + texto).slice(-3000);
        if (login) {
          for (const m of recente.matchAll(LINK)) {
            const url = m[0].replace(/[.,;:]+$/, '');
            if (!vistos.has(url)) { vistos.add(url); enviar({ tipo: 'link', url }); }
          }
          for (const m of recente.matchAll(CODIGO)) {
            if (!vistos.has(m[1])) { vistos.add(m[1]); enviar({ tipo: 'codigo', codigo: m[1] }); }
          }
        }
        // "Press Enter to open github.com" e as perguntas (Y/n) do gh: o padrão é sempre o certo.
        // Espera uns segundos pra pessoa ver o código antes do navegador abrir por cima.
        if (ENTER.test(texto) && Date.now() - ultimoEnter > 4000) {
          ultimoEnter = Date.now();
          setTimeout(() => p.stdin.writable && p.stdin.write('\r'), 3000);
        }
      };
      p.stdout.on('data', ler);
      p.stderr.on('data', ler);
      p.on('exit', (c) => (c === 0 || opts.ignorarErro ? res(c) : rej(new Error(`${cmd} saiu com código ${c}`))));
      p.on('error', rej);
    });
  };
}
