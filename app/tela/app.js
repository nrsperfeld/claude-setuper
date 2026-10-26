// Tela do app: recebe os eventos da instalação (os mesmos do Terminal) e desenha uma coisa por vez.
const S = window.setuper;
const palco = document.getElementById('palco');
const listaEtapas = document.getElementById('etapas');
const detalhes = document.getElementById('detalhes');
const anuncio = document.getElementById('anuncio');

const estado = {
  fase: 'carregando', // inicio | perguntas | instalando | fim | falha
  inicio: null, atualizacao: null, auto: null,
  passos: [], atual: -1, falhos: new Set(), pendentes: new Set(), comecar: null,
  tarefa: '', msgs: [], pausa: null, pedido: null, introPerguntas: '',
  encerramento: '', grupos: [], soConferiu: false, falha: '',
  ajuda: null, // null | 'gerando' | { arquivo, nome, pasta } | { erro }
};

// Monta elementos sem innerHTML: todo texto entra como texto.
function h(tag, attrs = {}, ...filhos) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const f of filhos.flat()) if (f != null && f !== false) el.append(f.nodeType ? f : String(f));
  return el;
}

function botao(texto, onclick, secundario = false, extra = {}) {
  return h('button', { class: secundario ? 'btn btn2' : 'btn', type: 'button', onclick, ...extra }, texto);
}

// ---------- coluna da esquerda ----------
function desenharEtapas() {
  const itens = [];
  const perguntasFeitas = !['inicio', 'apresentacao', 'perguntas', 'carregando'].includes(estado.fase);
  itens.push(['Algumas perguntas', perguntasFeitas ? 'feito' : estado.fase === 'perguntas' ? 'atual' : '']);
  if (estado.passos.length) {
    estado.passos.forEach((nome, i) => {
      let classe = '';
      if (estado.falhos.has(i)) classe = 'falhou';
      else if (estado.pendentes.has(i) && (i < estado.atual || estado.fase === 'fim')) classe = 'pendente';
      else if (i < estado.atual || estado.fase === 'fim') classe = 'feito';
      else if (i === estado.atual) classe = 'atual';
      itens.push([nome, classe]);
    });
  } else itens.push(['Instalação', '']);
  itens.push(['Pronto', estado.fase === 'fim' ? (estado.pendentes.size || estado.falhos.size ? 'pendente' : 'feito') : '']);
  listaEtapas.replaceChildren(...itens.map(([nome, classe]) => h('li', { class: classe, 'aria-current': classe === 'atual' ? 'step' : null }, h('span', { class: 'bola' }), h('span', {}, nome))));
}

// ---------- palco ----------
function desenhar() {
  desenharEtapas();
  let conteudo;
  if (estado.pedido) conteudo = telaPedido(estado.pedido);
  else if (estado.fase === 'inicio') conteudo = telaInicio();
  else if (estado.fase === 'apresentacao') conteudo = telaApresentacao();
  else if (estado.fase === 'perguntas') conteudo = [h('p', { class: 'mut' }, 'Um instante...')];
  else if (estado.fase === 'instalando') conteudo = telaInstalando();
  else if (estado.fase === 'fim') conteudo = telaFim();
  else if (estado.fase === 'falha') conteudo = telaFalha();
  else conteudo = [];
  // Redesenhar a cada evento jogava a rolagem pro topo e apagava o que a pessoa estava digitando.
  const tela = chaveDaTela();
  const mesmaTela = tela === ultimaTela;
  const rolagem = palco.scrollTop;
  const digitado = palco.querySelector('input')?.value;
  palco.replaceChildren(...[avisoAjuda(), conteudo].flat(3).filter((x) => x != null && x !== false));
  if (mesmaTela) {
    palco.scrollTop = rolagem;
    const campo = palco.querySelector('input');
    if (campo && digitado != null) campo.value = digitado;
  } else {
    ultimaTela = tela;
    palco.scrollTop = 0;
    const foco = palco.querySelector('[data-foco]');
    if (foco) foco.focus();
    // O leitor de tela anuncia só o título da tela nova, não a tela inteira a cada tarefa.
    const titulo = palco.querySelector('h1, h2');
    if (titulo) anuncio.textContent = titulo.textContent;
  }
}
let ultimaTela = '';
function chaveDaTela() {
  if (estado.pedido) return `pedido:${estado.pedido.id}`;
  if (estado.fase === 'instalando') return `pausa:${estado.pausa?.titulo || ''}`;
  return `${estado.fase}:${estado.slide ?? ''}`;
}

function telaInicio() {
  const { temInstalacao, nome } = estado.inicio || {};
  const faixa = estado.atualizacao && h('div', { class: 'faixa' },
    h('span', {}, `Tem uma versão nova do Claude Setuper (${estado.atualizacao}).`),
    botao('Atualizar', () => S.atualizar(), true));
  return [
    faixa,
    h('h1', {}, temInstalacao && nome ? `Que bom te ver de novo, ${nome}.` : 'Vamos preparar o seu Claude.'),
    h('p', { class: 'mut' }, temInstalacao
      ? 'Posso continuar a instalação de onde ela parou, ou só conferir se está tudo no lugar.'
      : 'Leva de 15 a 30 minutos. Primeiro umas perguntas rápidas, depois eu instalo tudo sozinho. Quando eu precisar de você, aparece um cartão amarelo dizendo exatamente o que fazer.'),
    !temInstalacao && h('section', { class: 'grupo' }, h('b', {}, 'Antes de começar, deixa à mão'),
      h('ul', { class: 'lista-simples' },
        h('li', {}, 'O computador na tomada e com internet.'),
        h('li', {}, 'A senha do computador, a mesma que você usa pra ligar ele.'),
        h('li', {}, 'O e-mail da sua conta do Claude. A conta precisa ter um plano pago (Pro ou maior).'))),
    h('div', { class: 'botoes' },
      botao(temInstalacao ? 'Continuar a instalação' : 'Começar', () => (temInstalacao ? comecar('instalar') : apresentar(0)), false, { 'data-foco': true }),
      temInstalacao && botao('Só conferir', () => comecar('conferir'), true)),
  ];
}

// ---------- apresentação: por que usar o Claude assim (só na primeira vez) ----------
const ICONE = {
  computador: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="6" y="9" width="36" height="24" rx="3"/><path d="M18 39h12M24 33v6"/><path d="M14 18l5 4-5 4M22 26h8"/></svg>',
  memoria: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M12 8h18l6 6v26H12z"/><path d="M30 8v6h6M18 22h12M18 28h12M18 34h7"/></svg>',
  estrela: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 6l5 11 12 1-9 8 3 12-11-6-11 6 3-12-9-8 12-1z"/></svg>',
};
const APRESENTACAO = [
  { icone: 'computador', titulo: 'Um Claude que trabalha no seu computador',
    texto: 'No chat, você pergunta, copia a resposta e cola em outro lugar. Aqui o Claude abre os seus arquivos, escreve, organiza pastas, monta planilhas e leva o trabalho até o fim. No que for importante, ele pede licença antes.' },
  { icone: 'memoria', titulo: 'E que lembra de você',
    texto: 'Ele guarda num caderno de notas, aqui no seu computador, o que você já decidiu, como gosta das coisas e onde cada projeto parou, e lê esse caderno antes de começar. A gente chama esse caderno de segundo cérebro. Quando você corrige alguma coisa, ele anota e não repete o erro.' },
  { icone: 'estrela', titulo: 'Do jeito que os usuários mais avançados trabalham',
    texto: 'Memória que não se perde, comandos prontos pro seu tipo de trabalho, rotinas que rodam sozinhas e o Claude ligado nas ferramentas que você já usa. É assim que trabalha o 1% que mais tira proveito do Claude, e o Claude Setuper monta tudo isso pra você em uns 15 minutos.' },
];
function apresentar(i) {
  estado.fase = 'apresentacao';
  estado.slide = i;
  desenhar();
}
function telaApresentacao() {
  const i = estado.slide || 0;
  const s = APRESENTACAO[i];
  const ultimo = i === APRESENTACAO.length - 1;
  const icone = h('div', { class: 'icone-apresentacao' });
  icone.innerHTML = ICONE[s.icone]; // SVG fixo, escrito aqui; nada vindo de fora
  return [
    icone,
    h('h1', {}, s.titulo),
    h('p', { class: 'texto-apresentacao' }, s.texto),
    h('div', { class: 'pontos', 'aria-label': `${i + 1} de ${APRESENTACAO.length}` }, APRESENTACAO.map((_, j) => h('span', { class: j === i ? 'ponto atual' : 'ponto' }))),
    h('div', { class: 'botoes' },
      botao(ultimo ? 'Vamos começar' : 'Continuar', () => (ultimo ? comecar('instalar') : apresentar(i + 1)), false, { 'data-foco': true }),
      !ultimo && h('button', { class: 'link pular', type: 'button', onclick: () => comecar('instalar') }, 'Pular')),
  ];
}

function comecar(modo) {
  estado.fase = modo === 'instalar' ? 'perguntas' : 'instalando';
  estado.falhos.clear(); estado.pendentes.clear(); estado.msgs = [];
  if (modo !== 'instalar') estado.tarefa = 'Conferindo o que está instalado';
  desenhar();
  S.iniciar(modo);
}

// ---------- pedir ajuda ----------
async function pedirAjuda() {
  estado.ajuda = 'gerando';
  desenhar();
  estado.ajuda = await S.pedirAjuda();
  desenhar();
}
function avisoAjuda() {
  const a = estado.ajuda;
  if (!a) return null;
  const fechar = botao('Fechar', () => { estado.ajuda = null; desenhar(); }, true);
  if (a === 'gerando') return h('section', { class: 'cartao ajuda', role: 'status' }, h('p', {}, 'Conferindo a instalação e montando o arquivo pra quem te ajuda. Leva menos de um minuto...'));
  if (a.erro) return h('section', { class: 'cartao ajuda', role: 'alert' }, h('p', {}, 'Não consegui montar o arquivo. Tira um print desta tela e manda pra quem instalou o Claude pra você.'), h('div', { class: 'botoes' }, fechar));
  const onde = a.pasta === 'Desktop' ? 'na sua Mesa' : `na pasta ${a.pasta}`;
  return h('section', { class: 'cartao ajuda', role: 'status' },
    h('h2', {}, 'Arquivo pronto pra mandar'),
    h('p', {}, `Criei o arquivo "${a.nome}" ${onde} e abri a pasta pra você. Manda ele pra quem instalou o Claude pra você, pelo WhatsApp ou por e-mail.`),
    h('p', { class: 'mut pequeno' }, 'Ele tem o que essa pessoa precisa pra te ajudar, sem nenhuma senha nem código de login.'),
    h('div', { class: 'botoes' }, fechar));
}

function telaPedido(p) {
  const intro = estado.fase === 'perguntas' && estado.introPerguntas ? h('p', { class: 'mut pequeno' }, estado.introPerguntas) : null;
  const explicacao = p.explicacao ? h('p', { class: 'explicacao' }, p.explicacao) : null;
  const responder = (valor) => { estado.pedido = null; S.responder(p.id, valor); desenhar(); };

  if (p.tipo === 'texto' || p.tipo === 'senha') {
    const campo = h('input', { type: p.tipo === 'senha' ? 'password' : 'text', placeholder: p.placeholder || '', 'aria-label': p.msg, 'data-foco': true, autocomplete: 'off', spellcheck: 'false' });
    if (p.padrao) campo.value = p.padrao;
    const enviarCampo = () => responder(campo.value);
    campo.addEventListener('keydown', (e) => { if (e.key === 'Enter') enviarCampo(); });
    return [intro, h('h2', {}, p.msg), explicacao, campo, h('div', { class: 'erro-campo', role: 'alert' }, p.erro || ''), h('div', { class: 'botoes fixo' }, botao('Continuar', enviarCampo))];
  }

  if (p.tipo === 'confirmar') {
    return [intro, h('h2', {}, p.msg), explicacao, p.figura && FIGURAS[p.figura] ? FIGURAS[p.figura]() : null, h('div', { class: 'botoes fixo' },
      botao(p.sim || 'Sim', () => responder(true), !p.padrao, p.padrao ? { 'data-foco': true } : {}),
      p.nao === '' ? null : botao(p.nao || 'Não', () => responder(false), !!p.padrao, p.padrao ? {} : { 'data-foco': true }))];
  }

  // escolher (uma) ou varios (várias)
  const varios = p.tipo === 'varios';
  const marcados = new Set(varios ? p.padrao || [] : [p.padrao]);
  const cartoes = p.opcoes.map((o, i) => {
    const el = h('button', { class: `opcao${varios ? ' varios' : ''}`, type: 'button', role: varios ? 'checkbox' : 'radio', 'aria-checked': String(marcados.has(o.value)), 'data-foco': i === 0 && !marcados.size ? true : null },
      h('span', { class: 'marcador' }), h('span', {}, h('b', {}, o.label), o.hint && h('small', {}, o.hint)));
    el.addEventListener('click', () => {
      if (varios) marcados.has(o.value) ? marcados.delete(o.value) : marcados.add(o.value);
      else { marcados.clear(); marcados.add(o.value); }
      for (const [j, c] of cartoes.entries()) c.setAttribute('aria-checked', String(marcados.has(p.opcoes[j].value)));
    });
    if (!varios) el.addEventListener('dblclick', () => responder(o.value));
    if (marcados.has(o.value) && !varios) el.setAttribute('data-foco', '');
    return el;
  });
  const continuar = () => responder(varios ? p.opcoes.map((o) => o.value).filter((v) => marcados.has(v)) : [...marcados][0]);
  return [intro, h('h2', {}, p.msg), explicacao, h('div', { class: 'opcoes', role: varios ? 'group' : 'radiogroup', 'aria-label': p.msg }, cartoes),
    h('div', { class: 'botoes fixo' }, botao('Continuar', continuar))];
}

function cartaoPausa(pz) {
  const extras = [];
  if (pz.codigos.length) {
    const cod = pz.codigos[pz.codigos.length - 1];
    extras.push(h('div', { class: 'codigo' }, h('code', {}, cod), botao('Copiar o código', (e) => { S.copiar(cod); e.target.textContent = 'Copiado'; }, true)));
  }
  const link = pz.links.length ? pz.links[pz.links.length - 1] : null;
  let acoes = null;
  if (pz.acoes?.length || pz.pular || pz.links.length) {
    acoes = (h('div', { class: 'botoes' },
      link && botao('Abrir no navegador', () => S.abrirLink(link)),
      (pz.acoes || []).map((a) => botao(a.rotulo, () => S.abrirLink(a.url, a.app))),
      botao('Pedir ajuda', pedirAjuda, true),
      pz.pular ? botao(pz.pular, (e) => { S.pular(); e.target.disabled = true; e.target.textContent = 'Seguindo...'; }, true) : null));
  }
  return h('section', { class: pz.espera ? 'cartao espera' : 'cartao', role: 'status' },
    h('h2', {}, pz.espera ? pz.titulo : `✋ ${pz.titulo}`),
    pz.linhas.length ? h('ol', {}, pz.linhas.map((l) => h('li', {}, l))) : null,
    // Com botões de ação, eles vêm antes do desenho: em tela baixa o desenho empurrava os botões pra fora.
    acoes,
    pz.figura && FIGURAS[pz.figura] ? FIGURAS[pz.figura]() : null,
    pz.status ? h('p', { class: 'status-cartao' }, pz.status) : null,
    extras);
}

function telaInstalando() {
  const n = estado.atual + 1;
  return [
    estado.pausa && cartaoPausa(estado.pausa),
    h('div', { class: 'agora' }, h('span', { class: 'girando', 'aria-hidden': 'true' }),
      h('div', {}, h('b', {}, estado.tarefa || (estado.passos[estado.atual] ?? 'Preparando')),
        estado.passos.length && n > 0 ? h('div', { class: 'mut pequeno' }, `Passo ${n} de ${estado.passos.length}`) : null)),
    h('ul', { class: 'mensagens' }, estado.msgs.slice(-4).map((m) => h('li', { class: m.nivel }, m.texto))),
  ];
}

// Dicas de Terminal ("rode: ...") não servem pra quem está no app; o botão de resolver cobre esses casos.
const TECNICO = /^rode:|claude-setuper|https?:\/\//;
// O que a pessoa faz em cada pendência comum, sem comando.
const RESOLVER = 'O botão "Resolver o que falta" abre isso de novo pra você.';
const DICAS_APP = [
  [/^Login no Claude/, 'Falta entrar na sua conta do Claude. Sem isso ele ainda não consegue conversar com você.'],
  [/^Conta conectada|^Contas conectadas/, 'Falta entrar na sua conta do GitHub. ' + RESOLVER],
  [/^git sabe/, 'Se resolve sozinho quando a conta do GitHub estiver conectada.'],
  [/^Login na Vercel/, 'Falta entrar na sua conta da Vercel. ' + RESOLVER],
  [/^Extensão Claude no Chrome/, 'Falta adicionar a extensão do Claude no Chrome. ' + RESOLVER],
  [/^Complementos do Obsidian ligados/, 'Falta clicar em "Trust author and enable plugins" no Obsidian. ' + RESOLVER],
];
function dicaApp(i) {
  const d = DICAS_APP.find(([re]) => re.test(i.item));
  if (d) return d[1];
  return i.dica && !TECNICO.test(i.dica) ? i.dica : RESOLVER;
}

function telaFim() {
  // O que falta (em português simples) primeiro; o que ficou pronto vem resumido pelos nomes curtos.
  const faltas = estado.grupos.flatMap((g) => g.itens.filter((i) => !i.ok).map((i) => ({ ...i, grupo: g.nome })));
  const prontos = estado.grupos.filter((g) => g.itens.every((i) => i.ok)).map((g) => g.nome);
  const cm = estado.comecar || {};
  const nome = cm.nome || (estado.encerramento.match(/^Pronto, ([^.]+)\./) || [])[1] || '';
  // Sem login o Claude não conversa: dizer "Pronto" e pôr "Abrir o Claude" em destaque seria mentir pra pessoa.
  const semLogin = faltas.some((i) => /^Login no Claude/.test(i.item));
  const resolver = () => comecar('instalar');
  let titulo, texto;
  if (estado.soConferiu) { titulo = 'Conferência da instalação'; texto = ''; }
  else if (semLogin) { titulo = nome ? `Quase pronto, ${nome}.` : 'Quase pronto.'; texto = 'Falta só entrar na sua conta do Claude. Sem isso ele ainda não consegue conversar com você.'; }
  else { titulo = estado.encerramento.split('.')[0] + '.'; texto = estado.encerramento.split('. ').slice(1).join('. '); }
  return [
    h('h1', {}, titulo),
    texto && h('p', { class: 'mut' }, texto),
    h('div', { class: 'botoes' },
      semLogin
        ? [botao('Entrar na minha conta do Claude', resolver, false, { 'data-foco': true }), botao('Abrir o Claude mesmo assim', () => S.abrirClaude(), true)]
        : [botao('Abrir o Claude', () => S.abrirClaude(), false, { 'data-foco': true }), faltas.length ? botao('Resolver o que falta', resolver, true) : null]),
    !estado.soConferiu && !semLogin && paraComecar(cm),
    faltas.length
      ? h('section', { class: 'grupo' }, h('b', {}, faltas.length === 1 ? 'Falta 1 coisa, que depende de você' : `Faltam ${faltas.length} coisas, que dependem de você`),
        h('ul', {}, faltas.map((i) => h('li', { class: 'nao' }, h('span', { class: 's' }, '!'), h('span', {}, i.item, h('small', {}, dicaApp(i)))))),
        h('p', { class: 'mut pequeno rodape-grupo' }, 'Pode abrir o Claude Setuper de novo quando quiser: ele usa as mesmas respostas e faz só o que falta.'))
      : h('p', { class: 'mut' }, 'Tudo certo. Pode fechar esta janela.'),
    prontos.length > 0 && h('section', { class: 'grupo' }, h('b', {}, 'Pronto pra usar'),
      h('ul', { class: 'prontos' }, prontos.map((n) => h('li', { class: 'sim' }, h('span', { class: 's' }, '✓'), h('span', {}, n))))),
  ];
}

// "Pra começar": onde o Claude está, como voltar amanhã e três pedidos do cardápio do perfil.
function paraComecar(cm) {
  const ondeEsta = cm.maestri
    ? 'O Claude está na janela do Maestri. É só escrever pra ele, como numa conversa de mensagem.'
    : 'O Claude abre pelo atalho "Claude" na sua Área de Trabalho. É só escrever pra ele, como numa conversa de mensagem.';
  const voltar = cm.maestri
    ? 'Pra voltar amanhã, abre o Maestri: ele fica na pasta Aplicativos e no Launchpad.'
    : 'Pra voltar amanhã, é só abrir o mesmo atalho.';
  return h('section', { class: 'grupo comecar' }, h('b', {}, 'Pra começar'),
    h('ul', { class: 'lista-simples' }, h('li', {}, ondeEsta), h('li', {}, voltar),
      cm.notas ? h('li', {}, 'Nas suas notas tem o "Cardápio do Claude", com pedidos prontos do seu tipo de trabalho.') : null),
    cm.exemplos?.length ? [h('p', { class: 'mut pequeno exemplos-titulo' }, 'Alguns pedidos pra copiar e trocar o que está entre colchetes:'),
      h('ul', { class: 'exemplos' }, cm.exemplos.map((e) => h('li', {}, h('span', {}, e), botao('Copiar', (ev) => { S.copiar(e); ev.target.textContent = 'Copiado'; }, true))))] : null);
}

function telaFalha() {
  return [h('section', { class: 'cartao falha', role: 'alert' },
    h('h2', {}, 'Algo deu errado e eu precisei parar'),
    h('p', {}, estado.falha),
    h('p', { class: 'mut' }, 'Confere a internet e tenta de novo: eu continuo de onde parei. Se repetir, clica em Pedir ajuda e manda o arquivo pra quem te passou o Claude Setuper.'),
    h('div', { class: 'botoes' }, botao('Tentar de novo', () => comecar('instalar'), false, { 'data-foco': true }), botao('Pedir ajuda', pedirAjuda, true)))];
}


// ---------- figuras: onde clicar ----------
// Desenhos simples das janelas que a pessoa vai ver, com o botão certo marcado.
function alvo(texto, classe = '') { return h('span', { class: `alvo ${classe}` }, texto, h('span', { class: 'seta' }, 'clica aqui')); }
const FIGURAS = {
  'apple-ferramentas': () => h('figure', { class: 'figura mac' },
    h('div', { class: 'janela-mac' },
      h('div', { class: 'icone-mac', 'aria-hidden': 'true' }, '⚙︎'),
      h('p', {}, h('b', {}, 'O comando "xcode-select" requer as ferramentas de linha de comando para desenvolvedores.'), ' Deseja instalar as ferramentas agora?'),
      h('div', { class: 'botoes-mac' }, h('span', { class: 'bmac' }, 'Obter Xcode'), h('span', { class: 'bmac' }, 'Agora Não'), alvo('Instalar', 'bmac azul'))),
    h('figcaption', {}, 'É uma janela da própria Apple. Pode confiar.')),
  'obsidian-confiar': () => h('figure', { class: 'figura obsidian' },
    h('div', { class: 'janela-obsidian' },
      h('b', {}, 'Do you trust the author of this vault?'),
      h('span', { class: 'linha-cinza' }), h('span', { class: 'linha-cinza curta' }),
      h('div', { class: 'botoes-obsidian' }, alvo('Trust author and enable plugins', 'bobs'), h('span', { class: 'bobs apagado' }, 'Browse vault in Restricted Mode'))),
    h('figcaption', {}, 'A janela vem em inglês. Ela pergunta se pode ligar o Dataview e o Templater, os dois complementos mais usados do Obsidian. Pode confiar.')),
  'chrome-extensao': () => h('figure', { class: 'figura chrome' },
    h('div', { class: 'janela-chrome' },
      h('div', { class: 'loja-topo' }, h('span', { class: 'icone-loja', 'aria-hidden': 'true' }), h('b', {}, 'Claude'), alvo('Usar no Chrome', 'bchrome'))),
    h('figcaption', {}, 'É só um desenho do botão: o clique é na janela do Chrome. Se lá estiver escrito "Adicionar ao Chrome", é o mesmo. Se ele pedir a conta Google, pode pular.')),
};

// ---------- detalhes ----------
function anotar(texto) {
  detalhes.textContent = (detalhes.textContent + texto).slice(-20000);
  if (!detalhes.hidden) detalhes.scrollTop = detalhes.scrollHeight;
}
document.getElementById('pedir-ajuda').addEventListener('click', () => pedirAjuda());
document.getElementById('ver-detalhes').addEventListener('click', (e) => {
  detalhes.hidden = !detalhes.hidden;
  document.getElementById('aviso-detalhes').hidden = detalhes.hidden;
  e.target.setAttribute('aria-expanded', String(!detalhes.hidden));
  e.target.textContent = detalhes.hidden ? 'Ver detalhes técnicos' : 'Esconder detalhes técnicos';
  detalhes.scrollTop = detalhes.scrollHeight;
});

// ---------- eventos da instalação ----------
S.aoEvento((ev) => {
  switch (ev.tipo) {
    case 'inicio':
      estado.inicio = ev; estado.auto = ev.auto; estado.fase = 'inicio';
      document.getElementById('versao').textContent = `versão ${ev.versao}`;
      break;
    case 'atualizacao': estado.atualizacao = ev.versao; break;
    case 'abertura': if (estado.fase !== 'instalando') estado.fase = 'perguntas'; break;
    case 'plano': estado.passos = ev.passos; estado.atual = -1; estado.fase = 'instalando'; break;
    case 'passo': estado.atual = ev.n - 1; estado.pausa = null; estado.tarefa = ''; anotar(`\n── ${ev.n}/${ev.total} ${ev.titulo}\n`); break;
    case 'msg':
      anotar(`${ev.texto}\n`);
      if (estado.fase === 'perguntas' && ev.nivel === 'info') { estado.introPerguntas = ev.texto; break; }
      // Avisos informativos vão pros detalhes; com um cartão aberto, aparecem nele ("Estou esperando...").
      if (ev.nivel === 'info') { if (estado.pausa) estado.pausa.status = ev.texto; break; }
      estado.msgs.push(ev);
      estado.pausa = null;
      if (ev.nivel === 'erro' && estado.atual >= 0) estado.falhos.add(estado.atual);
      // Aviso dentro de um passo é coisa que ficou pra depois (um login, um clique): a etapa fica âmbar, não verde.
      if (ev.nivel === 'aviso' && estado.atual >= 0 && estado.fase === 'instalando') estado.pendentes.add(estado.atual);
      break;
    case 'tarefa':
      if (ev.estado === 'fazendo') estado.tarefa = ev.texto;
      else { estado.msgs.push({ nivel: ev.estado === 'feito' ? 'ok' : 'erro', texto: ev.texto }); estado.tarefa = ''; anotar(`${ev.texto}\n`); }
      break;
    case 'pausa': estado.pausa = { titulo: ev.titulo, linhas: ev.linhas, figura: ev.figura, acoes: ev.acoes || [], pular: ev.pular, espera: !!ev.espera, links: [], codigos: [] }; anotar(`✋ ${ev.titulo}\n`); break;
    case 'link':
    case 'codigo':
      estado.pausa ||= { titulo: 'Termine no navegador e volte pra cá', linhas: [], links: [], codigos: [] };
      if (ev.tipo === 'link') estado.pausa.links.push(ev.url); else estado.pausa.codigos.push(ev.codigo);
      break;
    case 'saida': anotar(ev.texto); return; // não redesenha a tela a cada linha
    case 'pedido': estado.pedido = { ...ev.pergunta, id: ev.id }; break;
    case 'encerramento': estado.encerramento = ev.texto; break;
    case 'fim': estado.fase = 'fim'; estado.grupos = ev.grupos; estado.soConferiu = ev.soConferiu; estado.comecar = ev.comecar || null; estado.pausa = null; estado.pedido = null; break;
    case 'falha': estado.fase = 'falha'; estado.falha = ev.texto; break;
  }
  desenhar();
  if (estado.auto) roteiro(ev);
});

// ---------- modo roteiro (só nos testes da VM) ----------
// Responde cada tela com o padrão (nome e idade vêm do arquivo de teste) e guarda um print de cada uma.
function print(nome) {
  setTimeout(() => S.print(nome), 1200); // rAF para numa janela em segundo plano, e a VM desenha devagar
}
function roteiro(ev) {
  const a = estado.auto;
  if (ev.tipo === 'inicio') {
    print('inicio');
    // Passa pela apresentação como a pessoa faria, com um print de cada tela.
    APRESENTACAO.forEach((_, i) => setTimeout(() => { apresentar(i); print(`apresentacao-${i + 1}`); }, 1500 + i * 2500));
    setTimeout(() => comecar('instalar'), 1500 + APRESENTACAO.length * 2500);
    return;
  }
  if (ev.tipo === 'pedido') {
    setTimeout(() => S.print('pergunta'), 300); // antes da resposta automática, que sai em 1,2 s
    const p = estado.pedido;
    const msg = p.msg || '';
    let valor = p.padrao;
    if (msg.includes('chame')) valor = a.nome || 'Teste';
    else if (msg.includes('anos')) valor = String(a.idade || '52');
    if (valor === undefined) valor = '';
    setTimeout(() => { if (estado.pedido?.id === ev.id) { estado.pedido = null; S.responder(ev.id, valor); desenhar(); } }, 1200);
    return;
  }
  if (['pausa', 'plano', 'fim', 'falha', 'codigo'].includes(ev.tipo)) print(ev.tipo);
}

S.pronto();
