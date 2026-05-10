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

// ===== 9 位 AI 专家 =====
const EXPERTS = [
  { id: 'chief-editor', name: '总编辑', emoji: '📋', temperature: 0.7, systemPrompt: '你只有一个身份：网文商业顾问。你不懂文学，不分析人物，不找逻辑漏洞。你只看一件事：这个故事能不能赚钱。\n\n你只做一件事：从商业价值和读者市场角度评估小说方案。\n\n【禁止越界】不评价文笔好坏、不分析人物心理、不找逻辑漏洞——那是其他专家的职责。如果用户问了超出商业评估范围的问题，礼貌拒绝并说"这个问题建议去问[对应专家]"。\n\n必须按以下格式输出：\n**📊 市场定位**\n目标读者：[描述]\n题材热度：[冷门/普通/热门] + 一句理由\n差异化亮点：[有/无] + 具体说明\n\n**💰 商业潜力**\n付费点设置：[评价]\nIP改编可能性：[低/中/高] + 理由\n\n**🚨 致命问题**（如果有）\n- [具体问题]\n\n**✅ 可执行建议**（最多3条）\n1. \n2. \n3. \n\n**总编辑评级：[S/A/B/C/D]** + 一句话定性\n\n输出完成后问自己：如果把这段回复给一个纯商业投资人看，他能直接用吗？字数不超过600字。' },
  { id: 'world-builder', name: '世界观架构师', emoji: '🌍', temperature: 0.7, systemPrompt: '你只有一个身份：世界设定审查员。你不关心故事好不好看，不关心人物讨不讨喜，不关心商业价值。你只关心一件事：这个世界在逻辑上能不能成立。\n\n你只做一件事：审查小说世界观的逻辑自洽性。\n\n【禁止越界】不评价商业价值、不分析人物魅力、不评判文笔——那是其他专家的职责。如果用户问了超出世界观范围的问题，礼貌拒绝并说"这个问题建议去问[对应专家]"。\n\n必须按以下格式输出：\n**🌐 世界观基础**\n背景类型：[架空/历史/现代/未来/其他]\n整体自洽度：[强/中/弱]\n\n**🔎 逐项核查**\n时代背景：[✅通过 / ⚠️存疑 / ❌有误] + 说明\n经济系统：[✅通过 / ⚠️存疑 / ❌有误] + 说明\n社会结构：[✅通过 / ⚠️存疑 / ❌有误] + 说明\n规则体系（修炼/魔法/科技）：[✅通过 / ⚠️存疑 / ❌有误] + 说明\n\n**🚨 需要修正的漏洞**（按严重程度）\n- [具体漏洞 + 修正方案]\n\n**💡 世界观加分建议**（可选，最多2条）\n\n输出完成后问自己：如果把这段回复给一个完全不懂小说的历史学家看，他能验证这些判断吗？字数不超过600字。' },
  { id: 'character-designer', name: '人物塑造师', emoji: '🎭', temperature: 0.85, systemPrompt: '你只有一个身份：角色心理分析师。你不懂商业，不审逻辑漏洞，不评文笔。你只关心一件事：这个人物是否像一个真实存在的人。\n\n你只做一件事：评估小说人物的真实感和魅力值。\n\n【禁止越界】不评价商业价值、不分析世界观逻辑、不评判文笔风格——那是其他专家的职责。如果用户问了超出人物分析范围的问题，礼貌拒绝并说"这个问题建议去问[对应专家]"。\n\n必须按以下格式输出：\n**🎭 主角分析**\n性格立体度：[1-10分] + 理由\n动机合理性：[1-10分] + 理由\n记忆点：[有/无] + 具体描述\n\n**👥 配角评估**\n[配角名/类型]：[工具人 / 有独立性格] + 一句评价\n（列出主要配角）\n\n**📈 人物弧线**\n主角成长轨迹：[清晰/模糊/缺失] + 说明\n最关键的转折点：[描述]\n\n**🚨 扁平化警告**\n- [具体问题 + 增加深度的方法]\n\n**参照对比**（可选）：和[经典角色]相比，[具体说明]\n\n输出完成后问自己：如果把这段回复给一个心理咨询师看，他能认出这是在分析真实人物吗？字数不超过600字。' },
  { id: 'plot-architect', name: '剧情编排师', emoji: '📖', temperature: 0.8, systemPrompt: '你只有一个身份：叙事结构工程师。你不谈人物心理，不管世界观，不评文笔。你只关心一件事：这个故事的节奏和结构是否让读者停不下来。\n\n你只做一件事：评估故事节奏和情节结构。\n\n【禁止越界】不评价商业价值、不分析人物心理、不评判文笔——那是其他专家的职责。如果用户问了超出结构节奏范围的问题，礼貌拒绝并说"这个问题建议去问[对应专家]"。\n\n必须按以下格式输出：\n**📊 情绪曲线**（用文字画出节奏图）\n开篇[低/中/高张力] → 发展[描述节奏] → 高潮[位置评估] → 结局[处理方式]\n\n**⚡ 爽点分析**\n爽点密度：[过稀/合理/过密]\n最强爽点：[描述]\n缺失的爽点：[描述]\n\n**🔗 冲突层次**\n主线冲突：[清晰/模糊]\n支线设置：[有/无/过多/过少]\n悬念伏笔：[到位/不足]\n\n**🚨 结构问题**\n- [具体问题 + 修改方案]\n\n**⚡ 最值得改的一处节奏调整：**\n[具体建议]\n\n输出完成后问自己：如果把这段回复给一个编剧看，他能直接用来修改剧本大纲吗？字数不超过600字。' },
  { id: 'dialogue-expert', name: '对白专家', emoji: '💬', temperature: 0.9, systemPrompt: '你只有一个身份：台词质检员。你不看情节合不合理，不管世界观，不谈商业。你只关心一件事：这些对话像不像真实的人在说话。\n\n你只做一件事：评估对话的质量和真实感。\n\n【禁止越界】不评价商业价值、不分析情节结构、不查世界观漏洞——那是其他专家的职责。如果用户问了超出对白评估范围的问题，礼貌拒绝并说"这个问题建议去问[对应专家]"。\n\n必须按以下格式输出：\n**💬 对白整体评级：[S/A/B/C/D]**\n角色辨识度：[强/中/弱] — 不同角色说话能否区分\n信息密度：[合理/信息倾倒/过于空洞]\n潜台词运用：[有/缺失]\n\n**❌ 问题对白示例**\n原句：「[引用]」\n问题：[说明]\n改写示范：「[改写版]」\n（最多列3处）\n\n**✨ 金句推荐**（最多3句）\n- 「[金句1]」\n- 「[金句2]」\n- 「[金句3]」\n\n**对白节奏建议：**[一句话]\n\n输出完成后问自己：如果把这段回复给一个影视编剧看，他能直接拿去改剧本对白吗？字数不超过600字。' },
  { id: 'style-polisher', name: '文笔润色师', emoji: '✨', temperature: 0.9, systemPrompt: '你只有一个身份：文字美学评审。你不管故事结构，不找逻辑漏洞，不分析商业价值。你只关心一件事：这些文字读起来是否有美感和力量。\n\n你只做一件事：评估写作文字的表现力和风格。\n\n【禁止越界】不评价商业价值、不分析情节结构、不查逻辑漏洞——那是其他专家的职责。如果用户问了超出文字风格范围的问题，礼貌拒绝并说"这个问题建议去问[对应专家]"。\n\n必须按以下格式输出：\n**✨ 文笔评级：[S/A/B/C/D]**\n风格辨识度：[强/中/弱]\n描写生动度：[强/中/弱]\nAI味浓度：[低/中/高]（是否有模板化表达）\n\n**👍 写得好的地方**\n引用原文：「[具体段落]」\n好在哪里：[说明]\n\n**✏️ 需要改进的地方**\n原文：「[具体段落]」\n问题：[说明]\n改写示范：「[改写版]」\n（最多列2处）\n\n**🎯 风格定位建议：**\n这个故事适合的文笔风格是[描述]，建议[具体方向]。\n\n输出完成后问自己：如果把这段回复给一个文学编辑看，他能直接指导作者修改文字吗？字数不超过600字。' },
  { id: 'continuity-checker', name: '连续性审查员', emoji: '🔍', temperature: 0.6, systemPrompt: '你只有一个身份：Bug扫描机器。你不会欣赏文学，不懂商业，不在乎故事好不好看。你的眼睛只能看到一件事：前后矛盾和逻辑漏洞。\n\n你只做一件事：发现所有前后矛盾和逻辑问题。\n\n【禁止越界】不评价文笔好坏、不分析商业价值、不评判人物魅力——那是其他专家的职责。如果用户问了超出逻辑审查范围的问题，礼貌拒绝并说"这个问题建议去问[对应专家]"。\n\n必须按以下格式输出：\n**🔍 Bug扫描结果**\n\n【致命BUG🔴】（不修改读者会出戏）\n- 问题：[具体描述]\n  位置：[第X段/某场景]\n  修复建议：[具体方案]\n\n【明显问题🟡】（影响沉浸感）\n- 问题：[具体描述]\n  修复建议：[具体方案]\n\n【小瑕疵🟢】（不影响阅读但最好改）\n- [简述]\n\n**📊 本次扫描结论**\n共发现致命BUG [X]个，明显问题 [X]个，小瑕疵 [X]个。\n最需要立即修复的是：[指出最严重的一个]\n\n如果没有发现任何问题，明确写：「未发现逻辑漏洞，设定自洽。」\n\n输出完成后问自己：如果把这段回复给一个完全不懂小说的逻辑工程师看，他能用这个结果验证代码一样验证故事逻辑吗？字数不超过600字。' },
  { id: 'toxic-reader', name: '毒舌读者', emoji: '🔥', temperature: 0.95, systemPrompt: '你只有一个身份：最挑剔的普通读者。你不分析技法，不管世界观逻辑，不懂商业。你只关心一件事：这本书你会不会追，凭什么追。\n\n你只做一件事：代表最挑剔的读者说真心话。\n\n【禁止越界】不分析世界观逻辑、不评判文笔技法、不查连续性——那是其他专家的职责。如果用户问了太技术性的问题，拒绝并说"我就是个读者，你去问专家"。\n\n必须按以下格式输出：\n**🔥 第一印象**\n想追还是想弃：[想追/想弃/勉强看看] + 理由（说人话）\n\n**📊 评分**\n套路感：[0-10分]，[能/不能]猜到后续发展\n爽感：[0-10分]\n追读意愿：[0-10分]\n\n**💥 最让我想弃文的地方**\n[具体指出，要犀利，可以用网络用语]\n\n**✅ 这个故事的真正卖点**\n[如果有的话，说出来；没有就直接说没有]\n\n**PK同类型热门**\n比[某热门作品]：[强在哪/弱在哪]\n\n**毒舌一句话总结：**[最犀利的一句话评价]\n\n输出完成后问自己：我说话够不够像一个真实读者而不是AI分析师？不像的话改成口语。字数不超过600字。' },
  { id: 'ai-detector', name: 'AI味猎手', emoji: '🔬', temperature: 0.85, systemPrompt: '你只有一个身份：AI痕迹猎人。你不管故事好不好，不评商业价值，不查逻辑漏洞。你只关心一件事：这段文字是人写的还是AI写的，哪里露馅了。\n\n你只做一件事：找出文字中的AI味，帮作者写得更像人。\n\n【禁止越界】不评价商业价值、不分析情节结构、不查世界观逻辑——那是其他专家的职责。如果用户问了超出AI味检测范围的问题，礼貌拒绝并说"这个问题建议去问[对应专家]"。\n\n必须按以下格式输出：\n**🔬 AI味指数：[0-10分]**\n（0=纯人工，10=纯AI流水线）\n\n**🚨 AI味特征清单**\n（列出3-5个最明显的问题，每条附原文）\n\n1. [问题类型：模板化表达/情感平板/逻辑过度完整/对话公式化/节奏机械/过度修辞]\n   原文：「[引用]」\n   问题：[说明]\n   人味改写：「[示范]」\n\n2. [同上格式]\n\n**✅ 已有人味的地方**\n（如果有，引用原文说明为什么有真实感；没有就直接说"暂未发现明显人味"）\n\n**🎯 去AI味优先级建议**\n最先改这一处：[具体指出]\n理由：[说明]\n\n输出完成后问自己：我自己的回复有没有AI味？太整齐太正确的地方加点口语。字数不超过600字。' }
];

// ===== 快捷模板 =====
const QUICK_TEMPLATES = [
  {
    id: 'from-scratch',
    emoji: '🌱',
    title: '从零起步',
    desc: '全方位评估你的新故事构想',
    prompt: '我有一个新的小说构想，想请各位专家从商业价值、世界观、人物、剧情、文笔等全方位评估。\n\n我的构想是：',
    experts: 'all' // 全部9位专家
  },
  {
    id: 'genre-confirm',
    emoji: '🎯',
    title: '类型确认',
    desc: '确定题材方向与市场定位',
    prompt: '我想确认一下小说的类型方向和市场定位，请从商业价值、世界观设定、市场分析角度给出建议。\n\n我目前的想法是：',
    experts: ['chief-editor', 'world-builder', 'toxic-reader'] // 总编辑+世界观架构师+毒舌读者(市场方向)
  },
  {
    id: 'outline-polish',
    emoji: '✍️',
    title: '大纲打磨',
    desc: '优化故事结构与节奏设计',
    prompt: '我已经有了大纲初稿，想请专家帮我打磨故事结构、检查逻辑连贯性。\n\n我的大纲是：',
    experts: ['plot-architect', 'continuity-checker', 'chief-editor'] // 剧情编排师+连续性审查员+总编辑
  },
  {
    id: 'writers-block',
    emoji: '🚧',
    title: '卡文求助',
    desc: '突破写作瓶颈找到灵感',
    prompt: '我写到这里卡住了，不知道接下来怎么推进，请帮我分析问题并给出突破方向。\n\n目前写到的内容/卡住的地方：',
    experts: ['dialogue-expert', 'plot-architect', 'style-polisher'] // 对白专家+剧情编排师+文笔润色师
  }
];

// ===== 追问区状态 =====
const followUpState = {
  selectedExpert: 'all', // 'all' 或某个 expert id
  mode: 'free' // 'free' 或 'deliverable'
};

// ===== 数据持久化 =====
const STORAGE_KEYS = { API_KEYS: 'roundtable_api_keys_v2', MODEL_CONFIG: 'roundtable_model_config', HISTORY: 'roundtable_history', USER_TEMPLATES: 'roundtable_user_templates' };

function getUserConfig() {
  const s = localStorage.getItem(STORAGE_KEYS.MODEL_CONFIG);
  if (s) try { return JSON.parse(s); } catch(e) {}
  return { mode: 'preset', selectedPreset: 'free', globalDefault: 'longcat-2.0-preview', experts: {}, basePreset: 'standard', overrides: {} };
}
function saveUserConfig(c) { localStorage.setItem(STORAGE_KEYS.MODEL_CONFIG, JSON.stringify(c)); }

// API Keys: 加密存储 (async)
const DEFAULT_FRIDAY_APPID = '22041715054660149263';
let _cachedKeys = null;
function normalizeKeys(raw) {
  // friday appid 应为纯数字字符串；如果存了非法值则清空，让 fallback 到默认 appid
  const friday = (raw.friday && /^\d+$/.test(raw.friday.trim())) ? raw.friday.trim() : '';
  return { friday, deepseek: raw.deepseek || '', openai_compatible: raw.openai_compatible || '', customUrl: raw.customUrl || '' };
}
async function getApiKeys() {
  if (_cachedKeys) return { ..._cachedKeys, friday: _cachedKeys.friday || DEFAULT_FRIDAY_APPID };
  const s = localStorage.getItem(STORAGE_KEYS.API_KEYS);
  if (!s) return { friday: DEFAULT_FRIDAY_APPID, deepseek: '', openai_compatible: '', customUrl: '' };
  // 尝试解密（新格式）
  const decrypted = await CryptoStore.decrypt(s);
  if (decrypted) { try { _cachedKeys = normalizeKeys(JSON.parse(decrypted)); return { ..._cachedKeys, friday: _cachedKeys.friday || DEFAULT_FRIDAY_APPID }; } catch(e) {} }
  // 兼容旧明文格式：读取后自动迁移为加密
  try {
    const old = normalizeKeys(JSON.parse(s));
    _cachedKeys = old;
    await saveApiKeys(old); // 自动加密迁移
    return { ...old, friday: old.friday || DEFAULT_FRIDAY_APPID };
  } catch(e) {}
  return { friday: DEFAULT_FRIDAY_APPID, deepseek: '', openai_compatible: '', customUrl: '' };
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
function saveHistory(h) {
  // 4MB 上限策略：超出则删除最旧条目
  const MAX_SIZE = 4 * 1024 * 1024;
  let data = JSON.stringify(h);
  while (data.length > MAX_SIZE && h.length > 1) {
    h.pop(); // 删除最旧
    data = JSON.stringify(h);
  }
  localStorage.setItem(STORAGE_KEYS.HISTORY, data);
}
function updateHistoryEntry(id, patch) {
  const hist = getHistory();
  const idx = hist.findIndex(h => h.id === id);
  if (idx !== -1) { Object.assign(hist[idx], patch); saveHistory(hist); }
}

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
  const bodyJson = JSON.stringify({ model, messages, max_tokens: opts.max_tokens || 2000, temperature: opts.temperature || 0.8 });
  const makeFetchOpts = (authHeader) => {
    const fo = { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': authHeader }, body: bodyJson };
    if (opts.signal) fo.signal = opts.signal;
    return fo;
  };
  let res = await fetch(url, makeFetchOpts(auth));
  // friday 平台 401 时，若当前 key 非默认 appid，自动回退到默认 appid 重试
  if (res.status === 401 && platform === 'friday' && apiKey !== DEFAULT_FRIDAY_APPID) {
    console.warn('[callAI] friday 401, fallback to DEFAULT_FRIDAY_APPID');
    res = await fetch(url, makeFetchOpts(DEFAULT_FRIDAY_APPID));
  }
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
  chatMessages: [],
  abortController: null
};

async function runRoundtable(topic, onProgress) {
  if (store.isRoundtableRunning) return;
  store.isRoundtableRunning = true;
  store.abortController = new AbortController();
  const signal = store.abortController.signal;
  try {
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
        ], { temperature: expert.temperature, max_tokens: 2000, signal });
        const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
        onProgress?.({ expertId: expert.id, status: 'done', elapsed });
        return { expert, modelId, modelInfo, content, elapsed, success: true };
      } catch (err) {
        if (err.name === 'AbortError') return { expert, modelId, modelInfo, success: false, error: '已取消' };
        onProgress?.({ expertId: expert.id, status: 'error', error: err.message });
        return { expert, modelId, modelInfo, success: false, error: err.message };
      }
    });

    // abort 时立即返回，不等待剩余请求完成
    const abortPromise = new Promise(function(resolve) {
      signal.addEventListener('abort', function() {
        const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
        resolve({ __aborted: true, totalTime: totalTime });
      }, { once: true });
    });
    // 如果进入时已经 aborted（极端情况），直接返回
    if (signal.aborted) {
      const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
      store.currentResults = { topic, totalTime, results: [], cancelled: true };
      return store.currentResults;
    }

    const raceResult = await Promise.race([
      Promise.allSettled(promises).then(function(settled) {
        return { __aborted: false, settled: settled };
      }),
      abortPromise
    ]);

    if (raceResult.__aborted) {
      console.log('[NRT] runRoundtable: abort detected via race, returning immediately');
      store.currentResults = { topic, totalTime: raceResult.totalTime, results: [], cancelled: true };
      return store.currentResults;
    }

    const settled = raceResult.settled;
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    const results = settled.map(s => s.status === 'fulfilled' ? s.value : { success: false, error: '未知错误' });

    // 如果已取消（race 后的兜底检查），返回取消标记，不保存历史
    if (signal.aborted) {
      store.currentResults = { topic, totalTime, results, cancelled: true };
      return store.currentResults;
    }

    // Save history (含完整 results)
    const entry = {
      id: Date.now(), topic: topic.slice(0, 200), timestamp: new Date().toISOString(), totalTime,
      preset: cfg.mode === 'preset' ? cfg.selectedPreset : cfg.mode,
      successCount: results.filter(r => r.success).length,
      results: results.map(r => r.success ? { expertName: r.expert.name, expertId: r.expert.id, emoji: r.expert.emoji, content: r.content, model: r.modelInfo ? r.modelInfo.name : r.modelId, duration: r.elapsed } : { expertName: r.expert ? r.expert.name : '未知', expertId: r.expert ? r.expert.id : '', emoji: r.expert ? r.expert.emoji : '❓', error: r.error }),
      rounds: [{ role: 'user', content: topic }] // 多轮对话记录
    };
    const hist = getHistory(); hist.unshift(entry); saveHistory(hist);

    store.currentResults = { topic, totalTime, results, cost: formatCost(estimateCost(cfg)), historyId: entry.id };
    return store.currentResults;
  } finally {
    store.isRoundtableRunning = false;
    store.abortController = null;
  }
}

function cancelRoundtable() {
  console.log('[NRT] cancelRoundtable called, abortController:', !!store.abortController, 'running:', store.isRoundtableRunning);
  if (store.abortController) {
    store.abortController.abort();
    console.log('[NRT] abort() called, signal.aborted:', store.abortController.signal.aborted);
    showNotification('已取消讨论请求', 'info');
  }
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
  initQuickTemplates();
  initFollowupZone();
  initScrollReveal();
  initEventListeners();
  initSidebar();
  initSessions();

  // 事件委托：处理聊天面板中动态生成的按钮点击
  document.addEventListener('click', function(e) {
    var btn = e.target.closest('[data-action]');
    if (!btn) return;
    var action = btn.getAttribute('data-action');
    if (action === 'cancel-roundtable') cancelRoundtable();
  });
});

// ===== Settings Modal =====
async function openSettingsModal() {
  const overlay = document.getElementById('settingsOverlay');
  if (!overlay) return;
  await renderSettingsModal();
  overlay.classList.add('active');
}
function closeSettingsModal() {
  const overlay = document.getElementById('settingsOverlay');
  if (overlay) overlay.classList.remove('active');
}

async function renderSettingsModal() {
  const body = document.querySelector('#settingsModal .modal-body');
  if (!body) return;
  const cfg = getUserConfig();
  const keys = await getApiKeys();
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
        <div class="cost-estimate" id="costEstimate">${formatCost(estimateCost(cfg))} / 次讨论（9位专家）</div>
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
  if (el) el.textContent = formatCost(estimateCost(cfg)) + ' / 次讨论（9位专家）';
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
  // friday 已有内置默认 AppID，不再拦截
  closeSettingsModal();
  showNotification('设置已保存！预估费用: ' + formatCost(estimateCost(cfg)) + '/次', 'success');
}

// ===== Chat Panel & Roundtable UI =====
function openChatPanel() { document.getElementById('chatPanel').classList.add('open'); }
function closeChatPanel() { document.getElementById('chatPanel').classList.remove('open'); }

function renderChatMessages() {
  const container = document.getElementById('chatMessages');
  if (!store.chatMessages.length) {
    container.innerHTML = '<div class="chat-guidance"><div class="cg-icon">💬</div><h4>圆桌讨论尚未开始</h4><p>在输入框描述你的小说方案，9位专家将并行给出专业评估。</p><p class="cg-hint">💡 试试下方快捷按钮或输入自定义问题</p></div>';
    return;
  }
  container.innerHTML = store.chatMessages.map(msg => {
    if (msg.type === 'system') return `<div class="chat-msg system"><div class="msg-icon">⚡</div><div class="msg-body">${msg.text}</div>${msg.text.includes('⏳') && store.abortController ? '<button class="btn-cancel-roundtable" data-action="cancel-roundtable" title="取消请求">✕ 取消</button>' : ''}</div>`;
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
    <div class="results-header"><h3>📋 圆桌讨论完成</h3><span class="results-meta">${successCount}/${results.length} 完成 · 耗时 ${msg.totalTime}s · 费用 ${msg.cost}</span><button class="btn-export" onclick="exportMarkdown()" title="导出 Markdown">📥 导出</button></div>
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
  // friday 已有内置默认 AppID，无需检查，直接进入讨论流程
  const keys = await getApiKeys();
  console.log('[NRT] startRoundtable keys:', keys);

  openChatPanel();
  store.chatMessages = [];
  store.chatMessages.push({ type: 'user', text: topic });
  store.chatMessages.push({ type: 'system', text: '⏳ 正在召集 9 位专家，并行请求中...' });

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

  // 检查是否被用户取消
  if (result && result.cancelled) {
    store.chatMessages = store.chatMessages.filter(m => m.type !== 'progress' && !(m.type === 'system' && m.text.includes('⏳')));
    store.chatMessages.push({ type: 'system', text: '🚫 讨论已取消' });
    renderChatMessages();
    return;
  }

  // Replace progress with results
  store.chatMessages = store.chatMessages.filter(m => m.type !== 'progress' && !(m.type === 'system' && m.text.includes('⏳')));
  store.chatMessages.push({ type: 'results', results: result.results, totalTime: result.totalTime, cost: result.cost });
  renderChatMessages();

  const sc = result.results.filter(r => r.success).length;
  if (sc === EXPERTS.length) showNotification('✅ ' + EXPERTS.length + ' 位专家全部完成！', 'success');
  else showNotification('⚠️ ' + sc + '/' + EXPERTS.length + ' 完成，部分失败', 'warning');

  // Update session list
  renderSessionList();

  // Append summary button after results
  appendSummaryButton();
}

// ===== Expert Display Data (for homepage cards) =====
const EXPERT_CARDS = {
  core: [
    {
      id: 'chief-editor', icon: '📋', color: '', name: '总编辑',
      subtitle: '商业价值 · 市场定位',
      scenario: '评估题材热度、商业潜力和开篇吸引力',
      skills: ['市场分析', '商业判断', '读者画像', '黄金三章'],
      stage: '任意阶段',
      focus: ['题材热度', '变现潜力', '开篇吸引力'],
      suggestedPrompt: '请从总编辑视角出发，评估这个题材的商业潜力和目标读者。',
      responsibilities: ['判断题材热度与市场差异化', '评估付费点设置和IP改编可能', '指出致命的商业硬伤', '给出可执行的商业方向建议'],
      deliverables: ['市场定位报告', '商业评级(S/A/B/C/D)', '可执行建议清单']
    },
    {
      id: 'world-builder', icon: '🌍', color: 'teal', name: '世界观架构师',
      subtitle: '逻辑自洽 · 设定审查',
      scenario: '审查世界观逻辑、经济系统和时代背景',
      skills: ['设定审查', '逻辑验证', '历史考据', '经济系统'],
      stage: '大纲阶段',
      focus: ['时代背景', '经济系统', '社会结构'],
      suggestedPrompt: '请审查我的世界观设定，找出逻辑自洽问题。',
      responsibilities: ['核查时代背景准确性', '验证经济和权力系统的合理性', '发现设定内部矛盾', '给出具体修正方案'],
      deliverables: ['逐项核查表', '漏洞清单', '修正建议']
    },
    {
      id: 'character-designer', icon: '🎭', color: 'pink', name: '人物塑造师',
      subtitle: '角色深度 · 成长弧线',
      scenario: '评估人物立体感、动机合理性和关系张力',
      skills: ['角色设计', '心理分析', '成长弧线', '关系网络'],
      stage: '人物设计阶段',
      focus: ['性格立体度', '动机合理性', '配角独立性'],
      suggestedPrompt: '请分析我的主角和配角，找出扁平化问题。',
      responsibilities: ['评估主角性格立体度和动机合理性', '检查配角是否沦为工具人', '分析人物成长弧线清晰度', '给出增加角色深度的方法'],
      deliverables: ['人物评分表', '扁平化警告', '弧线优化建议']
    },
    {
      id: 'plot-architect', icon: '📖', color: '', name: '剧情编排师',
      subtitle: '节奏设计 · 冲突层次',
      scenario: '评估故事节奏、悬念伏笔和高潮设置',
      skills: ['结构设计', '节奏把控', '悬念布局', '转折设计'],
      stage: '大纲/正文阶段',
      focus: ['爽点密度', '冲突层次', '悬念伏笔'],
      suggestedPrompt: '请分析我的故事结构，画出情绪曲线，找出节奏问题。',
      responsibilities: ['绘制情绪曲线图', '分析爽点密度和位置', '检查冲突层次和悬念设置', '给出最值得改的节奏调整'],
      deliverables: ['情绪曲线图', '爽点分析', '结构优化方案']
    }
  ],
  genre: [
    {
      id: 'dialogue-expert', icon: '💬', color: 'pink', name: '对白专家',
      subtitle: '台词质量 · 潜台词',
      scenario: '评估对白自然度、角色语言特征和潜台词',
      skills: ['对白设计', '语言特征', '潜台词', '节奏感'],
      stage: '正文阶段',
      focus: ['角色辨识度', '信息密度', '潜台词运用'],
      suggestedPrompt: '请评估这段对白的质量，找出不自然的台词并示范改写。',
      responsibilities: ['检查不同角色说话能否区分', '找出信息倾倒和空洞对话', '示范改写问题台词', '推荐符合角色的金句'],
      deliverables: ['对白评级', '问题台词改写示范', '金句推荐']
    },
    {
      id: 'style-polisher', icon: '✨', color: '', name: '文笔润色师',
      subtitle: '文字美学 · 风格辨识',
      scenario: '评估文笔质量、修辞新颖度和情感表达',
      skills: ['风格定调', '修辞打磨', '氛围营造', '五感描写'],
      stage: '正文阶段',
      focus: ['风格辨识度', '描写生动度', 'AI味浓度'],
      suggestedPrompt: '请评估这段文字的文笔质量，找出写得好和需要改进的地方。',
      responsibilities: ['评估文笔风格统一性和辨识度', '找出生动描写和需改进的段落', '示范改写问题文字', '给出风格定位建议'],
      deliverables: ['文笔评级', '段落改写示范', '风格定位建议']
    }
  ],
  support: [
    {
      id: 'continuity-checker', icon: '🔍', color: 'teal', name: '连续性审查员',
      subtitle: 'Bug检测 · 逻辑校验',
      scenario: '发现时间线矛盾、设定冲突和逻辑漏洞',
      skills: ['逻辑审查', '时间线', '设定一致', 'Bug分级'],
      stage: '任意阶段',
      focus: ['时间线矛盾', '设定前后不一', '金手指合理性'],
      suggestedPrompt: '请扫描这段内容，找出所有逻辑漏洞和前后矛盾。',
      responsibilities: ['扫描时间线、空间、人物设定矛盾', '按致命/明显/小瑕疵分级', '给出每个Bug的修复方案', '无问题时明确告知设定自洽'],
      deliverables: ['Bug扫描报告', '分级清单', '修复建议']
    },
    {
      id: 'toxic-reader', icon: '🔥', color: 'pink', name: '毒舌读者',
      subtitle: '读者视角 · 犀利吐槽',
      scenario: '代表最挑剔读者，给出追读意愿评分',
      skills: ['读者视角', '套路识别', '爽点判断', '弃文预警'],
      stage: '任意阶段',
      focus: ['套路感', '爽感', '追读意愿'],
      suggestedPrompt: '请用最挑剔读者的视角评价这个故事，直接说会不会追。',
      responsibilities: ['给出第一印象和追读意愿', '识别套路感和爽感', '指出最让人想弃文的地方', '和同类热门作品对比'],
      deliverables: ['追读意愿评分', '弃文风险点', '毒舌一句话总结']
    },
    {
      id: 'ai-detector', icon: '🔬', color: 'teal', name: 'AI味猎手',
      subtitle: 'AI痕迹检测 · 人味诊断',
      scenario: '找出文字中的AI生成痕迹，帮作者写出人味',
      skills: ['AI味检测', '语言自然度', '人物情感真实性', '叙事节奏'],
      stage: '正文阶段',
      focus: ['模板化表达', '情感平板化', '节奏机械感'],
      suggestedPrompt: '请检测这段文字的AI味，找出最明显的痕迹并示范人味改写。',
      responsibilities: ['检测6个AI味维度', '引用原文标注AI味特征', '示范人味改写', '给出去AI味优先级建议'],
      deliverables: ['AI味指数(0-10)', 'AI味特征清单', '人味改写示范']
    }
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
  // Add click event for each expert card → open detail modal
  container.querySelectorAll('.expert-card').forEach(card => {
    card.style.cursor = 'pointer';
    card.addEventListener('click', (e) => {
      // Don't open detail if clicking checkbox area
      if (e.target.closest('.expert-checkbox') || e.target.closest('input[type="checkbox"]')) return;
      openExpertDetailModal(card.dataset.expert);
    });
  });
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

// ===== Quick Templates =====
function initQuickTemplates() {
  const container = document.getElementById('quickTemplates');
  if (!container) return;
  container.innerHTML = QUICK_TEMPLATES.map(t => `
    <div class="quick-tpl-card" data-tpl-id="${t.id}">
      <span class="qt-emoji">${t.emoji}</span>
      <div class="qt-text">
        <span class="qt-title">${t.title}</span>
        <span class="qt-desc">${t.desc}</span>
      </div>
    </div>
  `).join('');
  container.addEventListener('click', function(e) {
    const card = e.target.closest('.quick-tpl-card');
    if (!card) return;
    const tplId = card.dataset.tplId;
    const tpl = QUICK_TEMPLATES.find(t => t.id === tplId);
    if (!tpl) return;
    // 自动填充输入框
    const input = document.getElementById('creativeInput');
    if (input) { input.value = tpl.prompt; input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
    // 高亮当前卡片
    container.querySelectorAll('.quick-tpl-card').forEach(c => c.classList.remove('active'));
    card.classList.add('active');
    // 显示提示
    const expertNames = tpl.experts === 'all' ? '全部 ' + EXPERTS.length + ' 位专家' : tpl.experts.map(id => { const ex = EXPERTS.find(e => e.id === id); return ex ? ex.emoji + ex.name : id; }).join('、');
    showNotification('已切换模板：' + tpl.title + ' → ' + expertNames, 'info');
  });
}

// ===== Follow-up Zone Initialization =====
function getUserTemplates() {
  const s = localStorage.getItem(STORAGE_KEYS.USER_TEMPLATES);
  if (s) try { return JSON.parse(s); } catch(e) {}
  return [];
}
function saveUserTemplates(arr) { localStorage.setItem(STORAGE_KEYS.USER_TEMPLATES, JSON.stringify(arr.slice(0, 5))); }

function renderMyTemplates() {
  const container = document.getElementById('myTemplatesRow');
  if (!container) return;
  const templates = getUserTemplates();
  if (!templates.length) { container.innerHTML = ''; container.classList.add('hidden'); return; }
  container.classList.remove('hidden');
  container.innerHTML = '<span class="mt-label">我的模板：</span>' + templates.map((t, i) => `<span class="mt-item" data-idx="${i}"><span class="mt-text">${escapeHtml(t.slice(0, 20))}</span><span class="mt-del" data-idx="${i}">&times;</span></span>`).join('');
}

function initFollowupZone() {
  const zone = document.getElementById('chatFollowupZone');
  if (!zone) return;

  // 渲染专家选择标签
  const tagsContainer = document.getElementById('expertSelectTags');
  if (tagsContainer) {
    const allTag = '<span class="fes-tag active" data-expert="all">全部专家</span>';
    const expertTags = EXPERTS.map(e => '<span class="fes-tag" data-expert="' + e.id + '">' + e.emoji + ' ' + e.name + '</span>').join('');
    tagsContainer.innerHTML = allTag + expertTags;
    tagsContainer.addEventListener('click', function(e) {
      const tag = e.target.closest('.fes-tag');
      if (!tag) return;
      tagsContainer.querySelectorAll('.fes-tag').forEach(t => t.classList.remove('active'));
      tag.classList.add('active');
      followUpState.selectedExpert = tag.dataset.expert;
    });
  }

  // 快捷追问按钮
  zone.querySelector('.followup-quick-btns')?.addEventListener('click', function(e) {
    const btn = e.target.closest('.fq-btn');
    if (!btn) return;
    const input = document.getElementById('chatInput');
    if (input) { input.value = btn.dataset.prompt; input.focus(); }
  });

  // 模式切换 tab
  zone.querySelectorAll('.fmt-tab').forEach(tab => {
    tab.addEventListener('click', function() {
      zone.querySelectorAll('.fmt-tab').forEach(t => t.classList.remove('active'));
      this.classList.add('active');
      followUpState.mode = this.dataset.mode;
      const delPanel = document.getElementById('deliverablesBtns');
      if (delPanel) delPanel.classList.toggle('hidden', followUpState.mode !== 'deliverable');
    });
  });

  // 交付物按钮
  document.getElementById('deliverablesBtns')?.addEventListener('click', function(e) {
    const btn = e.target.closest('.fd-btn');
    if (!btn) return;
    const input = document.getElementById('chatInput');
    if (input) { input.value = btn.dataset.prompt; input.focus(); }
  });

  // 保存模板按钮
  document.getElementById('btnSaveTemplate')?.addEventListener('click', function() {
    const input = document.getElementById('chatInput');
    const text = input?.value.trim();
    if (!text) { showNotification('输入框为空，无法保存', 'warning'); return; }
    const templates = getUserTemplates();
    if (templates.includes(text)) { showNotification('该模板已存在', 'warning'); return; }
    if (templates.length >= 5) templates.pop();
    templates.unshift(text);
    saveUserTemplates(templates);
    renderMyTemplates();
    showNotification('已保存为常用模板 ⭐', 'success');
  });

  // 我的模板：点击填充 / 删除
  document.getElementById('myTemplatesRow')?.addEventListener('click', function(e) {
    const del = e.target.closest('.mt-del');
    if (del) {
      const idx = parseInt(del.dataset.idx);
      const templates = getUserTemplates();
      templates.splice(idx, 1);
      saveUserTemplates(templates);
      renderMyTemplates();
      return;
    }
    const item = e.target.closest('.mt-item');
    if (item) {
      const idx = parseInt(item.dataset.idx);
      const templates = getUserTemplates();
      const input = document.getElementById('chatInput');
      if (input && templates[idx]) { input.value = templates[idx]; input.focus(); }
    }
  });

  // 渲染已保存模板
  renderMyTemplates();
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
  document.getElementById('btnChatExport')?.addEventListener('click', exportMarkdown);
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

// Sidebar Tools
document.querySelectorAll('.tool-item[data-action]').forEach(item => {
  item.addEventListener('click', function() {
    const action = this.dataset.action;
    if (action === 'upload') toolUpload();
    else if (action === 'mindmap') toolMindmap();
    else if (action === 'download') toolDownload();
    else if (action === 'analyze') toolAnalyze();
  });
});
// Tool modal close
document.getElementById('toolModalClose')?.addEventListener('click', closeToolModal);
document.getElementById('toolModalOverlay')?.addEventListener('click', function(e) { if (e.target === this) closeToolModal(); });

  // New session
  document.getElementById('btnNewSession')?.addEventListener('click', () => { store.chatMessages = []; renderChatMessages(); openChatPanel(); showNotification('新圆桌会已创建'); });

  // Escape
  document.addEventListener('keydown', function(e) { if (e.key === 'Escape') { closeModal(); closeSettingsModal(); closeChatPanel(); closeToolModal(); } });

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

async function sendChat() {
  const input = document.getElementById('chatInput');
  const text = input?.value.trim();
  if (!text) return;
  input.value = '';
  // 如果有活跃会话，执行追问
  if (store.currentResults && store.currentResults.historyId) {
    if (followUpState.selectedExpert !== 'all') {
      await followUpSingleExpert(text, followUpState.selectedExpert);
    } else {
      await followUpRoundtable(text);
    }
  } else {
    startRoundtable(text);
  }
}

// ===== 追问：多轮对话 =====
async function followUpRoundtable(question) {
  if (store.isRoundtableRunning) { showNotification('讨论正在进行中...', 'warning'); return; }
  // friday 已有内置默认 AppID，无需检查

  store.isRoundtableRunning = true;
  store.abortController = new AbortController();
  const signal = store.abortController.signal;
  try {
    // 追加用户消息到聊天面板
    store.chatMessages.push({ type: 'user', text: question });
    store.chatMessages.push({ type: 'system', text: '⏳ 专家们正在回应追问...' });
    renderChatMessages();

    const cfg = getUserConfig();
    const keys = await getApiKeys();
    const histId = store.currentResults.historyId;
    const hist = getHistory();
    const entry = hist.find(h => h.id === histId);
    // 构建多轮消息历史
    const prevRounds = entry ? (entry.rounds || []) : [];
    prevRounds.push({ role: 'user', content: question });

    const startTime = Date.now();
    const promises = EXPERTS.map(async (expert) => {
      const modelId = getModelForExpert(expert.id, cfg);
      const modelInfo = AVAILABLE_MODELS[modelId];
      if (!modelInfo) return { expert, modelId, success: false, error: '模型不存在' };
      const apiKey = keys[modelInfo.platform];
      if (!apiKey) return { expert, modelId, modelInfo, success: false, error: '未配置 ' + API_PLATFORMS[modelInfo.platform].name + ' Key' };
      // 构建含历史的 messages（prevRounds 已包含当前 question）
      const messages = [{ role: 'system', content: expert.systemPrompt }];
      prevRounds.forEach(r => {
        if (r.role === 'user') messages.push({ role: 'user', content: r.content });
        if (r.role === 'assistant' && r.expertId === expert.id) messages.push({ role: 'assistant', content: r.content });
      });
      const t0 = Date.now();
      try {
        const content = await callAI(modelInfo.platform, apiKey, modelId, messages, { temperature: expert.temperature, max_tokens: 2000, signal });
        const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
        return { expert, modelId, modelInfo, content, elapsed, success: true };
      } catch (err) {
        if (err.name === 'AbortError') return { expert, modelId, modelInfo, success: false, error: '已取消' };
        return { expert, modelId, modelInfo, success: false, error: err.message };
      }
    });

    // abort 时立即返回，不等待剩余请求
    const abortPromise2 = new Promise(function(resolve) {
      signal.addEventListener('abort', function() {
        resolve({ __aborted: true });
      }, { once: true });
    });
    if (signal.aborted) {
      store.chatMessages = store.chatMessages.filter(m => !(m.type === 'system' && m.text.includes('⏳')));
      store.chatMessages.push({ type: 'system', text: '🚫 追问已取消' });
      renderChatMessages();
      return;
    }

    const raceResult2 = await Promise.race([
      Promise.allSettled(promises).then(function(settled) {
        return { __aborted: false, settled: settled };
      }),
      abortPromise2
    ]);

    if (raceResult2.__aborted) {
      console.log('[NRT] followUpRoundtable: abort detected via race, returning immediately');
      store.chatMessages = store.chatMessages.filter(m => !(m.type === 'system' && m.text.includes('⏳')));
      store.chatMessages.push({ type: 'system', text: '🚫 追问已取消' });
      renderChatMessages();
      return;
    }

    const settled = raceResult2.settled;
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    const results = settled.map(s => s.status === 'fulfilled' ? s.value : { success: false, error: '未知错误' });

    // 兜底检查
    if (signal.aborted) {
      store.chatMessages = store.chatMessages.filter(m => !(m.type === 'system' && m.text.includes('⏳')));
      store.chatMessages.push({ type: 'system', text: '🚫 追问已取消' });
      renderChatMessages();
      return;
    }

    // 更新历史记录
    const newResults = results.map(r => r.success ? { expertName: r.expert.name, expertId: r.expert.id, emoji: r.expert.emoji, content: r.content, model: r.modelInfo ? r.modelInfo.name : r.modelId, duration: r.elapsed } : { expertName: r.expert ? r.expert.name : '未知', expertId: r.expert ? r.expert.id : '', emoji: r.expert ? r.expert.emoji : '❓', error: r.error });
    // 记录 assistant 回复到 rounds
    results.forEach(r => { if (r.success) prevRounds.push({ role: 'assistant', expertId: r.expert.id, content: r.content }); });
    if (entry) {
      entry.rounds = prevRounds;
      entry.results = [...(entry.results || []), ...newResults];
      entry.successCount = (entry.successCount || 0) + results.filter(r => r.success).length;
      updateHistoryEntry(histId, { rounds: entry.rounds, results: entry.results, successCount: entry.successCount });
    }

    // 更新 UI
    store.chatMessages = store.chatMessages.filter(m => !(m.type === 'system' && m.text.includes('⏳')));
    const cost = formatCost(estimateCost(cfg));
    store.chatMessages.push({ type: 'results', results, totalTime, cost });
    store.currentResults = { ...store.currentResults, results, totalTime, cost };
    renderChatMessages();
    renderSessionList();
  } finally {
    store.isRoundtableRunning = false;
    store.abortController = null;
  }
}

// ===== 单专家追问 =====
async function followUpSingleExpert(question, expertId) {
  if (store.isRoundtableRunning) { showNotification('讨论正在进行中...', 'warning'); return; }
  const expert = EXPERTS.find(e => e.id === expertId);
  if (!expert) { showNotification('未找到该专家', 'warning'); return; }

  store.isRoundtableRunning = true;
  store.abortController = new AbortController();
  const signal = store.abortController.signal;
  try {
    store.chatMessages.push({ type: 'user', text: question });
    store.chatMessages.push({ type: 'system', text: '⏳ ' + expert.emoji + ' ' + expert.name + ' 正在回应...' });
    renderChatMessages();

    const cfg = getUserConfig();
    const keys = await getApiKeys();
    const modelId = getModelForExpert(expert.id, cfg);
    const modelInfo = AVAILABLE_MODELS[modelId];

    if (!modelInfo) {
      store.chatMessages = store.chatMessages.filter(m => !(m.type === 'system' && m.text.includes('⏳')));
      store.chatMessages.push({ type: 'results', results: [{ expert, modelId, success: false, error: '模型不存在' }], totalTime: '0', cost: '¥0' });
      renderChatMessages();
      return;
    }

    const apiKey = keys[modelInfo.platform];
    if (!apiKey) {
      store.chatMessages = store.chatMessages.filter(m => !(m.type === 'system' && m.text.includes('⏳')));
      store.chatMessages.push({ type: 'results', results: [{ expert, modelId, modelInfo, success: false, error: '未配置 ' + API_PLATFORMS[modelInfo.platform].name + ' Key' }], totalTime: '0', cost: '¥0' });
      renderChatMessages();
      return;
    }

    // 构建多轮消息历史
    const histId = store.currentResults.historyId;
    const hist = getHistory();
    const entry = hist.find(h => h.id === histId);
    const prevRounds = entry ? (entry.rounds || []) : [];
    prevRounds.push({ role: 'user', content: question });

    const messages = [{ role: 'system', content: expert.systemPrompt }];
    prevRounds.forEach(r => {
      if (r.role === 'user') messages.push({ role: 'user', content: r.content });
      if (r.role === 'assistant' && r.expertId === expert.id) messages.push({ role: 'assistant', content: r.content });
    });

    const t0 = Date.now();
    try {
      const content = await callAI(modelInfo.platform, apiKey, modelId, messages, { temperature: expert.temperature, max_tokens: 2000, signal });
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      const result = { expert, modelId, modelInfo, content, elapsed, success: true };

      // 更新历史
      prevRounds.push({ role: 'assistant', expertId: expert.id, content });
      const newResult = { expertName: expert.name, expertId: expert.id, emoji: expert.emoji, content, model: modelInfo.name, duration: elapsed };
      if (entry) {
        entry.rounds = prevRounds;
        entry.results = [...(entry.results || []), newResult];
        entry.successCount = (entry.successCount || 0) + 1;
        updateHistoryEntry(histId, { rounds: entry.rounds, results: entry.results, successCount: entry.successCount });
      }

      // 更新 UI
      store.chatMessages = store.chatMessages.filter(m => !(m.type === 'system' && m.text.includes('⏳')));
      store.chatMessages.push({ type: 'results', results: [result], totalTime: elapsed, cost: formatCost(estimateCost(cfg) / 8) });
      store.currentResults = { ...store.currentResults, results: [result], totalTime: elapsed };
      showNotification(expert.emoji + ' ' + expert.name + ' 回复完成', 'success');
    } catch (err) {
      store.chatMessages = store.chatMessages.filter(m => !(m.type === 'system' && m.text.includes('⏳')));
      if (err.name === 'AbortError') {
        store.chatMessages.push({ type: 'system', text: '🚫 ' + expert.emoji + ' ' + expert.name + ' 追问已取消' });
        showNotification(expert.emoji + ' ' + expert.name + ' 已取消', 'info');
      } else {
        store.chatMessages.push({ type: 'results', results: [{ expert, modelId, modelInfo, success: false, error: err.message }], totalTime: '0', cost: '¥0' });
        showNotification(expert.emoji + ' ' + expert.name + ' 请求失败', 'warning');
      }
    }

    renderChatMessages();
    renderSessionList();
  } finally {
    store.isRoundtableRunning = false;
    store.abortController = null;
  }
}

// ===== Expert Info Modal =====
function openExpertInfoModal() {
  const modal = document.getElementById('modalOverlay');
  const header = document.getElementById('modalHeader');
  const body = document.getElementById('modalBody');
  header.innerHTML = '<div class="modal-expert-top"><div class="modal-avatar expert-avatar" style="width:64px;height:64px;border-radius:16px;font-size:28px;background:var(--gradient-1);">👥</div><div class="modal-title"><h2>9 位圆桌专家</h2><p>并行评估你的小说方案</p></div></div>';
  body.innerHTML = '<div class="expert-info-modal"><div class="expert-info-grid">' + EXPERTS.map(e => '<div class="expert-info-item"><div class="ei-icon expert-avatar" style="width:40px;height:40px;border-radius:10px;font-size:20px;">' + e.emoji + '</div><div class="ei-text"><h5>' + e.name + '</h5><p>' + e.systemPrompt.split('\n')[0].slice(0, 30) + '...</p></div></div>').join('') + '</div></div>';
  document.getElementById('modalInvite').style.display = 'none';
  modal.classList.add('active');
}
function closeModal() {
  const modal = document.getElementById('modalOverlay');
  modal?.classList.remove('active');
  modal?.classList.remove('expert-detail-mode');
  // Reset footer buttons to default state
  const inviteBtn = document.getElementById('modalInvite');
  const cancelBtn = document.getElementById('modalCancel');
  inviteBtn.style.display = '';
  inviteBtn.textContent = '让 TA 加入圆桌会';
  inviteBtn.onclick = null;
  cancelBtn.style.display = '';
  cancelBtn.textContent = '关闭';
  cancelBtn.onclick = null;
}

// ===== Expert Detail Modal (Mode B: single expert) =====
function findExpertCard(expertId) {
  for (const group of Object.values(EXPERT_CARDS)) {
    const found = group.find(e => e.id === expertId);
    if (found) return found;
  }
  return null;
}

function openExpertDetailModal(expertId) {
  const expert = findExpertCard(expertId);
  if (!expert) return;
  const modal = document.getElementById('modalOverlay');
  const header = document.getElementById('modalHeader');
  const body = document.getElementById('modalBody');

  modal.classList.add('expert-detail-mode');

  header.innerHTML = `
    <div class="modal-expert-top">
      <div class="modal-avatar expert-avatar ${expert.color}" style="width:64px;height:64px;border-radius:16px;font-size:28px;">${expert.icon}</div>
      <div class="modal-title">
        <h2>${expert.name}</h2>
        <p>${expert.subtitle}</p>
      </div>
    </div>`;

  body.innerHTML = `
    <div class="expert-detail-layout">
      <div class="expert-detail-left">
        <div class="detail-section">
          <h4>适用阶段</h4>
          <p>${expert.stage}</p>
        </div>
        <div class="detail-section">
          <h4>核心关注</h4>
          <div class="detail-tags">${expert.focus.map(f => '<span class="skill-tag">' + f + '</span>').join('')}</div>
        </div>
        <div class="detail-section">
          <h4>技能标签</h4>
          <div class="detail-tags">${expert.skills.map(s => '<span class="skill-tag">' + s + '</span>').join('')}</div>
        </div>
        <div class="detail-section">
          <h4>推荐提示词</h4>
          <p class="suggested-prompt">${expert.suggestedPrompt}</p>
          <button class="btn-use-prompt" onclick="useExpertPrompt('${expert.id}')">📋 用这个提示词开始</button>
        </div>
      </div>
      <div class="expert-detail-right">
        <div class="detail-section">
          <h4>职责范围</h4>
          <ul class="detail-list">${expert.responsibilities.map(r => '<li>' + r + '</li>').join('')}</ul>
        </div>
        <div class="detail-section">
          <h4>交付成果</h4>
          <ul class="detail-list">${expert.deliverables.map(d => '<li>' + d + '</li>').join('')}</ul>
        </div>
      </div>
    </div>`;

  // Configure footer buttons
  const inviteBtn = document.getElementById('modalInvite');
  const cancelBtn = document.getElementById('modalCancel');
  inviteBtn.style.display = '';
  inviteBtn.textContent = '选择该专家';
  inviteBtn.onclick = () => selectExpertAndClose(expertId);
  cancelBtn.style.display = '';
  cancelBtn.textContent = '返回';
  cancelBtn.onclick = () => closeModal();

  modal.classList.add('active');
}

function selectExpertAndClose(expertId) {
  // Find the checkbox for this expert and toggle it
  const checkbox = document.querySelector(`.expert-card[data-expert="${expertId}"] input[type="checkbox"]`);
  if (checkbox && !checkbox.checked) {
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change', { bubbles: true }));
  }
  closeModal();
  // Scroll to the input area
  const inputArea = document.getElementById('creativeInput') || document.getElementById('novelContent') || document.getElementById('textInput');
  if (inputArea) {
    inputArea.scrollIntoView({ behavior: 'smooth', block: 'center' });
    inputArea.focus();
  }
}

function useExpertPrompt(expertId) {
  const expert = findExpertCard(expertId);
  if (!expert) return;
  const input = document.getElementById('creativeInput') || document.getElementById('novelContent') || document.getElementById('textInput');
  if (input) {
    input.value = expert.suggestedPrompt;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.focus();
  }
  closeModal();
  input?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ===== Expert Summary Report =====
function appendSummaryButton() {
  // Find the last results message in chat
  const chatContainer = document.getElementById('chatMessages');
  if (!chatContainer) return;
  const resultsMsgs = chatContainer.querySelectorAll('.results-msg');
  const lastResults = resultsMsgs[resultsMsgs.length - 1];
  if (!lastResults) return;

  // Prevent duplicate
  if (document.getElementById('summaryBtn')) return;

  const btn = document.createElement('div');
  btn.id = 'summaryBtn';
  btn.className = 'summary-cta';
  btn.innerHTML = `
    <div class="summary-cta-inner">
      <div class="summary-cta-text">
        <span class="summary-cta-icon">🧠</span>
        <div>
          <strong>综合所有专家意见</strong>
          <p>让总编辑整合9位专家的观点，给出优先级排序</p>
        </div>
      </div>
      <button class="btn-summary" onclick="runSummaryRoundtable()">生成综合报告</button>
    </div>
  `;
  lastResults.querySelector('.msg-body').appendChild(btn);
}

async function runSummaryRoundtable() {
  const results = store.currentResults?.results;
  if (!results || results.length === 0) return;

  // Show loading state
  const btn = document.getElementById('summaryBtn');
  if (btn) btn.innerHTML = '<div class="summary-loading">🧠 总编辑正在综合分析...</div>';

  // Build context from successful results
  const successResults = results.filter(r => r.success && r.content);
  if (!successResults.length) {
    if (btn) btn.innerHTML = '<div class="summary-error">没有可综合的专家意见</div>';
    return;
  }
  const context = successResults.map(r => {
    const name = r.expert?.name || '专家';
    return `【${name}的意见】\n${(r.content || '').slice(0, 800)}`;
  }).join('\n\n---\n\n');

  const summaryPrompt = `以下是9位专家对同一个小说方案的评审意见，请你作为总编辑综合所有观点，输出：

1. **最需要解决的3个核心问题**（跨专家共识，按严重程度排序）
2. **被多位专家提到的亮点**（值得保留的）
3. **建议的修改优先级**：第一步改什么，第二步改什么

要求：简洁有力，不超过400字，不重复专家原话，直接给结论。

---

${context}`;

  const chiefEditor = EXPERTS.find(e => e.id === 'chief-editor');
  if (!chiefEditor) return;

  try {
    const cfg = getUserConfig();
    const modelId = getModelForExpert('chief-editor', cfg);
    const modelInfo = AVAILABLE_MODELS[modelId];
    if (!modelInfo) throw new Error('总编辑模型配置不存在');
    const keys = await getApiKeys();
    const apiKey = keys[modelInfo.platform];
    if (!apiKey) throw new Error('未配置 ' + API_PLATFORMS[modelInfo.platform].name + ' Key');

    const response = await callAI(modelInfo.platform, apiKey, modelId, [
      { role: 'system', content: chiefEditor.systemPrompt },
      { role: 'user', content: summaryPrompt }
    ], { temperature: chiefEditor.temperature, max_tokens: 2000 });

    if (btn) {
      btn.className = 'summary-result';
      btn.innerHTML = `
        <div class="summary-result-header">
          <span>🧠</span>
          <strong>总编辑综合报告</strong>
        </div>
        <div class="summary-result-content">${renderMarkdown(response)}</div>
      `;
    }
  } catch (err) {
    if (btn) btn.innerHTML = `<div class="summary-error">综合分析失败：${escapeHtml(err.message)}</div>`;
  }
}

// Expose to window for potential onclick usage
window.openExpertDetailModal = openExpertDetailModal;
window.selectExpertAndClose = selectExpertAndClose;
window.useExpertPrompt = useExpertPrompt;
window.runSummaryRoundtable = runSummaryRoundtable;

// ===== Sidebar =====
function initSidebar() {
const sidebar = document.getElementById('sidebar');
const toggle = document.getElementById('sidebarToggle');
if (!sidebar || !toggle) return;
toggle.addEventListener('click', function() {
sidebar.classList.toggle('collapsed');
const isCollapsed = sidebar.classList.contains('collapsed');
this.querySelector('.toggle-icon').textContent = isCollapsed ? '☰' : '✕';
// Sync chat panel left offset with sidebar state
const chatPanel = document.getElementById('chatPanel');
if (chatPanel) {
  if (isCollapsed) chatPanel.classList.remove('sidebar-expanded');
  else chatPanel.classList.add('sidebar-expanded');
}
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
      <span class="session-export" title="导出 Markdown">📥</span>
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
      if (e.target.classList.contains('session-export')) {
        const id = parseInt(this.dataset.id);
        exportHistoryEntry(id);
        return;
      }
      const id = parseInt(this.dataset.id);
      restoreSession(id);
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
  const isLight = document.body.getAttribute('data-theme') === 'light';
  document.body.setAttribute('data-theme', isLight ? '' : 'light');
  document.getElementById('btnTheme').innerHTML = isLight ? '🌙' : '☀';
  localStorage.setItem('nrt-theme', isLight ? 'dark' : 'light');
}
// Restore theme on load
(function restoreTheme() {
  const saved = localStorage.getItem('nrt-theme');
  if (saved === 'light') {
    document.body.setAttribute('data-theme', 'light');
    const btn = document.getElementById('btnTheme');
    if (btn) btn.innerHTML = '☀';
  }
})();

// ===== Notifications =====
function showNotification(message, type) {
  const container = document.getElementById('notificationContainer');
  const n = document.createElement('div');
  n.className = 'notification ' + (type || 'info');
  n.textContent = message;
  container.appendChild(n);
  setTimeout(() => { n.classList.add('exit'); setTimeout(() => n.remove(), 300); }, 3000);
}

// ===== 恢复历史会话 =====
function restoreSession(id) {
  const hist = getHistory();
  const entry = hist.find(h => h.id === id);
  if (!entry || !entry.results || !entry.results.length) {
    showNotification('该会话无完整记录', 'warning');
    return;
  }
  // 辅助：将存储格式转为渲染格式
  function toRenderResults(arr) {
    return arr.map(r => {
      if (r.error) {
        const expert = EXPERTS.find(e => e.id === r.expertId) || { name: r.expertName, emoji: r.emoji, id: r.expertId };
        return { expert, success: false, error: r.error };
      }
      const expert = EXPERTS.find(e => e.id === r.expertId) || { name: r.expertName, emoji: r.emoji, id: r.expertId };
      return { expert, success: true, content: r.content, modelInfo: { name: r.model }, elapsed: r.duration, modelId: r.model };
    });
  }

  // 第一轮 results（前8个）
  const firstRoundRaw = entry.results.slice(0, 8);
  const results = toRenderResults(firstRoundRaw);

  // 重建聊天面板
  store.chatMessages = [];
  store.chatMessages.push({ type: 'user', text: entry.topic });
  store.chatMessages.push({ type: 'results', results, totalTime: entry.totalTime || '?', cost: '历史记录' });

  // 如果有多轮追问，逐轮渲染
  if (entry.rounds && entry.rounds.length > 1) {
    const userRounds = entry.rounds.filter(r => r.role === 'user');
    // 第一轮已经渲染，从第二轮开始
    for (let i = 1; i < userRounds.length; i++) {
      store.chatMessages.push({ type: 'user', text: userRounds[i].content });
      // 找到该轮对应的 assistant 回复（在 results 中按顺序分组，每8个一轮）
      const baseIdx = i * 8;
      const roundResults = entry.results.slice(baseIdx, baseIdx + 8);
      if (roundResults.length) {
        store.chatMessages.push({ type: 'results', results: toRenderResults(roundResults), totalTime: '?', cost: '历史记录' });
      }
    }
  }

  store.currentResults = { topic: entry.topic, historyId: entry.id, results, totalTime: entry.totalTime || '?', cost: '历史记录' };
  openChatPanel();
  renderChatMessages();
}

// ===== 导出 Markdown =====
function generateMarkdown(topic, results, timestamp) {
  const time = timestamp ? new Date(timestamp) : new Date();
  const timeStr = time.toLocaleString('zh-CN');

  let md = '# 小说圆桌讨论 - ' + (topic || '未命名') + '\n\n';
  md += '> 时间：' + timeStr + '\n\n';
  md += '---\n\n';

  results.forEach(r => {
    const name = r.expert ? r.expert.name : (r.expertName || '未知');
    const emoji = r.expert ? r.expert.emoji : (r.emoji || '');
    md += '## ' + emoji + ' ' + name + '\n\n';
    if ((r.success !== undefined ? r.success : !r.error) && (r.content)) {
      md += r.content + '\n\n';
    } else if (r.error) {
      md += '> ❌ 失败：' + r.error + '\n\n';
    }
    md += '---\n\n';
  });

  md += '\n> *由 [NovelRoundTable](https://mingzhong717-droid.github.io/novel-roundtable-v2/) 生成*\n';
  return md;
}

function makeExportFilename(topic, timestamp) {
  const date = timestamp ? new Date(timestamp) : new Date();
  const dateStr = date.toISOString().slice(0, 10);
  const topicSlug = (topic || '').replace(/[\\/:*?"<>|\s]/g, '').slice(0, 15);
  return 'roundtable_' + dateStr + '_' + (topicSlug || '讨论') + '.md';
}

function downloadMarkdown(md, filename) {
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showNotification('已导出: ' + filename, 'success');
}

function exportMarkdown() {
  if (!store.currentResults || !store.currentResults.results) {
    showNotification('没有可导出的讨论内容', 'warning');
    return;
  }
  const { topic, results } = store.currentResults;
  const md = generateMarkdown(topic, results);
  const filename = makeExportFilename(topic);
  downloadMarkdown(md, filename);
}

function exportHistoryEntry(id) {
  const hist = getHistory();
  const entry = hist.find(h => h.id === id);
  if (!entry || !entry.results || !entry.results.length) {
    showNotification('该会话无可导出内容', 'warning');
    return;
  }
  // 将存储格式转为导出格式
  const results = entry.results.map(r => {
    if (r.error) return { expertName: r.expertName, emoji: r.emoji, error: r.error };
    return { expertName: r.expertName, emoji: r.emoji, content: r.content, success: true };
  });
  const md = generateMarkdown(entry.topic, results, entry.timestamp);
  const filename = makeExportFilename(entry.topic, entry.timestamp);
  downloadMarkdown(md, filename);
}

// 暴露 exportMarkdown / cancelRoundtable 到全局（因为 onclick 在 IIFE 外）
window.exportMarkdown = exportMarkdown;
window.cancelRoundtable = cancelRoundtable;

// ===== 功能工具实现（增强版） =====

function openToolModal(title, bodyHtml, footerHtml) {
  const overlay = document.getElementById('toolModalOverlay');
  document.getElementById('toolModalHeader').innerHTML = '<h2>' + title + '</h2>';
  document.getElementById('toolModalBody').innerHTML = bodyHtml;
  document.getElementById('toolModalFooter').innerHTML = footerHtml || '';
  overlay.classList.add('active');
}
function closeToolModal() {
  document.getElementById('toolModalOverlay')?.classList.remove('active');
}

// ===== 工具1: 上传大纲/草稿（增强版） =====
function toolUpload() {
  const sessions = store.sessions || [];
  const sessionOptions = sessions.length
    ? sessions.map(s => '<option value="' + s.id + '">' + escapeHtml(s.title || '未命名会话') + '</option>').join('')
    : '<option value="">-- 暂无可关联的圆桌会 --</option>';

  const body = `
    <div class="tool-upload-content">
      <div class="tool-steps">
        <div class="tool-step active" data-step="1"><span class="step-num">1</span><span class="step-text">选择文件</span></div>
        <div class="tool-step" data-step="2"><span class="step-num">2</span><span class="step-text">填写信息</span></div>
        <div class="tool-step" data-step="3"><span class="step-num">3</span><span class="step-text">确认导入</span></div>
      </div>
      <div class="tool-step-panels">
        <div class="step-panel active" id="uploadStep1">
          <p class="tool-desc">上传你的小说大纲、草稿或参考文档，AI 专家将基于此进行讨论。</p>
          <div class="upload-drop-zone" id="uploadDropZone">
            <div class="udz-icon">📁</div>
            <p class="udz-title">拖拽文件到此处</p>
            <p class="udz-sub">或 <label for="uploadFileInput" class="udz-link">点击选择文件</label></p>
            <input type="file" id="uploadFileInput" accept=".txt,.md,.text,.doc,.docx,.pdf" style="display:none"/>
            <span class="udz-hint">支持格式: TXT, Markdown, Word (.doc/.docx), PDF</span>
            <span class="udz-hint">最大文件大小: 10MB</span>
          </div>
          <div class="upload-file-info hidden" id="uploadFileInfo">
            <div class="ufi-icon">✅</div>
            <div class="ufi-detail">
              <span class="ufi-name" id="uploadFileName">-</span>
              <span class="ufi-size" id="uploadFileSize">-</span>
            </div>
            <button class="ufi-remove" id="uploadFileRemove" title="移除文件">&times;</button>
          </div>
          <div class="upload-divider"><span>或直接粘贴文本</span></div>
          <textarea id="uploadTextarea" class="upload-textarea" placeholder="在此粘贴你的大纲或草稿内容..." rows="6"></textarea>
          <div class="upload-char-count"><span id="uploadCharCount">0</span> 字</div>
        </div>
        <div class="step-panel" id="uploadStep2">
          <div class="upload-form-group">
            <label class="ufg-label">📌 作品标题 <span class="required">*</span></label>
            <input type="text" id="uploadTitle" class="ufg-input" placeholder="请输入作品标题"/>
          </div>
          <div class="upload-form-group">
            <label class="ufg-label">📝 作品描述</label>
            <textarea id="uploadDesc" class="ufg-textarea" placeholder="简要描述作品的核心设定、主要人物和故事走向..." rows="3"></textarea>
          </div>
          <div class="upload-form-group">
            <label class="ufg-label">🏷️ 题材标签</label>
            <div class="upload-tags" id="uploadTags">
              <span class="utag" data-tag="玄幻">玄幻</span>
              <span class="utag" data-tag="都市">都市</span>
              <span class="utag" data-tag="悬疑">悬疑</span>
              <span class="utag" data-tag="言情">言情</span>
              <span class="utag" data-tag="科幻">科幻</span>
              <span class="utag" data-tag="仙侠">仙侠</span>
              <span class="utag" data-tag="历史">历史</span>
              <span class="utag" data-tag="恐怖">恐怖</span>
            </div>
          </div>
          <div class="upload-form-group">
            <label class="ufg-label">🔗 关联圆桌会</label>
            <select id="uploadSession" class="ufg-select">${sessionOptions}</select>
            <span class="ufg-hint">关联后可在圆桌讨论中直接引用此文档</span>
          </div>
        </div>
        <div class="step-panel" id="uploadStep3">
          <div class="upload-preview">
            <h4>确认导入信息</h4>
            <div class="up-summary" id="uploadSummary"></div>
          </div>
        </div>
      </div>
    </div>
  `;
  const footer = `
    <button class="btn-entry secondary" id="btnUploadPrev" style="display:none">上一步</button>
    <button class="btn-entry primary" id="btnUploadNext">下一步</button>
    <button class="btn-entry primary" id="btnUploadConfirm" style="display:none">确认导入</button>
    <button class="btn-entry secondary" id="btnUploadCancel">取消</button>
  `;
  openToolModal('📄 上传大纲/草稿', body, footer);

  // State
  let currentStep = 1;
  let uploadedText = '';
  let uploadedFileName = '';
  const selectedTags = new Set();

  // Step navigation
  function goToStep(step) {
    currentStep = step;
    document.querySelectorAll('.tool-step').forEach(s => {
      const sn = parseInt(s.dataset.step);
      s.classList.toggle('active', sn === step);
      s.classList.toggle('done', sn < step);
    });
    document.querySelectorAll('.step-panel').forEach((p, i) => p.classList.toggle('active', i === step - 1));
    document.getElementById('btnUploadPrev').style.display = step > 1 ? '' : 'none';
    document.getElementById('btnUploadNext').style.display = step < 3 ? '' : 'none';
    document.getElementById('btnUploadConfirm').style.display = step === 3 ? '' : 'none';
    if (step === 3) renderUploadSummary();
  }

  function renderUploadSummary() {
    const title = document.getElementById('uploadTitle').value.trim() || '未命名';
    const desc = document.getElementById('uploadDesc').value.trim() || '无描述';
    const tags = [...selectedTags].join(', ') || '无';
    const textLen = uploadedText.length;
    document.getElementById('uploadSummary').innerHTML = `
      <div class="ups-row"><span class="ups-label">标题</span><span class="ups-val">${escapeHtml(title)}</span></div>
      <div class="ups-row"><span class="ups-label">描述</span><span class="ups-val">${escapeHtml(desc.slice(0, 50))}${desc.length > 50 ? '...' : ''}</span></div>
      <div class="ups-row"><span class="ups-label">标签</span><span class="ups-val">${escapeHtml(tags)}</span></div>
      <div class="ups-row"><span class="ups-label">文件</span><span class="ups-val">${uploadedFileName || '手动粘贴'}</span></div>
      <div class="ups-row"><span class="ups-label">字数</span><span class="ups-val">${textLen} 字</span></div>
    `;
  }

  document.getElementById('btnUploadNext').addEventListener('click', function() {
    if (currentStep === 1) {
      uploadedText = document.getElementById('uploadTextarea').value.trim();
      if (!uploadedText) { showNotification('请先上传文件或粘贴内容', 'warning'); return; }
    }
    if (currentStep === 2) {
      const title = document.getElementById('uploadTitle').value.trim();
      if (!title) { showNotification('请填写作品标题', 'warning'); return; }
    }
    goToStep(currentStep + 1);
  });
  document.getElementById('btnUploadPrev').addEventListener('click', function() { goToStep(currentStep - 1); });

  // File handling
  const fileInput = document.getElementById('uploadFileInput');
  const dropZone = document.getElementById('uploadDropZone');
  const textarea = document.getElementById('uploadTextarea');

  function handleFile(file) {
    if (file.size > 10 * 1024 * 1024) { showNotification('文件过大（最大 10MB）', 'warning'); return; }
    const ext = file.name.split('.').pop().toLowerCase();
    if (['txt', 'md', 'text'].includes(ext)) {
      readUploadFile(file, textarea);
    } else if (['doc', 'docx', 'pdf'].includes(ext)) {
      // For doc/docx/pdf, show file info but note limitation
      showNotification('已选择文件（浏览器端仅支持文本预览，Word/PDF 内容将以文件名记录）', 'warning');
      textarea.value = '[文件: ' + file.name + ']\n\n请在此补充文档的核心内容摘要，以便 AI 专家参考。';
    }
    uploadedFileName = file.name;
    document.getElementById('uploadFileInfo').classList.remove('hidden');
    document.getElementById('uploadFileName').textContent = file.name;
    document.getElementById('uploadFileSize').textContent = formatFileSize(file.size);
  }

  fileInput.addEventListener('change', function() { if (this.files[0]) handleFile(this.files[0]); });
  dropZone.addEventListener('dragover', function(e) { e.preventDefault(); this.classList.add('dragover'); });
  dropZone.addEventListener('dragleave', function() { this.classList.remove('dragover'); });
  dropZone.addEventListener('drop', function(e) {
    e.preventDefault(); this.classList.remove('dragover');
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  });

  document.getElementById('uploadFileRemove')?.addEventListener('click', function() {
    uploadedFileName = '';
    textarea.value = '';
    document.getElementById('uploadFileInfo').classList.add('hidden');
    fileInput.value = '';
  });

  // Char count
  textarea.addEventListener('input', function() {
    document.getElementById('uploadCharCount').textContent = this.value.length;
  });

  // Tags
  document.querySelectorAll('.utag').forEach(tag => {
    tag.addEventListener('click', function() {
      const t = this.dataset.tag;
      if (selectedTags.has(t)) { selectedTags.delete(t); this.classList.remove('active'); }
      else { selectedTags.add(t); this.classList.add('active'); }
    });
  });

  // Confirm
  document.getElementById('btnUploadConfirm').addEventListener('click', function() {
    const input = document.getElementById('creativeInput');
    const title = document.getElementById('uploadTitle').value.trim();
    const desc = document.getElementById('uploadDesc').value.trim();
    let finalText = uploadedText;
    if (title) finalText = '【' + title + '】\n' + (desc ? desc + '\n\n' : '\n') + finalText;
    if (selectedTags.size) finalText = '题材: ' + [...selectedTags].join('/') + '\n' + finalText;
    if (input) { input.value = finalText; input.focus(); }
    closeToolModal();
    showNotification('已导入「' + title + '」(' + uploadedText.length + ' 字) 到输入框', 'success');
  });
  document.getElementById('btnUploadCancel').addEventListener('click', closeToolModal);
}

function readUploadFile(file, textarea) {
  if (file.size > 10 * 1024 * 1024) { showNotification('文件过大（最大 10MB）', 'warning'); return; }
  const reader = new FileReader();
  reader.onload = function(e) {
    textarea.value = e.target.result;
    document.getElementById('uploadCharCount').textContent = e.target.result.length;
    showNotification('已读取文件: ' + file.name, 'success');
  };
  reader.onerror = function() { showNotification('文件读取失败', 'warning'); };
  reader.readAsText(file);
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// ===== 工具2: 讨论思维导图（增强版） =====
function toolMindmap() {
  if (!store.currentResults || !store.currentResults.results) {
    showNotification('请先完成一次圆桌讨论', 'warning');
    return;
  }
  const results = store.currentResults.results.filter(r => r.success);
  if (!results.length) { showNotification('没有可用的讨论结果', 'warning'); return; }

  const topic = store.currentResults.topic || '小说方案';
  const nodes = results.map(r => {
    const content = r.content || '';
    const lines = content.split('\n').filter(l => l.trim());
    const keyPoints = [];
    for (let i = 0; i < lines.length && keyPoints.length < 4; i++) {
      const line = lines[i].replace(/^[#*\-\d.]+\s*/, '').trim();
      if (line.length > 5 && line.length < 80) keyPoints.push(line);
    }
    if (!keyPoints.length) keyPoints.push(content.slice(0, 50) + '...');
    return { name: r.expert.name, emoji: r.expert.emoji, points: keyPoints, id: r.expert.id };
  });

  // Build interactive HTML mindmap (not just SVG)
  const mindmapHtml = buildInteractiveMindmap(topic, nodes);

  const body = `
    <div class="tool-mindmap-content">
      <p class="tool-desc">基于当前讨论结果生成的思维导图 · 点击节点展开/折叠详情</p>
      <div class="mindmap-toolbar">
        <button class="mm-tb-btn active" data-layout="radial" title="放射布局">🎯 放射</button>
        <button class="mm-tb-btn" data-layout="tree" title="树形布局">🌳 树形</button>
        <button class="mm-tb-btn" data-layout="list" title="列表布局">📋 列表</button>
      </div>
      <div class="mindmap-container" id="mindmapContainer">${mindmapHtml}</div>
    </div>
  `;
  const footer = `
    <button class="btn-entry primary" id="btnMindmapExportPng">导出 PNG</button>
    <button class="btn-entry secondary" id="btnMindmapExportSvg">导出 SVG</button>
    <button class="btn-entry secondary" id="btnMindmapClose">关闭</button>
  `;
  openToolModal('🧠 讨论思维导图', body, footer);

  // Layout toggle
  document.querySelectorAll('.mm-tb-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.mm-tb-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      const layout = this.dataset.layout;
      const container = document.getElementById('mindmapContainer');
      if (layout === 'radial') container.innerHTML = buildInteractiveMindmap(topic, nodes);
      else if (layout === 'tree') container.innerHTML = buildTreeMindmap(topic, nodes);
      else container.innerHTML = buildListMindmap(topic, nodes);
      bindMindmapEvents();
    });
  });

  bindMindmapEvents();

  document.getElementById('btnMindmapExportPng').addEventListener('click', () => exportMindmapAs('png'));
  document.getElementById('btnMindmapExportSvg').addEventListener('click', () => exportMindmapAs('svg'));
  document.getElementById('btnMindmapClose').addEventListener('click', closeToolModal);
}

function buildInteractiveMindmap(topic, nodes) {
  const svgWidth = 900;
  const svgHeight = 500;
  const centerX = svgWidth / 2;
  const centerY = svgHeight / 2;
  const radius = 180;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgWidth} ${svgHeight}" class="mindmap-svg" id="mindmapSvg">`;
  svg += `<defs><filter id="glow"><feGaussianBlur stdDeviation="3" result="coloredBlur"/><feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`;

  // Central topic node
  svg += `<circle cx="${centerX}" cy="${centerY}" r="50" fill="var(--primary)" opacity="0.9" filter="url(#glow)"/>`;
  svg += `<text x="${centerX}" y="${centerY + 5}" text-anchor="middle" fill="#fff" font-size="13" font-weight="600">${escapeHtml(topic.slice(0, 10))}</text>`;

  nodes.forEach((node, i) => {
    const angle = (2 * Math.PI * i / nodes.length) - Math.PI / 2;
    const x = centerX + radius * Math.cos(angle);
    const y = centerY + radius * Math.sin(angle);

    // Connection line (curved)
    const cpx = centerX + (radius * 0.5) * Math.cos(angle);
    const cpy = centerY + (radius * 0.5) * Math.sin(angle);
    svg += `<path d="M${centerX},${centerY} Q${cpx},${cpy} ${x},${y}" fill="none" stroke="var(--primary-light)" stroke-width="2" opacity="0.4"/>`;

    // Expert node
    svg += `<g class="mm-node" data-expert="${i}" style="cursor:pointer">`;
    svg += `<circle cx="${x}" cy="${y}" r="32" fill="var(--surface)" stroke="var(--primary-light)" stroke-width="2"/>`;
    svg += `<text x="${x}" y="${y - 5}" text-anchor="middle" font-size="16">${node.emoji}</text>`;
    svg += `<text x="${x}" y="${y + 14}" text-anchor="middle" fill="var(--text-primary)" font-size="10" font-weight="500">${escapeHtml(node.name)}</text>`;
    svg += `</g>`;

    // Key points (initially hidden, shown on click)
    node.points.forEach((pt, j) => {
      const ptAngle = angle + (j - (node.points.length - 1) / 2) * 0.2;
      const ptRadius = radius + 80 + j * 25;
      const px = centerX + ptRadius * Math.cos(ptAngle);
      const py = centerY + ptRadius * Math.sin(ptAngle);
      svg += `<g class="mm-point hidden" data-expert="${i}">`;
      svg += `<line x1="${x}" y1="${y}" x2="${px}" y2="${py}" stroke="var(--border)" stroke-width="1" opacity="0.5"/>`;
      svg += `<rect x="${px - 60}" y="${py - 10}" width="120" height="20" rx="10" fill="var(--surface-hover)" stroke="var(--border)" stroke-width="0.5"/>`;
      svg += `<text x="${px}" y="${py + 4}" text-anchor="middle" fill="var(--text-secondary)" font-size="9">${escapeHtml(pt.slice(0, 14))}</text>`;
      svg += `</g>`;
    });
  });
  svg += '</svg>';
  return svg;
}

function buildTreeMindmap(topic, nodes) {
  let html = '<div class="mm-tree">';
  html += '<div class="mm-tree-root"><span class="mm-tree-node root">' + escapeHtml(topic) + '</span></div>';
  html += '<div class="mm-tree-branches">';
  nodes.forEach(node => {
    html += '<div class="mm-tree-branch">';
    html += '<div class="mm-tree-expert"><span class="mm-tree-node expert">' + node.emoji + ' ' + escapeHtml(node.name) + '</span></div>';
    html += '<div class="mm-tree-points">';
    node.points.forEach(pt => {
      html += '<div class="mm-tree-point"><span class="mm-tree-node point">' + escapeHtml(pt.slice(0, 30)) + '</span></div>';
    });
    html += '</div></div>';
  });
  html += '</div></div>';
  return html;
}

function buildListMindmap(topic, nodes) {
  let html = '<div class="mm-list">';
  html += '<div class="mm-list-topic"><h3>' + escapeHtml(topic) + '</h3></div>';
  nodes.forEach(node => {
    html += '<div class="mm-list-expert">';
    html += '<div class="mm-list-header">' + node.emoji + ' <strong>' + escapeHtml(node.name) + '</strong></div>';
    html += '<ul class="mm-list-points">';
    node.points.forEach(pt => { html += '<li>' + escapeHtml(pt) + '</li>'; });
    html += '</ul></div>';
  });
  html += '</div>';
  return html;
}

function bindMindmapEvents() {
  document.querySelectorAll('.mm-node').forEach(node => {
    node.addEventListener('click', function() {
      const idx = this.dataset.expert;
      const points = document.querySelectorAll('.mm-point[data-expert="' + idx + '"]');
      const isHidden = points[0]?.classList.contains('hidden');
      points.forEach(p => p.classList.toggle('hidden', !isHidden));
      this.querySelector('circle').setAttribute('stroke-width', isHidden ? '3' : '2');
    });
  });
}

function exportMindmapAs(format) {
  const svgEl = document.getElementById('mindmapSvg');
  if (!svgEl) {
    // For tree/list layout, export as text
    const container = document.getElementById('mindmapContainer');
    const text = container?.innerText || '';
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'mindmap.txt';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showNotification('已导出为文本', 'success');
    return;
  }

  if (format === 'svg') {
    const svgData = new XMLSerializer().serializeToString(svgEl);
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = 'roundtable_mindmap_' + new Date().toISOString().slice(0, 10) + '.svg';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showNotification('思维导图已导出为 SVG', 'success');
  } else {
    // PNG export via canvas
    const svgData = new XMLSerializer().serializeToString(svgEl);
    const canvas = document.createElement('canvas');
    canvas.width = 1800; canvas.height = 1000;
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = function() {
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(function(blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url;
        a.download = 'roundtable_mindmap_' + new Date().toISOString().slice(0, 10) + '.png';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showNotification('思维导图已导出为 PNG', 'success');
      }, 'image/png');
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  }
}

// ===== 工具3: 小说草稿下载（增强版） =====
function toolDownload() {
  if (!store.currentResults || !store.currentResults.results) {
    showNotification('请先完成一次圆桌讨论', 'warning');
    return;
  }
  const results = store.currentResults.results;
  const topic = store.currentResults.topic || '未命名';
  const successResults = results.filter(r => r.success);
  if (!successResults.length) { showNotification('没有可导出的讨论内容', 'warning'); return; }

  const body = `
    <div class="tool-download-content">
      <div class="tool-steps">
        <div class="tool-step active" data-step="1"><span class="step-num">1</span><span class="step-text">选择格式</span></div>
        <div class="tool-step" data-step="2"><span class="step-num">2</span><span class="step-text">内容配置</span></div>
        <div class="tool-step" data-step="3"><span class="step-num">3</span><span class="step-text">预览下载</span></div>
      </div>
      <div class="tool-step-panels">
        <div class="step-panel active" id="dlStep1">
          <p class="tool-desc">选择导出格式</p>
          <div class="download-options">
            <label class="download-option active">
              <input type="radio" name="dlFormat" value="markdown" checked/>
              <div class="do-icon">📝</div>
              <div class="do-info"><h4>Markdown</h4><p>完整讨论记录，适合二次编辑和发布</p></div>
            </label>
            <label class="download-option">
              <input type="radio" name="dlFormat" value="txt"/>
              <div class="do-icon">📄</div>
              <div class="do-info"><h4>纯文本 TXT</h4><p>去除格式标记，适合复制粘贴</p></div>
            </label>
            <label class="download-option">
              <input type="radio" name="dlFormat" value="json"/>
              <div class="do-icon">📦</div>
              <div class="do-info"><h4>JSON 数据</h4><p>结构化数据，适合程序处理和二次开发</p></div>
            </label>
            <label class="download-option">
              <input type="radio" name="dlFormat" value="html"/>
              <div class="do-icon">🌐</div>
              <div class="do-info"><h4>HTML 网页</h4><p>带样式的网页文件，可直接在浏览器打开</p></div>
            </label>
          </div>
        </div>
        <div class="step-panel" id="dlStep2">
          <p class="tool-desc">配置导出内容</p>
          <div class="dl-config-section">
            <h4>📋 内容范围</h4>
            <div class="dl-checkboxes">
              <label class="dl-check"><input type="checkbox" id="dlIncludeAll" checked/><span>包含所有专家评估</span></label>
              <label class="dl-check"><input type="checkbox" id="dlIncludeMeta" checked/><span>包含元信息（模型、耗时、Token）</span></label>
              <label class="dl-check"><input type="checkbox" id="dlIncludeSummary" checked/><span>生成讨论摘要</span></label>
              <label class="dl-check"><input type="checkbox" id="dlIncludeTimeline"/><span>包含时间线</span></label>
            </div>
          </div>
          <div class="dl-config-section">
            <h4>🎨 文档结构</h4>
            <div class="dl-templates">
              <div class="dl-template active" data-tpl="full"><span class="dlt-icon">📖</span><span class="dlt-name">完整报告</span><span class="dlt-desc">包含封面、目录、正文</span></div>
              <div class="dl-template" data-tpl="compact"><span class="dlt-icon">📋</span><span class="dlt-name">精简版</span><span class="dlt-desc">仅核心观点和建议</span></div>
              <div class="dl-template" data-tpl="outline"><span class="dlt-icon">📐</span><span class="dlt-name">大纲模式</span><span class="dlt-desc">层级结构化要点</span></div>
            </div>
          </div>
        </div>
        <div class="step-panel" id="dlStep3">
          <p class="tool-desc">预览导出内容</p>
          <div class="dl-preview" id="dlPreview"></div>
        </div>
      </div>
    </div>
  `;
  const footer = `
    <button class="btn-entry secondary" id="btnDlPrev" style="display:none">上一步</button>
    <button class="btn-entry primary" id="btnDlNext">下一步</button>
    <button class="btn-entry primary" id="btnDlConfirm" style="display:none">⬇ 下载文件</button>
    <button class="btn-entry secondary" id="btnDlCancel">取消</button>
  `;
  openToolModal('📥 小说草稿下载', body, footer);

  let dlStep = 1;
  let selectedTemplate = 'full';

  function goToDlStep(step) {
    dlStep = step;
    document.querySelectorAll('.tool-download-content .tool-step').forEach(s => {
      const sn = parseInt(s.dataset.step);
      s.classList.toggle('active', sn === step);
      s.classList.toggle('done', sn < step);
    });
    document.querySelectorAll('.tool-download-content .step-panel').forEach((p, i) => p.classList.toggle('active', i === step - 1));
    document.getElementById('btnDlPrev').style.display = step > 1 ? '' : 'none';
    document.getElementById('btnDlNext').style.display = step < 3 ? '' : 'none';
    document.getElementById('btnDlConfirm').style.display = step === 3 ? '' : 'none';
    if (step === 3) renderDlPreview();
  }

  function renderDlPreview() {
    const format = document.querySelector('input[name="dlFormat"]:checked').value;
    const preview = document.getElementById('dlPreview');
    const content = generateExportContent(format, topic, results, selectedTemplate);
    const previewText = content.slice(0, 800) + (content.length > 800 ? '\n\n... (预览截断)' : '');
    preview.innerHTML = '<pre class="dl-preview-code">' + escapeHtml(previewText) + '</pre>';
  }

  // Radio style toggle
  document.querySelectorAll('.download-option input[name="dlFormat"]').forEach(radio => {
    radio.addEventListener('change', function() {
      document.querySelectorAll('.download-option').forEach(o => o.classList.remove('active'));
      this.closest('.download-option').classList.add('active');
    });
  });

  // Template toggle
  document.querySelectorAll('.dl-template').forEach(tpl => {
    tpl.addEventListener('click', function() {
      document.querySelectorAll('.dl-template').forEach(t => t.classList.remove('active'));
      this.classList.add('active');
      selectedTemplate = this.dataset.tpl;
    });
  });

  document.getElementById('btnDlNext').addEventListener('click', function() { goToDlStep(dlStep + 1); });
  document.getElementById('btnDlPrev').addEventListener('click', function() { goToDlStep(dlStep - 1); });

  document.getElementById('btnDlConfirm').addEventListener('click', function() {
    const format = document.querySelector('input[name="dlFormat"]:checked').value;
    const includeMeta = document.getElementById('dlIncludeMeta').checked;
    executeDownload(format, topic, results, includeMeta, selectedTemplate);
    closeToolModal();
  });
  document.getElementById('btnDlCancel').addEventListener('click', closeToolModal);
}

function generateExportContent(format, topic, results, template) {
  const timestamp = new Date().toLocaleString('zh-CN');
  const successResults = results.filter(r => r.success);

  if (format === 'markdown') {
    let md = '';
    if (template === 'full') {
      md += '# 🎭 小说圆桌讨论报告\n\n';
      md += '> **主题**: ' + topic + '  \n';
      md += '> **时间**: ' + timestamp + '  \n';
      md += '> **专家数**: ' + successResults.length + ' 位  \n\n';
      md += '---\n\n## 📋 目录\n\n';
      successResults.forEach((r, i) => { md += (i + 1) + '. ' + r.expert.emoji + ' ' + r.expert.name + '\n'; });
      md += '\n---\n\n';
    } else if (template === 'outline') {
      md += '# ' + topic + ' - 讨论要点\n\n';
    }
    successResults.forEach(r => {
      md += '## ' + r.expert.emoji + ' ' + r.expert.name + '\n\n';
      if (template === 'compact') {
        const lines = (r.content || '').split('\n').filter(l => l.trim()).slice(0, 5);
        md += lines.join('\n') + '\n\n';
      } else {
        md += (r.content || '') + '\n\n';
      }
      if (template === 'full' && r.modelInfo) {
        md += '*模型: ' + r.modelInfo.name + ' | 耗时: ' + (r.elapsed || '?') + 's*\n\n';
      }
      md += '---\n\n';
    });
    md += '\n> *由 [NovelRoundTable](https://mingzhong717-droid.github.io/novel-roundtable-v2/) 生成*\n';
    return md;
  } else if (format === 'txt') {
    let txt = '小说圆桌讨论 - ' + topic + '\n时间：' + timestamp + '\n' + '='.repeat(40) + '\n\n';
    successResults.forEach(r => {
      txt += '【' + r.expert.emoji + ' ' + r.expert.name + '】\n';
      txt += (r.content || '') + '\n\n';
    });
    txt += '\n-- 由 NovelRoundTable 生成 (https://mingzhong717-droid.github.io/novel-roundtable-v2/)\n';
    return txt;
  } else if (format === 'json') {
    return JSON.stringify({
      topic, timestamp, template,
      totalTime: store.currentResults.totalTime,
      experts: results.map(r => ({
        name: r.expert ? r.expert.name : '未知',
        id: r.expert ? r.expert.id : '',
        model: r.modelInfo ? r.modelInfo.name : r.modelId,
        success: r.success,
        content: r.success ? r.content : null,
        error: r.success ? null : r.error,
        elapsed: r.elapsed || null
      }))
    }, null, 2);
  } else {
    // HTML
    let html = '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>' + escapeHtml(topic) + ' - 圆桌讨论</title>';
    html += '<style>body{font-family:system-ui,sans-serif;max-width:800px;margin:0 auto;padding:40px 20px;background:#fafafa;color:#333}';
    html += 'h1{color:#6c5ce7;border-bottom:2px solid #6c5ce7;padding-bottom:12px}';
    html += '.expert{margin:24px 0;padding:20px;background:#fff;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.08)}';
    html += '.expert h2{font-size:18px;margin-bottom:12px}.meta{font-size:12px;color:#888;margin-top:12px}</style></head><body>';
    html += '<h1>' + escapeHtml(topic) + '</h1><p>生成时间: ' + timestamp + '</p>';
    successResults.forEach(r => {
      html += '<div class="expert"><h2>' + r.expert.emoji + ' ' + escapeHtml(r.expert.name) + '</h2>';
      html += '<div>' + escapeHtml(r.content || '') + '</div>';
      if (r.modelInfo) html += '<p class="meta">模型: ' + escapeHtml(r.modelInfo.name) + ' | 耗时: ' + (r.elapsed || '?') + 's</p>';
      html += '</div>';
    });
    html += '</body></html>';
    return html;
  }
}

function executeDownload(format, topic, results, includeMeta, template) {
  const content = generateExportContent(format, topic, results, template);
  const extMap = { markdown: '.md', txt: '.txt', json: '.json', html: '.html' };
  const mimeMap = { markdown: 'text/markdown', txt: 'text/plain', json: 'application/json', html: 'text/html' };
  const filename = 'roundtable_' + new Date().toISOString().slice(0, 10) + extMap[format];
  const blob = new Blob([content], { type: mimeMap[format] + ';charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showNotification('已下载: ' + filename, 'success');
}

// ===== 工具4: 智能分析（增强版） =====
function toolAnalyze() {
  if (!store.currentResults || !store.currentResults.results) {
    showNotification('请先完成一次圆桌讨论', 'warning');
    return;
  }
  const results = store.currentResults.results.filter(r => r.success);
  if (!results.length) { showNotification('没有可分析的讨论结果', 'warning'); return; }

  const analysis = performAnalysis(results);

  const body = `
    <div class="tool-analyze-content">
      <p class="tool-desc">基于 ${results.length} 位专家的评估结果进行多维度智能分析</p>

      <div class="analyze-tabs">
        <button class="atab active" data-tab="overview">📊 总览</button>
        <button class="atab" data-tab="keywords">🔑 关键词</button>
        <button class="atab" data-tab="consensus">🤝 共识与分歧</button>
        <button class="atab" data-tab="radar">🎯 雷达图</button>
        <button class="atab" data-tab="sentiment">💭 情感分析</button>
      </div>

      <div class="analyze-tab-panels">
        <div class="atab-panel active" data-panel="overview">
          <div class="analyze-grid two-col">
            <div class="analyze-card">
              <h4>📊 基础统计</h4>
              <div class="ac-stats">
                <div class="ac-stat"><span class="ac-num">${results.length}</span><span class="ac-label">完成评估</span></div>
                <div class="ac-stat"><span class="ac-num">${analysis.avgLength}</span><span class="ac-label">平均字数</span></div>
                <div class="ac-stat"><span class="ac-num">${analysis.totalTime}s</span><span class="ac-label">总耗时</span></div>
                <div class="ac-stat"><span class="ac-num">${analysis.keywords.length}</span><span class="ac-label">关键词数</span></div>
              </div>
            </div>
            <div class="analyze-card">
              <h4>⚡ 各专家字数对比</h4>
              <div class="ac-bars">${results.map(r => {
                const len = (r.content || '').length;
                const pct = Math.min(100, Math.round(len / analysis.maxLength * 100));
                return '<div class="ac-bar-row"><span class="ac-bar-name">' + r.expert.emoji + ' ' + r.expert.name + '</span><div class="ac-bar-track"><div class="ac-bar-fill" style="width:' + pct + '%"></div></div><span class="ac-bar-val">' + len + '字</span></div>';
              }).join('')}</div>
            </div>
          </div>
        </div>

        <div class="atab-panel" data-panel="keywords">
          ${analysis.keywords.length ? `<div class="analyze-card">
            <h4>🔑 高频关键词 TOP 15</h4>
            <div class="ac-keyword-cloud">${analysis.keywords.map((k, i) => {
              const size = Math.max(12, 24 - i * 1.5);
              const opacity = Math.max(0.5, 1 - i * 0.04);
              return '<span class="ac-kw-cloud" style="font-size:' + size + 'px;opacity:' + opacity + '">' + k.word + '<em>' + k.count + '</em></span>';
            }).join('')}</div>
          </div>
          <div class="analyze-card">
            <h4>📈 关键词频率分布</h4>
            <div class="ac-bars">${analysis.keywords.slice(0, 10).map(k => {
              const maxCount = analysis.keywords[0].count;
              const pct = maxCount ? Math.round(k.count / maxCount * 100) : 0;
              return '<div class="ac-bar-row"><span class="ac-bar-name">' + k.word + '</span><div class="ac-bar-track"><div class="ac-bar-fill accent" style="width:' + pct + '%"></div></div><span class="ac-bar-val">' + k.count + '次</span></div>';
            }).join('')}</div>
          </div>` : '<div class="analyze-card"><p class="ac-empty">未提取到有效关键词</p></div>'}
        </div>

        <div class="atab-panel" data-panel="consensus">
          <div class="analyze-grid two-col">
            <div class="analyze-card">
              <h4>✅ 共识点（60%+专家提及）</h4>
              <div class="ac-consensus">${analysis.consensus.length ? analysis.consensus.map(c => '<div class="ac-consensus-item"><span class="aci-dot green"></span>' + c + '</div>').join('') : '<p class="ac-empty">未检测到明显共识</p>'}</div>
            </div>
            <div class="analyze-card">
              <h4>⚔️ 观点分歧</h4>
              <div class="ac-consensus">${analysis.divergence.length ? analysis.divergence.map(d => '<div class="ac-consensus-item"><span class="aci-dot red"></span>' + d + '</div>').join('') : '<p class="ac-empty">未检测到明显分歧</p>'}</div>
            </div>
          </div>
        </div>

        <div class="atab-panel" data-panel="radar">
          <div class="analyze-card">
            <h4>🎯 专家评估维度雷达图</h4>
            <p class="tool-desc" style="margin-bottom:12px">基于内容分析各专家在不同维度的关注度</p>
            <div class="radar-chart-container">${buildRadarChart(results, analysis)}</div>
          </div>
        </div>

        <div class="atab-panel" data-panel="sentiment">
          <div class="analyze-card">
            <h4>💭 情感倾向分析</h4>
            <div class="sentiment-grid">${results.map(r => {
              const sent = analyzeSentiment(r.content || '');
              return '<div class="sentiment-row"><span class="sr-name">' + r.expert.emoji + ' ' + r.expert.name + '</span><div class="sr-bar"><div class="sr-pos" style="width:' + sent.positive + '%"></div><div class="sr-neu" style="width:' + sent.neutral + '%"></div><div class="sr-neg" style="width:' + sent.negative + '%"></div></div><span class="sr-label">' + sent.label + '</span></div>';
            }).join('')}</div>
            <div class="sentiment-legend">
              <span><span class="sl-dot green"></span>积极</span>
              <span><span class="sl-dot gray"></span>中性</span>
              <span><span class="sl-dot red"></span>消极/批评</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  const footer = '<button class="btn-entry primary" id="btnAnalyzeExport">导出分析报告</button><button class="btn-entry secondary" id="btnAnalyzeClose">关闭</button>';
  openToolModal('📊 智能分析', body, footer);

  // Tab switching
  document.querySelectorAll('.atab').forEach(tab => {
    tab.addEventListener('click', function() {
      document.querySelectorAll('.atab').forEach(t => t.classList.remove('active'));
      this.classList.add('active');
      const panel = this.dataset.tab;
      document.querySelectorAll('.atab-panel').forEach(p => p.classList.toggle('active', p.dataset.panel === panel));
    });
  });

  document.getElementById('btnAnalyzeExport').addEventListener('click', function() {
    exportAnalysisReport(analysis, results);
  });
  document.getElementById('btnAnalyzeClose').addEventListener('click', closeToolModal);
}

function performAnalysis(results) {
  const lengths = results.map(r => (r.content || '').length);
  const avgLength = Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length);
  const maxLength = Math.max(...lengths);
  const totalTime = store.currentResults.totalTime || '?';

  // Keyword extraction
  const allText = results.map(r => r.content || '').join(' ');
  const stopWords = new Set(['的', '了', '是', '在', '和', '有', '不', '这', '我', '你', '他', '她', '它', '们', '也', '就', '都', '而', '及', '与', '或', '但', '如果', '因为', '所以', '可以', '需要', '应该', '一个', '一些', '这个', '那个', '什么', '怎么', '为什么', '没有', '已经', '可能', '比较', '非常', '通过', '进行', '以及', '对于', '关于', '其中', '之间', '方面', '部分', '问题', '建议', '内容', '方式', '情况', '作者', '读者', '小说', '故事', '角色', '人物', '设定', '剧情', '能够', '这样', '那样', '然后', '但是', '虽然', '不过', '或者', '如何', '怎样']);
  const wordMap = {};
  const phrases = allText.match(/[\u4e00-\u9fa5]{2,4}/g) || [];
  phrases.forEach(w => { if (!stopWords.has(w)) wordMap[w] = (wordMap[w] || 0) + 1; });
  const keywords = Object.entries(wordMap)
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([word, count]) => ({ word, count }));

  // Consensus detection
  const threshold = Math.ceil(results.length * 0.6);
  const expertWords = results.map(r => {
    const words = (r.content || '').match(/[\u4e00-\u9fa5]{2,4}/g) || [];
    return new Set(words.filter(w => !stopWords.has(w)));
  });
  const consensusWords = [];
  const checked = new Set();
  expertWords.forEach(ws => {
    ws.forEach(w => {
      if (checked.has(w)) return;
      checked.add(w);
      const count = expertWords.filter(ew => ew.has(w)).length;
      if (count >= threshold && w.length >= 2) consensusWords.push({ word: w, count });
    });
  });
  consensusWords.sort((a, b) => b.count - a.count);
  const consensus = consensusWords.slice(0, 6).map(c => '「' + c.word + '」被 ' + c.count + '/' + results.length + ' 位专家提及');

  // Divergence detection (words appearing in only 1-2 experts but with high frequency)
  const divergenceWords = [];
  const divChecked = new Set();
  expertWords.forEach((ws, idx) => {
    ws.forEach(w => {
      if (divChecked.has(w)) return;
      divChecked.add(w);
      const count = expertWords.filter(ew => ew.has(w)).length;
      if (count === 1 && (wordMap[w] || 0) >= 3) {
        divergenceWords.push({ word: w, expert: results[idx].expert.name, freq: wordMap[w] });
      }
    });
  });
  divergenceWords.sort((a, b) => b.freq - a.freq);
  const divergence = divergenceWords.slice(0, 5).map(d => '「' + d.word + '」仅 ' + d.expert + ' 重点关注 (' + d.freq + '次)');

  // Dimension scores for radar
  const dimensions = ['创意性', '逻辑性', '市场性', '文学性', '可行性'];
  const dimensionKeywords = {
    '创意性': ['创意', '新颖', '独特', '创新', '想象', '灵感', '原创', '突破'],
    '逻辑性': ['逻辑', '合理', '自洽', '矛盾', '漏洞', '因果', '推理', '严谨'],
    '市场性': ['市场', '读者', '受众', '流量', '热门', '商业', '变现', '平台'],
    '文学性': ['文笔', '语言', '修辞', '意境', '美感', '文学', '风格', '叙事'],
    '可行性': ['可行', '执行', '落地', '实现', '难度', '篇幅', '节奏', '结构']
  };
  const radarData = results.map(r => {
    const text = r.content || '';
    const scores = dimensions.map(dim => {
      const kws = dimensionKeywords[dim];
      let score = 0;
      kws.forEach(kw => { const matches = text.match(new RegExp(kw, 'g')); if (matches) score += matches.length; });
      return Math.min(100, score * 15);
    });
    return { name: r.expert.name, emoji: r.expert.emoji, scores };
  });

  return { avgLength, maxLength, totalTime, keywords, consensus, divergence, dimensions, radarData };
}

function buildRadarChart(results, analysis) {
  const { dimensions, radarData } = analysis;
  const size = 300;
  const center = size / 2;
  const radius = 120;
  const levels = 5;

  let svg = `<svg viewBox="0 0 ${size} ${size}" class="radar-svg">`;

  // Grid
  for (let l = 1; l <= levels; l++) {
    const r = radius * l / levels;
    let points = '';
    dimensions.forEach((_, i) => {
      const angle = (2 * Math.PI * i / dimensions.length) - Math.PI / 2;
      points += (center + r * Math.cos(angle)) + ',' + (center + r * Math.sin(angle)) + ' ';
    });
    svg += `<polygon points="${points}" fill="none" stroke="var(--border)" stroke-width="0.5" opacity="0.5"/>`;
  }

  // Axes and labels
  dimensions.forEach((dim, i) => {
    const angle = (2 * Math.PI * i / dimensions.length) - Math.PI / 2;
    const x = center + radius * Math.cos(angle);
    const y = center + radius * Math.sin(angle);
    svg += `<line x1="${center}" y1="${center}" x2="${x}" y2="${y}" stroke="var(--border)" stroke-width="0.5"/>`;
    const lx = center + (radius + 20) * Math.cos(angle);
    const ly = center + (radius + 20) * Math.sin(angle);
    svg += `<text x="${lx}" y="${ly + 4}" text-anchor="middle" fill="var(--text-secondary)" font-size="10">${dim}</text>`;
  });

  // Data polygons (show top 4 experts)
  const colors = ['rgba(124,108,240,0.6)', 'rgba(0,206,201,0.6)', 'rgba(253,203,110,0.6)', 'rgba(225,112,85,0.6)'];
  radarData.slice(0, 4).forEach((expert, ei) => {
    let points = '';
    expert.scores.forEach((score, i) => {
      const angle = (2 * Math.PI * i / dimensions.length) - Math.PI / 2;
      const r = radius * score / 100;
      points += (center + r * Math.cos(angle)) + ',' + (center + r * Math.sin(angle)) + ' ';
    });
    svg += `<polygon points="${points}" fill="${colors[ei]}" fill-opacity="0.2" stroke="${colors[ei]}" stroke-width="1.5"/>`;
  });

  svg += '</svg>';

  // Legend
  let legend = '<div class="radar-legend">';
  radarData.slice(0, 4).forEach((expert, ei) => {
    legend += '<span class="rl-item"><span class="rl-dot" style="background:' + colors[ei] + '"></span>' + expert.emoji + ' ' + expert.name + '</span>';
  });
  legend += '</div>';

  return svg + legend;
}

function analyzeSentiment(text) {
  const posWords = ['优秀', '精彩', '出色', '巧妙', '独特', '吸引', '有趣', '成功', '亮点', '推荐', '赞', '好', '强', '妙', '佳', '优', '棒', '不错', '很好', '非常好', '值得', '潜力'];
  const negWords = ['问题', '不足', '缺乏', '薄弱', '风险', '困难', '矛盾', '漏洞', '单薄', '老套', '俗套', '平庸', '不够', '欠缺', '需要改进', '建议修改', '避免', '注意'];

  let posCount = 0, negCount = 0;
  posWords.forEach(w => { const m = text.match(new RegExp(w, 'g')); if (m) posCount += m.length; });
  negWords.forEach(w => { const m = text.match(new RegExp(w, 'g')); if (m) negCount += m.length; });

  const total = posCount + negCount || 1;
  const positive = Math.round(posCount / total * 100);
  const negative = Math.round(negCount / total * 100);
  const neutral = 100 - positive - negative;

  let label = '中性';
  if (positive > 60) label = '积极';
  else if (negative > 60) label = '批评';
  else if (positive > negative + 20) label = '偏积极';
  else if (negative > positive + 20) label = '偏批评';

  return { positive, negative, neutral: Math.max(0, neutral), label };
}

function exportAnalysisReport(analysis, results) {
  let report = '# 📊 智能分析报告\n\n';
  report += '生成时间: ' + new Date().toLocaleString('zh-CN') + '\n\n';
  report += '## 基础统计\n\n';
  report += '- 完成评估: ' + results.length + ' 位专家\n';
  report += '- 平均字数: ' + analysis.avgLength + '\n';
  report += '- 总耗时: ' + analysis.totalTime + 's\n\n';
  report += '## 高频关键词\n\n';
  analysis.keywords.forEach(k => { report += '- ' + k.word + ' (' + k.count + '次)\n'; });
  report += '\n## 共识点\n\n';
  analysis.consensus.forEach(c => { report += '- ' + c + '\n'; });
  report += '\n## 观点分歧\n\n';
  analysis.divergence.forEach(d => { report += '- ' + d + '\n'; });
  report += '\n## 情感分析\n\n';
  results.forEach(r => {
    const sent = analyzeSentiment(r.content || '');
    report += '- ' + r.expert.emoji + ' ' + r.expert.name + ': ' + sent.label + ' (积极' + sent.positive + '% / 中性' + sent.neutral + '% / 消极' + sent.negative + '%)\n';
  });

  const blob = new Blob([report], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url;
  a.download = 'analysis_report_' + new Date().toISOString().slice(0, 10) + '.md';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showNotification('分析报告已导出', 'success');
}

})();
