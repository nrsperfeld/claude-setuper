// Terminal invisível do app (app/terminal.js): o login do GitHub tem de terminar sozinho e o botão tem de abrir o login.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const carregar = () => import(pathToFileURL(path.join(__dirname, '..', 'app', 'terminal.js')).href);

// Imita o gh 2.103: dica com link do blog, pergunta (Y/n), meio segundo de rede, código e "Press Enter".
const GH_FALSO = `#!/bin/bash
echo "! Did you know that expiring tokens can be requested with --expiring? Read more at https://gh.io/gh-expiring-tokens"
printf "? Authenticate Git with your GitHub credentials? (Y/n) "
read -r a
sleep 0.5
echo "! First copy your one-time code: ABCD-1234"
printf "Press Enter to open https://github.com/login/device in your browser... "
read -r b
echo "Authentication complete."
`;

test('login do gh com internet rápida termina e só o link do login vira botão', { skip: process.platform !== 'darwin', timeout: 30000 }, async () => {
  const { criarTerminal } = await carregar();
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'setuper-terminal-'));
  const gh = path.join(pasta, 'gh');
  fs.writeFileSync(gh, GH_FALSO, { mode: 0o755 });
  const links = [];
  const codigos = [];
  const runVisivel = criarTerminal({ log() {}, logPath: path.join(pasta, 'registro.log') }, (ev) => {
    if (ev.tipo === 'link') links.push(ev.url);
    if (ev.tipo === 'codigo') codigos.push(ev.codigo);
  });
  const parar = new AbortController();
  const travou = setTimeout(() => parar.abort(), 20000);
  const codigo = await runVisivel(gh, ['auth', 'login'], { ignorarErro: true, sinal: parar.signal, link: /^https:\/\/github\.com\/login\/device/ });
  clearTimeout(travou);
  assert.ok(!parar.signal.aborted, 'o "Press Enter" ficou sem resposta');
  assert.strictEqual(codigo, 0);
  assert.deepStrictEqual(links, ['https://github.com/login/device']);
  assert.deepStrictEqual(codigos, ['ABCD-1234']);
  fs.rmSync(pasta, { recursive: true, force: true });
});

// Imita o `claude auth login` 2.1: link, "Paste code here if prompted >" e espera o código pela entrada.
const CLAUDE_FALSO = `#!/bin/bash
echo "Opening browser to sign in…"
echo "If the browser didn't open, visit: https://claude.com/cai/oauth/authorize?code=true&state=abc"
printf "Paste code here if prompted > "
read -r codigo
[ "$codigo" = "BOM123456#estado" ] && echo "Login successful." && exit 0
echo "Login failed: That code wasn't accepted."
exit 1
`;

test('login do Claude: o código colado na tela chega no programa, que termina sozinho', { skip: process.platform !== 'darwin', timeout: 30000 }, async () => {
  const { criarTerminal } = await carregar();
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'setuper-terminal-'));
  const claude = path.join(pasta, 'claude');
  fs.writeFileSync(claude, CLAUDE_FALSO, { mode: 0o755 });
  const runVisivel = criarTerminal({ log() {}, logPath: path.join(pasta, 'registro.log') }, () => {});
  const parar = new AbortController();
  const travou = setTimeout(() => parar.abort(), 20000);
  const codigo = await runVisivel(claude, ['auth', 'login'], { ignorarErro: true, sinal: parar.signal, aoIniciar: (escrever) => setTimeout(() => escrever('BOM123456#estado'), 1500) });
  clearTimeout(travou);
  assert.ok(!parar.signal.aborted, 'o código não chegou no login');
  assert.strictEqual(codigo, 0);
  fs.rmSync(pasta, { recursive: true, force: true });
});
