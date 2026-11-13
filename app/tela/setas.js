// Desenha as setas: do guia até o lugar da tela, com o nome do que fazer ali.
const svg = document.getElementById('desenho');
const rotulos = document.getElementById('rotulos');
const NS = 'http://www.w3.org/2000/svg';
const el = (nome, attrs) => { const e = document.createElementNS(NS, nome); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); return e; };

// O nome fica colado na curva, onde não cobre o guia nem o lugar que a pessoa tem que clicar.
function colocar(r, s, curva, fim, guia) {
  const larg = r.offsetWidth;
  const alt = r.offsetHeight;
  const dentro = (p) => ({ x: Math.max(larg / 2 + 12, Math.min(innerWidth - larg / 2 - 12, p.x)), y: Math.max(alt / 2 + 12, Math.min(innerHeight - alt / 2 - 12, p.y)) });
  // Seta curta pra barra de ícones: o nome fica logo acima do começo dela, no canto, longe do que está aberto.
  if (s.dock) {
    const acima = Math.abs(fim.x - s.de.x) < Math.abs(fim.y - s.de.y);
    const p = dentro(acima ? { x: s.de.x, y: s.de.y - alt / 2 - 10 } : { x: s.de.x + (fim.x < s.de.x ? larg / 2 + 10 : -larg / 2 - 10), y: s.de.y });
    r.style.left = `${p.x}px`;
    r.style.top = `${p.y}px`;
    return;
  }
  const noCaminho = (u) => ({
    x: (1 - u) ** 2 * s.de.x + 2 * (1 - u) * u * curva.x + u * u * fim.x,
    y: (1 - u) ** 2 * s.de.y + 2 * (1 - u) * u * curva.y + u * u * fim.y,
  });
  const bate = (p) => {
    const noGuia = guia && p.x + larg / 2 > guia.x - 12 && p.x - larg / 2 < guia.x + guia.w + 12 && p.y + alt / 2 > guia.y - 12 && p.y - alt / 2 < guia.y + guia.h + 12;
    const noAlvo = Math.abs(p.x - s.x) < larg / 2 + 34 && Math.abs(p.y - s.y) < alt / 2 + 34;
    return noGuia || noAlvo;
  };
  const opcoes = [0.72, 0.55, 0.85, 0.4, 0.25].map((u) => dentro(noCaminho(u)));
  const p = opcoes.find((o) => !bate(o)) || opcoes[0];
  r.style.left = `${p.x}px`;
  r.style.top = `${p.y}px`;
}

function nome(s) {
  const r = document.createElement('div');
  r.className = s.dock ? 'seta-rotulo discreta' : 'seta-rotulo';
  if (s.icone) {
    const img = document.createElement('img');
    img.src = s.icone;
    img.alt = '';
    r.append(img);
  }
  r.append(s.rotulo);
  rotulos.append(r);
  return r;
}

// Alvo que é a janela inteira: uma moldura em volta dela e o recado embaixo, por dentro, onde menos atrapalha.
// Não tem ponto nem seta até um botão, porque ninguém sabe onde o botão está dentro de uma janela que muda de tamanho.
function moldura(s, guia) {
  const M = 5;
  const x = Math.max(M, s.janela.x);
  const y = Math.max(M, s.janela.y);
  const x2 = Math.min(innerWidth - M, s.janela.x + s.janela.w);
  const y2 = Math.min(innerHeight - M, s.janela.y + s.janela.h);
  if (x2 - x < 80 || y2 - y < 80) return;
  const quadro = { x, y, width: x2 - x, height: y2 - y, rx: 12 };
  svg.append(el('rect', { ...quadro, class: 'seta-moldura-sombra' }), el('rect', { ...quadro, class: 'seta-moldura' }));
  const r = nome(s);
  r.classList.add('larga');
  const larg = r.offsetWidth;
  const alt = r.offsetHeight;
  let cx = (x + x2) / 2;
  let cy = y2 - alt / 2 - 18;
  const noGuia = () => guia && cx + larg / 2 > guia.x - 12 && cx - larg / 2 < guia.x + guia.w + 12 && cy + alt / 2 > guia.y - 12 && cy - alt / 2 < guia.y + guia.h + 12;
  if (noGuia()) {
    // O recado não fica atrás do guia: vai pro lado livre da moldura ou, sem lado livre, pra cima do guia.
    const esq = guia.x - 12 - larg / 2;
    const dir = guia.x + guia.w + 12 + larg / 2;
    if (esq - larg / 2 >= x) cx = esq; else if (dir + larg / 2 <= x2) cx = dir; else cy = Math.max(y + alt / 2 + 18, guia.y - 12 - alt / 2);
  }
  r.style.left = `${Math.max(larg / 2 + 12, Math.min(innerWidth - larg / 2 - 12, cx))}px`;
  r.style.top = `${Math.max(alt / 2 + 12, Math.min(innerHeight - alt / 2 - 12, cy))}px`;
}

function desenhar({ setas, guia }) {
  svg.replaceChildren();
  rotulos.replaceChildren();
  for (const s of setas) {
    if (s.janela) { moldura(s, guia); continue; }
    // O sistema não diz onde cada ícone está na barra: em vez de apontar pro ícone errado, acende a barra inteira,
    // no lado da tela em que ela está de verdade.
    if (s.dock && s.faixa) svg.append(el('rect', { x: s.faixa.x + 3, y: s.faixa.y + 3, width: Math.max(4, s.faixa.w - 6), height: Math.max(4, s.faixa.h - 6), rx: Math.min(22, Math.max(2, Math.min(s.faixa.w, s.faixa.h) / 2 - 3)), class: 'seta-faixa' }));
    const dx = s.x - s.de.x;
    const dy = s.y - s.de.y;
    const dist = Math.hypot(dx, dy) || 1;
    const ux = dx / dist;
    const uy = dy / dist;
    // A ponta para um pouco antes do alvo, pra não cobrir o botão.
    const fim = { x: s.x - ux * 26, y: s.y - uy * 26 };
    const curva = { x: (s.de.x + fim.x) / 2 - uy * Math.min(90, dist * 0.18), y: (s.de.y + fim.y) / 2 + ux * Math.min(90, dist * 0.18) };
    const ang = Math.atan2(fim.y - curva.y, fim.x - curva.x);
    const ponta = (a, r) => `${fim.x + Math.cos(a) * r},${fim.y + Math.sin(a) * r}`;
    const caminho = `M${s.de.x} ${s.de.y} Q${curva.x} ${curva.y} ${fim.x} ${fim.y}`;
    const tam = s.dock ? 22 : 34; // a da barra de ícones é menor e mais fina: é só uma dica
    svg.append(
      el('path', { d: caminho, class: `seta-sombra${s.dock ? ' discreta' : ''}` }),
      el('path', { d: caminho, class: `seta-linha${s.dock ? ' discreta' : ''}` }),
      el('polygon', { points: `${ponta(ang, tam)} ${ponta(ang + 2.5, tam * 0.88)} ${ponta(ang - 2.5, tam * 0.88)}`, class: 'seta-ponta' }),
    );
    if (!s.dock) svg.append(el('circle', { cx: s.x, cy: s.y, r: 20, class: 'seta-alvo' }));
    colocar(nome(s), s, curva, fim, guia);
  }
}
window.setuper.aoSetas(desenhar);
