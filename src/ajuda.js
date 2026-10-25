// Pedido de ajuda: junta num arquivo de texto, na Mesa, tudo que quem dá suporte precisa ver (versão, sistema,
// conferência completa e o fim do registro), sem senha nem código de login. A pessoa só manda o arquivo.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { MODULOS, modulosParaPlataforma } from './modulos/index.js';

const NOME = 'Claude Setuper - pedido de ajuda.txt';

// Tira do texto o que não pode sair do computador: tokens, chaves, senhas e códigos de login.
export function limpar(texto) {
  return String(texto)
    .replace(/\b(gh[opusr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-ant-[A-Za-z0-9_-]{10,}|sk-[A-Za-z0-9]{20,})/g, '[token apagado]')
    .replace(/(senha|password|token|secret)("?\s*[:=]\s*"?)[^\s"',}[]+/gi, '$1$2[apagado]')
    .replace(/\b(authorization|bearer)\s+[^\s"',}[]+/gi, '$1 [apagado]')
    .replace(/"codigo":"[^"]*"/g, '"codigo":"[apagado]"')
    .replace(/\b[A-Za-z0-9_-]{30,}#[A-Za-z0-9_-]{10,}\b/g, '[código de login apagado]')
    .replace(/\b[A-Z0-9]{4}-[A-Z0-9]{4}\b/g, '[código apagado]');
}

function ultimas(arquivo, n) {
  try { return fs.readFileSync(arquivo, 'utf8').split('\n').slice(-n).join('\n'); } catch { return '(não existe)'; }
}

// A Mesa do Windows às vezes fica dentro do OneDrive.
function mesa(ctx) {
  const opcoes = [ctx.desktop(), path.join(ctx.home, 'OneDrive', 'Desktop'), path.join(ctx.home, 'OneDrive', 'Área de Trabalho')];
  return opcoes.find((p) => fs.existsSync(p)) || ctx.pastaSetuper;
}

export async function gerarPedidoDeAjuda(ctx, versao) {
  const ids = Object.keys(ctx.estado.modulos || {});
  const lista = modulosParaPlataforma(ids.length ? ids : MODULOS.filter((m) => m.padrao).map((m) => m.id), ctx.plataforma);
  const conferencia = [];
  for (const m of lista) {
    let itens;
    try { itens = await m.verificar(ctx); } catch (e) { itens = [{ item: m.nome, ok: false, dica: e.message }]; }
    conferencia.push(`  ${m.nome}`, ...itens.map((i) => `    ${i.ok ? '✓' : '✗'} ${i.item}${!i.ok && i.dica ? `  (${i.dica})` : ''}`));
  }
  const r = ctx.estado.respostas || {};
  const linhas = [
    'Pedido de ajuda do Claude Setuper',
    `Gerado em ${new Date().toLocaleString('pt-BR')}`,
    '',
    `Versão do Setuper: ${versao}`,
    `Sistema: ${ctx.plataforma} ${os.release()} (${os.arch()})`,
    `Pessoa: ${r.nome || '?'} | perfil: ${r.perfil || '?'} | idade: ${r.idade || '?'} | tecnologia: ${r.tecnologia || '?'} | IA: ${r.ia || '?'}`,
    '',
    'Conferência:',
    ...conferencia,
    '',
    'Passos da instalação:',
    ...Object.entries(ctx.estado.modulos || {}).map(([id, s]) => `  ${s.ok ? '✓' : '✗'} ${id} em ${s.em}${s.erro ? `  (${s.erro})` : ''}`),
    '',
    'Fim do registro da instalação:',
    ultimas(ctx.logPath, 250),
    '',
    'Fim do registro da atualização semanal:',
    ultimas(path.join(ctx.pastaSetuper, 'sentinela', 'registro.log'), 40),
  ];
  const destino = path.join(mesa(ctx), NOME);
  fs.writeFileSync(destino, limpar(linhas.join('\n')) + '\n');
  ctx.log('pedido de ajuda gerado em', destino);
  return destino;
}
