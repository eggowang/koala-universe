(function () {
  const SDK_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
  let client = null;
  let context = null;
  let realtimeChannel = null;

  function config() { return window.KOALA_CONFIG || {}; }
  function isConfigured() {
    const value = config();
    return value.mode === 'cloud' && /^https:\/\/.+\.supabase\.co$/.test(value.supabaseUrl || '') && Boolean(value.supabasePublishableKey);
  }
  function requireClient() {
    if (!client) throw new Error('CLOUD_NOT_INITIALIZED');
    return client;
  }
  async function init() {
    if (!isConfigured()) return { configured: false };
    const { createClient } = await import(SDK_URL);
    client = createClient(config().supabaseUrl, config().supabasePublishableKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    return { configured: true, session: data.session };
  }
  async function signUpParent({ email, password, displayName }) {
    const redirect = config().siteUrl || `${location.origin}${location.pathname}`;
    const { data, error } = await requireClient().auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName, app_role: 'parent' }, emailRedirectTo: redirect },
    });
    if (error) throw error;
    return data;
  }
  async function signInParent({ email, password }) {
    const { data, error } = await requireClient().auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }
  async function signInChild({ familyCode, pin }) {
    const code = familyCode.replace(/[^a-z0-9]/gi, '').slice(0, 10).toUpperCase();
    if (!/^[A-Z0-9]{6,10}$/.test(code)) throw new Error('FAMILY_CODE_INVALID');
    if (!/^[0-9]{4}$/.test(pin)) throw new Error('PIN_MUST_BE_FOUR_DIGITS');
    const { data: loginEmail, error: resolveError } = await requireClient().rpc('resolve_child_login', { p_family_code: code });
    if (resolveError || !loginEmail) throw resolveError || new Error('家庭码不存在或尚未设置孩子 PIN');
    const { data, error } = await requireClient().auth.signInWithPassword({
      email: loginEmail,
      password: `Koala!${code}!${pin}`,
    });
    if (error) throw error;
    localStorage.setItem('koala-family-code', code);
    return data;
  }
  async function signOut() {
    if (realtimeChannel) await requireClient().removeChannel(realtimeChannel);
    realtimeChannel = null;
    context = null;
    const { error } = await requireClient().auth.signOut();
    if (error) throw error;
  }
  async function getSession() {
    const { data, error } = await requireClient().auth.getSession();
    if (error) throw error;
    return data.session;
  }
  function onAuthStateChange(callback) { return requireClient().auth.onAuthStateChange(callback); }
  async function getContext() {
    const { data, error } = await requireClient().rpc('my_family_context');
    if (error) throw error;
    context = Array.isArray(data) ? data[0] : data;
    return context || null;
  }
  async function createFamily(payload) {
    const { data, error } = await requireClient().rpc('create_family', {
      p_family_name: payload.familyName,
      p_parent_name: payload.parentName,
      p_child_full_name: payload.childFullName,
      p_child_nickname: payload.childNickname,
    });
    if (error) throw error;
    return Array.isArray(data) ? data[0] : data;
  }
  async function acceptInvite(token, displayName) {
    const { data, error } = await requireClient().rpc('accept_parent_invite', { p_token: token, p_display_name: displayName });
    if (error) throw error;
    return data;
  }
  async function createChildLogin(familyId, pin) {
    if (!/^[0-9]{4}$/.test(pin)) throw new Error('PIN_MUST_BE_FOUR_DIGITS');
    const { data, error } = await requireClient().functions.invoke('create-child-login', { body: { familyId, pin } });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  }
  async function updateFamilyCode(familyId, code, pin) {
    const normalizedCode = String(code || '').replace(/[^a-z0-9]/gi, '').slice(0, 10).toUpperCase();
    if (!/^[A-HJ-NP-Z2-9]{6,10}$/.test(normalizedCode)) throw new Error('FAMILY_CODE_FORMAT_INVALID');
    if (!/^[0-9]{4}$/.test(pin)) throw new Error('PIN_MUST_BE_FOUR_DIGITS');
    const { data, error } = await requireClient().functions.invoke('update-family-code', {
      body: { familyId, code: normalizedCode, pin },
    });
    if (error) {
      let serverMessage = '';
      try { serverMessage = (await error.context?.json())?.error || ''; } catch { /* Preserve the standard function error below. */ }
      throw new Error(serverMessage || error.message);
    }
    if (data?.error) throw new Error(data.error);
    return data;
  }
  async function inviteParent(familyId, email) {
    const { data, error } = await requireClient().functions.invoke('invite-parent', { body: { familyId, email } });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  }
  async function loadAppData(date) {
    const ctx = await getContext();
    if (!ctx) return { context: null };
    const answerQuery = ctx.member_role === 'parent'
      ? requireClient().from('learning_answers').select('*').eq('family_id', ctx.family_id).order('updated_at', { ascending: false })
      : Promise.resolve({ data: [], error: null });
    const [missionResult, rewardResult, balanceResult, diamondBalanceResult, exchangeResult, familyResult, learningResult, materialLinkResult, answerResult, templateResult, sectionResult, redemptionResult, starLedgerResult, diamondLedgerResult, streakResult] = await Promise.all([
      requireClient().from('missions').select('*').eq('family_id', ctx.family_id).eq('scheduled_date', date).order('sort_order'),
      requireClient().from('rewards').select('*').eq('family_id', ctx.family_id).eq('active', true).order('sort_order'),
      requireClient().rpc('current_star_balance', { p_child_id: ctx.child_id }),
      requireClient().rpc('current_diamond_balance', { p_child_id: ctx.child_id }),
      requireClient().from('diamond_exchanges').select('*').eq('family_id', ctx.family_id).eq('status', 'pending').order('requested_at', { ascending: false }),
      requireClient().from('families').select('stars_per_diamond, streak_3_bonus, streak_7_bonus, streak_30_bonus').eq('id', ctx.family_id).single(),
      requireClient().from('learning_materials').select('*').eq('family_id', ctx.family_id).eq('active', true).order('sort_order'),
      requireClient().from('learning_material_task_links').select('*').eq('family_id', ctx.family_id),
      answerQuery,
      requireClient().from('task_templates').select('*').eq('family_id', ctx.family_id).eq('active', true).order('created_at'),
      requireClient().from('template_sections').select('*').eq('family_id', ctx.family_id).order('sort_order'),
      requireClient().from('redemptions').select('*').eq('family_id', ctx.family_id).eq('status', 'pending').order('requested_at', { ascending: false }),
      requireClient().from('star_ledger').select('id, delta, reason, created_at').eq('family_id', ctx.family_id).order('created_at', { ascending: false }).limit(80),
      requireClient().from('diamond_ledger').select('id, delta, reason, created_at').eq('family_id', ctx.family_id).order('created_at', { ascending: false }).limit(80),
      requireClient().rpc('current_task_streak', { p_child_id: ctx.child_id }),
    ]);
    for (const result of [missionResult, rewardResult, balanceResult, diamondBalanceResult, exchangeResult, familyResult, learningResult, materialLinkResult, answerResult, templateResult, sectionResult, redemptionResult, starLedgerResult, diamondLedgerResult, streakResult]) if (result.error) throw result.error;
    let learningMaterials = learningResult.data || [];
    const materialLinks = materialLinkResult.data || [];
    let learningAnswers = answerResult.data || [];
    if (ctx.member_role === 'parent' && !learningMaterials.length) {
      const seedResult = await requireClient().rpc('seed_default_learning_materials');
      if (seedResult.error) throw seedResult.error;
      const refreshedLearning = await requireClient().from('learning_materials').select('*').eq('family_id', ctx.family_id).eq('active', true).order('sort_order');
      if (refreshedLearning.error) throw refreshedLearning.error;
      learningMaterials = refreshedLearning.data || [];
      const seedAnswers = await requireClient().rpc('seed_default_learning_answers');
      if (seedAnswers.error) throw seedAnswers.error;
      const refreshedAnswers = await requireClient().from('learning_answers').select('*').eq('family_id', ctx.family_id).order('updated_at', { ascending: false });
      if (refreshedAnswers.error) throw refreshedAnswers.error;
      learningAnswers = refreshedAnswers.data || [];
    }
    const sectionIds = (sectionResult.data || []).map((item) => item.id);
    let templateTasks = [];
    if (sectionIds.length) {
      const { data, error } = await requireClient().from('template_tasks').select('*')
        .eq('family_id', ctx.family_id)
        .eq('active', true)
        .in('section_id', sectionIds)
        .order('sort_order');
      if (error) throw error;
      templateTasks = data || [];
    }
    return {
      context: ctx,
      missions: missionResult.data || [],
      rewards: rewardResult.data || [],
      stars: Number(balanceResult.data || 0),
      diamonds: Number(diamondBalanceResult.data || 0),
      starsPerDiamond: Number(familyResult.data?.stars_per_diamond || 10),
      streakSettings: {
        bonus3: Number(familyResult.data?.streak_3_bonus ?? 3),
        bonus7: Number(familyResult.data?.streak_7_bonus ?? 7),
        bonus30: Number(familyResult.data?.streak_30_bonus ?? 30),
      },
      currentStreak: Number(streakResult.data || 0),
      diamondExchanges: exchangeResult.data || [],
      redemptions: redemptionResult.data || [],
      pointLedger: [
        ...(starLedgerResult.data || []).map(item => ({ ...item, currency: 'star' })),
        ...(diamondLedgerResult.data || []).map(item => ({ ...item, currency: 'diamond' })),
      ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
      learningMaterials,
      materialLinks,
      learningAnswers,
      templates: templateResult.data || [],
      sections: sectionResult.data || [],
      templateTasks,
    };
  }
  async function uploadEvidence({ file, missionId, familyId, childId }) {
    const extensionMap = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic' };
    const extension = extensionMap[file.type] || 'jpg';
    const path = `${familyId}/${childId}/${missionId}/${crypto.randomUUID()}.${extension}`;
    const { data, error } = await requireClient().storage.from('task-evidence').upload(path, file, {
      contentType: file.type || 'image/jpeg', cacheControl: '3600', upsert: false,
    });
    if (error) throw error;
    return data.path;
  }
  async function submitMission(missionId, evidencePath = null) {
    const { error } = await requireClient().rpc('submit_mission', { p_mission_id: missionId, p_evidence_path: evidencePath });
    if (error) throw error;
    requireClient().functions.invoke('send-push', { body: { type: 'mission_submitted', missionId } }).catch(() => {});
  }
  async function reviewMission(missionId, approve, reason = null) {
    const { error } = await requireClient().rpc('review_mission', { p_mission_id: missionId, p_approve: approve, p_reason: reason });
    if (error) throw error;
  }
  async function requestRedemption(rewardId) {
    const { data, error } = await requireClient().rpc('request_redemption', { p_reward_id: rewardId });
    if (error) throw error;
    return data;
  }
  async function reviewRedemption(redemptionId, approve, reason = null) {
    const { data, error } = await requireClient().rpc('review_redemption', {
      p_redemption_id: redemptionId,
      p_approve: approve,
      p_reason: reason,
    });
    if (error) throw error;
    return data;
  }
  async function generateAiMaterial({ subject, materialType, request }) {
    const { data, error } = await requireClient().functions.invoke('ai-material-assistant', {
      body: { familyId: context.family_id, subject, materialType, request },
    });
    if (error) {
      let message = error.message || 'AI_ASSISTANT_FAILED';
      try {
        const detail = await error.context?.json();
        if (detail?.error) message = detail.error;
      } catch {}
      throw new Error(message);
    }
    if (!data?.text) throw new Error(data?.error || 'AI_EMPTY_RESPONSE');
    return data.text;
  }
  async function requestDiamondExchange() {
    const { data, error } = await requireClient().rpc('request_diamond_exchange');
    if (error) throw error;
    return data;
  }
  async function reviewDiamondExchange(exchangeId, approve, reason = null) {
    const { data, error } = await requireClient().rpc('review_diamond_exchange', {
      p_exchange_id: exchangeId,
      p_approve: approve,
      p_reason: reason,
    });
    if (error) throw error;
    return data;
  }
  async function saveDiamondExchangeRate(familyId, starsPerDiamond) {
    const { data, error } = await requireClient().rpc('set_diamond_exchange_rate', {
      p_family_id: familyId,
      p_stars_per_diamond: starsPerDiamond,
    });
    if (error) throw error;
    return data;
  }
  async function resetChildPoints(childId, resetStars, resetDiamonds) {
    const { data, error } = await requireClient().rpc('reset_child_points', {
      p_child_id: childId,
      p_reset_stars: Boolean(resetStars),
      p_reset_diamonds: Boolean(resetDiamonds),
    });
    if (error) throw error;
    return data;
  }
  async function saveStreakRewards(familyId, bonus3, bonus7, bonus30) {
    const { data, error } = await requireClient().rpc('set_streak_rewards', {
      p_family_id: familyId,
      p_bonus_3: bonus3,
      p_bonus_7: bonus7,
      p_bonus_30: bonus30,
    });
    if (error) throw error;
    return data;
  }
  async function adjustChildPoints(childId, starDelta, diamondDelta, reason) {
    const { data, error } = await requireClient().rpc('adjust_child_points', {
      p_child_id: childId,
      p_star_delta: starDelta,
      p_diamond_delta: diamondDelta,
      p_reason: reason,
    });
    if (error) throw error;
    return data;
  }
  async function loadHistoryData(startDate, endDate) {
    if (!context) await getContext();
    const startTimestamp = `${startDate}T00:00:00+08:00`;
    const end = new Date(`${endDate}T00:00:00+08:00`);
    end.setDate(end.getDate() + 1);
    const endTimestamp = end.toISOString();
    const [missionResult, starResult, diamondResult] = await Promise.all([
      requireClient().from('missions').select('id, scheduled_date, section_name, title, stars, status').eq('family_id', context.family_id).gte('scheduled_date', startDate).lte('scheduled_date', endDate).order('scheduled_date').order('sort_order'),
      requireClient().from('star_ledger').select('id, delta, reason, created_at').eq('family_id', context.family_id).gte('created_at', startTimestamp).lt('created_at', endTimestamp).order('created_at', { ascending: false }),
      requireClient().from('diamond_ledger').select('id, delta, reason, created_at').eq('family_id', context.family_id).gte('created_at', startTimestamp).lt('created_at', endTimestamp).order('created_at', { ascending: false }),
    ]);
    for (const result of [missionResult, starResult, diamondResult]) if (result.error) throw result.error;
    return {
      missions: missionResult.data || [],
      pointLedger: [
        ...(starResult.data || []).map(item => ({ ...item, currency: 'star' })),
        ...(diamondResult.data || []).map(item => ({ ...item, currency: 'diamond' })),
      ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
    };
  }
  async function publishTemplate({ templateId, taskIds, startDate, days, collision }) {
    const { data, error } = await requireClient().rpc('publish_template_selection', {
      p_template_id: templateId,
      p_task_ids: taskIds,
      p_start_date: startDate,
      p_days: days,
      p_collision: collision,
    });
    if (error) throw error;
    return data;
  }
  async function publishWeeklyPlan({ templateId, plan, collision }) {
    const { data, error } = await requireClient().rpc('publish_weekly_plan', {
      p_template_id: templateId,
      p_plan: plan,
      p_collision: collision,
    });
    if (error) throw error;
    return data;
  }
  async function publishTemplateTask({ templateTaskId, scheduledDate, days }) {
    const { data, error } = await requireClient().rpc('publish_template_task', {
      p_template_task_id: templateTaskId,
      p_scheduled_date: scheduledDate,
      p_days: days,
    });
    if (error) throw error;
    return data;
  }
  async function saveTemplateTask(task) {
    const payload = {
      family_id: context.family_id,
      section_id: task.sectionId,
      title: task.name,
      stars: task.stars,
      requires_photo: task.photo,
      icon_type: task.iconType || 'mission',
      subject: task.subject || null,
      sort_order: task.sortOrder || 100,
      active: true,
      updated_at: new Date().toISOString(),
    };
    if (!task.id) {
      const { data: duplicate, error: duplicateError } = await requireClient()
        .from('template_tasks')
        .select('id')
        .eq('family_id', context.family_id)
        .eq('section_id', task.sectionId)
        .eq('title', task.name)
        .eq('active', true)
        .limit(1)
        .maybeSingle();
      if (duplicateError) throw duplicateError;
      if (duplicate) throw new Error('TASK_ALREADY_EXISTS');
      const { data, error } = await requireClient().from('template_tasks')
        .insert(payload).select('id').single();
      if (error) throw error;
      if (!data?.id) throw new Error('TASK_CREATE_NOT_APPLIED');
      return data.id;
    }
    const { data, error } = await requireClient().from('template_tasks')
      .update(payload)
      .eq('id', task.id)
      .eq('family_id', context.family_id)
      .select('id')
      .maybeSingle();
    if (error) throw error;
    if (!data?.id) throw new Error('TASK_UPDATE_NOT_APPLIED');
    return data.id;
  }
  async function saveTemplateSection(section) {
    const payload = {
      template_id: section.templateId,
      family_id: context.family_id,
      name: section.name,
      reminder_time: section.reminderTime || null,
      sort_order: Number(section.sortOrder || 0),
    };
    if (section.id) {
      const { data, error } = await requireClient().from('template_sections')
        .update(payload).eq('id', section.id).eq('family_id', context.family_id).select('id').maybeSingle();
      if (error) throw error;
      if (!data?.id) throw new Error('SECTION_UPDATE_NOT_APPLIED');
      return data.id;
    }
    const { data, error } = await requireClient().from('template_sections').insert(payload).select('id').single();
    if (error) throw error;
    if (!data?.id) throw new Error('SECTION_CREATE_NOT_APPLIED');
    return data.id;
  }
  async function deleteTemplateSection(sectionId) {
    const { error } = await requireClient().from('template_sections')
      .delete().eq('id', sectionId).eq('family_id', context.family_id);
    if (error) throw error;
  }
  async function deleteTemplateTask(taskId) {
    const { data, error } = await requireClient().rpc('delete_template_task', {
      p_template_task_id: taskId,
      p_delete_upcoming: true,
    });
    if (error) throw error;
    let result = data;
    if (typeof result === 'string') {
      try { result = JSON.parse(result); } catch {}
    }
    if (Array.isArray(result)) result = result[0];
    if (Number(result?.deleted_templates || 0) !== 1) throw new Error('TASK_DELETE_NOT_APPLIED');
    return result;
  }
  async function setTaskLearningMaterials({ taskId, materialIds }) {
    const { data, error } = await requireClient().rpc('set_task_learning_materials', {
      p_template_task_id: taskId,
      p_material_ids: materialIds || [],
    });
    if (error) throw error;
    return Number(data || 0);
  }
  async function saveLearningMaterial(material) {
    const { data: userData, error: userError } = await requireClient().auth.getUser();
    if (userError || !userData.user) throw userError || new Error('AUTH_REQUIRED');
    const payload = {
      family_id: context.family_id,
      template_task_id: material.taskId || null,
      subject: material.subject,
      grade: 2,
      semester: '上册',
      material_type: material.type,
      title: material.title,
      content: material.content,
      source_label: material.source || '家长自建',
      source_url: material.url || null,
      published: material.published,
      active: true,
      updated_at: new Date().toISOString(),
    };
    let materialId = material.id;
    if (material.id) {
      const { error } = await requireClient().from('learning_materials').update(payload)
        .eq('id', material.id).eq('family_id', context.family_id);
      if (error) throw error;
    } else {
      const { data, error } = await requireClient().from('learning_materials')
        .insert({ ...payload, created_by: userData.user.id }).select('id').single();
      if (error) throw error;
      materialId = data.id;
    }
    if (material.answer?.trim()) {
      const answerPayload = {
        family_id: context.family_id,
        material_id: materialId,
        answer_content: material.answer.trim(),
        created_by: userData.user.id,
        updated_at: new Date().toISOString(),
      };
      const { error } = await requireClient().from('learning_answers').upsert(answerPayload, { onConflict: 'material_id' });
      if (error) throw error;
    } else if (material.id) {
      const { error } = await requireClient().from('learning_answers').delete()
        .eq('material_id', material.id).eq('family_id', context.family_id);
      if (error) throw error;
    }
  }
  async function deleteLearningMaterial(materialId) {
    const { error } = await requireClient().from('learning_materials').delete()
      .eq('id', materialId).eq('family_id', context.family_id);
    if (error) throw error;
  }
  async function saveReward(reward) {
    const payload = {
      family_id: context.family_id,
      title: reward.name,
      icon: reward.icon || '🎁',
      cost: reward.cost,
      stock: reward.stock ?? null,
      active: true,
      sort_order: reward.sortOrder || 100,
      updated_at: new Date().toISOString(),
    };
    if (reward.id) {
      const { error } = await requireClient().from('rewards').update(payload).eq('id', reward.id);
      if (error) throw error;
      return;
    }
    const { data: userData, error: userError } = await requireClient().auth.getUser();
    if (userError || !userData.user) throw userError || new Error('AUTH_REQUIRED');
    const { error } = await requireClient().from('rewards').insert({ ...payload, created_by: userData.user.id });
    if (error) throw error;
  }
  async function deleteReward(rewardId) {
    const { data, error } = await requireClient().rpc('delete_reward', { p_reward_id: rewardId });
    if (error) throw error;
    if (data !== true) throw new Error('REWARD_DELETE_NOT_APPLIED');
  }
  async function getEvidenceUrl(path) {
    const { data, error } = await requireClient().storage.from('task-evidence').createSignedUrl(path, 600);
    if (error) throw error;
    return data.signedUrl;
  }
  function urlBase64ToUint8Array(value) {
    const padding = '='.repeat((4 - value.length % 4) % 4);
    const base64 = (value + padding).replaceAll('-', '+').replaceAll('_', '/');
    const raw = atob(base64);
    return Uint8Array.from([...raw].map((character) => character.charCodeAt(0)));
  }
  async function enablePushNotifications() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) throw new Error('当前浏览器不支持网页通知');
    const appleMobile = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
    if (appleMobile && !standalone) throw new Error('请先将网页添加到主屏幕，再从主屏幕打开并开启通知');
    if (!config().vapidPublicKey) throw new Error('尚未配置 VAPID 公钥');
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') throw new Error('通知权限未开启');
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(config().vapidPublicKey),
    });
    const json = subscription.toJSON();
    const { data: userData, error: userError } = await requireClient().auth.getUser();
    if (userError || !userData.user || !json.endpoint || !json.keys?.p256dh || !json.keys?.auth) throw userError || new Error('PUSH_SUBSCRIPTION_INVALID');
    const { error } = await requireClient().from('push_subscriptions').upsert({
      user_id: userData.user.id,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth_secret: json.keys.auth,
      device_label: navigator.userAgent.includes('iPad') ? 'iPad' : '手机或电脑',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'endpoint' });
    if (error) throw error;
    return true;
  }
  async function disablePushNotifications() {
    if (!('serviceWorker' in navigator)) return;
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return;
    await requireClient().from('push_subscriptions').delete().eq('endpoint', subscription.endpoint);
    await subscription.unsubscribe();
  }
  async function subscribe(onChange) {
    if (!context) await getContext();
    if (!context) return null;
    if (realtimeChannel) await requireClient().removeChannel(realtimeChannel);
    realtimeChannel = requireClient().channel(`koala-family-${context.family_id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'template_tasks' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'template_sections' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'missions', filter: `family_id=eq.${context.family_id}` }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rewards', filter: `family_id=eq.${context.family_id}` }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'redemptions', filter: `family_id=eq.${context.family_id}` }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'star_ledger', filter: `family_id=eq.${context.family_id}` }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'diamond_exchanges', filter: `family_id=eq.${context.family_id}` }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'diamond_ledger', filter: `family_id=eq.${context.family_id}` }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'learning_materials', filter: `family_id=eq.${context.family_id}` }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'learning_material_task_links', filter: `family_id=eq.${context.family_id}` }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'learning_answers', filter: `family_id=eq.${context.family_id}` }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'streak_awards', filter: `family_id=eq.${context.family_id}` }, onChange)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'families', filter: `id=eq.${context.family_id}` }, onChange)
      .subscribe();
    return realtimeChannel;
  }

  window.KoalaCloud = {
    isConfigured, init, getSession, onAuthStateChange, signUpParent, signInParent, signInChild, signOut,
    getContext, createFamily, acceptInvite, createChildLogin, updateFamilyCode, inviteParent, loadAppData, uploadEvidence,
    submitMission, reviewMission, requestRedemption, reviewRedemption, generateAiMaterial, requestDiamondExchange, reviewDiamondExchange, saveDiamondExchangeRate, resetChildPoints,
    saveStreakRewards, adjustChildPoints, loadHistoryData,
    publishTemplate, publishWeeklyPlan, publishTemplateTask, saveTemplateTask, saveTemplateSection, deleteTemplateSection, deleteTemplateTask, setTaskLearningMaterials, saveLearningMaterial, deleteLearningMaterial, saveReward, deleteReward,
    getEvidenceUrl, enablePushNotifications, disablePushNotifications, subscribe,
  };
})();
