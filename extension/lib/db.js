import { DEFAULT_GOAL, MILESTONES } from "./constants.js";
import { toISODate, todayISO, startOfISOWeek } from "./date.js";
import { randomId } from "./id.js";

const STORAGE_KEY = "thousand_applications_v1";

function nowISO() {
  return new Date().toISOString();
}

function defaultState() {
  return {
    settings: {
      goalNumber: DEFAULT_GOAL,
      startDate: todayISO(),
      theme: "dark"
    },
    applications: []
  };
}

async function readRaw() {
  const result = await chrome.storage.local.get([STORAGE_KEY]);
  return result[STORAGE_KEY];
}

async function writeRaw(state) {
  await chrome.storage.local.set({ [STORAGE_KEY]: state });
}

export async function getState() {
  const raw = await readRaw();
  if (!raw || typeof raw !== "object") {
    const state = defaultState();
    await writeRaw(state);
    return state;
  }

  const settings = {
    ...defaultState().settings,
    ...(raw.settings || {})
  };
  const applications = Array.isArray(raw.applications) ? raw.applications : [];
  return { settings, applications };
}

export async function updateSettings(partial) {
  const state = await getState();
  const next = {
    ...state,
    settings: { ...state.settings, ...partial }
  };
  await writeRaw(next);
  return next;
}

function normalizeApplication(input) {
  const createdAt = input.createdAt || nowISO();
  const updatedAt = nowISO();

  return {
    id: input.id || randomId("app"),
    company: String(input.company || "").trim(),
    role: String(input.role || "").trim(),
    appliedDate: toISODate(input.appliedDate || todayISO()),
    url: input.url ? String(input.url).trim() : "",
    location: input.location ? String(input.location).trim() : "",
    platform: input.platform ? String(input.platform).trim() : "",
    status: input.status ? String(input.status).trim() : "Applied",
    notes: input.notes ? String(input.notes).trim() : "",
    createdAt,
    updatedAt
  };
}

export function findDuplicate(applications, candidate) {
  const url = (candidate.url || "").trim();
  if (url) {
    const existingByUrl = applications.find((a) => (a.url || "").trim() === url);
    if (existingByUrl) return existingByUrl;
  }

  const keyCompany = (candidate.company || "").trim().toLowerCase();
  const keyRole = (candidate.role || "").trim().toLowerCase();
  const keyDate = toISODate(candidate.appliedDate || todayISO());

  return (
    applications.find(
      (a) =>
        (a.company || "").trim().toLowerCase() === keyCompany &&
        (a.role || "").trim().toLowerCase() === keyRole &&
        toISODate(a.appliedDate) === keyDate
    ) || null
  );
}

export async function addApplication(input, { allowDuplicate = false } = {}) {
  const state = await getState();
  const candidate = normalizeApplication(input);

  if (!candidate.company) throw new Error("Company is required");
  if (!candidate.role) throw new Error("Role/title is required");

  const duplicate = findDuplicate(state.applications, candidate);
  if (duplicate && !allowDuplicate) {
    return { state, duplicate, added: null };
  }

  const applications = [candidate, ...state.applications];
  const next = { ...state, applications };
  await writeRaw(next);
  return { state: next, duplicate: null, added: candidate };
}

export async function updateApplication(id, patch) {
  const state = await getState();
  const idx = state.applications.findIndex((a) => a.id === id);
  if (idx < 0) throw new Error("Not found");

  const updated = normalizeApplication({
    ...state.applications[idx],
    ...patch,
    id
  });
  updated.createdAt = state.applications[idx].createdAt;

  const applications = [...state.applications];
  applications[idx] = updated;
  const next = { ...state, applications };
  await writeRaw(next);
  return next;
}

export async function deleteApplication(id) {
  const state = await getState();
  const applications = state.applications.filter((a) => a.id !== id);
  const next = { ...state, applications };
  await writeRaw(next);
  return next;
}

export async function exportJSON() {
  const state = await getState();
  return JSON.stringify(state, null, 2);
}

export async function importJSON(text) {
  const parsed = JSON.parse(text);
  const next = {
    settings: {
      ...defaultState().settings,
      ...(parsed.settings || {})
    },
    applications: Array.isArray(parsed.applications)
      ? parsed.applications.map(normalizeApplication)
      : []
  };
  await writeRaw(next);
  return next;
}

function isConsecutiveDay(dateA, dateB) {
  const a = new Date(`${dateA}T00:00:00Z`).getTime();
  const b = new Date(`${dateB}T00:00:00Z`).getTime();
  return a - b === 24 * 60 * 60 * 1000;
}

export function computeStats(state) {
  const goal = Number(state.settings.goalNumber) || DEFAULT_GOAL;
  const total = state.applications.length;
  const percent = goal > 0 ? Math.min(100, Math.round((total / goal) * 100)) : 0;

  const dates = new Set(state.applications.map((a) => toISODate(a.appliedDate)));
  const uniqueDates = [...dates].sort((a, b) => (a < b ? 1 : -1));

  let streak = 0;
  for (let i = 0; i < uniqueDates.length; i += 1) {
    if (i === 0) {
      streak = 1;
      continue;
    }
    if (isConsecutiveDay(uniqueDates[i - 1], uniqueDates[i])) streak += 1;
    else break;
  }

  const weekStart = startOfISOWeek(todayISO());
  const appliedThisWeek = state.applications.filter(
    (a) => toISODate(a.appliedDate) >= weekStart
  ).length;

  const nextMilestone = MILESTONES.find((m) => total < m) ?? null;
  const hitMilestone = MILESTONES.includes(total) ? total : null;

  return {
    goal,
    total,
    percent,
    streak,
    appliedThisWeek,
    weekStart,
    nextMilestone,
    hitMilestone
  };
}

