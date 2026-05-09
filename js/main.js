// ===== NovelRoundTable - Route B: Frontend Direct AI API =====
// 纯前端调用，零服务器成本，API Key 仅存储在用户本地浏览器

// ===== API 平台配置 =====
const API_PLATFORMS = {
  friday: {
    name: 'Friday (美团内部)',
    url: 'https://aigc.sankuai.com/v1/openai/native/chat/completions',
    defaultModel: 'friday-gpt4o',
    authType: 'appid', // Authorization: appid <key>
    models: ['friday-gpt4o', 'friday-gpt4o-mini', 'friday-claude-sonnet']
  },
  deepseek: {
    name: 'DeepSeek',
    url: 'https://api.deepseek.com/v1/chat/completions',
    defaultModel: 'deepseek-chat',
    authType: 'bearer',
    models: ['deepseek-chat', 'deepseek-reasoner']
  },
  qwen: {
    name: '通义千问',
    url: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    defaultModel: 'qwen-plus',
    authType: 'bearer',
    models: ['qwen-plus', 'qwen-turbo', 'qwen-max']
  },
  openai_compatible: {
    name: 'OpenAI 兼容',
    url: '', // 用户自定义
    defaultModel: 'gpt-4o-mini',
    authType: 'bearer',
    models: ['gpt-4o-mini', 'gpt-4o', 'gpt-3.5-turbo']
  }
};

// ===== 8 位 AI 专家 =====
const AI_EXPERTS = [
  { id: 'architect', role: '故事架构师', emoji: '🏗️', systemPrompt: '你是一位资深故事架构师。擅长从模糊想法中提炼核心冲突，设计三幕/五幕结构，规划情节节奏。请针对用户的创作想法，从故事结构角度给出专业建议，包括核心冲突、结构建议和节奏规划。回复控制在200字以内，直接给干货。' },
  { id: 'character', role: '人物塑造师', emoji: '👤', systemPrompt: '你是一位人物塑造专家。擅长设计立体角色、性格弧光、人物关系网。请针对用户的创作想法，从人物角度给出建议，包括主角特质建议、关键关系设计、成长弧线方向。回复控制在200字以内，直接给干货。' },
  { id: 'worldbuilder', role: '世界观设计师', emoji: '🌍', systemPrompt: '你是一位世界观构建专家。擅长设定体系、规则逻辑、历史编年。请针对用户的创作想法，从世界观角度给出建议，包括核心设定、规则体系、环境氛围。回复控制在200字以内，直接给干货。' },
  { id: 'genre', role: '类型顾问', emoji: '📚', systemPrompt: '你是一位网文类型研究专家。熟悉玄幻、言情、悬疑、科幻等各类型套路与创新点。请针对用户的创作想法，判断最适合的类型定位，给出该类型的核心要素建议和差异化方向。回复控制在200字以内，直接给干货。' },
  { id: 'dialogue', role: '对话专家', emoji: '💬', systemPrompt: '你是一位对话/台词设计专家。擅长角色语言特征、对白节奏、潜台词设计。请针对用户的创作想法，给出关键角色的语言风格建议，并示范1-2句有特色的台词样本。回复控制在200字以内，直接给干货。' },
  { id: 'market', role: '市场分析师', emoji: '📈', systemPrompt: '你是一位网文市场趋势分析师。熟悉各平台热门题材、读者偏好、算法推荐逻辑。请针对用户的创作想法，从市场角度给出建议，包括目标读者画像、竞品参考、差异化卖点。回复控制在200字以内，直接给干货。' },
  { id: 'stylist', role: '文笔润色师', emoji: '✒️', systemPrompt: '你是一位文笔风格专家。擅长语言风格定调、修辞打磨、氛围营造。请针对用户的创作想法，建议最适合的文风基调，并给出一段50字左右的开头示范。回复控制在200字以内，直接给干货。' },
  { id: 'logic', role: '逻辑审查官', emoji: '🔍', systemPrompt: '你是一位逻辑审查专家。擅长发现剧情漏洞、设定冲突、时间线矛盾。请针对用户的创作想法，预判可能出现的逻辑问题，给出需要注意的设定一致性要点。回复控制在200字以内，直接给干货。' }
];

// ===== 三种配置模式 =====
const CONFIG_MODES = {
  default: {
    name: '默认搭配',
    desc: '所有专家使用同一平台和模型',
    getConfig: () => {
      const platform = localStorage.getItem('nrt_platform') || 'deepseek';
      const apiKey = localStorage.getItem('nrt_apikey') || '';
      const model = localStorage.getItem('nrt_model') || API_PLATFORMS[platform]?.defaultModel || '';
      const customUrl = localStorage.getItem('nrt_custom_url') || '';
      return AI_EXPERTS.map(() => ({ platform, apiKey, model, customUrl }));
    }
  },
  free: {
    name: '自由搭配',
    desc: '每位专家可独立配置不同平台/模型',
    getConfig: () => {
      return AI_EXPERTS.map((expert, i) => {
        const saved = localStorage.getItem(`nrt_expert_${i}`);
        if (saved) return JSON.parse(saved);
        // fallback to default
        const platform = localStorage.getItem('nrt_platform') || 'deepseek';
        const apiKey = localStorage.getItem('nrt_apikey') || '';
        const model = localStorage.getItem('nrt_model') || API_PLATFORMS[platform]?.defaultModel || '';
        const customUrl = localStorage.getItem('nrt_custom_url') || '';
        return { platform, apiKey, model, customUrl };
      });
    }
  },
  mixed: {
    name: '混合搭配',
    desc: '前4位用平台A，后4位用平台B',
    getConfig: () => {
      const configA = JSON.parse(localStorage.getItem('nrt_mixed_a') || 'null') || {
        platform: localStorage.getItem('nrt_platform') || 'deepseek',
        apiKey: localStorage.getItem('nrt_apikey') || '',
        model: localStorage.getItem('nrt_model') || '',
        customUrl: ''
      };
      const configB = JSON.parse(localStorage.getItem('nrt_mixed_b') || 'null') || configA;
      return AI_EXPERTS.map((_, i) => i < 4 ? configA : configB);
    }
  }
};

// ===== 统一 AI 调用函数 =====
async function callAI({ platform, apiKey, model, customUrl, messages }) {
  const platformConfig = API_PLATFORMS[platform];
  if (!platformConfig) throw new Error(`未知平台: ${platform}`);

  const url = platform === 'openai_compatible' ? customUrl : platformConfig.url;
  if (!url) throw new Error('请配置 API 地址');
  if (!apiKey) throw new Error('请配置 API Key');

  const finalModel = model || platformConfig.defaultModel;
  const authHeader = platformConfig.authType === 'appid'
    ? `appid ${apiKey}`
    : `Bearer ${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': authHeader
    },
    body: JSON.stringify({
      model: finalModel,
      messages,
      max_tokens: 500,
      temperature: 0.8
    })
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`HTTP ${response.status}: ${errText.slice(0, 100)}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

// ===== Data: Expert Definitions (for UI display cards) =====
const EXPERTS = {
  core: [
    { id: 'architect', icon: '&#127916;', color: '', name: '故事架构师', subtitle: '情节设计 - 结构规划', scenario: '题目还没收敛时，先做故事定位与核心冲突判断', skills: ['情节构建', '结构设计', '冲突编排', '节奏控制'], deliverables: ['故事大纲', '章节规划', '冲突设计表', '节奏曲线图', '转折点清单'], desc: '故事架构师是整个创作团队的核心引擎。TA 擅长从一个模糊的想法中提炼出故事的核心冲突，设计完整的三幕/五幕结构，规划情节节奏曲线，确保故事从开头到结尾都有强大的叙事张力。' },
    { id: 'character', icon: '&#128100;', color: 'pink', name: '人物塑造师', subtitle: '角色设计 - 性格弧光', scenario: '需要立体人物时，先做角色画像与成长弧线设计', skills: ['角色画像', '性格弧光', '关系网络', '动机设计'], deliverables: ['角色档案', '人物关系图', '成长弧线', '对话风格指南'], desc: '人物塑造师专注于创造有血有肉的角色。TA 会为每个角色设计独特的性格特征、成长弧线、内在动机和外在冲突，确保人物在故事中有真实可信的行为逻辑。' },
    { id: 'worldbuilder', icon: '&#127758;', color: 'teal', name: '世界观设计师', subtitle: '设定构建 - 规则体系', scenario: '需要搭建完整世界时，先做设定体系与规则逻辑', skills: ['设定体系', '规则逻辑', '历史编年', '地理构建'], deliverables: ['设定百科', '地图草案', '年表文档', '规则手册'], desc: '世界观设计师负责构建故事发生的完整世界。从物理规则到社会结构，从历史脉络到地理环境，TA 确保世界观内部逻辑自洽，为故事提供坚实的舞台。' },
    { id: 'stylist', icon: '&#9999;', color: '', name: '文笔润色师', subtitle: '语言风格 - 修辞打磨', scenario: '初稿已有但文笔粗糙时，先做语言风格定调与润色', skills: ['风格定调', '修辞打磨', '氛围营造', '视角切换'], deliverables: ['风格指南', '润色稿', '修辞清单', '语言样本'], desc: '文笔润色师是文字的雕刻家。TA 擅长根据故事类型和目标读者定调语言风格，运用恰当的修辞手法提升文字质感，让每一段文字都有独特的韵味。' },
    { id: 'dialogue', icon: '&#128172;', color: 'pink', name: '对话专家', subtitle: '台词设计 - 对白节奏', scenario: '对话不够生动时，先做角色语言特征与对白节奏设计', skills: ['语言特征', '对白节奏', '潜台词', '群戏编排'], deliverables: ['对话样本', '语言档案', '对白脚本', '潜台词设计'], desc: '对话专家让角色通过语言活起来。TA 为每个角色设计独特的说话方式、口头禅和语言节奏，确保读者仅通过对话就能辨认出是谁在说话。' }
  ],
  genre: [
    { id: 'xianxia', icon: '&#128481;', color: '', name: '玄幻/仙侠顾问', subtitle: '修炼体系 - 战力设定', scenario: '写玄幻仙侠时，先做修炼体系与力量等级设计', skills: ['修炼体系', '战力设定', '升级节奏', '宗门设计'], deliverables: ['修炼等级表', '功法体系', '宗门架构', '战斗场景模板'], desc: '玄幻/仙侠顾问精通东方幻想类型的所有套路和创新点。从修炼境界到功法体系，从宗门架构到天地规则，TA 帮你构建一个让读者欲罢不能的修仙世界。' },
    { id: 'romance', icon: '&#128149;', color: 'pink', name: '言情/都市顾问', subtitle: '情感线索 - 关系设计', scenario: '写情感线时，先做人物关系网与情感节奏铺排', skills: ['情感线索', '关系设计', '甜虐节奏', '人设搭配'], deliverables: ['关系网络图', '情感节奏表', '甜点/虐点清单', '人设档案'], desc: '言情/都市顾问深谙读者的情感需求。TA 擅长设计让人心动的人物关系、把控甜虐节奏、创造令人难忘的名场面，让读者跟着角色一起心跳加速。' },
    { id: 'mystery', icon: '&#128270;', color: 'teal', name: '悬疑/推理顾问', subtitle: '诡计设计 - 线索布局', scenario: '写悬疑推理时，先做核心诡计与线索埋设规划', skills: ['诡计设计', '线索布局', '反转设计', '逻辑推演'], deliverables: ['诡计方案', '线索时间线', '误导清单', '真相揭示方案'], desc: '悬疑/推理顾问是逻辑与创意的完美结合。TA 帮你设计精妙的诡计、布置合理的线索、安排震撼的反转，确保读者在恍然大悟时拍案叫绝。' },
    { id: 'scifi', icon: '&#128640;', color: '', name: '科幻/未来顾问', subtitle: '科技设定 - 未来推演', scenario: '写科幻时，先做科技树设定与社会推演逻辑', skills: ['科技设定', '未来推演', '硬核设计', '社会构建'], deliverables: ['科技树文档', '社会推演报告', '技术设定集', '未来年表'], desc: '科幻/未来顾问帮你构建令人信服的未来世界。从硬科幻的技术细节到软科幻的社会推演，TA 确保你的科幻设定既有想象力又有逻辑基础。' }
  ],
  support: [
    { id: 'market', icon: '&#128200;', color: 'teal', name: '市场趋势分析师', subtitle: '热门题材 - 读者偏好', scenario: '不确定写什么时，先看当前市场热点与读者需求', skills: ['热门追踪', '竞品分析', '读者画像', '算法适配'], deliverables: ['趋势报告', '竞品清单', '选题建议', '读者画像'], desc: '市场趋势分析师帮你找到最有潜力的创作方向。TA 追踪各大平台的热门题材、分析竞品优劣、描绘目标读者画像，让你的创作既有艺术性又有市场性。' },
    { id: 'logic', icon: '&#128270;', color: '', name: '逻辑审查官', subtitle: 'Bug 检测 - 一致性校验', scenario: '担心剧情有漏洞时，先做逻辑一致性与设定冲突检查', skills: ['逻辑检测', '一致性校验', '时间线审查', '设定冲突'], deliverables: ['逻辑审查报告', 'Bug清单', '修复建议', '一致性检查表'], desc: '逻辑审查官是你作品的质量守门人。TA 会仔细检查剧情逻辑、时间线一致性、设定冲突和角色行为合理性，确保你的故事经得起读者的推敲。' },
    { id: 'editor', icon: '&#128203;', color: 'pink', name: '编辑总监', subtitle: '节奏把控 - 出版规范', scenario: '准备定稿时，先做整体节奏评估与出版规范检查', skills: ['节奏把控', '出版规范', '整体评估', '修改建议'], deliverables: ['节奏评估报告', '修改意见书', '出版规范检查', '定稿建议'], desc: '编辑总监从专业出版角度审视你的作品。TA 评估整体节奏、检查出版规范、提供修改建议，帮你把作品打磨到可以面向读者的最佳状态。' }
  ]
};

// ===== Data: Material Library =====
const MATERIALS = {
  '人名库': { count: '2000+', items: [
    { title: '中国古风人名', icon: '&#128219;', count: '800+', desc: '按朝代、性别、气质分类的古风人名库', tags: ['先秦风', '唐宋韵', '明清调', '仙侠名'] },
    { title: '西方奇幻人名', icon: '&#127758;', count: '600+', desc: '精灵、矮人、龙族等种族命名规则', tags: ['精灵族', '矮人族', '人类', '暗黑系'] },
    { title: '现代都市人名', icon: '&#127961;', count: '400+', desc: '符合现代审美的角色命名方案', tags: ['文艺范', '霸总系', '邻家风', '高冷型'] },
    { title: '日韩风人名', icon: '&#127884;', count: '200+', desc: '日系和韩系风格的角色命名', tags: ['日系', '韩系', '混血', '二次元'] }
  ]},
  '地名库': { count: '1500+', items: [
    { title: '地理环境', icon: '&#127956;', count: '500+', desc: '山川、城池、秘境等场景描写素材', tags: ['名山大川', '古城要塞', '秘境洞天', '现代都市'] },
    { title: '仙侠地名', icon: '&#9968;', count: '400+', desc: '宗门、洞府、秘境等仙侠场景', tags: ['宗门山门', '洞府福地', '险地秘境', '仙界天宫'] },
    { title: '科幻地名', icon: '&#128752;', count: '300+', desc: '星球、空间站、虚拟世界等', tags: ['星球殖民', '空间站', '虚拟世界', '平行宇宙'] },
    { title: '都市地标', icon: '&#127961;', count: '300+', desc: '现代城市场景和地标描写', tags: ['商业区', '老城区', '郊区', '地下城'] }
  ]},
  '历史事件': { count: '800+', items: [
    { title: '中国历史', icon: '&#128220;', count: '400+', desc: '各朝代重大事件和典故', tags: ['春秋战国', '秦汉三国', '唐宋元明', '近现代'] },
    { title: '世界历史', icon: '&#127760;', count: '300+', desc: '世界各地重大历史事件', tags: ['欧洲', '美洲', '中东', '东亚'] },
    { title: '神话传说', icon: '&#128050;', count: '100+', desc: '各文明神话体系和传说故事', tags: ['中国神话', '希腊神话', '北欧神话', '日本神话'] }
  ]},
  '功法体系': { count: '500+', items: [
    { title: '修仙境界', icon: '&#9876;', count: '200+', desc: '修仙、武侠、异能等力量体系模板', tags: ['修仙境界', '武学招式', '异能分类', '魔法体系'] },
    { title: '武器装备', icon: '&#128481;', count: '200+', desc: '各类武器和装备设定模板', tags: ['神兵利器', '法宝灵器', '科技武器', '防具护甲'] },
    { title: '门派体系', icon: '&#127983;', count: '100+', desc: '宗门、帮派、组织架构模板', tags: ['正道宗门', '魔道势力', '散修联盟', '世家大族'] }
  ]},
  '情感模式': { count: '200+', items: [
    { title: '经典情感线', icon: '&#128149;', count: '100+', desc: '经典情感线模板和关系发展路径', tags: ['欢喜冤家', '青梅竹马', '先婚后爱', '破镜重圆'] },
    { title: '虐恋模式', icon: '&#128148;', count: '50+', desc: '虐心情节和情感冲突模板', tags: ['身份对立', '误会分离', '生死抉择', '牺牲守护'] },
    { title: '群像关系', icon: '&#128101;', count: '50+', desc: '多人关系网络和互动模式', tags: ['三角关系', '兄弟情义', '师徒羁绊', '宿敌纠缠'] }
  ]},
  '世界观模板': { count: '150+', items: [
    { title: '东方仙侠', icon: '&#9968;', count: '40+', desc: '完整仙侠世界观框架', tags: ['天地规则', '修炼体系', '势力分布', '历史纪元'] },
    { title: '西方魔幻', icon: '&#129497;', count: '40+', desc: '西方奇幻世界观模板', tags: ['魔法体系', '种族设定', '王国政治', '神灵信仰'] },
    { title: '末日废土', icon: '&#9762;', count: '35+', desc: '末世生存世界观设定', tags: ['灾变原因', '生存规则', '势力割据', '变异体系'] },
    { title: '星际文明', icon: '&#128640;', count: '35+', desc: '太空歌剧世界观框架', tags: ['文明等级', '星际政治', '科技树', '外星种族'] }
  ]}
};

// ===== State Management =====
let sessions = [];
let currentSession = null;
let chatExperts = [];
let chatMessages = [];

// ===== Initialization =====
document.addEventListener('DOMContentLoaded', function() {
  initParticles();
  initExperts();
  initMaterials();
  initScrollReveal();
  initEventListeners();
  initNumberAnimations();
});

// ===== Settings Modal =====
function openSettingsModal() {
  const overlay = document.getElementById('settingsOverlay');
  if (!overlay) return;

  // Load saved values
  const platform = localStorage.getItem('nrt_platform') || 'deepseek';
  const apiKey = localStorage.getItem('nrt_apikey') || '';
  const model = localStorage.getItem('nrt_model') || '';
  const customUrl = localStorage.getItem('nrt_custom_url') || '';
  const configMode = localStorage.getItem('nrt_config_mode') || 'default';

  document.getElementById('platformSelect').value = platform;
  document.getElementById('apiKeyInput').value = apiKey;
  document.getElementById('configModeSelect').value = configMode;

  // Update model options
  updateModelOptions(platform, model);

  // Show/hide custom URL field
  const customUrlGroup = document.getElementById('customUrlGroup');
  if (customUrlGroup) {
    customUrlGroup.style.display = platform === 'openai_compatible' ? 'block' : 'none';
    document.getElementById('customUrlInput').value = customUrl;
  }

  overlay.classList.add('active');
}

function closeSettingsModal() {
  const overlay = document.getElementById('settingsOverlay');
  if (overlay) overlay.classList.remove('active');
}

function updateModelOptions(platform, selectedModel) {
  const modelSelect = document.getElementById('modelSelect');
  if (!modelSelect) return;
  const config = API_PLATFORMS[platform];
  if (!config) return;

  modelSelect.innerHTML = config.models.map(m =>
    `<option value="${m}" ${m === selectedModel ? 'selected' : ''}>${m}</option>`
  ).join('');

  if (!selectedModel || !config.models.includes(selectedModel)) {
    modelSelect.value = config.defaultModel;
  }
}

function handleSaveSettings() {
  const platform = document.getElementById('platformSelect').value;
  const apiKey = document.getElementById('apiKeyInput').value.trim();
  const model = document.getElementById('modelSelect').value;
  const configMode = document.getElementById('configModeSelect').value;
  const customUrl = document.getElementById('customUrlInput')?.value.trim() || '';

  if (!apiKey) {
    showNotification('请输入 API Key', 'warning');
    return;
  }

  if (platform === 'openai_compatible' && !customUrl) {
    showNotification('OpenAI 兼容模式需要填写 API 地址', 'warning');
    return;
  }

  localStorage.setItem('nrt_platform', platform);
  localStorage.setItem('nrt_apikey', apiKey);
  localStorage.setItem('nrt_model', model);
  localStorage.setItem('nrt_config_mode', configMode);
  localStorage.setItem('nrt_custom_url', customUrl);

  closeSettingsModal();
  showNotification(`设置已保存！平台: ${API_PLATFORMS[platform].name}`, 'success');
}

// ===== AI Roundtable: 8 Experts Parallel Call =====
async function callRoundtableAI(topic) {
  const configMode = localStorage.getItem('nrt_config_mode') || 'default';
  const modeHandler = CONFIG_MODES[configMode];
  if (!modeHandler) {
    addSystemMessage('❌ 未知的配置模式');
    return;
  }

  const configs = modeHandler.getConfig();

  // Check if at least one config has API key
  const hasKey = configs.some(c => c.apiKey);
  if (!hasKey) {
    addSystemMessage('⚠️ 请先点击右上角「⚙ 设置」配置你的 API Key');
    openSettingsModal();
    return;
  }

  // Update chat experts display
  chatExperts = AI_EXPERTS.map(e => ({ id: e.id, icon: e.emoji, color: '', name: e.role, subtitle: '', skills: [] }));
  renderChatExperts();

  const platformName = API_PLATFORMS[configs[0].platform]?.name || configs[0].platform;
  addSystemMessage(`⏳ 正在召集 8 位专家（${platformName}），并行请求中...`);

  // Create progress indicators
  const progressId = 'progress-' + Date.now();
  chatMessages.push({
    type: 'progress',
    id: progressId,
    experts: AI_EXPERTS.map(e => ({ id: e.id, emoji: e.emoji, role: e.role, status: 'pending' })),
    time: new Date()
  });
  renderChatMessages();

  // 8 parallel requests using Promise.allSettled
  const promises = AI_EXPERTS.map((expert, index) => {
    const cfg = configs[index];
    return callAI({
      platform: cfg.platform,
      apiKey: cfg.apiKey,
      model: cfg.model,
      customUrl: cfg.customUrl,
      messages: [
        { role: 'system', content: expert.systemPrompt },
        { role: 'user', content: topic }
      ]
    }).then(content => {
      // Update progress in real-time
      updateExpertProgress(progressId, expert.id, 'done');
      return { success: true, expert, content };
    }).catch(err => {
      updateExpertProgress(progressId, expert.id, 'error');
      return { success: false, expert, content: `[请求失败: ${err.message}]` };
    });
  });

  const results = await Promise.allSettled(promises);

  // Remove progress message
  const progressIdx = chatMessages.findIndex(m => m.id === progressId);
  if (progressIdx !== -1) chatMessages.splice(progressIdx, 1);

  // Remove loading message
  const loadingIdx = chatMessages.findIndex(m => m.type === 'system' && m.text.includes('⏳'));
  if (loadingIdx !== -1) chatMessages.splice(loadingIdx, 1);
  renderChatMessages();

  // Display results one by one with delay
  let successCount = 0;
  for (const result of results) {
    const val = result.status === 'fulfilled' ? result.value : { success: false, expert: { emoji: '❓', role: '未知' }, content: '[请求异常]' };
    await delay(400);
    chatMessages.push({
      type: 'expert',
      expert: { id: val.expert.id || 'unknown', icon: val.expert.emoji, color: '', name: val.expert.role },
      text: val.content,
      time: new Date()
    });
    renderChatMessages();
    if (val.success) successCount++;
  }

  await delay(300);
  if (successCount === 8) {
    addSystemMessage('✅ 8 位专家已全部完成分析！你可以继续提问深入讨论，或开始写作。');
  } else {
    addSystemMessage(`⚠️ ${successCount}/8 位专家完成回复，部分请求失败。请检查 API Key 或网络连接。`);
  }
}

function updateExpertProgress(progressId, expertId, status) {
  const msg = chatMessages.find(m => m.id === progressId);
  if (!msg) return;
  const expert = msg.experts.find(e => e.id === expertId);
  if (expert) expert.status = status;
  renderChatMessages();
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ===== Particle Background =====
function initParticles() {
  const canvas = document.getElementById('particlesCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let particles = [];

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  class Particle {
    constructor() { this.reset(); }
    reset() {
      this.x = Math.random() * canvas.width;
      this.y = Math.random() * canvas.height;
      this.size = Math.random() * 2 + 0.5;
      this.speedX = (Math.random() - 0.5) * 0.5;
      this.speedY = (Math.random() - 0.5) * 0.5;
      this.opacity = Math.random() * 0.5 + 0.1;
    }
    update() {
      this.x += this.speedX;
      this.y += this.speedY;
      if (this.x < 0 || this.x > canvas.width || this.y < 0 || this.y > canvas.height) this.reset();
    }
    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(108, 92, 231, ${this.opacity})`;
      ctx.fill();
    }
  }

  for (let i = 0; i < 60; i++) particles.push(new Particle());

  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => { p.update(); p.draw(); });
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 150) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(108, 92, 231, ${0.1 * (1 - dist / 150)})`;
          ctx.stroke();
        }
      }
    }
    requestAnimationFrame(animate);
  }
  animate();
}

// ===== Render Expert Cards =====
function initExperts() {
  renderExpertGroup('core', document.getElementById('coreGrid'));
  renderExpertGroup('genre', document.getElementById('genreGrid'));
  renderExpertGroup('support', document.getElementById('supportGrid'));
}

function renderExpertGroup(group, container) {
  if (!container) return;
  container.innerHTML = EXPERTS[group].map(expert => `
    <div class="expert-card" data-expert="${expert.id}">
      <div class="expert-card-top">
        <div class="expert-avatar ${expert.color}">${expert.icon}</div>
        <div class="expert-meta">
          <h4>${expert.name}</h4>
          <p>${expert.subtitle}</p>
        </div>
        <div class="expert-status online"></div>
      </div>
      <div class="expert-scenario">${expert.scenario}</div>
      <div class="expert-skills">${expert.skills.map(s => `<span class="skill-tag">${s}</span>`).join('')}</div>
      <div class="expert-actions">
        <button class="btn-sm primary" data-action="invite">让 TA 先介入</button>
        <button class="btn-sm ghost" data-action="detail">查看详情</button>
      </div>
    </div>
  `).join('');
}

// ===== Render Material Library =====
function initMaterials() {
  const tabsContainer = document.getElementById('materialTabs');
  const gridContainer = document.getElementById('materialGrid');
  if (!tabsContainer || !gridContainer) return;

  const categories = Object.keys(MATERIALS);
  tabsContainer.innerHTML = categories.map((cat, i) =>
    `<span class="material-tab ${i === 0 ? 'active' : ''}" data-category="${cat}">${cat} - ${MATERIALS[cat].count}</span>`
  ).join('');

  renderMaterialGrid(categories[0]);

  tabsContainer.addEventListener('click', function(e) {
    const tab = e.target.closest('.material-tab');
    if (!tab) return;
    tabsContainer.querySelectorAll('.material-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    renderMaterialGrid(tab.dataset.category);
  });
}

function renderMaterialGrid(category) {
  const grid = document.getElementById('materialGrid');
  if (!grid || !MATERIALS[category]) return;
  grid.innerHTML = MATERIALS[category].items.map(item => `
    <div class="material-card">
      <h4>${item.icon} ${item.title} <span class="mat-count">${item.count}</span></h4>
      <p>${item.desc}</p>
      <div class="mat-items">${item.tags.map(t => `<span class="mat-item">${t}</span>`).join('')}</div>
    </div>
  `).join('');
}

// ===== Scroll Reveal =====
function initScrollReveal() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        animateNumbers(entry.target);
      }
    });
  }, { threshold: 0.15 });

  document.querySelectorAll('.scroll-reveal').forEach(el => observer.observe(el));
}

// ===== Number Animations =====
function initNumberAnimations() {}

function animateNumbers(container) {
  const numbers = container.querySelectorAll('[data-target]');
  numbers.forEach(el => {
    if (el.dataset.animated) return;
    el.dataset.animated = 'true';
    const target = parseInt(el.dataset.target);
    const suffix = el.dataset.suffix || '';
    let current = 0;
    const increment = Math.ceil(target / 40);
    const timer = setInterval(() => {
      current += increment;
      if (current >= target) { current = target; clearInterval(timer); }
      el.textContent = current + suffix;
    }, 25);
  });
}

// ===== Event Listeners =====
function initEventListeners() {
  // New Session
  document.getElementById('btnNewSession').addEventListener('click', createNewSession);

  // Mobile Menu
  const mobileBtn = document.getElementById('mobileMenuBtn');
  mobileBtn.addEventListener('click', () => {
    mobileBtn.classList.toggle('active');
    document.getElementById('sidebar').classList.toggle('open');
  });

  // Expert Filter
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      filterExperts(this.dataset.filter);
    });
  });

  // Expert Card Actions (delegated)
  document.addEventListener('click', function(e) {
    const inviteBtn = e.target.closest('[data-action="invite"]');
    const detailBtn = e.target.closest('[data-action="detail"]');

    if (inviteBtn) {
      e.stopPropagation();
      const card = inviteBtn.closest('.expert-card');
      const expertId = card.dataset.expert;
      inviteExpert(expertId);
    }
    if (detailBtn) {
      e.stopPropagation();
      const card = detailBtn.closest('.expert-card');
      const expertId = card.dataset.expert;
      showExpertDetail(expertId);
    }
  });

  // Creative Input Tips
  document.querySelectorAll('.tip-tag').forEach(tag => {
    tag.addEventListener('click', function() {
      document.querySelectorAll('.tip-tag').forEach(t => t.classList.remove('active'));
      this.classList.add('active');
      document.getElementById('creativeInput').value = this.dataset.tip;
      document.getElementById('creativeInput').focus();
    });
  });

  // Submit Idea
  document.getElementById('btnSubmitIdea').addEventListener('click', submitIdea);

  // Quick Entry Buttons
  document.getElementById('btnAllExperts').addEventListener('click', () => {
    if (!currentSession) createNewSession();
    Object.values(EXPERTS).flat().forEach(e => {
      if (!chatExperts.find(ce => ce.id === e.id)) chatExperts.push(e);
    });
    openChatPanel();
    addSystemMessage('所有 12 位专家已加入圆桌会，请描述你的创作想法。');
    showNotification('12 位专家已全部就位！');
  });
  document.getElementById('btnCreateRound').addEventListener('click', () => { createNewSession(); showNotification('圆桌会已创建，请选择专家或直接输入想法'); });
  document.getElementById('btnViewMaterials').addEventListener('click', () => { document.getElementById('materials').scrollIntoView({ behavior: 'smooth' }); });
  document.getElementById('btnViewExperts').addEventListener('click', () => { document.getElementById('expertSection').scrollIntoView({ behavior: 'smooth' }); });

  // Expert Info Button
  document.getElementById('btnExpertInfo').addEventListener('click', showExpertInfoModal);

  // Settings - use onclick attribute as fallback for reliability
  const btnSettings = document.getElementById('btnSettings');
  if (btnSettings) {
    btnSettings.addEventListener('click', openSettingsModal);
    btnSettings.onclick = openSettingsModal;
  }

  const settingsClose = document.getElementById('settingsClose');
  if (settingsClose) settingsClose.addEventListener('click', closeSettingsModal);

  const btnCancelSettings = document.getElementById('btnCancelSettings');
  if (btnCancelSettings) btnCancelSettings.addEventListener('click', closeSettingsModal);

  const btnSaveSettings = document.getElementById('btnSaveSettings');
  if (btnSaveSettings) btnSaveSettings.addEventListener('click', handleSaveSettings);

  const settingsOverlay = document.getElementById('settingsOverlay');
  if (settingsOverlay) settingsOverlay.addEventListener('click', function(e) { if (e.target === this) closeSettingsModal(); });

  // Platform select change -> update model options & custom URL visibility
  const platformSelect = document.getElementById('platformSelect');
  if (platformSelect) {
    platformSelect.addEventListener('change', function() {
      updateModelOptions(this.value, '');
      const customUrlGroup = document.getElementById('customUrlGroup');
      if (customUrlGroup) {
        customUrlGroup.style.display = this.value === 'openai_compatible' ? 'block' : 'none';
      }
    });
  }

  // Modal
  document.getElementById('modalClose').addEventListener('click', closeModal);
  document.getElementById('modalCancel').addEventListener('click', closeModal);
  document.getElementById('modalOverlay').addEventListener('click', function(e) { if (e.target === this) closeModal(); });
  document.getElementById('modalInvite').addEventListener('click', function() {
    const expertId = this.dataset.expertId;
    if (expertId) inviteExpert(expertId);
    closeModal();
  });

  // Chat Panel
  document.getElementById('chatClose').addEventListener('click', closeChatPanel);
  document.getElementById('btnChatSend').addEventListener('click', sendChatMessage);
  document.getElementById('chatInput').addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage(); }
  });

  // Progress Steps clickable
  document.querySelectorAll('.progress-step').forEach(step => {
    step.addEventListener('click', function() { updateProgressBar(this.dataset.stage); });
  });

  // Tool items
  document.querySelectorAll('.tool-item').forEach(item => {
    item.addEventListener('click', function() {
      const action = this.dataset.action;
      const messages = { upload: '上传功能开发中，敬请期待', mindmap: '思维导图功能开发中', download: '请先完成创作再导出', analyze: '智能分析功能开发中' };
      showNotification(messages[action] || '功能开发中', 'warning');
    });
  });

  // Theme toggle
  document.getElementById('btnTheme').addEventListener('click', toggleTheme);

  // Keyboard shortcut: Escape to close panels
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') { closeModal(); closeSettingsModal(); closeChatPanel(); }
  });
}

// ===== Session Management =====
function createNewSession() {
  const session = {
    id: Date.now(),
    title: `创作会话 ${sessions.length + 1}`,
    createdAt: new Date().toLocaleString('zh-CN'),
    stage: 'ideation'
  };
  sessions.unshift(session);
  currentSession = session;
  chatExperts = [];
  chatMessages = [];
  renderSessions();
  updateProgressBar('ideation');
  showNotification('新的圆桌会已创建！', 'success');
}

function renderSessions() {
  const container = document.getElementById('sessionList');
  if (sessions.length === 0) {
    container.innerHTML = '<div class="session-empty"><p>暂无会话</p><p class="sub">点击上方按钮创建</p></div>';
    return;
  }
  container.innerHTML = sessions.map(session => `
    <div class="session-item ${currentSession && currentSession.id === session.id ? 'active' : ''}" data-id="${session.id}">
      <button class="session-delete" data-id="${session.id}">&times;</button>
      <div class="session-title">${session.title}</div>
      <div class="session-time">${session.createdAt}</div>
    </div>
  `).join('');

  container.querySelectorAll('.session-item').forEach(item => {
    item.addEventListener('click', function(e) {
      if (e.target.classList.contains('session-delete')) return;
      currentSession = sessions.find(s => s.id === parseInt(this.dataset.id));
      renderSessions();
    });
  });
  container.querySelectorAll('.session-delete').forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      sessions = sessions.filter(s => s.id !== parseInt(this.dataset.id));
      if (currentSession && currentSession.id === parseInt(this.dataset.id)) currentSession = sessions[0] || null;
      renderSessions();
    });
  });
}

// ===== Progress Bar =====
function updateProgressBar(stage) {
  const stages = ['ideation', 'outline', 'writing', 'final'];
  const currentIndex = stages.indexOf(stage);
  const steps = document.querySelectorAll('.progress-step');
  const connectors = document.querySelectorAll('.progress-connector');

  steps.forEach((step, index) => {
    step.classList.remove('active', 'completed');
    if (index < currentIndex) step.classList.add('completed');
    else if (index === currentIndex) step.classList.add('active');
  });
  connectors.forEach((conn, index) => {
    conn.classList.remove('completed');
    if (index < currentIndex) conn.classList.add('completed');
  });
  if (currentSession) currentSession.stage = stage;
}

// ===== Expert Filter =====
function filterExperts(filter) {
  document.querySelectorAll('.expert-group').forEach(group => {
    if (filter === 'all') { group.classList.remove('hidden'); }
    else { group.classList.toggle('hidden', group.dataset.group !== filter); }
  });
}

// ===== Expert Detail Modal =====
function showExpertDetail(expertId) {
  const expert = Object.values(EXPERTS).flat().find(e => e.id === expertId);
  if (!expert) return;

  const modal = document.getElementById('modalOverlay');
  const header = document.getElementById('modalHeader');
  const body = document.getElementById('modalBody');

  header.innerHTML = `
    <div class="modal-expert-top">
      <div class="modal-avatar expert-avatar ${expert.color}" style="width:64px;height:64px;border-radius:16px;font-size:28px;">${expert.icon}</div>
      <div class="modal-title"><h2>${expert.name}</h2><p>${expert.subtitle}</p></div>
    </div>
  `;
  body.innerHTML = `
    <h4>专家简介</h4>
    <p class="modal-desc">${expert.desc}</p>
    <h4>核心技能</h4>
    <div class="modal-skills">${expert.skills.map(s => `<span class="modal-skill-tag">${s}</span>`).join('')}</div>
    <h4>常见交付物</h4>
    <div class="modal-deliverables">${expert.deliverables.map(d => `<span class="modal-deliverable">${d}</span>`).join('')}</div>
    <h4>适用场景</h4>
    <p class="modal-desc">${expert.scenario}</p>
  `;
  document.getElementById('modalInvite').dataset.expertId = expertId;
  document.getElementById('modalInvite').style.display = '';
  modal.classList.add('active');
}

function showExpertInfoModal() {
  const modal = document.getElementById('modalOverlay');
  const header = document.getElementById('modalHeader');
  const body = document.getElementById('modalBody');

  header.innerHTML = `
    <div class="modal-expert-top">
      <div class="modal-avatar expert-avatar" style="width:64px;height:64px;border-radius:16px;font-size:28px;background:var(--gradient-1);">👥</div>
      <div class="modal-title"><h2>12 位创作专家一览</h2><p>核心团队 + 类型专家 + 支持团队</p></div>
    </div>
  `;

  const allExperts = Object.values(EXPERTS).flat();
  body.innerHTML = `
    <div class="expert-info-modal">
      <div class="expert-info-grid">
        ${allExperts.map(e => `
          <div class="expert-info-item">
            <div class="ei-icon expert-avatar ${e.color}" style="width:40px;height:40px;border-radius:10px;font-size:20px;">${e.icon}</div>
            <div class="ei-text">
              <h5>${e.name}</h5>
              <p>${e.subtitle}</p>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
  document.getElementById('modalInvite').style.display = 'none';
  modal.classList.add('active');
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('active');
  document.getElementById('modalInvite').style.display = '';
}

// ===== Invite Expert & Chat =====
function inviteExpert(expertId) {
  const expert = Object.values(EXPERTS).flat().find(e => e.id === expertId);
  if (!expert) return;
  if (!currentSession) createNewSession();
  if (!chatExperts.find(e => e.id === expertId)) {
    chatExperts.push(expert);
  }
  openChatPanel();
  addSystemMessage(`${expert.name} 已加入圆桌会！TA 擅长：${expert.skills.join('、')}。请描述你的创作需求。`);
  showNotification(`${expert.name} 已加入圆桌会！`, 'success');
}

function openChatPanel() {
  document.getElementById('chatPanel').classList.add('open');
  renderChatExperts();
  renderChatMessages();
}

function closeChatPanel() {
  document.getElementById('chatPanel').classList.remove('open');
}

function renderChatExperts() {
  const container = document.getElementById('chatExperts');
  container.innerHTML = chatExperts.slice(0, 5).map(e =>
    `<div class="chat-expert-avatar expert-avatar ${e.color}" style="width:28px;height:28px;font-size:14px;border-radius:8px;">${e.icon}</div>`
  ).join('') + (chatExperts.length > 5 ? `<span style="font-size:12px;color:var(--text-muted);">+${chatExperts.length - 5}</span>` : '');
  document.getElementById('chatTitle').textContent = `圆桌讨论 (${chatExperts.length} 位专家)`;
}

function addSystemMessage(text) {
  chatMessages.push({ type: 'system', text, time: new Date() });
  renderChatMessages();
}

function renderChatMessages() {
  const container = document.getElementById('chatMessages');
  if (chatMessages.length === 0) {
    container.innerHTML = `
      <div class="chat-guidance">
        <div class="cg-icon">💬</div>
        <h4>圆桌讨论尚未开始</h4>
        <p>在左侧输入框描述你的创作想法，或从专家列表中邀请一位专家开始讨论。<br>你也可以点击「一键进入 12 位专家讨论」快速开始。</p>
      </div>
    `;
    return;
  }
  container.innerHTML = chatMessages.map(msg => {
    if (msg.type === 'system') {
      return `<div class="chat-message"><div class="msg-avatar expert-avatar" style="width:36px;height:36px;font-size:16px;background:var(--gradient-3);">⚡</div><div class="msg-content"><div class="msg-name">系统</div><div class="msg-text">${msg.text}</div></div></div>`;
    } else if (msg.type === 'user') {
      return `<div class="chat-message user"><div class="msg-avatar expert-avatar" style="width:36px;height:36px;font-size:16px;background:var(--gradient-2);">👤</div><div class="msg-content"><div class="msg-name">你</div><div class="msg-text">${msg.text}</div></div></div>`;
    } else if (msg.type === 'progress') {
      return `<div class="chat-message progress-panel">
        <div class="msg-avatar expert-avatar" style="width:36px;height:36px;font-size:16px;background:var(--gradient-1);">⏳</div>
        <div class="msg-content">
          <div class="msg-name">实时进度</div>
          <div class="expert-progress-grid">
            ${msg.experts.map(e => `
              <div class="expert-progress-item ${e.status}">
                <span class="ep-emoji">${e.emoji}</span>
                <span class="ep-name">${e.role}</span>
                <span class="ep-status">${e.status === 'pending' ? '⏳' : e.status === 'done' ? '✅' : '❌'}</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>`;
    } else {
      return `<div class="chat-message"><div class="msg-avatar expert-avatar ${msg.expert.color}" style="width:36px;height:36px;font-size:16px;">${msg.expert.icon}</div><div class="msg-content"><div class="msg-name">${msg.expert.name}</div><div class="msg-text">${msg.text}</div></div></div>`;
    }
  }).join('');
  container.scrollTop = container.scrollHeight;
}

function sendChatMessage() {
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text) return;

  chatMessages.push({ type: 'user', text, time: new Date() });
  input.value = '';
  renderChatMessages();

  callRoundtableAI(text);
}

// ===== Submit Creative Idea =====
function submitIdea() {
  const input = document.getElementById('creativeInput');
  const text = input.value.trim();
  if (!text) { showNotification('请先输入你的创作想法', 'warning'); return; }

  if (!currentSession) createNewSession();
  openChatPanel();

  chatMessages.push({ type: 'user', text, time: new Date() });
  renderChatMessages();

  callRoundtableAI(text);
  showNotification('已提交创作想法，专家团队正在分析...', 'success');
}

// ===== Theme Toggle =====
function toggleTheme() {
  const btn = document.getElementById('btnTheme');
  document.body.classList.toggle('light-theme');
  btn.innerHTML = document.body.classList.contains('light-theme') ? '☀' : '🌙';
}

// ===== Notifications =====
function showNotification(message, type = 'info') {
  const container = document.getElementById('notificationContainer');
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  container.appendChild(notification);

  setTimeout(() => {
    notification.classList.add('exit');
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}
