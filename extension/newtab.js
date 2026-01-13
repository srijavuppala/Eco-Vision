import { $, setText } from "./lib/dom.js";
import { computeStats, getState } from "./lib/db.js";

async function refresh() {
  const state = await getState();
  const stats = computeStats(state);
  setText("#progressText", `${stats.total} / ${stats.goal} (${stats.percent}%)`);
  $("#progressBar").style.width = `${stats.percent}%`;
  setText("#streakText", `${stats.streak}`);
  setText("#weekText", `${stats.appliedThisWeek}`);
  if (stats.hitMilestone) setText("#milestoneText", `Milestone: ${stats.hitMilestone}!`);
  else if (stats.nextMilestone) setText("#milestoneText", `Next: ${stats.nextMilestone}`);
  else setText("#milestoneText", "");
}

refresh();

