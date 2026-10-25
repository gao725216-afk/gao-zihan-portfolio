// Original TT assistant presentation, with an explicit local-only demo adapter.
// Preset replies never call a model. Proposals write only after a separate confirmation click.
import {html, raw, attr, cx} from '../lib/html.js';
import {icon} from '../lib/icons.js';
import {frame} from '../shell/overlays.js';
import {occur} from '../core.js';
import {addDays, parseDate, relativeDay, shortDate, weekOf, clock, minutes as toMinutes, monthDay, weekdayName} from '../lib/dates.js';
import {understand, looksLikeGoal} from '../domain/understand.js';
import {createTask, createEvent} from '../domain/items.js';
import {companionStage} from './companion.js';

const MAX_TEXT = 2000;
const SHOWN_MESSAGES = 6;
const GREETING = '你好，我是 TT 的 AI 助手。直接说一句话就行，比如「周五晚上入住杭州的酒店」：我会整理好时间，再提醒你要准备什么。演示版由本地规则理解，不连接真实模型；任何建议都要你确认后才会保存。';
const signature = event => event ? JSON.stringify(event) : null;

export function registerAssistant(app) {
  const S = {messages: [], proposal: null, applying: false, applyError: '', saveNotice: false, expanded: false, targetId: '', lastSaved: '', clarify: null};
  let rev = 0;
  const bump = () => app.setUi('assistant', {rev: ++rev, busy: S.applying});
  const events = () => app.state.doc.schedule.events;
  const findEvent = id => events().find(event => event.id === id);
  const queryDay = () => app.state.route.params.date || app.today;
  const isDocked = () => app.state.layout.wide;
  const getDraft = () => app.ui('assistant').draft || '';
  function setDraft(_app, value) {
    app.setUi('assistant', {draft: value});
    if (!value) for (const input of document.querySelectorAll('.assistant-input')) input.value = '';
  }
  function focusInput() { requestAnimationFrame(() => document.querySelector('.assistant-input')?.focus({preventScroll: true})); }
  function scrollToEnd() { requestAnimationFrame(() => { for (const el of document.querySelectorAll('.assistant-thread')) el.scrollTop = el.scrollHeight; }); }

  // The original wide side column / tablet drawer / mobile sheet behavior.
  function open() {
    if (isDocked()) { app.setUi('assistant', {open: true}); focusInput(); return; }
    app.overlays.show('assistant', {className: 'assistant-sheet', size: app.state.layout.compact ? 'full' : 'side', label: 'AI 助手 · 演示回复', focus: '.assistant-input', render: state => sheet(state), onClose: () => app.setUi('assistant', {open: false})});
    app.setUi('assistant', {open: true});
  }
  function close() { if (app.overlays.isOpen('assistant')) app.overlays.close('assistant'); app.setUi('assistant', {open: false}); }
  function toggle(_app, want) { const shown = isDocked() ? app.ui('assistant').open : app.overlays.isOpen('assistant'); if (want ?? !shown) open(); else close(); }

  function reply(text) { S.messages.push({role: 'assistant', text}); }
  function breakdownProposal(target, text) {
    const title = (target?.title || text.replace(/^(请|帮我|把|拆解|拆分|任务|目标|：|:|\s)+/, '') || '整理一个小项目').slice(0, 120);
    const taskParent = target?.type === 'task' ? target : null;
    const prefixes = ['收集材料与明确目标', '整理初稿或完成第一轮', '检查完善并记录下一步'];
    const children = prefixes.map((prefix, i) => ({type: 'task', title: title + '：' + prefix, note: 'AI 助手本地演示：固定三步模板，非真实模型分析。', estimatedMinutes: [15, 30, 15][i], inbox: !taskParent?.listId, listId: taskParent?.listId || '', tagIds: taskParent?.tagIds || [], priority: taskParent?.priority || 0, ...(taskParent ? {parentId: taskParent.id} : {})}));
    S.proposal = {kind: 'tasks', title, events: children, targetId: taskParent?.id || '', sourceSignature: signature(taskParent)};
    reply('演示中先用“收集 → 执行 → 检查”的固定模板拆成 3 步，预计共 60 分钟。这不是模型分析，估时仅作示例。\n原事项保持不变，下方建议还没有写入任务。');
  }
  function tipItems(tips, date) {
    if (!tips) return null;
    return {label: tips.label, items: tips.tips.map(tip => {
      const due = tip.lead ? addDays(date, -tip.lead) : date;
      return {...tip, due: due < app.today ? app.today : due, on: true};
    })};
  }
  function scheduleProposal({date, title, start, end, tips = null, note = '', silent = false}) {
    const conflicts = events().filter(event => (event.type === 'task' ? occur.taskTiming(event)?.date === date : occur.occursOn(event, parseDate(date))) && (event.plannedStart || event.start) < end && (event.plannedEnd || event.end) > start);
    const prep = tipItems(tips, date);
    S.proposal = {kind: 'schedule', events: [{type: 'once', title, date, start, end, remindLead: 0, note: note || 'AI 助手演示整理的日程，不发送真实提醒。'}], tips: prep, warnings: conflicts.length ? ['这个时段与现有演示安排重叠：' + conflicts.map(event => event.title).join('、') + '。请核对后决定是否添加。'] : []};
    if (!silent) reply('已按这条固定示例整理好时间：' + date + ' ' + start + '–' + end + '。\n这只是本地演示建议，还没有添加，也不会发送提醒。');
  }
  function taskProposal({date, title, tips = null, inbox = false}) {
    const prep = date ? tipItems(tips, date) : null;
    S.proposal = {kind: 'tasks', title: '', single: true, events: [{type: 'task', title, note: 'AI 助手演示整理的待办。', inbox: inbox || !date, priority: 0, ...(date ? {deadline: date} : {})}], tips: prep};
  }
  const dayWord = date => (relativeDay(date, app.today) || monthDay(date)) + '（' + weekdayName(date) + '）';
  // Free-form sentences: local stand-in for the model's structured output.
  function smartReply(text) {
    const u = understand(text, app.today);
    if (!u.date) {
      S.clarify = {text, title: u.title, goal: looksLikeGoal(text)};
      reply('好的，「' + u.title + '」想安排在哪天？' + (S.clarify.goal ? '\n这听起来是个需要好几步的目标，也可以让我先拆成小任务。' : '\n还没想好也没关系，可以先放进待规划池，之后再排。'));
      return;
    }
    if (!u.start) {
      taskProposal({date: u.date, title: u.title, tips: u.tips});
      reply('记下了：「' + u.title + '」，' + dayWord(u.date) + '要完成。\n你没说具体几点，我先把它作为当天截止的待办；告诉我时间，就能放进日历。' + (u.tips ? '\n另外，' + u.tips.label + '通常要提前准备，我在下面列了几条提醒。' : ''));
      return;
    }
    const start = u.start, end = clock(Math.min(toMinutes(start) + u.minutes, 1439));
    scheduleProposal({date: u.date, title: u.title, start, end, tips: u.tips, silent: true});
    reply('整理好了：' + dayWord(u.date) + ' ' + start + '–' + end + '，「' + u.title + '」。' + (u.exact ? '' : '\n你说的是「' + u.period + '」，我先按 ' + start + ' 记，可以再改。') + (u.tips ? '\n' + u.tips.label + '要提前准备，下面这些提醒我会在前一天放进待办，不需要的可以取消勾选。' : '') + '\n确认之前不会保存。');
  }
  function send(text, options = {}) {
    text = String(text || '').trim();
    if (S.applying || !text) return;
    if (S.proposal) { app.toast('请先确认或取消当前建议，再发送下一条。'); return; }
    if (text.length > MAX_TEXT) { app.toast('消息不能超过 2000 字。', {tone: 'error'}); return; }
    S.applyError = ''; S.saveNotice = false;
    if (!options.keepClarify) S.clarify = null;
    S.messages.push({role: 'user', text});
    if (!options.quick) setDraft(app, '');
    const target = findEvent(options.targetId || S.targetId);
    if (options.intent === 'decompose' || options.intent === 'breakdown' || ['帮我拆解一个任务', '拆解任务', '拆分任务'].includes(text)) {
      if (options.targetId && !target) reply('关联事项已经删除，请重新选择。没有修改任何数据。');
      else breakdownProposal(target, text === '帮我拆解一个任务' || text === '拆解任务' || text === '拆分任务' ? '整理一个小项目' : text);
    } else if (['今天还有什么安排？', '今天还有什么安排', '今天的日程', '查看今天日程'].includes(text)) {
      const date = app.today;
      const rows = events().filter(event => event.type !== 'task' && occur.occursOn(event, parseDate(date))).sort((a, b) => a.start.localeCompare(b.start));
      reply('根据当前浏览器中的演示数据，今天' + (rows.length ? '有 ' + rows.length + ' 项日程：\n' + rows.map(event => event.start + '–' + event.end + '  ' + event.title).join('\n') : '没有固定时间的日程。') + '\n这是本地规则查询，不是模型生成。');
    } else if (['这周有哪些截止事项？', '这周有哪些截止事项', '本周截止事项'].includes(text)) {
      const days = weekOf(app.today), done = new Set(app.state.doc.progress.records.map(record => record.eventId));
      const tasks = events().filter(event => event.type === 'task' && days.includes(event.deadline) && !done.has(event.id)).sort((a, b) => a.deadline.localeCompare(b.deadline));
      reply('本周尚未完成的演示截止事项：\n' + (tasks.length ? tasks.map(event => event.deadline + '  ' + event.title).join('\n') : '没有待处理的截止事项。') + '\n仅查询当前浏览器数据，没有修改任务。');
    } else if (text === '明天下午 3 点开会一小时' || text === '明天下午3点开会一小时') {
      scheduleProposal({date: addDays(app.today, 1), title: '演示会议', start: '15:00', end: '16:00'});
    } else if (text === '明天上午 9 点阅读半小时' || text === '明天上午9点阅读半小时') {
      scheduleProposal({date: addDays(app.today, 1), title: '阅读与笔记', start: '09:00', end: '09:30'});
    } else if (options.clarifyFor) {
      const base = options.clarifyFor;
      if (text === '先放进待规划池') { taskProposal({date: null, title: base.title, inbox: true}); reply('好的，「' + base.title + '」先放进待规划池，不设日期。想好时间后，在日历里把它拖进某一天就行。'); }
      else if (text === '拆成小任务') breakdownProposal(null, base.title);
      else smartReply(text + base.text);
    } else {
      smartReply(text);
    }
    bump(); scrollToEnd();
  }
  function applyProposal() {
    const chosen = S.proposal;
    if (!chosen || S.applying) return;
    S.applying = true; S.applyError = ''; bump();
    try {
      if (chosen.targetId && signature(findEvent(chosen.targetId)) !== chosen.sourceSignature) throw new Error('原任务已变化，请取消这份建议并重新拆解。');
      const picked = (chosen.tips?.items || []).filter(tip => tip.on);
      const main = chosen.events[0];
      app.commit(doc => {
        for (const event of chosen.events) {
          const input = {...event};
          if (chosen.tips?.items?.length) input.note = (input.note ? input.note + '\n' : '') + '准备提醒：' + chosen.tips.items.map(tip => tip.text).join('；');
          if (chosen.kind === 'tasks') createTask(doc.schedule, input);
          else createEvent(doc.schedule, input);
        }
        for (const tip of picked) createTask(doc.schedule, {type: 'task', title: tip.text, note: '为「' + main.title + '」做准备，由 AI 助手提醒。', deadline: tip.due, plannedDate: tip.due, inbox: false, priority: 1});
      }, {message: chosen.kind === 'tasks' && !chosen.single ? '已添加到本地任务' : chosen.kind === 'tasks' ? '待办已添加' : '日程已添加', detail: picked.length ? '另有 ' + picked.length + ' 条准备提醒进了待办' : '仅保存到当前浏览器', iconName: 'check'});
      // Clear synchronously to make a repeated confirmation click a no-op.
      S.proposal = null; S.saveNotice = true; S.lastSaved = chosen.kind === 'tasks' && chosen.single && main.deadline ? 'schedule' : chosen.kind; S.lastDate = main.date || main.deadline || '';
      reply((chosen.kind === 'tasks' && !chosen.single ? '已按你的确认添加 ' + chosen.events.length + ' 个本地任务。可以到任务页编辑，或去日历安排执行时间。' : chosen.kind === 'tasks' ? '已添加「' + main.title + '」。' + (main.inbox ? '它在待规划池里等你排期。' : '') : '已按你的确认添加「' + main.title + '」。') + (picked.length ? '\n' + picked.length + ' 条准备提醒已经放进对应日期的待办，到时候会出现在「今天」。' : '') + '\n演示版不会发送真实通知。');
      app.signal(chosen.kind === 'tasks' && !chosen.single ? 'ai.split' : 'ai.schedule', {count: chosen.events.length});
      if (picked.length) app.signal('ai.tips', {count: picked.length});
    } catch (error) { S.applyError = error.message || '没有保存，请检查后重试。'; }
    finally { S.applying = false; bump(); scrollToEnd(); }
  }
  function dismiss() { if (S.applying || !S.proposal) return; S.proposal = null; S.applyError = ''; reply('已取消建议，没有修改任何数据。'); bump(); }
  function reset() { if (S.applying) return; Object.assign(S, {messages: [], proposal: null, applyError: '', saveNotice: false, expanded: false, targetId: '', lastSaved: ''}); setDraft(app, ''); bump(); focusInput(); }
  function decompose(id = '', text = '') { const target = id ? findEvent(id) : null; if (id && !target) return; open(); send(text || '请把「' + target.title + '」拆成可排期的小任务。', {targetId: id, intent: 'decompose', quick: true}); }
  function breakdown(_app, id) { decompose(id); }

  function header(state, {docked}) {
    return html`<header class="asst-head">
  <span class="asst-pet">${companionStage(state, app, 'md', docked ? 'dock' : 'sheet')}</span>
  <div class="asst-title"><h2>AI 助手</h2><p>说一句话就好 · 演示版不连接模型</p></div>
  <div class="asst-tools"><button type="button" class="icon-btn sm" data-act="assistant.reset"${attr('disabled', !S.messages.length || S.applying)} aria-label="开始新的对话" title="新对话">${icon('restore')}</button>${docked ? html`<button type="button" class="icon-btn sm" data-act="assistant.close" aria-label="收起 AI 助手">${icon('close')}</button>` : ''}</div>
</header>`;
  }
  function messageRow(message) {
    return html`<li class="${cx('msg', 'msg-' + message.role)}">${message.role === 'assistant' ? html`<small class="asst-demo-label">演示回复</small>` : ''}<div class="msg-bubble">${String(message.text).split('\n').map((line, i) => html`${i ? raw('<br>') : ''}${line}`)}</div></li>`;
  }
  function suggestions({welcome = false} = {}) {
    const firstTask = events().find(event => event.type === 'task' && !event.parentId && !app.state.doc.progress.records.some(record => record.eventId === event.id));
    if (S.clarify && !S.proposal) {
      const c = S.clarify, choices = ['明天', '这周末', '下周一', '先放进待规划池', ...(c.goal ? ['拆成小任务'] : [])];
      return html`<div class="asst-welcome asst-clarify"><div class="asst-suggest">${choices.map(choice => html`<button type="button" class="chip-btn" data-act="assistant.clarify" data-choice="${choice}">${choice === '拆成小任务' ? icon('steps') : choice === '先放进待规划池' ? icon('inbox') : icon('calendar')}${choice}</button>`)}</div></div>`;
    }
    const prompts = ['周五晚上入住杭州的酒店', '下周一上午 10 点面试', '今天还有什么安排？'];
    return html`<div class="asst-welcome">${welcome ? html`<p class="asst-hello">${GREETING}</p>` : ''}<div class="asst-suggest">${prompts.map(text => html`<button type="button" class="chip-btn" data-act="assistant.suggest" data-text="${text}">${text}</button>`)}<button type="button" class="chip-btn" data-act="assistant.suggest" data-text="帮我拆解一个任务">${icon('steps')}试试任务拆解</button>${firstTask ? html`<button type="button" class="chip-btn" data-act="assistant.breakdownItem" data-id="${firstTask.id}">${icon('sparkle')}拆分「${firstTask.title}」</button>` : ''}</div></div>`;
  }
  function proposalCard() {
    const p = S.proposal;
    if (!p) return '';
    const tasks = p.kind === 'tasks', split = tasks && !p.single;
    const tipsBlock = p.tips?.items?.length ? html`<div class="asst-tips" aria-label="准备提醒"><p class="asst-tips-head">${icon('bell')}<b>${p.tips.label}，别忘了</b><small>勾选的会变成待办</small></p><ul>${p.tips.items.map(tip => html`<li><button type="button" class="asst-tip" data-act="assistant.tip" data-key="${tip.key}" aria-pressed="${tip.on ? 'true' : 'false'}"><span class="asst-tip-box">${icon('check')}</span><span class="asst-tip-text">${tip.text}</span><small>${tip.due === p.events[0].date || tip.due === p.events[0].deadline ? '当天' : shortDate(tip.due) + ' 提醒'}</small></button></li>`)}</ul></div>` : '';
    const describe = event => split ? '预计 ' + event.estimatedMinutes + ' 分钟 · 尚未排期' : tasks ? (event.deadline ? shortDate(event.deadline) + ' 截止 · 待办' : '待规划池 · 还没定日期') : event.date + ' ' + event.start + '–' + event.end;
    return html`<section class="${cx('asst-card', 'asst-proposal', split ? 'kind-decompose' : 'kind-create')}" aria-label="待确认的建议"><p class="asst-kind">${icon(split ? 'steps' : tasks ? 'tasks' : 'clock')}${split ? '拆成可独立排期的任务' : tasks ? '添加待办' : '添加日程'}</p><p class="asst-hint">尚未保存，确认后才添加</p>${p.title ? html`<h3>${p.title}</h3>` : ''}${split ? html`<p class="asst-hint">3 个任务 · 示例估时共 60 分钟，可在任务详情修改</p>` : ''}<ul class="asst-new-list">${p.events.map(event => html`<li class="${cx('asst-new', tasks ? 'is-task' : 'is-event')}"><b>${event.title}</b><small>${icon(tasks ? 'flag' : 'clock')}${describe(event)}</small></li>`)}</ul>${tipsBlock}${p.warnings?.length ? html`<ul class="asst-warn">${p.warnings.map(warning => html`<li>${icon('alert')}${warning}</li>`)}</ul>` : ''}${S.applyError ? html`<p class="form-error" role="alert">${S.applyError}</p>` : ''}<div class="asst-actions"><button type="button" class="btn btn-primary" data-act="assistant.apply"${attr('disabled', S.applying)}>${icon('check')}${split ? '添加到本地任务' : tasks ? '确认添加待办' : '确认添加日程'}</button><button type="button" class="btn btn-quiet" data-act="assistant.dismiss"${attr('disabled', S.applying)}>取消</button></div></section>`;
  }
  function thread(state) {
    const hidden = S.expanded ? 0 : Math.max(0, S.messages.length - SHOWN_MESSAGES);
    return html`<div class="assistant-thread" aria-live="polite">${!S.messages.length ? suggestions({welcome: true}) : ''}${hidden ? html`<button type="button" class="link-btn asst-more" data-act="assistant.expand">${icon('history')}查看更早的 ${hidden} 条</button>` : ''}${S.messages.length ? html`<ol class="asst-msgs">${S.messages.slice(hidden).map(messageRow)}</ol>` : ''}${proposalCard()}${S.saveNotice ? html`<p class="asst-saved" role="status"><i class="dot" data-tone="${state.sync.status === 'error' ? 'error' : 'ok'}"></i>${state.sync.message}</p><button type="button" class="btn btn-quiet" data-act="assistant.plan">${icon('calendar')}${S.lastSaved === 'tasks' ? '去日历排期' : '查看日历'}</button>` : ''}${S.messages.length && !S.proposal ? suggestions() : ''}</div>`;
  }
  function targetOptions() {
    return html`<option value=""${attr('selected', !S.targetId)}>新建任务 / 选择关联事项</option>${events().filter(event => event.type === 'task').map(event => html`<option value="${event.id}"${attr('selected', S.targetId === event.id)}>${event.title}</option>`)}`;
  }
  function composer() {
    if (S.proposal) return html`<div class="asst-compose is-locked"><p class="asst-hint">请先确认或取消上面的建议。发送消息本身不会保存数据。</p></div>`;
    return html`<form class="asst-compose" data-submit="assistant.send"><div class="asst-box"><textarea class="assistant-input" name="text" rows="2" maxlength="${MAX_TEXT}" data-uncontrolled data-input="assistant.draft" aria-label="发给 AI 助手演示的消息" placeholder="说一句话，比如：周五晚上入住杭州的酒店">${getDraft()}</textarea><div class="asst-box-tools"><label class="asst-target"><span class="sr-only">关联任务</span>${icon('link')}<select data-change="assistant.target" aria-label="关联任务">${targetOptions()}</select></label><button type="button" class="btn btn-quiet btn-sm" data-act="assistant.decomposeDraft">拆成任务</button><button type="submit" class="btn btn-primary asst-send" aria-label="发送演示消息">${icon('send')}</button></div></div><p class="asst-hint">演示版由本地规则理解，不是真实 AI · 不支持附件或账号连接</p></form>`;
  }
  function body(state) { return html`${thread(state)}${composer()}`; }
  function panel(state) { return html`<aside class="assistant-panel" aria-label="AI 助手 · 演示回复" data-key="assistant-dock">${header(state, {docked: true})}${body(state)}</aside>`; }
  function sheet(state) { return html`<div class="overlay-head asst-sheet-head">${header(state, {docked: false})}<button type="button" class="icon-btn" data-act="overlay.close" aria-label="收起 AI 助手">${icon('close')}</button></div><div class="assistant-panel is-sheet">${body(state)}</div>`; }

  // The information dialog remains separate from the assistant entry.
  const about = () => app.overlays.show('demo-about', {size: 'small', label: '前端演示说明', render: () => frame({title: 'TT · 前端交互演示', body: html`<div class="stack"><p>这是 TT 日程与成长应用的公开前端演示，初始日程、任务与完成记录均为虚构。</p><p>打开后它就是一个普通的、带 AI 助手的日程软件。会发光的地方是还没用过的功能：点它，会带你在真实界面上做一遍；之后你自己独立完成一次，就会点亮一枚成就。</p><p>可以试着跟 AI 说一句话，比如「周五晚上入住杭州的酒店」：它会整理好时间，并提醒你带身份证这类要提前准备的事。完成的事会长成花园，花园只积累、不惩罚。</p><div class="callout callout-warn"><div><b>演示版的 AI 由本地规则代替</b><p>能识别常见的日期、时间和场景，但不是实际模型生成。建议必须另外点击确认才会添加到当前浏览器。</p></div></div><p>没有真实 AI 服务、账号登录、云同步、微信通知或文件上传。请勿输入真实隐私信息。</p><p class="hint">修改仅保存在当前浏览器。设置中可导出或重置演示数据。</p></div>`, foot: html`<button type="button" class="btn btn-primary" data-act="overlay.close">开始体验</button>`})});
  app.view('assistant', {toggle, open, close, getDraft, setDraft, panel, breakdown, decompose, send, render: () => ({title: 'AI 助手'})});
  app.on('assistant.toggle', () => toggle(app)); app.on('assistant.close', close); app.on('assistant.reset', reset);
  app.on('assistant.expand', () => { S.expanded = true; bump(); });
  app.on('assistant.draft', el => setDraft(app, el.value));
  app.on('assistant.send', form => send(form.querySelector('textarea').value));
  app.on('assistant.suggest', el => send(el.dataset.text, {quick: true}));
  app.on('assistant.breakdownItem', el => breakdown(app, el.dataset.id));
  app.on('assistant.decomposeItem', el => { app.overlays.close('editor'); decompose(el.dataset.id); });
  app.on('assistant.decomposeDraft', () => { const target = findEvent(S.targetId); const text = getDraft() || (target ? '拆解「' + target.title + '」' : '整理一个小项目'); send(text, {intent: 'decompose', targetId: S.targetId}); });
  app.on('assistant.target', el => { S.targetId = el.value; bump(); });
  app.on('assistant.apply', applyProposal); app.on('assistant.dismiss', dismiss);
  app.on('assistant.plan', () => { close(); app.go('calendar', {date: S.lastSaved === 'schedule' && S.lastDate ? S.lastDate : queryDay(), mode: 'day'}); });
  app.on('assistant.tip', el => { const tip = S.proposal?.tips?.items.find(item => item.key === el.dataset.key); if (!tip || S.applying) return; tip.on = !tip.on; bump(); });
  app.on('assistant.clarify', el => { const base = S.clarify; if (!base) return; send(el.dataset.choice, {quick: true, clarifyFor: base}); });
  app.on('demo.about', about);
  document.addEventListener('keydown', event => { if (event.key !== 'Enter' || event.shiftKey || event.isComposing || event.keyCode === 229) return; const input = event.target.closest?.('.assistant-input'); if (!input) return; event.preventDefault(); input.form?.requestSubmit(); });
  let wasWide = app.state.layout.wide;
  app.onRender(state => { if (state.layout.wide === wasWide) return; wasWide = state.layout.wide; if (!app.ui('assistant').open) return; if (wasWide && app.overlays.isOpen('assistant')) { app.overlays.close('assistant', {restoreFocus: false}); queueMicrotask(() => app.setUi('assistant', {open: true})); } else if (!wasWide) queueMicrotask(open); });
}
