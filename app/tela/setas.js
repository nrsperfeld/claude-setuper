// Desenha as setas: do guia até o lugar da tela, com o nome do que fazer ali.
const svg = document.getElementById('desenho');
const rotulos = document.getElementById('rotulos');
const NS = 'http://www.w3.org/2000/svg';
const el = (nome, attrs) => { const e = document.createElementNS(NS, nome); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); return e; };

function desenhar(setas) {
  svg.replaceChildren();
  rotulos.replaceChildren();
  for (const s of setas) {
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
    r.textContent = s.rotulo;
    // O nome fica no meio do caminho, colado na curva.
    r.style.left = `${Math.max(150, Math.min(innerWidth - 150, curva.x))}px`;
    r.style.top = `${Math.max(30, Math.min(innerHeight - 30, curva.y))}px`;
    rotulos.append(r);
  }
}
window.setuper.aoSetas((ev) => desenhar(ev.setas));
