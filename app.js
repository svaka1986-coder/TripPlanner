const DATA_FILE = "./norway_tripinfo.json";
const STORAGE_KEY = "trip_dashboard_state_v1";

let syncAdapter = {
  isEnabled: false,
  notifyStateChanged: () => {}
};

let uiRefresh = () => {};

const defaultSharedChecklist = [
  "Snacks + water bottles",
  "Walkie-talkies charged",
  "Kids jackets in each car",
  "Offline maps cached",
  "Passports and IDs"
];

const defaultDayChecklist = [
  "Fuel check",
  "Navigation set",
  "Photo moment completed",
  "Evening plan confirmed"
];

function loadState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveState(state, options = {}) {
  const { notify = true } = options;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  if (notify) {
    syncAdapter.notifyStateChanged(state);
  }
}

function createGoogleMapsLink(queryText) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(queryText)}`;
}

function formatCurrency(value, currency) {
  try {
    return new Intl.NumberFormat("en-IE", { style: "currency", currency }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

function toDayNumber(dayRef) {
  if (!dayRef) return null;
  const match = String(dayRef).match(/(\d+)/);
  return match ? Number(match[1]) : null;
}

function computeSplit(entry, familyIds) {
  const split = {};
  const total = Number(entry.amount || 0);

  if (entry.split_mode === "family") {
    familyIds.forEach((id) => {
      split[id] = id === entry.family_id ? total : 0;
    });
    return split;
  }

  if (entry.split_mode === "custom" && entry.custom_split) {
    familyIds.forEach((id) => {
      split[id] = total * ((Number(entry.custom_split[id]) || 0) / 100);
    });
    return split;
  }

  const equalShare = familyIds.length ? total / familyIds.length : 0;
  familyIds.forEach((id) => {
    split[id] = equalShare;
  });
  return split;
}

function parseCustomSplit(rawText, familyIds) {
  const map = {};
  if (!rawText?.trim()) return null;

  const tokens = rawText
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  for (const token of tokens) {
    const [id, pct] = token.split(":").map((v) => v.trim());
    if (!id || !pct || !familyIds.includes(id)) return null;
    const value = Number(pct);
    if (!Number.isFinite(value) || value < 0) return null;
    map[id] = value;
  }

  const totalPct = Object.values(map).reduce((sum, n) => sum + Number(n || 0), 0);
  if (Math.abs(totalPct - 100) > 0.01) return null;
  return map;
}

function getFirebaseConfig() {
  if (window.TRIP_FIREBASE_CONFIG && typeof window.TRIP_FIREBASE_CONFIG === "object") {
    return window.TRIP_FIREBASE_CONFIG;
  }

  const raw = localStorage.getItem("trip_firebase_config");
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function applyRemoteStatePatch(patch) {
  const latest = loadState();

  if (patch.convoy && typeof patch.convoy === "object") {
    Object.entries(patch.convoy).forEach(([key, value]) => {
      if (key.startsWith("vehicle_")) {
        latest[key] = value;
      }
    });
  }

  if (Array.isArray(patch.expenses)) {
    latest.expenses = patch.expenses;
  }

  saveState(latest, { notify: false });
  uiRefresh();
}

async function setupFirebaseSync() {
  const config = getFirebaseConfig();
  if (!config) return;

  try {
    const module = await import("./firebase-sync.js");
    const adapter = await module.createFirebaseSync({
      config,
      tripId: config.tripId || "norway-family-trip",
      onRemoteState: applyRemoteStatePatch
    });

    syncAdapter = adapter;
    syncAdapter.notifyStateChanged(loadState());

    const meta = document.getElementById("tripMeta");
    meta.textContent = `${meta.textContent} | Firebase sync enabled`;
  } catch {
    const meta = document.getElementById("tripMeta");
    meta.textContent = `${meta.textContent} | Firebase sync failed`;
  }
}

function buildBudgetEntries(entries, familyIds) {
  return entries.map((entry) => ({
    id: entry.id,
    category: entry.category,
    amount: Number(entry.amount || 0),
    note: entry.note || "",
    split_mode: entry.split_mode || "equal",
    family_id: entry.family_id || null,
    custom_split: entry.custom_split || null,
    split_amounts: computeSplit(entry, familyIds),
    created_at: entry.created_at
  }));
}

function buildTripJsonSnapshot(data, entries, familyIds) {
  const snapshot = JSON.parse(JSON.stringify(data));
  snapshot.budget = snapshot.budget || {};
  snapshot.budget.entries = buildBudgetEntries(entries, familyIds);
  snapshot.budget.last_synced_at = new Date().toISOString();
  return snapshot;
}

function dayDateLabel(day) {
  if (day.date?.label) return day.date.label;
  if (day.date?.iso) return day.date.iso;
  if (day.date?.iso_range) return `${day.date.iso_range.start} to ${day.date.iso_range.end}`;
  return "Date TBD";
}

function makeChecklist(container, key, items, state) {
  const values = state[key] || {};
  container.replaceChildren();

  items.forEach((item, idx) => {
    const id = `${key}_${idx}`;
    const row = document.createElement("label");
    row.className = "check-item";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = Boolean(values[idx]);
    input.id = id;

    const text = document.createElement("span");
    text.textContent = item;

    input.addEventListener("change", () => {
      const latest = loadState();
      latest[key] = latest[key] || {};
      latest[key][idx] = input.checked;
      saveState(latest);
    });

    row.append(input, text);
    container.append(row);
  });
}

function renderConvoy(data, state) {
  const host = document.getElementById("convoyStatus");
  const template = document.getElementById("statusCardTemplate");
  host.replaceChildren();

  data.convoy.vehicles.forEach((vehicle) => {
    const node = template.content.cloneNode(true);
    const card = node.querySelector(".status-card");
    const title = node.querySelector("h3");
    const value = node.querySelector(".status-value");
    const actions = node.querySelectorAll("button");

    const key = `vehicle_${vehicle.vehicle_id}`;
    const current = state[key] || "Ready";

    title.textContent = `${vehicle.vehicle_id.toUpperCase()} (${vehicle.role})`;
    value.textContent = `Status: ${current}`;

    actions.forEach((btn) => {
      btn.addEventListener("click", () => {
        const latest = loadState();
        latest[key] = btn.dataset.status;
        saveState(latest);
        value.textContent = `Status: ${btn.dataset.status}`;
      });
    });

    host.append(card);
  });
}

function daySortValue(day) {
  if (day.day_ref?.type === "single") return day.day_ref.day;
  if (day.day_ref?.type === "range") return day.day_ref.start_day;
  return 999;
}

function renderDayPicker(days) {
  const picker = document.getElementById("dayPicker");
  picker.replaceChildren();

  days.forEach((day, idx) => {
    const option = document.createElement("option");
    option.value = String(idx);
    option.textContent = `${day.day_id} - ${day.title}`;
    picker.append(option);
  });

  return picker;
}

function renderDayCard(day, state) {
  const host = document.getElementById("dayCardContainer");
  const template = document.getElementById("dayCardTemplate");
  host.replaceChildren();

  const node = template.content.cloneNode(true);
  node.querySelector(".day-title").textContent = day.title;
  node.querySelector(".day-date").textContent = dayDateLabel(day);
  node.querySelector(".route").textContent = `Route: ${day.route}`;
  node.querySelector(".drive").textContent = `Drive: ${day.drive?.summary || "-"}`;

  const stopsList = node.querySelector(".stops");
  const mapLinks = node.querySelector(".map-links");

  const routeLink = document.createElement("a");
  routeLink.href = createGoogleMapsLink(day.route || day.title);
  routeLink.target = "_blank";
  routeLink.rel = "noopener noreferrer";
  routeLink.className = "map-link";
  routeLink.textContent = "Open route in Google Maps";
  mapLinks.append(routeLink);

  (day.stop_options || []).forEach((stop) => {
    const li = document.createElement("li");
    li.textContent = stop;
    stopsList.append(li);

    const stopLink = document.createElement("a");
    stopLink.href = createGoogleMapsLink(stop);
    stopLink.target = "_blank";
    stopLink.rel = "noopener noreferrer";
    stopLink.className = "map-link";
    stopLink.textContent = stop;
    mapLinks.append(stopLink);
  });

  const actList = node.querySelector(".activities");
  (day.activities || []).forEach((act) => {
    const li = document.createElement("li");
    li.textContent = act;
    actList.append(li);
  });

  const food = day.food_plan || {};
  node.querySelector(".food").textContent = `Packed: ${food.self_prepared || "-"} | Local: ${food.local_option || "-"}`;

  const dayChecklist = node.querySelector(".day-checklist");
  makeChecklist(dayChecklist, `day_checklist_${day.day_id}`, defaultDayChecklist, state);

  host.append(node);
}

function renderExpenses(data, state) {
  const form = document.getElementById("expenseForm");
  const categorySelect = document.getElementById("expenseCategory");
  const amountInput = document.getElementById("expenseAmount");
  const noteInput = document.getElementById("expenseNote");
  const splitModeInput = document.getElementById("expenseSplitMode");
  const familyInput = document.getElementById("expenseFamily");
  const customSplitInput = document.getElementById("expenseCustomSplit");
  const totalLabel = document.getElementById("expenseTotal");
  const splitSummary = document.getElementById("familySplitSummary");
  const list = document.getElementById("expenseList");
  const exportBtn = document.getElementById("exportCsvBtn");
  const exportTripJsonBtn = document.getElementById("exportTripJsonBtn");
  const syncStatus = document.getElementById("syncStatus");
  const categories = data.budget?.tracking_categories || [];
  const currency = data.budget?.currency || "EUR";
  const families = data.group?.families || [];
  const familyIds = families.map((f) => f.family_id);
  const familyLabels = Object.fromEntries(families.map((f) => [f.family_id, f.label || f.family_id]));

  categorySelect.replaceChildren();
  categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    categorySelect.append(option);
  });

  familyInput.replaceChildren();
  families.forEach((family) => {
    const option = document.createElement("option");
    option.value = family.family_id;
    option.textContent = family.label || family.family_id;
    familyInput.append(option);
  });

  const updateSplitFields = () => {
    const mode = splitModeInput.value;
    familyInput.disabled = mode !== "family";
    customSplitInput.disabled = mode !== "custom";
  };
  if (!splitModeInput.dataset.boundChange) {
    splitModeInput.addEventListener("change", updateSplitFields);
    splitModeInput.dataset.boundChange = "1";
  }
  updateSplitFields();

  const toCsv = (rows) => {
    const esc = (value) => `"${String(value ?? "").replaceAll("\"", '""')}"`;
    return rows.map((row) => row.map(esc).join(",")).join("\n");
  };

  if (!exportBtn.dataset.boundClick) {
    exportBtn.addEventListener("click", () => {
      const latest = loadState();
      const entries = latest.expenses || [];
      const rows = [["id", "created_at", "category", "amount", "currency", "note", "split_mode", "family_id", "custom_split_json"]];
      entries.forEach((entry) => {
        rows.push([
          entry.id,
          entry.created_at,
          entry.category,
          entry.amount,
          currency,
          entry.note || "",
          entry.split_mode || "equal",
          entry.family_id || "",
          entry.custom_split ? JSON.stringify(entry.custom_split) : ""
        ]);
      });

      const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `trip-expenses-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    });
    exportBtn.dataset.boundClick = "1";
  }

  if (!exportTripJsonBtn.dataset.boundClick) {
    exportTripJsonBtn.addEventListener("click", () => {
      const latest = loadState();
      const entries = latest.expenses || [];
      const snapshot = buildTripJsonSnapshot(data, entries, familyIds);
      const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "norway_tripinfo.updated.json";
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      syncStatus.textContent = "Downloaded norway_tripinfo.updated.json with merged budget.entries from local expenses.";
    });
    exportTripJsonBtn.dataset.boundClick = "1";
  }

  const drawEntries = () => {
    const latest = loadState();
    const entries = latest.expenses || [];
    list.replaceChildren();
    splitSummary.replaceChildren();

    const total = entries.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    totalLabel.textContent = `Total tracked: ${formatCurrency(total, currency)} (${entries.length} entries)`;

    const splitTotals = Object.fromEntries(familyIds.map((id) => [id, 0]));
    entries.forEach((entry) => {
      const split = computeSplit(entry, familyIds);
      familyIds.forEach((id) => {
        splitTotals[id] += Number(split[id] || 0);
      });
    });

    familyIds.forEach((id) => {
      const pill = document.createElement("span");
      pill.className = "split-pill";
      pill.textContent = `${familyLabels[id]}: ${formatCurrency(splitTotals[id], currency)}`;
      splitSummary.append(pill);
    });

    if (!entries.length) {
      const li = document.createElement("li");
      li.textContent = "No expenses added yet.";
      list.append(li);
      return;
    }

    entries
      .slice()
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .forEach((entry) => {
        const li = document.createElement("li");
        li.className = "expense-item";

        const left = document.createElement("div");
        let splitLine = "Equal split";
        if (entry.split_mode === "family") {
          splitLine = `Single family: ${familyLabels[entry.family_id] || entry.family_id}`;
        } else if (entry.split_mode === "custom") {
          splitLine = `Custom split: ${Object.entries(entry.custom_split || {})
            .map(([k, v]) => `${familyLabels[k] || k} ${v}%`)
            .join(" | ")}`;
        }
        left.innerHTML = `<strong>${entry.category}: ${formatCurrency(Number(entry.amount), currency)}</strong><div class="expense-meta">${entry.note || "No note"}</div><div class="expense-meta">${splitLine}</div>`;

        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "danger-btn";
        remove.textContent = "Remove";
        remove.addEventListener("click", () => {
          const newest = loadState();
          newest.expenses = (newest.expenses || []).filter((item) => item.id !== entry.id);
          saveState(newest);
          drawEntries();
        });

        li.append(left, remove);
        list.append(li);
      });
  };

  if (!form.dataset.boundSubmit) {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const amount = Number(amountInput.value);
      if (!Number.isFinite(amount) || amount <= 0) return;
      const splitMode = splitModeInput.value;
      const custom = splitMode === "custom" ? parseCustomSplit(customSplitInput.value, familyIds) : null;
      if (splitMode === "custom" && !custom) {
        customSplitInput.setCustomValidity("Custom split must total 100 and use family ids like Vaka:40,Gopu:60");
        customSplitInput.reportValidity();
        return;
      }
      customSplitInput.setCustomValidity("");

      const latest = loadState();
      latest.expenses = latest.expenses || [];
      latest.expenses.push({
        id: crypto.randomUUID(),
        category: categorySelect.value,
        amount,
        note: noteInput.value.trim(),
        split_mode: splitMode,
        family_id: splitMode === "family" ? familyInput.value : null,
        custom_split: splitMode === "custom" ? custom : null,
        created_at: new Date().toISOString()
      });
      saveState(latest);

      amountInput.value = "";
      noteInput.value = "";
      customSplitInput.value = "";
      drawEntries();
    });
    form.dataset.boundSubmit = "1";
  }

  drawEntries();
}

function renderBookings(data) {
  const host = document.getElementById("bookingCards");
  host.replaceChildren();

  const days = data.days || [];
  const dayById = Object.fromEntries(days.map((d) => [d.day_id, d]));
  const ferries = data.bookings?.ferries || [];
  const stays = data.bookings?.stay_transitions || [];

  const addCard = (title, kind, dayReference, bodyText, noteText) => {
    const card = document.createElement("article");
    card.className = "booking-card";

    const dayData = dayById[dayReference] || null;
    const refNumber = toDayNumber(dayReference);
    const dayNumber = dayData?.day_ref?.day || dayData?.day_ref?.start_day || refNumber;
    const dayDate = dayData ? dayDateLabel(dayData) : "Date not mapped";

    const badgeRow = document.createElement("div");
    badgeRow.className = "badge-row";

    const kindBadge = document.createElement("span");
    kindBadge.className = "badge badge-info";
    kindBadge.textContent = kind;

    const dayBadge = document.createElement("span");
    dayBadge.className = "badge badge-ok";
    dayBadge.textContent = dayNumber ? `Day ${dayNumber}` : "Day TBD";

    const reminderBadge = document.createElement("span");
    reminderBadge.className = "badge badge-warn";
    reminderBadge.textContent = "Reminder";

    badgeRow.append(kindBadge, dayBadge, reminderBadge);

    const heading = document.createElement("h3");
    heading.textContent = title;

    const date = document.createElement("p");
    date.className = "expense-meta";
    date.textContent = dayDate;

    const body = document.createElement("p");
    body.textContent = bodyText;

    const note = document.createElement("p");
    note.className = "expense-meta";
    note.textContent = noteText || "No reminder note";

    card.append(badgeRow, heading, date, body, note);
    host.append(card);
  };

  ferries.forEach((ferry) => {
    addCard(
      ferry.route || "Ferry",
      "Ferry",
      ferry.day_reference,
      `Status: ${ferry.status || "planned"}`,
      ferry.notes
    );
  });

  stays.forEach((stay, idx) => {
    addCard(
      `Stay Transition ${idx + 1}`,
      "Accommodation",
      stay.day_reference,
      `Checkout ${stay.checkout || "-"} | Checkin ${stay.checkin || "-"}`,
      stay.notes
    );
  });

  if (!ferries.length && !stays.length) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "No booking reminders found in trip data.";
    host.append(empty);
  }
}

async function init() {
  const state = loadState();
  const res = await fetch(DATA_FILE);
  if (!res.ok) throw new Error("Unable to load trip data");

  const data = await res.json();

  document.getElementById("tripTitle").textContent = data.trip_meta.trip_name;
  document.getElementById("tripMeta").textContent = `${data.trip_meta.start_date} to ${data.trip_meta.end_date} | ${data.group.totals.travelers} travelers`;

  renderConvoy(data, state);
  makeChecklist(document.getElementById("sharedChecklist"), "shared_checklist", defaultSharedChecklist, state);
  renderExpenses(data, state);
  renderBookings(data);

  const sortedDays = [...data.days].sort((a, b) => daySortValue(a) - daySortValue(b));
  const picker = renderDayPicker(sortedDays);
  renderDayCard(sortedDays[0], state);

  uiRefresh = () => {
    const latest = loadState();
    renderConvoy(data, latest);
    renderExpenses(data, latest);
    const currentDay = sortedDays[Number(picker.value)] || sortedDays[0];
    renderDayCard(currentDay, latest);
  };

  picker.addEventListener("change", () => {
    const day = sortedDays[Number(picker.value)] || sortedDays[0];
    renderDayCard(day, loadState());
  });

  document.getElementById("printBriefBtn").addEventListener("click", () => {
    window.print();
  });

  await setupFirebaseSync();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
}

init().catch((err) => {
  const title = document.getElementById("tripTitle");
  title.textContent = "Could not load trip dashboard";
  document.getElementById("tripMeta").textContent = err.message;
});
