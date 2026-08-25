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
const state = {
  tasks: JSON.parse(localStorage.getItem('koala-demo-tasks') || 'null') || initialTasks,
  rewards: JSON.parse(localStorage.getItem('koala-demo-rewards') || 'null') || initialRewards,
  stars: Number(localStorage.getItem('koala-demo-stars') || 12),
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
  quickPublishTaskId: null
};
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const defaultTaskGroups = ['早晨', '放学后', '锻炼', '睡前'];
const groupIcons = { '早晨': '☀️', '放学后': '🛰️', '锻炼': '🏃', '睡前': '🌙' };

function sameId(a, b) { return String(a) === String(b); }
function findById(items, id) { return items.find(item => sameId(item.id, id)); }
const PARENT_PIN_KEY = 'koala-parent-pin-v2';
const LEGACY_PARENT_PIN_KEY = 'koala-parent-pin';

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

function save() {
  if (state.cloudMode) return;
  localStorage.setItem('koala-demo-tasks', JSON.stringify(state.tasks));
  localStorage.setItem('koala-demo-rewards', JSON.stringify(state.rewards));
  localStorage.setItem('koala-demo-stars', String(state.stars));
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
    return `<section class="task-group"><div class="task-group__title"><div><span>${groupIcons[group] || '🪐'}</span><h3>${group}</h3></div><span>${tasks.length} 项</span></div>${tasks.map(task => `<div class="task-item is-${task.status}" data-task-id="${task.id}">${taskArt(task)}<button class="task-item__check" type="button" aria-label="提交${task.name}">${task.status === 'approved' ? '✓' : task.status === 'submitted' ? '…' : ''}</button><div class="task-item__content"><strong>${task.name}</strong><span>${statusText(task)}</span></div><span class="task-item__stars">⭐ ${task.stars}</span></div>`).join('')}</section>`;
  }).join('');
  $$('.task-item__check').forEach(button => button.addEventListener('click', handleTaskSubmit));
  renderSummary();
}
function renderRewards() {
  $('#childRewards').innerHTML = state.rewards.map(reward => `<article class="reward-card"><span class="reward-card__icon">${reward.icon}</span><strong>${reward.name}</strong><span>⭐ ${reward.cost}</span><button type="button" data-redeem="${reward.id}">申请兑换</button></article>`).join('');
  $('[data-show-rewards]').onclick = () => showToast('已显示全部自定义奖励');
  $$('[data-redeem]').forEach(button => button.onclick = async () => {
    const reward = findById(state.rewards, button.dataset.redeem);
    if (state.stars < reward.cost) return showToast(`还差 ${reward.cost - state.stars} 颗星星，加油！`);
    if (state.cloudMode) {
      if (state.context?.member_role !== 'child') return showToast('请在孩子设备登录后申请兑换');
      try { await window.KoalaCloud.requestRedemption(reward.id); }
      catch (error) { return showToast(cloudErrorMessage(error)); }
    }
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
  renderSummary();
}
function renderManageLists() {
  $('#manageTaskList').innerHTML = getManagedTasks().map(task => `<article class="manage-item"><button class="manage-item__main manage-item__main--publish" type="button" data-quick-publish="${task.id}" aria-label="选择${task.name}的发布日期">${taskArt(task, true)}<div><strong>${task.name}</strong><span>${task.group} · ⭐ ${task.stars} · ${task.photo ? '必须照片' : '无需照片'}</span></div></button><button class="edit" type="button" data-edit-task="${task.id}">编辑</button></article>`).join('');
  $('#manageRewardList').innerHTML = state.rewards.map(reward => `<article class="manage-item"><div><strong>${reward.icon} ${reward.name}</strong><span>需要 ⭐ ${reward.cost} · 已启用</span></div><button class="edit" type="button" data-edit-reward="${reward.id}">编辑</button></article>`).join('');
  $$('[data-edit-task]').forEach(button => button.onclick = () => openEditor('task', button.dataset.editTask));
  $$('[data-quick-publish]').forEach(button => button.onclick = () => openQuickPublishTask(button.dataset.quickPublish));
  $$('[data-edit-reward]').forEach(button => button.onclick = () => openEditor('reward', button.dataset.editReward));
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
  $('#quickPublishDialog').showModal();
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
  const pending = state.tasks.filter(t => t.status === 'submitted').length;
  const approved = state.tasks.filter(t => t.status === 'approved').length;
  $('#starBalance').textContent = state.stars;
  $('#parentStars').textContent = state.stars;
  $('#doneCount').textContent = `${approved}/${state.tasks.length}`;
  $('#pendingCount').textContent = pending;
  $('#approvedCount').textContent = approved;
  $('#reviewBadge').textContent = `${pending} 项`;
  $('#missionSummary').textContent = `今天有 ${state.tasks.length} 个任务，完成后请爸爸妈妈确认。`;
}
function renderAll() { renderTasks(); renderRewards(); renderReview(); renderManageLists(); save(); }

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
    renderAll();
  }
  celebrate();
  showToast(`已确认，考拉获得 ${task.stars} 颗星星`);
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
  $('#editorDialog').showModal();
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
function showToast(message) {
  const toast = $('#toast'); toast.textContent = message; toast.classList.add('is-visible');
  clearTimeout(showToast.timer); showToast.timer = setTimeout(() => toast.classList.remove('is-visible'), 2200);
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
    ['PHOTO_REQUIRED', '这个任务必须上传照片'],
    ['INSUFFICIENT_STARS', '星星不足，暂时不能兑换'],
    ['PARENT_PERMISSION_REQUIRED', '只有家长可以执行这个操作'],
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
  $('#publishButton').onclick = () => $('#publishDialog').showModal();
  $$('[data-quick-date-offset]').forEach(button => button.onclick = () => {
    const date = new Date();
    date.setDate(date.getDate() + Number(button.dataset.quickDateOffset));
    $('#quickPublishDate').value = localIsoDate(date);
    setAuthMessage('#quickPublishMessage', button.dataset.quickDateOffset === '0' ? '将发布到今天。' : '将从明天开始发布。');
  });
  $('#confirmQuickPublish').onclick = confirmQuickPublish;
  $('#publishDays').oninput = e => $('#publishPreviewDays').textContent = `${e.target.value || 1} 天`;
  $('#confirmPublish').onclick = async () => {
    const days = $('#publishRange').value === '仅一天' ? 1 : Number($('#publishDays').value || 1);
    if (!state.cloudMode) { $('#publishDialog').close(); return showToast(`任务已发布 ${days} 天`); }
    try {
      const template = state.templates[0];
      if (!template) return showToast('请先创建一个任务模板');
      const collision = $('input[name="collision"]:checked').value;
      const count = await window.KoalaCloud.publishTemplate({ templateId: template.id, startDate: $('#publishStartDate').value, days, collision });
      $('#publishDialog').close();
      await loadCloudData();
      showToast(`已发布 ${count} 项任务`);
    } catch (error) { showToast(cloudErrorMessage(error)); }
  };
  $('#addTaskButton').onclick = () => openEditor('task');
  $('#addRewardButton').onclick = () => openEditor('reward');
  $('#saveEditor').onclick = saveEditor;
  $('#photoInput').onchange = e => { state.pendingPhotoFile = e.target.files[0] || null; $('#submitWithPhoto').disabled = !state.pendingPhotoFile; };
  $('#submitWithPhoto').onclick = async () => { const task = findById(state.tasks, state.pendingPhotoTask); $('#photoDialog').close(); await submitTask(task, state.pendingPhotoFile); };
  $('#refreshButton').onclick = async () => {
    if (state.cloudMode) {
      try { await loadCloudData(); showToast('已获取最新任务'); }
      catch (error) { showToast(cloudErrorMessage(error)); }
    } else showToast('任务已经是最新状态');
  };
  $('#inviteParentButton').onclick = () => state.cloudMode ? $('#inviteParentDialog').showModal() : showToast('接入 Supabase 后即可发送邀请');
  $('#sendParentInvite').onclick = async () => {
    const email = $('#inviteParentEmail').value.trim();
    setAuthMessage('#inviteResult', '正在发送邀请…');
    try {
      const result = await window.KoalaCloud.inviteParent(state.context.family_id, email);
      setAuthMessage('#inviteResult', result.emailSent ? '邀请邮件已发送。' : '邮件未发送，可复制生成的邀请链接。', result.emailSent ? 'success' : 'error');
    } catch (error) { setAuthMessage('#inviteResult', cloudErrorMessage(error), 'error'); }
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
      setAuthMessage('#childPinResult', `已保存。家庭码：${formatFamilyCode(result.familyCode)}`, 'success');
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
