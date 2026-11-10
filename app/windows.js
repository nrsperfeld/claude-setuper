// O que só existe no Windows, em funções que recebem o ambiente: assim dá pra testar a partir do Mac.
// Tudo aqui usa path.win32, porque o caminho é do Windows mesmo quando o teste roda em outro sistema.
import path from 'node:path';

const w = path.win32;

// O nome que o build-win.sh gera e que a atualização de dentro do app baixa dos releases.
export const INSTALADOR = 'Claude-Setuper-windows-x64.exe';

// Aberto pelo menu Iniciar, o app só herda o PATH do Explorer, que pode ser anterior ao que acabou de instalar.
export function pathDoWindows(env) {
  const extras = [
    w.join(env.ProgramFiles || 'C:\\Program Files', 'nodejs'),
    w.join(env.ProgramFiles || 'C:\\Program Files', 'Git', 'cmd'),
    w.join(env.ProgramFiles || 'C:\\Program Files', 'Git', 'bin'),
    w.join(env.ProgramFiles || 'C:\\Program Files', 'GitHub CLI'),
    env.APPDATA && w.join(env.APPDATA, 'npm'),
    env.USERPROFILE && w.join(env.USERPROFILE, '.local', 'bin'),
    env.LOCALAPPDATA && w.join(env.LOCALAPPDATA, 'Microsoft', 'WinGet', 'Links'),
  ].filter(Boolean);
  const atuais = (env.PATH || env.Path || '').split(';').filter(Boolean);
  const vistos = new Set();
  return [...atuais, ...extras].filter((p) => { const c = p.toLowerCase(); if (vistos.has(c)) return false; vistos.add(c); return true; }).join(';');
}

// Os programas que o guia mostra, com onde o instalador de cada um costuma deixar o executável.
export function programasWindows(env, t) {
  const pf = env.ProgramFiles || 'C:\\Program Files';
  const pf86 = env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
  const local = env.LOCALAPPDATA || '';
  return {
    chrome: {
      nome: () => 'Google Chrome', dono: /^chrome$/i,
      caminhos: [w.join(pf, 'Google', 'Chrome', 'Application', 'chrome.exe'), w.join(pf86, 'Google', 'Chrome', 'Application', 'chrome.exe'), w.join(local, 'Google', 'Chrome', 'Application', 'chrome.exe')],
    },
    obsidian: {
      nome: () => 'Obsidian', dono: /^obsidian$/i,
      caminhos: [w.join(local, 'Programs', 'Obsidian', 'Obsidian.exe'), w.join(local, 'Obsidian', 'Obsidian.exe'), w.join(pf, 'Obsidian', 'Obsidian.exe')],
    },
    // No Windows a conversa fica na janela preta aberta pelo atalho, que não tem ícone próprio: o guia usa o nosso.
    ia: { nome: () => t('Janela da IA'), proprio: true, dono: /^(WindowsTerminal|OpenConsole|conhost|cmd)$/i },
  };
}

// O dono da janela no Windows é o nome do processo, e o nome do navegador padrão vem como "Google Chrome".
export function donoDoExecutavel(caminho) {
  const nome = w.basename(caminho || '', '.exe').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return nome ? new RegExp(`^${nome}$`, 'i') : null;
}

// Só com variável de ambiente e letras comuns: o cmd lê o arquivo fora de UTF-8, e o nome da pasta do usuário pode ter acento.
export function comandoDoSetuper() {
  return '@echo off\r\nnode "%USERPROFILE%\\Claude Setuper\\app\\bin\\claude-setuper.js" %*\r\n';
}

// Argumento pro cmd.exe, com a mesma regra do ctx.run: pode ter espaço, acento e símbolo.
export function aspasCmd(a) {
  a = String(a);
  if (a === '""') return a;
  return /[\s&|<>^()"]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a;
}
export const linhaCmd = (cmd, args = []) => `"${[cmd, ...args].map(aspasCmd).join(' ')}"`;
