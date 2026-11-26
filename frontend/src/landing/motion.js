// Motion da landing. Sem biblioteca: IntersectionObserver para as entradas, um listener de
// scroll passivo (com rAF) para o topo, e CSS scroll-driven animations para o que acompanha
// a rolagem. Sem JS ou com "reduzir movimento", a página fica estática e completa.

const raiz = document.documentElement;
const motion = raiz.classList.contains('js-motion');

// ── Topo: transparente sobre o vermelho, branco depois que a página rola ──────────────
const topo = document.querySelector('.topo');
let agendado = false;
function atualizarTopo() {
  agendado = false;
  const rolou = window.scrollY > 24;
  topo?.classList.toggle('topo--solido', rolou);
  raiz.classList.toggle('rolou', rolou);
}
window.addEventListener('scroll', () => {
  if (!agendado) { agendado = true; requestAnimationFrame(atualizarTopo); }
}, { passive: true });
atualizarTopo();

if (motion) {
  // ── Título do hero: palavra por palavra (o texto continua no HTML para o Google) ────
  const h1 = document.querySelector('.hero__corpo h1');
  if (h1) {
    let i = 0;
    const embrulhar = (no) => {
      if (no.nodeType === Node.TEXT_NODE) {
        const partes = no.textContent.split(/(\s+)/);
        const frag = document.createDocumentFragment();
        for (const p of partes) {
          if (!p) continue;
          if (/^\s+$/.test(p)) { frag.appendChild(document.createTextNode(p)); continue; }
          const s = document.createElement('span');
          s.className = 'palavra'; s.style.setProperty('--i', String(i++)); s.textContent = p;
          frag.appendChild(s);
        }
        no.replaceWith(frag);
      } else if (no.nodeType === Node.ELEMENT_NODE && no.classList.contains('sublinhado')) {
        no.classList.add('palavra'); no.style.setProperty('--i', String(i++));
        no.style.setProperty('--fim', String(i));
      }
    };
    [...h1.childNodes].forEach(embrulhar);
    h1.style.setProperty('--total', String(i));
  }

  // ── Entradas ao aparecer na tela ────────────────────────────────────────────────────
  const io = new IntersectionObserver((entradas) => {
    for (const e of entradas) {
      if (e.isIntersecting) { e.target.classList.add('visivel'); io.unobserve(e.target); }
    }
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });
  document.querySelectorAll('[data-reveal]').forEach((el) => io.observe(el));

  // ── Brilho que segue o mouse no hero (só mouse/trackpad) ───────────────────────────
  // Uma camada própria movida por transform: não repinta o fundo do hero a cada quadro.
  const hero = document.querySelector('.hero');
  const brilho = document.querySelector('.hero__brilho');
  if (hero && brilho && matchMedia('(hover: hover) and (pointer: fine)').matches) {
    let quadro = 0, x = 0, y = 0;
    hero.addEventListener('pointermove', (ev) => {
      const r = hero.getBoundingClientRect();
      x = ev.clientX - r.left; y = ev.clientY - r.top;
      if (!quadro) quadro = requestAnimationFrame(() => {
        quadro = 0;
        brilho.style.transform = `translate(${x}px, ${y}px)`;
      });
    });
    hero.addEventListener('pointerenter', () => brilho.classList.add('ligado'));
    hero.addEventListener('pointerleave', () => brilho.classList.remove('ligado'));
  }
}
