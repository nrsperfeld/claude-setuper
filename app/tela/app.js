// Tela do app: recebe os eventos da instalação (os mesmos do Terminal) e desenha uma coisa por vez.
const S = window.setuper;
const palco = document.getElementById('palco');
const listaEtapas = document.getElementById('etapas');
const detalhes = document.getElementById('detalhes');

const estado = {
  fase: 'carregando', // inicio | perguntas | instalando | fim | falha
  inicio: null, atualizacao: null, auto: null,
  passos: [], atual: -1, falhos: new Set(),
  tarefa: '', msgs: [], pausa: null, pedido: null, introPerguntas: '',
  encerramento: '', grupos: [], soConferiu: false, falha: '',
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
  const perguntasFeitas = estado.fase !== 'inicio' && estado.fase !== 'perguntas' && estado.fase !== 'carregando';
  itens.push(['Algumas perguntas', perguntasFeitas ? 'feito' : estado.fase === 'perguntas' ? 'atual' : '']);
  if (estado.passos.length) {
    estado.passos.forEach((nome, i) => {
      let classe = '';
      if (estado.falhos.has(i)) classe = 'falhou';
      else if (i < estado.atual || estado.fase === 'fim') classe = 'feito';
      else if (i === estado.atual) classe = 'atual';
      itens.push([nome, classe]);
    });
  } else itens.push(['Instalação', '']);
  itens.push(['Pronto', estado.fase === 'fim' ? 'feito' : '']);
  listaEtapas.replaceChildren(...itens.map(([nome, classe]) => h('li', { class: classe, 'aria-current': classe === 'atual' ? 'step' : null }, h('span', { class: 'bola' }), h('span', {}, nome))));
}

// ---------- palco ----------
function desenhar() {
  desenharEtapas();
  let conteudo;
  if (estado.pedido) conteudo = telaPedido(estado.pedido);
  else if (estado.fase === 'inicio') conteudo = telaInicio();
  else if (estado.fase === 'perguntas') conteudo = [h('p', { class: 'mut' }, 'Um instante...')];
  else if (estado.fase === 'instalando') conteudo = telaInstalando();
  else if (estado.fase === 'fim') conteudo = telaFim();
  else if (estado.fase === 'falha') conteudo = telaFalha();
  else conteudo = [];
  palco.replaceChildren(...[conteudo].flat(3).filter((x) => x != null && x !== false));
  const foco = palco.querySelector('[data-foco]');
  if (foco) foco.focus();
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
      : 'Leva uns 15 minutos. Primeiro umas perguntas rápidas, depois eu instalo tudo sozinho. Quando eu precisar de você, aparece um cartão amarelo dizendo exatamente o que fazer.'),
    h('div', { class: 'botoes' },
      botao(temInstalacao ? 'Continuar a instalação' : 'Começar', () => comecar('instalar'), false, { 'data-foco': true }),
      temInstalacao && botao('Só conferir', () => comecar('conferir'), true)),
  ];
}

function comecar(modo) {
  estado.fase = modo === 'instalar' ? 'perguntas' : 'instalando';
  if (modo !== 'instalar') estado.tarefa = 'Conferindo o que está instalado';
  desenhar();
  S.iniciar(modo);
}

function telaPedido(p) {
  const intro = estado.fase === 'perguntas' && estado.introPerguntas ? h('p', { class: 'mut pequeno' }, estado.introPerguntas) : null;
  const responder = (valor) => { estado.pedido = null; S.responder(p.id, valor); desenhar(); };

  if (p.tipo === 'texto' || p.tipo === 'senha') {
    const campo = h('input', { type: p.tipo === 'senha' ? 'password' : 'text', placeholder: p.placeholder || '', 'aria-label': p.msg, 'data-foco': true, autocomplete: 'off', spellcheck: 'false' });
    if (p.padrao) campo.value = p.padrao;
    const enviarCampo = () => responder(campo.value);
    campo.addEventListener('keydown', (e) => { if (e.key === 'Enter') enviarCampo(); });
    return [intro, h('h2', {}, p.msg), campo, h('div', { class: 'erro-campo', role: 'alert' }, p.erro || ''), h('div', { class: 'botoes' }, botao('Continuar', enviarCampo))];
  }

  if (p.tipo === 'confirmar') {
    return [intro, h('h2', {}, p.msg), h('div', { class: 'botoes' },
      botao('Sim', () => responder(true), !p.padrao, p.padrao ? { 'data-foco': true } : {}),
      botao('Não', () => responder(false), !!p.padrao, p.padrao ? {} : { 'data-foco': true }))];
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
  return [intro, h('h2', {}, p.msg), h('div', { class: 'opcoes', role: varios ? 'group' : 'radiogroup', 'aria-label': p.msg }, cartoes),
    h('div', { class: 'botoes' }, botao('Continuar', continuar))];
}

function cartaoPausa(pz) {
  const extras = [];
  if (pz.codigos.length) {
    const cod = pz.codigos[pz.codigos.length - 1];
    extras.push(h('div', { class: 'codigo' }, h('code', {}, cod), botao('Copiar o código', (e) => { S.copiar(cod); e.target.textContent = 'Copiado'; }, true)));
  }
  if (pz.links.length) {
    const url = pz.links[pz.links.length - 1];
    extras.push(h('div', { class: 'botoes' }, botao('Abrir no navegador', () => S.abrirLink(url))));
  }
  return h('section', { class: 'cartao', role: 'status' },
    h('h2', {}, `✋ ${pz.titulo}`),
    pz.linhas.length ? h('ol', {}, pz.linhas.map((l) => h('li', {}, l))) : null,
    extras);
}

function telaInstalando() {
  const n = estado.atual + 1;
  return [
    estado.pausa && cartaoPausa(estado.pausa),
    h('div', { class: 'agora' }, h('span', { class: 'girando', 'aria-hidden': 'true' }),
      h('div', {}, h('b', {}, estado.tarefa || (estado.passos[estado.atual] ?? 'Preparando')),
        estado.passos.length && n > 0 ? h('div', { class: 'mut pequeno' }, `Passo ${n} de ${estado.passos.length}`) : null)),
    h('ul', { class: 'mensagens' }, estado.msgs.slice(-6).map((m) => h('li', { class: m.nivel }, m.texto))),
  ];
}

function telaFim() {
  const faltas = estado.grupos.flatMap((g) => g.itens.filter((i) => !i.ok));
  const titulo = estado.soConferiu ? 'Conferência da instalação' : (estado.encerramento.split('.')[0] + '.');
  return [
    h('h1', {}, titulo),
    !estado.soConferiu && h('p', { class: 'mut' }, estado.encerramento.split('. ').slice(1).join('. ')),
    h('div', { class: 'botoes' }, botao('Abrir o Claude', () => S.abrirClaude(), false, { 'data-foco': true }),
      faltas.length ? botao('Tentar resolver o que falta', () => comecar('instalar'), true) : null),
    h('p', { class: 'mut pequeno' }, faltas.length
      ? `${faltas.length === 1 ? 'Ficou 1 coisa' : `Ficaram ${faltas.length} coisas`} pra você terminar, quase sempre uma conta ou um clique. Pode abrir o Claude Setuper de novo quando quiser: ele continua de onde parou.`
      : 'Tudo certo. Pode fechar esta janela.'),
    estado.grupos.map((g) => h('div', { class: 'grupo' }, h('b', {}, g.nome), h('ul', {},
      g.itens.map((i) => h('li', { class: i.ok ? 'sim' : 'nao' }, h('span', { class: 's' }, i.ok ? '✓' : '!'), h('span', {}, i.item, !i.ok && i.dica ? h('small', {}, i.dica) : null)))))),
  ];
}

function telaFalha() {
  return [h('section', { class: 'cartao falha', role: 'alert' },
    h('h2', {}, 'Algo deu errado e eu precisei parar'),
    h('p', {}, estado.falha),
    h('p', { class: 'mut' }, 'Confere a internet e tenta de novo: eu continuo de onde parei. Se repetir, manda o registro pra quem te passou o Claude Setuper.'),
    h('div', { class: 'botoes' }, botao('Tentar de novo', () => comecar('instalar'), false, { 'data-foco': true }), botao('Abrir o registro', () => S.mostrarRegistro(), true)))];
}

// ---------- detalhes ----------
function anotar(texto) {
  detalhes.textContent = (detalhes.textContent + texto).slice(-20000);
  if (!detalhes.hidden) detalhes.scrollTop = detalhes.scrollHeight;
}
document.getElementById('ver-detalhes').addEventListener('click', (e) => {
  detalhes.hidden = !detalhes.hidden;
  e.target.setAttribute('aria-expanded', String(!detalhes.hidden));
  e.target.textContent = detalhes.hidden ? 'Ver detalhes' : 'Esconder detalhes';
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
      estado.msgs.push(ev);
      if (ev.nivel !== 'info') estado.pausa = null;
      if (ev.nivel === 'erro' && estado.atual >= 0) estado.falhos.add(estado.atual);
      break;
    case 'tarefa':
      if (ev.estado === 'fazendo') estado.tarefa = ev.texto;
      else { estado.msgs.push({ nivel: ev.estado === 'feito' ? 'ok' : 'erro', texto: ev.texto }); estado.tarefa = ''; anotar(`${ev.texto}\n`); }
      break;
    case 'pausa': estado.pausa = { titulo: ev.titulo, linhas: ev.linhas, links: [], codigos: [] }; anotar(`✋ ${ev.titulo}\n`); break;
    case 'link':
    case 'codigo':
      estado.pausa ||= { titulo: 'Termine no navegador e volte pra cá', linhas: [], links: [], codigos: [] };
      if (ev.tipo === 'link') estado.pausa.links.push(ev.url); else estado.pausa.codigos.push(ev.codigo);
      break;
    case 'saida': anotar(ev.texto); return; // não redesenha a tela a cada linha
    case 'pedido': estado.pedido = { ...ev.pergunta, id: ev.id }; break;
    case 'encerramento': estado.encerramento = ev.texto; break;
    case 'fim': estado.fase = 'fim'; estado.grupos = ev.grupos; estado.soConferiu = ev.soConferiu; estado.pausa = null; break;
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
  if (ev.tipo === 'inicio') { print('inicio'); setTimeout(() => comecar('instalar'), 1500); return; }
  if (ev.tipo === 'pedido') {
    print('pergunta');
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
