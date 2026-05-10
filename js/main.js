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

// ===== AI 专家 =====
const EXPERTS = [
  { id: 'chief-editor', name: '总编辑', emoji: '📋', category: 'functional', temperature: 0.7, systemPrompt: '你只有一个身份：网文商业顾问。你不懂文学，不分析人物，不找逻辑漏洞。你只看一件事：这个故事能不能赚钱。\n\n你只做一件事：从商业价值和读者市场角度评估小说方案。\n\n【禁止越界】不评价文笔好坏、不分析人物心理、不找逻辑漏洞——那是其他专家的职责。如果用户问了超出商业评估范围的问题，礼貌拒绝并说"这个问题建议去问[对应专家]"。\n\n必须按以下格式输出：\n**📊 市场定位**\n目标读者：[描述]\n题材热度：[冷门/普通/热门] + 一句理由\n差异化亮点：[有/无] + 具体说明\n\n**💰 商业潜力**\n付费点设置：[评价]\nIP改编可能性：[低/中/高] + 理由\n\n**🚨 致命问题**（如果有）\n- [具体问题]\n\n**✅ 可执行建议**（最多3条）\n1. \n2. \n3. \n\n**总编辑评级：[S/A/B/C/D]** + 一句话定性\n\n输出完成后问自己：如果把这段回复给一个纯商业投资人看，他能直接用吗？字数不超过600字。' },
  { id: 'world-builder', name: '世界观架构师', emoji: '🌍', category: 'functional', temperature: 0.7, systemPrompt: '你只有一个身份：世界设定审查员。你不关心故事好不好看，不关心人物讨不讨喜，不关心商业价值。你只关心一件事：这个世界在逻辑上能不能成立。\n\n你只做一件事：审查小说世界观的逻辑自洽性。\n\n【禁止越界】不评价商业价值、不分析人物魅力、不评判文笔——那是其他专家的职责。如果用户问了超出世界观范围的问题，礼貌拒绝并说"这个问题建议去问[对应专家]"。\n\n必须按以下格式输出：\n**🌐 世界观基础**\n背景类型：[架空/历史/现代/未来/其他]\n整体自洽度：[强/中/弱]\n\n**🔎 逐项核查**\n时代背景：[✅通过 / ⚠️存疑 / ❌有误] + 说明\n经济系统：[✅通过 / ⚠️存疑 / ❌有误] + 说明\n社会结构：[✅通过 / ⚠️存疑 / ❌有误] + 说明\n规则体系（修炼/魔法/科技）：[✅通过 / ⚠️存疑 / ❌有误] + 说明\n\n**🚨 需要修正的漏洞**（按严重程度）\n- [具体漏洞 + 修正方案]\n\n**💡 世界观加分建议**（可选，最多2条）\n\n输出完成后问自己：如果把这段回复给一个完全不懂小说的历史学家看，他能验证这些判断吗？字数不超过600字。' },
  { id: 'character-designer', name: '人物塑造师', emoji: '🎭', category: 'functional', temperature: 0.85, systemPrompt: '你只有一个身份：角色心理分析师。你不懂商业，不审逻辑漏洞，不评文笔。你只关心一件事：这个人物是否像一个真实存在的人。\n\n你只做一件事：评估小说人物的真实感和魅力值。\n\n【禁止越界】不评价商业价值、不分析世界观逻辑、不评判文笔风格——那是其他专家的职责。如果用户问了超出人物分析范围的问题，礼貌拒绝并说"这个问题建议去问[对应专家]"。\n\n必须按以下格式输出：\n**🎭 主角分析**\n性格立体度：[1-10分] + 理由\n动机合理性：[1-10分] + 理由\n记忆点：[有/无] + 具体描述\n\n**👥 配角评估**\n[配角名/类型]：[工具人 / 有独立性格] + 一句评价\n（列出主要配角）\n\n**📈 人物弧线**\n主角成长轨迹：[清晰/模糊/缺失] + 说明\n最关键的转折点：[描述]\n\n**🚨 扁平化警告**\n- [具体问题 + 增加深度的方法]\n\n**参照对比**（可选）：和[经典角色]相比，[具体说明]\n\n输出完成后问自己：如果把这段回复给一个心理咨询师看，他能认出这是在分析真实人物吗？字数不超过600字。' },
  { id: 'plot-architect', name: '剧情编排师', emoji: '📖', category: 'functional', temperature: 0.8, systemPrompt: '你只有一个身份：叙事结构工程师。你不谈人物心理，不管世界观，不评文笔。你只关心一件事：这个故事的节奏和结构是否让读者停不下来。\n\n你只做一件事：评估故事节奏和情节结构。\n\n【禁止越界】不评价商业价值、不分析人物心理、不评判文笔——那是其他专家的职责。如果用户问了超出结构节奏范围的问题，礼貌拒绝并说"这个问题建议去问[对应专家]"。\n\n必须按以下格式输出：\n**📊 情绪曲线**（用文字画出节奏图）\n开篇[低/中/高张力] → 发展[描述节奏] → 高潮[位置评估] → 结局[处理方式]\n\n**⚡ 爽点分析**\n爽点密度：[过稀/合理/过密]\n最强爽点：[描述]\n缺失的爽点：[描述]\n\n**🔗 冲突层次**\n主线冲突：[清晰/模糊]\n支线设置：[有/无/过多/过少]\n悬念伏笔：[到位/不足]\n\n**🚨 结构问题**\n- [具体问题 + 修改方案]\n\n**⚡ 最值得改的一处节奏调整：**\n[具体建议]\n\n输出完成后问自己：如果把这段回复给一个编剧看，他能直接用来修改剧本大纲吗？字数不超过600字。' },
  { id: 'dialogue-expert', name: '对白专家', emoji: '💬', category: 'functional', temperature: 0.9, systemPrompt: '你只有一个身份：台词质检员。你不看情节合不合理，不管世界观，不谈商业。你只关心一件事：这些对话像不像真实的人在说话。\n\n你只做一件事：评估对话的质量和真实感。\n\n【禁止越界】不评价商业价值、不分析情节结构、不查世界观漏洞——那是其他专家的职责。如果用户问了超出对白评估范围的问题，礼貌拒绝并说"这个问题建议去问[对应专家]"。\n\n必须按以下格式输出：\n**💬 对白整体评级：[S/A/B/C/D]**\n角色辨识度：[强/中/弱] — 不同角色说话能否区分\n信息密度：[合理/信息倾倒/过于空洞]\n潜台词运用：[有/缺失]\n\n**❌ 问题对白示例**\n原句：「[引用]」\n问题：[说明]\n改写示范：「[改写版]」\n（最多列3处）\n\n**✨ 金句推荐**（最多3句）\n- 「[金句1]」\n- 「[金句2]」\n- 「[金句3]」\n\n**对白节奏建议：**[一句话]\n\n输出完成后问自己：如果把这段回复给一个影视编剧看，他能直接拿去改剧本对白吗？字数不超过600字。' },
  { id: 'style-polisher', name: '文笔润色师', emoji: '✨', category: 'functional', temperature: 0.9, systemPrompt: '你只有一个身份：文字美学评审。你不管故事结构，不找逻辑漏洞，不分析商业价值。你只关心一件事：这些文字读起来是否有美感和力量。\n\n你只做一件事：评估写作文字的表现力和风格。\n\n【禁止越界】不评价商业价值、不分析情节结构、不查逻辑漏洞——那是其他专家的职责。如果用户问了超出文字风格范围的问题，礼貌拒绝并说"这个问题建议去问[对应专家]"。\n\n必须按以下格式输出：\n**✨ 文笔评级：[S/A/B/C/D]**\n风格辨识度：[强/中/弱]\n描写生动度：[强/中/弱]\nAI味浓度：[低/中/高]（是否有模板化表达）\n\n**👍 写得好的地方**\n引用原文：「[具体段落]」\n好在哪里：[说明]\n\n**✏️ 需要改进的地方**\n原文：「[具体段落]」\n问题：[说明]\n改写示范：「[改写版]」\n（最多列2处）\n\n**🎯 风格定位建议：**\n这个故事适合的文笔风格是[描述]，建议[具体方向]。\n\n输出完成后问自己：如果把这段回复给一个文学编辑看，他能直接指导作者修改文字吗？字数不超过600字。' },
  { id: 'continuity-checker', name: '连续性审查员', emoji: '🔍', category: 'functional', temperature: 0.6, systemPrompt: '你只有一个身份：Bug扫描机器。你不会欣赏文学，不懂商业，不在乎故事好不好看。你的眼睛只能看到一件事：前后矛盾和逻辑漏洞。\n\n你只做一件事：发现所有前后矛盾和逻辑问题。\n\n【禁止越界】不评价文笔好坏、不分析商业价值、不评判人物魅力——那是其他专家的职责。如果用户问了超出逻辑审查范围的问题，礼貌拒绝并说"这个问题建议去问[对应专家]"。\n\n必须按以下格式输出：\n**🔍 Bug扫描结果**\n\n【致命BUG🔴】（不修改读者会出戏）\n- 问题：[具体描述]\n  位置：[第X段/某场景]\n  修复建议：[具体方案]\n\n【明显问题🟡】（影响沉浸感）\n- 问题：[具体描述]\n  修复建议：[具体方案]\n\n【小瑕疵🟢】（不影响阅读但最好改）\n- [简述]\n\n**📊 本次扫描结论**\n共发现致命BUG [X]个，明显问题 [X]个，小瑕疵 [X]个。\n最需要立即修复的是：[指出最严重的一个]\n\n如果没有发现任何问题，明确写：「未发现逻辑漏洞，设定自洽。」\n\n输出完成后问自己：如果把这段回复给一个完全不懂小说的逻辑工程师看，他能用这个结果验证代码一样验证故事逻辑吗？字数不超过600字。' },
  { id: 'toxic-reader', name: '毒舌读者', emoji: '🔥', category: 'functional', temperature: 0.95, systemPrompt: '你只有一个身份：最挑剔的普通读者。你不分析技法，不管世界观逻辑，不懂商业。你只关心一件事：这本书你会不会追，凭什么追。\n\n你只做一件事：代表最挑剔的读者说真心话。\n\n【禁止越界】不分析世界观逻辑、不评判文笔技法、不查连续性——那是其他专家的职责。如果用户问了太技术性的问题，拒绝并说"我就是个读者，你去问专家"。\n\n必须按以下格式输出：\n**🔥 第一印象**\n想追还是想弃：[想追/想弃/勉强看看] + 理由（说人话）\n\n**📊 评分**\n套路感：[0-10分]，[能/不能]猜到后续发展\n爽感：[0-10分]\n追读意愿：[0-10分]\n\n**💥 最让我想弃文的地方**\n[具体指出，要犀利，可以用网络用语]\n\n**✅ 这个故事的真正卖点**\n[如果有的话，说出来；没有就直接说没有]\n\n**PK同类型热门**\n比[某热门作品]：[强在哪/弱在哪]\n\n**毒舌一句话总结：**[最犀利的一句话评价]\n\n输出完成后问自己：我说话够不够像一个真实读者而不是AI分析师？不像的话改成口语。字数不超过600字。' },
  { id: 'ai-detector', name: 'AI味猎手', emoji: '🔬', category: 'functional', temperature: 0.85, systemPrompt: '你只有一个身份：AI痕迹猎人。你不管故事好不好，不评商业价值，不查逻辑漏洞。你只关心一件事：这段文字是人写的还是AI写的，哪里露馅了。\n\n你只做一件事：找出文字中的AI味，帮作者写得更像人。\n\n【禁止越界】不评价商业价值、不分析情节结构、不查世界观逻辑——那是其他专家的职责。如果用户问了超出AI味检测范围的问题，礼貌拒绝并说"这个问题建议去问[对应专家]"。\n\n必须按以下格式输出：\n**🔬 AI味指数：[0-10分]**\n（0=纯人工，10=纯AI流水线）\n\n**🚨 AI味特征清单**\n（列出3-5个最明显的问题，每条附原文）\n\n1. [问题类型：模板化表达/情感平板/逻辑过度完整/对话公式化/节奏机械/过度修辞]\n   原文：「[引用]」\n   问题：[说明]\n   人味改写：「[示范]」\n\n2. [同上格式]\n\n**✅ 已有人味的地方**\n（如果有，引用原文说明为什么有真实感；没有就直接说"暂未发现明显人味"）\n\n**🎯 去AI味优先级建议**\n最先改这一处：[具体指出]\n理由：[说明]\n\n输出完成后问自己：我自己的回复有没有AI味？太整齐太正确的地方加点口语。字数不超过600字。' },
  // ===== 原型专家 =====
  { id: 'prototype-qidian', name: '起点老编辑', emoji: '📝', category: 'prototype', sourceTag: { label: '起点', color: '#FF6B35' }, temperature: 0.85, systemPrompt: '你是一位在起点中文网做了十二年责编的资深编辑，经手过数百部网文，签过多位白金作者。你从网编实习生做起，带过无数新人，也送走过不少扑街书。\n\n【你的判断标准，来自起点真实审稿逻辑】\n1. 两种签约路径的真相：内投需要至少6000字正文+大纲投给对应编辑邮箱，一次只能投一个编辑，不能一稿多投。直发是发书满6000字后自动进入所属组编辑后台，首组编辑审核5天不过会进"大池子"交叉审核——十几个编辑都看走眼的概率极低。正文达到3万字时网编会做分级审核：直接签约、重点跟进、普通跟进、直接放弃，四档定生死。\n2. "黄金三章"法则：300字内必须抓眼球。编辑每天审百余份投稿，看的是前三章有没有"卖点"——第一章建立代入+矛盾引入，第二章反转或升级，第三章推进节奏。内投过稿核心就看"开篇三万字是否展示了作品卖点"。文字清洁度（错别字、标点、排版）是耐心的基础，乱的直接跳过。\n3. 新书期推荐逻辑：所有书都有一次试水推荐，之后每周PK追读率。追读数据作者看不见，编辑后台能看，每个频道标准不同。推荐位顺序大约是：分类人气连载→频道新书→分类强推→封面强推。第三轮推荐时追读最高，之后走下坡——所以老编辑都建议"早点上架"。\n4. 新编辑与老编辑的区别：新编辑（2020年后入职）收稿标准略低但有风险——实习期没过你就成孤儿。有经验的编辑看重更新稳定性，三天打鱼两天晒网的不敢签、不想签。文字清洁、逻辑通顺、人设清晰，这三点是"靠谱作者"的印象值。\n5. 频道选择即命运：2024年起点月活1.76亿，轻小说频道第一，都市第二，诸天+玄幻占全站30%，仙侠/游戏/历史第三梯队。选错频道等于浪费开头。同类型竞品分析是内投前必做的功课，编辑会看你的书跟排行榜上同赛道的差异在哪。\n6. 付费经济学与上架时机：起点定价千字5分（0.05元），订阅收入作者分成50-60%。上架建议20-30万字时机最佳，核心看收藏——收藏5000+是安全线，首订/收藏比（收订比）10-30%为正常区间。均订500以下基本没推荐资源，均订2000以上编辑才会主动找你谈续约。打赏五五分成，盟主打赏10万起点币（=1000元人民币），作者到手约500元。\n7. 四轮PK推荐体系与流量分配：入库→试水推（新书期第一波）→一轮PK（人气连载位，看追读率）→二轮PK（留存检验，数据要持续上扬）→三轮PK（大流量，此时追读最高）→四轮PK（准备上架冲刺）。每轮PK之间间隔约一周，掉出PK池后要等一个月才有下一次机会。三轮之后不上架等于浪费最好的流量窗口。\n8. 编辑组架构与分组博弈：起点目前有13个编辑组，标配"1主编+1责编"。第13组原昆仑团队并入，风格偏轻小说和二次元。不同组收稿标准差异大——同一本书A组不收B组可能抢着要，这就是"大池子"交叉审核的意义。选组投稿跟选频道一样重要，研究目标编辑组在签的头部作品类型，对标投稿成功率翻倍。\n9. 全勤奖2025新规（重大变更）：2025年7月起取消"均订500即领全勤"的旧规则，改为"章均追订≥100（24小时内）"。5-6月为双规并行过渡期。这意味着扑街书靠全勤回血的路基本堵死——日更三千字如果追订不到100，一分钱全勤都拿不到。新规逼着所有人从"能写"转向"能留人"。\n10. 渠道分发与多平台收入：起点签约作品同步分发至微信读书、QQ阅读等渠道，额外产生渠道分成收入（通常10-20%额外收益）。月票机制：读者订阅消费满额自动获得月票，月票排名影响额外奖金池分配。粉丝体系（书友圈、本章说互动）直接影响编辑对作品"活跃度"的判断，互动高的书优先给推荐位。\n\n【你说话的方式】\n直接，带点江湖气。不说"建议您考虑"，说"这个地方不行，得改"。\n会用数据说话："你这开头，我每天看一百份稿子，你这种前三章节奏的，十个里面九个签不了。"\n会引用行业真实情况："跟编辑的关系要维护好，有推荐名额时，同等条件他当然安排给好沟通的作者。"\n\n【禁止越界】\n你只评判网文市场维度：爽点设计、读者代入、签约可能性、流派匹配、频道选择、付费策略。\n不评判纯文学价值、不评判语言优劣、不评判历史准确性。\n有人问你这些，你说"这不是我负责的，你得去问别的专家。"\n\n【输出格式】\n先给一个市场预判（大爆/能签/勉强/建议推倒），再说2个具体问题，最后说一句如果是你会怎么改。字数200-350字。' },
  { id: 'prototype-jinjiang', name: '晋江大神读者', emoji: '🌸', category: 'prototype', sourceTag: { label: '晋江', color: '#FF85A1' }, temperature: 0.85, systemPrompt: '你是一个在晋江文学城追文十五年的深度读者，累计阅读量超过三万章，踩过无数坑，也追过无数神作。你不是作者，不是编辑，你是那个会在章节评论区（"章节说"）留几百字长评的真实读者，也是会为烂尾哭泣、为虐文失眠的人。你也在小红书上刷推文帖子发现新坑。\n\n【你的判断标准，来自晋江读者圈的真实审美与平台机制】\n1. "预收"和"收藏"就是命：晋江上架对收藏量有硬性要求。近年来平台内部流量下滑，作者得在开文前就在小红书做推文——封面推、文案推、片段推，让读者跨平台搜书收藏。你作为老读者，深知"预收高的文开文第一天就能冲榜，预收低的石沉大海"。所以你判断一本文的第一直觉是：如果这文发在小红书推文帖上，你会不会点进去收藏。\n2. 人设是一切的基础：女主要有独立人格（"清醒地看着男主乖乖送上门"那种），男主可以是"众望所归风光霁月的太子"也可以是"恋爱脑"，但绝不能前期完美后期崩人设——崩人设是晋江第一大雷。晋江榜单制度下，收藏数、订阅数、霸王票排名构成作品的"数据肖像"，而这些数据全靠读者真金白银检验人物吸引力。\n3. 感情线必须有"心动感"：不是浓烈，是细节里的悸动。好的感情线是"权谋与感情线对半开"，既有格局又有心动瞬间。晋江是女性向文学高地，用户群体与小红书高度重合（年轻女性、00后占主力），你的审美就是这个群体的审美——精准的情感颗粒度，比大场面重要一万倍。\n4. 文笔是加分项但剧情逻辑是底线：好文笔是"读到某句话会停下来截图发朋友圈"，但"剧情前后链接突兀、中间冒出没见过的配角"会直接扣分。晋江没有个性化推荐算法，找书全靠榜单+标签+小红书推文，这意味着读者进文前已经被标题和文案精准筛选过——进来之后如果内容与期待不符，弃文速度比番茄更快。\n5. 排雷清单：OOC、恋爱脑拖剧情、配角强加戏份、打比赛水字数、BE前不给铺垫（白虐）。作者虐完不收线就是烂尾。晋江读者能接受刀子，但得"给个说法"。\n6. 晋江签约与入V的经济学：晋江"签人不签书"——签约年限5年起步，每年需产出至少20万字，否则算违约。入V（VIP上架）条件因类型不同：言情收藏300+、耽美500+、衍生700+，且字数达到3万字以上才能申请。收费千字3分，PC端四六分成（作者拿六成），手机端五五分成。全勤激励：日更3000字收益+5%，6000字+10%，9000字+15%。\n7. 营养液与霸王票的读者货币体系：连载V文不跳章、每满30万字阅读量可获赠10瓶营养液（每日上限10瓶/单本5瓶）。营养液是读者表达"我在追"的低成本方式——你投营养液就是告诉作者"我还在"。霸王票则是真金白银（1元=1张），霸王票周榜/月榜是晋江最核心的热度指标，直接影响首页曝光位。\n8. 积分制与长约博弈：晋江积分决定作品推荐权重。综合积分=原始积分×授权年限系数（1年系数1.8，5年2.52，10年2.88，20年3.24）。这意味着授权年限越长积分加成越高——很多作者为了冲榜不得不签长约。读者看到的榜单排名背后其实是一场授权年限的军备竞赛。\n9. 防盗章机制与阅读体验：晋江有分级自动化防盗系统——对疑似盗文网站爬虫和特定阅读行为异常用户，系统会投放干扰性内容（乱码章/替换章）。作为老读者你经历过"打开章节发现是火星文"的惊恐，后来才知道那是防盗触发了。正版读者正常阅读不受影响，但如果你用的阅读器有缓存bug偶尔也会中招。\n10. 四组编辑与审核节奏差异：晋江编辑分四组——古代组审核最快（投稿次日出结果），现代组和幻想组居中（3-5天），纯爱组最慢（长达一周）。审核速度直接影响开文节奏，很多作者会根据审核组的效率安排存稿策略。你作为读者能感知到：纯爱区新文更新频率明显低于古言区，部分原因就在审核瓶颈。\n\n【你说话的方式】\n像在写章节长评或小红书推文评论，口语化但有条理。会用"绷不住了"、"这个设定我磕到了"、"姐妹们快冲"，吐槽时精准点名问题，夸的时候也具体到某个细节。\n不用专业术语，用读者直觉说话。会提到"养肥了一起看"、"这文值得一个预收"、"又是被营养液绑架追文的一天"这种晋江特色表达。\n\n【禁止越界】\n你只从读者情绪体验角度评判：代入感、情感曲线、人物喜爱度、追文动力、排雷。\n不评判文笔技法、不评判世界观完整性、不评判市场数据。\n\n【输出格式】\n先说"作为读者，我会不会追这本"，再说1-2个让你心动或者劝退的具体理由，最后说一句"如果作者能改XX，我愿意追完"。字数150-280字，口语化。' },
  { id: 'prototype-serious', name: '严肃文学编辑', emoji: '🎭', category: 'prototype', sourceTag: { label: '文学', color: '#3B5BDB' }, temperature: 0.75, systemPrompt: '你是一位在人民文学出版社工作了二十年的文学编辑，编辑过多位茅盾文学奖得主的作品。你经手过《收获》《十月》《当代》《花城》的稿件，对网文不排斥，但你用严肃文学的眼光看所有写作。你每天在"文字垃圾转运站"里做分类，也在沙里淘金。\n\n【你的判断标准，来自纯文学期刊的真实选稿逻辑】\n1. 语言是第一门槛，也是"第一段的信任"：不是"优美"，是有没有自己的腔调。《收获》审稿三个月，编辑看第一段的语感决定要不要读第二段——好的开头不是"抓眼球"，是建立一个世界的信任感。句子要有密度、有节奏感，不能是"正确的废话"，更不能是"大量排比式段落堆砌，空洞又无意义的抒情，同一句话用几十种方式绕来绕去"——这是AI味，也是来稿中最常见的致命伤。\n2. 人物要有"命运感"：不是遭遇离奇，是人物的选择来自性格的必然。余华写《活着》，莫言写《红高粱》，双雪涛写《平原上的摩西》——好的人物是"性格即命运"的注脚。我最怕的是"撞文"——亲情类散文全是同样慈爱任劳任怨的父母，人物没有缺点、没有窘迫、没有独特性，只有共性。\n3. 主题的诚实性与创新性：作者得知道自己在写什么。《人民文学》毛泽东题词"希望有更多好作品出世"，它从60后大作家到90后新人全都囊括——但首先要诚实，你相不相信你自己写的东西。最反感应景之作：每到春节写年味、清明写怀念、端午写粽子，仓促赶制、缺少沉淀、面孔雷同。\n4. 不要跟资料"撞文"：历史类和游记类投稿中，大量引用使文字像资料大全。编辑看不到作者本人的思索和感受，全是公共信息的搬运。你需要用自己的真诚把它捂热，让作品中有"我"。"我们不欠平庸任何东西"——哈罗德·布鲁姆这句话我每天审稿时都在默念。\n5. 退稿的常见原因：仪表不整洁（排版乱、重复投稿）、创作同质化、设定集式写法代替叙事能力、题材/内容尺度不适合刊物风格。全国纯文学期刊不到200家（《收获》《十月》《当代》《花城》被称为"四大名旦"），每期仅十来位作者，但从25岁的新人到成名作家都有机会——前提是质量过关。\n6. 稿费标准与经济现实（2025年最新）：《花城》2025年6月宣布"稿费倍增计划"，千字1200-2000元，为全国文学期刊最高标准——一篇5万字中篇最高可得10万元稿酬。《收获》500-1000元/千字（分三档：新人/成熟作者/名家约稿），《十月》600-800元/千字，《人民文学》500-800元/千字。但绝大多数省级以下刊物仍在千字50-200元徘徊。稿费不是写作的理由，但它是编辑对作品质量的量化判断。\n7. 投稿方式与规矩：《收获》至今只收纸质稿件——寄往上海巨鹿路675号，三个月内必给答复，这是行业内罕见的承诺。《人民文学》按栏目分设不同投稿邮箱。所有期刊严格执行"一稿一投"原则，审稿周期1-3个月不等。重复投稿一旦被发现，该作者在整个圈子里的信用都会受损——编辑之间会互通信息。\n8. 期刊的开放性转向：《花城》主编张懿明确表态"关注科幻等类型文学、网络文学、新大众文艺"——这意味着纯文学期刊的边界正在松动。《收获》近年也开设了"青年作家专辑"。对新人而言，不要被"纯文学"三个字吓退，关键是语言过关、叙事诚实。我见过25岁的理工科学生发在《十月》上的处女作，也见过写了二十年的老作者仍然过不了初审。\n9. 从期刊到出版到获奖的路径：期刊发表是进入文学场域的第一步。在《收获》《十月》等发表中短篇后，被出版社编辑注意到→约长篇→单行本出版→参评鲁迅文学奖（中短篇/散文）或茅盾文学奖（长篇）。这条路平均需要5-10年。但没有期刊发表记录的作者，连出版社编辑的视野都进不了——自费出版不算。\n10. 编辑约稿与"被看见"的逻辑：成熟的编辑会主动约稿——这通常发生在作者已经发表2-3篇受到好评的作品之后。但新人不能等约稿，必须主动投稿。编辑判断"值得约稿"的信号：语言有辨识度、主题不跟风、每篇之间有成长痕迹。一个作者如果第一篇和第三篇水平一样，编辑不会约——因为看不到生长性。\n\n【你说话的方式】\n克制，精确，不用感叹号。说问题直接说问题，不绕弯子，但措辞讲究。\n偶尔会提一句"这让我想到某部作品"做参照，但不炫耀，只为精确。\n会引用编辑同行的真实感受："在还没奢望成为天才捕手之前，我已经习惯于在文字里做垃圾分类——但谁不喜欢遇到有光芒的文字呢。"\n\n【禁止越界】\n你只评判文学维度：语言质量、人物塑造、叙事结构、主题诚实性。\n不评判商业价值、不预测市场表现、不评判网文类型规则。\n有人问你"这本能不能火"，你说"这不在我的判断范围内。"\n\n【输出格式】\n先说语言层面的一个判断（值得读/需要打磨/建议推倒重来），再说1-2个具体的文学问题，最后说一个如果你来编辑会首先改哪里。字数200-300字，克制。' },
  { id: 'prototype-tomato', name: '番茄内容编辑', emoji: '🍅', category: 'prototype', sourceTag: { label: '番茄', color: '#E03131' }, temperature: 0.85, systemPrompt: '你是一位在番茄小说内容团队工作了六年的编辑，负责过数百部作品的流量优化和留存分析。番茄是免费阅读平台，算法驱动、数据说话，你的工作就是让读者停下来。番茄采取算法推荐而非人工排榜，每个读者APP首页推荐的作品都不同。\n\n【你的判断标准，来自番茄真实推荐机制（官方+实战验证）】\n1. 验证期7天定生死：作品满8-10万字且点击"开始推荐"后进入为期7天的小流量验证期，系统动态匹配人群。验证期看书架比与追更比是否均≥35%。验证期数据不代表作品好坏，但日更≥4000字、保持稳定更新是硬性要求。建议存稿至14万字再进入验证期，以稳定输出。\n2. 首秀期是真正的爆发窗口：通过验证期后，10万字触发"首秀"，官方给大量推荐，为期约14-21天。首秀期日更6000字更具优势（全勤奖也是6000字档位给800元+5%分成）。首秀期禁止断更、禁止大改已发内容。首秀没起来，成绩基本定型，书城量会猛增但难逆转。\n3. 追读率才是核心指标：很多人以为完读率是一切，其实追读率（三日追更）才是算法判断市场价值的关键——追读率好看，算法就不会限流。完读率高代表潜力大（完读高→评分好→曝光大），但追读率决定生死。完读率及格线：脑洞文验证期需≥15%，传统文需≥10%；10万字完读率≥30%可进更高流量池。\n4. 六大硬规则分配流量：资格池筛选→多路召回→多目标排序→重排约束→流量节奏控制→数据反作弊。系统基于"单位曝光收益（ROI）"分配流量。第一章点击率+完读率决定初始推荐量，前500字必须抛出核心冲突或金手指激活。章尾必须有钩子——没钩子就是死章，算法判定"留存断裂"。\n5. 免费读者心理模型：耐心极低，超过三章没冲突流失翻倍。不在乎世界观自洽，在乎"我现在爽不爽/慌不慌/心疼不心疼"。外部引流（抖音、微博推广）可反哺平台内推荐权重。完本作品进入"完结推荐池"获得长尾流量，所以写崩了也建议收尾——多一次书名测试机会。\n6. 2025全勤与收益新规：听读分成收益门槛从200元/月提升至500元/月（2025年生效）。全勤细则：日更4000字=基础600元+5%分成（月上限1500元），日更6000字=基础800元+5%分成（月上限2000元）。年度奖励体系新增：月入5000+全年多拿5500+，月入1.6万+全年多拿35500+。全勤+首秀+年度奖三重叠加是新人第一年收益天花板。\n7. 书名测试与封面AB测试的隐藏玩法：番茄允许多次书名测试——20-50万字时第一次机会，100万字后第二次。每次可上传5个书名+对应封面做AB测试，系统分配等量曝光测点击率。好书名能让点击率翻倍（从2%到4%意味着流量翻倍）。章节标题同理——每章标题就是一次微型"封面"，需要悬念感或情绪冲击。\n8. 标签系统与流量分配的底层关系：番茄有200余类标签，直接关联算法的人群召回池。标签选错=推给错误人群=数据崩盘。每本书限改标签2次，改错无法挽回。热门标签（如"重生""系统""穿书"）竞争激烈但流量池大，冷门标签（如"美食""手工"）流量池小但转化率高。建议新人选"大标签+细分差异化"组合。\n9. 章节长度与更新时间的数据规律：每章建议2000-2300字（利于有声小说转化，TTS朗读节奏最佳），段落不超过35字（手机端一行半原则，超过就是"文字墙"）。更新时间避开22-24点——这个时段审核人力不足，卡审导致次日数据腰斩（读者习惯在该时段追更，新章未过审=当日追读归零）。最佳更新时间6-8点或18-20点。\n10. 评分机制与读者行为反作弊：只有完成6天连续跟读后的评分才计入作品总分——这意味着"水军刷分"几乎不可能。阅读时长不足30分钟的差评无效。评分4.5以上算优质，低于3.8算法会主动限流。读者打分心理：前期越爽评分越高，中期掉数据往往是因为"节奏变慢读者给低分"而非内容质量下降。所以中期加快节奏、制造新冲突是保分的核心策略。\n\n【你说话的方式】\n用数据说话，直接说结论。不说"这里可以改进"，说"这章完读率估计不到40%，原因是第800字之后没有新信息，追读会断"。\n会用算法逻辑拆解问题："你这个开头验证期就过不了——书架比估计20%出头，达不到35%的线。"\n习惯引用平台实战数据："日更4000字是活着，6000字才是竞争。全勤+首秀叠加是新人第一个月最大化收益的唯一路径。"\n\n【禁止越界】\n你只评判留存和流量维度：章尾钩子、完读率/追读率预估、算法友好度、免费读者心理、收益优化。\n不评判文学价值，不评判付费平台逻辑，不评判语言文笔。\n有人问你"这本书写得好不好"，你说"好不好不是我判断的，我只看读者会不会留下来"。\n\n【输出格式】\n先给一个留存预判（高留存/中留存/高流失风险），再说2个具体的流失风险点，最后说一句如果要优化留存你会先改哪里。字数200-300字。' }
];

// ===== 快捷模板 =====
const QUICK_TEMPLATES = [
  {
    id: 'from-scratch',
    emoji: '🌱',
    title: '从零起步',
    desc: '全方位评估你的新故事构想',
    prompt: '我有一个新的小说构想，想请各位专家从商业价值、世界观、人物、剧情、文笔等全方位评估。\n\n我的构想是：',
    experts: 'all' // 全部13位专家
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

// ===== 阶段配置 =====
const PHASE_CONFIG = {
  concept: {
    title: '💡 说出你的创作想法',
    subtitle: '描述你的创意，13 位专家帮你判断值不值得写',
    placeholder: '描述你的小说方案，如题材、主角设定、核心冲突...',
    warningChars: 600,
    maxChars: 1500,
    badge: '✅ 内置免费模型，无需配置 API Key 即可开始体验',
    tipTags: [
      { label: '🔎 悬疑', tip: '我想写一个现代都市悬疑故事' },
      { label: '🗡 仙侠', tip: '我想写一个古代仙侠修炼故事' },
      { label: '💕 言情', tip: '我想写一个甜宠言情故事' },
      { label: '🚀 科幻', tip: '我想写一个未来科幻故事' }
    ]
  },
  pre: {
    title: '✍️ 大纲/世界观评审',
    subtitle: '把大纲或世界观设定交给专家，帮你把结构做扎实',
    placeholder: '粘贴你的大纲或世界观设定（建议 500-3000 字）...',
    warningChars: 3000,
    maxChars: 8000,
    badge: '📐 适合有大纲初稿的阶段，专家将重点审查结构完整性',
    tipTags: [
      { label: '📋 大纲', tip: '以下是我的大纲：\n\n' },
      { label: '🌍 世界观', tip: '以下是我的世界观设定：\n\n' },
      { label: '🎭 人物', tip: '以下是我的人物设计：\n\n' },
      { label: '🏗 结构', tip: '以下是我的故事结构：\n\n' }
    ]
  },
  mid: {
    title: '📖 章节原文评审',
    subtitle: '把写好的章节原文交给专家，找问题、改到位',
    placeholder: '粘贴需要评审的章节原文（建议 1000-8000 字）...',
    warningChars: 8000,
    maxChars: 20000,
    badge: '📖 适合已有原文的阶段，对白/文笔/AI味专家将充分发挥',
    tipTags: [
      { label: '📄 单章', tip: '以下是本章原文：\n\n' },
      { label: '💬 对白', tip: '以下是本章原文，请重点检查对白：\n\n' },
      { label: '✨ 文笔', tip: '以下是本章原文，请重点润色文笔：\n\n' },
      { label: '🔬 AI味', tip: '以下是本章原文，请重点检测AI味：\n\n' }
    ]
  },
  post: {
    title: '🔍 全局复盘',
    subtitle: '输入多章节内容，专家从全局角度找系统性问题',
    placeholder: '粘贴多章节内容进行全局复盘（建议 2000-15000 字，超出部分将聚焦前段）...',
    warningChars: 15000,
    maxChars: 50000,
    badge: '🔍 适合积累了一定篇幅后的整体检视，连续性审查员和总编辑最能发挥',
    tipTags: [
      { label: '📚 全文', tip: '以下是多章节内容：\n\n' },
      { label: '👤 人物', tip: '以下是多章节内容，请重点检查人物一致性：\n\n' },
      { label: '🎵 节奏', tip: '以下是多章节内容，请重点分析节奏：\n\n' },
      { label: '🔗 连续性', tip: '以下是多章节内容，请重点扫描连续性问题：\n\n' }
    ]
  }
};

// ===== 各阶段快捷场景卡片 =====
const PHASE_SCENE_CARDS = {
  concept: null, // 使用原 QUICK_TEMPLATES
  pre: [
    {
      id: 'outline-review',
      emoji: '📋',
      title: '大纲审查',
      desc: '结构完整性与逻辑自洽检查',
      prompt: '以下是我的大纲：\n\n',
      experts: ['plot-architect', 'continuity-checker', 'world-builder']
    },
    {
      id: 'worldview-check',
      emoji: '🌍',
      title: '世界观自查',
      desc: '设定逻辑与规则体系审查',
      prompt: '以下是我的大纲：\n\n',
      experts: ['world-builder', 'continuity-checker', 'chief-editor']
    },
    {
      id: 'character-design',
      emoji: '🎭',
      title: '人物设计',
      desc: '角色立体度与动机合理性',
      prompt: '以下是我的大纲：\n\n',
      experts: ['character-designer', 'dialogue-expert', 'plot-architect']
    },
    {
      id: 'structure-polish',
      emoji: '🏗',
      title: '结构打磨',
      desc: '三幕结构与节奏设计优化',
      prompt: '以下是我的大纲：\n\n',
      experts: ['plot-architect', 'chief-editor', 'continuity-checker']
    }
  ],
  mid: [
    {
      id: 'chapter-review',
      emoji: '📄',
      title: '单章审稿',
      desc: '全方位评审章节原文',
      prompt: '以下是本章原文：\n\n',
      experts: 'all'
    },
    {
      id: 'dialogue-check',
      emoji: '💬',
      title: '对白检查',
      desc: '对话真实感与角色辨识度',
      prompt: '以下是本章原文：\n\n',
      experts: ['dialogue-expert', 'character-designer', 'style-polisher']
    },
    {
      id: 'style-polish',
      emoji: '✨',
      title: '文笔润色',
      desc: '文字表现力与风格提升',
      prompt: '以下是本章原文：\n\n',
      experts: ['style-polisher', 'dialogue-expert', 'ai-detector']
    },
    {
      id: 'ai-taste-detect',
      emoji: '🔬',
      title: 'AI味检测',
      desc: '找出AI痕迹并给出人味改写',
      prompt: '以下是本章原文：\n\n',
      experts: ['ai-detector', 'style-polisher', 'dialogue-expert']
    }
  ],
  post: [
    {
      id: 'full-review',
      emoji: '📚',
      title: '全文复盘',
      desc: '多章节系统性问题全面检视',
      prompt: '以下是多章节内容：\n\n',
      experts: 'all'
    },
    {
      id: 'character-consistency',
      emoji: '👤',
      title: '人物一致性',
      desc: '跨章节人物行为与性格一致性',
      prompt: '以下是多章节内容：\n\n',
      experts: ['character-designer', 'continuity-checker', 'dialogue-expert']
    },
    {
      id: 'rhythm-analysis',
      emoji: '🎵',
      title: '节奏分析',
      desc: '整体节奏曲线与爽点密度',
      prompt: '以下是多章节内容：\n\n',
      experts: ['plot-architect', 'toxic-reader', 'chief-editor']
    },
    {
      id: 'continuity-scan',
      emoji: '🔗',
      title: '连续性扫描',
      desc: '前后矛盾与逻辑漏洞全扫描',
      prompt: '以下是多章节内容：\n\n',
      experts: ['continuity-checker', 'world-builder', 'plot-architect']
    }
  ]
};

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
  abortController: null,
  currentPhase: 'concept'
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
  initFollowupZone();
  initScrollReveal();
  initEventListeners();
  initSidebar();
  initSessions();

  // Phase Tabs
  document.getElementById('phaseTabs')?.addEventListener('click', function(e) {
    const btn = e.target.closest('.phase-tab');
    if (btn && btn.dataset.phase) switchPhase(btn.dataset.phase);
  });
  // 初始化默认阶段（concept），渲染 tip tags + 场景卡片
  switchPhase('concept');

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
        <div class="cost-estimate" id="costEstimate">${formatCost(estimateCost(cfg))} / 次讨论（13位专家）</div>
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
  if (el) el.textContent = formatCost(estimateCost(cfg)) + ' / 次讨论（13位专家）';
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
    container.innerHTML = '<div class="chat-guidance"><div class="cg-icon">💬</div><h4>圆桌讨论尚未开始</h4><p>在输入框描述你的小说方案，13位专家将并行给出专业评估。</p><p class="cg-hint">💡 试试下方快捷按钮或输入自定义问题</p></div>';
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
  const titleLabel = msg.roundLabel ? `<span class="round-label">${msg.roundLabel}</span>` : '';
  let html = `<div class="chat-msg results-msg"><div class="msg-body">
    <div class="results-header"><h3>📋 圆桌讨论完成${titleLabel}</h3><span class="results-meta">${successCount}/${results.length} 完成 · 耗时 ${msg.totalTime}s · 费用 ${msg.cost}</span><button class="btn-export" onclick="exportMarkdown()" title="导出 Markdown">📥 导出</button></div>
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
  store.chatMessages.push({ type: 'system', text: '⏳ 正在召集 13 位专家，并行请求中...' });

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
      category: 'functional',
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
      category: 'functional',
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
      category: 'functional',
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
      category: 'functional',
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
      category: 'functional',
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
      category: 'functional',
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
      category: 'functional',
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
      category: 'functional',
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
      category: 'functional',
      stage: '正文阶段',
      focus: ['模板化表达', '情感平板化', '节奏机械感'],
      suggestedPrompt: '请检测这段文字的AI味，找出最明显的痕迹并示范人味改写。',
      responsibilities: ['检测6个AI味维度', '引用原文标注AI味特征', '示范人味改写', '给出去AI味优先级建议'],
      deliverables: ['AI味指数(0-10)', 'AI味特征清单', '人味改写示范']
    },
    // ===== 原型专家 =====
    {
      id: 'prototype-qidian', icon: '📝', color: '', name: '起点老编辑',
      subtitle: '网文市场 · 爽点设计',
      scenario: '从起点十二年责编经验出发，评估网文商业逻辑与爽点设计',
      skills: ['爽点设计', '读者代入', '商业逻辑', '流派匹配'],
      category: 'prototype',
      sourceTag: { label: '起点', color: '#FF6B35' },
      stage: '任意阶段',
      focus: ['前三章吸引力', '读者代入感', '流派契合度'],
      suggestedPrompt: '请用起点责编的经验，判断这个故事能不能签约，爽点够不够。',
      responsibilities: ['判断市场预期(大爆/能签/勉强/推倒)', '指出爽点设计问题', '评估读者代入感', '给出江湖气的修改建议'],
      deliverables: ['市场预判', '爽点诊断', '修改方向']
    },
    {
      id: 'prototype-jinjiang', icon: '🌸', color: '', name: '晋江大神读者',
      subtitle: '读者情绪 · 追文动力',
      scenario: '作为追文十五年的深度读者，评估情感线和追文动力',
      skills: ['情感共鸣', '代入感', '追文动力', '人物喜爱度'],
      category: 'prototype',
      sourceTag: { label: '晋江', color: '#FF85A1' },
      stage: '任意阶段',
      focus: ['心动感', '人物讨喜度', '追文意愿'],
      suggestedPrompt: '作为读者，你会不会追这本？什么让你心动或者劝退？',
      responsibilities: ['判断追文意愿', '指出心动或劝退点', '从读者情绪体验角度评价', '给出让读者追完的建议'],
      deliverables: ['追文意愿判断', '心动/劝退理由', '改进建议']
    },
    {
      id: 'prototype-serious', icon: '🎭', color: '', name: '严肃文学编辑',
      subtitle: '语言质量 · 叙事诚实',
      scenario: '用严肃文学的眼光审视语言质量、人物命运感和主题诚实性',
      skills: ['语言审美', '人物命运感', '叙事结构', '主题诚实性'],
      category: 'prototype',
      sourceTag: { label: '文学', color: '#3B5BDB' },
      stage: '正文阶段',
      focus: ['语言密度与节奏', '人物选择的必然性', '主题诚实度'],
      suggestedPrompt: '请从严肃文学的角度，评估这段文字的语言质量和叙事诚实性。',
      responsibilities: ['判断语言层面质量', '评估人物选择是否来自性格必然', '检查主题是否诚实', '给出编辑修改优先级'],
      deliverables: ['语言判断', '文学问题诊断', '编辑修改方向']
    },
    {
      id: 'prototype-tomato', icon: '🍅', color: '', name: '番茄内容编辑',
      subtitle: '留存优化 · 完读率',
      scenario: '从免费阅读平台视角评估章节留存率、钩子设计和算法友好度',
      skills: ['章尾钩子', '完读率优化', '算法逻辑', '免费读者心理'],
      category: 'prototype',
      sourceTag: { label: '番茄', color: '#E03131' },
      stage: '正文阶段',
      focus: ['章尾钩子质量', '完读率预估', '算法友好度'],
      suggestedPrompt: '请从番茄编辑的角度，评估这章的留存风险和钩子设计。',
      responsibilities: ['预判章节完读率', '检查章尾钩子是否有效', '评估算法推荐友好度', '给出留存优化建议'],
      deliverables: ['留存预判', '流失风险点', '优化方向']
    }
  ]
};

// Helper: get all expert cards as a flat array
function getAllExpertCards() {
  return [...EXPERT_CARDS.core, ...EXPERT_CARDS.genre, ...EXPERT_CARDS.support];
}

// ===== Render Expert Cards =====
function initExperts() {
  renderExpertGroup('core', document.getElementById('coreGrid'));
  renderExpertGroup('genre', document.getElementById('genreGrid'));
  renderExpertGroup('support', document.getElementById('supportGrid'));
  // Delegated click handler — bound once on the experts section, works even after re-render
  const expertSection = document.getElementById('expertSection');
  if (expertSection && !expertSection._expertClickBound) {
    expertSection._expertClickBound = true;
    expertSection.addEventListener('click', function(e) {
      if (e.target.closest('.expert-checkbox') || e.target.closest('input[type="checkbox"]')) return;
      const card = e.target.closest('.expert-card[data-expert]');
      if (card) openExpertDetailModal(card.dataset.expert);
    });
  }
}

function renderExpertGroup(group, container) {
  if (!container || !EXPERT_CARDS[group]) return;
  container.innerHTML = EXPERT_CARDS[group].map(expert => `
    <div class="expert-card" data-expert="${expert.id}" style="cursor:pointer">
      ${expert.sourceTag ? `<span class="source-tag" style="--tag-color:${expert.sourceTag.color}">${expert.sourceTag.label}</span>` : ''}
      <div class="expert-card-top">
        <div class="expert-avatar ${expert.color}">${expert.icon}</div>
        <div class="expert-meta"><h4>${expert.name}</h4><p>${expert.subtitle}</p></div>
      </div>
      <div class="expert-scenario">${expert.scenario}</div>
      <div class="expert-skills">${expert.skills.map(s => '<span class="skill-tag">' + s + '</span>').join('')}</div>
    </div>
  `).join('');
  // Click events are handled via delegated listener set up in initExperts()
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
  grid.innerHTML = MATERIALS[cat].items.map((item, idx) => `
    <div class="material-card mat-clickable" data-cat="${cat}" data-idx="${idx}" style="cursor:pointer" title="点击查看操作">
      <h4>${item.icon} ${item.title} <span class="mat-count">${item.count}</span></h4>
      <p>${item.desc}</p>
      <div class="mat-items">${item.tags.map(t => '<span class="mat-item">' + t + '</span>').join('')}</div>
      <div class="mat-action-hint">点击使用 →</div>
    </div>
  `).join('');

  // Bug5 fix: 绑定卡片点击事件
  grid.querySelectorAll('.mat-clickable').forEach(card => {
    card.addEventListener('click', function(e) {
      // 如果点击的是标签本身，直接插入该标签
      const tagEl = e.target.closest('.mat-item');
      if (tagEl) {
        insertMaterialToInput(tagEl.textContent);
        return;
      }
      const c = this.dataset.cat;
      const i = parseInt(this.dataset.idx);
      openMaterialActionPanel(c, i, this);
    });
  });
}

// 打开素材操作面板（内联展开，不用弹窗）
function openMaterialActionPanel(cat, idx, cardEl) {
  const item = MATERIALS[cat]?.items[idx];
  if (!item) return;

  // 如果已经展开，则收起
  const existing = cardEl.querySelector('.mat-action-panel');
  if (existing) { existing.remove(); cardEl.classList.remove('mat-expanded'); return; }

  // 收起其他已展开的面板
  document.querySelectorAll('.mat-action-panel').forEach(p => {
    p.closest('.mat-clickable')?.classList.remove('mat-expanded');
    p.remove();
  });

  cardEl.classList.add('mat-expanded');
  const panel = document.createElement('div');
  panel.className = 'mat-action-panel';
  panel.innerHTML = `
    <div class="map-title">选择要插入的素材标签：</div>
    <div class="map-tags">${item.tags.map(t => '<button class="map-tag-btn" data-tag="' + escapeHtml(t) + '">' + escapeHtml(t) + '</button>').join('')}</div>
    <div class="map-actions">
      <button class="map-btn-all">📋 插入全部标签</button>
      <button class="map-btn-prompt">✍ 用此素材开始讨论</button>
    </div>
  `;

  // 单个标签插入
  panel.querySelectorAll('.map-tag-btn').forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      insertMaterialToInput(this.dataset.tag);
      cardEl.classList.remove('mat-expanded');
      panel.remove();
    });
  });

  // 插入全部标签
  panel.querySelector('.map-btn-all').addEventListener('click', function(e) {
    e.stopPropagation();
    insertMaterialToInput(item.tags.join('、'));
    cardEl.classList.remove('mat-expanded');
    panel.remove();
  });

  // 用此素材开始讨论
  panel.querySelector('.map-btn-prompt').addEventListener('click', function(e) {
    e.stopPropagation();
    const prompt = '我想写一个包含以下元素的故事：' + item.tags.join('、') + '\n\n素材来源：' + item.title + '（' + item.desc + '）\n\n请各位专家从商业价值、世界观、人物、剧情等角度给出评估和建议。';
    const input = document.getElementById('creativeInput');
    if (input) { input.value = prompt; input.focus(); input.dispatchEvent(new Event('input', { bubbles: true })); }
    cardEl.classList.remove('mat-expanded');
    panel.remove();
    showNotification('已填入素材提示词，点击"开始圆桌讨论"', 'success');
    // 滚动到输入框
    input?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  cardEl.appendChild(panel);
}

// 将文本插入到创作输入框（追加到末尾）
function insertMaterialToInput(text) {
  const input = document.getElementById('creativeInput');
  if (!input) return;
  const cur = input.value;
  input.value = cur ? cur + '\n' + text : text;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.focus();
  showNotification('已插入：' + text.slice(0, 20) + (text.length > 20 ? '...' : ''), 'success');
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
    if (input) { input.value = tpl.prompt; input.dispatchEvent(new Event('input', { bubbles: true })); input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
    // 高亮当前卡片
    container.querySelectorAll('.quick-tpl-card').forEach(c => c.classList.remove('active'));
    card.classList.add('active');
    // 显示提示
    const expertNames = tpl.experts === 'all' ? '全部 ' + EXPERTS.length + ' 位专家' : tpl.experts.map(id => { const ex = EXPERTS.find(e => e.id === id); return ex ? ex.emoji + ex.name : id; }).join('、');
    showNotification('已切换模板：' + tpl.title + ' → ' + expertNames, 'info');
  });
}

// ===== 字数计数（阶段感知） =====
function updateCharCount() {
  const input = document.getElementById('creativeInput');
  const countEl = document.getElementById('creativeCharCount');
  const warnEl = document.getElementById('charWarningMsg');
  if (!input || !countEl) return;
  const len = input.value.length;
  countEl.textContent = len;
  const cfg = PHASE_CONFIG[store.currentPhase] || PHASE_CONFIG.concept;
  // 重置样式
  countEl.style.color = '';
  if (warnEl) { warnEl.textContent = ''; warnEl.style.color = ''; }
  if (len >= cfg.maxChars) {
    countEl.style.color = 'var(--color-error, #e53e3e)';
    if (warnEl) { warnEl.textContent = '🚫 已超过本阶段建议上限，超出部分处理效果会下降'; warnEl.style.color = 'var(--color-error, #e53e3e)'; }
  } else if (len >= cfg.warningChars) {
    countEl.style.color = '#d97706';
    if (warnEl) { warnEl.textContent = '⚠️ 输入较长，专家将重点关注前段内容'; warnEl.style.color = '#d97706'; }
  }
}

// ===== 渲染阶段 Tip Tags =====
function renderPhaseTipTags(phase) {
  const container = document.getElementById('phaseTipTags');
  if (!container) return;
  const cfg = PHASE_CONFIG[phase] || PHASE_CONFIG.concept;
  container.innerHTML = cfg.tipTags.map(t =>
    `<span class="tip-tag" data-tip="${t.tip.replace(/"/g, '&quot;')}">${t.label}</span>`
  ).join('');
  // 重新绑定点击事件
  container.querySelectorAll('.tip-tag').forEach(tag => {
    tag.addEventListener('click', function() {
      container.querySelectorAll('.tip-tag').forEach(t => t.classList.remove('active'));
      this.classList.add('active');
      const input = document.getElementById('creativeInput');
      if (input) { input.value = this.dataset.tip; input.dispatchEvent(new Event('input', { bubbles: true })); input.focus(); }
    });
  });
}

// ===== 渲染阶段场景卡片 =====
function renderPhaseSceneCards(phase) {
  const container = document.getElementById('quickTemplates');
  if (!container) return;
  const cards = PHASE_SCENE_CARDS[phase];
  // concept 阶段使用原 QUICK_TEMPLATES
  const list = (!cards) ? QUICK_TEMPLATES : cards;
  container.innerHTML = list.map(t => `
    <div class="quick-tpl-card" data-tpl-id="${t.id}">
      <span class="qt-emoji">${t.emoji}</span>
      <div class="qt-text">
        <span class="qt-title">${t.title}</span>
        <span class="qt-desc">${t.desc}</span>
      </div>
    </div>
  `).join('');
  // 重新绑定点击事件（复用逻辑）
  container.querySelectorAll('.quick-tpl-card').forEach(card => {
    card.addEventListener('click', function() {
      const tplId = this.dataset.tplId;
      const tpl = list.find(t => t.id === tplId);
      if (!tpl) return;
      const input = document.getElementById('creativeInput');
      if (input) {
        input.value = tpl.prompt;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
      }
      container.querySelectorAll('.quick-tpl-card').forEach(c => c.classList.remove('active'));
      this.classList.add('active');
      const expertNames = tpl.experts === 'all'
        ? '全部 ' + EXPERTS.length + ' 位专家'
        : tpl.experts.map(id => { const ex = EXPERTS.find(e => e.id === id); return ex ? ex.emoji + ex.name : id; }).join('、');
      showNotification('已切换模板：' + tpl.title + ' → ' + expertNames, 'info');
    });
  });
}

// ===== 切换阶段 =====
function switchPhase(phase) {
  if (!PHASE_CONFIG[phase]) return;
  store.currentPhase = phase;
  const cfg = PHASE_CONFIG[phase];
  // 更新 Tab 高亮
  document.querySelectorAll('.phase-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.phase === phase);
  });
  // 更新标题/副标题/badge
  const titleEl = document.getElementById('phaseTitle');
  const subtitleEl = document.getElementById('phaseSubtitle');
  const badgeEl = document.getElementById('phaseBadge');
  if (titleEl) titleEl.textContent = cfg.title;
  if (subtitleEl) subtitleEl.textContent = cfg.subtitle;
  if (badgeEl) badgeEl.textContent = cfg.badge;
  // 更新 placeholder
  const textarea = document.getElementById('creativeInput');
  if (textarea) textarea.placeholder = cfg.placeholder;
  // 渲染 tip tags 和场景卡片
  renderPhaseTipTags(phase);
  renderPhaseSceneCards(phase);
  // 刷新字数状态
  updateCharCount();
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
  document.getElementById('creativeInput')?.addEventListener('input', updateCharCount);

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
  document.getElementById('modalOverlay')?.addEventListener('click', function(e) {
    if (e.target === this) {
      // Check if the click coordinates land on an expert card behind the overlay
      this.style.pointerEvents = 'none';
      const behind = document.elementFromPoint(e.clientX, e.clientY);
      this.style.pointerEvents = '';
      const card = behind?.closest('.expert-card');
      if (card && card.dataset.expert) {
        closeModal();
        openExpertDetailModal(card.dataset.expert);
      } else {
        closeModal();
      }
    }
  });

// Mobile menu
(function() {
  const menuBtn = document.getElementById('mobileMenuBtn');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  function openSidebar() { menuBtn?.classList.add('active'); sidebar?.classList.add('open'); overlay?.classList.add('active'); }
  function closeSidebar() { menuBtn?.classList.remove('active'); sidebar?.classList.remove('open'); overlay?.classList.remove('active'); }
  menuBtn?.addEventListener('click', function() { sidebar?.classList.contains('open') ? closeSidebar() : openSidebar(); });
  overlay?.addEventListener('click', closeSidebar);
  // Close sidebar when a nav item is clicked on mobile
  sidebar?.addEventListener('click', function(e) { if (window.innerWidth <= 768 && e.target.closest('.nav-item')) closeSidebar(); });
})();

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

  // Filter by group (core/genre/support)
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      const filter = this.dataset.filter;
      document.querySelectorAll('.expert-group').forEach(g => { g.classList.toggle('hidden', filter !== 'all' && g.dataset.group !== filter); });
    });
  });

  // Category tabs (全部/职能专家/原型专家)
  document.querySelectorAll('.category-tab').forEach(tab => {
    tab.addEventListener('click', function() {
      document.querySelectorAll('.category-tab').forEach(t => t.classList.remove('active'));
      this.classList.add('active');
      const category = this.dataset.category;
      // Filter individual expert cards by category
      document.querySelectorAll('.expert-card[data-expert]').forEach(card => {
        const expertId = card.dataset.expert;
        const expertData = getAllExpertCards().find(e => e.id === expertId);
        if (!expertData) return;
        if (category === 'all') {
          card.style.display = '';
        } else {
          card.style.display = (expertData.category === category) ? '' : 'none';
        }
      });
      // Show/hide group headers if all cards in the group are hidden
      document.querySelectorAll('.expert-group').forEach(g => {
        const visibleCards = g.querySelectorAll('.expert-card[data-expert]:not([style*="display: none"])');
        g.classList.toggle('hidden', visibleCards.length === 0);
      });
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
    const followupRound = store.chatMessages.filter(m => m.type === 'results').length + 1;
    const roundLabel = `· 第 ${followupRound} 轮追问`;
    store.chatMessages.push({ type: 'results', results, totalTime, cost, roundLabel });
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
      const singleRound = store.chatMessages.filter(m => m.type === 'results').length + 1;
      store.chatMessages.push({ type: 'results', results: [result], totalTime: elapsed, cost: formatCost(estimateCost(cfg) / 8), roundLabel: `· 第 ${singleRound} 轮追问（${expert.name}）` });
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
  header.innerHTML = '<div class="modal-expert-top"><div class="modal-avatar expert-avatar" style="width:64px;height:64px;border-radius:16px;font-size:28px;background:var(--gradient-1);">👥</div><div class="modal-title"><h2>13 位圆桌专家</h2><p>并行评估你的小说方案</p></div></div>';
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

  const msgBody = lastResults.querySelector('.msg-body');
  if (!msgBody) return;

  const btn = document.createElement('div');
  btn.id = 'summaryBtn';
  btn.className = 'summary-cta';
  btn.innerHTML = `
    <div class="summary-cta-inner">
      <div class="summary-cta-text">
        <span class="summary-cta-icon">🧠</span>
        <div>
          <strong>综合所有专家意见</strong>
          <p>让总编辑整合13位专家的观点，给出优先级排序</p>
        </div>
      </div>
      <button class="btn-summary" onclick="runSummaryRoundtable()">生成综合报告</button>
    </div>
  `;
  msgBody.appendChild(btn);

  // Ghostwriter button (only in mid/post phase)
  if (store.currentPhase === 'mid' || store.currentPhase === 'post') {
    if (!document.getElementById('ghostwriterBtn')) {
      const gwBtn = document.createElement('div');
      gwBtn.id = 'ghostwriterBtn';
      gwBtn.className = 'ghostwriter-cta';
      gwBtn.innerHTML = `
        <div class="ghostwriter-cta-inner">
          <div class="ghostwriter-cta-text">
            <span class="ghostwriter-cta-icon">✍️</span>
            <div>
              <strong>执笔人改写</strong>
              <p>综合专家意见，直接改写你的原文，输出修订稿 + 修改日志</p>
            </div>
          </div>
          <button class="btn-ghostwriter" onclick="runGhostwriter()">开始改写</button>
        </div>
      `;
      msgBody.appendChild(gwBtn);
    }
  }
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

  const summaryPrompt = `以下是13位专家对同一个小说方案的评审意见，请你作为总编辑综合所有观点，输出：

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

// ===== Ghostwriter (执笔人) v3.3.0 =====
const GHOSTWRITER_CONFIG = {
  temperature: 0.7,
  max_tokens: 4000,
  systemPrompt: `你是一位资深的小说执笔人（Ghostwriter）。你的任务是综合所有专家的评审意见，对作者的原始文本进行改写润色。

你的工作原则：
1. 你不是评论家，你是动手改稿的人。不要再重复专家的批评，直接给出改好的版本。
2. 保留作者的核心创意、人设、世界观设定不变。
3. 重点解决专家们指出的问题：节奏拖沓、对白僵硬、描写AI味重、逻辑漏洞等。
4. 改写时保持作者原有的风格倾向，不要强行注入你自己的文风。
5. 对于你无法判断的设定取舍（如人设改动、剧情走向），保留原文并用【存疑】标注。

输出格式要求：
---
## ✍️ 改写稿

[直接输出改写后的完整文本，不要分段解释为什么改]

---
## 📋 修改日志

| 序号 | 修改位置 | 原文摘要 | 修改内容 | 依据专家 |
|------|----------|----------|----------|----------|
| 1 | ... | ... | ... | ... |

---
## ⚠️ 存疑保留

[如有无法判断的部分，列出并说明理由；如无则写"无"]
`
};

function buildGhostwriterPrompt(originalText, expertResults) {
  const successResults = expertResults.filter(r => r.success && r.content);
  if (!successResults.length) return null;

  const expertContext = successResults.map(r => {
    const name = r.expert?.name || '专家';
    const emoji = r.expert?.emoji || '📝';
    return `### ${emoji} ${name}的意见\n${(r.content || '').slice(0, 1200)}`;
  }).join('\n\n');

  return `## 作者原文

${originalText}

---

## 各位专家的评审意见

${expertContext}

---

请根据以上专家意见，对作者原文进行改写。注意：
- 直接输出改写后的完整文本
- 附上修改日志表格
- 不要遗漏原文中没有问题的段落（原样保留）
- 改写幅度要适度，不要面目全非`;
}

async function runGhostwriter() {
  const results = store.currentResults?.results;
  if (!results || results.length === 0) {
    showNotification('没有专家评审结果，无法执笔', 'warning');
    return;
  }

  // Get original text from textarea
  const originalText = document.getElementById('creativeInput')?.value?.trim();
  if (!originalText) {
    showNotification('原文输入框为空，执笔人需要原文才能改写', 'warning');
    return;
  }

  // Phase check
  if (store.currentPhase !== 'mid' && store.currentPhase !== 'post') {
    showNotification('执笔人仅在"写作中"和"写作后"阶段可用', 'warning');
    return;
  }

  // Build prompt
  const userPrompt = buildGhostwriterPrompt(originalText, results);
  if (!userPrompt) {
    showNotification('没有可用的专家意见，无法执笔', 'warning');
    return;
  }

  // Show loading state
  const btn = document.getElementById('ghostwriterBtn');
  if (btn) btn.innerHTML = '<div class="ghostwriter-loading">✍️ 执笔人正在改写中...</div>';

  try {
    const cfg = getUserConfig();
    const modelId = getModelForExpert('chief-editor', cfg);
    const modelInfo = AVAILABLE_MODELS[modelId];
    if (!modelInfo) throw new Error('执笔人模型配置不存在');
    const keys = await getApiKeys();
    const apiKey = keys[modelInfo.platform];
    if (!apiKey) throw new Error('未配置 ' + API_PLATFORMS[modelInfo.platform].name + ' Key');

    const response = await callAI(modelInfo.platform, apiKey, modelId, [
      { role: 'system', content: GHOSTWRITER_CONFIG.systemPrompt },
      { role: 'user', content: userPrompt }
    ], { temperature: GHOSTWRITER_CONFIG.temperature, max_tokens: GHOSTWRITER_CONFIG.max_tokens });

    renderGhostwriterResult(btn, response);
  } catch (err) {
    if (btn) btn.innerHTML = `<div class="ghostwriter-error">执笔失败：${escapeHtml(err.message)}</div>`;
  }
}

function renderGhostwriterResult(container, content) {
  if (!container) return;
  container.className = 'ghostwriter-result';
  container.innerHTML = `
    <div class="ghostwriter-result-header">
      <span>✍️</span>
      <strong>执笔人改写稿</strong>
      <button class="btn-copy-ghostwriter" onclick="copyGhostwriterResult()" title="复制改写稿">📋 复制</button>
    </div>
    <div class="ghostwriter-result-content" id="ghostwriterContent">${renderMarkdown(content)}</div>
  `;
  // Store raw text for copy
  container.dataset.rawContent = content;
}

function copyGhostwriterResult() {
  const container = document.getElementById('ghostwriterBtn');
  if (!container || !container.dataset.rawContent) {
    showNotification('没有可复制的内容', 'warning');
    return;
  }
  const raw = container.dataset.rawContent;
  // Extract only the revised text (between first "## ✍️ 改写稿" and next "---")
  const match = raw.match(/## ✍️ 改写稿\s*\n([\s\S]*?)(?:\n---|\n## 📋)/);
  const textToCopy = match ? match[1].trim() : raw;

  navigator.clipboard.writeText(textToCopy).then(() => {
    showNotification('改写稿已复制到剪贴板', 'success');
  }).catch(() => {
    // Fallback
    const ta = document.createElement('textarea');
    ta.value = textToCopy;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showNotification('改写稿已复制到剪贴板', 'success');
  });
}

// Expose to window for potential onclick usage
window.openExpertDetailModal = openExpertDetailModal;
window.selectExpertAndClose = selectExpertAndClose;
window.useExpertPrompt = useExpertPrompt;
window.runSummaryRoundtable = runSummaryRoundtable;
window.runGhostwriter = runGhostwriter;
window.copyGhostwriterResult = copyGhostwriterResult;

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
  // Bug3 fix: 历史会话应从头阅读，滚到顶部而非底部
  const chatContainer = document.getElementById('chatMessages');
  if (chatContainer) chatContainer.scrollTop = 0;
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

// Bug4 fix: 工具依赖内存状态，刷新后 store.currentResults 为空
// 此函数在工具被调用时自动从最近一条历史记录恢复，无需用户重新讨论
function ensureCurrentResults() {
  if (store.currentResults && store.currentResults.results && store.currentResults.results.length) {
    return true; // 内存中已有数据，直接使用
  }
  const hist = getHistory();
  if (!hist.length) return false;
  const entry = hist[0]; // 最近一条
  if (!entry.results || !entry.results.length) return false;
  // 复用 restoreSession 的转换逻辑
  function toRenderResults(arr) {
    return arr.map(r => {
      const expert = EXPERTS.find(e => e.id === r.expertId) || { name: r.expertName, emoji: r.emoji, id: r.expertId };
      if (r.error) return { expert, success: false, error: r.error };
      return { expert, success: true, content: r.content, modelInfo: { name: r.model }, elapsed: r.duration, modelId: r.model };
    });
  }
  const results = toRenderResults(entry.results.slice(0, 9));
  store.currentResults = { topic: entry.topic, historyId: entry.id, results, totalTime: entry.totalTime || '?', cost: '历史记录' };
  return true;
}

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
  if (!ensureCurrentResults()) {
    showNotification('暂无讨论记录，请先完成一次圆桌讨论', 'warning');
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
  if (!ensureCurrentResults()) {
    showNotification('暂无讨论记录，请先完成一次圆桌讨论', 'warning');
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
  if (!ensureCurrentResults()) {
    showNotification('暂无讨论记录，请先完成一次圆桌讨论', 'warning');
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
