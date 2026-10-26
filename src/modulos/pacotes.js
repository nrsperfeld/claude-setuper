// Pacotes de skills por tipo de uso. A pessoa escolhe no wizard; cada pacote é um punhado de comandos prontos.
import path from 'node:path';
import fs from 'node:fs';
import { ui } from '../ui.js';

export const id = 'pacotes';
export const nome = 'Pacotes de habilidades';
export const nomeCurto = 'Comandos prontos';
export const descricao = 'Comandos prontos pro seu tipo de trabalho (escrita, negócios, pesquisa...)';
export const padrao = true;

export const PACOTES = {
  escrita: { nome: 'Escrita', hint: 'e-mails, textos, revisão sem cara de robô', skills: ['revisar', 'email'] },
  negocios: { nome: 'Negócios', hint: 'propostas, reuniões, planilhas', skills: ['proposta', 'reuniao', 'planilha'] },
  pesquisa: { nome: 'Pesquisa', hint: 'buscar na internet com fontes e resumir', skills: ['pesquisar', 'resumir'] },
  criador: { nome: 'Conteúdo', hint: 'posts, roteiros de vídeo', skills: ['post', 'roteiro'] },
  dev: { nome: 'Programação', hint: 'criar e revisar projetos de código', skills: ['projeto-novo', 'revisar-codigo'] },
  estudo: { nome: 'Estudos', hint: 'entender matéria, plano pra prova, corrigir redação', skills: ['estudar', 'redacao'] },
  video: { nome: 'Vídeo', hint: 'achar cortes, título, descrição e legenda', skills: ['cortes', 'titulo-video'] },
  marketing: { nome: 'Marketing', hint: 'copy que vende e plano de campanha', skills: ['copy', 'campanha'] },
  empresa: { nome: 'Empresa', hint: 'ler os números e decidir com conta feita', skills: ['numeros', 'analise-negocio'] },
  elos: { nome: 'ELOS', hint: 'revisar textos na voz da ELOS', skills: ['voz-elos'], soPerfil: 'elos' },
};

export async function verificar(ctx) {
  const escolhidos = ctx.estado.respostas?.pacotes || [];
  return escolhidos.map((p) => ({
    item: `Pacote ${PACOTES[p]?.nome || p}`,
    ok: (PACOTES[p]?.skills || []).every((s) => ctx.existe(path.join(ctx.claudeDir, 'skills', s, 'SKILL.md'))),
  }));
}

export async function instalar(ctx) {
  const escolhidos = ctx.resp.pacotes || [];
  if (!escolhidos.length) return ui.info(ctx.app ? 'Nenhum pacote escolhido. Dá pra adicionar depois abrindo o Claude Setuper de novo.' : 'Nenhum pacote escolhido. Dá pra adicionar depois com: claude-setuper --modulos pacotes');
  await ui.tarefa('Instalando os comandos do seu tipo de trabalho', `Pacotes instalados: ${escolhidos.map((p) => PACOTES[p]?.nome).join(', ')}`, async () => {
    for (const p of escolhidos) for (const s of PACOTES[p]?.skills || []) ctx.copiarTemplate(`pacotes/${s}.md`, path.join(ctx.claudeDir, 'skills', s, 'SKILL.md'));
  });
}

export async function remover(ctx) {
  for (const p of Object.values(PACOTES)) for (const s of p.skills) fs.rmSync(path.join(ctx.claudeDir, 'skills', s), { recursive: true, force: true });
}
