const STORAGE_KEY = "localJapaneseNameCalculatorState:v1";

const i18n = {
  en: {
    title: "Japanese Name Calculator",
    subtitle: "Compare candidate given names across surnames using stroke data.",
    import: "Import JSON",
    export: "Export JSON",
    themeSystem: "System theme",
    themeLight: "Light theme",
    themeDark: "Dark theme",
    surnames: "Surnames",
    surnamesHelp: "Add each surname to test against. Readings are used for sound elements.",
    addSurname: "Add surname",
    candidates: "Candidate Names",
    addCandidate: "Add candidate",
    results: "Results",
    resultsHelp: "Edit candidates in the first column. Each result cell shows one candidate and one surname.",
    empty: "Add at least one surname and one candidate.",
    analysis: "Analysis",
    text: "Written form",
    reading: "Reading",
    calculate: "Calculate",
    remove: "Remove",
    candidate: "Candidate",
    strokes: "strokes",
    characters: "Characters",
    meanings: "Meanings",
    readingsLabel: "Readings",
    nanoriLabel: "Name readings",
    grids: "Grids",
    elements: "Elements",
    elementJudgment: "Five-element judgment",
    sounds: "Sounds",
    soundJudgment: "Sound judgment",
    flags: "Flags",
    strong: "strong",
    mixed: "mixed",
    weak: "weak",
    saved: "Saved",
    evaluating: "Evaluating",
    error: "Could not evaluate",
    imported: "Imported",
    noAnalysis: "No analysis yet.",
    ranked: "Ranked",
    points: "points",
    relationSame: "same element",
    relationGenerates: "supports the next element",
    relationSupportedBy: "is supported by the next element",
    relationControls: "controls the next element",
    relationControlledBy: "is controlled by the next element",
    relationNeutral: "neutral",
    relationUnknown: "unknown",
    flagOneCharacter: "one-character given name",
    flagTotal40: "total grid is 40+ strokes",
    flagSameCharacter: "surname final character equals given-name first character",
    flagJinmeiyo2004: "contains 凛, added to jinmeiyo kanji in 2004",
  },
  ja: {
    title: "姓名判断ツール",
    subtitle: "画数データで、候補名を複数の姓に対して比較します。",
    import: "JSON読み込み",
    export: "JSON書き出し",
    themeSystem: "システムテーマ",
    themeLight: "ライトテーマ",
    themeDark: "ダークテーマ",
    surnames: "姓",
    surnamesHelp: "確認したい姓を追加してください。ふりがなは言霊判定に使います。",
    addSurname: "姓を追加",
    candidates: "候補名",
    addCandidate: "候補名を追加",
    results: "結果",
    resultsHelp: "左列で候補名を編集できます。各セルは候補名と姓の組み合わせごとの結果です。",
    empty: "姓と候補名をそれぞれ1件以上追加してください。",
    analysis: "短評",
    text: "表記",
    reading: "ふりがな",
    calculate: "計算",
    remove: "削除",
    candidate: "候補名",
    strokes: "画",
    characters: "文字",
    meanings: "意味",
    readingsLabel: "読み",
    nanoriLabel: "名乗り",
    grids: "五格",
    elements: "五行",
    elementJudgment: "五行判定",
    sounds: "言霊",
    soundJudgment: "言霊判定",
    flags: "注意",
    strong: "強い",
    mixed: "混合",
    weak: "弱い",
    saved: "保存済み",
    evaluating: "計算中",
    error: "計算できません",
    imported: "読み込み済み",
    noAnalysis: "短評はまだありません。",
    ranked: "順位",
    points: "点",
    relationSame: "同じ五行",
    relationGenerates: "次の五行を生じる",
    relationSupportedBy: "次の五行から生じられる",
    relationControls: "次の五行を抑える",
    relationControlledBy: "次の五行に抑えられる",
    relationNeutral: "中立",
    relationUnknown: "不明",
    flagOneCharacter: "一文字の名",
    flagTotal40: "総格が40画以上",
    flagSameCharacter: "姓の最後と名の最初が同じ文字",
    flagJinmeiyo2004: "凛は2004年に人名用漢字へ追加",
  },
};

const defaultState = {
  language: "en",
  theme: "system",
  surnames: [
    { text: "山田", reading: "やまだ" },
    { text: "佐藤", reading: "さとう" },
  ],
  candidates: [
    { text: "陽太", reading: "ようた" },
    { text: "蓮", reading: "やまと" },
    { text: "凛", reading: "はな" },
    { text: "陽菜", reading: "はな" },
  ],
};

let state = loadState();
let candidateResults = state.candidates.map(() => null);
const calculatingCandidates = new Set();
const initialCalculationIndexes = existingCandidateIndexes();
initialCalculationIndexes.forEach((index) => calculatingCandidates.add(index));

const surnameList = document.getElementById("surnameList");
const resultsWrap = document.getElementById("resultsWrap");
const analysisList = document.getElementById("analysisList");
const emptyState = document.getElementById("emptyState");
const statusEl = document.getElementById("status");
const importFile = document.getElementById("importFile");

document.getElementById("languageToggle").addEventListener("click", () => {
  state.language = state.language === "en" ? "ja" : "en";
  saveState();
  renderAll();
});

document.getElementById("themeToggle").addEventListener("click", () => {
  state.theme = nextTheme(state.theme);
  saveState();
  renderAll();
});

document.getElementById("addSurname").addEventListener("click", () => {
  state.surnames.push({ text: "", reading: "" });
  saveState();
  renderAll();
});

document.getElementById("addCandidate").addEventListener("click", () => {
  state.candidates.push({ text: "", reading: "" });
  candidateResults.push(null);
  saveState();
  renderAll();
});

document.getElementById("exportButton").addEventListener("click", exportJson);
document.getElementById("importButton").addEventListener("click", () => importFile.click());
importFile.addEventListener("change", importJson);
if (window.matchMedia) {
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (state.theme === "system") renderAll();
  });
}

renderAll();
calculateExistingCandidates(initialCalculationIndexes);

function t(key) {
  return i18n[state.language][key] || i18n.en[key] || key;
}

const displayStrategies = {
  en: {
    characterDetails(item) {
      const parts = [];
      if (item.meanings_en && item.meanings_en.length) {
        parts.push(`${t("meanings")}: ${item.meanings_en.slice(0, 3).join("; ")}`);
      }
      if (item.nanori && item.nanori.length) {
        parts.push(`${t("nanoriLabel")}: ${item.nanori.slice(0, 4).join(", ")}`);
      } else if (item.readings && item.readings.length) {
        parts.push(`${t("readingsLabel")}: ${item.readings.slice(0, 4).join(", ")}`);
      }
      return parts;
    },
  },
  ja: {
    characterDetails(item) {
      const parts = [];
      if (item.meanings_ja && item.meanings_ja.length) {
        parts.push(`${t("meanings")}: ${item.meanings_ja.slice(0, 3).join("、")}`);
      } else if (item.meanings_en && item.meanings_en.length) {
        parts.push(`${t("meanings")}: ${item.meanings_en.slice(0, 3).join("; ")}`);
      }
      if (item.nanori && item.nanori.length) {
        parts.push(`${t("nanoriLabel")}: ${item.nanori.slice(0, 4).join("、")}`);
      } else if (item.readings && item.readings.length) {
        parts.push(`${t("readingsLabel")}: ${item.readings.slice(0, 4).join("、")}`);
      }
      return parts;
    },
  },
};

function displayStrategy() {
  return displayStrategies[state.language] || displayStrategies.en;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(defaultState);
    return normalizeState(JSON.parse(raw));
  } catch {
    return structuredClone(defaultState);
  }
}

function normalizeState(value) {
  return {
    language: value.language === "ja" ? "ja" : "en",
    theme: ["system", "light", "dark"].includes(value.theme) ? value.theme : "system",
    surnames: Array.isArray(value.surnames) ? value.surnames.map((item) => ({
      text: String(item.text || ""),
      reading: String(item.reading || ""),
    })) : [],
    candidates: Array.isArray(value.candidates) ? value.candidates.map((item) => ({
      text: String(item.text || ""),
      reading: String(item.reading || ""),
    })) : [],
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state, null, 2));
}

function setStatus(messageKey) {
  statusEl.textContent = messageKey ? t(messageKey) : "";
}

function renderAll() {
  document.documentElement.lang = state.language;
  applyTheme();
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = t(node.dataset.i18n);
  });
  document.getElementById("languageToggle").textContent = state.language === "en" ? "日本語" : "English";
  renderThemeToggle();
  renderSurnames();
  renderResults();
}

function applyTheme() {
  const theme = effectiveTheme();
  document.documentElement.dataset.theme = theme;
  document.body.dataset.theme = theme;
}

function renderThemeToggle() {
  const button = document.getElementById("themeToggle");
  const icon = document.createElement("i");
  icon.className = `fa-solid ${themeIconClass(state.theme)}`;
  icon.setAttribute("aria-hidden", "true");
  button.replaceChildren(icon);
  button.setAttribute("aria-label", t(themeLabelKey(state.theme)));
  button.title = t(themeLabelKey(state.theme));
}

function nextTheme(theme) {
  if (theme === "system") return "light";
  if (theme === "light") return "dark";
  return "system";
}

function themeLabelKey(theme) {
  if (theme === "light") return "themeLight";
  if (theme === "dark") return "themeDark";
  return "themeSystem";
}

function themeIconClass(theme) {
  if (theme === "light") return "fa-sun";
  if (theme === "dark") return "fa-moon";
  return "fa-circle-half-stroke";
}

function effectiveTheme() {
  if (state.theme === "light" || state.theme === "dark") return state.theme;
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function renderSurnames() {
  surnameList.replaceChildren();
  state.surnames.forEach((surname, index) => {
    surnameList.appendChild(entryRow({
      type: "surname",
      index,
      values: surname,
      includeNote: false,
    }));
  });
}

function entryRow({ type, index, values }) {
  const row = document.createElement("div");
  row.className = "entry-row";
  row.appendChild(field("text", t("text"), values.text, (value) => updateEntry(type, index, "text", value)));
  row.appendChild(field("reading", t("reading"), values.reading, (value) => updateEntry(type, index, "reading", value)));

  const actions = document.createElement("div");
  actions.className = "entry-actions";
  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "button danger";
  remove.textContent = t("remove");
  remove.addEventListener("click", () => {
    state[type === "surname" ? "surnames" : "candidates"].splice(index, 1);
    saveState();
    renderAll();
  });
  actions.appendChild(remove);
  row.appendChild(actions);
  return row;
}

function field(name, labelText, value, onInput, multiline = false, onKeyDown = null) {
  const wrapper = document.createElement("div");
  wrapper.className = "field";
  const label = document.createElement("label");
  label.textContent = labelText;
  const input = multiline ? document.createElement("textarea") : document.createElement("input");
  input.name = name;
  input.value = value || "";
  input.addEventListener("input", () => onInput(input.value));
  if (onKeyDown) input.addEventListener("keydown", onKeyDown);
  wrapper.append(label, input);
  return wrapper;
}

function updateEntry(type, index, key, value) {
  const collection = type === "surname" ? state.surnames : state.candidates;
  collection[index][key] = value;
  saveState();
  refreshCalculateButtons();
}

async function calculateCandidate(index) {
  const payload = candidatePayload(index);
  if (!payload || !canCalculateCandidate(index)) return;

  const signature = candidateSignature(index);
  calculatingCandidates.add(index);
  refreshCalculateButtons();
  setStatus("evaluating");
  try {
    const response = await fetch("/api/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || response.statusText);
    candidateResults[index] = { signature, data };
    renderResults();
    setStatus("saved");
  } catch (error) {
    setStatus("error");
    analysisList.replaceChildren(errorBox(error.message));
  } finally {
    calculatingCandidates.delete(index);
    refreshCalculateButtons();
  }
}

async function calculateExistingCandidates(indexes = existingCandidateIndexes()) {
  const payload = existingCandidatesPayload(indexes);
  if (!payload) return;

  const signatures = new Map(payload.indexes.map((index) => [index, candidateSignature(index)]));
  payload.indexes.forEach((index) => calculatingCandidates.add(index));
  refreshCalculateButtons();
  setStatus("evaluating");
  try {
    const response = await fetch("/api/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ surnames: payload.surnames, candidates: payload.candidates }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || response.statusText);
    payload.indexes.forEach((index) => {
      const signature = signatures.get(index);
      if (!signature || candidateSignature(index) !== signature) return;
      candidateResults[index] = {
        signature,
        data: dataForCandidate(data, state.candidates[index]),
      };
    });
    renderResults();
    setStatus("saved");
  } catch (error) {
    setStatus("error");
    analysisList.replaceChildren(errorBox(error.message));
  } finally {
    payload.indexes.forEach((index) => calculatingCandidates.delete(index));
    refreshCalculateButtons();
  }
}

function candidatePayload(index) {
  const candidate = state.candidates[index];
  if (!candidate) return null;
  const surnames = state.surnames
    .filter((item) => item.text.trim() && item.reading.trim())
    .map((item) => ({ text: item.text.trim(), reading: item.reading.trim() }));
  const normalizedCandidate = {
    text: candidate.text.trim(),
    reading: candidate.reading.trim(),
  };
  if (!normalizedCandidate.text || !normalizedCandidate.reading || !surnames.length) {
    return null;
  }
  return { surnames, candidates: [normalizedCandidate] };
}

function existingCandidateIndexes() {
  return state.candidates
    .map((_, index) => index)
    .filter((index) => {
      const signature = candidateSignature(index);
      return Boolean(signature && candidateResults[index]?.signature !== signature);
    });
}

function existingCandidatesPayload(indexes) {
  const surnames = completeSurnames();
  if (!surnames.length) return null;
  const selectedIndexes = [];
  const candidates = [];
  indexes.forEach((index) => {
    const candidate = state.candidates[index];
    if (!candidate) return;
    const normalizedCandidate = {
      text: candidate.text.trim(),
      reading: candidate.reading.trim(),
    };
    const signature = candidateSignature(index);
    if (!normalizedCandidate.text || !normalizedCandidate.reading) return;
    if (!signature || candidateResults[index]?.signature === signature) return;
    selectedIndexes.push(index);
    candidates.push(normalizedCandidate);
  });
  return selectedIndexes.length ? { surnames, candidates, indexes: selectedIndexes } : null;
}

function completeSurnames() {
  return state.surnames
    .filter((item) => item.text.trim() && item.reading.trim())
    .map((item) => ({ text: item.text.trim(), reading: item.reading.trim() }));
}

function dataForCandidate(data, candidate) {
  return {
    ...data,
    candidates: data.candidates.filter((item) => item.text === candidate.text.trim()),
    results: data.results.filter((item) => item.candidate === candidate.text.trim()),
    analysis: data.analysis.filter((item) => item.candidate === candidate.text.trim()),
  };
}

function candidateSignature(index) {
  const payload = candidatePayload(index);
  return payload ? JSON.stringify(payload) : "";
}

function canCalculateCandidate(index) {
  if (calculatingCandidates.has(index)) return false;
  const signature = candidateSignature(index);
  return Boolean(signature && candidateResults[index]?.signature !== signature);
}

function refreshCalculateButtons() {
  document.querySelectorAll("[data-candidate-calculate]").forEach((button) => {
    const index = Number(button.dataset.candidateIndex);
    button.disabled = !canCalculateCandidate(index);
  });
}

function renderResults() {
  resultsWrap.replaceChildren();
  analysisList.replaceChildren();

  if (!state.candidates.length) {
    emptyState.hidden = false;
    analysisList.appendChild(emptyMessage(t("noAnalysis")));
    return;
  }
  emptyState.hidden = true;

  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  headerRow.appendChild(th(t("candidate")));
  state.surnames.forEach((surname) => {
    headerRow.appendChild(th(surnameHeaderText(surname)));
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  state.candidates.forEach((candidate, index) => {
    const row = document.createElement("tr");
    const nameCell = document.createElement("td");
    nameCell.className = "name-cell";
    const resultData = candidateResults[index]?.signature === candidateSignature(index) ? candidateResults[index].data : null;
    const evaluatedCandidate = resultData?.candidates.find((item) => item.text === candidate.text) || null;
    nameCell.appendChild(candidateEditor(candidate, evaluatedCandidate, index));
    row.appendChild(nameCell);
    state.surnames.forEach((surname) => {
      const result = resultData?.results.find((item) => item.candidate === candidate.text && item.surname === surname.text);
      row.appendChild(resultCell(result));
    });
    tbody.appendChild(row);
  });
  table.appendChild(tbody);
  resultsWrap.appendChild(table);
  renderAnalysis();
}

function surnameHeaderText(surname) {
  const base = `${surname.text || t("surnames")} (${surname.reading || t("reading")})`;
  const total = surnameStrokeTotal(surname);
  return total ? `${base} - ${total} ${t("strokes")}` : base;
}

function surnameStrokeTotal(surname) {
  for (let index = 0; index < candidateResults.length; index += 1) {
    const item = candidateResults[index];
    if (!item || item.signature !== candidateSignature(index)) continue;
    const match = item.data.surnames.find((candidateSurname) => (
      candidateSurname.text === surname.text && candidateSurname.reading === surname.reading
    ));
    if (match) return match.strokes.reduce((total, value) => total + value, 0);
  }
  return null;
}

function candidateEditor(candidate, evaluatedCandidate, index) {
  const wrap = document.createElement("div");
  wrap.className = "candidate-editor";
  const triggerCalculation = (event, triggerOnTab) => {
    if (event.key !== "Enter" && event.key !== "Tab") return;
    if (event.key === "Tab" && !triggerOnTab) return;
    if (event.key === "Enter") event.preventDefault();
    if (canCalculateCandidate(index)) calculateCandidate(index);
  };
  wrap.appendChild(field("candidateText", t("text"), candidate.text, (value) => updateEntry("candidate", index, "text", value), false, (event) => triggerCalculation(event, false)));
  wrap.appendChild(field("candidateReading", t("reading"), candidate.reading, (value) => updateEntry("candidate", index, "reading", value), false, (event) => triggerCalculation(event, true)));

  const actions = document.createElement("div");
  actions.className = "candidate-actions";
  const calculate = document.createElement("button");
  calculate.type = "button";
  calculate.className = "button secondary compact";
  calculate.textContent = t("calculate");
  calculate.dataset.candidateCalculate = "true";
  calculate.dataset.candidateIndex = String(index);
  calculate.disabled = !canCalculateCandidate(index);
  calculate.addEventListener("click", () => calculateCandidate(index));
  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "button danger";
  remove.textContent = t("remove");
  remove.addEventListener("click", () => {
    state.candidates.splice(index, 1);
    candidateResults.splice(index, 1);
    saveState();
    renderAll();
  });
  actions.append(calculate, remove);
  wrap.appendChild(actions);
  if (evaluatedCandidate) {
    const chars = document.createElement("div");
    chars.className = "char-list";
    chars.appendChild(sectionLabel(t("characters")));
    evaluatedCandidate.characters.forEach((item) => {
      const line = document.createElement("div");
      line.textContent = `${item.character}: ${item.strokes} ${t("strokes")}${formatMeanings(item)}`;
      chars.appendChild(line);
    });
    wrap.appendChild(chars);
  }
  return wrap;
}

function formatMeanings(item) {
  const parts = displayStrategy().characterDetails(item);
  return parts.length ? ` - ${parts.join(" / ")}` : "";
}

function resultCell(result) {
  const cell = document.createElement("td");
  if (!result) return cell;
  const level = result.suitability.level;
  cell.className = `result-cell ${level}`;
  const top = document.createElement("div");
  top.className = "score-line";
  const badge = document.createElement("span");
  badge.className = `badge ${level}`;
  badge.textContent = t(level);
  const points = document.createElement("span");
  points.className = "muted";
  points.textContent = `${result.suitability.points} ${t("points")}`;
  top.append(badge, points);

  const grids = document.createElement("div");
  grids.className = "grid-list";
  grids.appendChild(sectionLabel(t("grids")));
  Object.entries(result.grid).forEach(([name, value]) => {
    const item = document.createElement("div");
    item.className = "grid-item";
    const label = document.createElement("span");
    label.textContent = name;
    const score = document.createElement("span");
    score.className = "score";
    score.append(`${value} `, scoreSymbol(result.grid_scores[name] || ""));
    item.append(label, score);
    grids.appendChild(item);
  });

  const elements = document.createElement("div");
  elements.className = "grid-list";
  elements.appendChild(sectionLabel(t("elements")));
  elements.appendChild(textLine(Object.entries(result.five_elements).map(([name, value]) => `${name}:${value}`).join(" / ")));
  elements.appendChild(judgmentLine(t("elementJudgment"), result.five_element_judgment));
  elements.appendChild(sectionLabel(t("sounds")));
  elements.appendChild(textLine(`${result.sound_elements.surname_final.sound}:${result.sound_elements.surname_final.element} / ${result.sound_elements.given_first.sound}:${result.sound_elements.given_first.element}`));
  elements.appendChild(judgmentLine(t("soundJudgment"), result.sound_judgment));

  cell.append(top, grids, elements);
  if (result.flags.length) {
    const flags = document.createElement("div");
    flags.className = "flags";
    flags.appendChild(sectionLabel(t("flags")));
    result.flags.forEach((flag) => flags.appendChild(textLine(translateFlag(flag))));
    cell.appendChild(flags);
  }
  return cell;
}

function renderAnalysis() {
  const analysis = candidateResults
    .flatMap((item, index) => item?.signature === candidateSignature(index) ? item.data.analysis || [] : [])
    .sort((a, b) => b.points - a.points);

  if (!analysis.length) {
    analysisList.appendChild(emptyMessage(t("noAnalysis")));
    return;
  }
  analysis.forEach((item, index) => {
    const card = document.createElement("div");
    card.className = `analysis-card ${item.level}`;
    const title = document.createElement("div");
    title.className = "score-line";
    title.innerHTML = `<strong>${index + 1}. ${escapeHtml(item.candidate)} (${escapeHtml(item.reading)})</strong>`;
    const badge = document.createElement("span");
    badge.className = `badge ${item.level}`;
    badge.textContent = t(item.level);
    title.appendChild(badge);
    const meta = document.createElement("div");
    meta.className = "analysis-meta muted";
    meta.textContent = `${item.points} ${t("points")} - ${t("strong")}: ${item.strong_count}, ${t("mixed")}: ${item.mixed_count}, ${t("weak")}: ${item.weak_count}`;
    card.append(title, meta);
    analysisList.appendChild(card);
  });
}

function scoreSymbol(label) {
  const symbol = document.createElement("span");
  symbol.setAttribute("aria-label", label);
  if (label.includes("◎")) {
    symbol.className = "score-symbol score-symbol-double";
  } else if (label.includes("○")) {
    symbol.className = "score-symbol score-symbol-circle";
  } else {
    symbol.className = "score-symbol score-symbol-triangle";
    symbol.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><polygon points="12 3.5 21 20.5 3 20.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round" /></svg>';
  }
  return symbol;
}

function judgmentLine(label, judgment) {
  const line = document.createElement("div");
  if (!judgment) {
    line.textContent = `${label}: ${t("relationUnknown")}`;
    return line;
  }
  const relations = (judgment.relations || []).map((item) => `${item.from}->${item.to} ${translateRelation(item.relation)}`);
  line.textContent = `${label}: ${t(judgment.level)} (${relations.join("; ")})`;
  return line;
}

function translateRelation(relation) {
  const key = {
    same: "relationSame",
    generates: "relationGenerates",
    supported_by: "relationSupportedBy",
    controls: "relationControls",
    controlled_by: "relationControlledBy",
    neutral: "relationNeutral",
    unknown: "relationUnknown",
  }[relation] || "relationUnknown";
  return t(key);
}

function translateFlag(flag) {
  if (flag === "one-character given name") return t("flagOneCharacter");
  if (flag === "total grid is 40+ strokes") return t("flagTotal40");
  if (flag === "surname final character equals given-name first character") return t("flagSameCharacter");
  if (flag === "contains 凛, added to jinmeiyo kanji in 2004") return t("flagJinmeiyo2004");
  return flag;
}

function sectionLabel(text) {
  const node = document.createElement("strong");
  node.textContent = text;
  return node;
}

function textLine(text) {
  const node = document.createElement("div");
  node.textContent = text;
  return node;
}

function th(text) {
  const node = document.createElement("th");
  node.textContent = text;
  return node;
}

function textCell(text) {
  const node = document.createElement("td");
  node.textContent = text;
  return node;
}

function emptyMessage(text) {
  const node = document.createElement("div");
  node.className = "empty";
  node.textContent = text;
  return node;
}

function errorBox(text) {
  const node = document.createElement("div");
  node.className = "empty";
  node.textContent = text;
  return node;
}

function exportJson() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "naming-state.json";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function importJson(event) {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    state = normalizeState(JSON.parse(text));
    candidateResults = state.candidates.map(() => null);
    const indexes = existingCandidateIndexes();
    indexes.forEach((index) => calculatingCandidates.add(index));
    saveState();
    renderAll();
    setStatus("imported");
    calculateExistingCandidates(indexes);
  } catch (error) {
    setStatus("error");
  } finally {
    event.target.value = "";
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
