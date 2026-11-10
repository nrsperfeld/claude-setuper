// Desenha as setas: do guia até o lugar da tela, com o nome do que fazer ali.
const svg = document.getElementById('desenho');
const rotulos = document.getElementById('rotulos');
const NS = 'http://www.w3.org/2000/svg';
const el = (nome, attrs) => { const e = document.createElementNS(NS, nome); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); return e; };

// O nome fica colado na curva, onde não cobre o guia nem o lugar que a pessoa tem que clicar.
function colocar(r, s, curva, fim, guia) {
  const larg = r.offsetWidth;
  const alt = r.offsetHeight;
  const noCaminho = (u) => ({
    x: (1 - u) ** 2 * s.de.x + 2 * (1 - u) * u * curva.x + u * u * fim.x,
    y: (1 - u) ** 2 * s.de.y + 2 * (1 - u) * u * curva.y + u * u * fim.y,
  });
  const dentro = (p) => ({ x: Math.max(larg / 2 + 12, Math.min(innerWidth - larg / 2 - 12, p.x)), y: Math.max(alt / 2 + 12, Math.min(innerHeight - alt / 2 - 12, p.y)) });
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

function desenhar({ setas, guia }) {
  svg.replaceChildren();
  rotulos.replaceChildren();
  for (const s of setas) {
    // O sistema não diz onde cada ícone está no Dock: em vez de apontar pro ícone errado, acende a barra inteira.
    const embaixo = s.dock && s.y > innerHeight - 40;
    if (embaixo) {
      s.y = innerHeight - 92;
      svg.append(el('rect', { x: innerWidth * 0.08, y: innerHeight - 84, width: innerWidth * 0.84, height: 78, rx: 22, class: 'seta-faixa' }));
    }
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
    svg.append(
      el('path', { d: caminho, class: 'seta-sombra' }),
      el('path', { d: caminho, class: 'seta-linha' }),
      el('polygon', { points: `${ponta(ang, 34)} ${ponta(ang + 2.5, 30)} ${ponta(ang - 2.5, 30)}`, class: 'seta-ponta' }),
    );
    if (!s.dock) svg.append(el('circle', { cx: s.x, cy: s.y, r: 20, class: 'seta-alvo' }));
    const r = document.createElement('div');
    r.className = 'seta-rotulo';
    if (s.icone) {
      const img = document.createElement('img');
      img.src = s.icone;
      img.alt = '';
      r.append(img);
    }
    r.append(s.rotulo);
    rotulos.append(r);
    colocar(r, s, curva, fim, guia);
  }
}
window.setuper.aoSetas(desenhar);
