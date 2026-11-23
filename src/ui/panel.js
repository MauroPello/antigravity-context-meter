/**
 * Antigravity Context Meter - 前端交互与数据渲染逻辑 (Stage 2)
 */

// 兼容 VS Code Webview 通信机制
const vscode = typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : null;

// 格式化函数
function formatTokens(num) {
  if (!num) return '0';
  if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  return num.toLocaleString();
}

let currentSnapshot = null;

/**
 * 核心渲染函数：更新整个面板状态
 */
function renderSnapshot(snapshot) {
  if (!snapshot) return;
  currentSnapshot = snapshot;

  // 1. Header info
  document.getElementById('model-badge').innerText = snapshot.modelDisplayName || snapshot.modelName || 'Gemini Flash';
  const turns = snapshot.turnCount || 0;
  document.getElementById('turn-badge').innerText = `${turns} ${turns === 1 ? 'turn' : 'turns'}`;

  // 2. 核心百分比与总数
  const percentEl = document.getElementById('percent-val');
  percentEl.innerText = snapshot.percentage.toFixed(1);
  percentEl.className = `health-${snapshot.healthLevel}`;

  document.getElementById('used-tokens').innerText = formatTokens(snapshot.usedTokens);
  document.getElementById('max-tokens').innerText = formatTokens(snapshot.maxTokens);

  // 3. 计算多色分段条百分比 (以 maxTokens 为 100% 基准)
  const max = snapshot.maxTokens || 1000000;
  const b = snapshot.breakdown || {
    systemRulesTokens: 0,
    skillsMcpTokens: 0,
    messagesTokens: 0,
    toolOutputsTokens: 0,
    metadataTokens: 0,
  };

  const pRules = (b.systemRulesTokens / max) * 100;
  const pMcp = (b.skillsMcpTokens / max) * 100;
  const pMsg = (b.messagesTokens / max) * 100;
  const pOut = (b.toolOutputsTokens / max) * 100;
  const pMeta = (b.metadataTokens / max) * 100;

  document.getElementById('seg-rules').style.width = `${pRules}%`;
  document.getElementById('seg-mcp').style.width = `${pMcp}%`;
  document.getElementById('seg-messages').style.width = `${pMsg}%`;
  document.getElementById('seg-outputs').style.width = `${pOut}%`;
  document.getElementById('seg-meta').style.width = `${pMeta}%`;

  // 4. 明细图例更新
  document.getElementById('val-rules').innerText = formatTokens(b.systemRulesTokens);
  document.getElementById('val-mcp').innerText = formatTokens(b.skillsMcpTokens);
  document.getElementById('val-messages').innerText = formatTokens(b.messagesTokens);
  document.getElementById('val-outputs').innerText = formatTokens(b.toolOutputsTokens);

  // 5. Top 消耗列表渲染
  const topListEl = document.getElementById('top-consumers-list');
  if (!snapshot.topConsumers || snapshot.topConsumers.length === 0) {
    topListEl.innerHTML = `
      <div class="ag-top-item" style="color: var(--text-muted); justify-content: center;">
        No large files or long outputs in this session yet
      </div>
    `;
  } else {
    topListEl.innerHTML = snapshot.topConsumers
      .map((item, idx) => `
        <div class="ag-top-item">
          <span class="ag-top-name" title="${item.name}">${idx + 1}. ${item.name}</span>
          <span class="ag-top-tokens">${formatTokens(item.tokens)} (${item.percentage}%)</span>
        </div>
      `)
      .join('');
  }
}

// 提示 Toast 动效
function showToast(msg) {
  const toast = document.getElementById('ag-toast');
  toast.innerText = msg;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 2200);
}

// Bind 1-click migration prompt button
document.getElementById('btn-migrate').addEventListener('click', () => {
  if (vscode) {
    vscode.postMessage({ command: 'requestMigrationPrompt' });
  } else if (currentSnapshot && currentSnapshot.migrationPrompt) {
    navigator.clipboard.writeText(currentSnapshot.migrationPrompt).then(() => {
      showToast('Migration prompt copied to clipboard!');
    });
  } else {
    // Fallback
    const defaultSummary = `# Context Migration Prompt

> Automatically distilled by Antigravity Context Meter.

## 🎯 Core Objectives
Continue implementing the core features and architecture in the current workspace.

## 🚀 Next Steps
Please review the current workspace code, skip re-explaining the architecture, and seamlessly continue with the next concrete task.
`;
    navigator.clipboard.writeText(defaultSummary).then(() => {
      showToast('Migration prompt copied to clipboard!');
    });
  }
});

// Listen for real-time updates from VS Code extension or WebSocket
window.addEventListener('message', (event) => {
  const message = event.data;
  if (message.type === 'UPDATE_SNAPSHOT') {
    renderSnapshot(message.payload);
  } else if (message.type === 'MIGRATION_PROMPT_READY') {
    navigator.clipboard.writeText(message.payload).then(() => {
      showToast('Migration prompt copied to clipboard!');
    });
  }
});
