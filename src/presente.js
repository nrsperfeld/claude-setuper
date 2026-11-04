// Modo presente: o Setuper chega com um segundo cérebro já construído pra uma pessoa.
// Uma pasta `presente/` (dentro do app, em Contents/Resources/presente, ou apontada por --presente <pasta> ou pela
// variável CLAUDE_SETUPER_PRESENTE) traz:
//   presente.json  quem é a pessoa, as respostas do wizard, o recado de abertura e o nome do cofre
//   cofre/         as notas prontas, copiadas pro cofre antes dos modelos em branco (o presente prevalece)
// Formato e exemplo no README (Modo presente).
import fs from 'node:fs';
import path from 'node:path';

const TECNOLOGIA = ['pouco', 'basico', 'avancado'];
const IA = ['nunca', 'chat', 'code'];
const AUTONOMIA = ['cauteloso', 'equilibrado', 'confiante', 'livre'];
// Lixo de sistema e o histórico de quem montou o cofre: nada disso vai pra pessoa.
const IGNORAR = new Set(['.DS_Store', '.git', '.trash', 'Thumbs.db', '.Spotlight-V100', '.fseventsd']);

// Lê e confere a pasta. Devolve null se não tem presente ali. Com problema no presente.json, `problemas` diz o quê
// (o build recusa; a instalação usa só o que estiver certo e pergunta o resto).
export function lerPresente(dir, { templates } = {}) {
  if (!dir) return null;
  const raiz = path.resolve(dir);
  const arquivo = path.join(raiz, 'presente.json');
  if (!fs.existsSync(arquivo)) return null;
  let dados;
  try {
    dados = JSON.parse(fs.readFileSync(arquivo, 'utf8').replace(/^﻿/, ''));
  } catch (e) {
    return { dir: raiz, problemas: [`presente.json não abre: ${e.message}`], respostas: {} };
  }
  const problemas = [];
  const perfisValidos = templates ? fs.readdirSync(path.join(templates, 'perfis')).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, '')) : null;
  const r = { ...(dados.respostas || {}) };
  const respostas = {};

  const pessoa = String(dados.pessoa || '').trim();
  if (!/^[a-z0-9][a-z0-9-]*$/.test(pessoa)) problemas.push('pessoa: use só letras minúsculas sem acento, números e hífen (vai no identificador do app)');
  const nome = String(dados.nome || r.nome || '').trim();
  if (!nome) problemas.push('nome: falta como chamar a pessoa');
  else respostas.nome = nome;

  const perfil = String(dados.perfil || r.perfil || '').trim();
  if (perfil) {
    if (perfisValidos && !perfisValidos.includes(perfil)) problemas.push(`perfil: "${perfil}" não existe (${perfisValidos.join(', ')})`);
    else respostas.perfil = perfil;
  }
  if (r.idade !== undefined && r.idade !== '') {
    const idade = String(r.idade).trim();
    if (/^\d{1,3}$/.test(idade) && +idade >= 6 && +idade <= 110) respostas.idade = idade;
    else problemas.push('respostas.idade: só o número, por exemplo "45"');
  }
  for (const [k, validos] of [['tecnologia', TECNOLOGIA], ['ia', IA], ['autonomia', AUTONOMIA]]) {
    if (r[k] === undefined) continue;
    if (validos.includes(r[k])) respostas[k] = r[k];
    else problemas.push(`respostas.${k}: use ${validos.join(', ')}`);
  }
  if (r.trabalho !== undefined) respostas.trabalho = String(r.trabalho).trim();
  for (const k of ['pacotes', 'mcps']) {
    if (r[k] === undefined) continue;
    if (Array.isArray(r[k]) && r[k].every((x) => typeof x === 'string')) respostas[k] = r[k];
    else problemas.push(`respostas.${k}: uma lista de nomes, por exemplo ["empresa", "escrita"]`);
  }
  if (r.modulos !== undefined) {
    if (r.modulos === 'tudo' || (Array.isArray(r.modulos) && r.modulos.every((x) => typeof x === 'string'))) respostas.modulos = r.modulos;
    else problemas.push('respostas.modulos: "tudo" ou uma lista de passos, por exemplo ["obsidian", "maestri"]');
  }

  const vault = String(dados.vault || 'Segundo Cérebro').trim();
  if (!vault || /[/\\:]/.test(vault) || vault.startsWith('.')) problemas.push('vault: só o nome da pasta, sem barra, por exemplo "Segundo Cérebro"');

  const recado = dados.recado || {};
  if (!recado.texto) problemas.push('recado.texto: falta o recado da tela de abertura');

  const paraComecar = Array.isArray(dados.paraComecar) ? dados.paraComecar.map((s) => String(s).trim()).filter(Boolean).slice(0, 3) : [];
  if (dados.paraComecar !== undefined && paraComecar.length !== 3) problemas.push('paraComecar: três pedidos, um por item da lista');

  const cofre = path.join(raiz, 'cofre');
  if (!fs.existsSync(cofre) || !fs.statSync(cofre).isDirectory()) problemas.push('cofre/: a pasta com as notas não está ao lado do presente.json');

  const artigo = dados.artigo === 'da' ? 'da' : 'do';
  const signo = ['signo.png', 'signo.svg'].map((f) => path.join(raiz, f)).find((f) => fs.existsSync(f)) || '';
  return {
    dir: raiz,
    cofre,
    pessoa,
    nome,
    artigo,
    rotulo: `Segundo Cérebro ${artigo} ${nome}`,
    vault: vault || 'Segundo Cérebro',
    recado: { titulo: String(recado.titulo || '').trim(), texto: String(recado.texto || '').trim(), assinatura: String(recado.assinatura || '').trim() },
    paraComecar,
    signo,
    respostas,
    problemas,
  };
}

// As respostas que o wizard não precisa perguntar.
export function respostasDoPresente(ctx) {
  return ctx.presente?.respostas || {};
}

// Copia o cofre/ do presente pro cofre da pessoa, sem sobrescrever nada que já esteja lá (mescla sem apagar).
// Os JSONs de configuração do Obsidian (.obsidian/*.json) ficam pra mesclarObsidian, depois dos padrões do módulo.
// Roda uma vez por presente: abrindo o Setuper de novo, o que a pessoa apagou ou mudou não volta.
export function copiarCofre(ctx, vault) {
  const pr = ctx.presente;
  if (!pr?.cofre || !fs.existsSync(pr.cofre)) return { copiados: 0, mantidos: 0, pulou: true };
  if (ctx.estado.presente?.pessoa === pr.pessoa && ctx.estado.presente?.cofre) return { copiados: 0, mantidos: 0, pulou: true };
  const r = { copiados: 0, mantidos: 0 };
  andar(pr.cofre, '', (rel, origem) => {
    if (ehJsonDoObsidian(rel)) return;
    const destino = path.join(vault, rel);
    if (fs.existsSync(destino)) { r.mantidos++; ctx.log('mantido (já existe)', destino); return; }
    r.copiados++;
    ctx.log('presente', destino);
    if (ctx.dryRun) return;
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    fs.copyFileSync(origem, destino);
  });
  if (!ctx.dryRun) {
    ctx.estado.presente = { ...ctx.estado.presente, pessoa: pr.pessoa, cofre: new Date().toISOString() };
    ctx.salvarEstado();
  }
  ctx.log('presente: cofre copiado', `${r.copiados} arquivos novos, ${r.mantidos} já existiam`);
  return r;
}

// Mescla o .obsidian do presente (tema, snippets, cores do grafo) com o que o módulo escreveu e com o que a pessoa
// já tinha: nas chaves em comum o presente vence, listas são somadas, o resto fica.
export function mesclarObsidian(ctx, vault) {
  const pr = ctx.presente;
  if (!pr?.cofre || !fs.existsSync(path.join(pr.cofre, '.obsidian'))) return 0;
  if (ctx.estado.presente?.pessoa === pr.pessoa && ctx.estado.presente?.obsidian) return 0;
  let n = 0;
  andar(pr.cofre, '', (rel, origem) => {
    if (!ehJsonDoObsidian(rel)) return;
    const destino = path.join(vault, rel);
    let patch;
    try { patch = JSON.parse(fs.readFileSync(origem, 'utf8').replace(/^﻿/, '')); } catch { patch = undefined; }
    if (patch === undefined || typeof patch !== 'object' || patch === null) {
      // JSON que não abre: vai como arquivo, só se faltar.
      if (!fs.existsSync(destino) && !ctx.dryRun) { fs.mkdirSync(path.dirname(destino), { recursive: true }); fs.copyFileSync(origem, destino); }
      return;
    }
    ctx.mesclarJson(destino, patch);
    n++;
  });
  if (!ctx.dryRun) {
    ctx.estado.presente = { ...ctx.estado.presente, pessoa: pr.pessoa, obsidian: new Date().toISOString() };
    ctx.salvarEstado();
  }
  return n;
}

// O presente já traz notas nesta pasta do cofre (aí a nota-modelo em branco não entra).
export function presenteTemNotas(ctx, relPasta) {
  const dir = ctx.presente?.cofre && path.join(ctx.presente.cofre, relPasta);
  if (!dir || !fs.existsSync(dir)) return false;
  return fs.readdirSync(dir).some((f) => f.endsWith('.md') && f !== 'README.md');
}

function ehJsonDoObsidian(rel) {
  return rel.split('/')[0] === '.obsidian' && rel.endsWith('.json');
}

// Percorre a pasta e chama fn(caminhoRelativo com "/", caminhoAbsoluto) pra cada arquivo comum.
// Atalhos (links simbólicos) não são seguidos: só entra o que está de fato dentro do presente.
function andar(raiz, rel, fn) {
  for (const nome of fs.readdirSync(path.join(raiz, rel)).sort()) {
    if (IGNORAR.has(nome)) continue;
    const r = rel ? `${rel}/${nome}` : nome;
    const abs = path.join(raiz, r);
    const st = fs.lstatSync(abs);
    if (st.isSymbolicLink()) continue;
    if (st.isDirectory()) andar(raiz, r, fn);
    else if (st.isFile()) fn(r, abs);
  }
}
