import { PLATFORMS, STATUSES } from "./lib/constants.js";
import { $, downloadText, on, setText } from "./lib/dom.js";
import {
  computeStats,
  deleteApplication,
  exportJSON,
  getState,
  importJSON,
  updateApplication
} from "./lib/db.js";

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeAttr(value) {
  return String(value).replaceAll('"', "&quot;");
}

function populateSelect(select, values, { includeAll = false } = {}) {
  const opts = [];
  if (includeAll) opts.push(`<option value="">All</option>`);
  for (const v of values) {
    opts.push(`<option value="${v.replaceAll('"', "&quot;")}">${v}</option>`);
  }
  select.innerHTML = opts.join("");
}

function normalizeFilters() {
  return {
    q: $("#q").value.trim().toLowerCase(),
    status: $("#status").value,
    platform: $("#platform").value,
    company: $("#company").value.trim().toLowerCase(),
    from: $("#from").value,
    to: $("#to").value
  };
}

function matches(app, filters) {
  if (filters.status && (app.status || "") !== filters.status) return false;
  if (filters.platform && (app.platform || "") !== filters.platform) return false;
  if (filters.company && (app.company || "").trim().toLowerCase() !== filters.company) {
    return false;
  }
  if (filters.from && (app.appliedDate || "") < filters.from) return false;
  if (filters.to && (app.appliedDate || "") > filters.to) return false;
  if (filters.q) {
    const hay = `${app.company || ""} ${app.role || ""}`.toLowerCase();
    if (!hay.includes(filters.q)) return false;
  }
  return true;
}

function renderStats(state) {
  const stats = computeStats(state);
  setText("#progressText", `${stats.total} / ${stats.goal} (${stats.percent}%)`);
  $("#progressBar").style.width = `${stats.percent}%`;
  setText("#streakText", `${stats.streak}`);
  setText("#weekText", `${stats.appliedThisWeek}`);

  const milestoneEl = $("#milestoneText");
  if (stats.hitMilestone) milestoneEl.textContent = `Milestone: ${stats.hitMilestone}!`;
  else if (stats.nextMilestone) milestoneEl.textContent = `Next: ${stats.nextMilestone}`;
  else milestoneEl.textContent = "";
}

let CURRENT_STATE = null;
let EDIT_ID = null;

function renderTable(state) {
  const filters = normalizeFilters();
  const filtered = state.applications
    .slice()
    .sort((a, b) => (a.appliedDate < b.appliedDate ? 1 : -1))
    .filter((a) => matches(a, filters));

  setText("#countText", `${filtered.length} shown • ${state.applications.length} total`);

  const tbody = $("#tbody");
  tbody.innerHTML = filtered
    .map(
      (a) => `
      <tr data-id="${escapeAttr(a.id)}">
        <td class="nowrap">${escapeHtml(a.appliedDate)}</td>
        <td>${escapeHtml(a.company)}</td>
        <td>${escapeHtml(a.role)}</td>
        <td class="nowrap">${escapeHtml(a.status || "Applied")}</td>
        <td class="nowrap">${escapeHtml(a.platform || "")}</td>
        <td>${a.url ? `<a href="${escapeAttr(a.url)}" target="_blank" rel="noreferrer">Open</a>` : ""}</td>
        <td class="nowrap"><button class="edit" type="button">Edit</button></td>
      </tr>
    `
    )
    .join("");

  for (const btn of tbody.querySelectorAll("button.edit")) {
    btn.addEventListener("click", (e) => {
      const tr = e.target.closest("tr");
      const id = tr?.getAttribute("data-id");
      if (!id) return;
      openEdit(id);
    });
  }
}

function setMessage(text, isError = false) {
  const el = $("#message");
  el.textContent = text;
  el.style.color = isError ? "#fb7185" : "";
}

function setEditMessage(text, isError = false) {
  const el = $("#editMessage");
  el.textContent = text;
  el.style.color = isError ? "#fb7185" : "";
}

function openEdit(id) {
  const app = CURRENT_STATE?.applications.find((a) => a.id === id);
  if (!app) return;
  EDIT_ID = id;
  $("#e_company").value = app.company || "";
  $("#e_role").value = app.role || "";
  $("#e_appliedDate").value = app.appliedDate || "";
  $("#e_status").value = app.status || "Applied";
  $("#e_platform").value = app.platform || "";
  $("#e_location").value = app.location || "";
  $("#e_url").value = app.url || "";
  $("#e_notes").value = app.notes || "";
  setEditMessage("");
  $("#editDialog").showModal();
}

async function saveEdit() {
  if (!EDIT_ID) return;
  try {
    const next = await updateApplication(EDIT_ID, {
      company: $("#e_company").value,
      role: $("#e_role").value,
      appliedDate: $("#e_appliedDate").value,
      status: $("#e_status").value,
      platform: $("#e_platform").value,
      location: $("#e_location").value,
      url: $("#e_url").value,
      notes: $("#e_notes").value
    });
    CURRENT_STATE = next;
    renderStats(next);
    renderTable(next);
    setEditMessage("Saved.");
  } catch (err) {
    setEditMessage(err?.message || String(err), true);
  }
}

async function delEdit() {
  if (!EDIT_ID) return;
  const ok = confirm("Delete this application?");
  if (!ok) return;
  const next = await deleteApplication(EDIT_ID);
  CURRENT_STATE = next;
  $("#editDialog").close();
  renderStats(next);
  renderTable(next);
}

async function doExport() {
  const json = await exportJSON();
  downloadText("1000-applications-backup.json", json);
  setMessage("Exported.");
}

async function doImport(file) {
  const text = await file.text();
  try {
    const next = await importJSON(text);
    CURRENT_STATE = next;
    renderStats(next);
    renderTable(next);
    setMessage("Imported.");
  } catch (err) {
    setMessage(err?.message || String(err), true);
  }
}

function clearFilters() {
  $("#q").value = "";
  $("#status").value = "";
  $("#platform").value = "";
  $("#company").value = "";
  $("#from").value = "";
  $("#to").value = "";
}

async function refresh() {
  const state = await getState();
  CURRENT_STATE = state;
  renderStats(state);
  renderTable(state);
}

async function main() {
  populateSelect($("#status"), STATUSES, { includeAll: true });
  populateSelect($("#platform"), PLATFORMS, { includeAll: true });
  populateSelect($("#e_status"), STATUSES);
  populateSelect($("#e_platform"), PLATFORMS);

  for (const id of ["q", "status", "platform", "company", "from", "to"]) {
    $("#" + id).addEventListener("input", () => {
      if (!CURRENT_STATE) return;
      renderTable(CURRENT_STATE);
    });
    $("#" + id).addEventListener("change", () => {
      if (!CURRENT_STATE) return;
      renderTable(CURRENT_STATE);
    });
  }

  on("#clear", "click", () => {
    clearFilters();
    if (CURRENT_STATE) renderTable(CURRENT_STATE);
  });
  on("#save", "click", saveEdit);
  on("#del", "click", delEdit);

  on("#export", "click", doExport);
  on("#import", "click", () => $("#importFile").click());
  on("#importFile", "change", async (e) => {
    const file = e.target.files?.[0];
    if (file) await doImport(file);
    e.target.value = "";
  });

  await refresh();
}

main();

