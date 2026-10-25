// 花园. Every material on the island comes from one real completion record
// (TTGardenWorld assigns it a scene and a kind); nothing is generated for
// free. The person chooses where each material goes, can move it or put it
// back, and can trace any plant to the completion it came from. A scene
// unlocks the next one only when every one of its materials is placed.
//
// Art: Kenney "Hexagon Tiles" (CC0), copied unmodified into assets/garden.
import {html, raw, attr, cx} from '../lib/html.js';
import {icon} from '../lib/icons.js';
import {gardenWorld} from '../core.js';
import {FLOWER_CHOICES, normalizeFlower, setFlower} from '../domain/progress.js';
import {toneOf} from './item-row.js';
import {shortDate} from '../lib/dates.js';
import {createEntrances} from '../lib/motion.js';
import {categoryOf, CATEGORIES} from '../domain/understand.js';
import {addDays} from '../lib/dates.js';

// Incremental milestones: the island keeps gaining life as completions add up.
// Nothing is ever taken away for days without activity.
export const MILESTONES = [
  {at: 5, id: 'butterfly', name: '蝴蝶来了', detail: '岛上飞来两只蝴蝶'},
  {at: 15, id: 'birds', name: '小鸟落脚', detail: '树梢上有了小鸟'},
  {at: 30, id: 'lantern', name: '小路亮灯', detail: '岸边亮起两盏灯'},
  {at: 50, id: 'rainbow', name: '雨后彩虹', detail: '岛的上空出现彩虹'},
  {at: 80, id: 'boat', name: '小船靠岸', detail: '一艘小船停在岸边'},
];
// Original vector decorations for the milestones (no third-party art).
const RAINBOW = '<g class="g-rainbow" opacity=".42" fill="none" stroke-linecap="round">' + ['#ff7b7b', '#ffb547', '#ffe066', '#7ad67a', '#6cb8ff', '#a48bff'].map((c, i) => '<path d="M ' + (58 + i * 7) + ' 236 A ' + (162 - i * 7) + ' ' + (150 - i * 7) + ' 0 0 1 ' + (382 - i * 7) + ' 236" stroke="' + c + '" stroke-width="7"/>').join('') + '</g>';
const BUTTERFLY = (x, y, c, d) => '<g class="g-fly" style="--d:' + d + 's" transform="translate(' + x + ' ' + y + ')"><g class="g-wings"><path d="M0 0 C-9 -10 -14 -2 -8 3 C-4 6 -1 3 0 0Z" fill="' + c + '"/><path d="M0 0 C9 -10 14 -2 8 3 C4 6 1 3 0 0Z" fill="' + c + '"/></g><path d="M0 -3 V4" stroke="#4a3f63" stroke-width="1.4" stroke-linecap="round"/></g>';
const BUTTERFLIES = BUTTERFLY(150, 150, '#ff9fc6', 0) + BUTTERFLY(296, 176, '#ffd166', 1.4);
const BIRD = (x, y, d) => '<path class="g-bird" style="--d:' + d + 's" d="M' + x + ' ' + y + ' q 6 -6 11 0 q 5 -6 11 0" fill="none" stroke="#3d4a66" stroke-width="2" stroke-linecap="round"/>';
const BIRDS = BIRD(96, 74, 0) + BIRD(124, 60, .8) + BIRD(330, 86, 1.6);
const LANTERN = (x, y) => '<g class="g-lantern"><path d="M' + x + ' ' + y + ' v-26" stroke="#6b4f3a" stroke-width="2.4" stroke-linecap="round"/><circle cx="' + x + '" cy="' + (y - 29) + '" r="10" fill="#ffd166" opacity=".35" class="g-glow"/><rect x="' + (x - 5) + '" y="' + (y - 35) + '" width="10" height="11" rx="3" fill="#ffc83d" stroke="#c98a00" stroke-width="1.2"/></g>';
const LANTERNS = LANTERN(132, 286) + LANTERN(312, 284);
const BOAT = '<g class="g-boat"><path d="M36 262 h44 l-7 9 h-30 z" fill="#b5835a"/><path d="M58 260 v-30 l16 26 z" fill="#fffbf5" stroke="#d9cbb5" stroke-width="1"/></g>';

const TREES = [['treeGreen_low', '绿叶树'], ['treeBlue_low', '蓝叶树'], ['pineBlue_high', '松树']];
const FLOWER_BY_TONE = {blue: 'flowerBlue', sage: 'flowerGreen', rose: 'flowerRed', peach: 'flowerYellow', slate: 'flowerWhite', task: 'flowerYellow'};
const SCALE = .58;                      // terrain plane projection; plants stay upright
const W = 440, H = 392;
const WATER = new Set(['0,-1', '0,0', '-1,1', '-1,2']);
const BORDER = [[0, -3], [1, -3], [2, -3], [-3, 1], [3, -1]];
const DECOR = [['pineGreen_high', 0, -3, 30, 99], ['treeGreen_mid', 1, -3, 27, 107], ['pineBlue_high', 2, -3, 30, 99], ['treeBlue_mid', -3, 1, 27, 107], ['treeGreen_low', 3, -1, 27, 87]];
const GRASS = [[-2, 0, -14, 5], [-2, 2, -13, 3], [2, -2, 14, -1], [2, 0, 15, 4], [0, 2, 15, 3]];
const ENTRY_MS = 1100;

const root = () => new URL('../../assets/garden/kenney-hexagon/', import.meta.url).href;
const point = (q, r) => ({x: 220 + 65 * (q + r / 2), y: 220 + 56.25 * SCALE * r});
const CELLS = (() => {
  const cells = BORDER.map(([q, r]) => ({q, r}));
  for (let r = -2; r <= 2; r++) for (let q = Math.max(-2, -r - 2); q <= Math.min(2, -r + 2); q++) cells.push({q, r});
  cells.sort((a, b) => a.r - b.r || a.q - b.q);
  return cells.map((c, i) => ({...c, rank: Math.round(i / (cells.length - 1) * 18)}));
})();
const rankOf = (q, r) => CELLS.find(c => c.q === q && c.r === r)?.rank ?? 0;

// Growth stage from the order of completions: the newest flowers are still sprouts.
export function maturities(records) {
  const sorted = records.slice().sort((a, b) => String(a.doneAt || a.date).localeCompare(String(b.doneAt || b.date)));
  const total = sorted.length, map = new Map();
  sorted.forEach((r, i) => { const age = total - i - 1; map.set(r.key, age >= 5 ? 2 : age >= 2 ? 1 : 0); });
  return map;
}

// Which Kenney sprite shows a material: stones and trees by kind (trees can be
// re-chosen), flowers by the colour captured at completion — newest sprouts
// stay grass whatever the colour.
export function plantAsset(record, source) {
  const kind = record.gardenReward?.kind || record.materialKind;
  if (kind === 'stone') return 'smallRockStone';
  if (kind === 'tree') return TREES.some(([id]) => id === record.gardenTree) ? record.gardenTree : TREES[gardenWorld.hash(record.key) % 3][0];
  if (record.maturity === 0) return 'bushGrass';
  const choice = normalizeFlower(record.gardenFlower);
  if (choice !== 'auto') return FLOWER_CHOICES.find(([id]) => id === choice)[2];
  return categoryOf(record.title).flower;
}

export function registerGarden(app) {
  // The island rises once per scene per session; reduced motion skips it.
  const entrances = createEntrances({duration: ENTRY_MS, reduced: () => matchMedia('(prefers-reduced-motion: reduce)').matches});
  const ui = () => ({page: null, selected: null, detail: null, ...app.ui('garden')});
  let seenTotal, growUntil = 0;
  const events = () => app.state.doc.schedule.events;

  function model(progress, page) {
    const v = gardenWorld.view(progress, page ?? 0);
    const growth = maturities(v.records);
    const decorate = r => ({...r, maturity: growth.get(r.key) ?? 2});
    v.items = v.items.map(decorate);
    v.inventory = v.items.filter(r => !r.cell);
    v.slots = v.slots.map(s => ({...s, record: s.record ? v.items.find(r => r.key === s.record.key) : null}));
    return v;
  }
  const asset = record => plantAsset(record, events().find(e => e.id === record.eventId));
  function plantSize(record) {
    const kind = record.gardenReward?.kind, a = asset(record);
    const natural = kind === 'tree' ? (a === 'pineBlue_high' ? [30, 99] : [27, 87]) : kind === 'stone' ? [29, 33] : a === 'bushGrass' ? [15, 20] : [12, 11];
    const h = kind === 'tree' ? [54, 72, natural[1]][record.maturity ?? 2] : kind === 'stone' ? 33 : a === 'bushGrass' ? 20 : 19;
    return {w: natural[0] * h / natural[1], h};
  }

  // ----- Scene ----------------------------------------------------------------
  function scene(v, {editable = false, compact = false} = {}) {
    const u = ui();
    const base = root();
    const key = (editable ? 'edit:' : 'view:') + v.page;
    const entering = entrances.entering(key);
    const selected = editable && u.selected ? v.items.find(r => r.key === u.selected) : null;
    const terrain = CELLS.map(({q, r, rank}) => {
      const p = point(q, r), id = q + ',' + r;
      const tile = WATER.has(id) ? 'tileWater' : q === -2 && r === 1 ? 'tileSand' : 'tileGrass';
      const at = 'translate(' + (p.x - 32.5) + ' ' + (p.y - 37.5 * SCALE) + ') scale(1 ' + SCALE + ')';
      return '<g class="g-tile" style="--rank:' + rank + '"><g transform="' + at + '"><image href="' + base + tile + '.png" width="65" height="89"/></g>' +
        (id === '0,0' ? '<g transform="' + at + '"><image href="' + base + 'tileWood_bridge.png" width="65" height="89"/></g>' : '') + '</g>';
    }).join('');
    const ripples = [[0, -1], [-1, 1], [-1, 2]].map(([q, r], i) => { const p = point(q, r); return '<image class="g-ripple" style="animation-delay:-' + i * 2 + 's" href="' + base + 'waveWater.png" x="' + (p.x - 16.5) + '" y="' + (p.y - 5) + '" width="33" height="10"/>'; }).join('');
    const grass = GRASS.map(([q, r, dx, dy]) => { const p = point(q, r); return '<g class="g-tile" style="--rank:' + rankOf(q, r) + '"><image href="' + base + 'bushGrass.png" x="' + (p.x + dx - 7.5) + '" y="' + (p.y + dy - 20) + '" width="15" height="20"/></g>'; }).join('');
    const decor = DECOR.map(([a, q, r, w, h]) => { const p = point(q, r); return '<g class="g-tile" style="--rank:' + rankOf(q, r) + '"><image href="' + base + a + '.png" x="' + (p.x - w / 2) + '" y="' + (p.y - h) + '" width="' + w + '" height="' + h + '"/></g>'; }).join('');
    // Plants are drawn back-to-front so nearer ones overlap farther ones.
    const order = v.slots.slice().sort((a, b) => gardenWorld.slotPoints[a.slot][1] - gardenWorld.slotPoints[b.slot][1]);
    const plants = order.map(s => {
      const [q, r] = gardenWorld.slotPoints[s.slot], p = point(q, r);
      const hex = '<polygon class="g-spot" points="' + [[0, -12.6], [32.5, -6.3], [32.5, 6.3], [0, 12.6], [-32.5, 6.3], [-32.5, -6.3]].map(([x, y]) => (p.x + x * .78) + ',' + (p.y + y * .78)).join(' ') + '"/>';
      if (s.record) {
        const {w, h} = plantSize(s.record);
        const isOpen = u.detail === s.record.key, isMoving = u.selected === s.record.key;
        return '<g class="' + cx('g-tile', 'g-plant', isOpen && 'is-open', isMoving && 'is-moving') + '" style="--rank:' + rankOf(q, r) + '">' + (isOpen || isMoving ? hex : '') +
          '<ellipse cx="' + p.x + '" cy="' + (p.y + 1) + '" rx="' + (s.record.gardenReward.kind === 'stone' ? 15 : 11) + '" ry="3.5" fill="#3f6b3a" opacity=".16"/>' +
          '<image class="g-sprite" href="' + base + asset(s.record) + '.png" x="' + (p.x - w / 2) + '" y="' + (p.y - h + 2) + '" width="' + w + '" height="' + h + '"/></g>';
      }
      if (!selected) return '';
      return '<g class="g-ghost">' + hex + '</g>';
    }).join('');
    // Accessible hit targets over each slot.
    const hits = v.slots.map(s => {
      const [q, r] = gardenWorld.slotPoints[s.slot], p = point(q, r);
      const style = 'left:' + (p.x / W * 100).toFixed(2) + '%;top:' + (p.y / H * 100).toFixed(2) + '%';
      if (s.record) return html`<button type="button" class="${cx('g-hit', 'has-plant', u.detail === s.record.key && 'is-open')}" style="${style}" data-act="garden.detail" data-key="${s.record.key}" aria-label="${'查看' + gardenWorld.labels[s.record.gardenReward.kind] + '：' + s.record.title}"${editable ? '' : raw(' tabindex="-1"')}></button>`;
      if (!selected) return '';
      // Preview of the chosen material, shown on hover/focus of this spot.
      const {w, h} = plantSize(selected);
      return html`<button type="button" class="g-hit is-spot" style="${style}" data-act="garden.place" data-slot="${s.slot}" aria-label="${'摆放到位置 ' + (s.slot + 1)}"><img src="${base + asset(selected) + '.png'}" alt="" style="${'--w:' + w.toFixed(1) + ';--h:' + h.toFixed(1)}"></button>`;
    });
    const reached = new Set(MILESTONES.filter(m => v.total >= m.at).map(m => m.id));
    return html`<div class="${cx('island', entering && 'is-entering', selected && 'is-placing')}" data-garden-scene="${v.page}" data-key="${'island-' + key}">
  <svg class="island-svg" viewBox="0 0 ${W} ${H}" aria-hidden="true">${raw((reached.has('rainbow') ? RAINBOW : '') + '<ellipse cx="220" cy="232" rx="207" ry="113" class="g-sea"/><ellipse cx="220" cy="292" rx="160" ry="28" fill="#2e617c" opacity=".07"/>' + (reached.has('boat') ? BOAT : '') + terrain + ripples + grass + decor + plants + (reached.has('lantern') ? LANTERNS : '') + (reached.has('birds') ? BIRDS : '') + (reached.has('butterfly') ? BUTTERFLIES : ''))}</svg>
  ${editable ? hits : ''}
</div>`;
  }

  function progressBar(v) {
    const s = v.scene;
    return html`<div class="g-progress">
  <div class="g-progress-copy"><b>${s.name}</b><span>${s.placed} / ${s.capacity} 已摆放</span></div>
  <div class="g-beads" role="progressbar" aria-label="${'场景 ' + (v.page + 1) + '，已摆放 ' + s.placed + ' 份素材'}" aria-valuemin="0" aria-valuemax="${s.capacity}" aria-valuenow="${s.placed}" aria-valuetext="${s.complete ? '下一场景已解锁' : '再摆放 ' + (s.capacity - s.placed) + ' 份解锁下一场景'}">${Array.from({length: s.capacity}, (_, i) => html`<i class="${i < s.placed ? 'is-on' : ''}"></i>`)}</div>
  <small>${s.complete ? '这片场景布置好了，下一片已解锁。' : '再摆放 ' + (s.capacity - s.placed) + ' 份，解锁下一片场景'}</small>
</div>`;
  }
  function pager(v) {
    if (v.unlocked <= 1) return '';
    return html`<div class="g-pager"><button type="button" class="icon-btn" data-act="garden.page" data-page="${v.page - 1}"${attr('disabled', v.page === 0)} aria-label="上一片场景">${icon('back')}</button><span>第 ${v.page + 1} 片 / 已解锁 ${v.unlocked} 片</span><button type="button" class="icon-btn" data-act="garden.page" data-page="${v.page + 1}"${attr('disabled', v.page >= v.unlocked - 1)} aria-label="下一片场景">${icon('forward')}</button></div>`;
  }
  function tray(v) {
    const u = ui(), base = root();
    return html`<section class="g-tray" aria-label="素材背包">
  <div class="g-tray-head"><b>背包</b><span>${v.inventory.length ? v.inventory.length + ' 份待摆放' : ''}</span>${v.reserved ? html`<small>另有 ${v.reserved} 份待场景解锁</small>` : ''}</div>
  ${v.inventory.length ? html`<div class="g-materials">${v.inventory.map(r => html`<button type="button" class="g-material" data-act="garden.select" data-key="${r.key}" aria-pressed="${u.selected === r.key ? 'true' : 'false'}" title="${r.title}" aria-label="${'选择素材：' + r.materialLabel + '，来自「' + r.title + '」'}"><img src="${base + asset(r) + '.png'}" alt=""><span>${r.materialLabel}</span></button>`)}</div>`
    : html`<p class="g-empty-tray">${v.total ? '这片场景的素材都摆好了。' : '完成一件事，就会得到第一份素材。'}</p>`}
</section>`;
  }
  function selectionBar(v) {
    const u = ui(), r = u.selected && v.items.find(x => x.key === u.selected);
    if (!r) return '';
    return html`<div class="g-selection" role="status"><img src="${root() + asset(r) + '.png'}" alt=""><div><b>${r.cell ? '移动' : '摆放'}「${r.title}」</b><small>点岛上发光的空地放下它</small></div><button type="button" class="btn btn-quiet btn-sm" data-act="garden.cancel">取消</button></div>`;
  }

  function details(v, state) {
    const u = ui();
    const record = u.detail && v.records.find(r => r.key === u.detail);
    if (!record) return '';
    const item = v.items.find(r => r.key === record.key) || {...record, maturity: maturities(v.records).get(record.key) ?? 2};
    const reward = record.gardenReward, label = gardenWorld.labels[reward.kind];
    const source = events().find(e => e.id === record.eventId);
    const placed = v.world.placements[gardenWorld.materialId(record.key)], locked = reward.scene >= v.unlocked;
    const known = record.kind === 'event' && Number.isFinite(record.minutes) && record.minutes >= 0;
    const flower = normalizeFlower(record.gardenFlower);
    return html`<aside class="g-detail" aria-label="素材详情" data-key="${'gd-' + record.key}">
  <div class="g-detail-head"><span class="chip ${locked ? 'chip-outline' : placed ? 'chip-mint' : 'chip'}">${label}，${locked ? '待解锁' : placed ? '已摆放' : '背包中'}</span><span class="spacer"></span><button type="button" class="icon-btn sm" data-act="garden.closeDetail" aria-label="收起素材详情">${icon('close')}</button></div>
  <div class="g-detail-hero"><span class="g-detail-art"><img src="${root() + asset(item) + '.png'}" alt=""></span><div><h3>${record.title}</h3><p>${shortDate(record.date)}完成，来自${record.kind === 'task' ? '待办' : '日程'}</p></div></div>
  ${reward.kind === 'flower' ? html`<div class="g-options" role="group" aria-label="花色">${FLOWER_CHOICES.map(([id, name, a]) => html`<button type="button" class="g-option" data-act="garden.flower" data-key="${record.key}" data-flower="${id}" aria-pressed="${flower === id ? 'true' : 'false'}"><img src="${root() + a + '.png'}" alt=""><span>${name}</span></button>`)}</div>` : ''}
  ${reward.kind === 'tree' ? html`<div class="g-options" role="group" aria-label="树形">${TREES.map(([id, name]) => html`<button type="button" class="g-option" data-act="garden.tree" data-key="${record.key}" data-tree="${id}" aria-pressed="${asset(item) === id ? 'true' : 'false'}"><img src="${root() + id + '.png'}" alt=""><span>${name}</span></button>`)}</div>` : ''}
  <dl class="kv g-facts">
    <div><dt>完成日期</dt><dd>${record.date}</dd></div>
    ${record.occurrenceDate && record.occurrenceDate !== record.date ? html`<div><dt>原安排日期</dt><dd>${record.occurrenceDate}</dd></div>` : ''}
    ${known ? html`<div><dt>计划时长</dt><dd>${record.minutes} 分钟</dd></div>` : ''}
    ${source?.location ? html`<div><dt>地点</dt><dd>${source.location}</dd></div>` : ''}
    ${source?.note ? html`<div><dt>备注</dt><dd>${source.note}</dd></div>` : ''}
    ${!source ? html`<div><dt>原事项</dt><dd class="muted">已删除，完成记录仍保留</dd></div>` : ''}
  </dl>
  ${locked ? html`<p class="hint">当前场景布置完成后才能使用这份素材。</p>` : html`<div class="row wrap">
    <button type="button" class="btn btn-primary btn-sm" data-act="garden.select" data-key="${record.key}">${icon('move')}${placed ? '移动' : '摆放'}</button>
    ${placed ? html`<button type="button" class="btn btn-quiet btn-sm" data-act="garden.remove" data-key="${record.key}">${icon('undo')}收回背包</button>` : ''}
    ${source ? html`<button type="button" class="btn btn-ghost btn-sm" data-act="item.open" data-id="${source.id}" data-date="${record.occurrenceDate || record.date}">${icon('link')}查看原事项</button>` : ''}
  </div>`}
</aside>`;
  }

  // ----- Accumulation -----------------------------------------------------------
  // Big, growing numbers and the next milestone, the way incremental games show
  // progress. Counts come from completion records only.
  function counts(records) {
    const c = {tree: 0, flower: 0, stone: 0};
    for (const r of records) if (c[r.gardenReward?.kind] !== undefined) c[r.gardenReward.kind]++;
    return c;
  }
  function tally(v, state, mini = false) {
    const c = counts(v.records), next = MILESTONES.find(m => v.total < m.at), prev = [...MILESTONES].reverse().find(m => v.total >= m.at);
    const last = v.records.map(r => r.date).sort().at(-1);
    const away = last && last <= addDays(state.today, -3);
    const from = prev ? prev.at : 0, ratio = next ? (v.total - from) / (next.at - from) : 1;
    if (!mini) { if (seenTotal !== undefined && v.total > seenTotal) growUntil = Date.now() + 1400; seenTotal = v.total; }
    const grew = Date.now() < growUntil;
    return html`<div class="${cx('g-tally', mini && 'is-mini', grew && 'is-growing')}">
  ${away && !mini ? html`<p class="g-welcome">${icon('heart')}欢迎回来。花园一切都好，一直在等你。</p>` : ''}
  <div class="g-counts">
    <span class="g-count is-total"><b class="num">${v.total}</b><small>件事长成了花园</small></span>
    <span class="g-count"><img src="${root() + 'treeGreen_low.png'}" alt=""><b class="num">${c.tree}</b><small>树</small></span>
    <span class="g-count"><img src="${root() + 'flowerYellow.png'}" alt=""><b class="num">${c.flower}</b><small>花</small></span>
    <span class="g-count"><img src="${root() + 'smallRockStone.png'}" alt=""><b class="num">${c.stone}</b><small>石</small></span>
  </div>
  ${next ? html`<div class="g-milestone"><div class="g-milestone-copy"><span>${icon('sparkle')}再完成 <b>${next.at - v.total}</b> 件：${next.name}</span><small>${next.detail}</small></div><i class="g-milestone-bar"><i style="${'width:' + Math.round(ratio * 100) + '%'}"></i></i></div>` : html`<p class="g-milestone-done">${icon('sparkle')}所有里程碑都达成了，花园会继续长下去。</p>`}
</div>`;
  }
  function rules(v) {
    return html`<section class="panel panel-pad g-rules">
  <div class="section-title"><h2>花园怎么长</h2></div>
  <ul class="g-rule-list">
    <li>${icon('check')}<span><b>每完成一件事，得到一份素材。</b>撤销完成时，这份素材会一起收回。</span></li>
    <li>${icon('leaf')}<span><b>花色由 AI 按事项分类决定。</b><span class="g-cats">${CATEGORIES.map(c => html`<span class="g-cat"><img src="${root() + c.flower + '.png'}" alt="">${c.label}</span>`)}</span></span></li>
    <li>${icon('heart')}<span><b>只积累，不惩罚。</b>几天没打开也没关系，花园不会枯萎，已经长出来的都在。</span></li>
  </ul>
  <h3 class="g-mile-title">里程碑</h3>
  <ol class="g-miles">${MILESTONES.map(m => html`<li class="${v.total >= m.at ? 'is-on' : ''}"><span class="g-mile-at num">${m.at}</span><span><b>${m.name}</b><small>${m.detail}</small></span>${v.total >= m.at ? icon('check') : icon('lock')}</li>`)}</ol>
</section>`;
  }

  // ----- Public section renderers --------------------------------------------
  function section(state) {
    const u = ui();
    let v = model(state.doc.progress, u.page ?? 0);
    if (u.page === null) v = model(state.doc.progress, v.unlocked - 1);
    const today = gardenWorld.summary(v.progress, state.today);
    const defaultFlower = normalizeFlower(state.doc.progress.garden?.defaultFlower);
    return html`<div class="${cx('garden-layout', u.detail && 'has-detail')}">
  <section class="garden-card">
    ${tally(v, state)}
    <div class="garden-top">${progressBar(v)}<span class="g-today">${icon('leaf')}今天 +${today.total}</span></div>
    <div class="garden-canvas">${scene(v, {editable: true})}</div>
    ${pager(v)}
    ${selectionBar(v)}
    ${tray(v)}
  </section>
  <div class="garden-aside">
    ${details(v, state)}
    ${rules(v)}
    <details class="panel panel-pad g-appearance">
      <summary>${icon('leaf')}新素材的花色<span class="muted">${FLOWER_CHOICES.find(([id]) => id === defaultFlower)[1]}</span></summary>
      <div class="g-options" role="group" aria-label="新素材花色">${FLOWER_CHOICES.map(([id, name, a]) => html`<button type="button" class="g-option" data-act="garden.flowerDefault" data-flower="${id}" aria-pressed="${defaultFlower === id ? 'true' : 'false'}"><img src="${root() + a + '.png'}" alt=""><span>${name}</span></button>`)}</div>
      <p class="hint">只影响之后完成得到的花；已有的花可以单独更换。</p>
    </details>
    <p class="hint g-credit">花园素材：Kenney Hexagon Tiles（CC0）。每份素材都对应一次演示完成，撤销完成会一起收回。</p>
  </div>
</div>`;
  }
  // Small read-only preview for the growth overview.
  function preview(state) {
    const v0 = model(state.doc.progress, 0), v = model(state.doc.progress, v0.unlocked - 1);
    const waiting = v.inventory.length;
    return html`<section class="panel garden-preview">
  <div class="section-title"><h2>花园</h2><span class="count">${v.total}</span><span class="spacer"></span><button type="button" class="link-btn" data-act="growth.tab" data-tab="garden">布置花园</button></div>
  ${tally(v, state, true)}
  <a class="garden-preview-scene" href="?view=growth&amp;tab=garden" data-act="growth.tab" data-tab="garden" aria-label="${'打开花园，' + v.scene.name + '，' + (waiting ? waiting + ' 份素材待摆放' : '素材已摆好')}">${scene(v)}</a>
  ${progressBar(v)}
  ${waiting ? html`<button type="button" class="garden-nudge" data-act="growth.tab" data-tab="garden">${icon('leaf')}<span>${waiting} 份素材等你摆放</span>${icon('forward')}</button>` : ''}
</section>`;
  }
  app.view('garden', {section, preview, asset});

  // ----- Actions --------------------------------------------------------------
  const commit = (fn, options) => app.commit(draft => fn(draft.progress), options);
  app.on('garden.page', el => app.setUi('garden', {page: Number(el.dataset.page), selected: null, detail: null}));
  app.on('garden.detail', el => {
    const u = ui();
    if (u.selected && u.selected !== el.dataset.key) { app.toast('这里已经有素材了，请选一块发光的空地。'); return; }
    app.setUi('garden', {detail: u.detail === el.dataset.key ? null : el.dataset.key, selected: null});
  });
  app.on('garden.closeDetail', () => app.setUi('garden', {detail: null}));
  app.on('garden.select', el => {
    const progress = app.state.doc.progress;
    const v = gardenWorld.view(progress, 0), record = v.records.find(r => r.key === el.dataset.key);
    if (!record) return;
    if (record.gardenReward.scene >= v.unlocked) { app.toast('先把当前场景布置完成。'); return; }
    const u = ui();
    app.setUi('garden', {selected: u.selected === record.key ? null : record.key, detail: null, page: record.gardenReward.scene});
    requestAnimationFrame(() => document.querySelector('.g-hit.is-spot')?.focus({preventScroll: true}));
  });
  app.on('garden.cancel', () => app.setUi('garden', {selected: null}));
  app.on('garden.place', el => {
    const key = ui().selected;
    if (!key) { app.toast('先从背包里选一份素材。'); return; }
    const before = gardenWorld.view(app.state.doc.progress, 0).unlocked;
    commit(progress => gardenWorld.place(progress, key, Number(el.dataset.slot)), {quiet: true});
    const after = gardenWorld.view(app.state.doc.progress, 0).unlocked;
    app.setUi('garden', {selected: null});
    if (after > before) { app.toast('新场景解锁啦', {detail: '这片场景已经布置好，下一片等你。', iconName: 'leaf'}); app.getView('companion')?.celebrate?.(); }
    else app.toast('已摆放', {iconName: 'leaf'});
  });
  app.on('garden.remove', el => {
    const key = el.dataset.key;
    const cell = app.state.doc.progress.garden?.world?.placements?.[gardenWorld.materialId(key)];
    commit(progress => gardenWorld.remove(progress, key), {message: '已收回背包', iconName: 'undo', undo: cell ? () => commit(progress => gardenWorld.place(progress, key, Number(cell.split(':')[1])), {quiet: true}) : null});
    app.setUi('garden', {detail: null});
  });
  app.on('garden.flower', el => commit(progress => setFlower(progress, el.dataset.flower, el.dataset.key), {quiet: true}));
  app.on('garden.flowerDefault', el => commit(progress => setFlower(progress, el.dataset.flower), {message: '新素材的花色已更新', iconName: 'leaf'}));
  app.on('garden.tree', el => commit(progress => {
    if (!TREES.some(([id]) => id === el.dataset.tree)) return;
    const r = progress.records.find(x => x.key === el.dataset.key);
    if (r?.gardenReward?.kind === 'tree') r.gardenTree = el.dataset.tree;
  }, {quiet: true}));
  // Escape unwinds placing → details before closing anything else.
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || app.state.route.view !== 'growth' || app.overlays.any()) return;
    const u = ui();
    if (u.selected) app.setUi('garden', {selected: null});
    else if (u.detail) app.setUi('garden', {detail: null});
  });
}
