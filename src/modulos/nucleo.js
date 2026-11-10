// Núcleo: CLAUDE.md, permissões, memória, hooks e skills do segundo cérebro.
import path from 'node:path';
import fs from 'node:fs';
import { ui } from '../ui.js';
import { t } from '../i18n.js';
import { perfil, NIVEL_TEC, NIVEL_IA, IA_ANTIGA, MENOR_DE_IDADE, ehMenor } from '../perfis.js';
import { montarWiki, verificarWiki, removerTrava } from './wiki.js';
import { chaveDaApi } from '../cuidados.js';
import { copiarCofre } from '../presente.js';

export const id = 'nucleo';
export const nome = 'Núcleo da IA';
export const nomeCurto = 'Configurar a IA';
export const descricao = 'Quem você é, como a IA trabalha e as regras do segundo cérebro';
export const padrao = true;
export const obrigatorio = true;

const NIVEIS = {
  cauteloso: { defaultMode: 'default', allow: ['Read', 'Glob', 'Grep', 'LS', 'WebSearch'] },
  equilibrado: { defaultMode: 'acceptEdits', allow: ['Read', 'Edit', 'Write', 'MultiEdit', 'Glob', 'Grep', 'LS', 'WebSearch', 'WebFetch', 'Bash(git:*)', 'Bash(ls:*)', 'Bash(cat:*)', 'Bash(mkdir:*)', 'Bash(npm:*)', 'Bash(node:*)', 'Bash(python3:*)', 'Bash(open:*)', 'Bash(obsidian:*)'] },
  confiante: { defaultMode: 'auto', allow: ['Read', 'Edit', 'Write', 'MultiEdit', 'Glob', 'Grep', 'LS', 'Bash', 'WebSearch', 'WebFetch'] },
  // As regras de DENY continuam valendo mesmo nesse modo.
  livre: { defaultMode: 'bypassPermissions', allow: ['Read', 'Edit', 'Write', 'MultiEdit', 'Glob', 'Grep', 'LS', 'Bash', 'WebSearch', 'WebFetch'], extra: { skipDangerousModePermissionPrompt: true } },
};
// Edit(...) cobre todas as ferramentas de edição de arquivo; Write(...) em deny gera aviso no Claude Code.
// AskUserQuestion fica de fora: a caixinha de múltipla escolha deixa a entrevista rasa. Pergunta em texto aprofunda.
const HOOKS = ['cerebro-inicio.cjs', 'cerebro-fim.cjs', 'cerebro-nota.cjs', 'cerebro-trava.cjs', 'ativacao.cjs', 'aula.cjs'];
const SKILLS = ['decisao', 'padrao', 'feedback', 'descoberta', 'retro', 'lembrar', 'guardar'];
const INICIO = '<!-- claude-setuper -->';
const FIM = '<!-- /claude-setuper -->';
const DENY = ['AskUserQuestion', 'Bash(rm -rf:*)', 'Bash(sudo rm:*)', 'Bash(git push --force:*)', 'Read(.env)', 'Read(.env.*)', 'Edit(.env)', 'Edit(.env.*)'];

export async function verificar(ctx) {
  const d = ctx.claudeDir;
  return [
    { item: 'CLAUDE.md global', ok: ctx.existe(path.join(d, 'CLAUDE.md')) },
    { item: 'settings.json', ok: ctx.existe(path.join(d, 'settings.json')) },
    { item: 'Hooks do segundo cérebro', ok: ctx.existe(path.join(d, 'hooks', 'cerebro-inicio.cjs')) },
    { item: 'Skills (/decisão, /retro...)', ok: ctx.existe(path.join(d, 'skills', 'retro', 'SKILL.md')) },
    { item: 'Pasta de memória', ok: ctx.existe(path.join(d, 'memoria', 'MEMORIA.md')) },
    { item: 'Primeira semana guiada', ok: ctx.existe(path.join(d, 'hooks', 'ativacao.cjs')) && ctx.existe(path.join(d, 'setuper-ativacao.json')) },
    { item: 'Trava das notas que são suas', ok: ctx.existe(path.join(d, 'hooks', 'cerebro-trava.cjs')) },
    ...(comCofre(ctx) ? verificarWiki(ctx, ctx.estado.respostas.vault) : []),
  ];
}

// O cofre já foi montado numa instalação anterior (a wiki entra nele pelo núcleo, sem reabrir o Obsidian).
function comCofre(ctx) {
  const r = ctx.estado.respostas || {};
  return (r.modulos || []).includes('obsidian') && !!r.vault && ctx.existe(path.join(r.vault, 'CLAUDE', ctx.pasta('projetos')));
}

export async function instalar(ctx) {
  const d = ctx.claudeDir;
  const vault = ctx.resp.vault || path.join(ctx.home, 'Documents', ctx.pasta('Segundo Cérebro'));
  ctx.resp.vault = vault;
  ctx.resp.data = new Date().toLocaleDateString(ctx.idioma === 'en' ? 'en-US' : 'pt-BR');
  ctx.resp.comoAbrir = t(ctx.plataforma === 'darwin' ? 'pelo Maestri (o aplicativo com o canvas)' : 'pelo atalho "Claude" na sua Área de Trabalho');
  // Versão do "trabalho" segura pra ir dentro de aspas em bash e cmd.
  ctx.resp.trabalhoSeguro = ctx.seguro(ctx.resp.trabalho, t('o meu trabalho do dia a dia'));
  ctx.resp.autonomiaTexto = t({
    cauteloso: 'Pergunte antes de qualquer ação que altere arquivos ou rode comandos. Prefira explicar o que vai fazer e esperar o ok.',
    equilibrado: 'Faça o básico sozinho (ler, escrever, organizar) e pergunte só no que for difícil de desfazer ou que mude a direção do trabalho.',
    confiante: 'Faça o trabalho inteiro sem pedir confirmação, e no fim conte o que fez, em linguagem simples.',
    livre: 'Faça o trabalho inteiro sem pedir confirmação, e no fim conte o que fez, em linguagem simples. Antes de apagar qualquer coisa, faça uma cópia.',
  }[ctx.resp.autonomia] || '');

  const p = perfil(ctx, ctx.resp.perfil);
  const menor = ehMenor(ctx.resp.idade);
  ctx.resp.idadeTexto = String(ctx.resp.idade ?? '').trim() ? t(', tenho {idade} anos', { idade: ctx.resp.idade }) : '';
  // Quem já usa IA pra código não precisa do aviso de "sem jargão", mesmo que tenha marcado o básico em tecnologia.
  ctx.resp.nivelTexto = t(ctx.resp.ia === 'code' ? NIVEL_TEC.avancado : NIVEL_TEC[ctx.resp.tecnologia] || NIVEL_TEC.basico);
  ctx.resp.iaTexto = t(NIVEL_IA[IA_ANTIGA[ctx.resp.ia] || ctx.resp.ia] || '');
  const prints = await pastaDePrints(ctx);
  const cardapio = caminhoCardapio(ctx, vault);
  ctx.resp.extras = [
    p.claudeMd,
    menor ? t(MENOR_DE_IDADE) : '',
    (ctx.resp.modulos || []).includes('maestri') && ctx.plataforma === 'darwin' ? t(VARIOS_AGENTES) : '',
    t('# Cardápio do Claude\n\nQuando eu perguntar o que dá pra te pedir, ou parecer que não sei por onde começar, abra o Cardápio do Claude em `{cardapio}` e sugira 2 ou 3 pedidos que combinem com o momento, não a lista inteira.\n', { cardapio }),
    prints ? t('# Prints de tela\n\nMeus prints de tela ficam em `{prints}`. Quando eu falar "olha o print" ou "vê a tela", leia o arquivo mais recente dessa pasta. Se eu arrastar um print e o caminho começar com `/var/folders/`, você não vai conseguir ler: pegue o mais recente da pasta de prints.\n', { prints }) : '',
  ].filter(Boolean).join('\n');

  await ui.tarefa('Ensinando a IA quem você é', 'A IA já sabe quem você é', async () => {
    escreverClaudeMd(ctx, path.join(d, 'CLAUDE.md'), ctx.template('CLAUDE.md.tpl'));
  });

  await ui.tarefa('Configurando como a IA trabalha', 'Permissões configuradas', async () => {
    const nivel = NIVEIS[ctx.resp.autonomia] || NIVEIS.equilibrado;
    tirarAvisoAntigo(ctx, path.join(d, 'settings.json'));
    ctx.mesclarJson(path.join(d, 'settings.json'), {
      permissions: { allow: nivel.allow, deny: DENY, defaultMode: nivel.defaultMode },
      hooks: {
        SessionStart: [
          { hooks: [{ type: 'command', command: `node "${ctx.posix(path.join(d, 'hooks', 'cerebro-inicio.cjs'))}"`, timeout: 10 }] },
          { hooks: [{ type: 'command', command: `node "${ctx.posix(path.join(d, 'hooks', 'ativacao.cjs'))}"`, timeout: 10 }] },
          { hooks: [{ type: 'command', command: `node "${ctx.posix(path.join(d, 'hooks', 'aula.cjs'))}"`, timeout: 5 }] },
        ],
        Stop: [{ hooks: [{ type: 'command', command: `node "${ctx.posix(path.join(d, 'hooks', 'cerebro-fim.cjs'))}"`, timeout: 10 }] }],
        UserPromptSubmit: [{ hooks: [{ type: 'command', command: `node "${ctx.posix(path.join(d, 'hooks', 'aula.cjs'))}"`, timeout: 5 }] }],
        Notification: [{ hooks: [{ type: 'command', command: `node "${ctx.posix(path.join(d, 'hooks', 'aula.cjs'))}"`, timeout: 5 }] }],
        // Antes de escrever: trava o cofre fora de CLAUDE/. Depois de escrever: confere o formato da nota.
        PreToolUse: [{ matcher: 'Write|Edit|MultiEdit|NotebookEdit', hooks: [{ type: 'command', command: `node "${ctx.posix(path.join(d, 'hooks', 'cerebro-trava.cjs'))}"`, timeout: 10 }] }],
        PostToolUse: [{ matcher: 'Write|Edit', hooks: [{ type: 'command', command: `node "${ctx.posix(path.join(d, 'hooks', 'cerebro-nota.cjs'))}"`, timeout: 10 }] }],
      },
      env: { CLAUDE_SETUPER_VAULT: vault },
      // Modo voz ligado: segura a barra de espaço pra falar. O ditado segue o idioma.
      language: ctx.idioma === 'en' ? 'English' : 'Português', voiceEnabled: true, voice: { enabled: true, mode: 'hold' },
      ...(nivel.extra || {}),
    });
    if (ctx.plataforma === 'darwin') {
      ctx.mesclarJson(path.join(d, 'settings.json'), {
        // Nas rotinas automáticas (revisão, leitura diária) não avisa: a pessoa não pediu nada.
        hooks: { Stop: [{ hooks: [{ type: 'command', command: AVISO_MAC, timeout: 5 }] }] },
      });
    }
  });

  await ui.tarefa('Montando a memória e os lembretes da IA', 'Memória e lembretes prontos', async () => {
    for (const h of HOOKS) ctx.copiarTemplate(`hooks/${h}`, path.join(d, 'hooks', h));
    for (const s of SKILLS) ctx.copiarTemplate(`skills/${s}.md`, path.join(d, 'skills', ctx.skill(s), 'SKILL.md'));
    ctx.escreverSeFaltar(path.join(d, 'memoria', 'MEMORIA.md'), ctx.template('memoria/MEMORIA.md'));
  });

  // Instalação que já tinha o cofre: a wiki, a pasta de entrada e a trava entram aqui, sem reabrir o Obsidian.
  // Na instalação nova quem monta é o passo do Obsidian, que vem depois.
  if (comCofre(ctx)) {
    await ui.tarefa('Organizando o seu segundo cérebro', 'Segundo cérebro organizado', () => {
      // Presente num cofre que já existia: as notas prontas entram antes da wiki, sem apagar nada.
      if (ctx.presente) copiarCofre(ctx, ctx.estado.respostas.vault);
      return montarWiki(ctx, ctx.estado.respostas.vault);
    });
  }

  // Uma chave da API no computador faz o Claude do Terminal cobrar pela API em vez da assinatura, e desliga os
  // conectores do claude.ai (Gmail, Agenda). Só avisa: o arquivo é da pessoa.
  const chave = chaveDaApi(ctx);
  if (chave) ui.aviso(`Achei uma chave da API da Anthropic ${chave}. Com ela, o Claude cobra pelo uso avulso em vez de usar a sua assinatura, e o Gmail e a Agenda não conectam. Se não foi de propósito, peça pra quem te ajuda tirar.`);

  await ui.tarefa('Preparando a sua primeira semana com a IA', 'Primeira semana preparada', async () => {
    // Cardápio de pedidos do perfil: a pessoa pode editar à vontade, então só cria se faltar.
    ctx.escreverSeFaltar(cardapio, ctx.template(`cardapio/${p.id}.md`));
    // Missões dos próximos dias e o resumo semanal (hook ativacao.cjs). Rodar de novo não reinicia a semana.
    const config = path.join(d, 'setuper-ativacao.json');
    const antes = ctx.lerJson(config, {});
    ctx.escrever(config, {
      instalado: antes.instalado || new Date().toISOString(),
      nome: ctx.resp.nome, perfil: p.id, missoes: p.semana || [], cardapio,
      vault: (ctx.resp.modulos || []).includes('obsidian') ? vault : '',
    });
  });
}

const AVISO_MAC = `[ -n "$CLAUDE_SETUPER_ROTINA" ] || osascript -e 'display notification "Terminei, pode olhar." with title "Claude" sound name "Glass"'`;

// O aviso de "Terminei" das versões antigas tocava também nas rotinas automáticas. Tira o antigo antes de pôr o novo,
// senão a mesclagem deixaria os dois (e o Mac avisaria duas vezes).
function tirarAvisoAntigo(ctx, arquivo) {
  const s = ctx.lerJson(arquivo, null);
  if (!s?.hooks?.Stop) return;
  const antes = s.hooks.Stop.length;
  s.hooks.Stop = s.hooks.Stop.filter((g) => !g.hooks?.some((h) => /Terminei, pode olhar/.test(h.command || '') && h.command !== AVISO_MAC));
  if (s.hooks.Stop.length !== antes) ctx.escrever(arquivo, s);
}

// O CLAUDE.md pode ter coisas da pessoa antes e depois do bloco do Setuper: troca só o bloco.
// Versões antigas não tinham a marca de fim (o bloco ia até o fim do arquivo). Antes de mudar, guarda uma cópia.
export function escreverClaudeMd(ctx, arquivo, bloco) {
  if (!ctx.existe(arquivo)) return ctx.escrever(arquivo, bloco);
  const atual = fs.readFileSync(arquivo, 'utf8');
  const i = atual.indexOf(INICIO);
  let novo;
  if (i < 0) novo = atual.trimEnd() + '\n\n' + bloco;
  else {
    const j = atual.indexOf(FIM, i);
    const depois = j >= 0 ? atual.slice(j + FIM.length) : '\n';
    novo = atual.slice(0, i) + bloco.trimEnd() + (depois.startsWith('\n') ? depois : '\n' + depois);
  }
  if (novo === atual) return;
  const agora = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  ctx.escrever(path.join(ctx.pastaSetuper, 'backups', t('CLAUDE.md antes de {agora}.md', { agora })), atual);
  ctx.escrever(arquivo, novo);
}

// Com o segundo cérebro, o cardápio fica na raiz do cofre (a pessoa vê no Obsidian); sem ele, na pasta do Setuper.
function caminhoCardapio(ctx, vault) {
  const pasta = (ctx.resp.modulos || []).includes('obsidian') ? vault : ctx.pastaSetuper;
  return path.join(pasta, ctx.arq('Cardápio do Claude.md'));
}

const VARIOS_AGENTES = `# Vários Claudes ao mesmo tempo (Maestri)

No Maestri eu posso abrir mais de um Claude trabalhando junto. Quando for assim:
1. Cada Claude fica com uma tarefa clara e uma pasta própria.
2. Não mexa em arquivo que outro Claude está usando. Se precisar, me pergunte.
3. Antes de apagar ou substituir qualquer arquivo, faça uma cópia.
4. Se o limite do meu plano acabar no meio, me avise em linguagem simples e diga onde parou.
`;

// No Mac, o print arrastado pra janela vem de uma pasta protegida que o Claude não lê.
// Manda os prints pra ~/Pictures/Prints (a miniatura no canto continua ligada) e devolve a pasta.
async function pastaDePrints(ctx) {
  if (ctx.plataforma !== 'darwin' || ctx.semApps) return '';
  const atual = await ctx.run('defaults', ['read', 'com.apple.screencapture', 'location'], { ignorarErro: true, sempre: true });
  if (atual) return atual;
  if (ctx.dryRun) return '';
  // Sem perguntar: o Mac joga os prints na Mesa, onde o Claude não acha. Numa pasta fixa ele lê o mais recente.
  const pasta = path.join(ctx.homeReal, 'Pictures', ctx.pasta('Prints'));
  fs.mkdirSync(pasta, { recursive: true });
  await ctx.run('defaults', ['write', 'com.apple.screencapture', 'location', pasta], { ignorarErro: true });
  await ctx.run('killall', ['SystemUIServer'], { ignorarErro: true });
  ui.ok('Seus prints de tela agora vão pra Imagens > Prints, onde a IA consegue ler.');
  return pasta;
}

export async function remover(ctx) {
  const d = ctx.claudeDir;
  // Tira só o bloco do Setuper do CLAUDE.md; se o arquivo era só nosso, apaga.
  const claudeMd = path.join(d, 'CLAUDE.md');
  if (fs.existsSync(claudeMd)) {
    const txt = fs.readFileSync(claudeMd, 'utf8');
    const i = txt.indexOf(INICIO);
    if (i >= 0) {
      const j = txt.indexOf(FIM, i);
      const resto = (txt.slice(0, i).trimEnd() + '\n\n' + (j >= 0 ? txt.slice(j + FIM.length).trim() : '')).trim();
      if (!resto) fs.rmSync(claudeMd, { force: true });
      else fs.writeFileSync(claudeMd, resto + '\n');
    }
  }
  for (const f of ['setuper-ativacao.json', 'setuper-ativacao-estado.json']) fs.rmSync(path.join(d, f), { force: true });
  for (const h of [...HOOKS, 'cerebro-inicio.js', 'cerebro-fim.js', 'cerebro-nota.js']) fs.rmSync(path.join(d, 'hooks', h), { force: true });
  for (const s of SKILLS) fs.rmSync(path.join(d, 'skills', s), { recursive: true, force: true });
  // A trava do cofre sai junto com os hooks. As notas e a wiki ficam: são da pessoa.
  if (ctx.estado.respostas?.vault) removerTrava(ctx, ctx.estado.respostas.vault);
}
