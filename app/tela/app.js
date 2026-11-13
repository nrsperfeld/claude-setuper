// Tela do app: recebe os eventos da instalação (os mesmos do Terminal) e desenha uma coisa por vez.
// O desenho aprovado está em docs/superpowers/specs/2026-11-07-redesenho-experiencia-design.md.
const S = window.setuper;
const palco = document.getElementById('palco');
const janela = document.getElementById('janela');
const faixa = document.getElementById('faixa');
const rodape = document.getElementById('rodape');
const folha = document.getElementById('folha');
const anuncio = document.getElementById('anuncio');
const clarao = document.getElementById('clarao');
const seletorIdioma = document.getElementById('idioma');

const estado = {
  fase: 'carregando', // carregando | presente | preparo | inicio | demo | confirma | perguntas | instalando | portal | video | fim | falha
  inicio: null, atualizacao: null, auto: null, catalogo: {}, idioma: 'pt', plataforma: 'darwin',
  passos: [], pesos: [], atual: -1, mostrado: 0, desdePasso: 0, falhos: new Set(), pendentes: new Set(), comecar: null,
  tarefa: '', demora: '', desde: 0, mexeu: 0, tarefaId: null, msgs: [], pausa: null, pedido: null,
  encerramento: '', grupos: [], soConferiu: false, falha: '', exemplos: [], exemplo: 0, feitos: [],
  folha: null, // null | 'detalhes' | 'fechar' | ajuda: 'gerando' | { arquivo, nome, pasta } | { erro }
  detalhes: '',
};

const t = (texto, vars) => { const r = t0(texto, vars); return estado.inicio?.presente ? r.replaceAll('Claude Setuper', 'Segundo Cérebro') : r; };
const t0 = (texto, vars) => {
  const base = estado.catalogo[texto] ?? texto;
  return vars ? base.replace(/\{(\w+)\}/g, (m, k) => (vars[k] ?? m)) : base;
};

// Monta elementos sem innerHTML: todo texto entra como texto. css: propriedades pelo CSSOM, que a CSP deixa passar.
function h(tag, attrs = {}, ...filhos) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'css') for (const [p, val] of Object.entries(v)) el.style.setProperty(p, val);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const f of filhos.flat(3)) if (f != null && f !== false) el.append(f.nodeType ? f : String(f));
  return el;
}
const botao = (texto, onclick, tipo = 'btn', extra = {}) => h('button', { class: tipo, type: 'button', onclick, ...extra }, texto);
const portal = (tam, classe = '') => h('div', { class: `portal ${classe}`, css: { '--t': tam } }, ['p-halo', 'p-nucleo', 'p-a p-c', 'p-a', 'p-a p-b'].map((c) => h('i', { class: c })));
const portalLeve = (tam) => h('div', { class: 'portal', css: { '--t': tam } }, ['p-halo', 'p-nucleo', 'p-a', 'p-a p-b'].map((c) => h('i', { class: c })));
const anel = (tam, p, classe = '', meio) => h('div', { class: `anel ${classe}`, css: { '--t': tam, '--p': String(p) } }, meio != null ? h('div', { class: 'meio' }, meio) : null);
const icCerto = () => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 18 18'); s.setAttribute('class', 'ic'); s.setAttribute('aria-hidden', 'true'); s.innerHTML = '<path d="M4 9.5l3.5 3.5L14 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'; return s; };
const icFalta = () => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 18 18'); s.setAttribute('class', 'ic a'); s.setAttribute('aria-hidden', 'true'); s.innerHTML = '<path d="M9 4v6M9 13.5v.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'; return s; };

// ---------- progresso ----------
// Decisão do Nathan: a sensação de progresso pesa mais que o número exato. A porcentagem nunca salta nem volta:
// sobe devagar enquanto a etapa trabalha, sem passar do fim dela, e quando a etapa acaba antes ela sobe contando.
const SOBE_POR_SEGUNDO = 2;
const SOBE_NO_FIM = 14;
const SEGUNDOS_POR_PESO = 12;
function destino() {
  const pesos = estado.pesos.length === estado.passos.length && estado.pesos.length ? estado.pesos : estado.passos.map(() => 1);
  const total = pesos.reduce((a, b) => a + b, 0) || 1;
  const atual = Math.max(estado.atual, 0);
  const feitas = pesos.slice(0, atual).reduce((a, b) => a + b, 0);
  const peso = pesos[atual] || 0;
  // Curva que desacelera: anda sempre um pouco e nunca chega no fim da etapa antes de ela terminar de verdade.
  const dentro = 1 - Math.exp(-(Date.now() - (estado.desdePasso || Date.now())) / (Math.max(peso, 1) * SEGUNDOS_POR_PESO * 1000));
  return Math.min(99, ((feitas + peso * 0.97 * dentro) / total) * 100);
}
function porcentagem() {
  return estado.fase === 'fim' || estado.fase === 'portal' ? 100 : Math.floor(estado.mostrado);
}
// Na vez da pessoa o número espera por ela; depois retoma de onde estava.
function andarProgresso(segundos) {
  if (estado.fase !== 'instalando' || (estado.pausa && !estado.pausa.espera)) return;
  const antes = Math.floor(estado.mostrado);
  estado.mostrado = Math.min(Math.max(estado.mostrado, destino()), estado.mostrado + SOBE_POR_SEGUNDO * segundos);
  if (Math.floor(estado.mostrado) !== antes) pintarProgresso();
}
function pintarProgresso() {
  const a = document.querySelector('.anel[data-progresso]');
  if (!a) return;
  a.style.setProperty('--p', String(Math.floor(estado.mostrado)));
  const m = a.querySelector('.meio');
  if (m) m.textContent = `${Math.floor(estado.mostrado)}%`;
}
// A instalação acabou: o número termina de subir até 100, e só então o portal abre.
function subirAte100(depois) {
  const t0 = setInterval(() => {
    estado.mostrado = Math.min(100, estado.mostrado + SOBE_NO_FIM * 0.1);
    pintarProgresso();
    if (estado.mostrado >= 100) { clearInterval(t0); setTimeout(depois, 350); }
  }, 100);
}

// ---------- desenho ----------
let ultimaTela = '';
function chaveDaTela() {
  if (estado.pedido) return `pedido:${estado.pedido.id}`;
  if (estado.fase === 'instalando') return `instalando:${estado.pausa?.titulo || ''}`;
  return estado.fase;
}
function desenhar() {
  const telas = { presente: telaPresente, preparo: telaPreparo, inicio: telaInicio, demo: telaDemo, confirma: telaConfirma, perguntas: () => [h('p', { class: 't2' }, t('Um instante...'))], instalando: telaInstalando, portal: telaPortal, video: telaVideo, fim: telaFim, falha: telaFalha };
  const conteudo = estado.pedido ? telaPedido(estado.pedido) : (telas[estado.fase]?.() ?? []);
  const tela = chaveDaTela();
  const mesma = tela === ultimaTela;
  const rolagem = palco.scrollTop;
  const digitado = palco.querySelector('input')?.value;
  const comFoco = palco.querySelector('input') === document.activeElement;
  const marcas = [...palco.querySelectorAll('.ops')].map((o) => o.scrollTop);
  palco.className = estado.pedido ? 'palco' : 'palco';
  palco.replaceChildren(...[conteudo].flat(3).filter((x) => x != null && x !== false));
  if (mesma) {
    palco.scrollTop = rolagem;
    const campo = palco.querySelector('input');
    if (campo && digitado != null) campo.value = digitado;
    if (campo && comFoco) campo.focus();
    [...palco.querySelectorAll('.ops')].forEach((o, i) => { o.scrollTop = marcas[i] || 0; });
  } else {
    ultimaTela = tela;
    palco.scrollTop = 0;
    palco.querySelector('[data-foco]')?.focus();
    const titulo = palco.querySelector('h1, h2');
    if (titulo) anuncio.textContent = titulo.textContent;
  }
  desenharEntorno();
  desenharFolha();
}
function desenharEntorno() {
  // A troca de idioma só aparece antes de começar.
  const mostraIdioma = ['inicio', 'demo', 'confirma'].includes(estado.fase) && !estado.pedido;
  seletorIdioma.hidden = !mostraIdioma;
  if (mostraIdioma) seletorIdioma.replaceChildren(...['pt', 'en'].flatMap((id, i) => {
    const nome = id === 'pt' ? 'Português' : 'English';
    const item = estado.idioma === id ? h('span', {}, nome) : botao(nome, () => S.trocarIdioma(id), 'link');
    return i ? [h('span', { class: 't3', 'aria-hidden': 'true' }, '·'), item] : [item];
  }));
  // A faixa diz o que está sendo preparado atrás das perguntas.
  const preparando = estado.pedido && !estado.passos.length && estado.tarefa;
  faixa.hidden = !preparando;
  if (preparando) faixa.replaceChildren(h('div', { class: 'anel', 'aria-hidden': 'true' }), h('span', {}, t('Enquanto você responde: {tarefa}', { tarefa: estado.tarefa })));
  const comRodape = estado.fase === 'instalando' && !estado.pedido;
  rodape.hidden = !comRodape;
  document.getElementById('pedir-ajuda').textContent = t('Precisa de ajuda?');
  document.getElementById('ver-feito').textContent = t('Ver o que já foi feito');
  janela.classList.toggle('brilho', !['falha', 'portal', 'video'].includes(estado.fase));
}

// ---------- boas-vindas ----------
function telaInicio() {
  const { temInstalacao, nome } = estado.inicio || {};
  const faixaNova = estado.atualizacao && h('div', { class: 'bloco', css: { display: 'flex', 'align-items': 'center', gap: '16px', width: '560px', 'margin-bottom': '30px' } },
    h('div', { css: { flex: '1' } }, h('h3', {}, t('Tem uma versão nova do Claude Setuper')), h('p', { class: 't2 peq' }, t('Atualizo agora e abro de novo em menos de um minuto.'))),
    botao(t('Atualizar'), () => S.atualizar(), 'btn p'));
  if (temInstalacao && estado.inicio.tudoPronto) {
    return [faixaNova, portal('130px'), h('h1', { css: { 'margin-top': '30px' } }, nome ? t('Está tudo instalado, {nome}.', { nome }) : t('Está tudo instalado.')),
      h('p', { class: 'lead' }, estado.plataforma === 'darwin' ? t('Posso abrir o Maestri de novo. Se a aula ficou pela metade, ela continua de onde parou, e no fim dela ficam os opcionais, como a Vercel e os conectores.') : t('Posso abrir a IA de novo. Se a aula ficou pela metade, ela continua de onde parou, e no fim dela ficam os opcionais, como a Vercel e os conectores.')),
      h('div', { class: 'botoes' }, botao(estado.plataforma === 'darwin' ? t('Abrir o Maestri') : t('Abrir a IA'), () => S.concluir(), 'btn', { 'data-foco': true }), botao(t('Só conferir'), () => comecar('conferir'), 'btn2'))];
  }
  if (temInstalacao) {
    return [faixaNova, anel('170px', estado.inicio.progresso ?? 0, '', `${estado.inicio.progresso ?? 0}%`),
      h('h1', { css: { 'margin-top': '30px' } }, nome ? t('Que bom te ver de novo, {nome}.', { nome }) : t('Que bom te ver de novo.')),
      h('p', { class: 'lead' }, t('Posso continuar de onde a instalação parou, usando as mesmas respostas, e não vou repetir nada do que já ficou pronto.')),
      h('div', { class: 'botoes' }, botao(t('Continuar de onde parou'), () => comecar('instalar'), 'btn', { 'data-foco': true }), botao(t('Só conferir'), () => comecar('conferir'), 'btn2'))];
  }
  const primeira = estado.inicio?.primeiraAbertura !== false;
  return [faixaNova, portal(faixaNova ? '130px' : '230px', primeira ? 'nasce' : ''), h('div', { css: { height: faixaNova ? '36px' : '50px' } }),
    h('h1', { class: primeira ? 'sobe d1' : '' }, t('Você não precisa de um curso sobre IA')),
    h('p', { class: `lead ${primeira ? 'sobe d2' : ''}` }, t('Tudo que você aprendeu na vida, aprendeu fazendo. Você só precisa da ferramenta certa pra começar hoje!')),
    h('div', { class: `botoes ${primeira ? 'sobe d3' : ''}` }, botao(t('Começar'), () => irPara('demo'), 'btn', { 'data-foco': true }))];
}
function telaDemo() {
  // Uma conversa de verdade: a pessoa vê o pedido, a IA pedindo permissão, o trabalho feito e o que ela guardou.
  const fala = (quem, texto, atraso) => h('p', { class: `balao ${quem} sobe`, css: { 'animation-delay': `${atraso}s` } }, texto);
  return [h('h2', {}, t('Funciona assim: você conversa com ela, e ela faz no seu computador')),
    h('div', { class: 'conversa' },
      fala('voce', t('Organiza a minha pasta Downloads em pastas por tipo, sem apagar nada.'), 0.2),
      fala('ia', t('Posso criar três pastas, Documentos, Imagens e Planilhas, e mover cada arquivo pra sua. Nada vai ser apagado. Pode ser?'), 1.2),
      fala('voce', t('Pode.'), 2.4),
      fala('ia', t('Pronto, está tudo separado. Anotei aqui que você gosta das coisas por tipo, então da próxima vez já faço assim.'), 3.2)),
    h('div', { class: 'botoes' }, botao(t('Continuar'), () => irPara('confirma'), 'btn', { 'data-foco': true }))];
}
function telaConfirma() {
  const mac = estado.plataforma === 'darwin';
  const item = (b, s) => h('div', { class: 'linha', css: { padding: '5px 0' } }, h('div', {}, h('b', {}, b), h('p', { class: 't2 peq' }, s)));
  return [h('h2', {}, t('Tudo pronto pra começar')),
    h('p', { class: 't2' }, t('Nada do que você já tem no computador é apagado.')),
    h('div', { css: { display: 'grid', 'grid-template-columns': 'repeat(2,minmax(0,1fr))', gap: '12px', width: '768px', 'max-width': '100%', 'margin-top': '22px' } },
      h('div', { class: 'bloco' }, h('h3', { css: { 'margin-bottom': '4px' } }, t('O que eu vou instalar')),
        item(t('A IA'), t('Ela se chama Claude e vai trabalhar com você, direto no seu computador')),
        item('Obsidian', t('O caderno das suas notas e da memória da IA')),
        mac ? item('Maestri', t('A janela onde você conversa com ela')) : item(t('Atalho da IA'), t('Fica na sua Área de Trabalho')),
        item('Google Chrome', t('Só se você ainda não tiver')),
        item('GitHub', t('Guarda uma cópia do seu trabalho. A conta é de graça'))),
      h('div', { class: 'bloco' }, h('h3', { css: { 'margin-bottom': '4px' } }, t('O que você precisa deixar à mão')),
        item(t('Tomada e internet'), t('Leva uns 20 minutos')),
        mac ? item(t('A senha do computador'), t('Aquela que você digita na tela de bloqueio')) : item(t('Um Sim para o Windows'), t('Ele pode perguntar se pode instalar: é só clicar em Sim')),
        item(t('Uma conta no Claude'), t('É o site da IA. Precisa de plano pago, Pro ou maior. Se ainda não tem, dá pra criar e assinar quando eu pedir')))),
    h('p', { class: 't3 peq', css: { 'margin-top': '14px', 'max-width': '700px' } }, mac
      ? t('Também deixo agendados um backup das notas e uma atualização por semana, e passo os seus prints de tela pra pasta Imagens > Prints, pra IA conseguir ler. Enquanto eu baixo o que precisa, te faço umas perguntas.')
      : t('Também deixo agendados um backup das notas e uma atualização por semana. Enquanto eu baixo o que precisa, te faço umas perguntas.')),
    h('div', { class: 'botoes', css: { 'margin-top': '18px' } }, botao(t('Instalar'), () => comecar('instalar'), 'btn', { 'data-foco': true }))];
}
function irPara(fase) { estado.fase = fase; desenhar(); if (estado.auto) S.print(fase); }

// ---------- presente: a carta de abertura e o que deixar à mão ----------
function telaPresente() {
  const pr = estado.inicio.presente;
  const rc = pr.recado || {};
  return [pr.signo ? h('img', { class: 'signo', src: pr.signo, alt: '' }) : portal('130px', 'nasce'),
    h('p', { class: 'peq sobe d1', css: { color: 'var(--ambar)', 'font-weight': '600', 'margin-bottom': '8px', 'margin-top': pr.signo ? '0' : '42px' } }, pr.rotulo),
    rc.titulo ? h('h1', { class: 'sobe d1' }, rc.titulo) : null,
    h('p', { class: 'corpo-carta sobe d2' }, String(rc.texto || '').trim()),
    rc.assinatura ? h('p', { class: 'med sobe d2', css: { 'margin-top': '14px' } }, rc.assinatura) : null,
    h('div', { class: 'botoes sobe d3' }, botao(t('Começar'), () => irPara('preparo'), 'btn', { 'data-foco': true }))];
}
function telaPreparo() {
  return [h('h2', {}, t('Antes de começar')),
    h('p', { class: 'lead' }, t('Leva uns 20 minutos. As suas notas e as respostas já vieram prontas, então eu instalo quase tudo sozinho. Quando precisar de você, pra senha ou pra entrar numa conta, aparece uma janelinha na frente de tudo dizendo o que fazer.')),
    h('div', { class: 'bloco', css: { width: '520px', 'max-width': '100%', 'margin-top': '20px' } }, h('h3', {}, t('Deixa à mão')),
      h('ul', { class: 'lista-pontos t2' }, h('li', {}, t('O computador na tomada e com internet.')), h('li', {}, t('A senha do computador, a que você digita na tela de bloqueio.')), h('li', {}, t('O e-mail da sua conta no Claude, a sua IA, pra entrar nela quando eu pedir.')))),
    h('div', { class: 'botoes' }, botao(t('Vamos lá'), () => comecar('instalar'), 'btn', { 'data-foco': true }))];
}

function comecar(modo) {
  estado.fase = modo === 'instalar' ? 'perguntas' : 'instalando';
  estado.falhos.clear(); estado.pendentes.clear(); estado.msgs = []; estado.feitos = [];
  if (modo !== 'instalar') estado.tarefa = t('Conferindo o que está instalado');
  desenhar();
  S.iniciar(modo);
}

// ---------- perguntas ----------
function telaPedido(p) {
  const explicacao = p.explicacao ? h('p', { class: 't2', css: { 'max-width': '600px' } }, p.explicacao) : null;
  const responder = (valor) => { estado.pedido = null; S.responder(p.id, valor); desenhar(); };

  if (p.tipo === 'texto' || p.tipo === 'senha') {
    const campo = h('input', { class: 'campo', type: p.tipo === 'senha' ? 'password' : 'text', placeholder: p.placeholder || '', 'aria-label': p.msg, 'data-foco': true, autocomplete: 'off', spellcheck: 'false' });
    if (p.padrao) campo.value = p.padrao;
    campo.addEventListener('keydown', (e) => { if (e.key === 'Enter') responder(campo.value); });
    return [portalLeve('96px'), h('div', { css: { height: '40px' } }), h('h2', { css: { 'margin-bottom': explicacao ? '8px' : '22px' } }, p.msg), explicacao, explicacao ? h('div', { css: { height: '16px' } }) : null, campo,
      h('div', { class: 'erro-campo', role: 'alert' }, p.erro || ''), h('div', { class: 'botoes', css: { 'margin-top': '10px' } }, botao(t('Continuar'), () => responder(campo.value)))];
  }
  if (p.tipo === 'confirmar') {
    return [h('h2', {}, p.msg), explicacao, h('div', { class: 'botoes' },
      botao(p.sim || t('Sim'), () => responder(true), p.padrao ? 'btn' : 'btn2', p.padrao ? { 'data-foco': true } : {}),
      p.nao === '' ? null : botao(p.nao || t('Não'), () => responder(false), p.padrao ? 'btn2' : 'btn', p.padrao ? {} : { 'data-foco': true }))];
  }
  // escolher (uma) ou varios (várias)
  const varios = p.tipo === 'varios';
  const marcados = new Set(varios ? p.padrao || [] : [p.padrao]);
  const cartoes = p.opcoes.map((o, i) => {
    const el = h('button', { class: `op${varios ? ' varios' : ''}`, type: 'button', role: varios ? 'checkbox' : 'radio', 'aria-checked': String(marcados.has(o.value)), 'data-foco': (!marcados.size && i === 0) || (!varios && marcados.has(o.value)) ? true : null },
      h('span', { class: 'marca' }), h('span', {}, h('b', {}, o.label), o.hint ? h('small', {}, o.hint) : null));
    el.addEventListener('click', () => {
      if (varios) { if (marcados.has(o.value)) marcados.delete(o.value); else marcados.add(o.value); } else { marcados.clear(); marcados.add(o.value); }
      cartoes.forEach((c, j) => { const on = marcados.has(p.opcoes[j].value); c.setAttribute('aria-checked', String(on)); c.classList.toggle('on', on); });
    });
    if (!varios) el.addEventListener('dblclick', () => responder(o.value));
    if (marcados.has(o.value)) el.classList.add('on');
    return el;
  });
  const continuar = () => responder(varios ? p.opcoes.map((o) => o.value).filter((v) => marcados.has(v)) : [...marcados][0]);
  return [h('h2', {}, p.msg), explicacao, h('div', { class: 'ops', role: varios ? 'group' : 'radiogroup', 'aria-label': p.msg }, cartoes),
    h('div', { class: 'botoes', css: { 'margin-top': '18px' } }, botao(t('Continuar'), continuar))];
}

// ---------- instalação ----------
function tempo(ms) {
  const min = Math.floor(ms / 60000);
  const seg = Math.floor(ms / 1000);
  return min < 1 ? (seg === 1 ? t('1 segundo') : t('{n} segundos', { n: seg })) : min === 1 ? t('1 minuto') : t('{n} minutos', { n: min });
}
function textoRelogio() {
  if (!estado.desde) return '';
  const passou = t('Trabalhando há {tempo}.', { tempo: tempo(Date.now() - estado.desde) });
  return Date.now() - estado.desde < 3000 ? t('Trabalhando.') : estado.demora ? `${passou} ${t('Costuma levar {demora}.', { demora: estado.demora.replace(/, (é normal|which is normal)$/, '') })}` : passou;
}
// Login do Claude que terminou na página "Authentication code": a pessoa cola o código aqui e o login continua.
function campoDoCodigo(pz) {
  const campo = h('input', { class: 'campo', type: 'text', placeholder: t('Cola o código aqui'), 'aria-label': t('Código do login do Claude'), autocomplete: 'off', spellcheck: 'false', css: { width: '100%' } });
  const mandar = () => { if (campo.value.trim()) { S.colarCodigo(campo.value.trim()); campo.value = ''; } };
  campo.addEventListener('keydown', (e) => { if (e.key === 'Enter') mandar(); });
  return h('div', { class: 'bloco', css: { width: '560px', 'max-width': '100%', 'margin-top': '20px' } },
    h('h3', {}, t('O navegador mostrou um código?')),
    h('p', { class: 't2 peq', css: { margin: '4px 0 12px' } }, t('Se apareceu uma página escrita Authentication code, clica no botão de copiar que tem nela, volta aqui e cola o código no campo abaixo. Depois disso eu termino o login sozinho.')),
    campo,
    h('div', { class: 'g-acoes' }, botao(t('Continuar o login'), mandar, 'btn p')),
    pz.status ? h('p', { class: 't3 peq', role: 'status', css: { 'margin-top': '8px' } }, pz.status) : null);
}
const PARADO = 4 * 60000;
const progresso = (el) => { el.dataset.progresso = '1'; return el; };
function telaInstalando() {
  const pz = estado.pausa;
  const p = porcentagem();
  if (pz && !pz.espera) {
    return [progresso(anel(pz.colar ? '110px' : '150px', p, 'vez')), h('div', { css: { height: pz.colar ? '18px' : '26px' } }),
      h('h2', { css: { 'font-size': '24px', 'line-height': '30px' } }, t('Agora é com você')),
      h('p', { class: 'lead' }, t('O passo a passo está na janelinha do canto, que fica na frente de tudo. Quando você terminar, eu sigo sozinho.')),
      pz.colar ? campoDoCodigo(pz) : null];
  }
  const parado = !pz && estado.mexeu && Date.now() - estado.mexeu >= PARADO;
  const exemplo = estado.exemplos.length ? estado.exemplos[estado.exemplo % estado.exemplos.length] : null;
  return [progresso(anel(parado ? '150px' : '190px', p, '', `${p}%`)), h('div', { css: { height: '26px' } }),
    h('h2', { css: { 'font-size': '24px', 'line-height': '30px' } }, pz ? pz.titulo : (estado.tarefa || estado.passos[estado.atual] || t('Preparando'))),
    pz ? (pz.linhas || []).map((l) => h('p', { class: 't2' }, l)) : h('p', { class: 't2', id: 'relogio' }, textoRelogio()),
    pz?.status ? h('p', { class: 't3 peq', css: { 'margin-top': '6px' } }, pz.status) : null,
    parado ? h('div', { class: 'bloco', id: 'parado', css: { width: '560px', 'max-width': '100%', 'margin-top': '22px' } },
      h('h3', {}, t('Faz {tempo} que esta parte não muda na tela', { tempo: tempo(Date.now() - estado.mexeu) })),
      h('p', { class: 't2 peq', css: { 'margin-top': '4px' } }, t('Em computador mais antigo ou internet mais lenta isso acontece, e eu continuo trabalhando nos bastidores. Se der algum problema, aviso aqui. Se passar de 15 minutos assim, clica em Pedir ajuda.')),
      h('div', { class: 'g-acoes' }, botao(t('Pedir ajuda'), pedirAjuda, 'btn2 p')))
      : exemplo ? h('div', { class: 'bloco', css: { width: '560px', 'max-width': '100%', 'margin-top': '24px' } },
        h('p', { class: 't3 peq', css: { 'margin-bottom': '4px' } }, t('Um exemplo do que você vai poder pedir:')), h('p', {}, exemplo)) : null,
    parado ? null : h('p', { class: 't3 peq', css: { 'margin-top': '16px' } }, t('Pode fazer outra coisa enquanto isso. Quando eu precisar de você, esta janela se destaca na frente das outras e toca um som.')),
    estado.msgs.filter((m) => m.nivel === 'aviso' || m.nivel === 'erro').slice(-2).map((m) => h('p', { class: m.nivel === 'erro' ? 'status-erro peq' : 't2 peq', css: { 'margin-top': '8px' } }, m.texto))];
}

// ---------- fim: o anel fecha, abre, vem o vídeo e depois o Maestri ----------
const faltas = () => estado.grupos.flatMap((g) => g.itens.filter((i) => !i.ok).map((i) => ({ ...i, grupo: g.nome })));
const semLogin = () => faltas().some((i) => /^Login no Claude/.test(i.chave || i.item));
function telaPortal() {
  return [h('div', { class: 'abre-uma' }, portalLeve('190px')), h('div', { css: { height: '40px' } }), h('h2', { class: 'apaga-uma' }, estado.comecar?.nome ? t('Pronto, {nome}.', { nome: estado.comecar.nome }) : t('Pronto.'))];
}
function abrirPortal() {
  estado.fase = 'portal';
  desenhar();
  clarao.hidden = false;
  clarao.className = 'clarao clarao-uma';
  S.portal();
  const fim = matchMedia('(prefers-reduced-motion: reduce)').matches ? 300 : 4200;
  // O branco não volta: fica na tela até o vídeo começar ou até a janela sair de cima do Maestri.
  setTimeout(() => { estado.video = estado.inicio?.video; if (estado.video) { estado.fase = 'video'; desenhar(); } else concluir(); }, fim + 200);
}
function concluir() {
  // Depois do vídeo, a janela sai da frente e o guia começa a aula por cima do Maestri.
  estado.fase = 'fim';
  desenhar();
  S.concluir();
  setTimeout(() => { clarao.hidden = true; }, 3000); // a janela já saiu; se ela voltar, volta sem o branco
}
function telaVideo() {
  const v = h('video', { class: 'abertura', src: estado.video, autoplay: true, playsinline: true, 'aria-label': t('Vídeo de abertura') });
  v.addEventListener('playing', () => { clarao.hidden = true; }, { once: true });
  v.addEventListener('ended', concluir);
  v.addEventListener('error', concluir);
  const pular = botao(t('Pular'), concluir, 'btn2 p video-pular');
  pular.hidden = true;
  setTimeout(() => { pular.hidden = false; }, 15000); // decisão do Nathan: o pular aparece depois de 15 segundos
  return [v, pular];
}
const RESOLVER = () => t('O botão "Resolver o que falta" abre isso de novo pra você.');
const DICAS_APP = () => [
  [/^Login no Claude/, t('Falta entrar na sua conta do Claude, a sua IA. Sem isso ela ainda não consegue conversar com você.')],
  [/^Conta conectada|^Contas conectadas/, t('Falta entrar na sua conta do GitHub. {resolver}', { resolver: RESOLVER() })],
  [/^git sabe/, t('Se resolve sozinho quando a conta do GitHub estiver conectada.')],
  [/^Login na Vercel/, t('Falta entrar na sua conta da Vercel. É opcional.')],
  [/^Extensão Claude no Chrome/, t('Falta adicionar a extensão da IA no Chrome. {resolver}', { resolver: RESOLVER() })],
  [/^Complementos do Obsidian ligados/, t('Falta clicar em "Trust author and enable plugins" no Obsidian. {resolver}', { resolver: RESOLVER() })],
];
const TECNICO = /^rode:|^winget |claude-setuper|https?:\/\//;
function dicaApp(i) {
  const d = DICAS_APP().find(([re]) => re.test(i.chave || i.item));
  if (d) return d[1];
  return i.dica && !TECNICO.test(i.dica) ? i.dica : RESOLVER();
}
function telaFim() {
  const nome = estado.comecar?.nome || '';
  const f = faltas();
  const prontos = estado.grupos.filter((g) => g.itens.every((i) => i.ok)).map((g) => g.nome);
  const resolver = () => comecar('instalar');
  if (!estado.soConferiu && semLogin()) {
    return [anel('170px', 92, 'vez'), h('h1', { css: { 'margin-top': '30px' } }, nome ? t('Quase pronto, {nome}.', { nome }) : t('Quase pronto.')),
      h('p', { class: 'lead' }, t('Falta só entrar na sua conta do Claude, a IA que acabei de instalar. Sem isso ela ainda não consegue conversar com você, e o resto já ficou instalado.')),
      h('div', { class: 'botoes' }, botao(t('Entrar na minha conta do Claude'), resolver, 'btn', { 'data-foco': true }), botao(t('Fazer depois'), () => S.fechar(), 'btn2')),
      h('p', { class: 't3 peq', css: { 'margin-top': '18px' } }, t('Se fechar agora, é só abrir o Claude Setuper de novo que eu volto neste ponto.'))];
  }
  return [h('h2', {}, estado.soConferiu ? t('Conferi tudo o que está instalado') : (estado.encerramento.split('.')[0] + '.')),
    h('p', { class: 't2' }, f.length ? (f.length === 1 ? t('Está funcionando. Falta uma coisa, e ela depende de você.') : t('Está funcionando. Faltam {n} coisas, e elas dependem de você.', { n: f.length })) : t('Tudo certo. Está tudo no lugar.')),
    h('div', { css: { display: 'grid', 'grid-template-columns': f.length ? 'repeat(2,minmax(0,1fr))' : 'minmax(0,1fr)', gap: '12px', width: f.length ? '768px' : '420px', 'max-width': '100%', 'margin-top': '22px', 'max-height': 'calc(100vh - 290px)', 'overflow-y': 'auto' } },
      f.length ? h('div', { class: 'bloco' }, h('h3', { css: { 'margin-bottom': '4px' } }, t('Falta')), f.map((i) => h('div', { class: 'linha' }, icFalta(), h('div', {}, h('b', {}, i.item), h('p', { class: 't2 peq' }, dicaApp(i)))))) : null,
      prontos.length ? h('div', { class: 'bloco' }, h('h3', { css: { 'margin-bottom': '4px' } }, t('Pronto pra usar')), prontos.map((n) => h('div', { class: 'linha', css: { padding: '3px 0' } }, icCerto(), h('span', {}, n)))) : null),
    h('div', { class: 'botoes' }, f.length ? botao(t('Resolver o que falta'), resolver, 'btn', { 'data-foco': true }) : null, botao(estado.plataforma === 'darwin' ? t('Abrir o Maestri') : t('Abrir a IA'), () => S.abrirClaude(), f.length ? 'btn2' : 'btn', f.length ? {} : { 'data-foco': true }))];
}
function telaFalha() {
  return [anel('150px', porcentagem(), 'erro'), h('div', { css: { height: '28px' } }),
    h('h2', { css: { 'font-size': '24px', 'line-height': '30px' } }, t('Algo deu errado e eu precisei parar')),
    h('p', { class: 'lead' }, estado.falha),
    h('p', { class: 't2', css: { 'margin-top': '8px', 'max-width': '560px' } }, estado.falhaInternet ? t('Confere a internet e tenta de novo: eu continuo de onde parei, e o que já está pronto continua pronto.') : t('Quando tentar de novo, eu continuo de onde parei, e o que já está pronto continua pronto.')),
    h('div', { class: 'botoes' }, botao(t('Tentar de novo'), () => comecar('instalar'), 'btn', { 'data-foco': true }), botao(t('Pedir ajuda'), pedirAjuda, 'btn2'))];
}

// ---------- folhas: ajuda, detalhes e versão ----------
async function pedirAjuda() {
  estado.folha = 'gerando';
  desenharFolha();
  estado.folha = await S.pedirAjuda();
  desenharFolha();
}
function desenharFolha() {
  const f = estado.folha;
  if (!f) return folha.replaceChildren();
  const fechar = botao(t('Fechar'), () => { estado.folha = null; desenharFolha(); }, 'btn2 p');
  let corpo;
  if (f === 'gerando') corpo = [h('p', { class: 't2' }, t('Conferindo a instalação e preparando a mensagem pro suporte. Leva menos de um minuto...'))];
  else if (f === 'detalhes') {
    corpo = [h('div', { css: { display: 'grid', 'grid-template-columns': '230px minmax(0,1fr)', gap: '20px' } },
      h('div', {}, h('h3', { css: { 'margin-bottom': '8px' } }, t('O que já foi feito')), estado.passos.map((n, i) => h('p', { class: i <= estado.atual ? 'peq' : 'peq t3', css: { 'line-height': '24px' } }, `${i < estado.atual ? '✓' : i === estado.atual ? '→' : '·'} ${n}`))),
      h('div', {}, h('h3', {}, t('Registro técnico')), h('p', { class: 't3 peq' }, t('Em inglês, pra quem for te ajudar. Você não precisa ler nem fazer nada do que está aqui.')), h('pre', { class: 'log' }, estado.detalhes.slice(-6000)))),
      h('div', { class: 'g-acoes', css: { 'justify-content': 'flex-end' } }, fechar)];
  } else if (f.erro) corpo = [h('p', {}, t('Não consegui preparar a mensagem. Tira um print desta tela e manda pra quem te passou o Claude Setuper.')), h('div', { class: 'g-acoes', css: { 'justify-content': 'flex-end' } }, fechar)];
  else {
    const onde = f.pasta === 'Desktop' ? (estado.plataforma === 'darwin' ? t('na sua Mesa') : t('na sua Área de Trabalho')) : t('na pasta {pasta}', { pasta: f.pasta });
    corpo = [h('h2', { css: { 'font-size': '22px', 'line-height': '28px' } }, t('Falta só você apertar enviar')),
      h('p', { class: 't2' }, t('Abri o WhatsApp com o registro da instalação já escrito, pro suporte te ajudar. Vai lá e aperta enviar.')),
      h('p', { class: 't3 peq', css: { 'margin-top': '10px' } }, t('A mensagem não leva nenhuma senha nem código de login. Se o WhatsApp não abriu, ou se o suporte pedir o registro completo, ele está no arquivo "{nome}" {onde}.', { nome: f.nome, onde })),
      h('div', { class: 'g-acoes', css: { 'justify-content': 'flex-end', 'margin-top': '18px' } }, fechar)];
  }
  folha.replaceChildren(h('div', { class: 'veu' }, h('div', { class: 'folha', role: 'dialog', css: f === 'detalhes' ? { width: '760px', 'max-width': '92vw' } : {} }, corpo)));
}
document.getElementById('pedir-ajuda').addEventListener('click', pedirAjuda);
document.getElementById('ver-feito').addEventListener('click', () => { estado.folha = 'detalhes'; desenharFolha(); });
S.aoMenu?.((acao) => { if (acao === 'detalhes') { estado.folha = 'detalhes'; desenharFolha(); } else if (acao === 'ajuda') pedirAjuda(); });
document.addEventListener('keydown', (e) => { if (['Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) document.body.classList.add('teclado'); }, true);
document.addEventListener('pointerdown', () => document.body.classList.remove('teclado'), true);
const anotar = (texto) => { estado.detalhes = (estado.detalhes + texto).slice(-20000); };

// ---------- eventos da instalação ----------
S.aoEvento((ev) => {
  switch (ev.tipo) {
    case 'inicio': {
      estado.inicio = ev; estado.auto = ev.auto; estado.catalogo = ev.catalogo || {}; estado.idioma = ev.idioma || 'pt'; estado.plataforma = ev.plataforma || 'darwin';
      document.documentElement.lang = estado.idioma === 'en' ? 'en' : 'pt-BR';
      if (!['demo', 'confirma'].includes(estado.fase)) estado.fase = ev.presente && !ev.temInstalacao ? 'presente' : 'inicio';
      break;
    }
    case 'atualizacao': estado.atualizacao = ev.versao; break;
    case 'abertura': if (estado.fase !== 'instalando') estado.fase = 'perguntas'; break;
    case 'plano': estado.passos = ev.passos; estado.pesos = ev.pesos || []; estado.exemplos = ev.exemplos || []; estado.atual = -1; estado.desdePasso = Date.now(); estado.mostrado = Math.max(estado.mostrado, estado.inicio?.progresso || 0); estado.fase = 'instalando'; break;
    case 'passo': if (ev.n - 1 !== estado.atual) estado.desdePasso = Date.now(); estado.atual = ev.n - 1; estado.pausa = null; estado.tarefa = ''; estado.desde = estado.mexeu = Date.now(); estado.demora = ''; anotar(`\n── ${ev.n}/${ev.total} ${ev.titulo}\n`); break;
    case 'msg':
      anotar(`${ev.texto}\n`);
      if (ev.nivel === 'info') { if (estado.pausa) estado.pausa.status = ev.texto; break; }
      estado.msgs.push(ev);
      estado.pausa = null;
      if (ev.nivel === 'erro' && estado.atual >= 0) estado.falhos.add(estado.atual);
      if (ev.nivel === 'aviso' && estado.atual >= 0 && estado.fase === 'instalando' && !/^(Terminei|I finished)/.test(ev.texto)) estado.pendentes.add(estado.atual);
      break;
    case 'tarefa':
      if (ev.estado === 'fazendo') {
        if (estado.tarefaId !== ev.id) { estado.tarefaId = ev.id; estado.desde = Date.now(); }
        if (estado.tarefa !== ev.texto) estado.mexeu = Date.now();
        estado.tarefa = ev.texto;
        estado.demora = ev.demora || '';
        if (ev.atras) { estado.desde -= ev.atras; estado.mexeu -= ev.atras; }
      } else { estado.msgs.push({ nivel: ev.estado === 'feito' ? 'ok' : 'erro', texto: ev.texto }); estado.tarefa = ''; anotar(`${ev.texto}\n`); }
      break;
    case 'pausa': estado.pausa = { titulo: ev.titulo, linhas: ev.linhas, espera: !!ev.espera, status: '', colar: false }; anotar(`> ${ev.titulo}\n`); break;
    case 'colar-codigo': if (estado.pausa) estado.pausa.colar = ev.ativo; break;
    case 'pausa-fora': estado.pausa = { titulo: ev.titulo, linhas: [], espera: false, status: '' }; estado.fase = 'instalando'; break;
    case 'fimpausa': estado.pausa = null; break;
    case 'fimpedido': if (estado.pedido?.id === ev.id) estado.pedido = null; break;
    case 'saida': anotar(ev.texto); return; // não redesenha a tela a cada linha
    case 'pedido': estado.pedido = { ...ev.pergunta, id: ev.id }; if (!['instalando', 'perguntas'].includes(estado.fase)) estado.fase = 'perguntas'; break;
    case 'encerramento': estado.encerramento = ev.texto; break;
    case 'fim': {
      estado.grupos = ev.grupos; estado.soConferiu = ev.soConferiu; estado.comecar = ev.comecar || null; estado.pausa = null; estado.pedido = null;
      // Sem login ou só conferindo, nada de portal: mostra o que falta.
      if (!ev.soConferiu && !semLogin() && !ev.semPortal) {
        if (estado.auto) { abrirPortal(); roteiro(ev); } else { desenhar(); subirAte100(abrirPortal); }
        return;
      }
      estado.fase = 'fim'; break;
    }
    case 'falha': estado.fase = 'falha'; estado.falha = ev.texto; estado.falhaInternet = ev.internet !== false; break;
  }
  desenhar();
  if (estado.auto) roteiro(ev);
});

// ---------- modo roteiro (só nos testes da VM) ----------
function print(nome) { setTimeout(() => S.print(nome), 1200); }
function roteiro(ev) {
  const a = estado.auto;
  if (ev.tipo === 'inicio' && estado.fase === 'presente') {
    print('presente');
    setTimeout(() => { irPara('preparo'); print('preparo'); }, 3000);
    setTimeout(() => comecar('instalar'), 6000);
    return;
  }
  if (ev.tipo === 'inicio') {
    print('inicio');
    setTimeout(() => irPara('demo'), 1500);
    setTimeout(() => irPara('confirma'), 4000);
    setTimeout(() => comecar('instalar'), 6500);
    return;
  }
  if (ev.tipo === 'pedido') {
    setTimeout(() => S.print('pergunta'), 300);
    const p = estado.pedido;
    const msg = p.msg || '';
    let valor = p.padrao;
    if (/chame|call you/i.test(msg)) valor = a.nome || 'Teste';
    else if (/anos|how old/i.test(msg)) valor = String(a.idade || '52');
    if (valor === undefined) valor = '';
    setTimeout(() => { if (estado.pedido?.id === ev.id) { estado.pedido = null; S.responder(ev.id, valor); desenhar(); } }, 1200);
    return;
  }
  if (['pausa', 'plano', 'fim', 'falha', 'codigo'].includes(ev.tipo)) print(ev.tipo);
}

S.pronto();

setInterval(() => andarProgresso(0.1), 100);
setInterval(() => {
  if (estado.fase === 'instalando' && !estado.pedido && !estado.pausa) {
    const r = document.getElementById('relogio');
    if (r) r.textContent = textoRelogio();
    const precisa = estado.mexeu && Date.now() - estado.mexeu >= PARADO;
    if (precisa !== !!document.getElementById('parado')) desenhar();
  }
  if (estado.pedido && estado.fase === 'perguntas') desenharEntorno();
}, 1000);
// Troca o exemplo da espera sem atrapalhar quem está lendo.
setInterval(() => { if (estado.fase === 'instalando' && !estado.pedido && !estado.pausa && estado.exemplos.length > 1) { estado.exemplo++; desenhar(); } }, 20000);
