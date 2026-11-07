// O guia flutuante: a janelinha que fica na frente de tudo quando a ação sai do app, com o próximo passo.
const G = window.setuper;
const raiz = document.getElementById('guia');
let cat = {};
let cena = null; // { rotulo, passos: [{ titulo, linhas, figura, print }], i, acoes, pular, concluir, nao, id, codigo, link, status, aula, opcoes }
const t = (texto, vars) => {
  const base = cat[texto] ?? texto;
  return vars ? base.replace(/\{(\w+)\}/g, (m, k) => (vars[k] ?? m)) : base;
};
function h(tag, attrs = {}, ...filhos) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const f of filhos.flat(3)) if (f != null && f !== false) el.append(f.nodeType ? f : String(f));
  return el;
}
const botao = (texto, onclick, tipo = 'btn p') => h('button', { class: tipo, type: 'button', onclick }, texto);

// Desenho simples da janela que a pessoa vai ver, com o botão certo marcado. Quando houver print real, ele entra no lugar.
const b = (texto, classe = '') => h('span', { class: `b ${classe}` }, texto);
const FIGURAS = {
  'apple-ferramentas': () => h('div', { class: 'g-print' }, h('p', {}, t('Deseja instalar as ferramentas agora?')), h('div', { class: 'g-teclas' }, b(t('Agora Não')), b(t('Instalar'), 'az alvo'))),
  'apple-contrato': () => h('div', { class: 'g-print' }, h('p', {}, t('Contrato de licença da Apple')), h('div', { class: 'g-teclas' }, b(t('Não Concordo')), b(t('Concordo'), 'az alvo'))),
  senha: () => h('div', { class: 'g-print' }, h('p', {}, t('O Claude Setuper precisa da senha do seu computador')), b('••••••••'), b('OK', 'az alvo')),
  'claude-login': () => h('div', { class: 'g-print' }, h('p', {}, h('b', {}, 'Claude')), b(t('seu e-mail')), b(t('Continuar'), 'az alvo')),
  'obsidian-confiar': () => h('div', { class: 'g-print esc' }, h('p', {}, h('b', {}, 'Do you trust the author of this vault?')), b('Trust author and enable plugins', 'alvo'), b('Browse vault in Restricted Mode')),
  'chrome-extensao': () => h('div', { class: 'g-print' }, h('p', {}, h('b', {}, 'Claude')), b(t('Usar no Chrome'), 'az alvo')),
  'github-criar': () => h('div', { class: 'g-print' }, h('p', {}, h('b', {}, 'Create your free account')), b('Email'), b('Continue', 'az alvo')),
  'github-codigo': () => h('div', { class: 'g-print' }, h('p', {}, h('b', {}, 'Device activation')), b(t('cola o código aqui'), 'alvo')),
  vercel: () => h('div', { class: 'g-print' }, h('p', {}, h('b', {}, 'Vercel')), b('Continue', 'az alvo')),
  conectores: () => h('div', { class: 'g-print' }, h('p', {}, h('b', {}, t('Conectores'))), b(t('Conectar'), 'az alvo')),
  'windows-sim': () => h('div', { class: 'g-print' }, h('p', {}, t('Deseja permitir que este aplicativo faça alterações no seu dispositivo?')), h('div', { class: 'g-teclas' }, b(t('Sim'), 'alvo'), b(t('Não')))),
};
function imagem(p) {
  if (p.print) return h('div', { class: 'g-print' }, h('img', { src: p.print, alt: '' }));
  if (p.figura && FIGURAS[p.figura]) return FIGURAS[p.figura]();
  return null;
}

function desenhar() {
  if (!cena) return raiz.replaceChildren();
  const p = cena.passos[cena.i] || cena.passos[0];
  const n = cena.passos.length;
  const kids = [h('div', { class: 'g-topo' }, h('span', { class: 'g-ponto' }), h('span', {}, cena.rotulo || t('Sua vez')), h('span', {}, cena.contagem || (n > 1 ? t('{i} de {n}', { i: cena.i + 1, n }) : '')))];
  if (p.tela) kids.push(h('div', { class: 'g-tela' }, p.tela ? h('span', {}, p.tela) : null, p.teclas?.length ? h('div', { class: 'g-teclas' }, p.teclas.map((x) => h('span', { class: 'tecla' }, x))) : null));
  else { const img = imagem(p); if (img) kids.push(img); }
  kids.push(h('p', { class: 'g-tit' }, p.titulo));
  if (p.linhas?.length === 1) kids.push(h('p', { class: 'g-txt' }, p.linhas[0]));
  else if (p.linhas?.length) kids.push(h('ol', { class: 'g-lista' }, p.linhas.map((l) => h('li', {}, l))));
  if (cena.codigo) kids.push(h('div', { class: 'g-cod' }, h('span', {}, cena.codigo), botao(t('Copiar'), (e) => { G.copiar(cena.codigo); e.target.textContent = t('Copiado'); })));
  if (p.opcoes?.length) kids.push(h('div', {}, p.opcoes.map((o) => h('div', { class: 'g-opc' }, h('div', {}, h('b', {}, o.titulo), h('p', { class: 't2 peq' }, o.sub)), botao(o.feito ? t('Ligado') : t('Ligar'), () => G.ligarOpcional(o.id), 'btn2 p')))));
  if (cena.status || p.status) kids.push(h('p', { class: 'g-status' }, cena.status || p.status));
  const acoes = [];
  if (cena.link) acoes.push(botao(t('Abrir a página'), () => G.abrirLink(cena.link), 'btn2 p'));
  (cena.acoes || []).forEach((a) => acoes.push(botao(a.rotulo, () => (a.reabrir ? G.acaoGuia(a.reabrir) : G.abrirLink(a.url, a.app)), 'btn2 p')));
  if (temProximo()) acoes.push(botao(t('Próximo passo'), () => { cena.i++; desenhar(); G.ajustarGuia(raiz.scrollHeight); }));
  if (p.botao) acoes.push(botao(p.botao, () => G.aula('avancar')));
  if (cena.concluir && cena.i === n - 1) acoes.push(botao(cena.concluir, () => { G.responder(cena.id, true); }));
  if (cena.nao) acoes.push(botao(cena.nao, () => { G.responder(cena.id, false); }, 'link'));
  if (cena.pular) acoes.push(botao(cena.pular, (e) => { G.pular(); e.target.disabled = true; e.target.textContent = t('Seguindo...'); }, 'link'));
  if (cena.aula && !p.fim) acoes.push(botao(t('Pular a aula'), () => G.aula('pular'), 'link'));
  if (cena.aula && cena.volta) acoes.push(botao(t('Voltar'), () => G.aula('voltar'), 'link'));
  if (acoes.length) kids.push(h('div', { class: 'g-acoes' }, acoes));
  raiz.replaceChildren(...kids);
  G.ajustarGuia(raiz.scrollHeight);
}
const temProximo = () => cena.passos.length > 1 && cena.i < cena.passos.length - 1;

G.aoGuia((ev) => {
  if (ev.catalogo) cat = ev.catalogo;
  if (ev.tipo === 'cena') cena = { i: 0, ...ev.cena };
  else if (ev.tipo === 'link' && cena) cena.link = ev.url;
  else if (ev.tipo === 'codigo' && cena) cena.codigo = ev.codigo;
  else if (ev.tipo === 'status' && cena) cena.status = ev.texto;
  desenhar();
});
G.guiaPronto();
