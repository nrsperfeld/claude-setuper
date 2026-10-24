import { criarCtx } from './ctx.js';
import { ui, c } from './ui.js';
import { wizard } from './wizard.js';
import { MODULOS, modulosParaPlataforma } from './modulos/index.js';
import { doctor } from './doctor.js';
import { remover } from './remover.js';
import { exportar } from './exportar.js';
import { atualizar } from './atualizar.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const VERSAO = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'package.json'), 'utf8')).version;

const AJUDA = `
Claude Setuper ${VERSAO}

  claude-setuper                 instala (ou continua de onde parou)
  claude-setuper doctor          confere se está tudo funcionando
  claude-setuper atualizar       puxa a versão nova sem perder o que você editou
  claude-setuper remover         desfaz a instalação (pergunta antes de cada coisa)
  claude-setuper exportar        gera um perfil a partir do setup atual

Opções:
  --perfil <id>     já escolhe o público (dia-a-dia, empresario, marketing, video, estudante, elos)
  --modulos a,b,c   só esses módulos (${MODULOS.map((m) => m.id).join(', ')})
  --sim             aceita os defaults sem perguntar
  --dry-run         mostra o que faria sem mexer em nada
  --home <pasta>    usa outra pasta como "casa" (pra testes)
  --sem-apps        não instala aplicativos, só escreve arquivos (pra testes)
  --assistido       grava um relatório pra quem está te ajudando
`;

export async function main(argv) {
  const { cmd, flags } = parse(argv);
  if (flags.help || cmd === 'ajuda') return console.log(AJUDA);
  const ctx = criarCtx(flags);
  ctx.log('--- claude-setuper', VERSAO, cmd, JSON.stringify(flags));

  switch (cmd) {
    case 'instalar':
      return instalar(ctx, flags);
    case 'doctor':
      return doctor(ctx);
    case 'atualizar':
      return atualizar(ctx);
    case 'remover':
      return remover(ctx);
    case 'exportar':
      return exportar(ctx);
    default:
      console.log(AJUDA);
  }
}

async function instalar(ctx, flags) {
  ui.abertura('Claude Setuper', `versão ${VERSAO}${ctx.dryRun ? '  (modo de teste, nada vai ser alterado)' : ''}`);

  await wizard(ctx);
  const ids = flags.modulos ? flags.modulos.split(',') : ctx.resp.modulos;
  const lista = modulosParaPlataforma(ids, ctx.plataforma);
  const pulados = ids.filter((id) => !lista.some((m) => m.id === id));
  if (pulados.length) ui.info(`No seu sistema estes não se aplicam e vou pular: ${pulados.join(', ')}`);

  ctx.estado.versao = VERSAO;
  let n = 0;
  const falhas = [];
  for (const m of lista) {
    n++;
    ui.linha();
    ui.passo(n, lista.length, m.nome);
    try {
      await m.instalar(ctx);
      ctx.estado.modulos[m.id] = { ok: true, em: new Date().toISOString() };
    } catch (e) {
      ctx.log('FALHA módulo', m.id, e.stack || e.message);
      ctx.estado.modulos[m.id] = { ok: false, em: new Date().toISOString(), erro: e.message };
      falhas.push(m);
      ui.erro(`${m.nome}: não deu certo agora (${resumoErro(e)}). Sigo com o resto e te mostro no fim.`);
    }
    ctx.salvarEstado();
  }

  ui.linha();
  if (falhas.length) {
    ui.aviso(`Terminei, mas ${falhas.length === 1 ? 'uma parte ficou' : `${falhas.length} partes ficaram`} pendente${falhas.length > 1 ? 's' : ''}: ${falhas.map((m) => m.nome).join(', ')}.`);
    ui.info(`Rode ${c.bold('claude-setuper doctor')} pra ver o que falta, ou rode o instalador de novo que ele continua de onde parou.`);
  }
  if (ctx.assistido) gravarRelatorio(ctx, falhas);

  ui.info('Se você já tinha algum Claude aberto (no Terminal ou no Maestri), feche e abra de novo pra ele pegar as configurações novas.');
  ui.info('Gmail, Google Agenda, Drive, Planilhas, QuickBooks e outros apps se conectam pelo site: claude.ai > Configurações > Conectores > escolhe o app > Conectar. Depois é só abrir o Claude de novo.');
  ui.linha();

  const okMaestri = lista.some((m) => m.id === 'maestri') && !falhas.some((m) => m.id === 'maestri');
  const okAtalho = lista.some((m) => m.id === 'atalho') && !falhas.some((m) => m.id === 'atalho');
  ui.encerramento(
    okMaestri
      ? `Pronto, ${ctx.resp.nome}. O Maestri está abrindo com o Claude e as suas notas do lado. Vai lá.`
      : okAtalho
        ? `Pronto, ${ctx.resp.nome}. O Claude está abrindo numa janela nova, e deixei um atalho "Claude" na sua Área de Trabalho pra próxima vez.`
        : `Pronto, ${ctx.resp.nome}. Abra o Terminal e digite ${c.bold('claude')} pra começar.`,
  );
}

function gravarRelatorio(ctx, falhas) {
  const linhas = [
    `Claude Setuper ${ctx.estado.versao} — relatório`,
    `Data: ${new Date().toLocaleString('pt-BR')}`,
    `Sistema: ${ctx.plataforma}`,
    `Nome: ${ctx.resp.nome} | Autonomia: ${ctx.resp.autonomia}`,
    '',
    ...Object.entries(ctx.estado.modulos).map(([id, s]) => `${s.ok ? '✓' : '✗'} ${id}${s.erro ? `  (${s.erro})` : ''}`),
    '',
    falhas.length ? 'Log completo em: ' + ctx.logPath : 'Tudo certo.',
  ];
  const p = path.join(ctx.pastaSetuper, 'relatorio.txt');
  fs.writeFileSync(p, linhas.join('\n') + '\n');
  ui.info(`Relatório salvo em ${p}. Manda pra quem está te ajudando.`);
}

function resumoErro(e) {
  return String(e.message || e).split('\n')[0].slice(0, 120);
}

function parse(argv) {
  const flags = {};
  let cmd = 'instalar';
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') flags.dryRun = true;
    else if (a === '--sim' || a === '-y') flags.sim = true;
    else if (a === '--sem-apps') flags.semApps = true;
    else if (a === '--assistido') flags.assistido = true;
    else if (a === '--help' || a === '-h') flags.help = true;
    else if (a === '--home') flags.home = argv[++i];
    else if (a === '--plataforma') flags.plataforma = argv[++i];
    else if (a === '--modulos') flags.modulos = argv[++i];
    else if (a === '--perfil') flags.perfil = argv[++i];
    else if (!a.startsWith('-')) cmd = a;
  }
  return { cmd, flags };
}
