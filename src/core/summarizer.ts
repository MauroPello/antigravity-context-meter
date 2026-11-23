/**
 * 一键提炼迁移 Prompt 生成器 (Stage 1)
 * 用于在上下文即将超限时，一键提炼出高质量的结构化 Markdown 摘要，方便在新会话中 0 遗忘无缝继续
 */
export class ContextSummarizer {
  /**
   * 基于会话中的关键信息提炼结构化迁移 Prompt
   */
  public static generateMigrationPrompt(params: {
    projectName: string;
    modelName: string;
    totalTokens: string;
    userObjectives: string[];
    modifiedFiles: string[];
    recentDecisions: string[];
  }): string {
    const { projectName, modelName, totalTokens, userObjectives, modifiedFiles, recentDecisions } = params;

    const prompt = `# Context Migration Prompt

> Automatically distilled by **Antigravity Context Meter**.
> **Previous Session Usage**: ~${totalTokens} Tokens | **Model**: ${modelName}

---

## 🎯 Core Objectives & Background
${
  userObjectives.length > 0
    ? userObjectives.map((obj, i) => `${i + 1}. ${obj}`).join('\n')
    : '1. Continue working on the core features and architecture of the current project.'
}

## 📝 Key Technical Decisions & Design
${
  recentDecisions.length > 0
    ? recentDecisions.map((dec) => `- ${dec}`).join('\n')
    : '- Core architecture and staged development plan are established.'
}

## 📁 Relevant Files & Code Assets
${
  modifiedFiles.length > 0
    ? modifiedFiles.map((f) => `- \`${f}\``).join('\n')
    : '- Continue directly from the current workspace files.'
}

## 🚀 Next Steps
Please review the context above and the current workspace, skip re-explaining the architecture, and seamlessly continue with the next concrete task.
`;

    return prompt;
  }
}
