// Sentinela: uma vez por semana, com o computador parado e o Claude fechado, atualiza as ferramentas que o
// Setuper instalou (Homebrew/winget, Vercel, Claude Code) e confere se continuam funcionando.
// Fica em silêncio quando está tudo bem; só aparece pra pessoa se alguma coisa parou de funcionar.
import path from 'node:path';
import fs from 'node:fs';
import { ui } from '../ui.js';

export const id = 'sentinela';
export const nome = 'Manter tudo atualizado';
export const nomeCurto = 'Manter atualizado';
export const descricao = 'Uma vez por semana atualiza as ferramentas do Claude e confere se continuam funcionando';
export const padrao = true;
export const obrigatorio = true;
export const plataformas = ['darwin', 'win32'];

const ROTULO = 'com.claude-setuper.manter-atualizado';
const pasta = (ctx) => path.join(ctx.pastaSetuper, 'sentinela');
const script = (ctx) => path.join(pasta(ctx), ctx.win ? 'manter-atualizado.ps1' : 'manter-atualizado.sh');
const plist = (ctx) => path.join(ctx.home, 'Library', 'LaunchAgents', `${ROTULO}.plist`);

export async function verificar(ctx) {
  let agendado = ctx.existe(script(ctx));
  if (agendado && !ctx.dryRun) {
    agendado = ctx.win
      ? !!(await ctx.run('schtasks', ['/Query', '/TN', 'Claude Setuper\\manter-atualizado'], { ignorarErro: true, sempre: true }))
      : !!(await ctx.run('launchctl', ['list', ROTULO], { ignorarErro: true, sempre: true }));
  }
  return [{ item: 'Atualização semanal das ferramentas', ok: agendado, dica: ctx.app ? 'Clique em "Tentar resolver o que falta".' : 'rode: claude-setuper' }];
}

export async function instalar(ctx) {
  await ui.tarefa('Agendando a atualização semanal das ferramentas', 'Atualização semanal agendada', async () => {
    if (ctx.win) {
      // O PowerShell 5 do Windows lê arquivo sem BOM como ANSI e quebra os acentos.
      ctx.escrever(script(ctx), '\ufeff' + ctx.template('sentinela/manter-atualizado.ps1'));
      if (ctx.dryRun || ctx.semApps) return;
      // Register-ScheduledTask deixa rodar escondido, na bateria e quando o computador ligar depois do horário.
      const registrar = path.join(pasta(ctx), 'agendar.ps1');
      const aspas = (s) => s.replace(/'/g, "''");
      ctx.escrever(registrar, '\ufeff' + [
        `$a = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "${aspas(script(ctx))}"'`,
        '$t = New-ScheduledTaskTrigger -Daily -At 13:00',
        '$s = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Hours 2)',
        "Register-ScheduledTask -TaskName 'manter-atualizado' -TaskPath '\\Claude Setuper\\' -Action $a -Trigger $t -Settings $s -Force | Out-Null",
      ].join('\r\n') + '\r\n');
      await ctx.run('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', registrar], { ignorarErro: true });
      return;
    }
    ctx.copiarTemplate('sentinela/manter-atualizado.sh', script(ctx));
    if (!ctx.dryRun) fs.chmodSync(script(ctx), 0o755);
    // launchd roda na hora marcada ou, se o Mac estava dormindo, assim que ele acordar.
    ctx.escrever(plist(ctx), ctx.template('rotinas/launchd.plist', { id: 'manter-atualizado', script: script(ctx), hora: 13, logs: pasta(ctx), comDia: '' }));
    if (ctx.dryRun || ctx.semApps) return;
    await ctx.run('launchctl', ['unload', plist(ctx)], { ignorarErro: true });
    await ctx.run('launchctl', ['load', plist(ctx)], { ignorarErro: true });
  });
}

export async function remover(ctx) {
  if (ctx.win) await ctx.run('schtasks', ['/Delete', '/F', '/TN', 'Claude Setuper\\manter-atualizado'], { ignorarErro: true });
  else {
    await ctx.run('launchctl', ['unload', plist(ctx)], { ignorarErro: true });
    fs.rmSync(plist(ctx), { force: true });
  }
  fs.rmSync(pasta(ctx), { recursive: true, force: true });
}
