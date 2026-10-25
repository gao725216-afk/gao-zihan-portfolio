// Local stand-in for the AI understanding step in the public demo. It reads a
// few common Chinese time expressions and recognises situations that need
// preparation. The real app sends the sentence to a model and validates the
// structured result on the server; this file only makes the demo answer
// free-form sentences without any network call.
import {addDays, weekdayIndex, isDate} from '../lib/dates.js';

const NUM = {零: 0, 〇: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10};
const WEEK = {一: 0, 二: 1, 三: 2, 四: 3, 五: 4, 六: 5, 日: 6, 天: 6, 末: 5};

// "十二" → 12, "二十" → 20, "九" → 9, "12" → 12
export function cnNumber(text) {
  if (/^\d+$/.test(text)) return Number(text);
  if (!text) return NaN;
  if (text.includes('十')) {
    const [a, b] = text.split('十');
    return (a ? NUM[a] : 1) * 10 + (b ? NUM[b] : 0);
  }
  return text.split('').reduce((n, c) => n * 10 + (NUM[c] ?? NaN), 0);
}
const N = '[0-9零〇一二两三四五六七八九十]+';

// Situations worth preparing for. `lead` is how many days before the
// arrangement the reminder should land (1 = the evening before).
export const TIP_RULES = [
  {id: 'hotel', label: '入住酒店', match: /酒店|宾馆|民宿|入住|住宿/, tips: [
    {text: '带身份证，入住需要登记', lead: 1},
    {text: '保存好订单确认信息', lead: 1},
    {text: '确认入住和退房时间', lead: 1}]},
  {id: 'flight', label: '乘飞机', match: /航班|飞机|机场|登机|飞往/, tips: [
    {text: '带身份证或护照', lead: 1},
    {text: '提前一晚在线值机', lead: 1},
    {text: '按航司要求提前到机场，国内航班建议至少提前 1.5 小时', lead: 0}]},
  {id: 'train', label: '乘火车', match: /高铁|火车|动车|车站|列车/, tips: [
    {text: '带身份证，进站要核验', lead: 1},
    {text: '提前 30 分钟到站检票', lead: 0}]},
  {id: 'interview', label: '面试', match: /面试/, tips: [
    {text: '前一晚准备好简历和作品集', lead: 1},
    {text: '查好路线，提前 15 分钟到', lead: 1}]},
  {id: 'clinic', label: '看医生', match: /医院|体检|看病|挂号|门诊|牙医|复诊/, tips: [
    {text: '带医保卡和身份证', lead: 1},
    {text: '体检建议先确认是否需要空腹', lead: 1}]},
  {id: 'exam', label: '考试', match: /考试|笔试|期末考|测验/, tips: [
    {text: '带准考证和身份证', lead: 1},
    {text: '前一晚检查文具和计算器', lead: 1}]},
  {id: 'visa', label: '办证件', match: /签证|办证|护照|身份证办理|领证/, tips: [
    {text: '建议先确认需要带哪些材料', lead: 1},
    {text: '准备好证件照和复印件', lead: 1}]},
];

export function tipsFor(text) {
  const rule = TIP_RULES.find(r => r.match.test(text));
  return rule ? {id: rule.id, label: rule.label, tips: rule.tips.map((t, i) => ({...t, key: rule.id + '-' + i}))} : null;
}

function findDate(text, today) {
  let m;
  if ((m = text.match(/大后天/))) return {date: addDays(today, 3), word: m[0]};
  if ((m = text.match(/后天/))) return {date: addDays(today, 2), word: m[0]};
  if ((m = text.match(/明天|明早|明晚|明日/))) return {date: addDays(today, 1), word: m[0]};
  if ((m = text.match(/今天|今晚|今早|今日/))) return {date: today, word: m[0]};
  if ((m = text.match(/(下下|下个?)(?:周|星期|礼拜)([一二三四五六日天末])/))) {
    const weeks = m[1] === '下下' ? 2 : 1, target = WEEK[m[2]];
    const monday = addDays(today, -weekdayIndex(today));
    return {date: addDays(monday, weeks * 7 + target), word: m[0]};
  }
  if ((m = text.match(/(?:这个?|本)?(?:周|星期|礼拜)([一二三四五六日天末])/))) {
    const target = WEEK[m[1]], now = weekdayIndex(today);
    return {date: addDays(today, target >= now ? target - now : target - now + 7), word: m[0]};
  }
  if ((m = text.match(new RegExp('(' + N + ')月(' + N + ')[日号]?')))) {
    const month = cnNumber(m[1]), day = cnNumber(m[2]), year = Number(today.slice(0, 4));
    let date = year + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0');
    if (isDate(date) && date < today) date = (year + 1) + date.slice(4);
    if (isDate(date)) return {date, word: m[0]};
  }
  if ((m = text.match(new RegExp('(' + N + ')[号日]')))) {
    const day = cnNumber(m[1]);
    let date = today.slice(0, 8) + String(day).padStart(2, '0');
    if (isDate(date) && date < today) { const d = new Date(today.slice(0, 7) + '-01T12:00:00'); d.setMonth(d.getMonth() + 1); date = d.toISOString().slice(0, 8) + String(day).padStart(2, '0'); }
    if (isDate(date)) return {date, word: m[0]};
  }
  return null;
}

const PERIODS = [['凌晨', 'am', '06:00'], ['早上', 'am', '08:00'], ['早晨', 'am', '08:00'], ['上午', 'am', '09:00'], ['中午', 'noon', '12:00'], ['下午', 'pm', '15:00'], ['傍晚', 'pm', '18:00'], ['晚上', 'pm', '19:00'], ['今晚', 'pm', '19:00'], ['明晚', 'pm', '19:00'], ['夜里', 'pm', '21:00'], ['明早', 'am', '08:00'], ['今早', 'am', '08:00']];

function findTime(text) {
  const period = PERIODS.find(([word]) => text.includes(word));
  let m = text.match(/(\d{1,2})[:：](\d{2})/), hour = null, minute = 0, word = '';
  if (m) { hour = Number(m[1]); minute = Number(m[2]); word = m[0]; }
  else if ((m = text.match(new RegExp('(' + N + ')点(半|一刻|三刻|(' + N + ')分?)?')))) {
    hour = cnNumber(m[1]); word = m[0];
    if (m[2] === '半') minute = 30; else if (m[2] === '一刻') minute = 15; else if (m[2] === '三刻') minute = 45; else if (m[3]) minute = cnNumber(m[3]);
  }
  if (hour !== null && !Number.isNaN(hour)) {
    if (period && (period[1] === 'pm') && hour < 12) hour += 12;
    if (period && period[1] === 'noon' && hour < 6) hour += 12;
    if (hour > 23 || minute > 59) return null;
    return {start: String(hour).padStart(2, '0') + ':' + String(minute).padStart(2, '0'), exact: true, word: word, period: period?.[0] || ''};
  }
  if (period) return {start: period[2], exact: false, word: '', period: period[0]};
  return null;
}

function findDuration(text) {
  let m;
  if ((m = text.match(/一个半小时/))) return {minutes: 90, word: m[0]};
  if ((m = text.match(/半小时|半个小时/))) return {minutes: 30, word: m[0]};
  if ((m = text.match(new RegExp('(' + N + ')个?(?:小时|钟头)')))) return {minutes: cnNumber(m[1]) * 60, word: m[0]};
  if ((m = text.match(new RegExp('(' + N + ')分钟')))) return {minutes: cnNumber(m[1]), word: m[0]};
  return null;
}

// Turn one sentence into a draft arrangement. Never throws; missing parts stay null.
export function understand(input, today) {
  const text = String(input || '').trim();
  const date = findDate(text, today), time = findTime(text), length = findDuration(text);
  let title = text;
  for (const part of [date?.word, time?.word, length?.word, time?.period]) if (part) title = title.replace(part, ' ');
  title = title.replace(/^(请|帮我|帮忙|麻烦|我要|我想|记得|提醒我|安排|一下)+/g, '').replace(/(一下|一下子|吧|哦|呀|。|，|,|！|!)+$/g, '')
    .replace(/(帮我|提醒我|记得|安排)/g, '').replace(/\s+/g, ' ').replace(/^[\s的去在要]+/, '').trim();
  if (!title) title = '新的安排';
  if (title.length > 40) title = title.slice(0, 40);
  const tips = tipsFor(text);
  const minutes = Math.max(15, Math.min(600, length?.minutes || (tips?.id === 'hotel' ? 30 : 60)));
  return {text, title, date: date?.date || null, start: time?.start || null, exact: !!time?.exact, period: time?.period || '', minutes, tips};
}

export function looksLikeGoal(text) {
  return /准备|完成|搞定|学会|复习|计划|写完|做完|整理|项目|论文|报告|作品集/.test(text);
}

// Category of a finished item, standing in for the model's classification.
// It decides the flower colour a completion grows into.
export const CATEGORIES = [
  {id: 'study', label: '学习', flower: 'flowerBlue', match: /学|读|书|复习|笔记|课|练习|论文|考|单词|阅读/},
  {id: 'move', label: '运动', flower: 'flowerGreen', match: /跑|走|散步|健身|运动|瑜伽|游泳|球|骑|拉伸|锻炼/},
  {id: 'work', label: '工作', flower: 'flowerWhite', match: /会|方案|项目|报告|产品|设计|文档|邮件|面试|简历|作品集|需求|开发/},
  {id: 'people', label: '社交', flower: 'flowerRed', match: /朋友|聚|饭|约|家人|电话|生日|聊天|见面/},
  {id: 'life', label: '生活', flower: 'flowerYellow', match: /./},
];
export const categoryOf = title => CATEGORIES.find(c => c.match.test(String(title || ''))) || CATEGORIES.at(-1);
