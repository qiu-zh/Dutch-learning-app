'use strict';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];

const CARD_KEY = 'dutchdeck.studio.cards.v1';
const SETTINGS_KEY = 'dutchdeck.studio.settings.v1';
const REVIEW_KEY = 'dutchdeck.studio.reviews.v1';
const READING_KEY = 'dutchdeck.studio.reading.v1';
const DECK_VERSION_KEY = 'dutchdeck.studio.deckVersion';
const DECK_VERSION = '5';
const LEARN_KEY = 'dutchdeck.studio.learn.v1';
const FAMILY_DEFINITIONS_KEY = 'dutchdeck.studio.familyDefinitions.v1';
const DAY = 86_400_000;

const legacyStarters = window.DUTCHDECK_FULL_DECK || [];
const familyPack = window.DUTCHDECK_FAMILY_PACK || [];
const builtInFamilyDefinitions = window.DUTCHDECK_FAMILY_DEFINITIONS || [];

function normalizeFamilyDefinition(id, raw = {}) {
  const familyId = normalizeKey(raw.id || raw.root || id);
  if (!familyId) return null;
  return {
    id: familyId,
    root: String(raw.root || familyId).trim(),
    title: String(raw.title || familyId).trim().toUpperCase(),
    meaning: String(raw.meaning || raw.subtitle || raw.coreMeaning || 'Related Dutch words').trim(),
    pattern: String(raw.pattern || raw.description || 'A family collected from your dictionary entries.').trim(),
    hint: String(raw.hint || raw.memoryHook || 'Compare forms, prefixes and fixed prepositions.').trim(),
    accent: String(raw.accent || familyId.charAt(0)).trim().toUpperCase()
  };
}

function normalizeFamilyDefinitions(source) {
  if (!source) return [];
  const rows = Array.isArray(source)
    ? source.map(item => [item?.id || item?.root, item])
    : Object.entries(source);
  return rows.map(([id, raw]) => normalizeFamilyDefinition(id, raw)).filter(Boolean);
}

function loadImportedFamilyDefinitions() {
  try { return normalizeFamilyDefinitions(JSON.parse(localStorage.getItem(FAMILY_DEFINITIONS_KEY) || '{}')); }
  catch { return []; }
}

let importedFamilyDefinitions = loadImportedFamilyDefinitions();
let familyDefinitions = [];
let familyById = new Map();

function refreshFamilyDefinitions() {
  const merged = new Map(normalizeFamilyDefinitions(builtInFamilyDefinitions).map(item => [item.id, item]));
  normalizeFamilyDefinitions(importedFamilyDefinitions).forEach(item => merged.set(item.id, item));
  familyDefinitions = [...merged.values()];
  familyById = merged;
}

function saveImportedFamilyDefinitions() {
  const object = Object.fromEntries(importedFamilyDefinitions.map(item => [item.id, item]));
  localStorage.setItem(FAMILY_DEFINITIONS_KEY, JSON.stringify(object));
  refreshFamilyDefinitions();
}

function mergeImportedFamilyDefinitions(source) {
  const incoming = normalizeFamilyDefinitions(source);
  if (!incoming.length) return 0;
  const merged = new Map(importedFamilyDefinitions.map(item => [item.id, item]));
  incoming.forEach(item => merged.set(item.id, item));
  importedFamilyDefinitions = [...merged.values()];
  saveImportedFamilyDefinitions();
  return incoming.length;
}

refreshFamilyDefinitions();

const newId = () => crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const now = () => Date.now();

function normalizeKey(value = '') {
  return String(value)
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase('nl-NL')
    .replace(/[’]/g, "'")
    .replace(/\s+/g, ' ');
}

function normalizedHeadword(value = '') {
  return normalizeKey(value)
    .replace(/^(de|het|een)\s+/, '')
    .replace(/^zich\s+/, '')
    .replace(/\s+\([^)]*\)$/, '');
}

function listValue(value) {
  if (Array.isArray(value)) return value.map(String).map(v => v.trim()).filter(Boolean);
  return String(value || '').split(/[;,\n]/).map(v => v.trim()).filter(Boolean);
}

function unionLists(...lists) {
  const seen = new Set();
  const result = [];
  lists.flatMap(listValue).forEach(item => {
    const key = normalizeKey(item);
    if (key && !seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  });
  return result;
}

function inferType(front = '', back = '') {
  const word = normalizeKey(front);
  const meaning = normalizeKey(back);
  if (/^(de|het)\s/.test(word)) return 'noun';
  if (word.includes('…') || word.includes('...') || /^iets\s/.test(word) || /\s(met|aan|op|voor|over)$/.test(word)) return 'expression';
  if (meaning.startsWith('to ') || word.startsWith('zich ') || /en$/.test(word)) return 'verb';
  if (['daarom', 'daarmee', 'bovendien', 'hoewel', 'tenzij', 'trouwens', 'ondertussen', 'inmiddels', 'ongeacht', 'echter', 'desondanks'].includes(word)) return 'connector';
  if (/ly$/.test(meaning) || ['meestal', 'ineens', 'alvast', 'simpelweg', 'terecht', 'zover', 'onderaan'].includes(word)) return 'adverb';
  return 'other';
}

function inferCefr(front = '') {
  const word = normalizeKey(front);
  const a1 = ['bestellen', 'komen', 'gaan', 'maken', 'staan', 'lopen', 'zetten', 'nemen', 'vallen', 'houden'];
  const a2 = ['daarom', 'meestal', 'vriendelijk', 'het feit', 'sparen', 'verliezen', 'ruiken', 'trouwen', 'schoonmaken', 'spannend'];
  const b2 = ['inhoudelijk', 'ongeacht', 'geloofwaardig', 'maatschappij', 'uitbuiten', 'beoordelen', 'beginsel', 'afzienbare tijd', 'teweegbrengen'];
  if (a1.includes(word)) return 'A1';
  if (a2.includes(word)) return 'A2';
  if (b2.some(item => word.includes(item))) return 'B2';
  return 'B1';
}

function inferFamily(front = '', type = '') {
  if (type && type !== 'verb' && type !== 'expression') return '';
  const word = normalizedHeadword(front);
  for (const definition of familyDefinitions) {
    const root = normalizeKey(definition.root);
    if (word === root || word.endsWith(root) || word.includes(` ${root} `) || word.startsWith(`${root} `)) return definition.id;
  }
  return '';
}

function makeCard(raw = {}) {
  let source = raw;
  if (Array.isArray(source)) {
    const [front, back, example, cefr, type, frequency = 3, register = 'everyday', forms = '', tags = []] = source;
    source = { front, back, example, cefr, type, frequency, register, forms, tags };
  }

  const front = source.front || source.dutch || source.word || '';
  const back = source.back || source.english || source.meaning || source.translation || '';
  const type = source.type || source.wordType || inferType(front, back);
  const family = source.family || inferFamily(front, type);
  const separable = source.separable === true || source.separable === 'true'
    ? true
    : source.separable === false || source.separable === 'false'
      ? false
      : null;

  return {
    id: source.id || newId(),
    front: String(front).trim(),
    back: String(back).trim(),
    example: String(source.example || source.sentence || '').trim(),
    cefr: source.cefr || source.level || inferCefr(front),
    type,
    frequency: Math.min(5, Math.max(1, Number(source.frequency) || 3)),
    register: source.register || 'everyday',
    forms: String(source.forms || source.grammar || '').trim(),
    tags: listValue(source.tags),
    note: String(source.note || source.usage || '').trim(),
    family,
    prefix: String(source.prefix || '').trim(),
    prefixMeaning: String(source.prefixMeaning || source.prefix_meaning || '').trim(),
    separable,
    collocations: listValue(source.collocations),
    related: listValue(source.related),
    favorite: Boolean(source.favorite),
    due: Number(source.due) || 0,
    interval: Number(source.interval) || 0,
    ease: Number(source.ease) || 2.5,
    reps: Number(source.reps) || 0,
    lapses: Number(source.lapses) || 0,
    created: Number(source.created) || now(),
    lastReviewed: Number(source.lastReviewed) || 0
  };
}

function mergeBuiltInSource() {
  const built = new Map();
  for (const raw of legacyStarters) {
    const card = makeCard(raw);
    built.set(normalizeKey(card.front), card);
  }
  for (const raw of familyPack) {
    const card = makeCard(raw);
    const key = normalizeKey(card.front);
    const previous = built.get(key);
    built.set(key, previous ? mergeContent(previous, card, 'replace') : card);
  }
  return [...built.values()];
}

function contentFields() {
  return ['front', 'back', 'example', 'cefr', 'type', 'frequency', 'register', 'forms', 'note', 'family', 'prefix', 'prefixMeaning', 'separable'];
}

function mergeContent(existing, incoming, mode = 'update') {
  const base = makeCard(existing);
  const next = makeCard(incoming);
  const progress = {
    id: base.id,
    favorite: base.favorite,
    due: base.due,
    interval: base.interval,
    ease: base.ease,
    reps: base.reps,
    lapses: base.lapses,
    created: base.created,
    lastReviewed: base.lastReviewed
  };

  if (mode === 'replace') {
    const replaced = { ...base };
    for (const field of contentFields()) replaced[field] = next[field];
    replaced.tags = unionLists(base.tags, next.tags);
    replaced.collocations = unionLists(next.collocations);
    replaced.related = unionLists(next.related);
    return { ...replaced, ...progress };
  }

  const updated = { ...base };
  for (const field of contentFields()) {
    const currentValue = updated[field];
    const isEmpty = currentValue === '' || currentValue === null || currentValue === undefined || (field === 'frequency' && !currentValue);
    if (isEmpty && next[field] !== '' && next[field] !== null && next[field] !== undefined) updated[field] = next[field];
  }
  updated.tags = unionLists(base.tags, next.tags);
  updated.collocations = unionLists(base.collocations, next.collocations);
  updated.related = unionLists(base.related, next.related);
  return { ...updated, ...progress };
}

function loadCards() {
  let existing = [];
  try {
    const parsed = JSON.parse(localStorage.getItem(CARD_KEY) || '[]');
    if (Array.isArray(parsed)) existing = parsed.map(makeCard);
  } catch (error) {
    console.warn('Could not read saved cards', error);
  }

  const builtIns = mergeBuiltInSource();
  const builtMap = new Map(builtIns.map(card => [normalizeKey(card.front), card]));
  const result = [];
  const used = new Set();

  for (const saved of existing) {
    const key = normalizeKey(saved.front);
    const built = builtMap.get(key);
    result.push(built ? mergeContent(saved, built, 'update') : saved);
    used.add(key);
  }
  for (const built of builtIns) {
    const key = normalizeKey(built.front);
    if (!used.has(key)) result.push(built);
  }

  localStorage.setItem(CARD_KEY, JSON.stringify(result));
  localStorage.setItem(DECK_VERSION_KEY, DECK_VERSION);
  return result;
}

function loadSettings() {
  const defaults = { rate: 0.88, voiceURI: '', autoWord: false, autoExample: false, newLimit: 15, shuffleReview: true };
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') };
  } catch {
    return defaults;
  }
}

let cards = loadCards();
let settings = loadSettings();
let current = null;
let reviewQueue = [];
let sessionTotal = 0;
let sessionDone = 0;
let voices = [];
let deferredInstall = null;
let previewEntries = [];
let previewFamilyDefinitions = [];
let selectedEntry = null;
let selectedFamily = '';
let readerWordIndex = new Map();
let quizCurrent = null;
let quizAnswered = false;
let learnState = (() => { try { return { correct: 0, attempted: 0, family: '', ...JSON.parse(localStorage.getItem(LEARN_KEY) || '{}') }; } catch { return { correct: 0, attempted: 0, family: '' }; } })();

const saveCards = () => localStorage.setItem(CARD_KEY, JSON.stringify(cards));
const saveSettings = () => localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));

function todayKey(time = now()) {
  return new Date(time).toLocaleDateString('en-CA');
}

function reviews() {
  try {
    return JSON.parse(localStorage.getItem(REVIEW_KEY) || '{}');
  } catch {
    return {};
  }
}

function logReview() {
  const data = reviews();
  const key = todayKey();
  data[key] = (data[key] || 0) + 1;
  localStorage.setItem(REVIEW_KEY, JSON.stringify(data));
}

function streak() {
  const data = reviews();
  let count = 0;
  const day = new Date();
  while (data[todayKey(day)]) {
    count += 1;
    day.setDate(day.getDate() - 1);
  }
  return count;
}

function cardState(card) {
  if (!card.reps) return 'New';
  if ((card.lapses || 0) >= 3 && (card.interval || 0) < 21) return 'Weak';
  if ((card.interval || 0) >= 21) return 'Mastered';
  return 'Learning';
}

function masteryScore(card) {
  const state = cardState(card);
  if (state === 'Mastered') return 100;
  if (state === 'Weak') return Math.min(35, Math.round((card.interval || 0) / 21 * 100));
  if (state === 'Learning') return Math.min(92, Math.max(12, Math.round((card.interval || 0) / 21 * 100)));
  return 0;
}

function learnedDue() {
  const timestamp = now();
  return cards.filter(card => card.reps > 0 && (card.due || 0) <= timestamp);
}

function newCards(limit = settings.newLimit) {
  return cards
    .filter(card => !card.reps)
    .sort((a, b) => (b.frequency - a.frequency) || a.created - b.created)
    .slice(0, limit);
}

function dueCandidates() {
  return [...learnedDue(), ...newCards(settings.newLimit)];
}

function familyStats(familyId) {
  const members = cards.filter(card => card.family === familyId);
  const studied = members.filter(card => card.reps > 0).length;
  const mastered = members.filter(card => cardState(card) === 'Mastered').length;
  const mastery = members.length ? Math.round(members.reduce((sum, card) => sum + masteryScore(card), 0) / members.length) : 0;
  return { members, studied, mastered, mastery };
}

function allFamilies() {
  const ids = new Set([...familyDefinitions.map(f => f.id), ...cards.map(card => card.family).filter(Boolean)]);
  return [...ids].map(id => familyById.get(id) || {
    id,
    root: id,
    title: id.toUpperCase(),
    meaning: 'Related Dutch words',
    pattern: 'A family collected from your dictionary entries.',
    hint: 'Compare forms, prefixes and fixed prepositions.',
    accent: id.charAt(0).toUpperCase()
  });
}

function switchView(name) {
  $$('.nav-btn').forEach(button => button.classList.toggle('active', button.dataset.view === name));
  $$('.view').forEach(view => view.classList.toggle('active', view.id === `${name}View`));
  if (name === 'dashboard') renderDashboard();
  if (name === 'review') buildReviewQueue();
  if (name === 'learn') renderLearn();
  if (name === 'families') renderFamilies();
  if (name === 'dictionary') renderDictionary();
  if (name === 'reader') prepareReaderIndex();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderDashboard() {
  const counts = { New: 0, Learning: 0, Weak: 0, Mastered: 0 };
  cards.forEach(card => { counts[cardState(card)] += 1; });
  const masteredPercent = cards.length ? Math.round(counts.Mastered / cards.length * 100) : 0;
  $('#masteryPercent').textContent = `${masteredPercent}%`;

  const stats = [
    ['Due now', dueCandidates().length],
    ['Total entries', cards.length],
    ['Studied', cards.length - counts.New],
    ['Reviewed today', reviews()[todayKey()] || 0],
    ['Day streak', streak()]
  ];
  $('#statsGrid').innerHTML = stats.map(([label, value]) => `<article class="stat"><strong>${value}</strong><span>${label}</span></article>`).join('');

  $('#statusBars').innerHTML = Object.entries(counts).map(([label, value]) => `
    <div class="bar-row">
      <div class="bar-label"><span>${label}</span><strong>${value}</strong></div>
      <div class="bar"><i style="width:${cards.length ? value / cards.length * 100 : 0}%"></i></div>
    </div>`).join('');

  const familyRows = allFamilies()
    .map(definition => ({ definition, ...familyStats(definition.id) }))
    .filter(item => item.members.length)
    .sort((a, b) => b.mastery - a.mastery || b.studied - a.studied)
    .slice(0, 5);
  $('#familySummary').innerHTML = familyRows.map(item => `
    <div class="family-summary-row">
      <button data-family="${escapeAttr(item.definition.id)}">${escapeHtml(item.definition.title)}<small>${item.studied}/${item.members.length} studied</small></button>
      <strong>${item.mastery}%</strong>
    </div>`).join('') || '<p class="empty compact">No family data yet.</p>';
  $$('#familySummary [data-family]').forEach(button => button.onclick = () => openFamilyDialog(button.dataset.family));

  const recommendationPool = [...cards].sort((a, b) => {
    const stateWeight = { Weak: 4, Learning: 3, New: 2, Mastered: 1 };
    return stateWeight[cardState(b)] - stateWeight[cardState(a)] || b.frequency - a.frequency || (a.due || 0) - (b.due || 0);
  });
  const seen = new Set();
  const recommendations = [];
  for (const card of recommendationPool) {
    const group = card.family || card.type;
    if (seen.has(group) && recommendations.length < 2) continue;
    seen.add(group);
    recommendations.push(card);
    if (recommendations.length === 3) break;
  }
  $('#recommendations').innerHTML = recommendations.map(card => `
    <article class="mini-card" data-id="${escapeAttr(card.id)}">
      <div class="row"><span class="level-badge">${escapeHtml(card.cefr)}</span>${card.family ? `<span class="family-badge">${escapeHtml(card.family)}</span>` : ''}</div>
      <h3>${escapeHtml(card.front)}</h3>
      <p>${escapeHtml(card.back)}</p>
    </article>`).join('');
  $$('#recommendations [data-id]').forEach(card => card.onclick = () => openEntryDialog(card.dataset.id));

  renderActivityChart();
}

function renderActivityChart() {
  const data = reviews();
  const days = [];
  let total = 0;
  for (let offset = 13; offset >= 0; offset -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - offset);
    const value = data[todayKey(date)] || 0;
    total += value;
    days.push({ date, value });
  }
  const max = Math.max(1, ...days.map(day => day.value));
  $('#activityChart').innerHTML = days.map(day => {
    const height = day.value ? Math.max(8, day.value / max * 115) : 3;
    const label = day.date.toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 1);
    return `<div class="activity-day" title="${day.value} reviews on ${escapeAttr(day.date.toLocaleDateString())}"><div class="activity-bar" style="height:${height}px"></div><small>${label}</small></div>`;
  }).join('');
  $('#reviewTotal14').textContent = `${total} reviews`;
}

function reviewCandidates() {
  const filter = $('#reviewFilter').value;
  if (filter === 'new') return newCards(settings.newLimit);
  if (filter === 'weak') return cards.filter(card => cardState(card) === 'Weak' || card.lapses > 0);
  if (filter === 'favorites') return cards.filter(card => card.favorite);
  if (filter === 'family') return cards.filter(card => card.family === $('#reviewFamilyFilter').value);
  if (filter === 'all') return [...cards];
  return dueCandidates();
}

function sortReviewQueue(list) {
  const copied = [...list];
  copied.sort((a, b) => {
    const dueDifference = (a.due || 0) - (b.due || 0);
    if (dueDifference) return dueDifference;
    if (settings.shuffleReview) return Math.random() - 0.5;
    return b.frequency - a.frequency;
  });
  return copied;
}

function buildReviewQueue() {
  const isFamily = $('#reviewFilter').value === 'family';
  $('#reviewFamilyFilter').hidden = !isFamily;
  reviewQueue = sortReviewQueue(reviewCandidates());
  sessionTotal = reviewQueue.length;
  sessionDone = 0;
  updateSessionProgress();
  nextCard();
}

function updateSessionProgress() {
  const total = Math.max(0, sessionTotal);
  const percentage = total ? Math.round(sessionDone / total * 100) : 0;
  $('#sessionProgress').style.width = `${percentage}%`;
  $('#sessionLabel').textContent = total ? `${sessionDone} reviewed` : 'Ready';
  $('#queueCount').textContent = `${Math.max(0, reviewQueue.length + (current ? 1 : 0))} card${reviewQueue.length + (current ? 1 : 0) === 1 ? '' : 's'}`;
}

function nextCard() {
  current = reviewQueue.shift() || null;
  $('#reviewAnswer').hidden = true;
  $('#ratingButtons').hidden = true;
  $('#showAnswerBtn').hidden = !current;
  $('#reviewCard').hidden = !current;
  $('#emptyReview').hidden = Boolean(current);
  updateSessionProgress();
  if (!current) {
    if (sessionTotal && sessionDone >= sessionTotal) $('#emptyReview').textContent = `Session complete — ${sessionDone} cards reviewed.`;
    return;
  }

  $('#reviewFront').textContent = current.front;
  $('#reviewBack').textContent = current.back;
  $('#reviewExample').textContent = current.example || '';
  $('#reviewExample').hidden = !current.example;
  $('#reviewLevel').textContent = current.cefr;
  $('#reviewType').textContent = current.type;
  $('#favoriteReviewBtn').textContent = current.favorite ? '★' : '☆';
  $('#reviewFamily').hidden = !current.family;
  $('#reviewFamily').textContent = current.family || '';
  const detailItems = [
    current.register,
    `${'★'.repeat(current.frequency)}${'☆'.repeat(5 - current.frequency)}`,
    current.separable === true ? 'separable' : current.separable === false ? 'inseparable' : '',
    current.forms,
    ...current.tags.filter(tag => !['verb family', current.family].includes(tag))
  ].filter(Boolean);
  $('#reviewDetails').innerHTML = detailItems.map(item => `<span class="chip">${escapeHtml(item)}</span>`).join('');
  $('#reviewNote').hidden = !current.note;
  $('#reviewNote').textContent = current.note || '';
  updateRatingLabels(current);
  if (settings.autoWord) setTimeout(() => speak(current.front), 180);
}

function reveal() {
  if (!current) return;
  $('#reviewAnswer').hidden = false;
  $('#ratingButtons').hidden = false;
  $('#showAnswerBtn').hidden = true;
  if (settings.autoExample && current.example) setTimeout(() => speak(current.example), 280);
}

function scheduleFor(card, rating) {
  const interval = card.interval || 0;
  const ease = card.ease || 2.5;
  if (rating === 'again') return { delay: 60_000, interval: 0, ease: Math.max(1.3, ease - 0.2), lapse: 1 };
  if (rating === 'hard') {
    if (!card.reps || interval < 1) return { delay: 6 * 3_600_000, interval: 0.25, ease: Math.max(1.3, ease - 0.05), lapse: 0 };
    const nextInterval = Math.max(1, Math.round(interval * 1.2));
    return { delay: nextInterval * DAY, interval: nextInterval, ease: Math.max(1.3, ease - 0.05), lapse: 0 };
  }
  if (rating === 'good') {
    const nextInterval = interval ? Math.max(1, Math.round(interval * ease)) : 1;
    return { delay: nextInterval * DAY, interval: nextInterval, ease, lapse: 0 };
  }
  const nextInterval = interval ? Math.max(4, Math.round(interval * ease * 1.3)) : 4;
  return { delay: nextInterval * DAY, interval: nextInterval, ease: ease + 0.1, lapse: 0 };
}

function formatDelay(milliseconds) {
  if (milliseconds < 3_600_000) return `${Math.max(1, Math.round(milliseconds / 60_000))}m`;
  if (milliseconds < DAY) return `${Math.max(1, Math.round(milliseconds / 3_600_000))}h`;
  const days = Math.max(1, Math.round(milliseconds / DAY));
  if (days < 30) return `${days}d`;
  if (days < 365) return `${Math.round(days / 30)}mo`;
  return `${(days / 365).toFixed(1)}y`;
}

function updateRatingLabels(card) {
  for (const rating of ['again', 'hard', 'good', 'easy']) {
    const schedule = scheduleFor(card, rating);
    $(`#${rating}Interval`).textContent = formatDelay(schedule.delay);
  }
}

function rate(rating) {
  if (!current) return;
  const card = current;
  const schedule = scheduleFor(card, rating);
  card.reps += 1;
  card.lapses += schedule.lapse;
  card.interval = schedule.interval;
  card.ease = schedule.ease;
  card.due = now() + schedule.delay;
  card.lastReviewed = now();
  saveCards();
  logReview();
  sessionDone += 1;
  current = null;
  nextCard();
  renderDashboard();
}


function saveLearnState() {
  localStorage.setItem(LEARN_KEY, JSON.stringify(learnState));
}

function shuffled(list) {
  const result = [...list];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function learnFamilies() {
  return allFamilies().map(definition => ({ definition, ...familyStats(definition.id) })).filter(item => item.members.length);
}

function renderLearn() {
  const items = learnFamilies().sort((a, b) => b.members.length - a.members.length || a.definition.title.localeCompare(b.definition.title, 'nl'));
  if (!items.length) return;
  const select = $('#learnFamilyFilter');
  const previous = select.value || learnState.family;
  select.innerHTML = items.map(item => `<option value="${escapeAttr(item.definition.id)}">${escapeHtml(item.definition.title)} · ${item.members.length} words</option>`).join('');
  select.value = items.some(item => item.definition.id === previous) ? previous : items[0].definition.id;
  learnState.family = select.value;
  saveLearnState();
  renderCurrentModule();
  renderModuleGrid(items);
  updateQuizScore();
  newQuizQuestion();
}

function renderCurrentModule() {
  const familyId = $('#learnFamilyFilter').value;
  const definition = allFamilies().find(item => item.id === familyId);
  const stats = familyStats(familyId);
  if (!definition) return;
  $('#moduleTitle').textContent = definition.title;
  $('#moduleMeaning').textContent = definition.meaning || 'Related Dutch words';
  $('#modulePattern').innerHTML = `<strong>Pattern:</strong> ${escapeHtml(definition.pattern || '')}<br><strong>Memory hook:</strong> ${escapeHtml(definition.hint || '')}`;
  $('#moduleMastery').textContent = `${stats.mastery}%`;
  $('#moduleCount').textContent = `${stats.studied}/${stats.members.length} studied`;
  const ordered = [...stats.members].sort((a, b) => b.frequency - a.frequency || a.front.localeCompare(b.front, 'nl'));
  $('#moduleWords').innerHTML = ordered.slice(0, 12).map((card, index) => `<button class="module-word" data-id="${escapeAttr(card.id)}"><span>${index + 1}</span><div><strong>${escapeHtml(card.front)}</strong><small>${escapeHtml(card.back)}</small></div><i>${masteryScore(card)}%</i></button>`).join('');
  $$('#moduleWords [data-id]').forEach(button => button.onclick = () => openEntryDialog(button.dataset.id));
}

function renderModuleGrid(items = learnFamilies()) {
  $('#moduleGrid').innerHTML = items.map(item => `<article class="family-card module-card" data-module="${escapeAttr(item.definition.id)}">
    <div class="family-card-head"><div class="family-letter">${escapeHtml(item.definition.accent || item.definition.title[0])}</div><div><h3>${escapeHtml(item.definition.title)}</h3><p class="meaning">${escapeHtml(item.definition.meaning)}</p></div></div>
    <p>${escapeHtml(item.definition.pattern || '')}</p>
    <div class="family-card-stats"><span><strong>${item.members.length}</strong>words</span><span><strong>${item.studied}</strong>studied</span><span><strong>${item.mastery}%</strong>mastery</span></div>
    <button class="btn secondary full" type="button">Open module</button>
  </article>`).join('');
  $$('#moduleGrid [data-module]').forEach(card => card.onclick = () => {
    $('#learnFamilyFilter').value = card.dataset.module;
    learnState.family = card.dataset.module;
    saveLearnState();
    renderCurrentModule();
    newQuizQuestion();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

function quizPool() {
  const familyId = $('#learnFamilyFilter').value;
  const familyCards = cards.filter(card => card.family === familyId);
  return familyCards.length >= 4 ? familyCards : cards.filter(card => card.type === 'verb' || card.family);
}

function chooseDistractors(correct, field, pool, count = 3) {
  const key = normalizeKey(correct[field]);
  const options = shuffled(pool.filter(card => card.id !== correct.id && normalizeKey(card[field]) !== key)).slice(0, count).map(card => card[field]);
  return shuffled([correct[field], ...options]);
}

function newQuizQuestion() {
  const pool = quizPool();
  if (!pool.length) return;
  quizAnswered = false;
  const mode = $('#quizMode').value;
  const suitable = mode === 'cloze' ? pool.filter(card => card.example && normalizeKey(card.example).includes(normalizeKey(normalizedHeadword(card.front)))) : pool;
  const source = suitable.length ? suitable : pool;
  const card = source[Math.floor(Math.random() * source.length)];
  let prompt = card.front;
  let context = '';
  let answer = card.back;
  let options = chooseDistractors(card, 'back', cards.filter(item => item.type === card.type), 3);

  if (mode === 'cloze') {
    const head = normalizedHeadword(card.front);
    const regex = new RegExp(head.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    context = card.example.replace(regex, '_____');
    prompt = 'Which word completes this sentence?';
    answer = card.front;
    options = chooseDistractors(card, 'front', pool, 3);
  } else if (mode === 'family') {
    prompt = card.front;
    context = card.back;
    answer = card.family || 'no family';
    const families = shuffled(allFamilies().filter(item => item.id !== answer)).slice(0, 3).map(item => item.id);
    options = shuffled([answer, ...families]);
  }

  quizCurrent = { card, answer, mode };
  $('#quizPrompt').textContent = prompt;
  $('#quizContext').textContent = context;
  $('#quizContext').hidden = !context;
  $('#quizFeedback').textContent = '';
  $('#quizFeedback').className = 'quiz-feedback';
  $('#quizOptions').innerHTML = options.map(option => `<button type="button" class="quiz-option" data-answer="${escapeAttr(option)}">${escapeHtml(option)}</button>`).join('');
  $$('#quizOptions .quiz-option').forEach(button => button.onclick = () => answerQuiz(button));
}

function answerQuiz(button) {
  if (!quizCurrent || quizAnswered) return;
  quizAnswered = true;
  const chosen = button.dataset.answer;
  const correct = normalizeKey(chosen) === normalizeKey(quizCurrent.answer);
  learnState.attempted += 1;
  if (correct) learnState.correct += 1;
  saveLearnState();
  $$('#quizOptions .quiz-option').forEach(option => {
    option.disabled = true;
    if (normalizeKey(option.dataset.answer) === normalizeKey(quizCurrent.answer)) option.classList.add('correct');
    else if (option === button) option.classList.add('incorrect');
  });
  $('#quizFeedback').textContent = correct ? 'Correct — goed gedaan!' : `The answer is “${quizCurrent.answer}”.`;
  $('#quizFeedback').className = `quiz-feedback ${correct ? 'success' : 'error'}`;
  updateQuizScore();
}

function updateQuizScore() {
  const accuracy = learnState.attempted ? Math.round(learnState.correct / learnState.attempted * 100) : 0;
  $('#quizScore').textContent = `${learnState.correct}/${learnState.attempted} correct · ${accuracy}%`;
}

function renderFamilies() {
  const query = normalizeKey($('#familySearch').value);
  const sort = $('#familySort').value;
  let items = allFamilies().map(definition => ({ definition, ...familyStats(definition.id) })).filter(item => item.members.length);
  if (query) {
    items = items.filter(item => [item.definition.title, item.definition.meaning, item.definition.pattern, ...item.members.flatMap(card => [card.front, card.back])].some(value => normalizeKey(value).includes(query)));
  }
  if (sort === 'name') items.sort((a, b) => a.definition.title.localeCompare(b.definition.title, 'nl'));
  else if (sort === 'size') items.sort((a, b) => b.members.length - a.members.length);
  else if (sort === 'mastery') items.sort((a, b) => a.mastery - b.mastery || b.members.length - a.members.length);
  else items.sort((a, b) => (a.mastery + a.studied * 2) - (b.mastery + b.studied * 2) || b.members.length - a.members.length);

  $('#familyGrid').innerHTML = items.map(item => {
    const previews = item.members.sort((a, b) => b.frequency - a.frequency).slice(0, 5);
    return `<article class="family-card" data-family="${escapeAttr(item.definition.id)}">
      <div class="family-card-head"><div class="family-letter">${escapeHtml(item.definition.accent || item.definition.title[0])}</div><div><h3>${escapeHtml(item.definition.title)}</h3><p class="meaning">${escapeHtml(item.definition.meaning)}</p></div></div>
      <p>${escapeHtml(item.definition.pattern)}</p>
      <div class="family-preview">${previews.map(card => `<span>${escapeHtml(card.front)}</span>`).join('')}</div>
      <div class="family-card-stats"><span><strong>${item.members.length}</strong>entries</span><span><strong>${item.studied}</strong>studied</span><span><strong>${item.mastery}%</strong>mastery</span></div>
    </article>`;
  }).join('') || '<p class="empty">No families match your search.</p>';
  $$('#familyGrid [data-family]').forEach(card => card.onclick = () => openFamilyDialog(card.dataset.family));
}

function openFamilyDialog(familyId) {
  const definition = allFamilies().find(item => item.id === familyId);
  if (!definition) return;
  selectedFamily = familyId;
  const stats = familyStats(familyId);
  $('#familyDialogTitle').textContent = definition.title;
  $('#familyDialogMeaning').textContent = `${definition.meaning} · ${stats.members.length} entries · ${stats.mastery}% mastery`;
  $('#familyDialogPattern').innerHTML = `<strong>Pattern:</strong> ${escapeHtml(definition.pattern)}<br><strong>Memory hook:</strong> ${escapeHtml(definition.hint || '')}`;
  const members = [...stats.members].sort((a, b) => {
    if (a.front === definition.root) return -1;
    if (b.front === definition.root) return 1;
    return (a.prefix || '').localeCompare(b.prefix || '', 'nl') || a.front.localeCompare(b.front, 'nl');
  });
  $('#familyMembers').innerHTML = members.map(card => `<article class="family-member" data-id="${escapeAttr(card.id)}">
    <span class="prefix-box">${escapeHtml(card.prefix || 'ROOT')}</span>
    <strong>${escapeHtml(card.front)}</strong>
    <span>${escapeHtml(card.back)}</span>
    <div class="mastery-mini" title="${masteryScore(card)}% mastery"><i style="width:${masteryScore(card)}%"></i></div>
  </article>`).join('');
  $$('#familyMembers [data-id]').forEach(member => member.onclick = () => {
    $('#familyDialog').close();
    openEntryDialog(member.dataset.id);
  });
  $('#familyDialog').showModal();
}

function searchableValues(card) {
  return [card.front, card.back, card.example, card.forms, card.note, card.family, card.prefix, card.prefixMeaning, ...card.tags, ...card.collocations, ...card.related];
}

function renderDictionary() {
  const query = normalizeKey($('#searchInput').value);
  const level = $('#levelFilter').value;
  const type = $('#typeFilter').value;
  const family = $('#familyFilter').value;
  const favoritesOnly = $('#favoritesOnly').checked;
  const sort = $('#dictionarySort').value;

  let list = cards.filter(card =>
    (!query || searchableValues(card).some(value => normalizeKey(value).includes(query))) &&
    (!level || card.cefr === level) &&
    (!type || card.type === type) &&
    (!family || card.family === family) &&
    (!favoritesOnly || card.favorite)
  );

  if (sort === 'frequency') list.sort((a, b) => b.frequency - a.frequency || a.front.localeCompare(b.front, 'nl'));
  else if (sort === 'due') list.sort((a, b) => (a.due || 0) - (b.due || 0) || a.front.localeCompare(b.front, 'nl'));
  else if (sort === 'newest') list.sort((a, b) => b.created - a.created);
  else list.sort((a, b) => a.front.localeCompare(b.front, 'nl'));

  $('#dictionaryCount').textContent = `${list.length} of ${cards.length} entries`;
  $('#cardList').innerHTML = list.map(card => {
    const state = cardState(card).toLowerCase();
    return `<article class="dict-card" data-id="${escapeAttr(card.id)}">
      <div class="dict-main">
        <h3>${escapeHtml(card.front)}</h3>
        <p><strong>${escapeHtml(card.back)}</strong></p>
        <div class="dict-meta">
          <span class="level-badge">${escapeHtml(card.cefr)}</span>
          <span class="chip">${escapeHtml(card.type)}</span>
          ${card.family ? `<span class="family-badge">${escapeHtml(card.family)}</span>` : ''}
          <span class="chip"><i class="state-dot state-${state}"></i>${escapeHtml(cardState(card))}</span>
          ${card.separable === true ? '<span class="chip">separable</span>' : card.separable === false ? '<span class="chip">inseparable</span>' : ''}
        </div>
        ${card.forms ? `<p class="dict-forms">${escapeHtml(card.forms)}</p>` : ''}
        ${card.example ? `<p class="dict-example">${escapeHtml(card.example)}</p>` : ''}
      </div>
      <div class="dict-actions">
        <button class="icon-btn favorite-btn" title="Favorite">${card.favorite ? '★' : '☆'}</button>
        <button class="btn ghost speak-btn">🔊</button>
        <button class="btn secondary details-btn">Details</button>
      </div>
    </article>`;
  }).join('') || '<p class="empty">No entries match these filters.</p>';

  $$('.dict-card').forEach(element => {
    const card = cards.find(item => item.id === element.dataset.id);
    element.querySelector('.dict-main').onclick = () => openEntryDialog(card.id);
    element.querySelector('.details-btn').onclick = () => openEntryDialog(card.id);
    element.querySelector('.favorite-btn').onclick = () => {
      card.favorite = !card.favorite;
      saveCards();
      renderDictionary();
    };
    element.querySelector('.speak-btn').onclick = () => speak(card.front);
  });
}

function openEntryDialog(cardId) {
  const card = cards.find(item => item.id === cardId);
  if (!card) return;
  selectedEntry = card;
  $('#entryEyebrow').textContent = card.family ? `${card.family} word family` : 'Dictionary entry';
  $('#entryTitle').textContent = card.front;
  const status = cardState(card);
  const sections = [];
  if (card.forms) sections.push(detailBox('Forms / grammar', `<p>${escapeHtml(card.forms)}</p>`));
  if (card.family || card.prefix || card.separable !== null) {
    const grammar = [
      card.family ? `<strong>Family:</strong> ${escapeHtml(card.family)}` : '',
      card.prefix ? `<strong>Prefix:</strong> ${escapeHtml(card.prefix)}${card.prefixMeaning ? ` — ${escapeHtml(card.prefixMeaning)}` : ''}` : '',
      card.separable === true ? '<strong>Pattern:</strong> separable verb' : card.separable === false ? '<strong>Pattern:</strong> inseparable verb' : ''
    ].filter(Boolean).join('<br>');
    sections.push(detailBox('Word structure', `<p>${grammar}</p>`));
  }
  if (card.collocations.length) sections.push(detailBox('Common collocations', `<ul>${card.collocations.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`));
  if (card.related.length) sections.push(detailBox('Related words', `<div class="summary-pills">${card.related.map(item => `<span>${escapeHtml(item)}</span>`).join('')}</div>`));

  $('#entryContent').innerHTML = `
    <div class="entry-header-meta">
      <span class="level-badge">${escapeHtml(card.cefr)}</span>
      <span class="chip">${escapeHtml(card.type)}</span>
      <span class="chip">${escapeHtml(card.register)}</span>
      <span class="chip">${'★'.repeat(card.frequency)}${'☆'.repeat(5 - card.frequency)}</span>
      <span class="chip"><i class="state-dot state-${status.toLowerCase()}"></i>${escapeHtml(status)}</span>
      ${card.family ? `<button class="family-badge text-btn-family" data-open-family="${escapeAttr(card.family)}">${escapeHtml(card.family)}</button>` : ''}
    </div>
    <p class="entry-meaning">${escapeHtml(card.back)}</p>
    ${card.example ? `<p class="entry-example">${escapeHtml(card.example)}</p>` : ''}
    <div class="detail-grid">${sections.join('')}</div>
    ${card.note ? `<div class="usage-note"><strong>Usage note</strong><br>${escapeHtml(card.note)}</div>` : ''}
    ${card.tags.length ? `<div class="details-grid">${card.tags.map(tag => `<span class="chip">${escapeHtml(tag)}</span>`).join('')}</div>` : ''}`;
  const familyButton = $('#entryContent [data-open-family]');
  if (familyButton) familyButton.onclick = () => {
    $('#entryDialog').close();
    openFamilyDialog(familyButton.dataset.openFamily);
  };
  $('#entryFavoriteBtn').textContent = card.favorite ? '★ Favorited' : '☆ Favorite';
  $('#entryDialog').showModal();
}

function detailBox(title, content) {
  return `<section class="detail-box"><h4>${escapeHtml(title)}</h4>${content}</section>`;
}

function openCardDialog(card = null, prefill = {}) {
  const data = card || makeCard(prefill);
  $('#dialogTitle').textContent = card ? 'Edit entry' : 'Add entry';
  $('#editCardId').value = card?.id || '';
  $('#dutchInput').value = data.front || prefill.front || '';
  $('#englishInput').value = card ? data.back : prefill.back || '';
  $('#exampleInput').value = card ? data.example : prefill.example || '';
  $('#cefrInput').value = data.cefr || 'B1';
  $('#wordTypeInput').value = data.type || 'other';
  $('#frequencyInput').value = data.frequency || 3;
  $('#registerInput').value = data.register || 'everyday';
  $('#familyInput').value = data.family || '';
  $('#separableInput').value = data.separable === true ? 'true' : data.separable === false ? 'false' : '';
  $('#formsInput').value = data.forms || '';
  $('#collocationsInput').value = (data.collocations || []).join('; ');
  $('#relatedInput').value = (data.related || []).join(', ');
  $('#tagsInput').value = (data.tags || []).join(', ');
  $('#noteInput').value = data.note || '';
  $('#deleteDialogBtn').hidden = !card;
  $('#cardDialog').showModal();
  setTimeout(() => $('#dutchInput').focus(), 30);
}

function saveForm(event) {
  event.preventDefault();
  const id = $('#editCardId').value;
  const separableValue = $('#separableInput').value;
  const data = {
    front: $('#dutchInput').value.trim(),
    back: $('#englishInput').value.trim(),
    example: $('#exampleInput').value.trim(),
    cefr: $('#cefrInput').value,
    type: $('#wordTypeInput').value,
    frequency: Number($('#frequencyInput').value),
    register: $('#registerInput').value,
    family: $('#familyInput').value,
    separable: separableValue === '' ? null : separableValue === 'true',
    forms: $('#formsInput').value.trim(),
    collocations: listValue($('#collocationsInput').value),
    related: listValue($('#relatedInput').value),
    tags: listValue($('#tagsInput').value),
    note: $('#noteInput').value.trim()
  };
  if (!data.front || !data.back) return;

  const existing = cards.find(card => card.id === id);
  if (existing) Object.assign(existing, data);
  else cards.push(makeCard(data));
  saveCards();
  $('#cardDialog').close();
  populateFilters();
  renderDictionary();
  renderFamilies();
  renderDashboard();
}

function parseDelimitedRows(text, delimiter) {
  const rows = [];
  let row = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && quoted && next === '"') {
      value += '"';
      index += 1;
    } else if (char === '"') quoted = !quoted;
    else if (char === delimiter && !quoted) {
      row.push(value.trim());
      value = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(value.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      value = '';
    } else value += char;
  }
  row.push(value.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function mapStructuredRow(row, headers = []) {
  const aliases = {
    front: ['front', 'dutch', 'word', 'nederlands'],
    back: ['back', 'english', 'meaning', 'translation', 'engels'],
    example: ['example', 'sentence', 'voorbeeld'],
    cefr: ['cefr', 'level', 'niveau'],
    type: ['type', 'wordtype', 'word type'],
    frequency: ['frequency', 'freq'],
    register: ['register'],
    forms: ['forms', 'grammar', 'vormen'],
    tags: ['tags', 'labels'],
    note: ['note', 'usage', 'notes'],
    family: ['family', 'word family', 'familie'],
    separable: ['separable', 'scheidbaar'],
    collocations: ['collocations', 'collocaties'],
    related: ['related', 'related words', 'verwant']
  };
  if (!headers.length) return makeCard({ front: row[0], back: row[1], example: row.slice(2).join(' — ') });
  const object = {};
  for (const [field, names] of Object.entries(aliases)) {
    const column = headers.findIndex(header => names.includes(normalizeKey(header)));
    if (column >= 0) object[field] = row[column] || '';
  }
  return makeCard(object);
}

function parseText(text, filename = '') {
  const trimmed = text.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith('[') || trimmed.startsWith('{') || filename.toLowerCase().endsWith('.json')) {
    const parsed = JSON.parse(trimmed);
    previewFamilyDefinitions = Array.isArray(parsed)
      ? []
      : normalizeFamilyDefinitions(parsed.familyDefinitions || parsed.familyInfo || []);
    const source = Array.isArray(parsed) ? parsed : parsed.cards || parsed.entries || [];
    return source.map(makeCard).filter(card => card.front && card.back);
  }
  previewFamilyDefinitions = [];

  const firstLine = trimmed.split(/\r?\n/, 1)[0];
  const delimiter = filename.toLowerCase().endsWith('.tsv') || firstLine.includes('\t') ? '\t' : ',';
  const looksStructured = filename.toLowerCase().endsWith('.csv') || filename.toLowerCase().endsWith('.tsv') || (firstLine.includes(delimiter) && !firstLine.includes('—'));

  if (looksStructured) {
    const rows = parseDelimitedRows(trimmed, delimiter);
    if (!rows.length) return [];
    const headerWords = rows[0].map(normalizeKey);
    const hasHeader = headerWords.some(header => ['front', 'dutch', 'word', 'nederlands', 'back', 'english', 'meaning', 'translation'].includes(header));
    const headers = hasHeader ? rows.shift() : [];
    return rows.map(row => mapStructuredRow(row, headers)).filter(card => card.front && card.back);
  }

  return trimmed.split(/\r?\n/).map(line => line.trim()).filter(Boolean).map(line => {
    let parts;
    if (line.includes('—')) parts = line.split(/\s*—\s*/);
    else if (line.includes('|')) parts = line.split(/\s*\|\s*/);
    else if (line.includes('\t')) parts = line.split('\t');
    else parts = line.split(/\s*;\s*/);
    if (parts.length < 2) return null;
    return makeCard({ front: parts[0], back: parts[1], example: parts.slice(2).join(' — ') });
  }).filter(Boolean);
}

function previewImport(filename = '') {
  try {
    previewEntries = parseText($('#importText').value, filename);
    $('#importPreview').classList.toggle('empty', !previewEntries.length);
    $('#previewCount').textContent = previewEntries.length ? `${previewEntries.length} entries` : '';
    $('#importPreview').innerHTML = previewEntries.slice(0, 50).map(card => `<div class="preview-item"><strong>${escapeHtml(card.front)}</strong><span>${escapeHtml(card.back)}</span>${card.family ? `<small> · ${escapeHtml(card.family)} family</small>` : ''}${card.example ? `<small> — ${escapeHtml(card.example)}</small>` : ''}</div>`).join('') || 'No valid entries found.';
    const familyText = previewFamilyDefinitions.length ? ` and ${previewFamilyDefinitions.length} family definitions` : '';
    setImportStatus(`${previewEntries.length} valid entries${familyText} found.`, 'success');
  } catch (error) {
    previewEntries = [];
    previewFamilyDefinitions = [];
    $('#importPreview').innerHTML = 'No valid entries found.';
    $('#previewCount').textContent = '';
    setImportStatus(`Preview failed: ${error.message}`, 'error');
  }
}

function importEntries(entries, definitions = previewFamilyDefinitions) {
  const mode = $('#duplicateMode').value;
  const index = new Map(cards.map(card => [normalizeKey(card.front), card]));
  let added = 0;
  let updated = 0;
  let skipped = 0;

  for (const raw of entries) {
    const incoming = makeCard(raw);
    if (!incoming.front || !incoming.back) continue;
    const key = normalizeKey(incoming.front);
    const existing = index.get(key);
    if (!existing) {
      cards.push(incoming);
      index.set(key, incoming);
      added += 1;
    } else if (mode === 'skip') skipped += 1;
    else {
      const merged = mergeContent(existing, incoming, mode === 'replace' ? 'replace' : 'update');
      Object.assign(existing, merged);
      updated += 1;
    }
  }

  const importedDefinitionCount = mergeImportedFamilyDefinitions(definitions);
  saveCards();
  populateFilters();
  renderDashboard();
  renderFamilies();
  renderLearn();
  renderDictionary();
  const definitionText = importedDefinitionCount ? ` Imported ${importedDefinitionCount} family definitions.` : '';
  setImportStatus(`Added ${added}, updated ${updated}, skipped ${skipped}.${definitionText}`, 'success');
}

function setImportStatus(message, type = '') {
  const status = $('#importStatus');
  status.textContent = message;
  status.className = `status ${type}`.trim();
}

function downloadTemplate() {
  const template = [
    ['front', 'back', 'example', 'cefr', 'type', 'frequency', 'register', 'forms', 'family', 'separable', 'collocations', 'related', 'tags', 'note'],
    ['voorstellen', 'to propose; to introduce', 'Ik stel voor dat we morgen verdergaan.', 'A2', 'verb', '5', 'everyday', 'stelt voor · stelde voor · heeft voorgesteld', 'stellen', 'true', 'een oplossing voorstellen; zich voorstellen', 'voorstel; voorstelling', 'separable verb', 'The reflexive form has two common meanings.']
  ];
  const csv = template.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
  downloadBlob(csv, 'dutchdeck-import-template.csv', 'text/csv;charset=utf-8');
}

function prepareReaderIndex() {
  readerWordIndex = new Map();
  const add = (token, card) => {
    const key = normalizeKey(token).replace(/^[^\p{L}]+|[^\p{L}]+$/gu, '');
    if (!key || key.length < 2) return;
    if (!readerWordIndex.has(key)) readerWordIndex.set(key, []);
    const list = readerWordIndex.get(key);
    if (!list.some(item => item.id === card.id)) list.push(card);
  };

  for (const card of cards) {
    const head = normalizedHeadword(card.front);
    add(head, card);
    if (!head.includes(' ')) add(head, card);
    const formTokens = `${card.forms} ${card.related.join(' ')}`.match(/[\p{L}][\p{L}'’’-]*/gu) || [];
    formTokens.forEach(token => add(token, card));
  }
}

function renderReading() {
  prepareReaderIndex();
  const text = $('#readingText').value;
  localStorage.setItem(READING_KEY, text);
  if (!text.trim()) {
    $('#readingOutput').className = 'reading-output empty';
    $('#readingOutput').textContent = 'Paste a Dutch text first.';
    $('#readingStats').textContent = '';
    return;
  }

  const parts = text.split(/([\p{L}][\p{L}'’’-]*)/gu);
  let words = 0;
  let known = 0;
  $('#readingOutput').className = 'reading-output';
  $('#readingOutput').innerHTML = parts.map(part => {
    if (!/^[\p{L}]/u.test(part)) return escapeHtml(part).replace(/\n/g, '<br>');
    words += 1;
    const key = normalizeKey(part);
    const matches = readerWordIndex.get(key) || [];
    if (matches.length) known += 1;
    return `<button class="reading-token ${matches.length ? 'known' : 'unknown'}" data-word="${escapeAttr(part)}">${escapeHtml(part)}</button>`;
  }).join('');
  const unique = new Set((text.match(/[\p{L}][\p{L}'’’-]*/gu) || []).map(normalizeKey));
  const knownUnique = [...unique].filter(word => readerWordIndex.has(word)).length;
  $('#readingStats').textContent = `${words} words · ${knownUnique}/${unique.size} unique words in your deck`;
  $$('.reading-token').forEach(token => token.onclick = () => lookupReaderWord(token));
}

function lookupReaderWord(tokenElement) {
  $$('.reading-token.active').forEach(token => token.classList.remove('active'));
  tokenElement.classList.add('active');
  const word = tokenElement.dataset.word;
  const matches = readerWordIndex.get(normalizeKey(word)) || [];
  if (matches.length) {
    $('#readerLookup').className = '';
    $('#readerLookup').innerHTML = `<p class="eyebrow">Selected word</p><h3 class="lookup-word">${escapeHtml(word)}</h3>${matches.slice(0, 5).map(card => `<article class="lookup-match"><h4>${escapeHtml(card.front)}</h4><p>${escapeHtml(card.back)}</p><div class="lookup-actions"><button class="btn secondary lookup-details" data-id="${escapeAttr(card.id)}">Details</button><button class="btn ghost lookup-speak" data-id="${escapeAttr(card.id)}">🔊</button></div></article>`).join('')}`;
    $$('#readerLookup .lookup-details').forEach(button => button.onclick = () => openEntryDialog(button.dataset.id));
    $$('#readerLookup .lookup-speak').forEach(button => button.onclick = () => {
      const card = cards.find(item => item.id === button.dataset.id);
      if (card) speak(card.front);
    });
  } else {
    $('#readerLookup').className = '';
    $('#readerLookup').innerHTML = `<p class="eyebrow">Not in your deck</p><h3 class="lookup-word">${escapeHtml(word)}</h3><p class="muted">Add the word now and fill in the meaning after checking it in a dictionary.</p><div class="lookup-actions"><button id="readerAddWordBtn" class="btn primary">Add to DutchDeck</button><button id="readerSpeakWordBtn" class="btn ghost">🔊 Listen</button></div>`;
    $('#readerAddWordBtn').onclick = () => openCardDialog(null, { front: word, type: inferType(word, ''), cefr: inferCefr(word) });
    $('#readerSpeakWordBtn').onclick = () => speak(word);
  }
}

function voiceScore(voice) {
  const name = voice.name.toLowerCase();
  const lang = voice.lang.toLowerCase();
  return (lang === 'nl-nl' ? 100 : lang.startsWith('nl') ? 70 : 0) + (name.includes('microsoft') ? 30 : 0) + (name.includes('natural') || name.includes('online') ? 25 : 0);
}

function loadVoices() {
  if (!('speechSynthesis' in window)) return;
  voices = speechSynthesis.getVoices().sort((a, b) => voiceScore(b) - voiceScore(a));
  $('#voiceSelect').innerHTML = voices.map(voice => `<option value="${escapeAttr(voice.voiceURI)}">${escapeHtml(voice.name)} (${escapeHtml(voice.lang)})</option>`).join('');
  const selected = voices.find(voice => voice.voiceURI === settings.voiceURI) || voices.find(voice => voice.lang.toLowerCase().startsWith('nl')) || voices[0];
  if (selected) {
    settings.voiceURI = selected.voiceURI;
    $('#voiceSelect').value = selected.voiceURI;
    saveSettings();
  }
}

function speak(text) {
  if (!text || !('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = voices.find(voice => voice.voiceURI === settings.voiceURI) || voices.find(voice => voice.lang.toLowerCase().startsWith('nl')) || null;
  utterance.lang = 'nl-NL';
  utterance.rate = Number(settings.rate) || 0.88;
  setTimeout(() => speechSynthesis.speak(utterance), 70);
}

function downloadBlob(content, filename, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

function exportBackup() {
  const payload = { version: 5, exportedAt: new Date().toISOString(), cards, familyDefinitions: Object.fromEntries(importedFamilyDefinitions.map(item => [item.id, item])), settings, reviews: reviews(), reading: $('#readingText').value || localStorage.getItem(READING_KEY) || '' };
  downloadBlob(JSON.stringify(payload, null, 2), `dutchdeck-studio-${todayKey()}.json`);
}

function populateFilters() {
  const types = ['noun', 'verb', 'adjective', 'adverb', 'connector', 'expression', 'other', ...cards.map(card => card.type).filter(Boolean)];
  $('#typeFilter').innerHTML = '<option value="">All types</option>' + [...new Set(types)].sort().map(type => `<option>${escapeHtml(type)}</option>`).join('');

  const families = allFamilies().filter(definition => cards.some(card => card.family === definition.id));
  const familyOptions = families.sort((a, b) => a.title.localeCompare(b.title, 'nl')).map(definition => `<option value="${escapeAttr(definition.id)}">${escapeHtml(definition.title)}</option>`).join('');
  $('#familyFilter').innerHTML = '<option value="">All families</option>' + familyOptions;
  $('#familyInput').innerHTML = '<option value="">No family</option>' + familyOptions;
  $('#reviewFamilyFilter').innerHTML = familyOptions;
}

function renderDataSummary() {
  const rich = cards.filter(card => card.collocations.length || card.related.length || card.note || card.forms).length;
  const familyEntries = cards.filter(card => card.family).length;
  $('#dataSummary').innerHTML = `<span><strong>${cards.length}</strong>total entries</span><span><strong>${familyEntries}</strong>family entries</span><span><strong>${allFamilies().filter(f => cards.some(card => card.family === f.id)).length}</strong>families</span><span><strong>${rich}</strong>rich entries</span>`;
}

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
}

function connection() {
  const badge = $('#connectionBadge');
  badge.textContent = navigator.onLine ? 'Online' : 'Offline';
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}

function escapeAttr(value = '') {
  return escapeHtml(value);
}

function bindDialogs() {
  const closeOnBackdrop = dialog => dialog.addEventListener('click', event => {
    if (event.target === dialog) dialog.close();
  });
  ['iosInstallDialog', 'entryDialog', 'familyDialog', 'cardDialog'].forEach(id => closeOnBackdrop($(`#${id}`)));

  $('#closeIosInstall').onclick = () => $('#iosInstallDialog').close();
  $('#closeEntryDialog').onclick = () => $('#entryDialog').close();
  $('#closeFamilyDialog').onclick = () => $('#familyDialog').close();
  $('#closeDialog').onclick = $('#cancelDialogBtn').onclick = () => $('#cardDialog').close();
}

function bind() {
  $$('.nav-btn').forEach(button => button.onclick = () => switchView(button.dataset.view));
  $$('[data-go]').forEach(button => button.onclick = () => switchView(button.dataset.go));

  $('#learnFamilyFilter').onchange = () => { learnState.family = $('#learnFamilyFilter').value; saveLearnState(); renderCurrentModule(); newQuizQuestion(); };
  $('#quizMode').onchange = newQuizQuestion;
  $('#nextQuizBtn').onclick = newQuizQuestion;
  $('#listenQuizBtn').onclick = () => quizCurrent && speak(quizCurrent.mode === 'cloze' ? quizCurrent.card.example : quizCurrent.card.front);

  $('#reviewFilter').onchange = buildReviewQueue;
  $('#reviewFamilyFilter').onchange = buildReviewQueue;
  $('#showAnswerBtn').onclick = reveal;
  $$('[data-rating]').forEach(button => button.onclick = () => rate(button.dataset.rating));
  $('#speakWordBtn').onclick = () => current && speak(current.front);
  $('#speakExampleBtn').onclick = () => current && speak(current.example);
  $('#openReviewDetailsBtn').onclick = () => current && openEntryDialog(current.id);
  $('#favoriteReviewBtn').onclick = () => {
    if (!current) return;
    current.favorite = !current.favorite;
    saveCards();
    $('#favoriteReviewBtn').textContent = current.favorite ? '★' : '☆';
  };

  $('#familySearch').addEventListener('input', renderFamilies);
  $('#familySort').onchange = renderFamilies;
  $('#reviewFamilyBtn').onclick = () => {
    switchView('review');
    $('#reviewFilter').value = 'family';
    $('#reviewFamilyFilter').hidden = false;
    buildReviewQueue();
  };
  $('#familyDialogReviewBtn').onclick = () => {
    $('#familyDialog').close();
    switchView('review');
    $('#reviewFilter').value = 'family';
    $('#reviewFamilyFilter').value = selectedFamily;
    $('#reviewFamilyFilter').hidden = false;
    buildReviewQueue();
  };

  $('#addCardBtn').onclick = () => openCardDialog();
  $('#cardForm').onsubmit = saveForm;
  $('#deleteDialogBtn').onclick = () => {
    const id = $('#editCardId').value;
    if (id && confirm('Delete this entry?')) {
      cards = cards.filter(card => card.id !== id);
      saveCards();
      $('#cardDialog').close();
      populateFilters();
      renderDictionary();
      renderFamilies();
      renderDashboard();
    }
  };
  ['searchInput', 'levelFilter', 'typeFilter', 'familyFilter', 'favoritesOnly', 'dictionarySort'].forEach(id => {
    $(`#${id}`).addEventListener(id === 'searchInput' ? 'input' : 'change', renderDictionary);
  });

  $('#entryFavoriteBtn').onclick = () => {
    if (!selectedEntry) return;
    selectedEntry.favorite = !selectedEntry.favorite;
    saveCards();
    $('#entryFavoriteBtn').textContent = selectedEntry.favorite ? '★ Favorited' : '☆ Favorite';
    renderDictionary();
  };
  $('#entrySpeakBtn').onclick = () => selectedEntry && speak(selectedEntry.front);
  $('#entryEditBtn').onclick = () => {
    if (!selectedEntry) return;
    $('#entryDialog').close();
    openCardDialog(selectedEntry);
  };
  $('#entryReviewBtn').onclick = () => {
    if (!selectedEntry) return;
    $('#entryDialog').close();
    switchView('review');
    reviewQueue = [selectedEntry];
    sessionTotal = 1;
    sessionDone = 0;
    nextCard();
  };

  $('#renderReadingBtn').onclick = renderReading;
  $('#readingText').addEventListener('input', event => localStorage.setItem(READING_KEY, event.target.value));
  $('#clearReadingBtn').onclick = () => {
    $('#readingText').value = '';
    localStorage.removeItem(READING_KEY);
    renderReading();
    $('#readerLookup').className = 'empty compact';
    $('#readerLookup').textContent = 'Tap a word to inspect it.';
  };
  $('#speakReadingBtn').onclick = () => speak($('#readingText').value);

  $('#previewImportBtn').onclick = () => previewImport();
  $('#importPasteBtn').onclick = () => {
    if (!previewEntries.length) previewImport();
    if (previewEntries.length) importEntries(previewEntries, previewFamilyDefinitions);
  };
  $('#downloadTemplateBtn').onclick = downloadTemplate;
  $('#importFile').onchange = async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      $('#importText').value = text;
      previewEntries = parseText(text, file.name);
      $('#previewCount').textContent = `${previewEntries.length} entries`;
      $('#importPreview').classList.toggle('empty', !previewEntries.length);
      $('#importPreview').innerHTML = previewEntries.slice(0, 50).map(card => `<div class="preview-item"><strong>${escapeHtml(card.front)}</strong><span>${escapeHtml(card.back)}</span>${card.example ? `<small> — ${escapeHtml(card.example)}</small>` : ''}</div>`).join('') || 'No valid entries found.';
      importEntries(previewEntries, previewFamilyDefinitions);
    } catch (error) {
      setImportStatus(`Import failed: ${error.message}`, 'error');
    } finally {
      event.target.value = '';
    }
  };

  $('#voiceSelect').onchange = event => { settings.voiceURI = event.target.value; saveSettings(); };
  $('#rateRange').oninput = event => {
    settings.rate = Number(event.target.value);
    $('#rateOutput').textContent = `${settings.rate.toFixed(2)}×`;
    saveSettings();
  };
  $('#autoWordCheck').onchange = event => { settings.autoWord = event.target.checked; saveSettings(); };
  $('#autoExampleCheck').onchange = event => { settings.autoExample = event.target.checked; saveSettings(); };
  $('#newLimitInput').onchange = event => {
    settings.newLimit = Math.min(100, Math.max(1, Number(event.target.value) || 15));
    event.target.value = settings.newLimit;
    saveSettings();
  };
  $('#shuffleReviewCheck').onchange = event => { settings.shuffleReview = event.target.checked; saveSettings(); };
  $('#testVoiceBtn').onclick = () => speak('Goedemorgen. Welkom bij DutchDeck Studio.');
  $('#exportBtn').onclick = exportBackup;
  $('#restoreFile').onchange = async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data.cards)) throw new Error('This backup does not contain a card list.');
      cards = data.cards.map(makeCard);
      importedFamilyDefinitions = normalizeFamilyDefinitions(data.familyDefinitions || data.familyInfo || []);
      saveImportedFamilyDefinitions();
      settings = { ...settings, ...(data.settings || {}) };
      if (data.reviews) localStorage.setItem(REVIEW_KEY, JSON.stringify(data.reviews));
      if (typeof data.reading === 'string') localStorage.setItem(READING_KEY, data.reading);
      saveCards();
      saveSettings();
      location.reload();
    } catch (error) {
      alert(`Restore failed: ${error.message}`);
    }
  };
  $('#resetProgressBtn').onclick = () => {
    if (!confirm('Reset all review progress while keeping your words?')) return;
    cards.forEach(card => Object.assign(card, { due: 0, interval: 0, ease: 2.5, reps: 0, lapses: 0, lastReviewed: 0 }));
    localStorage.removeItem(REVIEW_KEY);
    saveCards();
    renderDashboard();
    buildReviewQueue();
  };
  $('#resetBtn').onclick = () => {
    if (confirm('Delete all local data and restore the built-in knowledge base?')) {
      localStorage.clear();
      location.reload();
    }
  };

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredInstall = event;
    $('#installBtn').hidden = false;
  });
  $('#installBtn').onclick = async () => {
    if (!deferredInstall) return;
    deferredInstall.prompt();
    await deferredInstall.userChoice;
    deferredInstall = null;
    $('#installBtn').hidden = true;
  };
  const iosButton = $('#iosInstallBtn');
  if (isIos() && !isStandalone()) iosButton.hidden = false;
  iosButton.onclick = () => $('#iosInstallDialog').showModal();

  window.addEventListener('online', connection);
  window.addEventListener('offline', connection);
  document.addEventListener('keydown', event => {
    if (!$('#reviewView').classList.contains('active') || document.querySelector('dialog[open]')) return;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
    if (event.code === 'Space') {
      event.preventDefault();
      if ($('#reviewAnswer').hidden) reveal();
    } else if (!$('#ratingButtons').hidden && ['1', '2', '3', '4'].includes(event.key)) {
      rate({ '1': 'again', '2': 'hard', '3': 'good', '4': 'easy' }[event.key]);
    }
  });
}

async function init() {
  bindDialogs();
  bind();
  populateFilters();
  $('#rateRange').value = settings.rate;
  $('#rateOutput').textContent = `${Number(settings.rate).toFixed(2)}×`;
  $('#autoWordCheck').checked = settings.autoWord;
  $('#autoExampleCheck').checked = settings.autoExample;
  $('#newLimitInput').value = settings.newLimit;
  $('#shuffleReviewCheck').checked = settings.shuffleReview;
  $('#readingText').value = localStorage.getItem(READING_KEY) || '';
  loadVoices();
  if ('speechSynthesis' in window) speechSynthesis.onvoiceschanged = loadVoices;
  connection();
  renderDashboard();
  renderFamilies();
  renderLearn();
  renderDictionary();
  renderDataSummary();
  buildReviewQueue();
  prepareReaderIndex();
  if ($('#readingText').value.trim()) renderReading();

  if ('serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register('./sw.js');
    } catch (error) {
      console.warn('Service worker registration failed', error);
    }
  }
}

window.addEventListener('DOMContentLoaded', init);
