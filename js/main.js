// ===== NovelRoundTable - Main JavaScript =====

// Session Management
let sessions = [];
let currentSession = null;

function createNewSession() {
  const session = {
    id: Date.now(),
    title: '新的创作会话',
    createdAt: new Date().toLocaleString('zh-CN'),
    stage: 'ideation'
  };
  sessions.unshift(session);
  currentSession = session;
  renderSessions();
  updateProgressBar('ideation');
}

function renderSessions() {
  const container = document.querySelector('.sidebar-sessions');
  if (sessions.length === 0) {
    container.innerHTML = '<div class="session-empty"><p>暂无会话</p><p style="margin-top:8px; font-size:12px;">点击上方按钮创建</p></div>';
    return;
  }
  
  container.innerHTML = sessions.map(session => `
    <div class="session-item" onclick="selectSession(${session.id})" style="
      padding: 12px 16px;
      border-radius: 8px;
      cursor: pointer;
      margin-bottom: 4px;
      background: ${currentSession && currentSession.id === session.id ? 'rgba(108, 92, 231, 0.15)' : 'transparent'};
      border: 1px solid ${currentSession && currentSession.id === session.id ? 'var(--border)' : 'transparent'};
      transition: all 0.2s ease;
    ">
      <div style="font-size: 13px; font-weight: 500; color: var(--text-primary); margin-bottom: 4px;">
        ${session.title}
      </div>
      <div style="font-size: 11px; color: var(--text-muted);">
        ${session.createdAt}
      </div>
    </div>
  `).join('');
}

function selectSession(id) {
  currentSession = sessions.find(s => s.id === id);
  renderSessions();
}

// Progress Bar
function updateProgressBar(stage) {
  const stages = ['ideation', 'outline', 'writing', 'final'];
  const stageNames = ['构思', '大纲', '创作', '完稿'];
  const steps = document.querySelectorAll('.progress-step');
  const connectors = document.querySelectorAll('.progress-connector');
  const currentIndex = stages.indexOf(stage);
  
  steps.forEach((step, index) => {
    step.classList.remove('active', 'completed');
    if (index < currentIndex) {
      step.classList.add('completed');
    } else if (index === currentIndex) {
      step.classList.add('active');
    }
  });
  
  connectors.forEach((connector, index) => {
    connector.classList.remove('completed');
    if (index < currentIndex) {
      connector.classList.add('completed');
    }
  });
}

// Expert Card Interactions
document.addEventListener('DOMContentLoaded', function() {
  // Expert card hover effects
  const expertCards = document.querySelectorAll('.expert-card');
  expertCards.forEach(card => {
    card.addEventListener('mouseenter', function() {
      this.style.transform = 'translateY(-4px)';
    });
    card.addEventListener('mouseleave', function() {
      this.style.transform = '';
    });
  });

  // Material tab switching
  const materialTabs = document.querySelectorAll('.material-tab');
  materialTabs.forEach(tab => {
    tab.addEventListener('click', function() {
      materialTabs.forEach(t => t.classList.remove('active'));
      this.classList.add('active');
    });
  });

  // Smooth scroll for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // Entry button click handlers
  const entryButtons = document.querySelectorAll('.btn-entry');
  entryButtons.forEach(btn => {
    btn.addEventListener('click', function() {
      if (!currentSession) {
        createNewSession();
      }
      // Add visual feedback
      this.style.transform = 'scale(0.95)';
      setTimeout(() => {
        this.style.transform = '';
      }, 150);
    });
  });

  // "Let TA intervene" button handlers
  const interventionBtns = document.querySelectorAll('.btn-sm.primary');
  interventionBtns.forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      if (!currentSession) {
        createNewSession();
      }
      const expertName = this.closest('.expert-card').querySelector('h4').textContent;
      showNotification(`${expertName} 已加入圆桌会`);
    });
  });

  // Animate stats on scroll
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        animateNumbers(entry.target);
      }
    });
  }, { threshold: 0.3 });

  document.querySelectorAll('.hero-stats, .capability-grid').forEach(el => {
    observer.observe(el);
  });

  // Mobile sidebar toggle
  const topBarTitle = document.querySelector('.top-bar-title');
  if (topBarTitle) {
    topBarTitle.addEventListener('click', function() {
      const sidebar = document.getElementById('sidebar');
      sidebar.classList.toggle('open');
    });
  }
});

// Number animation
function animateNumbers(container) {
  const numbers = container.querySelectorAll('.stat-number, .cap-number');
  numbers.forEach(numEl => {
    const text = numEl.textContent;
    const match = text.match(/(\d+)/);
    if (match) {
      const target = parseInt(match[1]);
      const suffix = text.replace(match[1], '');
      let current = 0;
      const increment = Math.ceil(target / 30);
      const timer = setInterval(() => {
        current += increment;
        if (current >= target) {
          current = target;
          clearInterval(timer);
        }
        numEl.textContent = current + suffix;
      }, 30);
    }
  });
}

// Notification system
function showNotification(message) {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 16px 24px;
    background: linear-gradient(135deg, #6c5ce7, #a29bfe);
    color: white;
    border-radius: 12px;
    font-size: 14px;
    font-weight: 500;
    z-index: 10000;
    animation: slideIn 0.3s ease;
    box-shadow: 0 8px 30px rgba(108, 92, 231, 0.4);
  `;
  notification.textContent = message;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease forwards';
    setTimeout(() => notification.remove(), 300);
  }, 2500);
}

// Add animation keyframes
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from { transform: translateX(100px); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  @keyframes slideOut {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(100px); opacity: 0; }
  }
`;
document.head.appendChild(style);
