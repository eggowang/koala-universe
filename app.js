const initialTasks = [
  { id: 1, group: '早晨', icon: '☀️', name: '整理床铺和书包', stars: 1, photo: false, status: 'approved' },
  { id: 2, group: '放学后', icon: '📚', name: '完成语文作业', stars: 3, photo: true, status: 'submitted' },
  { id: 3, group: '放学后', icon: '✏️', name: '完成数学作业', stars: 3, photo: true, status: 'todo' },
  { id: 4, group: '放学后', icon: '📖', name: '阅读 20 分钟', stars: 2, photo: false, status: 'todo' },
  { id: 5, group: '锻炼', icon: '🪢', name: '跳绳 500 个', stars: 4, photo: true, status: 'submitted' },
  { id: 6, group: '锻炼', icon: '🏃', name: '户外运动 20 分钟', stars: 3, photo: false, status: 'todo' },
  { id: 7, group: '睡前', icon: '🌙', name: '整理明天用品并早睡', stars: 2, photo: false, status: 'todo' }
];
const initialRewards = [
  { id: 1, icon: '🎬', name: '动画时间 20 分钟', cost: 20 },
  { id: 2, icon: '🎮', name: '周末游戏 30 分钟', cost: 30 },
  { id: 3, icon: '🚲', name: '选择一次亲子活动', cost: 50 }
];
const initialLearningMaterials = [
  { id: 'demo-cn-1', subject: '语文', type: 'note', title: '看图说话三步法', taskId: 2, content: '第一步：看清时间、地点和人物。\n第二步：按顺序说清楚发生了什么。\n第三步：补充人物的动作、表情和感受。', source: '家长自建示例', url: '', published: true },
  { id: 'demo-cn-2', subject: '语文', type: 'exercise', title: '词语搭配小练习', taskId: 2, content: '1. 在括号里填上合适的词：一（　）小河、一（　）铅笔。\n2. 用“认真”写一句完整的话。\n3. 找出“明亮”的近义词。', answer: '1. 一条小河、一支铅笔。\n2. 示例：我认真地完成了今天的作业。\n3. 光亮（答案合理即可）。', source: '原创练习', url: '', published: true },
  { id: 'demo-math-1', subject: '数学', type: 'exercise', title: '100 以内加减法', taskId: 3, content: '1. 36 + 27 = ______\n2. 82 - 45 = ______\n3. 48 + 19 - 25 = ______\n4. 比 60 少 18 的数是 ______。', answer: '1. 63\n2. 37\n3. 42\n4. 42', source: '原创练习', url: '', published: true },
  { id: 'demo-math-2', subject: '数学', type: 'exercise', title: '生活应用题', taskId: 3, content: '文具盒里有 24 支铅笔，借给同学 7 支，后来又放进 9 支。现在文具盒里有多少支铅笔？请写出算式和答案。', answer: '24 - 7 + 9 = 26（支）\n答：现在文具盒里有 26 支铅笔。', source: '原创练习', url: '', published: true },
  { id: 'demo-en-1', subject: '英语', type: 'note', title: 'My school bag 词汇卡', taskId: null, content: 'school bag — 书包\nbook — 书\npencil — 铅笔\nruler — 尺子\n句型：I have a pencil in my school bag.', source: '原创学习卡', url: '', published: true },
  { id: 'demo-en-2', subject: '英语', type: 'exercise', title: 'Read and choose', taskId: null, content: 'Choose the right word.\n1. I have a (book / red).\n2. This is my (pencil / happy).\n3. The ruler is (long / sing).', answer: '1. book\n2. pencil\n3. long', source: '原创练习', url: '', published: true },
  { id: 'demo-sh-1', subject: '综合', type: 'link', title: '沪学习官方平台', taskId: null, content: '正版数字课本、点读与同步练习需在沪学习官方平台或 App 内使用。', source: '沪学习官方网站', url: 'https://www.diyiedu.com/', published: false }
];
const state = {
  tasks: JSON.parse(localStorage.getItem('koala-demo-tasks') || 'null') || initialTasks,
  rewards: JSON.parse(localStorage.getItem('koala-demo-rewards') || 'null') || initialRewards,
  stars: Number(localStorage.getItem('koala-demo-stars') || 12),
  diamonds: Number(localStorage.getItem('koala-demo-diamonds') || 0),
  starsPerDiamond: Number(localStorage.getItem('koala-demo-stars-per-diamond') || 10),
  diamondExchanges: JSON.parse(localStorage.getItem('koala-demo-diamond-exchanges') || 'null') || [],
  redemptions: JSON.parse(localStorage.getItem('koala-demo-redemptions') || 'null') || [],
  pointLedger: JSON.parse(localStorage.getItem('koala-demo-point-ledger') || 'null') || [],
  pointResetHistory: JSON.parse(localStorage.getItem('koala-demo-point-reset-history') || 'null') || [],
  streakSettings: JSON.parse(localStorage.getItem('koala-demo-streak-settings') || 'null') || { bonus3: 3, bonus7: 7, bonus30: 30 },
  currentStreak: Number(localStorage.getItem('koala-demo-current-streak') || 2),
  streakAwardDates: JSON.parse(localStorage.getItem('koala-demo-streak-award-dates') || 'null') || [],
  historyMissions: JSON.parse(localStorage.getItem('koala-demo-history-missions') || 'null') || [],
  historyPointLedger: [],
  historyMonth: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  selectedHistoryDate: localIsoDate(),
  learningMaterials: JSON.parse(localStorage.getItem('koala-demo-learning-materials') || 'null') || initialLearningMaterials,
  learningSubject: '全部',
  learningLibraryMode: 'materials',
  editingMaterialId: null,
  parentUnlocked: false,
  editing: null,
  pendingPhotoTask: null,
  pendingPhotoFile: null,
  cloudMode: false,
  context: null,
  templates: [],
  sections: [],
  templateTasks: [],
  realtimeRefreshTimer: null,
  registerMode: false,
  openParentAfterPinSetup: false,
  quickPublishTaskId: null,
  aiLastResult: '',
  aiLastAnswer: '',
  aiLastTitle: '',
  aiLastSubject: '',
  aiLastType: 'exercise'
};
state.learningMaterials = state.learningMaterials.map(material => ({
  ...material,
  answer: material.answer ?? initialLearningMaterials.find(sample => sameId(sample.id, material.id) || sample.title === material.title)?.answer ?? '',
}));
if (!state.historyMissions.length) {
  state.historyMissions = state.tasks.map(task => ({ ...task, scheduledDate: localIsoDate(), sectionName: task.group, title: task.name }));
}
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const defaultTaskGroups = ['早晨', '放学后', '锻炼', '睡前'];
const groupIcons = { '早晨': '☀️', '放学后': '🛰️', '锻炼': '🏃', '睡前': '🌙' };

function sameId(a, b) { return String(a) === String(b); }
function findById(items, id) { return items.find(item => sameId(item.id, id)); }
const PARENT_PIN_KEY = 'koala-parent-pin-v2';
const LEGACY_PARENT_PIN_KEY = 'koala-parent-pin';
const AI_ENDPOINT_KEY = 'koala-ai-endpoint-v1';
const AI_MODEL_KEY = 'koala-ai-model-v1';
const AI_API_KEY_SESSION = 'koala-ai-api-key-v1';

function normalizeFamilyCode(value) { return String(value || '').replace(/[^0-9a-f]/gi, '').slice(0, 8).toUpperCase(); }
function formatFamilyCode(value) {
  const code = normalizeFamilyCode(value);
  return code.length > 4 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
}
function isWeakPin(pin) {
  return /^(\d)\1{3}$/.test(pin) || ['0123', '1234', '2345', '3456', '4567', '5678', '6789', '9876', '8765', '7654', '6543', '5432', '4321', '3210'].includes(pin);
}
function pinHashSalt() {
  return [...crypto.getRandomValues(new Uint8Array(16))].map(value => value.toString(16).padStart(2, '0')).join('');
}
async function hashParentPin(pin, salt) {
  const bytes = new TextEncoder().encode(`${salt}:${pin}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
}
function parentPinRecord() {
  try { return JSON.parse(localStorage.getItem(PARENT_PIN_KEY) || 'null'); }
  catch { return null; }
}
function hasParentPin() {
  const record = parentPinRecord();
  return Boolean(record?.salt && record?.hash) || /^[0-9]{4}$/.test(localStorage.getItem(LEGACY_PARENT_PIN_KEY) || '');
}
async function storeParentPin(pin) {
  const salt = pinHashSalt();
  const hash = await hashParentPin(pin, salt);
  localStorage.setItem(PARENT_PIN_KEY, JSON.stringify({ salt, hash, version: 2 }));
  localStorage.removeItem(LEGACY_PARENT_PIN_KEY);
}
async function verifyParentPin(pin) {
  const record = parentPinRecord();
  if (record?.salt && record?.hash) return (await hashParentPin(pin, record.salt)) === record.hash;
  const legacyPin = localStorage.getItem(LEGACY_PARENT_PIN_KEY);
  if (legacyPin && pin === legacyPin) { await storeParentPin(pin); return true; }
  return !state.cloudMode && pin === '2580';
}
function updateParentPinStatus() {
  const status = $('#parentPinStatus');
  const button = $('#parentPinButton');
  if (!status || !button) return;
  status.textContent = hasParentPin() ? '已设置 · 仅保护当前设备' : '未设置 · 仅保护当前设备';
  button.textContent = hasParentPin() ? '修改' : '设置';
}
function openParentPinSetup(openParentAfterSave = false) {
  state.openParentAfterPinSetup = openParentAfterSave;
  $('#newParentPin').value = '';
  $('#newParentPinConfirm').value = '';
  setAuthMessage('#parentPinResult', '');
  $('#parentPinDialog').showModal();
  setTimeout(() => $('#newParentPin').focus(), 100);
}
function selectAuthTab(tabName) {
  $$('[data-auth-tab]').forEach(button => button.classList.toggle('is-active', button.dataset.authTab === tabName));
  $$('.auth-panel').forEach(panel => panel.classList.toggle('is-active', panel.id === `${tabName}AuthForm`));
}
async function leaveChildAccount(mode) {
  const switchButton = $('#switchChildAccount');
  const exitButton = $('#exitChildAccount');
  switchButton.disabled = true;
  exitButton.disabled = true;
  try {
    await window.KoalaCloud.signOut();
    if (mode === 'switch') sessionStorage.setItem('koala-open-child-login', '1');
    else {
      sessionStorage.removeItem('koala-open-child-login');
      localStorage.removeItem('koala-family-code');
    }
    location.reload();
  } catch (error) {
    showToast(cloudErrorMessage(error));
    switchButton.disabled = false;
    exitButton.disabled = false;
  }
}
function getTaskGroups() {
  const configured = state.sections.map(section => section.name);
  const fromTasks = state.tasks.map(task => task.group);
  return [...new Set([...(configured.length ? configured : defaultTaskGroups), ...fromTasks])];
}
function getManagedTasks() { return state.cloudMode ? state.templateTasks : state.tasks; }

function selectedPublishTaskIds() {
  return $$('input[name="publish-task"]:checked', $('#publishTaskChoices')).map(input => input.value);
}
function updatePublishPreview() {
  const selectedCount = selectedPublishTaskIds().length;
  const totalCount = $$('input[name="publish-task"]', $('#publishTaskChoices')).length;
  const days = $('#publishRange').value === '仅一天' ? 1 : Math.max(1, Number($('#publishDays').value) || 1);
  $('#publishPreviewTasks').textContent = `${selectedCount} 条任务`;
  $('#publishPreviewDays').textContent = `${days} 天`;
  $('#toggleAllPublishTasks').textContent = totalCount > 0 && selectedCount === totalCount ? '取消全选' : '全选';
  $('#confirmPublish').disabled = selectedCount === 0;
}
function renderPublishTaskChoices() {
  const container = $('#publishTaskChoices');
  container.replaceChildren();
  getManagedTasks().forEach(task => {
    const label = document.createElement('label');
    label.className = 'publish-task-choice';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.name = 'publish-task';
    checkbox.value = task.id;
    checkbox.checked = true;
    checkbox.addEventListener('change', updatePublishPreview);
    const art = document.createElement('span');
    art.className = `task-art task-art--${taskVisualType(task)} task-art--compact`;
    art.setAttribute('aria-hidden', 'true');
    art.innerHTML = taskIllustrations[taskVisualType(task)];
    const copy = document.createElement('span');
    const title = document.createElement('strong');
    title.textContent = task.name;
    const meta = document.createElement('small');
    meta.textContent = `${task.group} · ⭐ ${task.stars}`;
    copy.append(title, meta);
    label.append(checkbox, art, copy);
    container.append(label);
  });
  if (!container.children.length) {
    const empty = document.createElement('p');
    empty.className = 'publish-task-empty';
    empty.textContent = '还没有可发布的任务，请先新增任务。';
    container.append(empty);
  }
  updatePublishPreview();
}

function taskVisualType(task) {
  const text = `${task.name}${task.group}`;
  if (/数学|口算|计算/.test(text)) return 'math';
  if (/英语|单词|字母/.test(text)) return 'english';
  if (/阅读|读书/.test(text)) return 'reading';
  if (/语文|写字|背诵|古诗|作文/.test(text)) return 'language';
  if (/跳绳/.test(text)) return 'jump';
  if (/运动|跑步|户外|篮球|足球|球类/.test(text)) return 'sport';
  if (/睡|明天|用品/.test(text)) return 'night';
  if (/早晨|床铺|书包|洗漱|起床/.test(text)) return 'morning';
  return 'mission';
}

const taskIllustrations = {
  morning: '<svg viewBox="0 0 64 64"><circle cx="47" cy="16" r="7" fill="#F6B94A"/><path d="M18 27h28v25H18z" fill="#6079D8"/><path d="M24 27c0-8 16-8 16 0M18 37h28M25 41v7M39 41v7" fill="none" stroke="#F7F8FF" stroke-width="3" stroke-linecap="round"/><path d="M12 18h13" stroke="#A6B4EA" stroke-width="3" stroke-linecap="round"/></svg>',
  language: '<svg viewBox="0 0 64 64"><path d="M12 18c9-3 16-1 20 4v31c-5-5-12-7-20-4z" fill="#FFFFFF" stroke="#6079D8" stroke-width="2.5"/><path d="M52 18c-9-3-16-1-20 4v31c5-5 12-7 20-4z" fill="#F1F3FF" stroke="#6079D8" stroke-width="2.5"/><path d="M18 29h8M18 35h8M38 29h8M38 35h8" stroke="#A6B4EA" stroke-width="2.5" stroke-linecap="round"/><path d="M43 12l7 7-15 15-8 2 2-8z" fill="#F6B94A" stroke="#9A6C1B" stroke-width="2"/></svg>',
  math: '<svg viewBox="0 0 64 64"><rect x="13" y="10" width="38" height="45" rx="7" fill="#FFFFFF" stroke="#6079D8" stroke-width="3"/><rect x="19" y="16" width="26" height="9" rx="3" fill="#DDE4FF"/><circle cx="22" cy="34" r="3" fill="#F6B94A"/><circle cx="32" cy="34" r="3" fill="#86C6AA"/><circle cx="42" cy="34" r="3" fill="#A6B4EA"/><path d="M20 44h5M30 44h5M40 44h5" stroke="#6079D8" stroke-width="3" stroke-linecap="round"/></svg>',
  english: '<svg viewBox="0 0 64 64"><rect x="10" y="15" width="44" height="35" rx="8" fill="#FFFFFF" stroke="#6079D8" stroke-width="3"/><path d="M19 41l7-18 7 18M22 34h8" fill="none" stroke="#6079D8" stroke-width="3" stroke-linecap="round"/><path d="M39 24v17m0-9c9-3 9 10 0 7" fill="none" stroke="#F6B94A" stroke-width="3" stroke-linecap="round"/></svg>',
  reading: '<svg viewBox="0 0 64 64"><path d="M10 19c10-3 18-1 22 6v29c-5-6-13-8-22-5z" fill="#FFFFFF" stroke="#6079D8" stroke-width="2.5"/><path d="M54 19c-10-3-18-1-22 6v29c5-6 13-8 22-5z" fill="#F1F3FF" stroke="#6079D8" stroke-width="2.5"/><path d="M21 14l2 4 5 1-4 3 1 5-4-3-5 3 1-5-4-3 5-1z" fill="#F6B94A"/></svg>',
  jump: '<svg viewBox="0 0 64 64"><path d="M16 42C5 19 18 10 32 10s27 9 16 32" fill="none" stroke="#6079D8" stroke-width="3" stroke-linecap="round"/><rect x="11" y="39" width="9" height="16" rx="4" fill="#F6B94A" transform="rotate(-12 15 47)"/><rect x="44" y="39" width="9" height="16" rx="4" fill="#F6B94A" transform="rotate(12 49 47)"/><path d="M25 30l7-7 7 7M32 23v20" fill="none" stroke="#86C6AA" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  sport: '<svg viewBox="0 0 64 64"><circle cx="42" cy="21" r="8" fill="#F6B94A"/><path d="M28 22l10 8-5 9 11 10M31 38l-12 9M31 30l-11 3" fill="none" stroke="#6079D8" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="25" cy="16" r="5" fill="#6079D8"/><path d="M10 54h44" stroke="#A6B4EA" stroke-width="3" stroke-linecap="round"/></svg>',
  night: '<svg viewBox="0 0 64 64"><path d="M42 11c-12 3-16 19-7 28 6 6 15 6 21 1-3 11-15 17-26 12-12-5-17-19-11-30 4-8 14-13 23-11z" fill="#6079D8"/><path d="M13 42h22v14H13z" fill="#FFFFFF" stroke="#A6B4EA" stroke-width="2.5"/><path d="M17 47h14" stroke="#F6B94A" stroke-width="3" stroke-linecap="round"/></svg>',
  mission: '<svg viewBox="0 0 64 64"><path d="M38 10c10 5 15 14 14 25L35 52 18 35c-1-11 4-20 14-25z" fill="#6079D8"/><circle cx="37" cy="25" r="6" fill="#E9EDFF"/><path d="M19 34l-8 6 12 3M36 51l-6 7-3-12" fill="#F6B94A"/><path d="M17 49l-6 6M23 53l-3 6" stroke="#A6B4EA" stroke-width="3" stroke-linecap="round"/></svg>'
};

function taskArt(task, compact = false) {
  const type = taskVisualType(task);
  return `<span class="task-art task-art--${type}${compact ? ' task-art--compact' : ''}" aria-hidden="true">${taskIllustrations[type]}</span>`;
}
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
}
function taskSubject(task) {
  const text = `${task.name || ''}${task.group || ''}`;
  if (/数学|口算|计算|应用题/.test(text)) return '数学';
  if (/英语|单词|字母|口语/.test(text)) return '英语';
  if (/语文|阅读|写字|背诵|古诗|作文/.test(text)) return '语文';
  return '';
}
function taskLearningKey(task) { return task.templateTaskId || task.id; }
function taskLearningMaterials(task) {
  const key = taskLearningKey(task);
  return state.learningMaterials.filter(material => material.published && material.taskId && sameId(material.taskId, key));
}
function materialTypeLabel(type) { return ({ exercise: '练习题', note: '知识卡', link: '网络资料' })[type] || '学习资料'; }

function save() {
  if (state.cloudMode) return;
  localStorage.setItem('koala-demo-tasks', JSON.stringify(state.tasks));
  localStorage.setItem('koala-demo-rewards', JSON.stringify(state.rewards));
  localStorage.setItem('koala-demo-stars', String(state.stars));
  localStorage.setItem('koala-demo-diamonds', String(state.diamonds));
  localStorage.setItem('koala-demo-stars-per-diamond', String(state.starsPerDiamond));
  localStorage.setItem('koala-demo-diamond-exchanges', JSON.stringify(state.diamondExchanges));
  localStorage.setItem('koala-demo-redemptions', JSON.stringify(state.redemptions));
  localStorage.setItem('koala-demo-point-ledger', JSON.stringify(state.pointLedger));
  localStorage.setItem('koala-demo-point-reset-history', JSON.stringify(state.pointResetHistory));
  localStorage.setItem('koala-demo-streak-settings', JSON.stringify(state.streakSettings));
  localStorage.setItem('koala-demo-current-streak', String(state.currentStreak));
  localStorage.setItem('koala-demo-streak-award-dates', JSON.stringify(state.streakAwardDates));
  localStorage.setItem('koala-demo-history-missions', JSON.stringify(state.historyMissions));
  localStorage.setItem('koala-demo-learning-materials', JSON.stringify(state.learningMaterials));
}
function statusText(task) {
  if (task.status === 'approved') return '家长已确认';
  if (task.status === 'submitted') return '等待家长确认';
  return task.photo ? '完成后需上传照片' : '完成后提交家长确认';
}
function renderTasks() {
  $('#taskGroups').innerHTML = getTaskGroups().map(group => {
    const tasks = state.tasks.filter(t => t.group === group);
    if (!tasks.length) return '';
    return `<section class="task-group"><div class="task-group__title"><div><span>${groupIcons[group] || '🪐'}</span><h3>${escapeHtml(group)}</h3></div><span>${tasks.length} 项</span></div>${tasks.map(task => {
      const materials = taskLearningMaterials(task);
      return `<div class="task-item is-${task.status}" data-task-id="${task.id}">${taskArt(task)}<button class="task-item__check" type="button" aria-label="提交${escapeHtml(task.name)}">${task.status === 'approved' ? '✓' : task.status === 'submitted' ? '…' : ''}</button><div class="task-item__content"><strong>${escapeHtml(task.name)}</strong><span>${statusText(task)}</span>${materials.length ? `<button class="task-learning-link" type="button" data-open-learning="${task.id}">📘 查看 ${materials.length} 份题目与资料</button>` : ''}</div><span class="task-item__stars">⭐ ${task.stars}</span></div>`;
    }).join('')}</section>`;
  }).join('');
  $$('.task-item__check').forEach(button => button.addEventListener('click', handleTaskSubmit));
  $$('[data-open-learning]').forEach(button => button.onclick = () => openLearningViewer(button.dataset.openLearning));
  renderSummary();
}
function renderRewards() {
  $('#childRewards').innerHTML = state.rewards.map(reward => {
    const pending = state.redemptions.some(item => item.status === 'pending' && sameId(item.rewardId, reward.id));
    return `<article class="reward-card"><span class="reward-card__icon">${reward.icon}</span><strong>${reward.name}</strong><span>⭐ ${reward.cost}</span><button type="button" data-redeem="${reward.id}" ${pending ? 'disabled' : ''}>${pending ? '等待家长确认' : '申请兑换'}</button></article>`;
  }).join('');
  $('[data-show-rewards]').onclick = () => showToast('已显示全部自定义奖励');
  $$('[data-redeem]').forEach(button => button.onclick = async () => {
    const reward = findById(state.rewards, button.dataset.redeem);
    if (state.stars < reward.cost) return showToast(`还差 ${reward.cost - state.stars} 颗星星，加油！`);
    if (state.cloudMode) {
      if (state.context?.member_role !== 'child') return showToast('请在孩子设备登录后申请兑换');
      try { await window.KoalaCloud.requestRedemption(reward.id); await loadCloudData(); }
      catch (error) { return showToast(cloudErrorMessage(error)); }
    } else { state.redemptions.push({ id: Date.now(), rewardId: reward.id, rewardTitle: reward.name, cost: reward.cost, status: 'pending', requestedAt: new Date().toISOString() }); renderAll(); }
    showToast('兑换申请已发送，等待家长确认');
  });
}
function renderReview() {
  const pending = state.tasks.filter(t => t.status === 'submitted');
  $('#reviewList').innerHTML = pending.length ? pending.map(task => `<article class="review-item"><div class="review-item__main">${task.evidencePath ? `<button class="review-item__photo" type="button" data-evidence="${task.evidencePath}" aria-label="查看${task.name}的照片">📷</button>` : `<div class="review-item__photo">${task.photo ? '📷' : '✅'}</div>`}<div><strong>${task.name}</strong><span>${task.group} · ${task.photo ? '已提交照片' : '无需照片'} · ⭐ ${task.stars}</span></div></div><div class="review-item__actions"><button class="approve" type="button" data-approve="${task.id}">确认</button><button class="reject" type="button" data-reject="${task.id}">退回</button></div></article>`).join('') : '<div class="demo-note"><strong>暂时没有待确认任务</strong><p>孩子提交完成后会显示在这里。</p></div>';
  $$('[data-approve]').forEach(button => button.onclick = () => approveTask(button.dataset.approve));
  $$('[data-reject]').forEach(button => button.onclick = () => rejectTask(button.dataset.reject));
  $$('[data-evidence]').forEach(button => button.onclick = async () => {
    try { window.open(await window.KoalaCloud.getEvidenceUrl(button.dataset.evidence), '_blank', 'noopener'); }
    catch (error) { showToast(cloudErrorMessage(error)); }
  });
  renderRedemptionReviews();
  renderDiamondExchangeReviews();
  renderSummary();
}
function pendingRedemptions() { return state.redemptions.filter(item => item.status === 'pending'); }
function renderRedemptionReviews() {
  const pending = pendingRedemptions();
  $('#rewardReviewBadge').textContent = `${pending.length} 项`;
  $('#rewardReviewList').innerHTML = pending.length ? pending.map(item => `<article class="review-item"><div class="review-item__main"><div class="review-item__photo">🎁</div><div><strong>${escapeHtml(item.rewardTitle)}</strong><span>需要 ⭐ ${item.cost} · 等待家长确认</span></div></div><div class="review-item__actions"><button class="approve" type="button" data-approve-redemption="${item.id}">确认兑现</button><button class="reject" type="button" data-reject-redemption="${item.id}">拒绝</button></div></article>`).join('') : '<div class="demo-note"><strong>暂无奖励兑换申请</strong><p>孩子申请自定义奖励后会显示在这里。</p></div>';
  $$('[data-approve-redemption]').forEach(button => button.onclick = () => reviewRewardRedemption(button.dataset.approveRedemption, true));
  $$('[data-reject-redemption]').forEach(button => button.onclick = () => reviewRewardRedemption(button.dataset.rejectRedemption, false));
}
function pendingDiamondExchanges() { return state.diamondExchanges.filter(exchange => exchange.status === 'pending'); }
function renderDiamondExchangeReviews() {
  const pending = pendingDiamondExchanges();
  $('#exchangeReviewBadge').textContent = `${pending.length} 项`;
  $('#exchangeReviewList').innerHTML = pending.length ? pending.map(exchange => `<article class="review-item"><div class="review-item__main"><div class="review-item__photo">💎</div><div><strong>兑换 ${exchange.diamondsReceived} 颗钻石</strong><span>需要 ⭐ ${exchange.starsSpent} · 等待家长确认</span></div></div><div class="review-item__actions"><button class="approve" type="button" data-approve-exchange="${exchange.id}">确认</button><button class="reject" type="button" data-reject-exchange="${exchange.id}">拒绝</button></div></article>`).join('') : '<div class="demo-note"><strong>暂无钻石兑换申请</strong><p>孩子申请后会显示在这里。</p></div>';
  $$('[data-approve-exchange]').forEach(button => button.onclick = () => reviewDiamondExchange(button.dataset.approveExchange, true));
  $$('[data-reject-exchange]').forEach(button => button.onclick = () => reviewDiamondExchange(button.dataset.rejectExchange, false));
}
function renderManageLists() {
  $('#manageTaskList').innerHTML = getManagedTasks().map(task => `<article class="manage-item"><button class="manage-item__main manage-item__main--publish" type="button" data-quick-publish="${task.id}" aria-label="选择${task.name}的发布日期">${taskArt(task, true)}<div><strong>${task.name}</strong><span>${task.group} · ⭐ ${task.stars} · ${task.photo ? '必须照片' : '无需照片'}</span></div></button><button class="edit" type="button" data-edit-task="${task.id}">编辑</button></article>`).join('');
  $('#manageRewardList').innerHTML = state.rewards.map(reward => `<article class="manage-item"><div><strong>${reward.icon} ${reward.name}</strong><span>需要 ⭐ ${reward.cost} · 已启用</span></div><button class="edit" type="button" data-edit-reward="${reward.id}">编辑</button></article>`).join('');
  $$('[data-edit-task]').forEach(button => button.onclick = () => openEditor('task', button.dataset.editTask));
  $$('[data-quick-publish]').forEach(button => button.onclick = () => openQuickPublishTask(button.dataset.quickPublish));
  $$('[data-edit-reward]').forEach(button => button.onclick = () => openEditor('reward', button.dataset.editReward));
}
function renderLearningMaterials() {
  $$('[data-learning-library]').forEach(button => button.classList.toggle('is-active', button.dataset.learningLibrary === state.learningLibraryMode));
  $$('[data-learning-subject]').forEach(button => button.classList.toggle('is-active', button.dataset.learningSubject === state.learningSubject));
  const materials = state.learningMaterials.filter(material =>
    (state.learningSubject === '全部' || material.subject === state.learningSubject)
    && (state.learningLibraryMode !== 'answers' || material.answer?.trim())
  );
  $('#learningMaterialList').innerHTML = materials.length ? materials.map(material => {
    const task = material.taskId ? findById(getManagedTasks(), material.taskId) : null;
    const showingAnswer = state.learningLibraryMode === 'answers';
    const preview = showingAnswer ? material.answer : material.content;
    return `<article class="learning-material-card ${showingAnswer ? 'is-answer-card' : ''}"><div class="learning-material-card__subject">${showingAnswer ? '答' : material.subject === '语文' ? '语' : material.subject === '数学' ? '数' : material.subject === '英语' ? '英' : '资'}</div><div class="learning-material-card__copy"><div><span class="material-type">${showingAnswer ? '家长答案' : materialTypeLabel(material.type)}</span>${showingAnswer ? '<span class="material-status answer-private-badge">仅家长可见</span>' : `<span class="material-status ${material.published ? 'is-published' : ''}">${material.published ? '已发布' : '仅家长可见'}</span>${material.answer?.trim() ? '<span class="material-status has-answer-badge">有答案</span>' : ''}`}</div><strong>${escapeHtml(material.title)}</strong><p>${escapeHtml(preview || '').replaceAll('\n', '<br>')}</p><small>${showingAnswer ? `对应${material.subject}${materialTypeLabel(material.type)}` : `来源：${escapeHtml(material.source || '家长自建')} · ${task ? `关联“${escapeHtml(task.name)}”` : '未关联任务'}`}</small></div><button class="edit" type="button" data-edit-material="${material.id}">编辑</button></article>`;
  }).join('') : state.learningLibraryMode === 'answers'
    ? '<div class="demo-note"><strong>这个学科还没有答案</strong><p>AI 生成练习或家长编辑资料时，可以把答案单独保存到这里。</p></div>'
    : '<div class="demo-note"><strong>这个学科还没有资料</strong><p>可以新增原创题目、知识卡或公开网页链接。</p></div>';
  $$('[data-edit-material]').forEach(button => button.onclick = () => openLearningEditor(button.dataset.editMaterial));
}
function openLearningViewer(taskId) {
  const task = findById(state.tasks, taskId);
  if (!task) return showToast('没有找到这个任务');
  const materials = taskLearningMaterials(task);
  if (!materials.length) return showToast('家长还没有发布学习资料');
  $('#learningViewerSubject').textContent = taskSubject(task) || '任务学习资料';
  $('#learningViewerTitle').textContent = task.name;
  const container = $('#learningViewerContent');
  container.replaceChildren();
  materials.forEach((material, index) => {
    const card = document.createElement('article');
    card.className = 'learning-viewer-card';
    const eyebrow = document.createElement('span');
    eyebrow.className = 'eyebrow';
    eyebrow.textContent = `${index + 1}. ${materialTypeLabel(material.type)} · ${material.source || '家长自建'}`;
    const title = document.createElement('h3');
    title.textContent = material.title;
    const content = document.createElement('div');
    content.className = 'learning-viewer-card__content';
    content.textContent = material.content;
    card.append(eyebrow, title, content);
    if (material.url) {
      const link = document.createElement('a');
      link.className = 'secondary-button learning-source-link';
      link.href = material.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = '打开官方或公开来源 ↗';
      card.append(link);
    }
    container.append(card);
  });
  showDialogAtTop($('#learningViewerDialog'));
}
function openLearningEditor(id = null) {
  state.editingMaterialId = id;
  const material = id ? findById(state.learningMaterials, id) : null;
  $('#learningEditorEyebrow').textContent = id ? '编辑' : '新增';
  $('#learningEditorTitle').textContent = id ? '编辑学习资料' : '新增学习资料';
  $('#learningSubject').value = material?.subject || (state.learningSubject === '全部' ? '语文' : state.learningSubject);
  $('#learningType').value = material?.type || 'exercise';
  $('#learningTitle').value = material?.title || '';
  $('#learningContent').value = material?.content || '';
  $('#learningAnswer').value = material?.answer || '';
  $('#learningSource').value = material?.source || '家长自建';
  $('#learningUrl').value = material?.url || '';
  $('#learningPublished').checked = material?.published ?? true;
  $('#learningTask').innerHTML = '<option value="">暂不关联任务</option>' + getManagedTasks().map(task => `<option value="${task.id}">${escapeHtml(task.name)} · ${escapeHtml(task.group)}</option>`).join('');
  $('#learningTask').value = material?.taskId || '';
  $('#learningDeleteArea').hidden = !id;
  showDialogAtTop($('#learningEditorDialog'));
}
function openAiAssistant() {
  const useCloudAssistant = state.cloudMode;
  $('#aiCloudConfigCard').hidden = !useCloudAssistant;
  $('#aiManualConfigCard').hidden = useCloudAssistant;
  $('#aiEndpoint').value = localStorage.getItem(AI_ENDPOINT_KEY) || '';
  $('#aiModel').value = localStorage.getItem(AI_MODEL_KEY) || '';
  $('#aiApiKey').value = sessionStorage.getItem(AI_API_KEY_SESSION) || '';
  $('#aiApiKey').type = 'password';
  $('#toggleAiKeyVisibility').textContent = '显示';
  $('#toggleAiKeyVisibility').setAttribute('aria-pressed', 'false');
  if (state.aiLastResult) {
    $('#aiResultTitle').textContent = state.aiLastTitle;
    $('#aiResultContent').textContent = state.aiLastResult;
    $('#aiResultAnswer').textContent = state.aiLastAnswer;
    $('#aiResultAnswerSection').hidden = !state.aiLastAnswer;
    $('#aiResult').hidden = false;
  } else $('#aiResult').hidden = true;
  setAuthMessage('#aiAssistantStatus', useCloudAssistant
    ? 'AI 接口已由云端安全保管；生成内容先预览，再决定是否保存。'
    : 'Demo 模式需要临时填写接口信息；生成内容先预览，再决定是否保存。');
  showDialogAtTop($('#aiAssistantDialog'));
}
function normalizeAiEndpoint(value) {
  const url = new URL(String(value || '').trim());
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('API 地址必须以 http:// 或 https:// 开头');
  const pathname = url.pathname.replace(/\/+$/, '');
  url.pathname = pathname || '/';
  if (!pathname || pathname === '/') url.pathname = '/v1/chat/completions';
  else if (/\/v1$/i.test(pathname)) url.pathname = `${pathname}/chat/completions`;
  return url.toString();
}
function aiResponseText(data) {
  if (typeof data?.output_text === 'string') return data.output_text.trim();
  const chatContent = data?.choices?.[0]?.message?.content;
  if (typeof chatContent === 'string') return chatContent.trim();
  if (Array.isArray(chatContent)) {
    const text = chatContent.map(item => typeof item === 'string' ? item : item?.text || item?.content || '').join('\n').trim();
    if (text) return text;
  }
  if (typeof data?.choices?.[0]?.text === 'string') return data.choices[0].text.trim();
  if (Array.isArray(data?.output)) {
    const text = data.output.flatMap(item => item?.content || []).map(item => item?.text || '').join('\n').trim();
    if (text) return text;
  }
  return '';
}
function aiMaterialParts(text, subject) {
  const rawText = String(text || '').trim();
  const readableText = !rawText.includes('\n') && rawText.includes('\\n') ? rawText.replace(/\\n/g, '\n') : rawText;
  const lines = readableText.split(/\r?\n/);
  const titleMatch = lines[0]?.match(/^\s*(?:#{1,3}\s*)?(?:\*\*)?(?:标题|题目)\s*[：:]\s*(.+?)(?:\*\*)?\s*$/);
  const title = (titleMatch?.[1] || `${subject} AI 学习资料`).replace(/^[《“"]|[》”"]$/g, '').trim().slice(0, 60);
  const bodyLines = titleMatch ? lines.slice(1) : lines;
  const answerMarker = /^\s*(?:#{1,3}\s*)?(?:\*\*)?(?:【|\[)?(?:家长参考答案|参考答案|标准答案|答案)(?:】|\])?(?:\*\*)?\s*[：:]?\s*(.*)$/;
  const answerIndex = bodyLines.findIndex(line => answerMarker.test(line));
  let contentLines = answerIndex >= 0 ? bodyLines.slice(0, answerIndex) : bodyLines;
  const answerLines = answerIndex >= 0 ? bodyLines.slice(answerIndex) : [];
  if (/^\s*(?:#{1,3}\s*)?(?:\*\*)?(?:【|\[)?(?:题目|题目内容|练习题)(?:】|\])?(?:\*\*)?\s*[：:]?\s*$/.test(contentLines[0] || '')) contentLines = contentLines.slice(1);
  let answer = '';
  if (answerLines.length) {
    const firstAnswer = answerLines[0].match(answerMarker)?.[1] || '';
    answer = [firstAnswer, ...answerLines.slice(1)].join('\n').trim();
  }
  return { title, content: contentLines.join('\n').trim(), answer };
}
function aiSystemPrompt(subject, type) {
  return `你是一名严谨的小学学习助手，帮助家长为上海小学二年级学生制作${subject}${type === 'exercise' ? '原创练习题' : '原创知识卡'}。内容应符合儿童理解水平，表达清楚，难度适中，不超纲。不得声称复制教材、题库或付费学习平台的原文。第一行必须写“标题：简短标题”。${type === 'exercise' ? '接着单独写“【题目】”并列出全部题目；最后单独写“【家长参考答案】”并列出对应答案和必要的简短解析。题目区域绝不能出现答案，答案区域也不要重复完整题目。' : '接着写“【题目】”并给出知识卡内容；如果包含自测题，再在最后单独写“【家长参考答案】”，否则不要输出答案区域。'}只输出可直接给家长审阅的学习内容。`;
}
function aiUserPrompt(subject, type, request) {
  return `学生范围：上海小学二年级\n学科：${subject}\n资料类型：${type === 'exercise' ? '练习题' : '知识卡'}\n家长要求：${request}`;
}
async function generateAiMaterial() {
  const useCloudAssistant = state.cloudMode;
  const endpointInput = $('#aiEndpoint').value.trim();
  const apiKey = $('#aiApiKey').value.trim();
  const model = $('#aiModel').value.trim();
  const subject = $('#aiSubject').value;
  const type = $('#aiMaterialType').value;
  const request = $('#aiPrompt').value.trim();
  if (!useCloudAssistant && !endpointInput) return setAuthMessage('#aiAssistantStatus', '请填写 API 地址。', 'error');
  if (!useCloudAssistant && !model) return setAuthMessage('#aiAssistantStatus', '请填写接口对应的模型名称。', 'error');
  if (!useCloudAssistant && !apiKey) return setAuthMessage('#aiAssistantStatus', '请填写 API Key。', 'error');
  if (!request) return setAuthMessage('#aiAssistantStatus', '请告诉 AI 想生成什么内容。', 'error');
  let endpoint = '';
  if (!useCloudAssistant) {
    try { endpoint = normalizeAiEndpoint(endpointInput); }
    catch (error) { return setAuthMessage('#aiAssistantStatus', error.message, 'error'); }

    localStorage.setItem(AI_ENDPOINT_KEY, endpointInput);
    localStorage.setItem(AI_MODEL_KEY, model);
    sessionStorage.setItem(AI_API_KEY_SESSION, apiKey);
  }
  const systemPrompt = aiSystemPrompt(subject, type);
  const userPrompt = aiUserPrompt(subject, type, request);
  const isResponsesApi = /\/responses\/?(?:\?|$)/i.test(endpoint);
  const payload = isResponsesApi
    ? { model, instructions: systemPrompt, input: userPrompt }
    : { model, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }] };
  const button = $('#generateAiMaterial');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);
  button.disabled = true;
  button.textContent = 'AI 正在生成…';
  $('#aiResult').hidden = true;
  setAuthMessage('#aiAssistantStatus', useCloudAssistant ? '正在通过安全云端连接 AI，请稍候…' : '正在连接你填写的 AI 接口，请稍候…');
  try {
    let result = '';
    if (useCloudAssistant) {
      result = await window.KoalaCloud.generateAiMaterial({ subject, materialType: type, request });
    } else {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      const raw = await response.text();
      let data = null;
      try { data = raw ? JSON.parse(raw) : {}; } catch { data = {}; }
      if (!response.ok) {
        const detail = String(data?.error?.message || data?.message || `接口返回 ${response.status}`).slice(0, 180);
        throw new Error(detail);
      }
      result = aiResponseText(data);
    }
    if (!result) throw new Error('接口已响应，但没有找到可显示的文字内容，请检查接口格式。');
    const parts = aiMaterialParts(result, subject);
    state.aiLastResult = parts.content;
    state.aiLastAnswer = parts.answer;
    state.aiLastTitle = parts.title;
    state.aiLastSubject = subject;
    state.aiLastType = type;
    $('#aiResultTitle').textContent = parts.title;
    $('#aiResultContent').textContent = parts.content;
    $('#aiResultAnswer').textContent = parts.answer;
    $('#aiResultAnswerSection').hidden = !parts.answer;
    $('#aiResult').hidden = false;
    setAuthMessage('#aiAssistantStatus', parts.answer ? '生成完成，题目和答案已自动分开。请家长分别检查。' : '生成完成。当前内容没有单独答案，请家长检查。', 'success');
    $('#aiResult').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } catch (error) {
    const message = error.name === 'AbortError'
      ? '请求超过 60 秒，请检查接口地址或稍后重试。'
      : error instanceof TypeError && !useCloudAssistant
        ? '无法从网页连接这个接口。请检查地址，并确认接口允许浏览器跨域访问（CORS）。'
        : `调用失败：${cloudErrorMessage(error)}`;
    setAuthMessage('#aiAssistantStatus', message, 'error');
  } finally {
    clearTimeout(timeout);
    button.disabled = false;
    button.textContent = '✨ 开始生成';
  }
}
function useAiResultAsMaterial() {
  if (!state.aiLastResult) return showToast('请先生成并检查内容', 'error');
  const subject = state.aiLastSubject || $('#aiSubject').value;
  const type = state.aiLastType || $('#aiMaterialType').value;
  const wasTruncated = state.aiLastResult.length > 3000;
  const answerWasTruncated = state.aiLastAnswer.length > 3000;
  $('#aiAssistantDialog').close();
  openLearningEditor();
  $('#learningSubject').value = subject;
  $('#learningType').value = type;
  $('#learningTitle').value = state.aiLastTitle || `${subject} AI 学习资料`;
  $('#learningContent').value = state.aiLastResult.slice(0, 3000);
  $('#learningAnswer').value = state.aiLastAnswer.slice(0, 3000);
  $('#learningSource').value = 'AI 生成（家长审核）';
  $('#learningUrl').value = '';
  $('#learningPublished').checked = false;
  showToast(wasTruncated || answerWasTruncated ? '内容较长，已截取前 3000 字，请家长继续编辑' : '题目和答案已分开，默认仅家长可见');
}
function setQuickAiPrompt(kind) {
  const subject = $('#aiSubject').value;
  const prompts = {
    '基础练习': {
      '语文': '生成 5 道二年级语文基础练习，包含词语搭配、句子表达和一题短阅读，难度循序渐进。',
      '数学': '生成 5 道 100 以内加减法和生活应用题，难度循序渐进，要求写出家长参考答案。',
      '英语': '生成 5 道适合二年级的基础英语练习，包含常用单词、简单句型和选择题。',
    },
    '错题讲解': {
      '语文': '制作一份家长可填写错题的语文讲解模板，包括易错原因、正确思路、相似练习。',
      '数学': '制作一份家长可填写错题的数学讲解模板，包括审题、分步思路、验算和相似练习。',
      '英语': '制作一份家长可填写错题的英语讲解模板，包括词义、句型、错误原因和相似练习。',
    },
    '知识卡片': {
      '语文': '制作一张二年级语文知识卡，用简短规则和例子讲清一个常用语言知识点。',
      '数学': '制作一张二年级数学知识卡，用步骤和例子讲清一个 100 以内计算知识点。',
      '英语': '制作一张二年级英语知识卡，包含 6 个常用词和 2 个简单例句。',
    },
  };
  $('#aiMaterialType').value = kind === '知识卡片' ? 'note' : 'exercise';
  $('#aiPrompt').value = prompts[kind]?.[subject] || '';
  $('#aiPrompt').focus();
}
async function saveLearningMaterial() {
  const id = state.editingMaterialId;
  const title = $('#learningTitle').value.trim();
  const content = $('#learningContent').value.trim();
  const answer = $('#learningAnswer').value.trim();
  const type = $('#learningType').value;
  const url = $('#learningUrl').value.trim();
  if (!title) return showToast('请填写资料标题', 'error');
  if (!content) return showToast('请填写题目或资料内容', 'error');
  if (type === 'link' && !url) return showToast('网络资料需要填写公开网页链接', 'error');
  if (url) {
    try { const parsed = new URL(url); if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('invalid'); }
    catch { return showToast('请输入正确的 http 或 https 网页链接', 'error'); }
  }
  const material = {
    id,
    subject: $('#learningSubject').value,
    type,
    title,
    taskId: $('#learningTask').value || null,
    content,
    answer,
    source: $('#learningSource').value.trim() || '家长自建',
    url,
    published: $('#learningPublished').checked,
  };
  const button = $('#saveLearningMaterial');
  button.disabled = true;
  try {
    if (state.cloudMode) {
      await window.KoalaCloud.saveLearningMaterial(material);
      $('#learningEditorDialog').close();
      await loadCloudData();
    } else {
      const existing = id ? findById(state.learningMaterials, id) : null;
      if (existing) Object.assign(existing, material);
      else state.learningMaterials.push({ ...material, id: `demo-material-${Date.now()}` });
      $('#learningEditorDialog').close();
      renderAll();
    }
    showToast('学习资料已保存', 'success');
  } catch (error) { showToast(cloudErrorMessage(error), 'error'); }
  finally { button.disabled = false; }
}
async function deleteLearningMaterial() {
  const id = state.editingMaterialId;
  const material = findById(state.learningMaterials, id);
  if (!material || !window.confirm(`确定删除“${material.title}”吗？`)) return;
  try {
    if (state.cloudMode) {
      await window.KoalaCloud.deleteLearningMaterial(id);
      $('#learningEditorDialog').close();
      await loadCloudData();
    } else {
      state.learningMaterials = state.learningMaterials.filter(item => !sameId(item.id, id));
      $('#learningEditorDialog').close();
      renderAll();
    }
    showToast('学习资料已删除', 'success');
  } catch (error) { showToast(cloudErrorMessage(error), 'error'); }
}
function openQuickPublishTask(taskId) {
  const task = findById(getManagedTasks(), taskId);
  if (!task) return showToast('没有找到这个任务');
  if (!state.cloudMode) return showToast('当前是本机 Demo，无法同步到孩子设备');
  if (state.context?.member_role !== 'parent') return showToast('只有家长可以发布任务');
  state.quickPublishTaskId = task.id;
  $('#quickPublishTaskName').textContent = task.name;
  $('#quickPublishDate').value = localIsoDate();
  $('#quickPublishDays').value = 1;
  setAuthMessage('#quickPublishMessage', '将发布到今天。');
  showDialogAtTop($('#quickPublishDialog'));
}
async function confirmQuickPublish() {
  const task = findById(getManagedTasks(), state.quickPublishTaskId);
  if (!task) return setAuthMessage('#quickPublishMessage', '没有找到这个任务', 'error');
  const scheduledDate = $('#quickPublishDate').value;
  const days = Number($('#quickPublishDays').value || 1);
  if (!scheduledDate) return setAuthMessage('#quickPublishMessage', '请选择开始日期', 'error');
  if (!Number.isInteger(days) || days < 1 || days > 30) return setAuthMessage('#quickPublishMessage', '连续天数应为 1 到 30 天', 'error');
  const button = $('#confirmQuickPublish');
  button.disabled = true;
  setAuthMessage('#quickPublishMessage', '正在发布…');
  try {
    const created = await window.KoalaCloud.publishTemplateTask({ templateTaskId: task.id, scheduledDate, days });
    if (!created) return setAuthMessage('#quickPublishMessage', '所选日期已经发布过这个任务', 'error');
    $('#quickPublishDialog').close();
    await loadCloudData();
    showToast(`“${task.name}”已发布 ${created} 天`);
  } catch (error) { setAuthMessage('#quickPublishMessage', cloudErrorMessage(error), 'error'); }
  finally { button.disabled = false; }
}
function renderSummary() {
  const pendingTasks = state.tasks.filter(t => t.status === 'submitted').length;
  const pendingExchanges = pendingDiamondExchanges().length;
  const pendingRewards = pendingRedemptions().length;
  const approved = state.tasks.filter(t => t.status === 'approved').length;
  $('#starBalance').textContent = state.stars;
  $('#diamondBalance').textContent = state.diamonds;
  $('#parentStars').textContent = state.stars;
  $('#parentDiamonds').textContent = state.diamonds;
  $('#resetStarsBalance').textContent = state.stars;
  $('#resetDiamondsBalance').textContent = state.diamonds;
  $('#doneCount').textContent = `${approved}/${state.tasks.length}`;
  $('#pendingCount').textContent = pendingTasks + pendingExchanges + pendingRewards;
  $('#approvedCount').textContent = approved;
  $('#reviewBadge').textContent = `${pendingTasks} 项`;
  $('#childExchangeRate').textContent = state.starsPerDiamond;
  $('#starsPerDiamond').value = state.starsPerDiamond;
  $('#currentStreak').textContent = state.currentStreak;
  $('#growthStreak').textContent = state.currentStreak;
  $('#childStreak').textContent = state.currentStreak;
  $('#streakBonus3').value = state.streakSettings.bonus3;
  $('#streakBonus7').value = state.streakSettings.bonus7;
  $('#streakBonus30').value = state.streakSettings.bonus30;
  const nextMilestone = [3, 7, 30].find(value => value > state.currentStreak);
  $('#streakNextHint').textContent = nextMilestone ? `再完成 ${nextMilestone - state.currentStreak} 个打卡日，可获得 ${state.streakSettings[`bonus${nextMilestone}`]} 颗星星。` : '已完成 30 天里程碑，继续保持好习惯！';
  $('#childStreakHint').textContent = nextMilestone ? `再 ${nextMilestone - state.currentStreak} 天奖励 ⭐ ${state.streakSettings[`bonus${nextMilestone}`]}` : '继续保持好习惯！';
  $('#childExchangePending').textContent = pendingExchanges ? `已有 ${pendingExchanges} 个申请等待家长确认` : '由家长设置兑换比例，确认后才会生效';
  $('#missionSummary').textContent = `今天有 ${state.tasks.length} 个任务，完成后请爸爸妈妈确认。`;
}
function renderAll() { renderTasks(); renderRewards(); renderReview(); renderManageLists(); renderLearningMaterials(); renderPointLedger(); renderGrowthPanel(); save(); }

function handleTaskSubmit(event) {
  const task = findById(state.tasks, event.currentTarget.closest('[data-task-id]').dataset.taskId);
  if (state.cloudMode && state.context?.member_role !== 'child') return showToast('请在孩子设备登录后提交任务');
  if (task.status === 'approved') return showToast('这个任务已经由家长确认啦');
  if (task.status === 'submitted') return showToast('已经提交，正在等待家长确认');
  if (task.photo) {
    state.pendingPhotoTask = task.id;
    state.pendingPhotoFile = null;
    $('#photoTaskName').textContent = `“${task.name}”需要一张完成照片。`;
    $('#photoInput').value = '';
    $('#submitWithPhoto').disabled = true;
    $('#photoDialog').showModal();
  } else submitTask(task);
}
async function submitTask(task, file = null) {
  if (state.cloudMode) {
    try {
      setSyncStatus('正在同步…', 'busy');
      let evidencePath = null;
      if (file) evidencePath = await window.KoalaCloud.uploadEvidence({
        file,
        missionId: task.id,
        familyId: state.context.family_id,
        childId: state.context.child_id,
      });
      await window.KoalaCloud.submitMission(task.id, evidencePath);
      await loadCloudData();
      setSyncStatus('已同步', 'online');
    } catch (error) {
      setSyncStatus('同步失败', 'error');
      return showToast(cloudErrorMessage(error));
    }
  } else {
    task.status = 'submitted';
    const historyMission = findById(state.historyMissions, task.id);
    if (historyMission) historyMission.status = 'submitted';
    renderAll();
  }
  showToast('任务已提交，等待家长确认');
}
async function approveTask(id) {
  const task = findById(state.tasks, id);
  if (state.cloudMode) {
    try {
      await window.KoalaCloud.reviewMission(task.id, true);
      await loadCloudData();
    } catch (error) { return showToast(cloudErrorMessage(error)); }
  } else {
    task.status = 'approved';
    state.stars += task.stars;
    state.pointLedger.unshift({ id: `task-${task.id}-${Date.now()}`, currency: 'star', delta: task.stars, reason: `完成任务：${task.name}`, createdAt: new Date().toISOString() });
    const historyMission = findById(state.historyMissions, task.id);
    if (historyMission) historyMission.status = 'approved';
    applyLocalStreakReward();
    renderAll();
  }
  celebrate();
  showToast(`已确认，考拉获得 ${task.stars} 颗星星`);
}
function applyLocalStreakReward() {
  const today = localIsoDate();
  if (!state.tasks.length || state.tasks.some(task => task.status !== 'approved') || state.streakAwardDates.includes(today)) return;
  state.streakAwardDates.push(today);
  state.currentStreak += 1;
  const bonus = state.streakSettings[`bonus${state.currentStreak}`] || 0;
  if (bonus > 0) {
    state.stars += bonus;
    state.pointLedger.unshift({ id: `streak-${today}`, currency: 'star', delta: bonus, reason: `连续打卡 ${state.currentStreak} 天奖励`, createdAt: new Date().toISOString() });
  }
}
async function rejectTask(id) {
  const task = findById(state.tasks, id);
  if (state.cloudMode) {
    try {
      await window.KoalaCloud.reviewMission(task.id, false, '请重新完成');
      await loadCloudData();
    } catch (error) { return showToast(cloudErrorMessage(error)); }
  } else {
    task.status = 'todo';
    const historyMission = findById(state.historyMissions, task.id);
    if (historyMission) historyMission.status = 'todo';
    renderAll();
  }
  showToast('已退回，请考拉重新完成');
}
function switchView(view) {
  $$('.view').forEach(el => el.classList.remove('view--active'));
  $$('.bottom-nav__item').forEach(el => el.classList.toggle('is-active', el.dataset.view === view));
  $(`#${view}View`).classList.add('view--active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function showDialogAtTop(dialog) {
  const sheet = $('.sheet', dialog);
  dialog.showModal();
  if (sheet) {
    sheet.scrollTop = 0;
    requestAnimationFrame(() => { sheet.scrollTop = 0; });
  }
}
function openEditor(type, id = null) {
  state.editing = { type, id };
  const item = id ? findById(type === 'task' ? getManagedTasks() : state.rewards, id) : null;
  $('#editorEyebrow').textContent = id ? '编辑' : '新增';
  $('#editorTitle').textContent = `${id ? '编辑' : '新增'}${type === 'task' ? '任务' : '奖励'}`;
  $('#editorNumberLabel').textContent = type === 'task' ? '完成可得星星' : '兑换所需星星';
  $('#editorName').value = item?.name || '';
  $('#editorNumber').value = type === 'task' ? (item?.stars || 2) : (item?.cost || 20);
  $('#editorGroup').innerHTML = getTaskGroups().map(group => `<option>${group}</option>`).join('');
  $('#editorGroup').value = item?.group || getTaskGroups()[0] || '放学后';
  $('#editorPhoto').checked = Boolean(item?.photo);
  $('#editorGroupField').hidden = type !== 'task';
  $('#editorPhotoField').hidden = type !== 'task';
  $('#editorDeleteArea').hidden = !id;
  $('#deleteEditor').textContent = type === 'task' ? '删除此任务' : '删除此奖励';
  $('#editorDeleteHint').textContent = type === 'task'
    ? '只删除任务模板，已经发布的任务和完成记录会保留。'
    : '只从奖励列表移除，过去的兑换申请和积分记录会保留。';
  showDialogAtTop($('#editorDialog'));
}
async function saveEditor() {
  const { type, id } = state.editing;
  const name = $('#editorName').value.trim();
  if (!name) return showToast('请填写名称');
  const number = Math.max(1, Number($('#editorNumber').value) || 1);
  if (state.cloudMode) {
    try {
      if (type === 'task') {
        const group = $('#editorGroup').value;
        const section = state.sections.find(item => item.name === group);
        if (!section) return showToast('请先设置对应时间段');
        await window.KoalaCloud.saveTemplateTask({
          id,
          sectionId: section.id,
          name,
          stars: number,
          photo: $('#editorPhoto').checked,
          iconType: taskVisualType({ name, group }),
        });
      } else {
        const existing = id ? findById(state.rewards, id) : null;
        await window.KoalaCloud.saveReward({ id, name, cost: number, icon: existing?.icon || '🎁' });
      }
      $('#editorDialog').close();
      await loadCloudData();
      return showToast('已保存并同步');
    } catch (error) { return showToast(cloudErrorMessage(error)); }
  }
  if (type === 'task') {
    const item = id ? findById(state.tasks, id) : { id: Date.now(), status: 'todo', icon: '🧩' };
    Object.assign(item, { name, stars: number, group: $('#editorGroup').value, photo: $('#editorPhoto').checked });
    if (!id) state.tasks.push(item);
  } else {
    const item = id ? findById(state.rewards, id) : { id: Date.now(), icon: '🎁' };
    Object.assign(item, { name, cost: number });
    if (!id) state.rewards.push(item);
  }
  $('#editorDialog').close();
  renderAll();
  showToast('已保存');
}
async function deleteEditorItem() {
  const { type, id } = state.editing || {};
  if (!id || !['task', 'reward'].includes(type)) return;
  const item = findById(type === 'task' ? getManagedTasks() : state.rewards, id);
  if (!item) return showToast(type === 'task' ? '没有找到这个任务' : '没有找到这个奖励');
  const historyNote = type === 'task'
    ? '只会删除任务模板，已经发布的任务和完成记录会保留。'
    : '只会从奖励列表移除，过去的兑换申请和积分记录会保留。';
  if (!window.confirm(`确定删除“${item.name}”吗？\n\n${historyNote}`)) return;
  const button = $('#deleteEditor');
  button.disabled = true;
  try {
    if (state.cloudMode) {
      if (type === 'task') await window.KoalaCloud.deleteTemplateTask(id);
      else await window.KoalaCloud.deleteReward(id);
      $('#editorDialog').close();
      await loadCloudData();
      if (type === 'reward' && findById(state.rewards, id)) throw new Error('REWARD_DELETE_NOT_APPLIED');
      showToast(type === 'task' ? '任务模板已删除并同步' : '奖励已删除并同步');
    } else {
      if (type === 'task') state.tasks = state.tasks.filter(entry => !sameId(entry.id, id));
      else state.rewards = state.rewards.filter(entry => !sameId(entry.id, id));
      $('#editorDialog').close();
      renderAll();
      showToast(type === 'task' ? '任务已删除' : '奖励已删除');
    }
  } catch (error) { showToast(cloudErrorMessage(error)); }
  finally { button.disabled = false; }
}
async function requestDiamondExchange() {
  if (state.context?.member_role === 'parent') return showToast('请在孩子设备上申请兑换钻石');
  const pendingStars = pendingDiamondExchanges().reduce((sum, exchange) => sum + exchange.starsSpent, 0);
  if (state.stars - pendingStars < state.starsPerDiamond) return showToast(`还需要 ${state.starsPerDiamond - (state.stars - pendingStars)} 颗星星`);
  const button = $('#requestDiamondExchange');
  button.disabled = true;
  try {
    if (state.cloudMode) {
      await window.KoalaCloud.requestDiamondExchange();
      await loadCloudData();
    } else {
      state.diamondExchanges.push({ id: Date.now(), starsSpent: state.starsPerDiamond, diamondsReceived: 1, status: 'pending' });
      renderAll();
    }
    showToast('兑换申请已发送，等待家长确认');
  } catch (error) { showToast(cloudErrorMessage(error)); }
  finally { button.disabled = false; }
}
async function reviewDiamondExchange(id, approve) {
  try {
    if (state.cloudMode) {
      await window.KoalaCloud.reviewDiamondExchange(id, approve);
      await loadCloudData();
    } else {
      const exchange = findById(state.diamondExchanges, id);
      if (!exchange || exchange.status !== 'pending') return showToast('这个申请已经处理过了');
      if (approve && state.stars < exchange.starsSpent) return showToast('当前星星不足，无法确认兑换');
      exchange.status = approve ? 'approved' : 'rejected';
      if (approve) {
        state.stars -= exchange.starsSpent;
        state.diamonds += exchange.diamondsReceived;
        const createdAt = new Date().toISOString();
        state.pointLedger.unshift({ id: `diamond-star-${id}`, currency: 'star', delta: -exchange.starsSpent, reason: '升级钻石', createdAt });
        state.pointLedger.unshift({ id: `diamond-${id}`, currency: 'diamond', delta: exchange.diamondsReceived, reason: '星星升级钻石', createdAt });
      }
      renderAll();
    }
    showToast(approve ? '已确认兑换钻石' : '已拒绝兑换申请');
  } catch (error) { showToast(cloudErrorMessage(error)); }
}
async function saveDiamondRate() {
  const rate = Number($('#starsPerDiamond').value);
  if (!Number.isInteger(rate) || rate < 1 || rate > 1000) return showToast('兑换比例应为 1 到 1000 颗星星');
  const button = $('#saveDiamondRate');
  button.disabled = true;
  try {
    if (state.cloudMode) await window.KoalaCloud.saveDiamondExchangeRate(state.context.family_id, rate);
    state.starsPerDiamond = rate;
    renderAll();
    showToast(state.cloudMode ? '兑换比例已保存并同步' : '兑换比例已保存');
  } catch (error) { showToast(cloudErrorMessage(error)); }
  finally { button.disabled = false; }
}
async function reviewRewardRedemption(id, approve) {
  const redemption = findById(state.redemptions, id);
  if (!redemption || redemption.status !== 'pending') return showToast('这个奖励申请已经处理过了');
  if (approve && state.stars < redemption.cost) return showToast('当前星星不足，无法确认兑现', 'error');
  try {
    if (state.cloudMode) {
      await window.KoalaCloud.reviewRedemption(id, approve, approve ? null : '暂不兑换');
      await loadCloudData();
    } else {
      redemption.status = approve ? 'approved' : 'rejected';
      if (approve) {
        state.stars -= redemption.cost;
        state.pointLedger.unshift({ id: `reward-${id}`, currency: 'star', delta: -redemption.cost, reason: `兑换奖励：${redemption.rewardTitle}`, createdAt: new Date().toISOString() });
      }
      renderAll();
    }
    showToast(approve ? `已确认兑现“${redemption.rewardTitle}”` : '已拒绝奖励申请', approve ? 'success' : 'info');
  } catch (error) { showToast(cloudErrorMessage(error), 'error'); }
}
function renderPointLedger() {
  const entries = state.pointLedger.slice(0, 20);
  $('#pointLedgerList').innerHTML = entries.length ? entries.map(item => {
    const currency = item.currency === 'diamond' ? '💎' : '⭐';
    const createdAt = item.createdAt || item.created_at;
    const dateText = createdAt ? new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(createdAt)) : '刚刚';
    return `<article class="point-ledger-item"><span class="point-ledger-item__icon">${currency}</span><div><strong>${escapeHtml(item.reason || '积分调整')}</strong><small>${dateText}</small></div><span class="point-ledger-item__delta ${item.delta > 0 ? 'is-positive' : 'is-negative'}">${item.delta > 0 ? '+' : ''}${item.delta} ${currency}</span></article>`;
  }).join('') : '<div class="demo-note"><strong>暂时没有积分明细</strong><p>任务确认、奖励兑换和家长调整后会显示在这里。</p></div>';
}
async function saveStreakRewards() {
  const bonus3 = Number($('#streakBonus3').value);
  const bonus7 = Number($('#streakBonus7').value);
  const bonus30 = Number($('#streakBonus30').value);
  if (![bonus3, bonus7, bonus30].every(value => Number.isInteger(value) && value >= 0 && value <= 1000)) return showToast('连续打卡奖励应为 0 到 1000 颗星星', 'error');
  const button = $('#saveStreakRewards');
  button.disabled = true;
  try {
    if (state.cloudMode) await window.KoalaCloud.saveStreakRewards(state.context.family_id, bonus3, bonus7, bonus30);
    state.streakSettings = { bonus3, bonus7, bonus30 };
    renderAll();
    showToast(state.cloudMode ? '连续打卡奖励已保存并同步' : '连续打卡奖励已保存', 'success');
  } catch (error) { showToast(cloudErrorMessage(error), 'error'); }
  finally { button.disabled = false; }
}
function openPointAdjustmentDialog() {
  if (state.cloudMode && state.context?.member_role !== 'parent') return showToast('只有家长可以调整积分', 'error');
  $('#adjustPointCurrency').value = 'star';
  $('#adjustPointDirection').value = 'add';
  $('#adjustPointAmount').value = 1;
  $('#adjustPointReason').value = '';
  setAuthMessage('#pointAdjustmentMessage', '每次调整都会记录原因和时间。');
  showDialogAtTop($('#pointAdjustmentDialog'));
}
async function confirmPointAdjustment() {
  const currency = $('#adjustPointCurrency').value;
  const direction = $('#adjustPointDirection').value;
  const amount = Number($('#adjustPointAmount').value);
  const reason = $('#adjustPointReason').value.trim();
  if (!Number.isInteger(amount) || amount < 1 || amount > 1000) return setAuthMessage('#pointAdjustmentMessage', '数量应为 1 到 1000', 'error');
  if (!reason) return setAuthMessage('#pointAdjustmentMessage', '请填写调整原因', 'error');
  const delta = direction === 'deduct' ? -amount : amount;
  if (currency === 'star' && state.stars + delta < 0) return setAuthMessage('#pointAdjustmentMessage', '星星余额不足，不能扣到负数', 'error');
  if (currency === 'diamond' && state.diamonds + delta < 0) return setAuthMessage('#pointAdjustmentMessage', '钻石余额不足，不能扣到负数', 'error');
  const button = $('#confirmPointAdjustment');
  button.disabled = true;
  try {
    if (state.cloudMode) {
      await window.KoalaCloud.adjustChildPoints(state.context.child_id, currency === 'star' ? delta : 0, currency === 'diamond' ? delta : 0, reason);
      await loadCloudData();
    } else {
      if (currency === 'star') state.stars += delta; else state.diamonds += delta;
      state.pointLedger.unshift({ id: `adjust-${Date.now()}`, currency, delta, reason: `家长调整：${reason}`, createdAt: new Date().toISOString() });
      renderAll();
    }
    $('#pointAdjustmentDialog').close();
    showToast(`已${direction === 'add' ? '增加' : '扣除'} ${amount} ${currency === 'star' ? '颗星星' : '颗钻石'}`, 'success');
  } catch (error) { setAuthMessage('#pointAdjustmentMessage', cloudErrorMessage(error), 'error'); }
  finally { button.disabled = false; }
}
function parseIsoDate(value) {
  const [year, month, day] = String(value).split('-').map(Number);
  return new Date(year, month - 1, day);
}
function addDays(date, days) { const result = new Date(date); result.setDate(result.getDate() + days); return result; }
function startOfWeek(date) { const result = new Date(date); const day = result.getDay() || 7; result.setDate(result.getDate() - day + 1); result.setHours(0, 0, 0, 0); return result; }
function historyMissionDate(mission) { return mission.scheduledDate || mission.scheduled_date; }
function historyMissionTitle(mission) { return mission.title || mission.name; }
function historyMissionGroup(mission) { return mission.sectionName || mission.section_name || mission.group || '任务'; }
function renderGrowthPanel() {
  const selectedDate = parseIsoDate(state.selectedHistoryDate);
  const weekStart = startOfWeek(selectedDate);
  const weekEnd = addDays(weekStart, 6);
  const weekMissions = state.historyMissions.filter(item => {
    const date = parseIsoDate(historyMissionDate(item));
    return date >= weekStart && date <= weekEnd;
  });
  const approved = weekMissions.filter(item => item.status === 'approved');
  const learning = approved.filter(item => taskSubject({ name: historyMissionTitle(item), group: historyMissionGroup(item) }));
  const exercise = approved.filter(item => /锻炼|运动|跳绳|跑步|户外/.test(`${historyMissionGroup(item)}${historyMissionTitle(item)}`));
  const ledger = state.historyPointLedger.length ? state.historyPointLedger : state.pointLedger;
  const earnedFromLedger = ledger.filter(item => item.currency === 'star' && item.delta > 0 && (() => { const date = new Date(item.createdAt || item.created_at); return date >= weekStart && date < addDays(weekEnd, 1); })()).reduce((sum, item) => sum + item.delta, 0);
  const earned = earnedFromLedger || approved.reduce((sum, item) => sum + Number(item.stars || 0), 0);
  $('#weeklyDateRange').textContent = `${weekStart.getMonth() + 1} 月 ${weekStart.getDate()} 日—${weekEnd.getMonth() + 1} 月 ${weekEnd.getDate()} 日`;
  $('#weeklyCompletionRate').textContent = weekMissions.length ? `${Math.round(approved.length / weekMissions.length * 100)}%` : '0%';
  $('#weeklyCompletionCount').textContent = `${approved.length}/${weekMissions.length} 项`;
  $('#weeklyLearningCount').textContent = learning.length;
  $('#weeklyExerciseCount').textContent = exercise.length;
  $('#weeklyStarsEarned').textContent = `${earned} ⭐`;
  $('#growthStreak').textContent = state.currentStreak;
  renderCalendar();
  renderHistoryDay();
}
function renderCalendar() {
  const month = state.historyMonth;
  $('#calendarMonthLabel').textContent = `${month.getFullYear()} 年 ${month.getMonth() + 1} 月`;
  const gridStart = startOfWeek(new Date(month.getFullYear(), month.getMonth(), 1));
  const today = localIsoDate();
  $('#calendarGrid').innerHTML = Array.from({ length: 42 }, (_, index) => {
    const date = addDays(gridStart, index);
    const iso = localIsoDate(date);
    const missions = state.historyMissions.filter(item => historyMissionDate(item) === iso);
    const approved = missions.filter(item => item.status === 'approved').length;
    const completion = missions.length && approved === missions.length ? 'complete' : missions.length ? 'partial' : 'empty';
    return `<button class="calendar-day ${date.getMonth() === month.getMonth() ? 'is-current-month' : ''} ${iso === state.selectedHistoryDate ? 'is-selected' : ''} ${iso === today ? 'is-today' : ''}" type="button" data-history-date="${iso}" data-completion="${completion}" aria-label="${date.getMonth() + 1}月${date.getDate()}日，${missions.length ? `${approved}/${missions.length}项完成` : '无任务'}"><span>${date.getDate()}</span><small>${missions.length ? `${approved}/${missions.length} ✓` : '·'}</small></button>`;
  }).join('');
  $$('[data-history-date]').forEach(button => button.onclick = () => { state.selectedHistoryDate = button.dataset.historyDate; renderGrowthPanel(); });
}
function renderHistoryDay() {
  const date = parseIsoDate(state.selectedHistoryDate);
  const missions = state.historyMissions.filter(item => historyMissionDate(item) === state.selectedHistoryDate);
  const approved = missions.filter(item => item.status === 'approved').length;
  $('#historyDayTitle').textContent = `${date.getMonth() + 1} 月 ${date.getDate()} 日任务`;
  $('#historyDaySummary').textContent = missions.length ? `完成 ${approved}/${missions.length} 项` : '当天没有安排任务。';
  $('#historyDayList').innerHTML = missions.length ? missions.map(item => `<article class="history-day-item is-${item.status}"><span class="history-day-item__status">${item.status === 'approved' ? '✓' : item.status === 'submitted' ? '…' : '○'}</span><div><strong>${escapeHtml(historyMissionTitle(item))}</strong><small>${escapeHtml(historyMissionGroup(item))} · ${item.status === 'approved' ? '已完成' : item.status === 'submitted' ? '待家长确认' : '未完成'}</small></div><b>⭐ ${item.stars}</b></article>`).join('') : '<div class="demo-note"><strong>没有任务记录</strong><p>家长发布任务后，这里会按日期保存完成情况。</p></div>';
}
async function loadHistoryMonth() {
  if (!state.cloudMode) { state.historyPointLedger = state.pointLedger; return renderGrowthPanel(); }
  const gridStart = startOfWeek(new Date(state.historyMonth.getFullYear(), state.historyMonth.getMonth(), 1));
  const gridEnd = addDays(gridStart, 41);
  try {
    const data = await window.KoalaCloud.loadHistoryData(localIsoDate(gridStart), localIsoDate(gridEnd));
    state.historyMissions = data.missions.map(item => ({ id: item.id, scheduledDate: item.scheduled_date, sectionName: item.section_name, title: item.title, stars: item.stars, status: item.status }));
    state.historyPointLedger = data.pointLedger.map(item => ({ ...item, createdAt: item.created_at }));
    renderGrowthPanel();
  } catch (error) { showToast(cloudErrorMessage(error), 'error'); }
}
function updatePointResetPreview() {
  const resetStars = $('#resetStarsOption').checked;
  const resetDiamonds = $('#resetDiamondsOption').checked;
  const selected = [resetStars ? `⭐ ${state.stars} 颗星星` : '', resetDiamonds ? `💎 ${state.diamonds} 颗钻石` : ''].filter(Boolean);
  const preview = $('#pointResetPreview');
  const button = $('#confirmPointReset');
  button.disabled = selected.length === 0;
  preview.classList.toggle('is-empty', selected.length === 0);
  preview.innerHTML = selected.length
    ? `将清除：<strong>${selected.join('、')}</strong>。确认后余额归零，历史记录仍保留。`
    : '请至少选择一项。';
}
function openPointResetDialog() {
  if (state.cloudMode && state.context?.member_role !== 'parent') return showToast('只有家长可以清除积分', 'error');
  $('#resetStarsOption').checked = false;
  $('#resetDiamondsOption').checked = false;
  $('#resetStarsDialogBalance').textContent = state.stars;
  $('#resetDiamondsDialogBalance').textContent = state.diamonds;
  $('#confirmPointReset').textContent = '确认清除';
  updatePointResetPreview();
  showDialogAtTop($('#pointResetDialog'));
}
async function confirmPointReset() {
  const resetStars = $('#resetStarsOption').checked;
  const resetDiamonds = $('#resetDiamondsOption').checked;
  if (!resetStars && !resetDiamonds) return showToast('请至少选择一项', 'error');
  const button = $('#confirmPointReset');
  button.disabled = true;
  button.textContent = '正在清除…';
  const previousStars = state.stars;
  const previousDiamonds = state.diamonds;
  try {
    if (state.cloudMode) {
      if (state.context?.member_role !== 'parent') throw new Error('PARENT_PERMISSION_REQUIRED');
      await window.KoalaCloud.resetChildPoints(state.context.child_id, resetStars, resetDiamonds);
      await loadCloudData();
    } else {
      if (resetStars) state.stars = 0;
      if (resetDiamonds) state.diamonds = 0;
      state.diamondExchanges.forEach(exchange => { if (exchange.status === 'pending') exchange.status = 'rejected'; });
      if (resetStars) state.redemptions.forEach(item => { if (item.status === 'pending') item.status = 'rejected'; });
      const resetAt = new Date().toISOString();
      if (resetStars && previousStars > 0) state.pointLedger.unshift({ id: `reset-stars-${Date.now()}`, currency: 'star', delta: -previousStars, reason: '家长清零星星', createdAt: resetAt });
      if (resetDiamonds && previousDiamonds > 0) state.pointLedger.unshift({ id: `reset-diamonds-${Date.now()}`, currency: 'diamond', delta: -previousDiamonds, reason: '家长清零钻石', createdAt: resetAt });
      state.pointResetHistory.unshift({
        at: resetAt,
        stars: resetStars ? previousStars : null,
        diamonds: resetDiamonds ? previousDiamonds : null,
      });
      state.pointResetHistory = state.pointResetHistory.slice(0, 50);
      renderAll();
    }
    $('#pointResetDialog').close();
    const cleared = [resetStars ? '星星' : '', resetDiamonds ? '钻石' : ''].filter(Boolean).join('和');
    showToast(`${cleared}已由家长清除，历史记录已保留`, 'success');
  } catch (error) {
    showToast(cloudErrorMessage(error), 'error');
  } finally {
    button.disabled = false;
    button.textContent = '确认清除';
  }
}
function showToast(message, tone = 'info') {
  const toast = $('#toast');
  const icons = { success: '✓', error: '!', info: 'i' };
  toast.dataset.tone = tone;
  $('#toastIcon').textContent = icons[tone] || icons.info;
  $('#toastMessage').textContent = message;
  toast.classList.remove('is-visible');
  void toast.offsetWidth;
  toast.classList.add('is-visible');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('is-visible'), 2600);
}
function celebrate() {
  const el = $('#celebration');
  const spans = $$('span', el); spans[0].style.setProperty('--x', -1); spans[2].style.setProperty('--x', 1);
  el.classList.remove('is-visible'); void el.offsetWidth; el.classList.add('is-visible');
  setTimeout(() => el.classList.remove('is-visible'), 1000);
}

function localIsoDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
function setSyncStatus(text, tone = 'online') {
  const status = $('#syncStatus');
  if (!status) return;
  status.dataset.tone = tone;
  $('b', status).textContent = text;
}
function cloudErrorMessage(error) {
  const message = String(error?.message || error || '操作失败');
  const normalized = message.toUpperCase().replace(/[\s-]+/g, '_');
  const messages = [
    ['EMAIL_NOT_CONFIRMED', '邮箱尚未确认，请先打开确认邮件中的链接'],
    ['EMAIL_RATE_LIMIT_EXCEEDED', '验证邮件发送次数已达上限，请稍后再试，不要重复点击'],
    ['OVER_EMAIL_SEND_RATE_LIMIT', '验证邮件发送次数已达上限，请稍后再试，不要重复点击'],
    ['INVALID_LOGIN_CREDENTIALS', '邮箱或密码不正确；孩子登录请检查家庭码和孩子 PIN'],
    ['FAMILY_CODE_INVALID', '家庭码应为 8 位数字或字母 A-F'],
    ['PIN_MUST_BE_FOUR_DIGITS', 'PIN 必须是四位数字'],
    ['USER_ALREADY_HAS_FAMILY', '当前账号已经加入家庭，请刷新页面继续'],
    ['USER_ALREADY_REGISTERED', '该邮箱已经注册，请返回登录'],
    ['PASSWORD_SHOULD_BE_AT_LEAST', '密码长度不足，请至少输入 8 位'],
    ['AUTH_REQUIRED', '请先登录'],
    ['CHILD_AUTH_REQUIRED', '请在孩子设备登录后申请兑换'],
    ['PHOTO_REQUIRED', '这个任务必须上传照片'],
    ['INSUFFICIENT_STARS', '星星不足，暂时不能兑换'],
    ['RATE_OUT_OF_RANGE', '兑换比例应为 1 到 1000 颗星星'],
    ['DIAMOND_EXCHANGE_NOT_PENDING', '这个钻石兑换申请已经处理过了'],
    ['REDEMPTION_NOT_PENDING', '这个奖励申请已经处理过了'],
    ['STREAK_BONUS_OUT_OF_RANGE', '连续打卡奖励应为 0 到 1000 颗星星'],
    ['ADJUSTMENT_REASON_REQUIRED', '请填写积分调整原因'],
    ['ADJUSTMENT_OUT_OF_RANGE', '每次最多调整 1000 个积分'],
    ['INSUFFICIENT_POINTS', '积分余额不足，不能扣到负数'],
    ['PARENT_PERMISSION_REQUIRED', '只有家长可以执行这个操作'],
    ['AI_NOT_CONFIGURED', 'AI 云端参数尚未设置，请先填写环境文件并部署'],
    ['AI_EMPTY_RESPONSE', 'AI 接口已响应，但没有返回可显示的文字'],
    ['REWARD_DELETE_NOT_APPLIED', '奖励没有从云端删除，请刷新后重试'],
  ];
  const found = messages.find(([key]) => normalized.includes(key));
  return found ? found[1] : `操作未完成：${message}`;
}
function setAuthMessage(selector, message, type = '') {
  const element = $(selector);
  element.textContent = message;
  element.classList.toggle('is-error', type === 'error');
  element.classList.toggle('is-success', type === 'success');
}
async function loadCloudData() {
  if (!state.cloudMode) return;
  setSyncStatus('正在同步…', 'busy');
  const data = await window.KoalaCloud.loadAppData(localIsoDate());
  if (!data.context) return;
  state.context = data.context;
  state.templates = data.templates;
  state.sections = data.sections;
  const sectionById = Object.fromEntries(data.sections.map(section => [section.id, section]));
  state.templateTasks = data.templateTasks.map(task => ({
    id: task.id,
    sectionId: task.section_id,
    templateTaskId: task.id,
    group: sectionById[task.section_id]?.name || '未分组',
    name: task.title,
    stars: task.stars,
    photo: task.requires_photo,
    iconType: task.icon_type,
    status: 'todo',
  }));
  state.tasks = data.missions.map(task => ({
    id: task.id,
    templateTaskId: task.template_task_id,
    group: task.section_name,
    name: task.title,
    stars: task.stars,
    photo: task.requires_photo,
    status: task.status,
    evidencePath: task.evidence_path,
  }));
  state.rewards = data.rewards.map(reward => ({ id: reward.id, icon: reward.icon, name: reward.title, cost: reward.cost }));
  state.stars = data.stars;
  state.diamonds = data.diamonds;
  state.starsPerDiamond = data.starsPerDiamond;
  state.streakSettings = data.streakSettings;
  state.currentStreak = data.currentStreak;
  state.redemptions = data.redemptions.map(item => ({ id: item.id, rewardId: item.reward_id, rewardTitle: item.reward_title, cost: item.cost, status: item.status, requestedAt: item.requested_at }));
  state.pointLedger = data.pointLedger.map(item => ({ ...item, createdAt: item.created_at }));
  state.diamondExchanges = data.diamondExchanges.map(exchange => ({
    id: exchange.id,
    starsSpent: exchange.stars_spent,
    diamondsReceived: exchange.diamonds_received,
    status: exchange.status,
  }));
  state.learningMaterials = data.learningMaterials.map(material => ({
    id: material.id,
    subject: material.subject,
    type: material.material_type,
    title: material.title,
    taskId: material.template_task_id,
    content: material.content,
    answer: (data.learningAnswers || []).find(answer => sameId(answer.material_id, material.id))?.answer_content || '',
    source: material.source_label,
    url: material.source_url || '',
    published: material.published,
  }));
  renderAll();
  setSyncStatus('已同步', 'online');
}
function queueRealtimeRefresh() {
  clearTimeout(state.realtimeRefreshTimer);
  state.realtimeRefreshTimer = setTimeout(() => loadCloudData().catch(error => setSyncStatus(cloudErrorMessage(error), 'error')), 250);
}
async function activateCloudSession() {
  let context = await window.KoalaCloud.getContext();
  const url = new URL(location.href);
  const inviteToken = url.searchParams.get('invite');
  if (!context && inviteToken) {
    await window.KoalaCloud.acceptInvite(inviteToken, '考拉家长');
    url.searchParams.delete('invite');
    history.replaceState({}, '', url);
    context = await window.KoalaCloud.getContext();
  }
  $('#authGate').hidden = true;
  if (!context) {
    if (!$('#familySetupDialog').open) $('#familySetupDialog').showModal();
    return;
  }
  state.cloudMode = true;
  state.context = context;
  $('#parentModeLabel').textContent = '家长控制台 · 云端同步';
  $('#childAccountButton').hidden = context.member_role !== 'child';
  $('#childAccountSummary').textContent = `${context.child_nickname || '孩子'} · ${context.family_name}`;
  $('#signOutButton').hidden = false;
  $('#accountStatus').textContent = `${context.member_role === 'parent' ? '家长' : '孩子'}账号 · ${context.family_name}`;
  $('#childSettingsValue').textContent = `${context.child_nickname || '孩子'} · 大名仅家长可见`;
  $('#familyCodeValue').textContent = formatFamilyCode(context.family_code) || '尚未生成';
  $('#taskReminderToggle').closest('.setting-row').hidden = context.member_role !== 'child';
  $('#parentReminderToggle').closest('.setting-row').hidden = context.member_role !== 'parent';
  $('#pinHelp').textContent = hasParentPin() ? '请输入当前设备设置的 4 位家长 PIN。' : '当前设备尚未设置家长 PIN。';
  updateParentPinStatus();
  await loadCloudData();
  await window.KoalaCloud.subscribe(queueRealtimeRefresh);
  if (context.member_role === 'child') switchView('child');
}
async function initializeCloudMode() {
  if (!window.KoalaCloud?.isConfigured()) {
    setSyncStatus('Demo 本机', 'demo');
    return;
  }
  try {
    setSyncStatus('连接云端…', 'busy');
    const result = await window.KoalaCloud.init();
    if (!result.session) {
      $('#authGate').hidden = false;
      $('#childFamilyCode').value = localStorage.getItem('koala-family-code') || '';
      if (sessionStorage.getItem('koala-open-child-login') === '1') {
        sessionStorage.removeItem('koala-open-child-login');
        selectAuthTab('child');
      }
      setSyncStatus('等待登录', 'demo');
      return;
    }
    await activateCloudSession();
  } catch (error) {
    $('#authGate').hidden = false;
    setAuthMessage('#authMessage', cloudErrorMessage(error), 'error');
    setSyncStatus('云端不可用', 'error');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const date = new Date();
  ['pinInput', 'childLoginPin', 'setupChildPin', 'setupChildPinConfirm', 'setupParentPin', 'setupParentPinConfirm', 'newChildPin', 'newChildPinConfirm', 'newParentPin', 'newParentPinConfirm'].forEach(id => {
    const input = $(`#${id}`);
    if (input) input.oninput = () => { input.value = input.value.replace(/\D/g, '').slice(0, 4); };
  });
  $('#childFamilyCode').oninput = event => { event.target.value = formatFamilyCode(event.target.value); };
  $('#todayLabel').textContent = `${date.getMonth() + 1} 月 ${date.getDate()} 日 · 考拉`;
  $('#publishStartDate').value = localIsoDate(date);
  renderAll();
  setTimeout(() => $('#splash').classList.add('is-hidden'), 2400);
  $('#skipSplash').onclick = () => $('#splash').classList.add('is-hidden');
  $$('.bottom-nav__item').forEach(button => button.onclick = () => {
    if (button.dataset.view === 'parent' && state.cloudMode && state.context?.member_role === 'child') {
      return showToast('孩子设备需先退出孩子账号，再由家长登录');
    }
    if (button.dataset.view === 'parent' && !state.parentUnlocked) {
      if (state.cloudMode && !hasParentPin()) return openParentPinSetup(true);
      $('#pinInput').value = '';
      $('#pinError').textContent = '';
      $('#pinDialog').showModal();
      setTimeout(() => $('#pinInput').focus(), 100);
    }
    else switchView(button.dataset.view);
  });
  $('#pinSubmit').onclick = async () => {
    const pin = $('#pinInput').value;
    if (!/^[0-9]{4}$/.test(pin)) { $('#pinError').textContent = '请输入四位数字 PIN'; return; }
    if (!(await verifyParentPin(pin))) { $('#pinError').textContent = state.cloudMode ? '家长 PIN 不正确' : 'PIN 不正确，请输入 Demo PIN 2580'; return; }
    state.parentUnlocked = true; $('#pinError').textContent = ''; $('#pinDialog').close(); switchView('parent');
  };
  $$('[data-parent-tab]').forEach(button => button.onclick = () => {
    $$('[data-parent-tab]').forEach(x => x.classList.remove('is-active')); button.classList.add('is-active');
    $$('.parent-panel').forEach(x => x.classList.remove('is-active')); $(`#${button.dataset.parentTab}Panel`).classList.add('is-active');
    if (button.dataset.parentTab === 'growth') loadHistoryMonth();
  });
  $$('[data-auth-tab]').forEach(button => button.onclick = () => selectAuthTab(button.dataset.authTab));
  $('#toggleRegister').onclick = () => {
    state.registerMode = !state.registerMode;
    $('#parentNameField').hidden = !state.registerMode;
    $('#parentPasswordConfirmField').hidden = !state.registerMode;
    $('#parentAuthSubmit').textContent = state.registerMode ? '创建家长账号' : '登录';
    $('#toggleRegister').textContent = state.registerMode ? '已有账号？返回登录' : '第一次使用？创建家长账号';
    $('#parentPassword').autocomplete = state.registerMode ? 'new-password' : 'current-password';
    $('#parentPasswordConfirm').required = state.registerMode;
    $('#parentPasswordConfirm').value = '';
    setAuthMessage('#authMessage', '');
  };
  $('#togglePasswordVisibility').onclick = () => {
    const show = $('#parentPassword').type === 'password';
    $('#parentPassword').type = show ? 'text' : 'password';
    $('#parentPasswordConfirm').type = show ? 'text' : 'password';
    $('#togglePasswordVisibility').textContent = show ? '隐藏' : '显示';
    $('#togglePasswordVisibility').setAttribute('aria-pressed', String(show));
  };
  $('#parentAuthForm').onsubmit = async event => {
    event.preventDefault();
    const submitButton = $('#parentAuthSubmit');
    if (submitButton.disabled) return;
    const password = $('#parentPassword').value;
    if (state.registerMode && password.length < 8) return setAuthMessage('#authMessage', '家长账号密码至少需要 8 位', 'error');
    if (state.registerMode && !/[A-Za-z]/.test(password)) return setAuthMessage('#authMessage', '家长账号密码请至少包含一个英文字母', 'error');
    if (state.registerMode && !/[0-9]/.test(password)) return setAuthMessage('#authMessage', '家长账号密码请至少包含一个数字', 'error');
    if (state.registerMode && password !== $('#parentPasswordConfirm').value) return setAuthMessage('#authMessage', '两次输入的家长账号密码不一致', 'error');
    const payload = { email: $('#parentEmail').value.trim().toLowerCase(), password, displayName: $('#parentDisplayName').value.trim() || '考拉家长' };
    setAuthMessage('#authMessage', state.registerMode ? '正在创建账号…' : '正在登录…');
    submitButton.disabled = true;
    try {
      const data = state.registerMode ? await window.KoalaCloud.signUpParent(payload) : await window.KoalaCloud.signInParent(payload);
      if (data.session) await activateCloudSession();
      else setAuthMessage('#authMessage', '注册成功，请查看邮箱并点击确认链接。', 'success');
    } catch (error) { setAuthMessage('#authMessage', cloudErrorMessage(error), 'error'); }
    finally { submitButton.disabled = false; }
  };
  $('#childAuthForm').onsubmit = async event => {
    event.preventDefault();
    const familyCode = normalizeFamilyCode($('#childFamilyCode').value);
    const pin = $('#childLoginPin').value;
    if (!/^[0-9A-F]{8}$/.test(familyCode)) return setAuthMessage('#childAuthMessage', '请输入完整的 8 位家庭码', 'error');
    if (!/^[0-9]{4}$/.test(pin)) return setAuthMessage('#childAuthMessage', '请输入四位数字 PIN', 'error');
    $('#childFamilyCode').value = formatFamilyCode(familyCode);
    setAuthMessage('#childAuthMessage', '正在进入考拉任务…');
    try {
      await window.KoalaCloud.signInChild({ familyCode, pin });
      await activateCloudSession();
    } catch (error) { setAuthMessage('#childAuthMessage', cloudErrorMessage(error), 'error'); }
  };
  $('#useDemoMode').onclick = () => { $('#authGate').hidden = true; state.cloudMode = false; $('#parentModeLabel').textContent = '家长控制台 · 本机 Demo'; setSyncStatus('Demo 本机', 'demo'); };
  $('#createFamilyButton').onclick = async () => {
    const childPin = $('#setupChildPin').value;
    const childPinConfirm = $('#setupChildPinConfirm').value;
    const parentPin = $('#setupParentPin').value;
    const parentPinConfirm = $('#setupParentPinConfirm').value;
    if (!$('#setupFamilyName').value.trim() || !$('#setupParentName').value.trim() || !$('#setupChildFullName').value.trim() || !$('#setupChildNickname').value.trim()) return setAuthMessage('#setupMessage', '请完整填写家庭、家长和孩子信息', 'error');
    if (!/^[0-9]{4}$/.test(childPin) || !/^[0-9]{4}$/.test(parentPin)) return setAuthMessage('#setupMessage', '孩子 PIN 和家长 PIN 都必须是四位数字', 'error');
    if (childPin !== childPinConfirm) return setAuthMessage('#setupMessage', '两次输入的孩子 PIN 不一致', 'error');
    if (parentPin !== parentPinConfirm) return setAuthMessage('#setupMessage', '两次输入的家长 PIN 不一致', 'error');
    if (childPin === parentPin) return setAuthMessage('#setupMessage', '孩子 PIN 与家长 PIN 不能相同', 'error');
    if (isWeakPin(childPin) || isWeakPin(parentPin)) return setAuthMessage('#setupMessage', '请不要使用连续或重复数字作为 PIN', 'error');
    setAuthMessage('#setupMessage', '正在创建家庭、默认任务和孩子登录…');
    let created = null;
    try {
      created = await window.KoalaCloud.createFamily({
        familyName: $('#setupFamilyName').value,
        parentName: $('#setupParentName').value,
        childFullName: $('#setupChildFullName').value,
        childNickname: $('#setupChildNickname').value,
      });
      await storeParentPin(parentPin);
      try {
        await window.KoalaCloud.createChildLogin(created.family_id, childPin);
      } catch (childError) {
        $('#familySetupDialog').close();
        await activateCloudSession();
        setAuthMessage('#childPinResult', `家庭已创建，请重新设置孩子 PIN：${cloudErrorMessage(childError)}`, 'error');
        $('#childPinDialog').showModal();
        return;
      }
      $('#familySetupDialog').close();
      await activateCloudSession();
      showToast(`家庭已创建，家庭码：${formatFamilyCode(created.family_code)}`);
    } catch (error) {
      if (created) {
        $('#familySetupDialog').close();
        await activateCloudSession().catch(() => {});
        showToast('家庭已创建，请在设置中继续配置 PIN');
      } else setAuthMessage('#setupMessage', cloudErrorMessage(error), 'error');
    }
  };
  $('#publishButton').onclick = () => {
    $('#publishStartDate').value = localIsoDate();
    renderPublishTaskChoices();
    showDialogAtTop($('#publishDialog'));
  };
  $$('[data-quick-date-offset]').forEach(button => button.onclick = () => {
    const date = new Date();
    date.setDate(date.getDate() + Number(button.dataset.quickDateOffset));
    $('#quickPublishDate').value = localIsoDate(date);
    setAuthMessage('#quickPublishMessage', button.dataset.quickDateOffset === '0' ? '将发布到今天。' : '将从明天开始发布。');
  });
  $('#confirmQuickPublish').onclick = confirmQuickPublish;
  $('#publishDays').oninput = updatePublishPreview;
  $('#publishRange').onchange = updatePublishPreview;
  $('#toggleAllPublishTasks').onclick = () => {
    const checkboxes = $$('input[name="publish-task"]', $('#publishTaskChoices'));
    const shouldSelectAll = !checkboxes.length || checkboxes.some(input => !input.checked);
    checkboxes.forEach(input => { input.checked = shouldSelectAll; });
    updatePublishPreview();
  };
  $('#confirmPublish').onclick = async () => {
    const days = $('#publishRange').value === '仅一天' ? 1 : Number($('#publishDays').value || 1);
    const taskIds = selectedPublishTaskIds();
    if (!taskIds.length) return showToast('请至少选择一条任务');
    if (!Number.isInteger(days) || days < 1 || days > 30) return showToast('连续天数应为 1 到 30 天');
    if (!state.cloudMode) { $('#publishDialog').close(); return showToast(`已模拟发布 ${taskIds.length} 条任务，共 ${days} 天`); }
    const button = $('#confirmPublish');
    button.disabled = true;
    const originalText = button.textContent;
    button.textContent = '正在发布…';
    try {
      const template = state.templates[0];
      if (!template) return showToast('请先创建一个任务模板');
      const collision = $('input[name="collision"]:checked').value;
      const count = await window.KoalaCloud.publishTemplate({ templateId: template.id, taskIds, startDate: $('#publishStartDate').value, days, collision });
      $('#publishDialog').close();
      await loadCloudData();
      showToast(`已发布 ${count} 项任务`);
    } catch (error) { showToast(cloudErrorMessage(error)); }
    finally { button.disabled = false; button.textContent = originalText; }
  };
  $('#addTaskButton').onclick = () => openEditor('task');
  $('#addRewardButton').onclick = () => openEditor('reward');
  $('#addLearningMaterial').onclick = () => openLearningEditor();
  $('#openAiAssistant').onclick = openAiAssistant;
  $('#toggleAiKeyVisibility').onclick = () => {
    const show = $('#aiApiKey').type === 'password';
    $('#aiApiKey').type = show ? 'text' : 'password';
    $('#toggleAiKeyVisibility').textContent = show ? '隐藏' : '显示';
    $('#toggleAiKeyVisibility').setAttribute('aria-pressed', String(show));
  };
  $('#clearAiConfig').onclick = () => {
    localStorage.removeItem(AI_ENDPOINT_KEY);
    localStorage.removeItem(AI_MODEL_KEY);
    sessionStorage.removeItem(AI_API_KEY_SESSION);
    $('#aiEndpoint').value = '';
    $('#aiModel').value = '';
    $('#aiApiKey').value = '';
    setAuthMessage('#aiAssistantStatus', '已清除这台设备保存的接口地址、模型名称和本次标签页的 Key。', 'success');
  };
  $$('[data-ai-prompt]').forEach(button => button.onclick = () => setQuickAiPrompt(button.dataset.aiPrompt));
  $('#generateAiMaterial').onclick = generateAiMaterial;
  $('#useAiResult').onclick = useAiResultAsMaterial;
  $$('[data-learning-library]').forEach(button => button.onclick = () => {
    state.learningLibraryMode = button.dataset.learningLibrary;
    renderLearningMaterials();
  });
  $$('[data-learning-subject]').forEach(button => button.onclick = () => {
    state.learningSubject = button.dataset.learningSubject;
    renderLearningMaterials();
  });
  $('#saveLearningMaterial').onclick = saveLearningMaterial;
  $('#deleteLearningMaterial').onclick = deleteLearningMaterial;
  $('#saveEditor').onclick = saveEditor;
  $('#deleteEditor').onclick = deleteEditorItem;
  $('#requestDiamondExchange').onclick = requestDiamondExchange;
  $('#saveDiamondRate').onclick = saveDiamondRate;
  $('#saveStreakRewards').onclick = saveStreakRewards;
  $('#openPointAdjustment').onclick = openPointAdjustmentDialog;
  $('#confirmPointAdjustment').onclick = confirmPointAdjustment;
  $('#previousMonth').onclick = () => { state.historyMonth = new Date(state.historyMonth.getFullYear(), state.historyMonth.getMonth() - 1, 1); state.selectedHistoryDate = localIsoDate(state.historyMonth); loadHistoryMonth(); };
  $('#nextMonth').onclick = () => { state.historyMonth = new Date(state.historyMonth.getFullYear(), state.historyMonth.getMonth() + 1, 1); state.selectedHistoryDate = localIsoDate(state.historyMonth); loadHistoryMonth(); };
  $('#openPointReset').onclick = openPointResetDialog;
  $('#resetStarsOption').onchange = updatePointResetPreview;
  $('#resetDiamondsOption').onchange = updatePointResetPreview;
  $('#confirmPointReset').onclick = confirmPointReset;
  $('#photoInput').onchange = e => { state.pendingPhotoFile = e.target.files[0] || null; $('#submitWithPhoto').disabled = !state.pendingPhotoFile; };
  $('#submitWithPhoto').onclick = async () => { const task = findById(state.tasks, state.pendingPhotoTask); $('#photoDialog').close(); await submitTask(task, state.pendingPhotoFile); };
  $('#refreshButton').onclick = async () => {
    if (state.cloudMode) {
      try { await loadCloudData(); showToast('已获取最新任务'); }
      catch (error) { showToast(cloudErrorMessage(error)); }
    } else showToast('任务已经是最新状态');
  };
  $('#inviteParentButton').onclick = () => {
    if (!state.cloudMode) return showToast('接入 Supabase 后即可发送邀请');
    $('#inviteShareArea').hidden = true;
    $('#copyParentInviteLink').dataset.shareUrl = '';
    setAuthMessage('#inviteResult', '');
    $('#inviteParentDialog').showModal();
  };
  $('#sendParentInvite').onclick = async () => {
    const email = $('#inviteParentEmail').value.trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) return setAuthMessage('#inviteResult', '请输入正确的邮箱地址。', 'error');
    const button = $('#sendParentInvite');
    button.disabled = true;
    $('#inviteShareArea').hidden = true;
    $('#copyParentInviteLink').dataset.shareUrl = '';
    setAuthMessage('#inviteResult', '正在发送邀请…');
    try {
      const result = await window.KoalaCloud.inviteParent(state.context.family_id, email);
      if (result.alreadyMember || result.warning === 'ALREADY_IN_FAMILY') {
        setAuthMessage('#inviteResult', '这个邮箱已经是当前家庭的家长，请让对方直接登录。', 'success');
      } else if (result.warning === 'USER_ALREADY_HAS_FAMILY') {
        setAuthMessage('#inviteResult', '这个账号已经加入了另一个家庭，当前不能重复加入。', 'error');
      } else if (result.emailSent) {
        $('#inviteParentDialog').close();
        $('#inviteParentEmail').value = '';
        showToast('家长邀请邮件已发送', 'success');
      } else if (result.shareUrl) {
        $('#copyParentInviteLink').dataset.shareUrl = result.shareUrl;
        $('#inviteShareArea').hidden = false;
        const message = result.warning === 'EMAIL_ALREADY_REGISTERED'
          ? '这个邮箱已经注册但尚未加入家庭，请把邀请链接发给对方。'
          : '邮件暂时没有发出，可以改用邀请链接。';
        setAuthMessage('#inviteResult', message, 'error');
      } else setAuthMessage('#inviteResult', '邀请未完成，请稍后重试。', 'error');
    } catch (error) { setAuthMessage('#inviteResult', cloudErrorMessage(error), 'error'); }
    finally { button.disabled = false; }
  };
  $('#copyParentInviteLink').onclick = async () => {
    const shareUrl = $('#copyParentInviteLink').dataset.shareUrl;
    if (!shareUrl) return showToast('暂无可复制的邀请链接');
    try {
      await navigator.clipboard.writeText(shareUrl);
      showToast('邀请链接已复制', 'success');
    } catch {
      setAuthMessage('#inviteResult', '浏览器未允许自动复制，请重新点击复制按钮。', 'error');
    }
  };
  $('#childPinButton').onclick = () => {
    if (!state.cloudMode) return showToast('登录家长账号后可设置孩子 PIN');
    $('#newChildPin').value = '';
    $('#newChildPinConfirm').value = '';
    setAuthMessage('#childPinResult', '孩子登录时需要同时输入家庭码和孩子 PIN。');
    $('#childPinDialog').showModal();
  };
  $('#saveChildPin').onclick = async () => {
    const pin = $('#newChildPin').value;
    const confirmPin = $('#newChildPinConfirm').value;
    if (!/^[0-9]{4}$/.test(pin)) return setAuthMessage('#childPinResult', '请输入四位数字 PIN', 'error');
    if (pin !== confirmPin) return setAuthMessage('#childPinResult', '两次输入的孩子 PIN 不一致', 'error');
    if (isWeakPin(pin)) return setAuthMessage('#childPinResult', '请不要使用连续或重复数字作为孩子 PIN', 'error');
    setAuthMessage('#childPinResult', '正在保存…');
    try {
      const result = await window.KoalaCloud.createChildLogin(state.context.family_id, pin);
      $('#newChildPin').value = '';
      $('#newChildPinConfirm').value = '';
      $('#childPinDialog').close();
      showToast(`孩子 PIN 已保存 · 家庭码 ${formatFamilyCode(result.familyCode)}`, 'success');
    } catch (error) { setAuthMessage('#childPinResult', cloudErrorMessage(error), 'error'); }
  };
  $('#copyFamilyCodeButton').onclick = async () => {
    const code = normalizeFamilyCode(state.context?.family_code);
    if (!code) return showToast('家庭码尚未生成');
    try { await navigator.clipboard.writeText(code); showToast(`家庭码 ${formatFamilyCode(code)} 已复制`); }
    catch { showToast(`家庭码：${formatFamilyCode(code)}`); }
  };
  $('#parentPinButton').onclick = () => openParentPinSetup(false);
  $('#saveParentPin').onclick = async () => {
    const pin = $('#newParentPin').value;
    const confirmPin = $('#newParentPinConfirm').value;
    if (!/^[0-9]{4}$/.test(pin)) return setAuthMessage('#parentPinResult', '请输入四位数字 PIN', 'error');
    if (pin !== confirmPin) return setAuthMessage('#parentPinResult', '两次输入的家长 PIN 不一致', 'error');
    if (isWeakPin(pin)) return setAuthMessage('#parentPinResult', '请不要使用连续或重复数字作为家长 PIN', 'error');
    try {
      await storeParentPin(pin);
      state.parentUnlocked = true;
      updateParentPinStatus();
      const openParentAfterSave = state.openParentAfterPinSetup;
      state.openParentAfterPinSetup = false;
      $('#parentPinDialog').close();
      showToast('家长 PIN 已保存到当前设备，不会上传云端');
      if (openParentAfterSave) switchView('parent');
    } catch { setAuthMessage('#parentPinResult', '当前浏览器无法安全保存 PIN', 'error'); }
  };
  $('#signOutButton').onclick = async () => {
    try {
      await window.KoalaCloud.signOut();
      localStorage.removeItem(PARENT_PIN_KEY);
      localStorage.removeItem(LEGACY_PARENT_PIN_KEY);
      location.reload();
    } catch (error) { showToast(cloudErrorMessage(error)); }
  };
  $('#childAccountButton').onclick = () => $('#childAccountDialog').showModal();
  $('#switchChildAccount').onclick = () => leaveChildAccount('switch');
  $('#exitChildAccount').onclick = () => leaveChildAccount('exit');
  const handleNotificationToggle = async event => {
    if (!state.cloudMode) { event.target.checked = false; return showToast('接入 Supabase 后才能开启跨设备提醒'); }
    try {
      if (event.target.checked) await window.KoalaCloud.enablePushNotifications();
      else await window.KoalaCloud.disablePushNotifications();
      showToast(event.target.checked ? '通知已经开启' : '通知已经关闭');
    } catch (error) { event.target.checked = false; showToast(cloudErrorMessage(error)); }
  };
  $('#taskReminderToggle').onchange = handleNotificationToggle;
  $('#parentReminderToggle').onchange = handleNotificationToggle;
  $('#installButton').onclick = () => showToast('正式部署后，可从浏览器菜单“添加到主屏幕”');
  initializeCloudMode();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
});
