import { PLATFORMS, STATUSES } from "./lib/constants.js";
import { todayISO } from "./lib/date.js";
import { $, downloadText, on, setText, setValue } from "./lib/dom.js";
import {
  addApplication,
  computeStats,
  exportJSON,
  getState,
  importJSON,
  updateSettings
} from "./lib/db.js";

function setMessage(text, isError = false) {
  const el = $("#message");
  el.textContent = text;
  el.style.color = isError ? "#fb7185" : "";
}

function setSettingsMessage(text, isError = false) {
  const el = $("#settingsMessage");
  el.textContent = text;
  el.style.color = isError ? "#fb7185" : "";
}

function populateSelect(select, values) {
  select.innerHTML = values
    .map((v) => `<option value="${v.replaceAll('"', "&quot;")}">${v}</option>`)
    .join("");
}

function renderRecent(state) {
  const container = $("#recent");
  container.innerHTML = "";

  const list = state.applications
    .slice()
    .sort((a, b) => (a.appliedDate < b.appliedDate ? 1 : -1))
    .slice(0, 5);

  if (!list.length) {
    const div = document.createElement("div");
    div.className = "muted";
    div.textContent = "No applications yet. Log one today.";
    container.appendChild(div);
    return;
  }

  for (const app of list) {
    const div = document.createElement("div");
    div.className = "row";
    div.style.alignItems = "flex-start";
    div.innerHTML = `
      <div>
        <div class="title">${escapeHtml(app.company)} — ${escapeHtml(app.role)}</div>
        <div class="muted">${escapeHtml(app.appliedDate)} • ${escapeHtml(app.status || "Applied")}</div>
      </div>
      ${app.url ? `<a class="muted" href="${escapeAttr(app.url)}" target="_blank" rel="noreferrer">Link</a>` : ""}
    `;
    container.appendChild(div);
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeAttr(value) {
  return String(value).replaceAll('"', "&quot;");
}

function renderStats(state) {
  const stats = computeStats(state);
  setText("#progressText", `${stats.total} / ${stats.goal} (${stats.percent}%)`);
  $("#progressBar").style.width = `${stats.percent}%`;
  setText("#streakText", `${stats.streak}`);
  setText("#weekText", `${stats.appliedThisWeek}`);

  if (stats.hitMilestone) {
    setText("#milestoneText", `Milestone: ${stats.hitMilestone}!`);
  } else if (stats.nextMilestone) {
    setText("#milestoneText", `Next: ${stats.nextMilestone}`);
  } else {
    setText("#milestoneText", "");
  }
}

async function refresh() {
  const state = await getState();
  renderStats(state);
  renderRecent(state);
  setValue("#appliedDate", todayISO());
  setValue("#goalNumber", String(state.settings.goalNumber || 1000));
}

async function logThisPage() {
  setMessage("");
  const resp = await chrome.runtime.sendMessage({ type: "GET_ACTIVE_TAB_CONTEXT" });
  if (resp?.url) setValue("#url", resp.url);
  if (resp?.title) {
    // Heuristic: "Role - Company" or "Company - Role"
    const parts = resp.title.split(" - ").map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      // Use first as role by default; user can swap quickly.
      setValue("#role", parts[0]);
      setValue("#company", parts[parts.length - 1]);
    } else {
      setValue("#role", resp.title);
    }
  }
  setMessage("Page captured. Fill missing fields and save.");
}

async function save() {
  setMessage("");
  const input = {
    company: $("#company").value,
    role: $("#role").value,
    appliedDate: $("#appliedDate").value,
    url: $("#url").value,
    location: $("#location").value,
    platform: $("#platform").value,
    status: $("#status").value,
    notes: $("#notes").value
  };

  try {
    const result = await addApplication(input);
    if (result.duplicate) {
      setMessage("Duplicate detected (same URL or same company+role+date).", true);
      return;
    }
    setMessage("Logged.");
    // reset minimal fields
    $("#company").value = "";
    $("#role").value = "";
    $("#url").value = "";
    $("#location").value = "";
    $("#notes").value = "";
    setValue("#appliedDate", todayISO());
    await refresh();
  } catch (err) {
    setMessage(err?.message || String(err), true);
  }
}

async function saveSettings() {
  setSettingsMessage("");
  const goalNumber = Number($("#goalNumber").value);
  if (!Number.isFinite(goalNumber) || goalNumber <= 0) {
    setSettingsMessage("Goal must be a positive number.", true);
    return;
  }
  await updateSettings({ goalNumber });
  setSettingsMessage("Saved.");
  await refresh();
}

async function doExport() {
  const json = await exportJSON();
  downloadText("1000-applications-backup.json", json);
  setSettingsMessage("Exported.");
}

async function doImport(file) {
  const text = await file.text();
  try {
    await importJSON(text);
    setSettingsMessage("Imported.");
    await refresh();
  } catch (err) {
    setSettingsMessage(err?.message || String(err), true);
  }
}

async function main() {
  populateSelect($("#status"), STATUSES);
  populateSelect($("#platform"), PLATFORMS);
  setValue("#status", "Applied");
  setValue("#platform", "LinkedIn");
  setValue("#appliedDate", todayISO());

  on("#save", "click", save);
  on("#logPage", "click", logThisPage);
  on("#openSettings", "click", () => $("#settingsDialog").showModal());
  on("#saveSettings", "click", saveSettings);
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

