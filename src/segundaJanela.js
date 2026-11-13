// A segunda janela do primeiro dia: quando a IA abre pela primeira vez e se apresenta, uma outra janela de terminal
// roda `claude-setuper verificar` (src/verificar.js), que confere tudo e instala o que estiver faltando.
// Quem dispara é o mesmo script que manda a apresentação (abrir-claude.sh no Maestri, o atalho "Claude" no Windows
// e no Linux), então acontece uma vez só. Depois disso, a conferência continua existindo como comando.
import fs from 'node:fs';
import path from 'node:path';

// Enquanto a instalação roda, existe este arquivo com o número do processo. A segunda janela espera ele sumir:
// no app, o Maestri abre a IA antes de a instalação terminar de deixar o comando claude-setuper no lugar.
const arqTrava = (ctx) => path.join(ctx.pastaSetuper, '.instalando');

export function travar(ctx) {
  if (!ctx.dryRun) { try { fs.writeFileSync(arqTrava(ctx), String(process.pid)); } catch {} }
  return () => soltar(ctx);
}
export function soltar(ctx) {
  try { fs.rmSync(arqTrava(ctx), { force: true }); } catch {}
}

export function caminhoDaConferencia(ctx) {
  return path.join(ctx.pastaSetuper, ctx.win ? 'verificar.cmd' : ctx.plataforma === 'darwin' ? 'verificar.command' : 'verificar.sh');
}

// Onde o comando vai estar quando a janela abrir. O app copia o Setuper pra ~/Claude Setuper/app no fim da
// instalação (instalarComando, em app/main.js); pelo Terminal, é de onde este código já está rodando
// (o install.sh e o install.ps1 também baixam em ~/Claude Setuper/app).
function comandoDoSetuper(ctx) {
  return path.join(ctx.app ? path.join(ctx.pastaSetuper, 'app') : ctx.raiz, 'bin', 'claude-setuper.js');
}

// Escreve o script da conferência e devolve o caminho dele, pra entrar no script que abre a IA.
export function escreverConferencia(ctx) {
  const arquivo = caminhoDaConferencia(ctx);
  const texto = ctx.template(ctx.win ? 'verificar/verificar.cmd' : 'verificar/verificar.sh', {
    conferencia: arquivo, setuperBin: comandoDoSetuper(ctx), trava: arqTrava(ctx),
    // Só nos testes: a casa de mentira vale pra conferência também.
    opcoes: ctx.home !== ctx.homeReal ? ` --home "${ctx.home}"` : '',
  });
  // O cmd se perde nos rótulos (goto) quando o arquivo tem só LF no fim das linhas.
  ctx.escrever(arquivo, ctx.win ? texto.replace(/\r?\n/g, '\r\n') : texto);
  if (!ctx.dryRun && !ctx.win) fs.chmodSync(arquivo, 0o755);
  return arquivo;
}
