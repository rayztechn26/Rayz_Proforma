(() => {
  let activeSlide = 0, timer = null;
  const roots = document.querySelectorAll('[data-demo]');
  function show(index) {
    activeSlide = Math.max(0, Math.min(7, index));
    roots.forEach(root => {
      root.querySelectorAll('[data-slide]').forEach(slide => {slide.hidden = Number(slide.dataset.slide) !== activeSlide;});
      root.querySelector('[data-counter]').textContent = `${activeSlide + 1} / 8`;
      root.querySelector('[data-prev]').disabled = activeSlide === 0;
      root.querySelector('[data-next]').disabled = activeSlide === 7;
      root.querySelector('[data-progress]').style.width = `${(activeSlide + 1) / 8 * 100}%`;
    });
  }
  function pause() {
    clearInterval(timer); timer = null;
    roots.forEach(root => {root.querySelector('[data-play]').hidden = false; root.querySelector('[data-pause]').hidden = true;});
  }
  roots.forEach(root => {
    root.querySelector('[data-next]').onclick = () => {pause(); show(activeSlide + 1);};
    root.querySelector('[data-prev]').onclick = () => {pause(); show(activeSlide - 1);};
    root.querySelector('[data-play]').onclick = () => {
      pause(); if (activeSlide === 7) show(0);
      roots.forEach(r => {r.querySelector('[data-play]').hidden = true; r.querySelector('[data-pause]').hidden = false;});
      timer = setInterval(() => {show(activeSlide + 1); if (activeSlide === 7) pause();}, 10000);
    };
    root.querySelector('[data-pause]').onclick = pause;
  });
  document.addEventListener('keydown', e => {
    if (e.altKey || e.ctrlKey || e.metaKey || e.target.closest('input,textarea,select')) return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {e.preventDefault(); pause(); show(activeSlide + (e.key === 'ArrowRight' ? 1 : -1));}
  });
  document.querySelectorAll('[data-set-lang]').forEach(button => button.addEventListener('click', pause));
  document.addEventListener('visibilitychange', () => {if (document.hidden) pause();});
  show(0);
})();
