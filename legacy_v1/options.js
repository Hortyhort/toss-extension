const routingProfileEl = document.getElementById("routing-profile");
const routingRulesEl = document.getElementById("routing-rules");
const addRuleBtn = document.getElementById("add-rule");
const routingStatusEl = document.getElementById("routing-status");

const packListEl = document.getElementById("pack-list");
const customTemplatesEl = document.getElementById("custom-templates");
const customNameEl = document.getElementById("custom-template-name");
const customKeyEl = document.getElementById("custom-template-key");
const customPrefixEl = document.getElementById("custom-template-prefix");
const addCustomBtn = document.getElementById("add-custom-template");
const exportCustomBtn = document.getElementById("export-custom-pack");
const importCustomTextEl = document.getElementById("import-custom-pack-text");
const importCustomBtn = document.getElementById("import-custom-pack-button");
const customStatusEl = document.getElementById("custom-status");

const compareTargetsEl = document.getElementById("compare-targets");
const compareStatusEl = document.getElementById("compare-status");

const notionTokenEl = document.getElementById("notion-token");
const notionPageIdEl = document.getElementById("notion-page-id");
const notionStatusEl = document.getElementById("notion-status");

let settings = null;

function normalizeSettings(raw) {
  const next = { ...DEFAULT_SETTINGS, ...raw };
  if (!Array.isArray(next.customPacks)) next.customPacks = DEFAULT_SETTINGS.customPacks;
  if (!Array.isArray(next.activeCustomPacks)) next.activeCustomPacks = DEFAULT_SETTINGS.activeCustomPacks;
  if (!Array.isArray(next.activePacks)) next.activePacks = DEFAULT_SETTINGS.activePacks;
  if (!Array.isArray(next.compareTargets) || next.compareTargets.length < 2) {
    next.compareTargets = DEFAULT_SETTINGS.compareTargets;
  }
  if (!Array.isArray(next.routingRules)) next.routingRules = [];
  if (!next.customPacks.find((pack) => pack.id === "custom")) {
    next.customPacks.push({ id: "custom", name: "Custom", templates: {} });
  }
  if (!next.activeCustomPacks.includes("custom")) next.activeCustomPacks.push("custom");
  return next;
}

function persistSettings() {
  chrome.storage.local.set({
    routingProfile: settings.routingProfile,
    routingRules: settings.routingRules,
    activePacks: settings.activePacks,
    customPacks: settings.customPacks,
    activeCustomPacks: settings.activeCustomPacks,
    activeCustomPacks: settings.activeCustomPacks,
    compareTargets: settings.compareTargets,
    notionToken: settings.notionToken,
    notionPageId: settings.notionPageId
  });
}

function slugify(text) {
  return (text || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40) || "custom-template";
}

function getCustomPack() {
  const pack = settings.customPacks.find((item) => item.id === "custom");
  if (!pack.templates) pack.templates = {};
  return pack;
}

function renderRouting() {
  routingProfileEl.value = settings.routingProfile || "off";
  routingRulesEl.innerHTML = "";

  if (settings.routingProfile !== "custom") {
    routingStatusEl.textContent = "Switch to Custom rules to edit routing.";
    return;
  }

  routingStatusEl.textContent = "";

  const templates = getAllTemplates(settings);

  settings.routingRules.forEach((rule, index) => {
    const row = document.createElement("div");
    row.className = "rule";

    const domainInput = document.createElement("input");
    domainInput.type = "text";
    domainInput.placeholder = "domain contains (optional)";
    domainInput.value = rule.domain || "";
    domainInput.addEventListener("input", () => {
      rule.domain = domainInput.value.trim();
      persistSettings();
    });

    const typeSelect = document.createElement("select");
    [
      { value: "any", label: "Any" },
      { value: "code", label: "Code" },
      { value: "prose", label: "Prose" }
    ].forEach((opt) => {
      const option = document.createElement("option");
      option.value = opt.value;
      option.textContent = opt.label;
      typeSelect.appendChild(option);
    });
    typeSelect.value = rule.type || "any";
    typeSelect.addEventListener("change", () => {
      rule.type = typeSelect.value;
      persistSettings();
    });

    const llmSelect = document.createElement("select");
    Object.entries(LLM_DEFS).forEach(([key, llm]) => {
      const option = document.createElement("option");
      option.value = key;
      option.textContent = llm.name;
      llmSelect.appendChild(option);
    });
    llmSelect.value = rule.llmKey || "claude";
    llmSelect.addEventListener("change", () => {
      rule.llmKey = llmSelect.value;
      persistSettings();
    });

    const templateSelect = document.createElement("select");
    templates.forEach((template) => {
      const option = document.createElement("option");
      option.value = template.key;
      option.textContent = template.packName === "Core" ? template.name : `${template.name} (${template.packName})`;
      templateSelect.appendChild(option);
    });
    templateSelect.value = rule.templateKey || "none";
    templateSelect.addEventListener("change", () => {
      rule.templateKey = templateSelect.value;
      persistSettings();
    });

    const removeBtn = document.createElement("button");
    removeBtn.textContent = "Remove";
    removeBtn.addEventListener("click", () => {
      settings.routingRules.splice(index, 1);
      persistSettings();
      renderRouting();
    });

    row.appendChild(domainInput);
    row.appendChild(typeSelect);
    row.appendChild(llmSelect);
    row.appendChild(templateSelect);
    row.appendChild(removeBtn);
    routingRulesEl.appendChild(row);
  });
}

function renderPacks() {
  packListEl.innerHTML = "";
  BUILTIN_PACKS.forEach((pack) => {
    const wrapper = document.createElement("label");
    wrapper.className = "pill";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = settings.activePacks.includes(pack.id);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        settings.activePacks.push(pack.id);
      } else {
        settings.activePacks = settings.activePacks.filter((id) => id !== pack.id);
      }
      persistSettings();
      renderRouting();
    });

    const text = document.createElement("span");
    text.textContent = pack.name;

    wrapper.appendChild(checkbox);
    wrapper.appendChild(text);
    packListEl.appendChild(wrapper);
  });
}

function renderCustomTemplates() {
  const pack = getCustomPack();
  customTemplatesEl.innerHTML = "";

  const entries = Object.entries(pack.templates || {});
  if (entries.length === 0) {
    const empty = document.createElement("div");
    empty.className = "status";
    empty.textContent = "No directives created yet.";
    customTemplatesEl.appendChild(empty);
    return;
  }

  entries.forEach(([key, template]) => {
    const card = document.createElement("div");
    card.className = "directive-card";

    const header = document.createElement("div");
    header.className = "directive-header";

    const nameEl = document.createElement("div");
    nameEl.className = "directive-name";
    nameEl.textContent = template.name;

    const delBtn = document.createElement("button");
    delBtn.textContent = "×";
    delBtn.style.padding = "2px 6px";
    delBtn.style.fontSize = "14px";
    delBtn.style.lineHeight = "1";
    delBtn.title = "Delete Directive";
    delBtn.addEventListener("click", () => {
      if (confirm(`Delete "${template.name}"?`)) {
        delete pack.templates[key];
        persistSettings();
        renderCustomTemplates();
      }
    });

    header.appendChild(nameEl);
    header.appendChild(delBtn);

    const preview = document.createElement("div");
    preview.className = "directive-preview";
    preview.textContent = template.prefix;

    card.appendChild(header);
    card.appendChild(preview);
    customTemplatesEl.appendChild(card);
  });
}

function renderCompareTargets() {
  compareTargetsEl.innerHTML = "";
  compareStatusEl.textContent = "";

  Object.entries(LLM_DEFS).forEach(([key, llm]) => {
    const wrapper = document.createElement("label");
    wrapper.className = "pill";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = settings.compareTargets.includes(key);
    checkbox.addEventListener("change", () => {
      const next = checkbox.checked
        ? [...settings.compareTargets, key]
        : settings.compareTargets.filter((id) => id !== key);

      if (next.length < 2) {
        checkbox.checked = true;
        compareStatusEl.textContent = "Select at least two LLMs for compare.";
        return;
      }

      settings.compareTargets = Array.from(new Set(next));
      compareStatusEl.textContent = "";
      persistSettings();
    });

    const text = document.createElement("span");
    text.textContent = llm.name;

    wrapper.appendChild(checkbox);
    wrapper.appendChild(text);
    compareTargetsEl.appendChild(wrapper);
  });
}

function renderNotion() {
  notionTokenEl.value = settings.notionToken || "";
  notionPageIdEl.value = settings.notionPageId || "";
}

function renderAll() {
  renderRouting();
  renderPacks();
  renderPacks();
  renderCustomTemplates();
  renderCompareTargets();
  renderNotion();
}

routingProfileEl.addEventListener("change", () => {
  settings.routingProfile = routingProfileEl.value;
  persistSettings();
  renderRouting();
});

addRuleBtn.addEventListener("click", () => {
  if (settings.routingProfile !== "custom") {
    settings.routingProfile = "custom";
    routingProfileEl.value = "custom";
  }
  settings.routingRules.push({
    id: `rule_${Date.now()}`,
    domain: "",
    type: "any",
    llmKey: "claude",
    templateKey: "none"
  });
  persistSettings();
  renderRouting();
});

customKeyEl.addEventListener("input", () => {
  customKeyEl.value = slugify(customKeyEl.value);
});

addCustomBtn.addEventListener("click", () => {
  const name = customNameEl.value.trim();
  const prefix = customPrefixEl.value.trim();
  if (!name || !prefix) {
    customStatusEl.textContent = "Template name and prefix are required.";
    return;
  }

  const pack = getCustomPack();
  let key = customKeyEl.value.trim() || slugify(name);
  let suffix = 2;
  while (pack.templates[key]) {
    key = `${slugify(name)}-${suffix++}`;
  }

  pack.templates[key] = { name, prefix };
  customNameEl.value = "";
  customKeyEl.value = "";
  customPrefixEl.value = "";
  customStatusEl.textContent = "Added.";
  persistSettings();
  renderCustomTemplates();
});

exportCustomBtn.addEventListener("click", async () => {
  const pack = getCustomPack();
  const payload = JSON.stringify(pack, null, 2);
  importCustomTextEl.value = payload;
  try {
    await navigator.clipboard.writeText(payload);
    customStatusEl.textContent = "Exported to clipboard.";
  } catch {
    customStatusEl.textContent = "Exported JSON below.";
  }
});

importCustomBtn.addEventListener("click", () => {
  const raw = importCustomTextEl.value.trim();
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed.templates || typeof parsed.templates !== "object") {
      customStatusEl.textContent = "Invalid JSON format.";
      return;
    }
    const pack = getCustomPack();
    pack.templates = parsed.templates;
    customStatusEl.textContent = "Imported custom templates.";
    persistSettings();
    renderCustomTemplates();
  } catch {
    customStatusEl.textContent = "Could not parse JSON.";
  }
});

notionTokenEl.addEventListener("input", () => {
  settings.notionToken = notionTokenEl.value.trim();
  persistSettings();
});

notionPageIdEl.addEventListener("input", () => {
  settings.notionPageId = notionPageIdEl.value.trim();
  persistSettings();
});

chrome.storage.local.get(DEFAULT_SETTINGS, (data) => {
  settings = normalizeSettings(data);
  renderAll();
});
