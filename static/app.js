const STORAGE_KEY = "localJapaneseNameCalculatorState:v1";

const i18n = {
  en: {
    title: "Local Japanese Name Calculator",
    subtitle: "Compare candidate given names across surnames using local stroke data.",
    import: "Import JSON",
    export: "Export JSON",
    surnames: "Surnames",
    surnamesHelp: "Add each surname to test against. Readings are used for sound elements.",
    addSurname: "Add surname",
    candidates: "Candidate Names",
    candidatesHelp: "Enter kanji and reading. Results update after each edit.",
    addCandidate: "Add candidate",
    results: "Results",
    resultsHelp: "Each cell shows the result for one candidate and one surname.",
    empty: "Add at least one surname and one candidate.",
    analysis: "Analysis",
    text: "Written form",
    reading: "Reading",
    note: "Note",
    remove: "Remove",
    candidate: "Candidate",
    strokes: "strokes",
    characters: "Characters",
    grids: "Grids",
    elements: "Elements",
    sounds: "Sounds",
    flags: "Flags",
    strong: "strong",
    mixed: "mixed",
    weak: "weak",
    saved: "Saved",
    evaluating: "Evaluating",
    error: "Could not evaluate",
    imported: "Imported",
    noAnalysis: "No analysis yet.",
    sourceNote: "Scores use a public 1-81 table; source prose is not copied.",
    ranked: "Ranked",
    points: "points",
  },
  ja: {
    title: "ローカル姓名判断ツール",
    subtitle: "ローカルの画数データで、候補名を複数の姓に対して比較します。",
    import: "JSON読み込み",
    export: "JSON書き出し",
    surnames: "姓",
    surnamesHelp: "確認したい姓を追加してください。ふりがなは言霊判定に使います。",
    addSurname: "姓を追加",
    candidates: "候補名",
    candidatesHelp: "漢字とふりがなを入力してください。編集すると結果が更新されます。",
    addCandidate: "候補名を追加",
    results: "結果",
    resultsHelp: "各セルは候補名と姓の組み合わせごとの結果です。",
    empty: "姓と候補名をそれぞれ1件以上追加してください。",
    analysis: "短評",
    text: "表記",
    reading: "ふりがな",
    note: "メモ",
    remove: "削除",
    candidate: "候補名",
    strokes: "画",
    characters: "文字",
    grids: "五格",
    elements: "五行",
    sounds: "言霊",
    flags: "注意",
    strong: "強い",
    mixed: "混合",
    weak: "弱い",
    saved: "保存済み",
    evaluating: "計算中",
    error: "計算できません",
    imported: "読み込み済み",
    noAnalysis: "短評はまだありません。",
    sourceNote: "吉凶表示は公開81数表を使っています。固有サイトの文章は複製していません。",
    ranked: "順位",
    points: "点",
  },
};

const defaultState = {
  language: "en",
  surnames: [
    { text: "山田", reading: "やまだ" },
    { text: "佐藤", reading: "さとう" },
  ],
  candidates: [
    { text: "陽太", reading: "ようた", note: "" },
    { text: "蓮", reading: "やまと", note: "Marie registration candidate" },
    { text: "凛", reading: "はな", note: "" },
    { text: "陽菜", reading: "はな", note: "" },
  ],
};

let state = loadState();
let latestResult = null;
let evaluateTimer = null;

const surnameList = document.getElementById("surnameList");
const candidateList = document.getElementById("candidateList");
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

document.getElementById("addSurname").addEventListener("click", () => {
  state.surnames.push({ text: "", reading: "" });
  saveState();
  renderAll();
});

document.getElementById("addCandidate").addEventListener("click", () => {
  state.candidates.push({ text: "", reading: "", note: "" });
  saveState();
  renderAll();
});

document.getElementById("exportButton").addEventListener("click", exportJson);
document.getElementById("importButton").addEventListener("click", () => importFile.click());
importFile.addEventListener("change", importJson);

renderAll();

function t(key) {
  return i18n[state.language][key] || i18n.en[key] || key;
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
    surnames: Array.isArray(value.surnames) ? value.surnames.map((item) => ({
      text: String(item.text || ""),
      reading: String(item.reading || ""),
    })) : [],
    candidates: Array.isArray(value.candidates) ? value.candidates.map((item) => ({
      text: String(item.text || ""),
      reading: String(item.reading || ""),
      note: String(item.note || ""),
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
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = t(node.dataset.i18n);
  });
  document.getElementById("languageToggle").textContent = state.language === "en" ? "日本語" : "English";
  renderSurnames();
  renderCandidates();
  scheduleEvaluate();
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

function renderCandidates() {
  candidateList.replaceChildren();
  state.candidates.forEach((candidate, index) => {
    candidateList.appendChild(entryRow({
      type: "candidate",
      index,
      values: candidate,
      includeNote: true,
    }));
  });
}

function entryRow({ type, index, values, includeNote }) {
  const row = document.createElement("div");
  row.className = "entry-row";
  row.appendChild(field("text", t("text"), values.text, (value) => updateEntry(type, index, "text", value)));
  row.appendChild(field("reading", t("reading"), values.reading, (value) => updateEntry(type, index, "reading", value)));
  if (includeNote) {
    row.appendChild(field("note", t("note"), values.note, (value) => updateEntry(type, index, "note", value), true));
  } else {
    const spacer = document.createElement("div");
    spacer.className = "muted";
    spacer.textContent = "";
    row.appendChild(spacer);
  }

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

function field(name, labelText, value, onInput, multiline = false) {
  const wrapper = document.createElement("div");
  wrapper.className = "field";
  const label = document.createElement("label");
  label.textContent = labelText;
  const input = multiline ? document.createElement("textarea") : document.createElement("input");
  input.name = name;
  input.value = value || "";
  input.addEventListener("input", () => onInput(input.value));
  wrapper.append(label, input);
  return wrapper;
}

function updateEntry(type, index, key, value) {
  const collection = type === "surname" ? state.surnames : state.candidates;
  collection[index][key] = value;
  saveState();
  scheduleEvaluate();
}

function validInputs() {
  return {
    surnames: state.surnames.filter((item) => item.text.trim() && item.reading.trim()),
    candidates: state.candidates.filter((item) => item.text.trim() && item.reading.trim()),
  };
}

function scheduleEvaluate() {
  clearTimeout(evaluateTimer);
  evaluateTimer = setTimeout(evaluateNow, 180);
}

async function evaluateNow() {
  const payload = validInputs();
  if (!payload.surnames.length || !payload.candidates.length) {
    latestResult = null;
    renderResults();
    setStatus("");
    return;
  }

  setStatus("evaluating");
  try {
    const response = await fetch("/api/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || response.statusText);
    latestResult = data;
    renderResults();
    setStatus("saved");
  } catch (error) {
    latestResult = null;
    resultsWrap.replaceChildren();
    analysisList.replaceChildren(errorBox(error.message));
    emptyState.hidden = true;
    setStatus("error");
  }
}

function renderResults() {
  resultsWrap.replaceChildren();
  analysisList.replaceChildren();

  if (!latestResult || !latestResult.results.length) {
    emptyState.hidden = false;
    analysisList.appendChild(emptyMessage(t("noAnalysis")));
    return;
  }
  emptyState.hidden = true;

  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  headerRow.appendChild(th(t("candidate")));
  latestResult.surnames.forEach((surname) => {
    headerRow.appendChild(th(`${surname.text} (${surname.reading})`));
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  latestResult.candidates.forEach((candidate) => {
    const row = document.createElement("tr");
    const nameCell = document.createElement("td");
    nameCell.className = "name-cell";
    nameCell.appendChild(candidateSummary(candidate));
    row.appendChild(nameCell);
    latestResult.surnames.forEach((surname) => {
      const result = latestResult.results.find((item) => item.candidate === candidate.text && item.surname === surname.text);
      row.appendChild(resultCell(result));
    });
    tbody.appendChild(row);
  });
  table.appendChild(tbody);
  resultsWrap.appendChild(table);
  resultsWrap.appendChild(sourceNote());
  renderAnalysis();
}

function candidateSummary(candidate) {
  const wrap = document.createElement("div");
  const name = document.createElement("div");
  name.className = "candidate-name";
  name.textContent = candidate.text;
  const reading = document.createElement("div");
  reading.className = "reading";
  reading.textContent = candidate.reading;
  const chars = document.createElement("div");
  chars.className = "char-list";
  chars.appendChild(sectionLabel(t("characters")));
  candidate.characters.forEach((item) => {
    const line = document.createElement("div");
    line.textContent = `${item.character}: ${item.strokes} ${t("strokes")}${formatMeanings(item)}`;
    chars.appendChild(line);
  });
  wrap.append(name, reading, chars);
  if (candidate.note) {
    const note = document.createElement("div");
    note.className = "muted";
    note.textContent = candidate.note;
    wrap.appendChild(note);
  }
  return wrap;
}

function formatMeanings(item) {
  if (!item.meanings_en || !item.meanings_en.length) return "";
  return ` - ${item.meanings_en.slice(0, 3).join("; ")}`;
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
    item.innerHTML = `<span>${name}</span><span class="score">${value} ${escapeHtml(result.grid_scores[name] || "")}</span>`;
    grids.appendChild(item);
  });

  const elements = document.createElement("div");
  elements.className = "grid-list";
  elements.appendChild(sectionLabel(t("elements")));
  elements.appendChild(textLine(Object.entries(result.five_elements).map(([name, value]) => `${name}:${value}`).join(" / ")));
  elements.appendChild(sectionLabel(t("sounds")));
  elements.appendChild(textLine(`${result.sound_elements.surname_final.sound}:${result.sound_elements.surname_final.element} / ${result.sound_elements.given_first.sound}:${result.sound_elements.given_first.element}`));

  cell.append(top, grids, elements);
  if (result.flags.length) {
    const flags = document.createElement("div");
    flags.className = "flags";
    flags.appendChild(sectionLabel(t("flags")));
    result.flags.forEach((flag) => flags.appendChild(textLine(flag)));
    cell.appendChild(flags);
  }
  return cell;
}

function renderAnalysis() {
  if (!latestResult.analysis.length) {
    analysisList.appendChild(emptyMessage(t("noAnalysis")));
    return;
  }
  latestResult.analysis.forEach((item, index) => {
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

function sourceNote() {
  const note = document.createElement("div");
  note.className = "source-note";
  note.textContent = t("sourceNote");
  return note;
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
    saveState();
    renderAll();
    setStatus("imported");
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
