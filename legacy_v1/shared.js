// Shared constants and helpers for background, content, and UI scripts

const LLM_DEFS = {
  claude: { name: "Claude", url: "https://claude.ai/new", host: "claude.ai" },
  chatgpt: {
    name: "ChatGPT",
    url: "https://chatgpt.com/",
    host: "chatgpt.com",
  },
  gemini: {
    name: "Gemini",
    url: "https://gemini.google.com/app",
    host: "gemini.google.com",
  },
  perplexity: {
    name: "Perplexity",
    url: "https://www.perplexity.ai/",
    host: "perplexity.ai",
  },
  grok: { name: "Grok", url: "https://grok.com/", host: "grok.com" },
};

const BASE_TEMPLATES = {
  none: { name: "Just send", prefix: "" },
  summarize: { name: "Summarize", prefix: "Summarize this:\n\n" },
  eli5: { name: "Explain like I'm 5", prefix: "Explain this like I'm 5:\n\n" },
  translate: {
    name: "Translate to English",
    prefix: "Translate this to English:\n\n",
  },
  improve: {
    name: "Improve writing",
    prefix: "Improve the writing of this text:\n\n",
  },
  code: { name: "Explain code", prefix: "Explain what this code does:\n\n" },
  fix: { name: "Fix errors", prefix: "Fix any errors in this:\n\n" },
  google_search: { name: "Google Search + Toss", prefix: "" },
};

const NOTION_API_VERSION = "2022-06-28";

const BUILTIN_PACKS = [
  {
    id: "writer",
    name: "Writer",
    templates: {
      tighten: {
        name: "Tighten writing",
        prefix: "Tighten this for clarity and concision:\n\n",
      },
      tone: {
        name: "Rewrite friendly",
        prefix: "Rewrite this in a friendly, confident tone:\n\n",
      },
      headline: {
        name: "Headline ideas",
        prefix: "Give 5 headline ideas for:\n\n",
      },
    },
  },
  {
    id: "developer",
    name: "Developer",
    templates: {
      review: {
        name: "Review for bugs",
        prefix: "Review this code for bugs and edge cases:\n\n",
      },
      tests: { name: "Suggest tests", prefix: "Suggest tests for:\n\n" },
      refactor: {
        name: "Refactor for readability",
        prefix: "Refactor this for readability:\n\n",
      },
    },
  },
  {
    id: "student",
    name: "Student",
    templates: {
      notes: { name: "Study notes", prefix: "Create study notes from:\n\n" },
      flashcards: {
        name: "Flashcards",
        prefix: "Create 10 flashcards from:\n\n",
      },
      quiz: { name: "Quiz me", prefix: "Quiz me on:\n\n" },
    },
  },
];

const DEFAULT_SETTINGS = {
  autoSend: true,
  activePacks: ["writer", "developer", "student"],
  customPacks: [{ id: "custom", name: "Custom", templates: {} }],
  activeCustomPacks: ["custom"],
  routingProfile: "off",
  routingRules: [],
  compareTargets: ["claude", "chatgpt", "gemini"],
};

function getAllTemplates(settings) {
  const all = [];

  Object.entries(BASE_TEMPLATES).forEach(([key, tpl]) => {
    all.push({
      key,
      name: tpl.name,
      prefix: tpl.prefix,
      packId: "core",
      packName: "Core",
    });
  });

  BUILTIN_PACKS.forEach((pack) => {
    if (!settings.activePacks || !settings.activePacks.includes(pack.id))
      return;
    Object.entries(pack.templates).forEach(([key, tpl]) => {
      const fullKey = `${pack.id}-${key}`;
      all.push({
        key: fullKey,
        name: tpl.name,
        prefix: tpl.prefix,
        packId: pack.id,
        packName: pack.name,
      });
    });
  });

  if (Array.isArray(settings.customPacks)) {
    settings.customPacks.forEach((pack) => {
      if (
        settings.activeCustomPacks &&
        !settings.activeCustomPacks.includes(pack.id)
      )
        return;
      const templates = pack.templates || {};
      Object.entries(templates).forEach(([key, tpl]) => {
        const fullKey = `${pack.id}-${key}`;
        all.push({
          key: fullKey,
          name: tpl.name,
          prefix: tpl.prefix,
          packId: pack.id,
          packName: pack.name || "Custom",
        });
      });
    });
  }

  return all;
}

function getTemplateByKey(settings, key) {
  if (BASE_TEMPLATES[key]) {
    return {
      key,
      name: BASE_TEMPLATES[key].name,
      prefix: BASE_TEMPLATES[key].prefix,
      packId: "core",
      packName: "Core",
    };
  }

  for (const pack of BUILTIN_PACKS) {
    if (!settings.activePacks || !settings.activePacks.includes(pack.id))
      continue;
    if (key.startsWith(`${pack.id}-`)) {
      const innerKey = key.replace(`${pack.id}-`, "");
      const tpl = pack.templates[innerKey];
      if (tpl)
        return {
          key,
          name: tpl.name,
          prefix: tpl.prefix,
          packId: pack.id,
          packName: pack.name,
        };
    }
  }

  if (Array.isArray(settings.customPacks)) {
    for (const pack of settings.customPacks) {
      if (
        settings.activeCustomPacks &&
        !settings.activeCustomPacks.includes(pack.id)
      )
        continue;
      if (key.startsWith(`${pack.id}-`)) {
        const innerKey = key.replace(`${pack.id}-`, "");
        const tpl = (pack.templates || {})[innerKey];
        if (tpl)
          return {
            key,
            name: tpl.name,
            prefix: tpl.prefix,
            packId: pack.id,
            packName: pack.name || "Custom",
          };
      }
    }
  }

  return null;
}

function detectSelectionType(text) {
  const trimmed = (text || "").trim();
  if (!trimmed) return "unknown";

  const lines = trimmed.split("\n");
  const indicators = [
    "{",
    "}",
    ";",
    "=>",
    "<div",
    "function ",
    "class ",
    "const ",
    "let ",
    "var ",
    "#include",
    "import ",
  ];
  const hasCodeToken = indicators.some((token) => trimmed.includes(token));
  const hasIndented = lines.some((line) => /^\s{2,}/.test(line));
  const symbolRatio =
    trimmed.replace(/[a-z0-9\s]/gi, "").length / Math.max(trimmed.length, 1);

  if (lines.length > 1 && (hasCodeToken || hasIndented || symbolRatio > 0.2))
    return "code";
  return "prose";
}

function getRecommendedRoute(settings, context) {
  const text = (context && context.text) || "";
  const url = (context && context.url) || "";
  if (!text.trim()) return null;
  const host = (() => {
    try {
      return new URL(url).hostname || "";
    } catch {
      return "";
    }
  })();

  const profile = settings.routingProfile || "off";

  if (
    profile === "custom" &&
    Array.isArray(settings.routingRules) &&
    settings.routingRules.length > 0
  ) {
    for (const rule of settings.routingRules) {
      if (rule.domain && host && !host.includes(rule.domain)) continue;
      if (
        rule.type &&
        rule.type !== "any" &&
        detectSelectionType(text) !== rule.type
      )
        continue;
      if (rule.llmKey && rule.templateKey)
        return { llmKey: rule.llmKey, templateKey: rule.templateKey };
    }
  }

  const selectionType = detectSelectionType(text);

  if (profile === "developer") {
    if (selectionType === "code")
      return { llmKey: "chatgpt", templateKey: "code" };
    return { llmKey: "claude", templateKey: "summarize" };
  }

  if (profile === "writer") {
    return { llmKey: "claude", templateKey: "improve" };
  }

  if (profile === "research") {
    if (
      host.includes("arxiv") ||
      host.includes("wikipedia") ||
      host.includes("news") ||
      host.includes("medium") ||
      host.includes("nature")
    ) {
      return { llmKey: "claude", templateKey: "summarize" };
    }
    return { llmKey: "perplexity", templateKey: "none" };
  }

  return null;
}
