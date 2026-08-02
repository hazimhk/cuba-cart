const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const reveals = [...document.querySelectorAll('.reveal')];

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add('visible');
    revealObserver.unobserve(entry.target);
  });
}, { threshold: 0.15 });

reveals.forEach((element) => {
  const delay = Number(element.dataset.delay || 0);
  element.style.transitionDelay = `${delay}ms`;
  if (reduceMotion.matches) element.classList.add('visible');
  else revealObserver.observe(element);
});

const poster = document.querySelector('.video-poster');
const video = document.querySelector('.scrub-video');
const canvas = document.querySelector('.scrub-canvas');
const ctx = canvas?.getContext('2d');

let targetProgress = 0;
let smoothedProgress = 0;
let rafId = 0;
let videoReady = false;
let frameCacheReady = false;
let cachedFrames = [];
let lastFrameIndex = -1;
let extracting = false;

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function getScrollProgress() {
  const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  return clamp(window.scrollY / max);
}

function resizeCanvas() {
  if (!canvas || !ctx) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.round(window.innerWidth * dpr);
  const height = Math.round(window.innerHeight * dpr);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

function drawCover(source) {
  if (!canvas || !ctx || !source) return;
  resizeCanvas();
  const sw = source.videoWidth || source.width;
  const sh = source.videoHeight || source.height;
  if (!sw || !sh) return;
  const scale = Math.max(canvas.width / sw, canvas.height / sh);
  const dw = sw * scale;
  const dh = sh * scale;
  const dx = (canvas.width - dw) / 2;
  const dy = (canvas.height - dh) / 2;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(source, dx, dy, dw, dh);
}

function showVideoLayer() {
  if (!videoReady || !video) return;
  poster?.style.setProperty('opacity', '0');
  video.style.opacity = frameCacheReady ? '0' : '1';
}

function showCanvasLayer() {
  if (!canvas) return;
  frameCacheReady = true;
  canvas.style.opacity = '1';
  video?.style.setProperty('opacity', '0');
  poster?.style.setProperty('opacity', '0');
}

async function seekAndCapture(sourceVideo, time, maxWidth = 960) {
  return new Promise((resolve, reject) => {
    const onSeeked = async () => {
      sourceVideo.removeEventListener('error', onError);
      try {
        const scale = Math.min(1, maxWidth / sourceVideo.videoWidth);
        const width = Math.max(1, Math.round(sourceVideo.videoWidth * scale));
        const height = Math.max(1, Math.round(sourceVideo.videoHeight * scale));
        const frameCanvas = document.createElement('canvas');
        frameCanvas.width = width;
        frameCanvas.height = height;
        frameCanvas.getContext('2d').drawImage(sourceVideo, 0, 0, width, height);
        if ('createImageBitmap' in window) resolve(await createImageBitmap(frameCanvas));
        else resolve(frameCanvas);
      } catch (error) {
        reject(error);
      }
    };
    const onError = () => {
      sourceVideo.removeEventListener('seeked', onSeeked);
      reject(new Error('Frame extraction failed'));
    };
    sourceVideo.addEventListener('seeked', onSeeked, { once: true });
    sourceVideo.addEventListener('error', onError, { once: true });
    sourceVideo.currentTime = Math.min(time, Math.max(0, sourceVideo.duration - 0.05));
  });
}

async function buildFrameCache() {
  if (!videoReady || extracting || !video?.duration || reduceMotion.matches) return;
  extracting = true;
  await new Promise((resolve) => setTimeout(resolve, 300));

  const source = document.createElement('video');
  source.muted = true;
  source.playsInline = true;
  source.preload = 'auto';
  source.crossOrigin = 'anonymous';
  source.src = video.currentSrc || video.src;

  try {
    await new Promise((resolve, reject) => {
      source.addEventListener('loadedmetadata', resolve, { once: true });
      source.addEventListener('error', reject, { once: true });
      source.load();
    });

    const frameCount = Math.min(90, Math.max(24, Math.round(source.duration * 12)));
    const frames = [];
    for (let index = 0; index < frameCount; index += 1) {
      const time = (index / Math.max(1, frameCount - 1)) * Math.max(0, source.duration - 0.05);
      frames.push(await seekAndCapture(source, time));
    }
    cachedFrames = frames;
    showCanvasLayer();
  } catch (error) {
    cachedFrames = [];
    frameCacheReady = false;
    showVideoLayer();
  } finally {
    source.removeAttribute('src');
    source.load();
    extracting = false;
  }
}

function render() {
  targetProgress = getScrollProgress();
  smoothedProgress = reduceMotion.matches
    ? targetProgress
    : smoothedProgress + (targetProgress - smoothedProgress) * 0.12;

  if (frameCacheReady && cachedFrames.length) {
    const index = Math.min(cachedFrames.length - 1, Math.round(smoothedProgress * (cachedFrames.length - 1)));
    if (index !== lastFrameIndex) {
      drawCover(cachedFrames[index]);
      lastFrameIndex = index;
    }
  } else if (videoReady && video?.duration) {
    const wanted = smoothedProgress * Math.max(0, video.duration - 0.05);
    if (Math.abs(video.currentTime - wanted) > 0.04) video.currentTime = wanted;
  }

  const moving = Math.abs(smoothedProgress - targetProgress) > 0.0005;
  if (moving) rafId = requestAnimationFrame(render);
  else rafId = 0;
}

function requestRender() {
  targetProgress = getScrollProgress();
  if (!rafId) rafId = requestAnimationFrame(render);
}

if (video) {
  video.addEventListener('loadeddata', () => {
    videoReady = true;
    showVideoLayer();
    requestRender();
    buildFrameCache();
  }, { once: true });

  video.addEventListener('seeked', () => {
    if (!frameCacheReady) showVideoLayer();
  });

  video.addEventListener('error', () => {
    videoReady = false;
    if (poster) poster.style.opacity = '1';
  });

  video.load();
}

window.addEventListener('scroll', requestRender, { passive: true });
window.addEventListener('resize', () => {
  resizeCanvas();
  lastFrameIndex = -1;
  requestRender();
});
reduceMotion.addEventListener?.('change', requestRender);
resizeCanvas();
requestRender();
