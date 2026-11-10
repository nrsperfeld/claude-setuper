// Rotinas: revisão semanal do segundo cérebro, leitura diária da pasta de entrada e backup diário das notas,
// sem a pessoa lembrar de nada. Os pedidos pro Claude ficam em arquivos (prompt-*.md) ao lado dos scripts:
// no Windows uma linha de comando comprida demais não cabe no cmd.
import path from 'node:path';
import fs from 'node:fs';
import { ui } from '../ui.js';

export const id = 'rotinas';
export const nome = 'Rotinas automáticas';
export const nomeCurto = 'Rotinas';
export const descricao = 'Revisão semanal do cérebro, leitura do que você deixar na pasta de entrada e backup diário das notas';
export const padrao = true;
export const plataformas = ['darwin', 'linux', 'win32'];

const ROTINAS = [
  { id: 'revisao-semanal', nome: 'Revisão semanal do cérebro', script: 'revisao-semanal', cron: { dia: 1, hora: 9 } },
  { id: 'ingest-diario', nome: 'Leitura diária da pasta de entrada', script: 'ingest-diario', cron: { hora: 12 } },
  { id: 'backup-diario', nome: 'Backup diário das notas', script: 'backup-diario', cron: { hora: 21 } },
];
const PROMPTS = ['prompt-revisao.md', 'prompt-ingest.md'];
const ext = (ctx) => (ctx.win ? '.cmd' : '.sh');
// O nome do cofre vem da pessoa: entra nos scripts escapado pra cada formato, nunca como código.
// .sh: dentro de aspas duplas. .cmd: dentro de set "X=...", onde só o % expande. .plist: XML.
const escaparSh = (s) => String(s).replace(/[\\$`"]/g, '\\$&');
const escaparCmd = (s) => String(s).replace(/%/g, '%%');
const escaparXml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function dirLaunch(ctx) {
  return path.join(ctx.home, 'Library', 'LaunchAgents');
}

export async function verificar(ctx) {
  return ROTINAS.map((r) => ({
    item: r.nome,
    ok: ctx.plataforma === 'darwin' ? ctx.existe(path.join(dirLaunch(ctx), `com.claude-setuper.${r.id}.plist`)) : ctx.existe(path.join(ctx.pastaSetuper, 'rotinas', r.script + ext(ctx))),
  }));
}

export async function instalar(ctx) {
  const vault = ctx.resp.vault || ctx.estado.respostas?.vault;
  if (!vault) return ui.info('Sem segundo cérebro não há o que revisar nem o que guardar. Pulei as rotinas.');
  const dir = path.join(ctx.pastaSetuper, 'rotinas');
  await ui.tarefa('Agendando a revisão semanal, a leitura diária e o backup', 'Rotinas agendadas', async () => {
    for (const p of PROMPTS) ctx.copiarTemplate(`rotinas/${p}`, path.join(dir, p), { vault });
    for (const r of ROTINAS) {
      const script = path.join(dir, r.script + ext(ctx));
      const esc = ctx.win ? escaparCmd : escaparSh;
      let txt = ctx.template(`rotinas/${r.script}${ext(ctx)}`, { vault: esc(vault), logs: esc(dir), hoje: '' });
      // O cmd se perde nos rótulos (call :mover) quando o arquivo tem só LF no fim das linhas.
      if (ctx.win) txt = txt.replace(/\r?\n/g, '\r\n');
      ctx.escrever(script, txt);
      if (!ctx.dryRun && !ctx.win) fs.chmodSync(script, 0o755);
      if (ctx.win) {
        if (ctx.dryRun || ctx.semApps) continue;
        const hora = String(r.cron.hora).padStart(2, '0') + ':00';
        const args = ['/Create', '/F', '/TN', `Claude Setuper\\${r.id}`, '/TR', `"${script}"`, '/ST', hora];
        if (r.cron.dia != null) args.push('/SC', 'WEEKLY', '/D', 'MON');
        else args.push('/SC', 'DAILY');
        await ctx.run('schtasks', args, { ignorarErro: true });
      } else if (ctx.plataforma === 'darwin') {
        const plist = path.join(dirLaunch(ctx), `com.claude-setuper.${r.id}.plist`);
        ctx.escrever(plist, ctx.template('rotinas/launchd.plist', { id: r.id, script: escaparXml(script), dia: r.cron.dia ?? '', hora: r.cron.hora, logs: escaparXml(dir), comDia: r.cron.dia != null ? `<key>Weekday</key><integer>${r.cron.dia}</integer>` : '' }));
        if (!ctx.dryRun && !ctx.semApps) {
          await ctx.run('launchctl', ['unload', plist], { ignorarErro: true });
          await ctx.run('launchctl', ['load', plist], { ignorarErro: true });
        }
      } else if (!ctx.dryRun && !ctx.semApps) {
        const atual = await ctx.run('/bin/sh', ['-c', 'crontab -l 2>/dev/null'], { ignorarErro: true });
        const linha = r.cron.dia != null ? `0 ${r.cron.hora} * * ${r.cron.dia} "${script}"` : `0 ${r.cron.hora} * * * "${script}"`;
        if (!atual.includes(script)) await ctx.run('/bin/sh', ['-c', `(crontab -l 2>/dev/null; echo '${linha} # claude-setuper') | crontab -`], { ignorarErro: true });
      }
    }
  });

  // Backup remoto, se o GitHub estiver ligado.
  if (ctx.semApps || ctx.dryRun) return;
  if (!(await ctx.existeComando('gh'))) return;
  const status = await ctx.run('gh', ['auth', 'status'], { ignorarErro: true, sempre: true });
  if (!/Logged in/i.test(status)) return;
  // O cofre pode ter git só no computador (histórico local, criado junto com a wiki): backup no GitHub é ter um remoto.
  if (await ctx.run('git', ['-C', vault, 'remote', 'get-url', 'origin'], { ignorarErro: true, sempre: true })) return ui.ok('Suas notas já têm backup no GitHub');
  const quer = ctx.sim ? true : await ui.confirmar('Quer que as suas notas tenham backup automático no GitHub, num repositório privado só seu?', true);
  if (!quer) return;
  await ui.tarefa('Criando o backup privado das notas no GitHub', 'Backup no GitHub ligado', async () => {
    if (!ctx.existe(path.join(vault, '.git'))) await ctx.run('git', ['init', '-q'], { cwd: vault });
    ctx.escreverSeFaltar(path.join(vault, '.gitignore'), GITIGNORE);
    await ctx.run('git', ['add', '-A'], { cwd: vault });
    await ctx.run('git', ['-c', 'user.name=Claude Setuper', '-c', 'user.email=setuper@localhost', 'commit', '-q', '-m', 'Primeiro backup do segundo cérebro'], { cwd: vault, ignorarErro: true });
    await ctx.run('gh', ['repo', 'create', ctx.pasta('segundo-cerebro'), '--private', '--source', vault, '--push'], { cwd: vault, ignorarErro: true });
  });
}

export const GITIGNORE = '.obsidian/workspace*.json\n.obsidian/plugins/*/data.json\n.DS_Store\n.trash/\n';

export async function remover(ctx) {
  fs.rmSync(path.join(ctx.pastaSetuper, 'rotinas'), { recursive: true, force: true });
  for (const r of ROTINAS) {
    if (ctx.win) {
      await ctx.run('schtasks', ['/Delete', '/F', '/TN', `Claude Setuper\\${r.id}`], { ignorarErro: true });
    } else if (ctx.plataforma === 'darwin') {
      const plist = path.join(dirLaunch(ctx), `com.claude-setuper.${r.id}.plist`);
      await ctx.run('launchctl', ['unload', plist], { ignorarErro: true });
      fs.rmSync(plist, { force: true });
    } else {
      await ctx.run('/bin/sh', ['-c', `crontab -l 2>/dev/null | grep -v claude-setuper | crontab -`], { ignorarErro: true });
    }
  }
}
