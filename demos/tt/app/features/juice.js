// Small "juice" for accumulation: when something is completed, a +1 sprout
// flies from where you tapped to the 成长 entry, which then pulses. Purely
// visual; it reads committed data and never writes any.
const flower = new URL('../../assets/garden/kenney-hexagon/flowerYellow.png', import.meta.url).href;

export function registerJuice(app) {
  let last = null;
  document.addEventListener('pointerdown', event => { last = {x: event.clientX, y: event.clientY, t: Date.now()}; }, true);
  const shown = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  app.onCommit((before, after) => {
    const gained = after.progress.records.length - before.progress.records.length;
    if (gained <= 0 || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const target = [...document.querySelectorAll('.rail-item.mod-growth .rail-tile, .tabbar .tab.mod-growth .tab-bean')].find(shown);
    if (!target) return;
    const from = last && Date.now() - last.t < 2000 ? last : {x: innerWidth / 2, y: innerHeight / 2};
    const r = target.getBoundingClientRect(), to = {x: r.left + r.width / 2, y: r.top + r.height / 2};
    const el = document.createElement('div');
    el.className = 'juice';
    el.innerHTML = '<img alt="" src="' + flower + '"><b>+1</b>';
    el.style.left = from.x + 'px'; el.style.top = from.y + 'px';
    document.body.append(el);
    const dx = to.x - from.x, dy = to.y - from.y;
    const anim = el.animate([
      {transform: 'translate(-50%, -50%) scale(.6)', opacity: 0},
      {transform: 'translate(calc(-50% + ' + dx * .15 + 'px), calc(-50% + ' + (dy * .15 - 60) + 'px)) scale(1.15)', opacity: 1, offset: .25},
      {transform: 'translate(calc(-50% + ' + dx + 'px), calc(-50% + ' + dy + 'px)) scale(.5)', opacity: .9},
    ], {duration: 900, easing: 'cubic-bezier(.3,.1,.3,1)'});
    anim.onfinish = () => {
      el.remove();
      target.classList.remove('juice-pulse');
      void target.offsetWidth;
      target.classList.add('juice-pulse');
      setTimeout(() => target.classList.remove('juice-pulse'), 700);
    };
  });
}
