// Terminal invisível: no app não existe Terminal, mas alguns programas precisam de um (logins do Claude,
// GitHub e Vercel, instalador do Homebrew). Rodamos eles dentro do pty.sh, lemos o que imprimem e
// levamos pra tela o que importa pra pessoa: o link, o código e as perguntas de "aperte Enter".
// No Windows não existe o script do macOS: os mesmos programas rodam com a saída num cano, sem janela preta.
// O gh e o Claude aceitam isso nos logins (ver docs/windows-estado.md para o que só um PC físico confirma).
import { spawn, execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { linhaCmd } from './windows.js';

const PTY = path.join(path.dirname(fileURLToPath(import.meta.url)), 'pty.sh');
const ANSI = /\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b[=>()][0-9A-Za-z]?|\r/g;
const LINK = /https?:\/\/[^\s"'<>)\]]+/g;
const CODIGO = /\b([A-Z0-9]{4}-[A-Z0-9]{4})\b/g;
const ENTER = /press (?:\[?enter\]?|return)|\(y\/n\)|\[y\/n\]/i;

// Como rodar, em cada sistema. Exportado pra testar a linha do Windows sem precisar de um Windows.
export function comoRodar(plataforma, cmd, args, env) {
  if (plataforma === 'win32') return { arquivo: 'cmd.exe', args: ['/d', '/s', '/c', linhaCmd(cmd, args)], opcoes: { env, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true, windowsVerbatimArguments: true } };
  return { arquivo: PTY, args: [cmd, ...args], opcoes: { env: { ...env, TERM: 'xterm-256color' }, stdio: ['pipe', 'pipe', 'pipe'] } };
}
// Parar no Windows é parar a árvore: matar só o cmd.exe deixaria o login do gh rodando escondido.
function parar(p) {
  if (process.platform === 'win32') execFile('taskkill', ['/PID', String(p.pid), '/T', '/F'], { windowsHide: true }, () => {});
  else p.kill();
}

export function criarTerminal(ctx, enviar) {
  return function runVisivel(cmd, args = [], opts = {}) {
    ctx.log('$ (terminal do app)', cmd, args.join(' ').slice(0, 200));
    if (ctx.dryRun) return Promise.resolve(0);
    // Só nos logins o link e o código interessam; o Homebrew também imprime links, mas de documentação.
    // O próprio login pode imprimir link de leitura (o gh 2.103 abre com um "Read more" que cai no blog),
    // então quem chama diz em opts.link qual é o link do login, e só ele vira botão.
    const login = args.includes('login');
    return new Promise((res, rej) => {
      const como = comoRodar(process.platform, cmd, args, { ...process.env, ...opts.env });
      const p = spawn(como.arquivo, como.args, como.opcoes);
      const vistos = new Set();
      let recente = '';
      let desdeEnter = ''; // o que o programa imprimiu depois do último Enter que mandamos
      let enterNaFila = false;
      const ler = (buf) => {
        const texto = buf.toString().replace(ANSI, '');
        fs.appendFile(ctx.logPath, texto, () => {});
        enviar({ tipo: 'saida', texto });
        recente = (recente + texto).slice(-3000);
        if (login) {
          for (const m of recente.matchAll(LINK)) {
            const url = m[0].replace(/[.,;:]+$/, '');
            if (!vistos.has(url)) { vistos.add(url); if (!opts.link || opts.link.test(url)) enviar({ tipo: 'link', url }); }
          }
          for (const m of recente.matchAll(CODIGO)) {
            if (!vistos.has(m[1])) { vistos.add(m[1]); enviar({ tipo: 'codigo', codigo: m[1] }); }
          }
        }
        // "Press Enter to open github.com" e as perguntas (Y/n) do gh: o padrão é sempre o certo.
        // Espera uns segundos pra pessoa ver o código antes do navegador abrir por cima.
        // Um Enter por pergunta, contando só o que veio depois do anterior. Antes era um a cada 4 s, e com
        // internet rápida o "Press Enter" do gh chegava menos de 4 s depois do (Y/n) e ficava sem resposta.
        desdeEnter = (desdeEnter + texto).slice(-500);
        if (!enterNaFila && ENTER.test(desdeEnter)) {
          enterNaFila = true;
          setTimeout(() => { enterNaFila = false; desdeEnter = ''; if (p.stdin.writable) p.stdin.write(process.platform === 'win32' ? '\r\n' : '\r'); }, 3000);
        }
      };
      opts.sinal?.addEventListener('abort', () => parar(p));
      p.stdout.on('data', ler);
      p.stderr.on('data', ler);
      p.on('exit', (c) => (c === 0 || opts.ignorarErro ? res(c) : rej(new Error(`${cmd} saiu com código ${c}`))));
      p.on('error', rej);
    });
  };
}
