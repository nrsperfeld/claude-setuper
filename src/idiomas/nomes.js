// Nomes de pasta, arquivo e comando em cada idioma. O nome em português é a chave.
const EN = {
  pastas: { _anexos: '_attachments', 'decisões': 'decisions', 'padrões': 'patterns', descobertas: 'discoveries', projetos: 'projects', fontes: 'sources', pessoas: 'people', assuntos: 'topics', '1. PROJETOS': '1. PROJECTS', '2. ÁREAS': '2. AREAS', '3. RECURSOS': '3. RESOURCES', '4. ARQUIVO': '4. ARCHIVE', 'Segundo Cérebro': 'Second Brain', Prints: 'Screenshots', Projetos: 'Projects', processados: 'processed', 'segundo-cerebro': 'second-brain' },
  tags: { 'decisão': 'decision', 'padrão': 'pattern', descoberta: 'discovery', projeto: 'project', fonte: 'source' },
  arquivos: { 'Comece aqui.md': 'Start here.md', 'Painel do Claude.md': 'Claude dashboard.md', 'Nota do Claude.md': 'Claude note.md', 'Como trabalhar comigo.md': 'How to work with me.md', 'Cardápio do Claude.md': 'Claude menu.md', 'Como falar comigo.md': 'How to talk to me.md', 'relatorio.txt': 'report.txt', 'Claude Setuper - pedido de ajuda.txt': 'Claude Setuper - help request.txt' },
  skills: { decisao: 'decision', padrao: 'pattern', descoberta: 'discovery', lembrar: 'recall', guardar: 'save', publicar: 'publish', 'analise-negocio': 'business-analysis', campanha: 'campaign', cortes: 'clips', estudar: 'study', numeros: 'numbers', pesquisar: 'research', planilha: 'spreadsheet', 'projeto-novo': 'new-project', proposta: 'proposal', redacao: 'essay', resumir: 'summarize', reuniao: 'meeting', 'revisar-codigo': 'review-code', revisar: 'polish', roteiro: 'script', 'titulo-video': 'video-title', 'voz-elos': 'elos-voice' },
};
export function nomesDe(idioma) {
  const tabela = idioma === 'en' ? EN : { pastas: {}, tags: {}, arquivos: {}, skills: {} };
  return {
    pasta: (n) => tabela.pastas[n] ?? n,
    tag: (n) => tabela.tags[n] ?? n,
    arq: (n) => tabela.arquivos[n] ?? n,
    skill: (n) => tabela.skills[n] ?? n,
  };
}
