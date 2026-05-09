// ===== NovelRoundTable v2 - Route B: Frontend Direct AI API =====
// 纯前端调用，零服务器成本，API Key 加密存储在用户本地浏览器
;(function() {
'use strict';

// ===== 工具函数 =====
function debounce(fn, ms) { let t; return function(...a) { clearTimeout(t); t = setTimeout(() => fn.apply(this, a), ms); }; }

// ===== 加密存储模块 (AES-GCM via Web Crypto API) =====
const CryptoStore = {
  _keyMaterial: null,
  _getKey: async function() {
    if (this._keyMaterial) return this._keyMaterial;
    // 使用固定 passphrase 派生密钥（防止肉眼直读 + 扩展窃取明文）
    // 注意：这不能防御有针对性的攻击者，但大幅提升安全基线
    const enc = new TextEncoder();
    const base = await crypto.subtle.importKey('raw', enc.encode('NRT-v2-' + location.origin), 'PBKDF2', false, ['deriveKey']);
    this._keyMaterial = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: enc.encode('novel-roundtable-salt'), iterations: 100000, hash: 'SHA-256' },
      base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
    );
    return this._keyMaterial;
  },
  encrypt: async function(plaintext) {
    const key = await this._getKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const enc = new TextEncoder();
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plaintext));
    // 存储格式: base64(iv + ciphertext)
    const buf = new Uint8Array(iv.length + ct.byteLength);
    buf.set(iv); buf.set(new Uint8Array(ct), iv.length);
    return btoa(String.fromCharCode(...buf));
  },
  decrypt: async function(encoded) {
    try {
      const key = await this._getKey();
      const raw = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
      const iv = raw.slice(0, 12);
      const ct = raw.slice(12);
      const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
      return new TextDecoder().decode(pt);
    } catch { return null; }
  }
};

// ===== API 平台配置 =====
const API_PLATFORMS = {
  friday: { name: 'Friday (美团内部)', url: 'https://aigc.sankuai.com/v1/openai/native/chat/completions', authType: 'appid' },
  deepseek: { name: 'DeepSeek (官方)', url: 'https://api.deepseek.com/v1/chat/completions', authType: 'bearer' },
  openai_compatible: { name: 'OpenAI 兼容', url: '', authType: 'bearer' }
};

// ===== 可用模型库 =====
const AVAILABLE_MODELS = {
  'longcat-2.0-preview': { name: 'LongCat-2.0-Preview', provider: '美团', platform: 'friday', price: { in: 0, out: 0 }, ctx: '1024K', tier: 'free', tags: ['复杂推理'], description: '美团最新旗舰' },
  'longcat-ultra-preview': { name: 'LongCat-Ultra-Preview', provider: '美团', platform: 'friday', price: { in: 0, out: 0 }, ctx: '16K', tier: 'free', tags: ['文本创作'], description: '文本创作最强' },
  'qwq-32b': { name: 'QwQ-32B', provider: '阿里(美团部署)', platform: 'friday', price: { in: 0, out: 0 }, ctx: '128K', tier: 'free', tags: ['复杂推理'], description: '推理能力强' },
  'glm-4-flash': { name: 'GLM-4-Flash', provider: '智谱', platform: 'friday', price: { in: 0, out: 0 }, ctx: '128K', tier: 'free', tags: ['通用'], description: '智谱免费模型' },
  'glm-z1-flash': { name: 'GLM-Z1-Flash', provider: '智谱', platform: 'friday', price: { in: 0, out: 0 }, ctx: '32K', tier: 'free', tags: ['复杂推理'], description: '免费推理模型' },
  'longcat-medium': { name: 'LongCat-Medium', provider: '美团', platform: 'friday', price: { in: 0.5, out: 1 }, ctx: '32K', tier: 'budget', tags: ['角色扮演'], description: '⭐角色扮演专属' },
  'deepseek-v4-flash': { name: 'DeepSeek-V4-Flash', provider: 'DeepSeek', platform: 'friday', price: { in: 1, out: 2 }, ctx: '1024K', tier: 'budget', tags: ['复杂推理'], description: '性价比之王' },
  'gpt-4.1-nano': { name: 'GPT-4.1-Nano', provider: 'OpenAI', platform: 'friday', price: { in: 0.72, out: 2.88 }, ctx: '1024K', tier: 'budget', tags: ['通用'], description: 'OpenAI最经济' },
  'gemini-2.5-flash-lite': { name: 'Gemini-2.5-Flash-Lite', provider: 'Google', platform: 'friday', price: { in: 0.72, out: 2.88 }, ctx: '1024K', tier: 'budget', tags: ['复杂推理'], description: 'Google轻量版' },
  'deepseek-v4-pro': { name: 'DeepSeek-V4-Pro', provider: 'DeepSeek', platform: 'friday', price: { in: 3, out: 6 }, ctx: '1024K', tier: 'standard', tags: ['Agent'], description: '最新旗舰' },
  'gpt-o4-mini': { name: 'GPT-o4-mini', provider: 'OpenAI', platform: 'friday', price: { in: 7.92, out: 31.68 }, ctx: '200K', tier: 'standard', tags: ['推理'], description: 'OpenAI推理模型' },
  'claude-sonnet-4.6': { name: 'Claude-Sonnet-4.6', provider: 'Anthropic', platform: 'friday', price: { in: 21.6, out: 108 }, ctx: '200K', tier: 'premium', tags: ['文笔细腻'], description: '文笔细腻' },
  'claude-opus-4.7': { name: 'Claude-Opus-4.7', provider: 'Anthropic', platform: 'friday', price: { in: 36, out: 180 }, ctx: '200K', tier: 'premium', tags: ['最强'], description: '当前最强' },
  'gpt-5.1': { name: 'GPT-5.1', provider: 'OpenAI', platform: 'friday', price: { in: 9, out: 72 }, ctx: '400K', tier: 'premium', tags: ['通用智能'], description: 'OpenAI新一代' },
  'gpt-5.4': { name: 'GPT-5.4', provider: 'OpenAI', platform: 'friday', price: { in: 18, out: 108 }, ctx: '1050K', tier: 'premium', tags: ['百万上下文'], description: '高端旗舰' },
  'deepseek-v4-flash-official': { name: 'DS-V4-Flash（官方）', provider: 'DeepSeek', platform: 'deepseek', price: { in: 1, out: 2 }, ctx: '1024K', tier: 'budget', tags: ['复杂推理'], description: '直连官方' },
  'deepseek-v4-pro-official': { name: 'DS-V4-Pro（官方）', provider: 'DeepSeek', platform: 'deepseek', price: { in: 3, out: 6 }, ctx: '1024K', tier: 'standard', tags: ['Agent'], description: '直连官方旗舰' }
};

// ===== 预设模板 =====
const PRESETS = {
  free: { name: '🆓 免费档', description: '全部用LongCat，¥0/次', costPerRun: '¥0', config: { default: 'longcat-2.0-preview', overrides: {} } },
  standard: { name: '💰 标准档（推荐）', description: 'V4组合，≈¥0.03/次', costPerRun: '≈¥0.03', config: { default: 'deepseek-v4-flash', overrides: { 'chief-editor': 'deepseek-v4-pro', 'plot-architect': 'deepseek-v4-pro', 'continuity-checker': 'qwq-32b' } } },
  premium: { name: '👑 旗舰档', description: 'Claude混合，≈¥0.2/次', costPerRun: '≈¥0.2', config: { default: 'deepseek-v4-flash', overrides: { 'chief-editor': 'claude-sonnet-4.6', 'plot-architect': 'claude-sonnet-4.6', 'style-polisher': 'claude-sonnet-4.6', 'continuity-checker': 'deepseek-v4-pro', 'character-designer': 'longcat-medium', 'dialogue-expert': 'longcat-medium' } } }
};

// ===== 8 位 AI 专家 =====
const EXPERTS = [
  { id: 'chief-editor', name: '总编辑', emoji: '📋', temperature: 0.7, systemPrompt: '你是一位资深网文总编辑，拥有20年从业经验。你的职责是从商业价值和读者市场角度评估小说方案。\n你的评估维度：\n1. 市场定位是否精准（目标读者画像）\n2. 题材热度与差异化\n3. 商业变现潜力（付费点设置、IP改编可能性）\n4. 开篇是否有足够吸引力（黄金三章法则）\n要求：观点犀利，不说废话；用数据和案例支撑判断；明确指出致命问题；给出可执行的改进建议；字数控制在800字以内' },
  { id: 'world-builder', name: '世界观架构师', emoji: '🌍', temperature: 0.7, systemPrompt: '你是一位世界观设计专家，精通历史、经济、社会学。你的职责是审查小说世界观的逻辑自洽性。\n你的评估维度：\n1. 时代背景设定是否准确（如果涉及真实年代）\n2. 经济系统是否合理（主角的商业逻辑能否成立）\n3. 社会结构和权力关系是否自洽\n4. 有没有常识性错误或时代穿帮\n要求：指出具体的逻辑漏洞；提供修正方案；如果设定合理要明确肯定；不要泛泛而谈，要具体到细节；字数控制在800字以内' },
  { id: 'character-designer', name: '人物塑造师', emoji: '🎭', temperature: 0.85, systemPrompt: '你是一位人物心理学专家和角色设计师。你的职责是评估小说中人物的真实感和吸引力。\n你的评估维度：\n1. 主角性格是否立体（优缺点并存）\n2. 人物动机是否合理（行为逻辑链）\n3. 配角是否有记忆点（避免工具人）\n4. 人物成长弧线是否清晰\n5. 人物关系网是否有张力\n要求：指出角色扁平化的问题；提供增加深度的具体方法；用经典角色做参照对比；字数控制在800字以内' },
  { id: 'plot-architect', name: '剧情编排师', emoji: '📖', temperature: 0.8, systemPrompt: '你是一位剧情结构专家，精通各种叙事技巧。你的职责是评估故事节奏和情节设计。\n你的评估维度：\n1. 故事节奏是否合理（爽点间隔、张弛有度）\n2. 冲突设计是否有层次（主线/支线/暗线）\n3. 悬念和伏笔是否到位\n4. 转折是否既出人意料又合情合理\n5. 高潮设置是否够燃\n要求：画出情绪曲线图（用文字描述）；指出节奏拖沓或过快的部分；提供具体的结构优化方案；字数控制在800字以内' },
  { id: 'dialogue-expert', name: '对白专家', emoji: '💬', temperature: 0.9, systemPrompt: '你是一位对白写作专家，精通影视剧本和小说对白技巧。你的职责是评估对话的质量和效果。\n你的评估维度：\n1. 对白是否符合角色身份和性格\n2. 对话是否推动情节或揭示性格（vs 水字数）\n3. 语言风格是否有时代感和场景感\n4. 潜台词和留白是否到位\n5. 对白节奏感（长短交错、打断、沉默）\n要求：挑出不自然的对白并改写示范；提供3-5句"金句"建议；指出对白中的信息倾倒问题；字数控制在800字以内' },
  { id: 'style-polisher', name: '文笔润色师', emoji: '✨', temperature: 0.9, systemPrompt: '你是一位文学评论家和文字美学专家。你的职责是评估写作质量和文字表现力。\n你的评估维度：\n1. 文笔风格是否统一且有辨识度\n2. 描写是否生动（五感细节、环境氛围）\n3. 比喻和修辞是否新颖不老套\n4. 文字节奏感（长短句搭配）\n5. 情感表达是否到位（而非直白告知）\n要求：挑出写得好的段落并说明为什么好；挑出需要改进的段落并示范改写；提供风格提升的具体技巧；字数控制在800字以内' },
  { id: 'continuity-checker', name: '连续性审查员', emoji: '🔍', temperature: 0.6, systemPrompt: '你是一位极其严苛的逻辑审查员，专门找Bug。你的职责是发现所有前后矛盾和逻辑问题。\n你的审查范围：\n1. 时间线矛盾（日期、年龄、事件顺序）\n2. 空间逻辑错误（地理、距离、场景连贯）\n3. 人物设定前后不一（性格突变、能力忽高忽低）\n4. 金手指/外挂是否合理（是否存在"因为主角所以"的逻辑）\n5. 信息不对称问题（角色知道了不该知道的）\n要求：每个问题标注具体位置；严重程度分级：致命BUG🔴 / 明显问题🟡 / 小瑕疵🟢；给出修复建议；字数控制在800字以内' },
  { id: 'toxic-reader', name: '毒舌读者', emoji: '🔥', temperature: 0.95, systemPrompt: '你是一位资深网文读者，看过5000+本小说，非常毒舌但判断精准。你代表最挑剔的读者视角。\n你的吐槽角度：\n1. 第一印象是想追还是想弃？为什么？\n2. 套路感有多重？（0-10分）能猜到后续发展吗？\n3. 有没有"爽"到你的点？\n4. 最让你出戏/想弃文的地方是什么？\n5. 和同类型热门小说相比，有什么优势/劣势？\n要求：说人话，不要文绉绉；越犀利越好，但要言之有理；可以用网络流行语和梗；明确给出追读意愿评分（1-10）；字数控制在800字以内' }
];

// ===== 数据持久化 =====
const STORAGE_KEYS = { API_KEYS: 'roundtable_api_keys_v2', MODEL_CONFIG: 'roundtable_model_config', HISTORY: 'roundtable_history' };

function getUserConfig() {
  const s = localStorage.getItem(STORAGE_KEYS.MODEL_CONFIG);
  if (s) try { return JSON.parse(s); } catch(e) {}
  return { mode: 'preset', selectedPreset: 'free', globalDefault: 'longcat-2.0-preview', experts: {}, basePreset: 'standard', overrides: {} };
}
function saveUserConfig(c) { localStorage.setItem(STORAGE_KEYS.MODEL_CONFIG, JSON.stringify(c)); }

// API Keys: 加密存储 (async)
let _cachedKeys = null;
function normalizeKeys(raw) {
  return { friday: raw.friday || '', deepseek: raw.deepseek || '', openai_compatible: raw.openai_compatible || '', customUrl: raw.customUrl || '' };
}
async function getApiKeys() {
  if (_cachedKeys) return _cachedKeys;
  const s = localStorage.getItem(STORAGE_KEYS.API_KEYS);
  if (!s) return { friday: '', deepseek: '', openai_compatible: '', customUrl: '' };
  // 尝试解密（新格式）
  const decrypted = await CryptoStore.decrypt(s);
  if (decrypted) { try { _cachedKeys = normalizeKeys(JSON.parse(decrypted)); return _cachedKeys; } catch(e) {} }
  // 兼容旧明文格式：读取后自动迁移为加密
  try {
    const old = normalizeKeys(JSON.parse(s));
    _cachedKeys = old;
    await saveApiKeys(old); // 自动加密迁移
    return old;
  } catch(e) {}
  return { friday: '', deepseek: '', openai_compatible: '', customUrl: '' };
}
async function saveApiKeys(k) {
  _cachedKeys = k;
  const encrypted = await CryptoStore.encrypt(JSON.stringify(k));
  localStorage.setItem(STORAGE_KEYS.API_KEYS, encrypted);
}

function getHistory() {
  const s = localStorage.getItem(STORAGE_KEYS.HISTORY);
  if (s) try { return JSON.parse(s); } catch(e) {}
  return [];
}
function saveHistory(h) { localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(h.slice(0, 20))); }

function getModelForExpert(expertId, cfg) {
  if (cfg.mode === 'preset') { const p = PRESETS[cfg.selectedPreset].config; return p.overrides[expertId] || p.default; }
  if (cfg.mode === 'custom') { return cfg.experts[expertId] || cfg.globalDefault; }
  if (cfg.mode === 'hybrid') { if (cfg.overrides[expertId]) return cfg.overrides[expertId]; const p = PRESETS[cfg.basePreset].config; return p.overrides[expertId] || p.default; }
  return 'longcat-2.0-preview';
}

// ===== 成本计算器 =====
function estimateCost(cfg) {
  let total = 0;
  EXPERTS.forEach(e => {
    const m = AVAILABLE_MODELS[getModelForExpert(e.id, cfg)];
    if (m) total += (m.price.in * 2000 + m.price.out * 1000) / 1000000;
  });
  return total;
}
function formatCost(c) { return c === 0 ? '¥0' : c < 0.01 ? '< ¥0.01' : '≈¥' + c.toFixed(2); }

// ===== 统一 AI 调用 =====
const ERROR_MESSAGES = {
  400: '请求参数错误，请检查模型名称是否正确',
  401: 'API Key 无效或已过期，请到设置中重新配置',
  403: '无权访问该模型，请确认 Key 权限或联系平台',
  404: '模型不存在或 API 地址错误，请检查配置',
  429: '请求过于频繁，请稍后重试（触发限流）',
  500: '服务端内部错误，请稍后重试',
  502: '网关错误，API 服务可能暂时不可用',
  503: '服务暂时不可用，请稍后重试'
};

async function callAI(platform, apiKey, model, messages, opts = {}) {
  const pc = API_PLATFORMS[platform];
  if (!pc) throw new Error('未知平台: ' + platform);
  const keys = await getApiKeys();
  const url = platform === 'openai_compatible' ? keys.customUrl : pc.url;
  if (!url) throw new Error('请配置 API 地址');
  if (!apiKey) throw new Error('请配置 ' + pc.name + ' 的 API Key');
  const auth = pc.authType === 'appid' ? apiKey : 'Bearer ' + apiKey;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': auth },
    body: JSON.stringify({ model, messages, max_tokens: opts.max_tokens || 2000, temperature: opts.temperature || 0.8 })
  });
  if (!res.ok) {
    const friendly = ERROR_MESSAGES[res.status];
    if (friendly) throw new Error(friendly);
    const t = await res.text().catch(() => '');
    throw new Error('请求失败 (HTTP ' + res.status + ')：' + (t.slice(0, 100) || '未知错误'));
  }
  const d = await res.json();
  if (!d.choices || !d.choices[0]) throw new Error('API 返回格式异常，请检查模型是否支持 chat 接口');
  return d.choices[0].message.content;
}

// ===== 测试连接 =====
async function testConnection(platform) {
  const keys = await getApiKeys();
  const apiKey = keys[platform];
  if (!apiKey) throw new Error('未填写 API Key');
  const model = platform === 'deepseek' ? 'deepseek-v4-flash-official' : 'longcat-2.0-preview';
  return await callAI(platform, apiKey, model, [{ role: 'user', content: '回复"连接成功"' }], { max_tokens: 20, temperature: 0 });
}

// ===== 8 专家并行讨论 =====
// ===== 统一状态管理 =====
const store = {
  isRoundtableRunning: false,
  currentResults: null,
  chatMessages: []
};

async function runRoundtable(topic, onProgress) {
  if (store.isRoundtableRunning) return;
  store.isRoundtableRunning = true;
  const cfg = getUserConfig();
  const keys = await getApiKeys();
  const startTime = Date.now();

  const promises = EXPERTS.map(async (expert) => {
    const modelId = getModelForExpert(expert.id, cfg);
    const modelInfo = AVAILABLE_MODELS[modelId];
    if (!modelInfo) { onProgress?.({ expertId: expert.id, status: 'error', error: '模型不存在' }); return { expert, modelId, success: false, error: '模型不存在' }; }
    const apiKey = keys[modelInfo.platform];
    if (!apiKey) { onProgress?.({ expertId: expert.id, status: 'error', error: '未配置API Key' }); return { expert, modelId, modelInfo, success: false, error: '未配置 ' + API_PLATFORMS[modelInfo.platform].name + ' Key' }; }
    const t0 = Date.now();
    onProgress?.({ expertId: expert.id, status: 'loading' });
    try {
      const content = await callAI(modelInfo.platform, apiKey, modelId, [
        { role: 'system', content: expert.systemPrompt },
        { role: 'user', content: '请评估以下小说方案：\n\n' + topic }
      ], { temperature: expert.temperature, max_tokens: 2000 });
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      onProgress?.({ expertId: expert.id, status: 'done', elapsed });
      return { expert, modelId, modelInfo, content, elapsed, success: true };
    } catch (err) {
      onProgress?.({ expertId: expert.id, status: 'error', error: err.message });
      return { expert, modelId, modelInfo, success: false, error: err.message };
    }
  });

  const settled = await Promise.allSettled(promises);
  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  const results = settled.map(s => s.status === 'fulfilled' ? s.value : { success: false, error: '未知错误' });

  // Save history
  const entry = { id: Date.now(), topic: topic.slice(0, 200), timestamp: new Date().toISOString(), totalTime, preset: cfg.mode === 'preset' ? cfg.selectedPreset : cfg.mode, successCount: results.filter(r => r.success).length };
  const hist = getHistory(); hist.unshift(entry); saveHistory(hist);

  store.currentResults = { topic, totalTime, results, cost: formatCost(estimateCost(cfg)) };
  store.isRoundtableRunning = false;
  return store.currentResults;
}

// ===== Safe Markdown Renderer (XSS-safe) =====
function renderMarkdown(text) {
  if (!text) return '';
  // 1. 先转义所有 HTML 实体
  let safe = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  // 2. 在已转义的安全文本上做 markdown 转换
  safe = safe
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/^### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^## (.+)$/gm, '<h3>$1</h3>')
    .replace(/^# (.+)$/gm, '<h2>$1</h2>')
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/\n/g, '<br>');
  // 3. 最终消毒：移除任何可能的事件处理器属性（防御深度）
  safe = safe.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
  return safe;
}

// ===== UI State (使用 store.chatMessages) =====

// ===== DOM Ready =====
document.addEventListener('DOMContentLoaded', function() {
  initParticles();
  initExperts();
  initMaterials();
  initScrollReveal();
  initEventListeners();
  initSidebar();
  initSessions();
});

// ===== Settings Modal =====
function openSettingsModal() {
  const overlay = document.getElementById('settingsOverlay');
  if (!overlay) return;
  renderSettingsModal();
  overlay.classList.add('active');
}
function closeSettingsModal() {
  const overlay = document.getElementById('settingsOverlay');
  if (overlay) overlay.classList.remove('active');
}

function renderSettingsModal() {
  const body = document.querySelector('#settingsModal .modal-body');
  if (!body) return;
  const cfg = getUserConfig();
  const keys = getApiKeys();
  const tierLabels = { free: '🆓 免费', budget: '💰 经济 (¥0.5-¥3/百万token)', standard: '🏆 标准 (¥3-¥10)', premium: '👑 高端 (¥10+)' };

  function modelOpts(sel) {
    let h = '';
    ['free','budget','standard','premium'].forEach(tier => {
      const ms = Object.entries(AVAILABLE_MODELS).filter(([,m]) => m.tier === tier);
      if (!ms.length) return;
      h += '<optgroup label="' + tierLabels[tier] + '">';
      ms.forEach(([id, m]) => {
        const extra = m.tags[0] === '角色扮演' ? ' ⭐角色扮演' : '';
        h += '<option value="' + id + '"' + (sel === id ? ' selected' : '') + '>' + m.name + ' (' + m.ctx + ')' + extra + '</option>';
      });
      h += '</optgroup>';
    });
    return h;
  }

  body.innerHTML = `
    <div class="settings-form">
      <div class="settings-section">
        <label class="settings-section-title">🔑 API Key 配置</label>
        <div class="api-key-grid">
          <div class="api-key-row"><label>Friday AppID</label><div class="api-key-input-group"><input type="password" id="keyFriday" placeholder="输入 Friday appid" value="${keys.friday}"/><button class="btn-test-conn" data-platform="friday">测试连接</button></div><span class="conn-status" id="connFriday"></span></div>
          <div class="api-key-row"><label>DeepSeek Key</label><div class="api-key-input-group"><input type="password" id="keyDeepseek" placeholder="输入 DeepSeek API Key" value="${keys.deepseek}"/><button class="btn-test-conn" data-platform="deepseek">测试连接</button></div><span class="conn-status" id="connDeepseek"></span></div>
          <div class="api-key-row"><label>(可选) OpenAI 兼容</label><div class="api-key-input-group"><input type="password" id="keyOpenai" placeholder="输入 API Key" value="${keys.openai_compatible}"/><button class="btn-test-conn" data-platform="openai_compatible">测试连接</button></div><span class="conn-status" id="connOpenai"></span></div>
          <div class="api-key-row"><label>(可选) 自定义URL</label><input type="text" id="customApiUrl" placeholder="https://..." value="${keys.customUrl}"/></div>
        </div>
        <div class="settings-hint-box"><p class="settings-hint">🔒 所有 Key 仅存储在本地 localStorage，不会上传服务器。</p></div>
      </div>

      <div class="settings-section">
        <label class="settings-section-title">🎯 模型搭配模式</label>
        <div class="config-mode-tabs">
          <button class="mode-tab ${cfg.mode === 'preset' ? 'active' : ''}" data-mode="preset">默认搭配</button>
          <button class="mode-tab ${cfg.mode === 'custom' ? 'active' : ''}" data-mode="custom">自由搭配</button>
          <button class="mode-tab ${cfg.mode === 'hybrid' ? 'active' : ''}" data-mode="hybrid">混合搭配</button>
        </div>
      </div>

      <div class="settings-section mode-panel" id="panelPreset" style="display:${cfg.mode === 'preset' ? 'block' : 'none'}">
        <div class="preset-cards">
          ${Object.entries(PRESETS).map(([k, p]) => `
            <label class="preset-card ${cfg.selectedPreset === k ? 'active' : ''}">
              <input type="radio" name="preset" value="${k}" ${cfg.selectedPreset === k ? 'checked' : ''}/>
              <div class="preset-header"><span class="preset-name">${p.name}</span><span class="preset-cost">${p.costPerRun}</span></div>
              <div class="preset-desc">${p.description}</div>
            </label>
          `).join('')}
        </div>
        <details class="preset-detail"><summary>查看各角色模型分配详情 ▼</summary><div class="preset-detail-grid" id="presetDetailGrid">${renderPresetDetail(cfg)}</div></details>
      </div>

      <div class="settings-section mode-panel" id="panelCustom" style="display:${cfg.mode === 'custom' ? 'block' : 'none'}">
        <div class="custom-global"><label>全局默认模型</label><select id="globalDefaultModel">${modelOpts(cfg.globalDefault)}</select></div>
        <label class="settings-section-title" style="margin-top:12px">各专家独立配置（留空=用全局默认）</label>
        <div class="expert-model-grid">
          ${EXPERTS.map(e => `<div class="expert-model-row"><span class="emr-emoji">${e.emoji}</span><span class="emr-name">${e.name}</span><select class="emr-select" data-expert="${e.id}"><option value="">使用全局默认</option>${modelOpts(cfg.experts[e.id] || '')}</select></div>`).join('')}
        </div>
      </div>

      <div class="settings-section mode-panel" id="panelHybrid" style="display:${cfg.mode === 'hybrid' ? 'block' : 'none'}">
        <div class="custom-global"><label>基础预设</label><select id="hybridBase">${Object.entries(PRESETS).map(([k,p]) => `<option value="${k}" ${cfg.basePreset === k ? 'selected' : ''}>${p.name}</option>`).join('')}</select></div>
        <label class="settings-section-title" style="margin-top:12px">局部覆盖（选择需要替换的专家）</label>
        <div class="expert-model-grid">
          ${EXPERTS.map(e => {
            const basePreset = PRESETS[cfg.basePreset || 'free'].config;
            const currentModel = cfg.overrides[e.id] || basePreset.overrides[e.id] || basePreset.default;
            const currentName = AVAILABLE_MODELS[currentModel] ? AVAILABLE_MODELS[currentModel].name : currentModel;
            return `<div class="expert-model-row"><span class="emr-emoji">${e.emoji}</span><span class="emr-name">${e.name}</span><select class="emr-override" data-expert="${e.id}"><option value="">预设: ${currentName}</option>${modelOpts(cfg.overrides[e.id] || '')}</select></div>`;
          }).join('')}
        </div>
      </div>

      <div class="settings-section">
        <label class="settings-section-title">💰 预估费用</label>
        <div class="cost-estimate" id="costEstimate">${formatCost(estimateCost(cfg))} / 次讨论（8位专家）</div>
      </div>
    </div>
  `;
  bindSettingsEvents();
}

function renderPresetDetail(cfg) {
  const presetKey = cfg.selectedPreset || 'free';
  const preset = PRESETS[presetKey].config;
  return EXPERTS.map(e => {
    const mid = preset.overrides[e.id] || preset.default;
    const m = AVAILABLE_MODELS[mid];
    return `<div class="pd-row"><span>${e.emoji} ${e.name}</span><span class="pd-model">${m ? m.name : mid}</span></div>`;
  }).join('');
}

function bindSettingsEvents() {
  // Mode tabs
  document.querySelectorAll('.mode-tab').forEach(tab => {
    tab.addEventListener('click', function() {
      document.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active'));
      this.classList.add('active');
      document.querySelectorAll('.mode-panel').forEach(p => p.style.display = 'none');
      const mode = this.dataset.mode;
      const panelId = { preset: 'panelPreset', custom: 'panelCustom', hybrid: 'panelHybrid' }[mode];
      document.getElementById(panelId).style.display = 'block';
      updateCostEstimate();
    });
  });
  // Preset radio
  document.querySelectorAll('input[name="preset"]').forEach(radio => {
    radio.addEventListener('change', function() {
      document.querySelectorAll('.preset-card').forEach(c => c.classList.remove('active'));
      this.closest('.preset-card').classList.add('active');
      const grid = document.getElementById('presetDetailGrid');
      if (grid) grid.innerHTML = renderPresetDetail({ selectedPreset: this.value });
      updateCostEstimate();
    });
  });
  // Test connection buttons
  document.querySelectorAll('.btn-test-conn').forEach(btn => {
    btn.addEventListener('click', async function() {
      const platform = this.dataset.platform;
      const statusEl = { friday: 'connFriday', deepseek: 'connDeepseek', openai_compatible: 'connOpenai' }[platform];
      const el = document.getElementById(statusEl);
      // Save keys first
      await saveCurrentKeys();
      el.textContent = '⏳ 测试中...';
      el.className = 'conn-status testing';
      try {
        await testConnection(platform);
        el.textContent = '✅ 连接成功';
        el.className = 'conn-status success';
      } catch (err) {
        el.textContent = '❌ ' + err.message.slice(0, 50);
        el.className = 'conn-status error';
      }
    });
  });
  // Cost update on select change
  document.querySelectorAll('.emr-select, .emr-override, #globalDefaultModel, #hybridBase').forEach(sel => {
    sel.addEventListener('change', updateCostEstimate);
  });
}

async function saveCurrentKeys() {
  await saveApiKeys({
    friday: document.getElementById('keyFriday')?.value.trim() || '',
    deepseek: document.getElementById('keyDeepseek')?.value.trim() || '',
    openai_compatible: document.getElementById('keyOpenai')?.value.trim() || '',
    customUrl: document.getElementById('customApiUrl')?.value.trim() || ''
  });
}

function updateCostEstimate() {
  const cfg = readCurrentConfig();
  const el = document.getElementById('costEstimate');
  if (el) el.textContent = formatCost(estimateCost(cfg)) + ' / 次讨论（8位专家）';
}

function readCurrentConfig() {
  const activeTab = document.querySelector('.mode-tab.active');
  const mode = activeTab ? activeTab.dataset.mode : 'preset';
  const cfg = { mode, selectedPreset: 'free', globalDefault: 'longcat-2.0-preview', experts: {}, basePreset: 'standard', overrides: {} };
  const checkedPreset = document.querySelector('input[name="preset"]:checked');
  if (checkedPreset) cfg.selectedPreset = checkedPreset.value;
  const gd = document.getElementById('globalDefaultModel');
  if (gd) cfg.globalDefault = gd.value;
  document.querySelectorAll('.emr-select').forEach(s => { if (s.value) cfg.experts[s.dataset.expert] = s.value; });
  const hb = document.getElementById('hybridBase');
  if (hb) cfg.basePreset = hb.value;
  document.querySelectorAll('.emr-override').forEach(s => { if (s.value) cfg.overrides[s.dataset.expert] = s.value; });
  return cfg;
}

async function handleSaveSettings() {
  await saveCurrentKeys();
  const cfg = readCurrentConfig();
  saveUserConfig(cfg);
  const keys = await getApiKeys();
  if (!keys.friday && !keys.deepseek && !keys.openai_compatible) {
    showNotification('请至少配置一个平台的 API Key', 'warning');
    return;
  }
  closeSettingsModal();
  showNotification('设置已保存！预估费用: ' + formatCost(estimateCost(cfg)) + '/次', 'success');
}

// ===== Chat Panel & Roundtable UI =====
function openChatPanel() { document.getElementById('chatPanel').classList.add('open'); }
function closeChatPanel() { document.getElementById('chatPanel').classList.remove('open'); }

function renderChatMessages() {
  const container = document.getElementById('chatMessages');
  if (!store.chatMessages.length) {
    container.innerHTML = '<div class="chat-guidance"><div class="cg-icon">💬</div><h4>圆桌讨论尚未开始</h4><p>在输入框描述你的小说方案，8位专家将并行给出专业评估。</p></div>';
    return;
  }
  container.innerHTML = store.chatMessages.map(msg => {
    if (msg.type === 'system') return `<div class="chat-msg system"><div class="msg-icon">⚡</div><div class="msg-body">${msg.text}</div></div>`;
    if (msg.type === 'user') return `<div class="chat-msg user"><div class="msg-icon">👤</div><div class="msg-body"><div class="msg-name">你的小说方案</div><div class="msg-text">${escapeHtml(msg.text)}</div></div></div>`;
    if (msg.type === 'progress') return renderProgressPanel(msg);
    if (msg.type === 'results') return renderResultCards(msg);
    return '';
  }).join('');
  container.scrollTop = container.scrollHeight;
}

function renderProgressPanel(msg) {
  const cfg = getUserConfig();
  return `<div class="chat-msg progress-msg"><div class="msg-icon">⏳</div><div class="msg-body">
    <div class="progress-title">圆桌讨论进行中</div>
    <div class="expert-progress-grid">
      ${msg.experts.map(e => {
        const statusIcon = e.status === 'done' ? '✅' : e.status === 'error' ? '❌' : '⏳';
        const statusText = e.status === 'done' ? '完成 (' + e.elapsed + 's)' : e.status === 'error' ? '失败' : '生成中...';
        const modelName = AVAILABLE_MODELS[e.modelId] ? AVAILABLE_MODELS[e.modelId].name.replace(/^(DeepSeek-|LongCat-|Claude-|GPT-|Gemini-)/, '') : e.modelId;
        return `<div class="expert-progress-item ${e.status}"><span class="ep-emoji">${e.emoji}</span><span class="ep-name">${e.name}</span><span class="ep-model">[${modelName}]</span><span class="ep-status">${statusIcon} ${statusText}</span></div>`;
      }).join('')}
    </div>
    <div class="progress-footer"><span>进度: ${msg.experts.filter(e => e.status === 'done').length}/${msg.experts.length} 完成</span><span>预估费用: ${formatCost(estimateCost(cfg))}</span></div>
  </div></div>`;
}

function renderResultCards(msg) {
  const results = msg.results;
  const successCount = results.filter(r => r.success).length;
  let html = `<div class="chat-msg results-msg"><div class="msg-body">
    <div class="results-header"><h3>📋 圆桌讨论完成</h3><span class="results-meta">${successCount}/8 完成 · 耗时 ${msg.totalTime}s · 费用 ${msg.cost}</span></div>
    <div class="result-cards">`;
  results.forEach((r, i) => {
    if (!r.expert) return;
    const modelName = r.modelInfo ? r.modelInfo.name : r.modelId;
    if (r.success) {
      html += `<div class="result-card"><div class="rc-header" onclick="this.parentElement.classList.toggle('collapsed')"><span class="rc-expert">${r.expert.emoji} ${r.expert.name}</span><span class="rc-meta">[${modelName}] ${r.elapsed}s</span><span class="rc-toggle">▼</span></div><div class="rc-content">${renderMarkdown(r.content)}</div></div>`;
    } else {
      html += `<div class="result-card error"><div class="rc-header"><span class="rc-expert">${r.expert.emoji} ${r.expert.name}</span><span class="rc-meta">❌ 失败</span></div><div class="rc-content"><p class="rc-error">${escapeHtml(r.error)}</p><button class="btn-retry" data-expert-idx="${i}">🔄 重试</button></div></div>`;
    }
  });
  html += '</div></div></div>';
  return html;
}

function escapeHtml(t) { return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>'); }

async function startRoundtable(topic) {
  if (store.isRoundtableRunning) { showNotification('讨论正在进行中...', 'warning'); return; }
  const keys = await getApiKeys();
  if (!keys.friday && !keys.deepseek && !keys.openai_compatible) {
    showNotification('请先配置 API Key', 'warning');
    openSettingsModal();
    return;
  }

  openChatPanel();
  store.chatMessages = [];
  store.chatMessages.push({ type: 'user', text: topic });
  store.chatMessages.push({ type: 'system', text: '⏳ 正在召集 8 位专家，并行请求中...' });

  // Create progress message
  const cfg = getUserConfig();
  const progressMsg = {
    type: 'progress',
    experts: EXPERTS.map(e => ({ id: e.id, emoji: e.emoji, name: e.name, modelId: getModelForExpert(e.id, cfg), status: 'pending', elapsed: null }))
  };
  store.chatMessages.push(progressMsg);
  renderChatMessages();

  const result = await runRoundtable(topic, function(update) {
    const exp = progressMsg.experts.find(e => e.id === update.expertId);
    if (exp) {
      exp.status = update.status;
      if (update.elapsed) exp.elapsed = update.elapsed;
    }
    renderChatMessages();
  });

  // Replace progress with results
  store.chatMessages = store.chatMessages.filter(m => m.type !== 'progress' && !(m.type === 'system' && m.text.includes('⏳')));
  store.chatMessages.push({ type: 'results', results: result.results, totalTime: result.totalTime, cost: result.cost });
  renderChatMessages();

  const sc = result.results.filter(r => r.success).length;
  if (sc === 8) showNotification('✅ 8 位专家全部完成！', 'success');
  else showNotification('⚠️ ' + sc + '/8 完成，部分失败', 'warning');

  // Update session list
  renderSessionList();
}

// ===== Expert Display Data (for homepage cards) =====
const EXPERT_CARDS = {
  core: [
    { id: 'chief-editor', icon: '📋', color: '', name: '总编辑', subtitle: '商业价值 · 市场定位', scenario: '评估题材热度、商业潜力和开篇吸引力', skills: ['市场分析', '商业判断', '读者画像', '黄金三章'] },
    { id: 'world-builder', icon: '🌍', color: 'teal', name: '世界观架构师', subtitle: '逻辑自洽 · 设定审查', scenario: '审查世界观逻辑、经济系统和时代背景', skills: ['设定审查', '逻辑验证', '历史考据', '经济系统'] },
    { id: 'character-designer', icon: '🎭', color: 'pink', name: '人物塑造师', subtitle: '角色深度 · 成长弧线', scenario: '评估人物立体感、动机合理性和关系张力', skills: ['角色设计', '心理分析', '成长弧线', '关系网络'] },
    { id: 'plot-architect', icon: '📖', color: '', name: '剧情编排师', subtitle: '节奏设计 · 冲突层次', scenario: '评估故事节奏、悬念伏笔和高潮设置', skills: ['结构设计', '节奏把控', '悬念布局', '转折设计'] }
  ],
  genre: [
    { id: 'dialogue-expert', icon: '💬', color: 'pink', name: '对白专家', subtitle: '台词质量 · 潜台词', scenario: '评估对白自然度、角色语言特征和潜台词', skills: ['对白设计', '语言特征', '潜台词', '节奏感'] },
    { id: 'style-polisher', icon: '✨', color: '', name: '文笔润色师', subtitle: '文字美学 · 风格辨识', scenario: '评估文笔质量、修辞新颖度和情感表达', skills: ['风格定调', '修辞打磨', '氛围营造', '五感描写'] }
  ],
  support: [
    { id: 'continuity-checker', icon: '🔍', color: 'teal', name: '连续性审查员', subtitle: 'Bug检测 · 逻辑校验', scenario: '发现时间线矛盾、设定冲突和逻辑漏洞', skills: ['逻辑审查', '时间线', '设定一致', 'Bug分级'] },
    { id: 'toxic-reader', icon: '🔥', color: 'pink', name: '毒舌读者', subtitle: '读者视角 · 犀利吐槽', scenario: '代表最挑剔读者，给出追读意愿评分', skills: ['读者视角', '套路识别', '爽点判断', '弃文预警'] }
  ]
};

// ===== Render Expert Cards =====
function initExperts() {
  renderExpertGroup('core', document.getElementById('coreGrid'));
  renderExpertGroup('genre', document.getElementById('genreGrid'));
  renderExpertGroup('support', document.getElementById('supportGrid'));
}

function renderExpertGroup(group, container) {
  if (!container || !EXPERT_CARDS[group]) return;
  container.innerHTML = EXPERT_CARDS[group].map(expert => `
    <div class="expert-card" data-expert="${expert.id}">
      <div class="expert-card-top">
        <div class="expert-avatar ${expert.color}">${expert.icon}</div>
        <div class="expert-meta"><h4>${expert.name}</h4><p>${expert.subtitle}</p></div>
      </div>
      <div class="expert-scenario">${expert.scenario}</div>
      <div class="expert-skills">${expert.skills.map(s => '<span class="skill-tag">' + s + '</span>').join('')}</div>
    </div>
  `).join('');
}

// ===== Material Library =====
const MATERIALS = {
  '人名库': { count: '2000+', items: [
    { title: '中国古风人名', icon: '📖', count: '800+', desc: '按朝代、性别、气质分类', tags: ['先秦风', '唐宋韵', '明清调', '仙侠名'] },
    { title: '西方奇幻人名', icon: '🌍', count: '600+', desc: '精灵、矮人、龙族命名规则', tags: ['精灵族', '矮人族', '人类', '暗黑系'] },
    { title: '现代都市人名', icon: '🏙️', count: '400+', desc: '符合现代审美的命名方案', tags: ['文艺范', '霸总系', '邻家风', '高冷型'] }
  ]},
  '功法体系': { count: '500+', items: [
    { title: '修仙境界', icon: '⚔️', count: '200+', desc: '修仙、武侠、异能力量体系', tags: ['修仙境界', '武学招式', '异能分类', '魔法体系'] },
    { title: '武器装备', icon: '🗡️', count: '200+', desc: '各类武器和装备设定模板', tags: ['神兵利器', '法宝灵器', '科技武器', '防具护甲'] },
    { title: '门派体系', icon: '🏯', count: '100+', desc: '宗门、帮派、组织架构模板', tags: ['正道宗门', '魔道势力', '散修联盟', '世家大族'] }
  ]},
  '情感模式': { count: '200+', items: [
    { title: '经典情感线', icon: '💕', count: '100+', desc: '经典情感线模板和关系路径', tags: ['欢喜冤家', '青梅竹马', '先婚后爱', '破镜重圆'] },
    { title: '虐恋模式', icon: '💔', count: '50+', desc: '虐心情节和情感冲突模板', tags: ['身份对立', '误会分离', '生死抉择', '牺牲守护'] }
  ]},
  '世界观模板': { count: '150+', items: [
    { title: '东方仙侠', icon: '☁️', count: '40+', desc: '完整仙侠世界观框架', tags: ['天地规则', '修炼体系', '势力分布', '历史纪元'] },
    { title: '末日废土', icon: '☢️', count: '35+', desc: '末世生存世界观设定', tags: ['灾变原因', '生存规则', '势力割据', '变异体系'] },
    { title: '星际文明', icon: '🚀', count: '35+', desc: '太空歌剧世界观框架', tags: ['文明等级', '星际政治', '科技树', '外星种族'] }
  ]}
};

function initMaterials() {
  const tabs = document.getElementById('materialTabs');
  const grid = document.getElementById('materialGrid');
  if (!tabs || !grid) return;
  const cats = Object.keys(MATERIALS);
  tabs.innerHTML = cats.map((c, i) => '<span class="material-tab ' + (i === 0 ? 'active' : '') + '" data-category="' + c + '">' + c + ' - ' + MATERIALS[c].count + '</span>').join('');
  renderMaterialGrid(cats[0]);
  tabs.addEventListener('click', function(e) {
    const tab = e.target.closest('.material-tab');
    if (!tab) return;
    tabs.querySelectorAll('.material-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    renderMaterialGrid(tab.dataset.category);
  });
}

function renderMaterialGrid(cat) {
  const grid = document.getElementById('materialGrid');
  if (!grid || !MATERIALS[cat]) return;
  grid.innerHTML = MATERIALS[cat].items.map(item => `
    <div class="material-card"><h4>${item.icon} ${item.title} <span class="mat-count">${item.count}</span></h4><p>${item.desc}</p><div class="mat-items">${item.tags.map(t => '<span class="mat-item">' + t + '</span>').join('')}</div></div>
  `).join('');
}

// ===== Particle Background (IntersectionObserver 控制，不可见时暂停) =====
function initParticles() {
  const canvas = document.getElementById('particlesCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let particles = [];
  let rafId = null;
  let isVisible = true;
  function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
  resize(); window.addEventListener('resize', debounce(resize, 200));
  class Particle {
    constructor() { this.reset(); }
    reset() { this.x = Math.random() * canvas.width; this.y = Math.random() * canvas.height; this.size = Math.random() * 2 + 0.5; this.speedX = (Math.random() - 0.5) * 0.5; this.speedY = (Math.random() - 0.5) * 0.5; this.opacity = Math.random() * 0.5 + 0.1; }
    update() { this.x += this.speedX; this.y += this.speedY; if (this.x < 0 || this.x > canvas.width || this.y < 0 || this.y > canvas.height) this.reset(); }
    draw() { ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2); ctx.fillStyle = 'rgba(108, 92, 231, ' + this.opacity + ')'; ctx.fill(); }
  }
  for (let i = 0; i < 50; i++) particles.push(new Particle());
  function animate() {
    if (!isVisible) { rafId = null; return; }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => { p.update(); p.draw(); });
    for (let i = 0; i < particles.length; i++) for (let j = i + 1; j < particles.length; j++) {
      const dx = particles[i].x - particles[j].x, dy = particles[i].y - particles[j].y, dist = Math.sqrt(dx*dx + dy*dy);
      if (dist < 120) { ctx.beginPath(); ctx.moveTo(particles[i].x, particles[i].y); ctx.lineTo(particles[j].x, particles[j].y); ctx.strokeStyle = 'rgba(108, 92, 231, ' + (0.08 * (1 - dist/120)) + ')'; ctx.stroke(); }
    }
    rafId = requestAnimationFrame(animate);
  }
  // 只在 canvas 可见时运行动画
  const obs = new IntersectionObserver(([entry]) => {
    isVisible = entry.isIntersecting;
    if (isVisible && !rafId) animate();
  }, { threshold: 0.01 });
  obs.observe(canvas);
  animate();
}

// ===== Scroll Reveal =====
function initScrollReveal() {
  const obs = new IntersectionObserver(entries => {
    entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('visible'); } });
  }, { threshold: 0.15 });
  document.querySelectorAll('.scroll-reveal').forEach(el => obs.observe(el));
}

// ===== Event Listeners =====
function initEventListeners() {
  // Settings
  const btnSettings = document.getElementById('btnSettings');
  if (btnSettings) { btnSettings.addEventListener('click', openSettingsModal); btnSettings.onclick = openSettingsModal; }
  document.getElementById('settingsClose')?.addEventListener('click', closeSettingsModal);
  document.getElementById('btnCancelSettings')?.addEventListener('click', closeSettingsModal);
  document.getElementById('btnSaveSettings')?.addEventListener('click', handleSaveSettings);
  document.getElementById('settingsOverlay')?.addEventListener('click', function(e) { if (e.target === this) closeSettingsModal(); });

  // Submit idea
  document.getElementById('btnSubmitIdea')?.addEventListener('click', submitIdea);
  document.getElementById('creativeInput')?.addEventListener('keydown', function(e) { if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); submitIdea(); } });

  // Chat
  document.getElementById('chatClose')?.addEventListener('click', closeChatPanel);
  document.getElementById('btnChatSend')?.addEventListener('click', sendChat);
  document.getElementById('chatInput')?.addEventListener('keydown', function(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); } });


  // Expert info
  document.getElementById('btnExpertInfo')?.addEventListener('click', openExpertInfoModal);

  // Modal
  document.getElementById('modalClose')?.addEventListener('click', closeModal);
  document.getElementById('modalCancel')?.addEventListener('click', closeModal);
  document.getElementById('modalOverlay')?.addEventListener('click', function(e) { if (e.target === this) closeModal(); });

  // Mobile menu
  document.getElementById('mobileMenuBtn')?.addEventListener('click', function() { this.classList.toggle('active'); document.getElementById('sidebar')?.classList.toggle('open'); });

  // Material search (debounced)
  document.getElementById('materialSearch')?.addEventListener('input', debounce(function(e) { filterMaterials(e.target.value.trim()); }, 200));

  // Theme
  document.getElementById('btnTheme')?.addEventListener('click', toggleTheme);

  // Tip tags
  document.querySelectorAll('.tip-tag').forEach(tag => {
    tag.addEventListener('click', function() {
      document.querySelectorAll('.tip-tag').forEach(t => t.classList.remove('active'));
      this.classList.add('active');
      const input = document.getElementById('creativeInput');
      if (input) { input.value = this.dataset.tip; input.focus(); }
    });
  });

  // Filter
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      const filter = this.dataset.filter;
      document.querySelectorAll('.expert-group').forEach(g => { g.classList.toggle('hidden', filter !== 'all' && g.dataset.group !== filter); });
    });
  });

  // Tools (coming soon - no action)
  document.querySelectorAll('.tool-item.coming-soon').forEach(item => {
    item.addEventListener('click', function(e) { e.preventDefault(); });
  });

  // New session
  document.getElementById('btnNewSession')?.addEventListener('click', () => { store.chatMessages = []; renderChatMessages(); openChatPanel(); showNotification('新圆桌会已创建'); });

  // Escape
  document.addEventListener('keydown', function(e) { if (e.key === 'Escape') { closeModal(); closeSettingsModal(); closeChatPanel(); } });

  // Retry buttons (delegated)
  document.addEventListener('click', function(e) {
    const retryBtn = e.target.closest('.btn-retry');
    if (retryBtn && store.currentResults) {
      showNotification('重试功能开发中', 'warning');
    }
  });
}

function submitIdea() {
  const input = document.getElementById('creativeInput');
  const text = input?.value.trim();
  if (!text) { showNotification('请先输入你的创作想法', 'warning'); return; }
  startRoundtable(text);
}

function sendChat() {
  const input = document.getElementById('chatInput');
  const text = input?.value.trim();
  if (!text) return;
  input.value = '';
  startRoundtable(text);
}

// ===== Expert Info Modal =====
function openExpertInfoModal() {
  const modal = document.getElementById('modalOverlay');
  const header = document.getElementById('modalHeader');
  const body = document.getElementById('modalBody');
  header.innerHTML = '<div class="modal-expert-top"><div class="modal-avatar expert-avatar" style="width:64px;height:64px;border-radius:16px;font-size:28px;background:var(--gradient-1);">👥</div><div class="modal-title"><h2>8 位圆桌专家</h2><p>并行评估你的小说方案</p></div></div>';
  body.innerHTML = '<div class="expert-info-modal"><div class="expert-info-grid">' + EXPERTS.map(e => '<div class="expert-info-item"><div class="ei-icon expert-avatar" style="width:40px;height:40px;border-radius:10px;font-size:20px;">' + e.emoji + '</div><div class="ei-text"><h5>' + e.name + '</h5><p>' + e.systemPrompt.split('\n')[0].slice(0, 30) + '...</p></div></div>').join('') + '</div></div>';
  document.getElementById('modalInvite').style.display = 'none';
  modal.classList.add('active');
}
function closeModal() { document.getElementById('modalOverlay')?.classList.remove('active'); document.getElementById('modalInvite').style.display = ''; }

// ===== Sidebar =====
function initSidebar() {
  const sidebar = document.getElementById('sidebar');
  const toggle = document.getElementById('sidebarToggle');
  if (!sidebar || !toggle) return;
  toggle.addEventListener('click', function() {
    sidebar.classList.toggle('collapsed');
    this.querySelector('.toggle-icon').textContent = sidebar.classList.contains('collapsed') ? '☰' : '✕';
  });
}

// ===== Sessions =====
function initSessions() {
  renderSessionList();
}
function renderSessionList() {
  const container = document.getElementById('sessionList');
  if (!container) return;
  const hist = getHistory();
  if (!hist.length) { container.innerHTML = '<div class="session-empty"><p>暂无会话</p><p class="sub">开始讨论后自动保存</p></div>'; return; }
  container.innerHTML = hist.map(h => `
    <div class="session-item" data-id="${h.id}">
      <span class="session-delete" title="删除">&times;</span>
      <div class="session-title">${escapeHtml(h.topic.slice(0, 30))}</div>
      <div class="session-time">${new Date(h.timestamp).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · ${h.successCount}/8</div>
    </div>
  `).join('');
  container.querySelectorAll('.session-item').forEach(item => {
    item.addEventListener('click', function(e) {
      if (e.target.classList.contains('session-delete')) {
        const id = parseInt(this.dataset.id);
        const hist = getHistory().filter(h => h.id !== id);
        saveHistory(hist);
        renderSessionList();
        return;
      }
      showNotification('历史回看功能开发中', 'info');
    });
  });
}

// ===== Material Search =====
function filterMaterials(query) {
  if (!query) { renderMaterialGrid(document.querySelector('.material-tab.active')?.dataset.category || Object.keys(MATERIALS)[0]); return; }
  const grid = document.getElementById('materialGrid');
  if (!grid) return;
  const q = query.toLowerCase();
  let results = [];
  Object.values(MATERIALS).forEach(cat => {
    cat.items.forEach(item => {
      if (item.title.toLowerCase().includes(q) || item.desc.toLowerCase().includes(q) || item.tags.some(t => t.toLowerCase().includes(q))) results.push(item);
    });
  });
  if (!results.length) { grid.innerHTML = '<p style="color:var(--text-muted);padding:20px;">未找到匹配素材</p>'; return; }
  grid.innerHTML = results.map(item => `<div class="material-card"><h4>${item.icon} ${item.title} <span class="mat-count">${item.count}</span></h4><p>${item.desc}</p><div class="mat-items">${item.tags.map(t => '<span class="mat-item">' + t + '</span>').join('')}</div></div>`).join('');
}

// ===== Theme =====
function toggleTheme() {
  document.body.classList.toggle('light-theme');
  document.getElementById('btnTheme').innerHTML = document.body.classList.contains('light-theme') ? '☀' : '🌙';
}

// ===== Notifications =====
function showNotification(message, type) {
  const container = document.getElementById('notificationContainer');
  const n = document.createElement('div');
  n.className = 'notification ' + (type || 'info');
  n.textContent = message;
  container.appendChild(n);
  setTimeout(() => { n.classList.add('exit'); setTimeout(() => n.remove(), 300); }, 3000);
}

})();
