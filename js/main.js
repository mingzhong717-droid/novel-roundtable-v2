// ===== NovelRoundTable - Complete Interactive JavaScript =====

// ===== Data: Expert Definitions =====
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
    // Draw connections
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
        // Trigger number animations for stat elements within
        animateNumbers(entry.target);
      }
    });
  }, { threshold: 0.15 });

  document.querySelectorAll('.scroll-reveal').forEach(el => observer.observe(el));
}

// ===== Number Animations =====
function initNumberAnimations() {
  // Will be triggered by scroll reveal
}

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
    if (e.key === 'Escape') { closeModal(); closeChatPanel(); }
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
  modal.classList.add('active');
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('active');
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
  container.innerHTML = chatMessages.map(msg => {
    if (msg.type === 'system') {
      return `<div class="chat-message"><div class="msg-avatar expert-avatar" style="width:36px;height:36px;font-size:16px;background:var(--gradient-3);">&#9889;</div><div class="msg-content"><div class="msg-name">系统</div><div class="msg-text">${msg.text}</div></div></div>`;
    } else if (msg.type === 'user') {
      return `<div class="chat-message user"><div class="msg-avatar expert-avatar" style="width:36px;height:36px;font-size:16px;background:var(--gradient-2);">&#128100;</div><div class="msg-content"><div class="msg-name">你</div><div class="msg-text">${msg.text}</div></div></div>`;
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

  // Simulate expert responses
  if (chatExperts.length > 0) {
    setTimeout(() => {
      const expert = chatExperts[Math.floor(Math.random() * chatExperts.length)];
      const responses = generateExpertResponse(expert, text);
      chatMessages.push({ type: 'expert', expert, text: responses, time: new Date() });
      renderChatMessages();
    }, 800 + Math.random() * 1200);
  }
}

function generateExpertResponse(expert, userText) {
  const responses = {
    architect: ['从你的描述来看，核心冲突可以围绕"身份认知"展开。建议采用三幕结构：第一幕建立日常与悬念，第二幕逐步揭示真相，第三幕面对抉择。', '这个故事的结构可以用"洋葱式"叙事——每揭开一层，都有新的悬念。建议设置3-4个关键转折点。', '情节节奏建议：前5章快速建立悬念，中间部分交替推进主线和支线，高潮前设置一个"虚假胜利"增加反转力度。'],
    character: ['主角的性格弧光可以设计为：从"逃避过去"到"直面真相"。建议给TA一个标志性的习惯动作来体现内心状态。', '建议为主角设计一个"致命缺陷"和一个"隐藏优势"，这样角色成长才有说服力。', '配角建议设置一个"镜像角色"——和主角有相似经历但做出不同选择的人，形成对照。'],
    worldbuilder: ['这个世界的规则体系需要先确定：什么是可能的，什么是不可能的。建议从"限制"入手设计，有限制才有戏剧性。', '建议先画一张简单的势力关系图，确定各方的利益诉求和冲突点。', '世界观设定的关键是"冰山理论"——展示给读者的只是十分之一，但你需要知道水面下的全部。'],
    stylist: ['根据故事类型，建议采用"冷峻克制"的叙事风格，用短句营造紧张感，长句用于情感释放的关键时刻。', '氛围营造建议：多用感官描写（声音、气味、触感），少用直接的情绪词汇，让读者自己感受。', '视角建议用限制性第一人称，这样读者和主角一起发现真相，悬疑感更强。'],
    dialogue: ['建议给主角设计一个语言特征：比如习惯用反问句，或者在紧张时会重复对方的话。这让角色更鲜活。', '对话节奏建议：重要信息用短对话快速推进，情感场景用长对话慢慢铺垫，沉默也是一种对话。', '群戏对话的关键是让每个人都有"说话的理由"，避免角色沦为信息传递工具。'],
    xianxia: ['修炼体系建议设计9个大境界，每个境界3个小阶段。关键是每个境界突破都要有"质变"而非单纯的量变。', '升级节奏建议：前期快速升级建立爽感，中期放慢节奏深化世界观，后期每次突破都是大事件。'],
    romance: ['感情线建议用"三进三退"节奏：每次靠近后都有一个合理的阻碍，让读者既着急又期待。', '建议设计3个"名场面"作为感情线的里程碑，这些场景要有强烈的画面感和情感冲击力。'],
    mystery: ['核心诡计建议采用"双重误导"：第一层误导让读者怀疑A，第二层误导让读者确信B，真相是C。', '线索布置建议遵循"三次法则"：重要线索至少出现三次，但每次以不同形式呈现。'],
    scifi: ['科技设定建议从一个"核心假设"出发推演：如果X技术实现了，社会会发生什么变化？', '建议设计一个"技术代价"——每项强大的技术都有其副作用或社会成本，这让设定更真实。'],
    market: ['当前市场热门方向：都市异能+悬疑、古代宫廷+权谋、末世生存+团队。建议结合你的优势选择。', '目标读者画像建议先确定：年龄段、阅读平台、付费意愿。这决定了你的写作策略。'],
    logic: ['建议建立一个"设定检查表"：每写完一章，对照检查时间线、角色位置、已知信息是否一致。', '常见逻辑漏洞：角色突然知道不该知道的信息、时间线矛盾、设定前后不一致。建议每5章做一次自查。'],
    editor: ['整体节奏建议：开头3章必须抓住读者，中间保持"每章一个小钩子"，结尾要有余韵。', '建议控制章节长度在2000-3000字，每章结尾留一个悬念或情感钩子，提高读者续读率。']
  };
  const expertResponses = responses[expert.id] || ['收到你的想法，让我从专业角度分析一下...'];
  return expertResponses[Math.floor(Math.random() * expertResponses.length)];
}

// ===== Submit Creative Idea =====
function submitIdea() {
  const input = document.getElementById('creativeInput');
  const text = input.value.trim();
  if (!text) { showNotification('请先输入你的创作想法', 'warning'); return; }
  
  if (!currentSession) createNewSession();
  
  // Auto-recommend experts based on keywords
  const keywords = {
    architect: ['情节', '故事', '结构', '大纲', '冲突', '转折'],
    character: ['人物', '角色', '主角', '性格', '人设'],
    worldbuilder: ['世界', '设定', '规则', '体系', '背景'],
    stylist: ['文笔', '风格', '语言', '描写', '润色'],
    dialogue: ['对话', '台词', '对白', '说话'],
    xianxia: ['仙侠', '玄幻', '修炼', '修仙', '境界', '宗门'],
    romance: ['言情', '爱情', '恋爱', '甜宠', '虐恋', '感情'],
    mystery: ['悬疑', '推理', '谜题', '凶手', '线索', '案件'],
    scifi: ['科幻', '未来', '太空', '机器人', 'AI', '科技'],
    market: ['市场', '热门', '趋势', '读者'],
    logic: ['逻辑', '漏洞', 'bug', '矛盾'],
    editor: ['节奏', '出版', '定稿', '修改']
  };

  let recommended = [];
  Object.entries(keywords).forEach(([expertId, words]) => {
    if (words.some(w => text.includes(w))) {
      const expert = Object.values(EXPERTS).flat().find(e => e.id === expertId);
      if (expert && !recommended.find(r => r.id === expertId)) recommended.push(expert);
    }
  });

  // Default: recommend architect + one genre expert
  if (recommended.length === 0) {
    recommended = [EXPERTS.core[0], EXPERTS.support[0]];
  }

  chatExperts = recommended.slice(0, 4);
  openChatPanel();
  
  const expertNames = chatExperts.map(e => e.name).join('、');
  addSystemMessage(`根据你的创作想法，已为你推荐：${expertNames}。他们将为你提供专业建议。`);
  
  // Add user message
  chatMessages.push({ type: 'user', text, time: new Date() });
  renderChatMessages();

  // Simulate expert responses
  chatExperts.forEach((expert, index) => {
    setTimeout(() => {
      const response = generateExpertResponse(expert, text);
      chatMessages.push({ type: 'expert', expert, text: response, time: new Date() });
      renderChatMessages();
    }, 1000 + index * 1500);
  });

  showNotification(`已匹配 ${chatExperts.length} 位专家，圆桌讨论开始！`, 'success');
}

// ===== Theme Toggle =====
function toggleTheme() {
  const btn = document.getElementById('btnTheme');
  document.body.classList.toggle('light-theme');
  btn.textContent = document.body.classList.contains('light-theme') ? '\u2600' : '\uD83C\uDF19';
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
