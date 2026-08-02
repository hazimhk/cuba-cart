const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.12, rootMargin: '0px 0px -40px' });

document.querySelectorAll('.reveal').forEach((el, index) => {
  el.style.transitionDelay = `${Math.min(index * 0.04, 0.35)}s`;
  if (reduceMotion) el.classList.add('visible');
  else revealObserver.observe(el);
});

const animatedCopy = document.querySelector('[data-animate-text]');
if (animatedCopy) {
  const text = animatedCopy.textContent;
  animatedCopy.textContent = '';
  [...text].forEach((char) => {
    const span = document.createElement('span');
    span.className = 'char';
    span.textContent = char;
    animatedCopy.appendChild(span);
  });
}

const updateAnimatedText = () => {
  if (!animatedCopy) return;
  const rect = animatedCopy.getBoundingClientRect();
  const start = window.innerHeight * 0.82;
  const end = window.innerHeight * 0.22;
  const progress = Math.max(0, Math.min(1, (start - rect.top) / (start - end)));
  const chars = animatedCopy.querySelectorAll('.char');
  chars.forEach((char, i) => {
    const local = Math.max(0, Math.min(1, progress * 1.25 - i / Math.max(chars.length, 1) * 0.72));
    char.style.opacity = String(0.2 + local * 0.8);
  });
};

const marquee = document.querySelector('.marquee-section');
const rowOne = document.querySelector('.row-one .marquee-track');
const rowTwo = document.querySelector('.row-two .marquee-track');
const projectCards = [...document.querySelectorAll('.project-card')];

const updateScrollEffects = () => {
  if (marquee && rowOne && rowTwo) {
    const sectionTop = marquee.getBoundingClientRect().top + window.scrollY;
    const offset = (window.scrollY - sectionTop + window.innerHeight) * 0.3;
    rowOne.style.transform = `translate3d(${offset - 200}px,0,0)`;
    rowTwo.style.transform = `translate3d(${-offset + 200}px,0,0)`;
  }

  projectCards.forEach((card, index) => {
    const rect = card.getBoundingClientRect();
    const total = projectCards.length;
    const targetScale = 1 - (total - 1 - index) * 0.03;
    const progress = Math.max(0, Math.min(1, (96 - rect.top) / Math.max(rect.height, 1)));
    const scale = 1 - progress * (1 - targetScale);
    card.style.transform = `scale(${scale})`;
  });

  updateAnimatedText();
};

let ticking = false;
const requestScrollUpdate = () => {
  if (!ticking) {
    ticking = true;
    requestAnimationFrame(() => {
      updateScrollEffects();
      ticking = false;
    });
  }
};

window.addEventListener('scroll', requestScrollUpdate, { passive: true });
window.addEventListener('resize', requestScrollUpdate);

const magnet = document.querySelector('.magnet');
if (magnet && !reduceMotion) {
  const strength = Number(magnet.dataset.strength || 3);
  const padding = 150;
  window.addEventListener('pointermove', (event) => {
    const rect = magnet.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const withinX = event.clientX > rect.left - padding && event.clientX < rect.right + padding;
    const withinY = event.clientY > rect.top - padding && event.clientY < rect.bottom + padding;
    if (withinX && withinY) {
      magnet.style.transition = 'transform 0.3s ease-out';
      magnet.style.transform = `translateX(-50%) translate3d(${(event.clientX - centerX) / strength}px, ${(event.clientY - centerY) / strength}px, 0)`;
    } else {
      magnet.style.transition = 'transform 0.6s ease-in-out';
      magnet.style.transform = 'translateX(-50%) translate3d(0,0,0)';
    }
  }, { passive: true });
}

updateScrollEffects();
