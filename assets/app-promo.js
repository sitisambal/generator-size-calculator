// The iPhone app, shown two ways. A small card slides up soon after someone
// lands, and the app section plays a short demo while it is on screen.
//
// The card never covers the calculator (Google counts full-screen app
// interstitials as intrusive), can always be closed, stores nothing, and steps
// aside for good once someone starts a plan. Android visitors never see it: the
// app is iPhone only. Videos load only when they are about to play.

const SHOW_AFTER_MS = 1400;

const $ = (id) => document.getElementById(id);
const saveData = () => Boolean(navigator.connection?.saveData);
const isApple = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);

let card = null;
let showTimer = 0;
let done = false;

/** Hide the card for the rest of this visit. Safe to call any time, from anywhere. */
export function closeAppPromo({ returnFocus = false } = {}) {
  clearTimeout(showTimer);
  if (done) return;
  done = true;
  if (!card || card.hidden) return;
  const hadFocus = card.contains(document.activeElement);
  card.classList.remove('is-on');
  card.setAttribute('inert', '');
  $('app-promo-video')?.pause();
  if (returnFocus || hadFocus) $('calculator')?.focus({ preventScroll: true });
}

function showCard(reduceMotion) {
  if (done || !card) return;
  const video = $('app-promo-video');
  const still = reduceMotion.matches || saveData();
  card.hidden = false;
  card.offsetWidth; // commit the start position so the slide runs
  if (still) {
    card.classList.add('is-ended');
  } else if (video) {
    video.addEventListener('ended', () => card.classList.add('is-ended'), { once: true });
    video.play().catch(() => card.classList.add('is-ended'));
  }
  card.classList.add('is-on');
}

export function initAppPromo(reduceMotion) {
  card = $('app-promo');
  if (!card || /Android/i.test(navigator.userAgent)) {
    done = true;
    return;
  }
  if (isApple()) $('app-promo-get').textContent = 'Get the app';
  card.querySelector('.app-promo-close').addEventListener('click', () => closeAppPromo({ returnFocus: true }));
  card.querySelector('.app-promo-peek').addEventListener('click', () => closeAppPromo());
  card.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeAppPromo({ returnFocus: true });
  });
  // The clip is 46 KB: fetch it now so it is ready when the card arrives.
  const video = $('app-promo-video');
  if (video && !reduceMotion.matches && !saveData()) video.preload = 'auto';
  showTimer = setTimeout(() => showCard(reduceMotion), SHOW_AFTER_MS);
}

// ---------------------------------------------------------------- demo video

export function initAppDemo(reduceMotion) {
  const video = $('app-demo');
  const toggle = $('app-demo-toggle');
  if (!video || !toggle) return;

  // Autoplay only for people who have not asked for less motion or less data,
  // and never again after someone pauses it.
  let wanted = !reduceMotion.matches && !saveData();
  let inView = false;

  const sync = () => {
    const playing = !video.paused;
    toggle.setAttribute('aria-label', playing ? 'Pause the demo' : 'Play the demo');
    toggle.querySelector('use').setAttribute('href', playing ? '#i-pause' : '#i-play');
  };
  const apply = () => {
    if (wanted && inView) video.play().catch(sync);
    else video.pause();
  };
  const flip = () => {
    wanted = video.paused;
    if (wanted) inView = true;
    apply();
  };

  toggle.hidden = false;
  toggle.addEventListener('click', flip);
  video.addEventListener('click', flip);
  video.addEventListener('play', sync);
  video.addEventListener('pause', sync);
  // A browser that cannot play the file keeps the poster; a play button would lie.
  video.addEventListener('error', () => {
    wanted = false;
    toggle.hidden = true;
  });
  sync();

  if (!('IntersectionObserver' in window)) return;
  new IntersectionObserver(
    ([entry]) => {
      inView = entry.isIntersecting;
      // The app section makes the same pitch, bigger: no need for the card on top of it.
      if (inView) closeAppPromo();
      apply();
    },
    { threshold: 0.35 }
  ).observe(video);
}
