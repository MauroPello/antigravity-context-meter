"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/desktop/server.ts
var http = __toESM(require("http"));
var fs2 = __toESM(require("fs"));
var path2 = __toESM(require("path"));

// src/core/log-watcher.ts
var fs = __toESM(require("fs"));
var path = __toESM(require("path"));
var os = __toESM(require("os"));

// src/core/tokenizer.ts
var FastTokenizer = class {
  /**
   * 估算任意文本的 Token 数量
   * 采用中英文混合加权 + 代码符号精确加权算法（对齐 Gemini / BPE Tokenizer 精度）
   */
  static countTokens(text) {
    if (!text || typeof text !== "string")
      return 0;
    const len = text.length;
    if (len === 0)
      return 0;
    let cjkCount = 0;
    let asciiWords = 0;
    let codeSymbols = 0;
    let whitespaceCount = 0;
    for (let i = 0; i < len; i++) {
      const code = text.charCodeAt(i);
      if (code >= 19968 && code <= 40959 || code >= 13312 && code <= 19903 || code >= 63744 && code <= 64255) {
        cjkCount++;
      } else if (code <= 32) {
        whitespaceCount++;
      } else if (code >= 48 && code <= 57 || // 数字 0-9
      code >= 65 && code <= 90 || // 大写 A-Z
      code >= 97 && code <= 122 || // 小写 a-z
      code === 95) {
        asciiWords++;
      } else {
        codeSymbols++;
      }
    }
    const estimated = cjkCount * 1.35 + asciiWords * 0.28 + codeSymbols * 0.65 + whitespaceCount * 0.2;
    return Math.max(1, Math.round(estimated));
  }
  /**
   * 格式化 Token 数字为人类可读格式 (e.g. 28.8K, 1.2M, 950)
   */
  static formatTokenCount(tokens) {
    if (tokens >= 1e6) {
      return (tokens / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
    }
    if (tokens >= 1e3) {
      return (tokens / 1e3).toFixed(1).replace(/\.0$/, "") + "K";
    }
    return tokens.toString();
  }
};

// types/context.ts
var BUILTIN_MODEL_SPECS = [
  {
    namePattern: /gemini.*flash/i,
    displayName: "Gemini Flash (1M)",
    maxTokens: 1048576,
    warningThreshold: 0.75,
    criticalThreshold: 0.85
  },
  {
    namePattern: /gemini.*pro/i,
    displayName: "Gemini Pro (2M)",
    maxTokens: 2097152,
    warningThreshold: 0.75,
    criticalThreshold: 0.85
  },
  {
    namePattern: /claude/i,
    displayName: "Claude 3.5/3.7 (200K)",
    maxTokens: 2e5,
    warningThreshold: 0.75,
    criticalThreshold: 0.85
  },
  {
    namePattern: /gpt-4o|o1|o3/i,
    displayName: "OpenAI GPT-4o (128K)",
    maxTokens: 128e3,
    warningThreshold: 0.75,
    criticalThreshold: 0.85
  },
  {
    namePattern: /deepseek/i,
    displayName: "DeepSeek V3/R1 (128K)",
    maxTokens: 128e3,
    warningThreshold: 0.75,
    criticalThreshold: 0.85
  }
];
var DEFAULT_MODEL_SPEC = {
  namePattern: /.*/,
  displayName: "Standard Model (128K)",
  maxTokens: 128e3,
  warningThreshold: 0.75,
  criticalThreshold: 0.85
};

// src/core/model-detector.ts
var ModelDetector = class {
  /**
   * 根据模型名称字符串匹配对应的规格
   */
  static detectSpec(modelName) {
    if (!modelName || typeof modelName !== "string") {
      return DEFAULT_MODEL_SPEC;
    }
    const cleanedName = modelName.trim();
    for (const spec of BUILTIN_MODEL_SPECS) {
      if (spec.namePattern.test(cleanedName)) {
        return spec;
      }
    }
    return {
      ...DEFAULT_MODEL_SPEC,
      displayName: cleanedName
    };
  }
  /**
   * 计算健康度级别 (Optimal / Moderate / Warning / Critical)
   */
  static calculateHealth(percentage, spec) {
    if (percentage >= spec.criticalThreshold) {
      return "critical";
    }
    if (percentage >= spec.warningThreshold) {
      return "warning";
    }
    if (percentage >= 0.5) {
      return "moderate";
    }
    return "optimal";
  }
};

// src/core/top-consumers.ts
var TopConsumersAnalyzer = class {
  /**
   * 从提取的事件列表中筛选并计算出占用最多的前 N 项操作
   */
  static extractTopConsumers(rawEvents, totalTokens, limit = 5) {
    const scoredList = [];
    for (const ev of rawEvents) {
      const tokens = FastTokenizer.countTokens(ev.rawContent);
      if (tokens < 30)
        continue;
      const percentage = totalTokens > 0 ? tokens / totalTokens * 100 : 0;
      let displayName = ev.name;
      let details = "";
      if (ev.type === "tool_output") {
        if (ev.name.includes("view_file")) {
          displayName = `\u{1F4C4} View File (${ev.name.split(":")[1]?.trim() || "file"})`;
        } else if (ev.name.includes("run_command")) {
          displayName = `\u{1F5A5}\uFE0F Command Output (${ev.name.split(":")[1]?.trim() || "command"})`;
        } else if (ev.name.includes("grep_search") || ev.name.includes("list_dir")) {
          displayName = `\u{1F50D} Search Result (${ev.name})`;
        } else {
          displayName = `\u2699\uFE0F Tool Output: ${ev.name}`;
        }
        details = ev.rawContent.slice(0, 150).replace(/\s+/g, " ");
      } else if (ev.type === "system_rules") {
        displayName = `\u{1F3DB}\uFE0F System Rules & Skills (${ev.name})`;
        details = "System prompt, GEMINI.md, and built-in agent instructions";
      } else if (ev.type === "mcp_schema") {
        displayName = `\u{1F50C} MCP Tool Schema (${ev.name})`;
        details = "Registered external MCP tool definitions";
      } else if (ev.type === "user_input") {
        displayName = `\u{1F4AC} User Input (Step #${ev.stepIndex})`;
        details = ev.rawContent.slice(0, 150).replace(/\s+/g, " ");
      }
      scoredList.push({
        id: ev.id,
        stepIndex: ev.stepIndex,
        type: ev.type,
        name: displayName,
        details,
        tokens,
        percentage: Math.round(percentage * 10) / 10,
        timestamp: ev.timestamp
      });
    }
    scoredList.sort((a, b) => b.tokens - a.tokens);
    return scoredList.slice(0, limit);
  }
};

// src/core/summarizer.ts
var ContextSummarizer = class {
  /**
   * 基于会话中的关键信息提炼结构化迁移 Prompt
   */
  static generateMigrationPrompt(params) {
    const { projectName, modelName, totalTokens, userObjectives, modifiedFiles, recentDecisions } = params;
    const prompt = `# Context Migration Prompt

> Automatically distilled by **Antigravity Context Meter**.
> **Previous Session Usage**: ~${totalTokens} Tokens | **Model**: ${modelName}

---

## \u{1F3AF} Core Objectives & Background
${userObjectives.length > 0 ? userObjectives.map((obj, i) => `${i + 1}. ${obj}`).join("\n") : "1. Continue working on the core features and architecture of the current project."}

## \u{1F4DD} Key Technical Decisions & Design
${recentDecisions.length > 0 ? recentDecisions.map((dec) => `- ${dec}`).join("\n") : "- Core architecture and staged development plan are established."}

## \u{1F4C1} Relevant Files & Code Assets
${modifiedFiles.length > 0 ? modifiedFiles.map((f) => `- \`${f}\``).join("\n") : "- Continue directly from the current workspace files."}

## \u{1F680} Next Steps
Please review the context above and the current workspace, skip re-explaining the architecture, and seamlessly continue with the next concrete task.
`;
    return prompt;
  }
};

// src/core/log-watcher.ts
var LogWatcher = class {
  baseDirs;
  selectedConversationId = null;
  // null 表示自动跟随最新
  currentConversationId = null;
  currentLogFilePath = null;
  fsWatcher = null;
  onUpdateCallback = null;
  isScanning = false;
  constructor() {
    const home = os.homedir();
    this.baseDirs = [
      {
        path: path.join(home, ".gemini", "antigravity", "brain"),
        source: "desktop",
        label: "Desktop"
      },
      {
        path: path.join(home, ".gemini", "antigravity-ide", "brain"),
        source: "ide",
        label: "IDE"
      }
    ];
  }
  /**
   * 设置锁定的会话 ID (或设为 null / 'auto' 恢复自动跟随)
   */
  setSelectedConversation(convId) {
    this.selectedConversationId = convId === "auto" ? null : convId;
    this.pollAndWatch(true);
  }
  /**
   * 列出本机近期所有可用会话（带标题、时间与所属端类型）
   */
  listRecentConversations(limit = 15) {
    const items = [];
    for (const base of this.baseDirs) {
      if (!fs.existsSync(base.path))
        continue;
      try {
        const dirs = fs.readdirSync(base.path);
        for (const dir of dirs) {
          const fullPath = path.join(base.path, dir);
          try {
            const stat = fs.statSync(fullPath);
            if (!stat.isDirectory())
              continue;
            const logPath = path.join(fullPath, ".system_generated", "logs", "transcript.jsonl");
            if (fs.existsSync(logPath)) {
              const logStat = fs.statSync(logPath);
              const title = this.extractTitleFromLog(logPath);
              items.push({
                id: dir,
                source: base.source,
                sourceLabel: base.label,
                title: title || `Session ${dir.slice(0, 8)}`,
                lastModified: logStat.mtimeMs,
                lastUpdatedStr: new Date(logStat.mtimeMs).toLocaleTimeString(),
                logPath
              });
            }
          } catch {
          }
        }
      } catch {
      }
    }
    items.sort((a, b) => b.lastModified - a.lastModified);
    return items.slice(0, limit);
  }
  /**
   * 从日志第一行提取会话标题 / 需求简要
   */
  extractTitleFromLog(logPath) {
    try {
      const content = fs.readFileSync(logPath, "utf8");
      const lines = content.split("\n");
      for (const line of lines) {
        if (!line.trim())
          continue;
        try {
          const entry = JSON.parse(line);
          if (entry.type === "USER_INPUT") {
            let text = typeof entry.content === "string" ? entry.content : "";
            if (text.includes("<USER_REQUEST>")) {
              text = text.split("<USER_REQUEST>")[1].split("</USER_REQUEST>")[0];
            }
            const clean = text.replace(/<.*?>/g, "").replace(/#+\s*/g, "").trim();
            const firstLine = clean.split("\n")[0].trim();
            if (firstLine.length > 0) {
              return firstLine.slice(0, 36) + (firstLine.length > 36 ? "..." : "");
            }
          }
        } catch {
        }
      }
    } catch {
    }
    return "Untitled Session";
  }
  /**
   * 探测当前应聚焦的目标会话
   */
  findTargetConversation() {
    const list = this.listRecentConversations(20);
    if (list.length === 0)
      return null;
    if (this.selectedConversationId) {
      const match = list.find((c) => c.id === this.selectedConversationId);
      if (match) {
        return {
          id: match.id,
          logPath: match.logPath,
          dirPath: path.dirname(path.dirname(path.dirname(match.logPath))),
          source: match.source
        };
      }
    }
    const latest = list[0];
    return {
      id: latest.id,
      logPath: latest.logPath,
      dirPath: path.dirname(path.dirname(path.dirname(latest.logPath))),
      source: latest.source
    };
  }
  findLatestConversation() {
    return this.findTargetConversation();
  }
  /**
   * 解析指定的 transcript.jsonl 并生成快照
   */
  parseTranscriptFile(logPath, convId, source = "desktop") {
    if (!fs.existsSync(logPath))
      return null;
    const startTime = Date.now();
    let content = "";
    try {
      content = fs.readFileSync(logPath, "utf8");
    } catch {
      return null;
    }
    const lines = content.split("\n");
    let modelName = "Gemini 3.7 Flash";
    let turnCount = 0;
    let convTitle = "";
    let systemRulesTokens = 0;
    let skillsMcpTokens = 0;
    let messagesTokens = 0;
    let toolOutputsTokens = 0;
    let metadataTokens = 0;
    const rawEvents = [];
    systemRulesTokens += 6200;
    const userObjectives = [];
    const modifiedFilesSet = /* @__PURE__ */ new Set();
    for (const line of lines) {
      if (!line.trim())
        continue;
      try {
        const entry = JSON.parse(line);
        const stepIndex = entry.step_index ?? turnCount;
        const time = entry.created_at || (/* @__PURE__ */ new Date()).toISOString();
        const type = entry.type;
        const contentStr = typeof entry.content === "string" ? entry.content : "";
        if (contentStr.includes("<USER_SETTINGS_CHANGE>")) {
          const match = contentStr.match(/Model Selection` from (?:None|.*?) to (.*?)\.(?:\s+No need|\n|$)/);
          if (match && match[1]) {
            modelName = match[1].trim();
          }
        }
        if (type === "USER_INPUT") {
          turnCount++;
          const t = FastTokenizer.countTokens(contentStr);
          messagesTokens += t;
          rawEvents.push({
            id: `user_${stepIndex}`,
            stepIndex,
            type: "user_input",
            name: `User Prompt (Turn #${turnCount})`,
            rawContent: contentStr,
            timestamp: time
          });
          let cleanUserText = contentStr;
          if (cleanUserText.includes("<USER_REQUEST>")) {
            cleanUserText = cleanUserText.split("<USER_REQUEST>")[1].split("</USER_REQUEST>")[0];
          }
          cleanUserText = cleanUserText.replace(/<.*?>/g, "").replace(/#+\s*/g, "").trim();
          if (cleanUserText) {
            const firstLine = cleanUserText.split("\n")[0].trim();
            if (!convTitle)
              convTitle = firstLine.slice(0, 36);
            if (firstLine && firstLine.length > 2 && !userObjectives.includes(firstLine)) {
              userObjectives.push(firstLine);
            }
          }
        } else if (type === "PLANNER_RESPONSE") {
          const t = FastTokenizer.countTokens(contentStr);
          messagesTokens += t;
          if (Array.isArray(entry.tool_calls)) {
            for (const call of entry.tool_calls) {
              const callStr = JSON.stringify(call);
              const ct = FastTokenizer.countTokens(callStr);
              skillsMcpTokens += ct;
              if (call.args) {
                const target = call.args.TargetFile || call.args.AbsolutePath;
                if (typeof target === "string" && target.length > 0) {
                  modifiedFilesSet.add(path.basename(target.replace(/"/g, "")));
                }
              }
            }
          }
        } else if (type === "VIEW_FILE" || type === "RUN_COMMAND" || type === "LIST_DIRECTORY" || type === "GREP_SEARCH" || type === "TOOL_RESULT" || type === "GENERIC") {
          const t = FastTokenizer.countTokens(contentStr);
          toolOutputsTokens += t;
          rawEvents.push({
            id: `tool_${stepIndex}`,
            stepIndex,
            type: "tool_output",
            name: `${type}`,
            rawContent: contentStr,
            timestamp: time
          });
        } else if (type === "CONVERSATION_HISTORY" || type === "CHECKPOINT") {
          metadataTokens += FastTokenizer.countTokens(contentStr);
        }
      } catch {
      }
    }
    const totalUsed = systemRulesTokens + skillsMcpTokens + messagesTokens + toolOutputsTokens + metadataTokens;
    const spec = ModelDetector.detectSpec(modelName);
    const percentage = Math.min(100, Math.round(totalUsed / spec.maxTokens * 1e3) / 10);
    const healthLevel = ModelDetector.calculateHealth(percentage / 100, spec);
    const breakdown = {
      systemRulesTokens,
      skillsMcpTokens,
      messagesTokens,
      toolOutputsTokens,
      metadataTokens
    };
    const topConsumers = TopConsumersAnalyzer.extractTopConsumers(rawEvents, totalUsed, 5);
    const modifiedFiles = Array.from(modifiedFilesSet).slice(-8);
    const recentObjectives = userObjectives.slice(-3);
    const migrationPrompt = ContextSummarizer.generateMigrationPrompt({
      projectName: convTitle || "Current Project",
      modelName: spec.displayName,
      totalTokens: FastTokenizer.formatTokenCount(totalUsed),
      userObjectives: recentObjectives,
      modifiedFiles,
      recentDecisions: [
        `Session has ${turnCount} turn(s), using ${percentage}% of context capacity`,
        `Breakdown: System (${FastTokenizer.formatTokenCount(systemRulesTokens)}), MCP (${FastTokenizer.formatTokenCount(skillsMcpTokens)}), Messages (${FastTokenizer.formatTokenCount(messagesTokens)}), Tool Outputs (${FastTokenizer.formatTokenCount(toolOutputsTokens)})`
      ]
    });
    const availableConversations = this.listRecentConversations(10);
    const snapshot = {
      conversationId: convId,
      conversationTitle: convTitle || `Session ${convId.slice(0, 8)}`,
      source,
      lastUpdated: (/* @__PURE__ */ new Date()).toLocaleTimeString(),
      modelName,
      modelDisplayName: spec.displayName,
      maxTokens: spec.maxTokens,
      usedTokens: totalUsed,
      percentage,
      healthLevel,
      breakdown,
      topConsumers,
      turnCount,
      isActive: true,
      recentObjectives,
      modifiedFiles,
      recentDecisions: [
        `Session has ${turnCount} turn(s), using ${percentage}% of context capacity`
      ],
      migrationPrompt,
      availableConversations
    };
    return snapshot;
  }
  /**
   * 启动实时监听
   */
  start(callback) {
    this.onUpdateCallback = callback;
    this.pollAndWatch();
    setInterval(() => {
      this.pollAndWatch();
    }, 2e3);
  }
  pollAndWatch(forceReload = false) {
    if (this.isScanning)
      return;
    this.isScanning = true;
    try {
      const target = this.findTargetConversation();
      if (!target) {
        this.isScanning = false;
        return;
      }
      if (target.id !== this.currentConversationId || forceReload || !this.fsWatcher) {
        if (this.fsWatcher) {
          this.fsWatcher.close();
          this.fsWatcher = null;
        }
        this.currentConversationId = target.id;
        this.currentLogFilePath = target.logPath;
        const snapshot = this.parseTranscriptFile(target.logPath, target.id, target.source);
        if (snapshot && this.onUpdateCallback) {
          this.onUpdateCallback(snapshot);
        }
        try {
          const logDir = path.dirname(target.logPath);
          this.fsWatcher = fs.watch(logDir, (eventType, filename) => {
            if (filename === "transcript.jsonl" || filename === "transcript.json") {
              const updated = this.parseTranscriptFile(target.logPath, target.id, target.source);
              if (updated && this.onUpdateCallback) {
                this.onUpdateCallback(updated);
              }
            }
          });
        } catch {
        }
      } else {
        if (this.currentLogFilePath) {
          const updated = this.parseTranscriptFile(this.currentLogFilePath, this.currentConversationId, target.source);
          if (updated && this.onUpdateCallback) {
            this.onUpdateCallback(updated);
          }
        }
      }
    } finally {
      this.isScanning = false;
    }
  }
  stop() {
    if (this.fsWatcher) {
      this.fsWatcher.close();
      this.fsWatcher = null;
    }
  }
};

// src/desktop/server.ts
var PORT = 8765;
var clients = [];
var latestSnapshot = null;
var logWatcher = new LogWatcher();
logWatcher.start((snapshot) => {
  latestSnapshot = snapshot;
  const message = `data: ${JSON.stringify({ type: "UPDATE_SNAPSHOT", payload: snapshot })}

`;
  for (const client of clients) {
    try {
      client.write(message);
    } catch {
    }
  }
});
var server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }
  const parsedUrl = new URL(req.url || "/", `http://127.0.0.1:${PORT}`);
  const pathname = parsedUrl.pathname;
  if (pathname === "/events") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive"
    });
    clients.push(res);
    if (latestSnapshot) {
      res.write(`data: ${JSON.stringify({ type: "UPDATE_SNAPSHOT", payload: latestSnapshot })}

`);
    }
    req.on("close", () => {
      clients = clients.filter((c) => c !== res);
    });
    return;
  }
  if (pathname === "/api/select") {
    const targetId = parsedUrl.searchParams.get("id");
    logWatcher.setSelectedConversation(targetId);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, selectedId: targetId }));
    return;
  }
  if (pathname === "/api/quit") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, message: "Quitting capsule..." }));
    setTimeout(() => {
      process.exit(0);
    }, 100);
    return;
  }
  let filePath = "";
  if (pathname === "/capsule") {
    filePath = path2.join(__dirname, "..", "src", "desktop", "capsule-ui", "capsule.html");
  } else {
    const reqPath = pathname === "/" ? "panel.html" : pathname.replace(/^\//, "");
    filePath = path2.join(__dirname, "..", "src", "ui", reqPath);
  }
  if (!fs2.existsSync(filePath)) {
    if (pathname === "/capsule") {
      filePath = path2.join(__dirname, "capsule.html");
    } else {
      filePath = path2.join(__dirname, pathname === "/" ? "panel.html" : pathname.replace(/^\//, ""));
    }
  }
  const ext = path2.extname(filePath);
  let contentType = "text/html";
  if (ext === ".css")
    contentType = "text/css";
  else if (ext === ".js")
    contentType = "text/javascript";
  else if (ext === ".svg")
    contentType = "image/svg+xml";
  else if (ext === ".json")
    contentType = "application/json";
  fs2.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not Found");
    } else {
      res.writeHead(200, { "Content-Type": contentType });
      res.end(data);
    }
  });
});
server.listen(PORT, "127.0.0.1", () => {
  console.log(`====================================================`);
  console.log(`\u{1F680} Antigravity Context Meter server is ready!`);
  console.log(`\u{1F449} Floating Capsule UI: http://127.0.0.1:${PORT}/capsule`);
  console.log(`\u{1F449} Full Panel UI:       http://127.0.0.1:${PORT}`);
  console.log(`====================================================`);
});
//# sourceMappingURL=desktop.js.map
