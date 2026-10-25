// Guided discovery: the app opens as an ordinary schedule app with an AI
// assistant. One feature at a time glows; clicking it starts a short tutorial
// on the real interface. A skill's achievement lights up only when the person
// later does it on their own. Nothing here touches synced data: progress lives
// in this browser, and the funnel counters show where people drop off.
import {html, raw, attr, cx, escapeHtml} from '../lib/html.js';
import {icon} from '../lib/icons.js';
import {frame} from '../shell/overlays.js';
import {shortDate} from '../lib/dates.js';

const KEY = 'tt-public-demo-discovery-v1';
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const hasPopover = typeof HTMLElement !== 'undefined' && Object.prototype.hasOwnProperty.call(HTMLElement.prototype, 'popover');

const nav = view => [`#overlay-more [data-view="${view}"]`, `.rail-item.mod-${view}`, `.tabbar .tab.mod-${view}`, '.tabbar [data-act="shell.more"]'];
const dom = selector => () => !!visible(selector);
const onView = (view, tab) => app => app.state.route.view === view && (tab === undefined || (app.state.route.params.tab || '') === tab);

// Achievements record what someone has learned, never how much they did.
export const SKILLS = [
  {id: 'ask', name: '一句话的魔法', learn: '跟 AI 说一句话，让它整理成日程', glyph: 'chat', color: 'var(--pine)',
    glow: ['.assistant-btn'], label: '试试：说一句话就排好',
    practice: '下次有新安排时，自己跟 AI 说一句话，再确认添加。',
    solo: {signal: 'ai.schedule'},
    tour: [
      {sel: ['.assistant-btn'], text: '这是 AI 助手。大部分安排，跟它说一句话就够了。点一下打开它。', until: {dom: '.assistant-input'}, skipIf: dom('.assistant-input')},
      {sel: ['.asst-compose .asst-box'], text: '试着输入一句话，比如「周五晚上入住杭州的酒店」，按回车发送。', fill: {label: '帮我填好这句', text: '周五晚上入住杭州的酒店'}, until: {dom: '.asst-proposal'}, skipIf: dom('.asst-proposal')},
      {sel: ['.asst-proposal'], text: 'AI 把这句话整理成了时间，还想到了要准备什么。确认之前什么都不会保存。看一眼，然后点「确认添加」。', until: {signal: 'ai.schedule'}},
    ]},
  {id: 'done', name: '第一朵花', learn: '做完一件事，点一下它前面的圆圈', glyph: 'check', color: 'var(--mint)',
    glow: ['.view-today .done-btn[aria-pressed="false"]'], label: '做完了？点一下',
    practice: '下次做完一件事，自己点一下它前面的圆圈。',
    solo: {commit: 'done'},
    tour: [
      {sel: nav('today'), text: '先回到「今天」。', until: {route: onView('today')}, skipIf: onView('today')},
      {sel: ['.view-today .done-btn[aria-pressed="false"]'], text: '每件事前面的小圆圈就是完成按钮。做完一件事，点一下它。完成的事会变成花园里的素材。', until: {commit: 'done'}},
    ]},
  {id: 'garden', name: '小小园丁', learn: '把完成得到的素材种进花园', glyph: 'leaf', color: 'var(--c-growth)',
    glow: ['.garden-nudge', '.rail-item.mod-growth', '.tabbar .tab.mod-growth'], label: '花园里有新素材',
    practice: '下次背包里有新素材时，自己把它摆进花园。',
    solo: {commit: 'garden'},
    tour: [
      {sel: nav('growth'), text: '你完成的每件事，都在「成长」里变成了素材。打开它看看。', until: {route: onView('growth')}, skipIf: onView('growth')},
      {sel: ['.growth-tabs [data-tab="garden"]'], text: '切到「花园」。', until: {route: onView('growth', 'garden')}, skipIf: onView('growth', 'garden')},
      {sel: ['.g-materials .g-material'], text: '背包里每一份素材，都来自一件你完成的事。选一份。', empty: '背包现在是空的。先去完成一件事，就会得到新素材。', until: {dom: '.g-hit.is-spot'}, skipIf: dom('.g-hit.is-spot')},
      {sel: ['.garden-canvas'], text: '岛上发光的空地都可以种。点一块，把它种下去。', until: {commit: 'garden'}},
    ]},
  {id: 'plan', name: '先放一放', learn: '把待规划池里的事排进日历', glyph: 'inbox', color: 'var(--c-calendar)',
    glow: ['.planning-pool .planning-task .btn', '.rail-item.mod-calendar', '.tabbar .tab.mod-calendar'], label: '没定时间的事在这里',
    practice: '自己把待规划池里的另一件事排进日历，拖进去或点「排期」都可以。',
    solo: {commit: 'plan'},
    tour: [
      {sel: nav('calendar'), text: '打开「日历」。', until: {route: onView('calendar')}, skipIf: onView('calendar')},
      {sel: ['.planning-pool'], text: '还没定时间的事都在「待规划池」里，不用急着决定。准备好了再给它们排期。', manual: true},
      {sel: ['.planning-task .btn[data-act="planning.edit"]'], text: '点「排期」给一件事安排时间。熟练以后，也可以直接把它拖进日历。', until: {dom: '#overlay-planning-edit'}, skipIf: dom('#overlay-planning-edit')},
      {sel: ['#overlay-planning-edit .overlay-foot .btn-primary'], text: '选好日期和开始时间，点「保存排期」。', until: {commit: 'plan'}},
    ]},
  {id: 'split', name: '化整为零', learn: '让 AI 把大目标拆成能马上开始的小步', glyph: 'steps', color: 'var(--c-tasks)',
    glow: ['[data-act="assistant.decomposeDraft"]'], label: '大目标？拆成小步',
    // Glows only when the draft in the assistant looks like a goal.
    context: () => { const input = visible('.assistant-input'); return !!input && /准备|完成|搞定|学会|复习|计划|写完|做完|项目|论文|报告|作品集/.test(input.value || ''); },
    practice: '下次遇到一个不知从哪开始的目标，自己让 AI 拆一次。',
    solo: {signal: 'ai.split'},
    tour: [
      {sel: ['.assistant-btn'], text: '大目标也可以交给 AI。先打开 AI 助手。', until: {dom: '.assistant-input'}, skipIf: dom('.assistant-input')},
      {sel: ['.asst-compose .asst-box'], text: '写下一个大目标，比如「准备期末考试」，然后点「拆成任务」。', fill: {label: '帮我填好', text: '准备期末考试'}, until: {dom: '.asst-proposal.kind-decompose'}, skipIf: dom('.asst-proposal.kind-decompose')},
      {sel: ['.asst-proposal'], text: '它被拆成了三个能马上开始的小步骤。确认后，它们会进入待规划池。', until: {signal: 'ai.split'}},
    ]},
  {id: 'tips', name: '有备无患', learn: '把 AI 想到的准备事项加进待办', glyph: 'bell', color: 'var(--gold)',
    glow: ['.asst-tips'], label: 'AI 想到了你可能会忘的事', contextOnly: true,
    context: dom('.asst-tips'),
    practice: '下次 AI 给出准备提醒时，自己勾选需要的，再确认添加。',
    solo: {signal: 'ai.tips'},
    tour: [
      {sel: ['.asst-tips'], text: 'AI 根据这件事想到了要提前准备的东西。不需要的可以点一下取消勾选。', manual: true},
      {sel: ['.asst-proposal [data-act="assistant.apply"]'], text: '确认后，勾选的提醒会在前一天出现在「今天」。', until: {signal: 'ai.tips'}},
    ]},
  {id: 'focus', name: '心流时刻', learn: '为一件事开始一段专注计时', glyph: 'focus', color: 'var(--c-focus)',
    glow: ['.view-today .side-card [data-view="focus"]', '.rail-item.mod-focus'], label: '开始一段专注',
    practice: '下次要专心做一件事时，自己开一次专注计时。',
    solo: {action: 'focus.start'},
    tour: [
      {sel: nav('focus'), text: '打开「专注」。', until: {route: onView('focus')}, skipIf: onView('focus')},
      {sel: ['.view-focus form[data-submit="focus.start"] [type="submit"]'], text: '选一件要做的事、设好时长，点「开始专注」。这段时间会记进它的实际用时。', until: {action: 'focus.start'}},
    ]},
];
const byId = id => SKILLS.find(skill => skill.id === id);

// ----- DOM helpers ---------------------------------------------------------
function modalOpen() { const list = [...document.querySelectorAll('dialog[open]')]; return list.at(-1) || null; }
function isShown(el) {
  if (!el || !el.isConnected) return false;
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return false;
  if (r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) return false;
  const modal = modalOpen();
  if (modal && !modal.contains(el)) return false;
  return getComputedStyle(el).visibility !== 'hidden';
}
function visible(selectors) {
  for (const sel of [].concat(selectors)) for (const el of document.querySelectorAll(sel)) if (isShown(el)) return el;
  return null;
}
// Like visible(), but accepts targets scrolled out of view (the page scrolls to them).
function present(selectors) {
  for (const sel of [].concat(selectors)) for (const el of document.querySelectorAll(sel)) {
    if (!el.isConnected) continue;
    const r = el.getBoundingClientRect();
    const modal = modalOpen();
    if (r.width >= 2 && r.height >= 2 && (!modal || modal.contains(el))) return el;
  }
  return null;
}

// ----- Persistence ---------------------------------------------------------
function load() {
  try { const saved = JSON.parse(localStorage.getItem(KEY) || 'null'); if (saved?.v === 1) return saved; } catch {}
  return {v: 1, off: false, skills: {}, funnel: {}};
}

export function registerDiscovery(app) {
  let D = load();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(D)); } catch {} };
  const skillState = id => D.skills[id]?.state || 'new';
  const funnel = id => (D.funnel[id] ||= {shown: 0, clicked: 0, toured: 0, solo: 0});
  const seenThisVisit = new Set();
  let tour = null;            // {id, i, done:boolean}
  let quietUntil = 0;         // the action that ends a tutorial must not also unlock things
  let glow = null;            // {id, el}
  let banner = null;
  const bump = () => app.setUi('discovery', {rev: (app.ui('discovery').rev || 0) + 1});

  // ----- Layer elements (top layer when supported, so they sit above dialogs)
  const layer = document.createElement('div');
  layer.className = 'dc-layer';
  layer.innerHTML = '<div class="dc-glow" hidden><span class="dc-ring"></span><button type="button" class="dc-glow-label"></button></div><div class="dc-spot" hidden></div><section class="dc-card" hidden role="dialog" aria-live="polite"></section>';
  if (hasPopover) layer.setAttribute('popover', 'manual');
  document.body.append(layer);
  const glowEl = layer.querySelector('.dc-glow'), spotEl = layer.querySelector('.dc-spot'), cardEl = layer.querySelector('.dc-card');
  // A modal dialog makes everything outside it inert, so the layer moves into
  // the topmost open dialog (top-layer elements still position against the
  // viewport) and back to <body> when it closes.
  function home() {
    const modal = modalOpen(), parent = modal && !modal.classList.contains('closing') ? modal : document.body;
    if (layer.parentElement !== parent || !layer.isConnected) parent.append(layer);
  }
  function raise() {
    home();
    if (!hasPopover) return;
    try { if (!layer.matches(':popover-open')) layer.showPopover(); } catch {}
  }

  // ----- Choosing what glows ------------------------------------------------
  function pickGlow() {
    if (D.off || tour) return null;
    const open = SKILLS.filter(skill => skillState(skill.id) === 'new' && !D.skills[skill.id]?.dismissed);
    const contextual = open.filter(skill => skill.context?.());
    const queued = open.filter(skill => !skill.contextOnly && !skill.context);
    for (const skill of [...contextual, ...queued]) {
      const el = visible(skill.glow);
      if (el) return {id: skill.id, el};
    }
    return null;
  }

  function place(el, rect, pad = 6) {
    el.style.left = (rect.left - pad) + 'px'; el.style.top = (rect.top - pad) + 'px';
    el.style.width = (rect.width + pad * 2) + 'px'; el.style.height = (rect.height + pad * 2) + 'px';
  }

  function placeCard(target) {
    cardEl.hidden = false;
    const w = Math.min(340, innerWidth - 24), card = cardEl.getBoundingClientRect(), h = card.height || 160;
    cardEl.style.width = w + 'px';
    if (!target) { cardEl.style.left = (innerWidth - w) / 2 + 'px'; cardEl.style.top = Math.max(12, innerHeight - h - 96) + 'px'; cardEl.dataset.side = 'none'; return; }
    const r = target.getBoundingClientRect();
    const below = r.bottom + 14 + h < innerHeight - 8, above = r.top - 14 - h > 8;
    let top = below ? r.bottom + 14 : above ? r.top - 14 - h : Math.max(8, innerHeight - h - 12);
    let left = Math.min(Math.max(12, r.left + r.width / 2 - w / 2), innerWidth - w - 12);
    cardEl.style.left = left + 'px'; cardEl.style.top = top + 'px';
    cardEl.dataset.side = below ? 'below' : above ? 'above' : 'none';
    cardEl.style.setProperty('--arrow', Math.min(Math.max(18, r.left + r.width / 2 - left), w - 18) + 'px');
  }

  // ----- Tour engine -----------------------------------------------------------
  function current() { return tour && !tour.done ? byId(tour.id).tour[tour.i] : null; }
  function advance() {
    if (!tour) return;
    const skill = byId(tour.id);
    tour.i++;
    while (tour.i < skill.tour.length && skill.tour[tour.i].skipIf?.(app)) tour.i++;
    if (tour.i >= skill.tour.length) finishTour();
    renderCard(); tick();
  }
  function startTour(id) {
    const skill = byId(id);
    if (!skill) return;
    tour = {id, i: 0, done: false};
    funnel(id).clicked++; save();
    while (tour.i < skill.tour.length && skill.tour[tour.i].skipIf?.(app)) tour.i++;
    if (tour.i >= skill.tour.length) finishTour();
    renderCard(); tick(); bump();
  }
  function finishTour() {
    const id = tour.id;
    funnel(id).toured++;
    if (skillState(id) !== 'learned') D.skills[id] = {...D.skills[id], state: 'practice', toured: app.today};
    save();
    tour = {id, i: 0, done: true};
    quietUntil = Date.now() + 1200;
    bump();
  }
  function endTour() { tour = null; renderCard(); tick(); bump(); }

  function renderCard() {
    if (!tour) { cardEl.hidden = true; spotEl.hidden = true; return; }
    const skill = byId(tour.id);
    if (tour.done) {
      cardEl.innerHTML = `<div class="dc-card-head"><span class="dc-medal is-half" style="--mc:${skill.color}">${icon(skill.glyph).text}</span><div><small>教程完成</small><b>${escapeHtml(skill.name)}</b></div></div>
        <p>学会了！现在<strong>自己试一次</strong>：${escapeHtml(skill.practice)}</p><p class="dc-sub">独立完成后，就会点亮这个成就。</p>
        <div class="dc-actions"><button type="button" class="btn btn-quiet btn-sm" data-dc="map">看技能地图</button><button type="button" class="btn btn-primary btn-sm" data-dc="close">好的</button></div>`;
      return;
    }
    const step = skill.tour[tour.i], n = skill.tour.length;
    const empty = step.empty && !present(step.sel);
    cardEl.innerHTML = `<div class="dc-card-head"><span class="dc-medal" style="--mc:${skill.color}">${icon(skill.glyph).text}</span><div><small>教程 · ${tour.i + 1} / ${n}</small><b>${escapeHtml(skill.name)}</b></div><button type="button" class="icon-btn sm dc-x" data-dc="skip" aria-label="跳过教程">${icon('close').text}</button></div>
      <p>${escapeHtml(empty ? step.empty : step.text)}</p>
      <div class="dc-dots" aria-hidden="true">${skill.tour.map((_, i) => `<i class="${i < tour.i ? 'is-done' : i === tour.i ? 'is-now' : ''}"></i>`).join('')}</div>
      <div class="dc-actions"><button type="button" class="btn btn-ghost btn-sm" data-dc="skip">跳过教程</button>${step.fill && !empty ? `<button type="button" class="btn btn-quiet btn-sm" data-dc="fill">${escapeHtml(step.fill.label)}</button>` : ''}${step.manual ? '<button type="button" class="btn btn-primary btn-sm" data-dc="next">下一步</button>' : ''}</div>`;
  }

  // ----- Achievement banner ------------------------------------------------------
  function unlock(id) {
    const skill = byId(id);
    if (!skill || skillState(id) === 'learned') return;
    D.skills[id] = {...D.skills[id], state: 'learned', learnedAt: app.today};
    funnel(id).solo++; save();
    banner?.remove();
    banner = document.createElement('div');
    banner.className = 'dc-banner';
    banner.setAttribute('role', 'status');
    const count = SKILLS.filter(s => skillState(s.id) === 'learned').length;
    banner.innerHTML = `<span class="dc-medal is-on" style="--mc:${skill.color}">${icon(skill.glyph).text}</span><div><small>成就达成 · ${count} / ${SKILLS.length}</small><b>${escapeHtml(skill.name)}</b><span>你自己${escapeHtml(skill.learn)}</span></div><button type="button" class="dc-banner-link" data-dc="map">技能地图</button>`;
    layer.append(banner);
    const node = banner;
    setTimeout(() => node.classList.add('leaving'), 4600);
    setTimeout(() => { node.remove(); if (banner === node) banner = null; }, 5000);
    bump(); tick();
  }

  // ----- Detection ---------------------------------------------------------------
  const COMMITS = {
    done: (before, after) => after.progress.records.length > before.progress.records.length,
    garden: (before, after) => Object.keys(after.progress.garden?.world?.placements || {}).length > Object.keys(before.progress.garden?.world?.placements || {}).length,
    plan: (before, after) => {
      const old = new Map(before.schedule.events.map(e => [e.id, e]));
      return after.schedule.events.some(e => e.type === 'task' && e.plannedStart && !old.get(e.id)?.plannedStart && old.has(e.id));
    },
  };
  function heard(kind, value) {
    const step = current();
    if (step?.until?.[kind] !== undefined && (kind === 'commit' ? COMMITS[step.until.commit](...value) : step.until[kind] === value)) { advance(); return; }
    if ((tour && !tour.done) || Date.now() < quietUntil) return;   // no unlocks while a tutorial is running
    for (const skill of SKILLS) {
      if (skillState(skill.id) === 'learned' || !skill.solo[kind]) continue;
      if (kind === 'commit' ? COMMITS[skill.solo.commit](...value) : skill.solo[kind] === value) unlock(skill.id);
    }
  }
  app.onSignal(name => heard('signal', name));
  app.onAction(name => heard('action', name));
  app.onCommit((before, after) => heard('commit', [before, after]));

  // ----- Frame loop: position glow, spotlight and card ---------------------------
  let raf = 0;
  function tick() {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(update);
  }
  function update() {
    const step = current();
    if (step) {
      if (step.until?.dom && visible(step.until.dom)) { advance(); return; }
      if (step.until?.route && step.until.route(app)) { advance(); return; }
    }
    // Glow
    glow = pickGlow();
    const anything = !!glow || !!tour || !!banner;
    if (anything) raise(); else if (hasPopover && layer.matches(':popover-open')) layer.hidePopover();
    if (glow) {
      const r = glow.el.getBoundingClientRect();
      place(glowEl, r, 5);
      glowEl.hidden = false;
      glowEl.dataset.skill = glow.id;
      const skill = byId(glow.id), label = glowEl.querySelector('.dc-glow-label');
      if (label.dataset.id !== glow.id) { label.dataset.id = glow.id; label.innerHTML = icon('sparkle').text + '<span>' + escapeHtml(skill.label) + '</span>'; }
      glowEl.dataset.side = r.top < 120 ? 'below' : 'above';
      glowEl.classList.toggle('is-tight', r.width < 56);
      // Keep the label inside the screen near the edges.
      const lr = label.getBoundingClientRect(), cur = parseFloat(glowEl.style.getPropertyValue('--lx')) || 0;
      const shift = cur + Math.min(0, innerWidth - 8 - lr.right) + Math.max(0, 8 - lr.left);
      if (Math.abs(shift - cur) > .5) glowEl.style.setProperty('--lx', shift + 'px');
      if (!seenThisVisit.has(glow.id)) { seenThisVisit.add(glow.id); funnel(glow.id).shown++; save(); }
    } else glowEl.hidden = true;
    // Spotlight + card
    if (tour && !tour.done) {
      const target = present(step.sel);
      if (target) {
        const r = target.getBoundingClientRect();
        if (r.top < 60 || r.bottom > innerHeight - 20) { target.scrollIntoView({block: 'center', behavior: reduced() ? 'auto' : 'smooth'}); }
        place(spotEl, r, 6); spotEl.hidden = false;
      } else spotEl.hidden = true;
      placeCard(target && isShown(target) ? target : null);
    } else if (tour?.done) { spotEl.hidden = true; placeCard(null); }
    else { spotEl.hidden = true; cardEl.hidden = true; }
  }
  app.onRender(tick);
  addEventListener('resize', tick);
  addEventListener('scroll', tick, true);
  setInterval(() => { if (!document.hidden) update(); }, 350);

  // Clicking the glowing element does its normal job, then starts the tutorial.
  document.addEventListener('click', event => {
    if (event.target.closest?.('.dc-layer')) return;
    if (!glow || tour) return;
    if (glow.el.contains(event.target)) { const id = glow.id; setTimeout(() => startTour(id), 60); }
  }, true);
  layer.addEventListener('click', event => {
    const label = event.target.closest('.dc-glow-label');
    if (label && glow) {
      const id = glow.id, el = glow.el;
      // The label starts the same tutorial; the first step points at the element.
      startTour(id);
      if (!byId(id).tour[0].skipIf) el.focus?.({preventScroll: true});
      return;
    }
    const act = event.target.closest('[data-dc]')?.dataset.dc;
    if (!act) return;
    if (act === 'skip') { if (tour && !tour.done) { D.skills[tour.id] = {...D.skills[tour.id], state: skillState(tour.id) === 'learned' ? 'learned' : 'new', dismissed: true}; save(); } endTour(); app.toast('已跳过这段教程', {detail: '随时可以在「成长 › 技能地图」里重新打开。'}); }
    else if (act === 'close') endTour();
    else if (act === 'next') advance();
    else if (act === 'map') { endTour(); banner?.remove(); banner = null; openMap(); }
    else if (act === 'fill') {
      const step = current();
      if (!step?.fill) return;
      app.getView('assistant').setDraft(app, step.fill.text);
      for (const input of document.querySelectorAll('.assistant-input')) { input.value = step.fill.text; input.focus({preventScroll: true}); }
      tick();
    }
  });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && tour && !app.overlays.any()) endTour(); });

  // ----- Skill map -----------------------------------------------------------------
  function medal(skill, size = '') {
    const st = skillState(skill.id);
    return html`<span class="${cx('dc-medal', size, st === 'learned' && 'is-on', st === 'practice' && 'is-half')}" style="${'--mc:' + skill.color}">${icon(st === 'new' ? 'lock' : skill.glyph)}</span>`;
  }
  function statusLine(skill) {
    const st = skillState(skill.id), info = D.skills[skill.id] || {};
    if (st === 'learned') return '已点亮 · ' + shortDate(info.learnedAt);
    if (st === 'practice') return '练习中：自己完成一次就能点亮';
    if (skill.contextOnly) return '在 AI 给出准备提醒时出现';
    return '还没解锁';
  }
  function mapBody() {
    const learned = SKILLS.filter(s => skillState(s.id) === 'learned').length;
    const rows = SKILLS.map(s => ({id: s.id, name: s.name, ...funnel(s.id)}));
    return html`<div class="dc-map">
  <div class="dc-map-head"><div class="dc-map-meter"><i style="${'width:' + Math.round(learned / SKILLS.length * 100) + '%'}"></i></div><p><b>${learned}</b> / ${SKILLS.length} 已点亮。成就只记录你学会了什么，不统计你做了多少。</p></div>
  <ol class="dc-path">${SKILLS.map((s, i) => html`<li class="${cx('dc-node', 'is-' + skillState(s.id))}"><span class="dc-step">${i + 1}</span>${medal(s, 'lg')}<div class="dc-node-copy"><b>${s.name}</b><small>${s.learn}</small><em>${statusLine(s)}</em></div><button type="button" class="btn btn-quiet btn-sm" data-act="discovery.tour" data-id="${s.id}">${skillState(s.id) === 'new' ? '开始教程' : '重看教程'}</button></li>`)}</ol>
  <details class="dc-funnel"><summary>${icon('chart')}引导转化数据<small>仅本浏览器 · 演示用</small></summary>
    <div class="tblw"><table class="dc-table"><thead><tr><th>技能</th><th>发光</th><th>点击</th><th>教程完成</th><th>独立完成</th></tr></thead><tbody>${rows.map(r => html`<tr><td>${r.name}</td><td>${r.shown}</td><td>${r.clicked}</td><td>${r.toured}</td><td>${r.solo}</td></tr>`)}</tbody></table></div>
    <p class="hint">每一步记一次：功能发光 → 被点击 → 跟着教程做完 → 之后自己独立完成。哪一步掉得最多，就说明哪里需要改。</p>
  </details>
</div>`;
  }
  function openMap() {
    app.overlays.show('skills', {size: 'wide', label: '技能地图', render: () => frame({
      title: '技能地图', subtitle: '每个功能第一次用到时才教你；自己做到一次，就点亮一枚成就',
      body: mapBody(),
      foot: html`<label class="dc-switch"><input type="checkbox" data-change="discovery.toggle"${attr('checked', !D.off)}><span>功能发光提示</span></label><button type="button" class="btn btn-quiet left" data-act="discovery.reset">重新开始引导</button><button type="button" class="btn btn-primary" data-act="overlay.close">关闭</button>`,
    })});
  }
  function card(state) {
    const learned = SKILLS.filter(s => skillState(s.id) === 'learned').length;
    const next = SKILLS.find(s => skillState(s.id) === 'practice') || SKILLS.find(s => skillState(s.id) === 'new' && !s.contextOnly);
    return html`<section class="panel panel-pad dc-card-panel">
  <div class="section-title"><h2>技能地图</h2><span class="count">${learned}/${SKILLS.length}</span><span class="spacer"></span><button type="button" class="link-btn" data-act="discovery.map">查看全部</button></div>
  <ul class="dc-strip">${SKILLS.map(s => html`<li title="${s.name + '：' + statusLine(s)}">${medal(s)}<small>${s.name}</small></li>`)}</ul>
  ${next ? html`<button type="button" class="dc-next" data-act="discovery.tour" data-id="${next.id}">${medal(next)}<span><b>${skillState(next.id) === 'practice' ? '自己试一次：' + next.name : '下一个：' + next.name}</b><small>${skillState(next.id) === 'practice' ? next.practice : next.learn}</small></span>${icon('forward')}</button>` : html`<p class="hint">所有技能都点亮了。</p>`}
</section>`;
  }
  function settingsSection() {
    const learned = SKILLS.filter(s => skillState(s.id) === 'learned').length;
    return html`<section class="panel panel-pad"><div class="section-title"><h2>新手引导</h2><span class="count">${learned}/${SKILLS.length}</span></div><p class="small">新功能会轻轻发光，点它就会带你做一遍。学会了就不再打扰。</p><div class="actions row wrap"><label class="dc-switch"><input type="checkbox" data-change="discovery.toggle"${attr('checked', !D.off)}><span>功能发光提示</span></label><button type="button" class="btn btn-quiet" data-act="discovery.map">${icon('sparkle')}技能地图</button><button type="button" class="btn btn-quiet" data-act="discovery.reset">重新开始引导</button></div></section>`;
  }

  app.view('discovery', {card, settingsSection, openMap, startTour, state: id => skillState(id)});
  app.on('discovery.map', openMap);
  app.on('discovery.tour', el => {
    const id = el.dataset.id;
    app.overlays.close('skills', {restoreFocus: false});
    if (D.skills[id]?.dismissed) { D.skills[id].dismissed = false; save(); }
    setTimeout(() => startTour(id), 280);
  });
  app.on('discovery.toggle', el => { D.off = !el.checked; save(); bump(); tick(); });
  app.on('discovery.reset', () => { const funnelKeep = D.funnel; D = {v: 1, off: false, skills: {}, funnel: funnelKeep}; save(); tour = null; renderCard(); bump(); tick(); app.toast('引导已重新开始', {detail: '学过的功能会重新发光。'}); });
  app.ready ||= [];
  app.ready.push(() => setTimeout(tick, 900));
}
