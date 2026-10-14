// Núcleo: CLAUDE.md, permissões, memória, hooks e skills do segundo cérebro.
import path from 'node:path';
import fs from 'node:fs';
import { ui } from '../ui.js';

export const id = 'nucleo';
export const nome = 'Núcleo do Claude';
export const descricao = 'Quem você é, como o Claude trabalha e as regras do segundo cérebro';
export const padrao = true;
export const obrigatorio = true;

const NIVEIS = {
  cauteloso: { defaultMode: 'default', allow: ['Read', 'Glob', 'Grep', 'LS', 'WebSearch'] },
  equilibrado: { defaultMode: 'acceptEdits', allow: ['Read', 'Edit', 'Write', 'MultiEdit', 'Glob', 'Grep', 'LS', 'WebSearch', 'WebFetch', 'Bash(git:*)', 'Bash(ls:*)', 'Bash(cat:*)', 'Bash(mkdir:*)', 'Bash(npm:*)', 'Bash(node:*)', 'Bash(python3:*)', 'Bash(open:*)', 'Bash(obsidian:*)'] },
  confiante: { defaultMode: 'auto', allow: ['Read', 'Edit', 'Write', 'MultiEdit', 'Glob', 'Grep', 'LS', 'Bash', 'WebSearch', 'WebFetch'] },
};
// Edit(...) cobre todas as ferramentas de edição de arquivo; Write(...) em deny gera aviso no Claude Code.
const DENY = ['Bash(rm -rf:*)', 'Bash(sudo rm:*)', 'Bash(git push --force:*)', 'Read(.env)', 'Read(.env.*)', 'Edit(.env)', 'Edit(.env.*)'];

export async function verificar(ctx) {
  const d = ctx.claudeDir;
  return [
    { item: 'CLAUDE.md global', ok: ctx.existe(path.join(d, 'CLAUDE.md')) },
    { item: 'settings.json', ok: ctx.existe(path.join(d, 'settings.json')) },
    { item: 'Hooks do segundo cérebro', ok: ctx.existe(path.join(d, 'hooks', 'cerebro-inicio.cjs')) },
    { item: 'Skills (/decisão, /retro...)', ok: ctx.existe(path.join(d, 'skills', 'retro', 'SKILL.md')) },
    { item: 'Pasta de memória', ok: ctx.existe(path.join(d, 'memoria', 'MEMORIA.md')) },
  ];
}

export async function instalar(ctx) {
  const d = ctx.claudeDir;
  const vault = ctx.resp.vault || path.join(ctx.home, 'Documents', 'Segundo Cérebro');
  ctx.resp.vault = vault;
  ctx.resp.data = new Date().toLocaleDateString('pt-BR');
  ctx.resp.comoAbrir = ctx.plataforma === 'darwin' ? 'pelo Maestri (o aplicativo com o canvas)' : 'pelo atalho "Claude" na sua Área de Trabalho';
  // Versão do "trabalho" segura pra ir dentro de aspas em bash e cmd.
  ctx.resp.trabalhoSeguro = String(ctx.resp.trabalho || '').replace(/["'`$%&|<>^!\\]/g, ' ').replace(/\s+/g, ' ').trim() || 'o meu trabalho do dia a dia';
  ctx.resp.autonomiaTexto = {
    cauteloso: 'Pergunte antes de qualquer ação que altere arquivos ou rode comandos. Prefira explicar o que vai fazer e esperar o ok.',
    equilibrado: 'Faça o básico sozinho (ler, escrever, organizar) e pergunte só no que for difícil de desfazer ou que mude a direção do trabalho.',
    confiante: 'Faça o trabalho inteiro sem pedir confirmação, e no fim conte o que fez, em linguagem simples.',
  }[ctx.resp.autonomia];

  await ui.tarefa('Ensinando o Claude quem você é', 'O Claude já sabe quem você é', async () => {
    const claudeMd = path.join(d, 'CLAUDE.md');
    if (ctx.existe(claudeMd) && !ctx.estado.modulos.nucleo?.ok) {
      // Já existia um CLAUDE.md da pessoa: preserva e acrescenta o bloco do Setuper.
      const atual = fs.readFileSync(claudeMd, 'utf8');
      if (!atual.includes('<!-- claude-setuper -->')) ctx.escrever(claudeMd, atual + '\n\n' + ctx.template('CLAUDE.md.tpl'));
    } else {
      ctx.escrever(claudeMd, ctx.template('CLAUDE.md.tpl'));
    }
  });

  await ui.tarefa('Configurando como o Claude trabalha', 'Permissões configuradas', async () => {
    const nivel = NIVEIS[ctx.resp.autonomia] || NIVEIS.equilibrado;
    ctx.mesclarJson(path.join(d, 'settings.json'), {
      permissions: { allow: nivel.allow, deny: DENY, defaultMode: nivel.defaultMode },
      hooks: {
        SessionStart: [{ hooks: [{ type: 'command', command: `node "${ctx.posix(path.join(d, 'hooks', 'cerebro-inicio.cjs'))}"`, timeout: 10 }] }],
        Stop: [{ hooks: [{ type: 'command', command: `node "${ctx.posix(path.join(d, 'hooks', 'cerebro-fim.cjs'))}"`, timeout: 10 }] }],
        PostToolUse: [{ matcher: 'Write|Edit', hooks: [{ type: 'command', command: `node "${ctx.posix(path.join(d, 'hooks', 'cerebro-nota.cjs'))}"`, timeout: 10 }] }],
      },
      env: { CLAUDE_SETUPER_VAULT: vault },
    });
    if (ctx.plataforma === 'darwin') {
      ctx.mesclarJson(path.join(d, 'settings.json'), {
        hooks: { Stop: [{ hooks: [{ type: 'command', command: `osascript -e 'display notification "Terminei, pode olhar." with title "Claude" sound name "Glass"'`, timeout: 5 }] }] },
      });
    }
  });

  await ui.tarefa('Montando a memória e os lembretes do Claude', 'Memória e lembretes prontos', async () => {
    for (const h of ['cerebro-inicio.cjs', 'cerebro-fim.cjs', 'cerebro-nota.cjs']) ctx.copiarTemplate(`hooks/${h}`, path.join(d, 'hooks', h));
    for (const s of ['decisao', 'padrao', 'feedback', 'descoberta', 'retro', 'lembrar']) ctx.copiarTemplate(`skills/${s}.md`, path.join(d, 'skills', s, 'SKILL.md'));
    ctx.escreverSeFaltar(path.join(d, 'memoria', 'MEMORIA.md'), ctx.template('memoria/MEMORIA.md'));
  });
}

export async function remover(ctx) {
  const d = ctx.claudeDir;
  // Tira só o bloco do Setuper do CLAUDE.md; se o arquivo era só nosso, apaga.
  const claudeMd = path.join(d, 'CLAUDE.md');
  if (fs.existsSync(claudeMd)) {
    const txt = fs.readFileSync(claudeMd, 'utf8');
    const i = txt.indexOf('<!-- claude-setuper -->');
    if (i === 0) fs.rmSync(claudeMd, { force: true });
    else if (i > 0) fs.writeFileSync(claudeMd, txt.slice(0, i).trimEnd() + '\n');
  }
  for (const h of ['cerebro-inicio.cjs', 'cerebro-fim.cjs', 'cerebro-nota.cjs', 'cerebro-inicio.js', 'cerebro-fim.js', 'cerebro-nota.js']) fs.rmSync(path.join(d, 'hooks', h), { force: true });
  for (const s of ['decisao', 'padrao', 'feedback', 'descoberta', 'retro', 'lembrar']) fs.rmSync(path.join(d, 'skills', s), { recursive: true, force: true });
}
