// Perfis por público (estudante, empresário, vídeo...): um arquivo JSON por perfil em templates/perfis.
// Mudam as perguntas seguintes, os pacotes marcados, os passos que entram e o que vai pro CLAUDE.md.
import fs from 'node:fs';
import path from 'node:path';

export function perfis(ctx) {
  const dir = path.join(ctx.templates, 'perfis');
  return fs.readdirSync(dir).filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')))
    .sort((a, b) => a.ordem - b.ordem);
}

export function perfil(ctx, id) {
  return perfis(ctx).find((p) => p.id === id) || perfis(ctx).find((p) => p.id === 'dia-a-dia');
}

// Quanto o Claude explica, a partir do que a pessoa disse sobre tecnologia e IA.
export const NIVEL_TEC = {
  pouco: 'Eu me viro pouco com tecnologia. Explique cada passo como se fosse a primeira vez, um passo por mensagem, dizendo exatamente onde clicar. Não mostre código nem comando a não ser que eu peça; se eu precisar rodar alguma coisa, diga o que copiar e onde colar.',
  basico: 'Eu uso o básico de tecnologia sem problema. Fale sem jargão e sem sigla sem explicar, e pode juntar dois ou três passos numa mensagem. Não mostre código a não ser que eu peça.',
  avancado: 'Eu sou bem à vontade com computador. Pode ser direto e usar termos técnicos comuns.',
};

export const NIVEL_IA = {
  nunca: 'Eu quase nunca usei IA. Quando fizer sentido, me mostre o que mais dá pra pedir pra você, sempre com um exemplo do meu dia a dia.',
  vezes: '',
  diario: 'Eu uso IA todo dia, não precisa explicar o básico de como pedir as coisas.',
};

export const MENOR_DE_IDADE = `# Cuidados (menor de 18 anos)

Eu tenho menos de 18 anos. Não me peça e não guarde dados pessoais meus ou de outras pessoas: endereço, documentos, senhas, fotos. Se um assunto for pesado ou perigoso, fale com cuidado e sugira conversar com um adulto de confiança.
`;

// A primeira mensagem que o Claude recebe ao abrir pela primeira vez. Vai dentro de aspas em bash e cmd,
// então o texto fixo não tem aspas, $, % nem !, e o que a pessoa escreveu passa pelo ctx.seguro.
export function apresentacao(ctx) {
  const r = ctx.resp;
  const nome = ctx.seguro(r.nome, 'eu');
  const trabalho = ctx.seguro(r.trabalho, 'o meu dia a dia');
  const sobre = r.perfil === 'estudante'
    ? `o que você consegue fazer pelos meus estudos (${trabalho})`
    : `o que você consegue fazer por alguém como eu (${trabalho})`;
  return [
    `Oi, eu sou ${nome}. Acabei de instalar você com o Claude Setuper.`,
    `Se apresenta pra mim em poucas linhas, em português simples: quem você é, ${sobre}, e como o meu segundo cérebro (as notas no Obsidian) funciona entre a gente.`,
    r.ia === 'nunca' ? 'Eu quase nunca usei IA, então me dá três exemplos bem práticos do que eu posso te pedir.' : '',
    r.tecnologia === 'pouco' ? 'Fala bem simples, sem nenhum termo técnico.' : '',
    'No fim, me propõe uma tarefa pequena e útil pra gente fazer agora em um minuto.',
  ].filter(Boolean).join(' ');
}
