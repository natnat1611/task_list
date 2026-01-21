const STORAGE_KEY = "tv_tasks_config_v1";

const API_BASE = "https://tasklist-backend-8eky.onrender.com";

function loadConfig() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    // config par défaut si rien n'existe
    const defaultConfig = {
      devices: [
        // ⚠️ plus d'IP en cloud-only : on utilise un identifiant "deviceName"
        { id: "1", name: "TV salon", deviceName: "prise_salon", mode: "reward" }
      ],
      tasks: [
        { id: "1", name: "Vaisselle", frequency: "daily" },
        { id: "2", name: "Ranger le salon", frequency: "daily" }
      ],
      // tâches cochées pour AUJOURD'HUI (id de task)
      doneToday: []
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultConfig));
    return defaultConfig;
  }

  // migration légère : si un ancien device a "ip" mais pas "deviceName"
  const cfg = JSON.parse(raw);
  if (cfg.devices) {
    cfg.devices.forEach(d => {
      if (!d.deviceName) {
        // si l'utilisateur avait mis une IP, on ne peut pas deviner le deviceName
        // donc on met un placeholder à compléter dans l'onglet config
        d.deviceName = d.deviceName || "";
      }
    });
  }
  return cfg;
}

function saveConfig(cfg) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
}

// config globale en mémoire
let state = loadConfig();

// ----- gestion des onglets -----

const tabTodayBtn = document.getElementById("tab-today");
const tabConfigBtn = document.getElementById("tab-config");
const pageToday = document.getElementById("page-today");
const pageConfig = document.getElementById("page-config");

function showPage(page) {
  if (page === "today") {
    pageToday.classList.remove("hidden");
    pageConfig.classList.add("hidden");
    tabTodayBtn.classList.add("active");
    tabConfigBtn.classList.remove("active");
    renderToday();
  } else {
    pageToday.classList.add("hidden");
    pageConfig.classList.remove("hidden");
    tabTodayBtn.classList.remove("active");
    tabConfigBtn.classList.add("active");
    renderConfig();
  }
}

tabTodayBtn.addEventListener("click", () => showPage("today"));
tabConfigBtn.addEventListener("click", () => showPage("config"));

// ----- rendu de la page "Aujourd'hui" -----

const tasksTodayDiv = document.getElementById("tasks-today");
const devicesActionsDiv = document.getElementById("devices-actions");
const resetDayBtn = document.getElementById("reset-day");

resetDayBtn.addEventListener("click", () => {
  state.doneToday = [];
  saveConfig(state);
  renderToday();
});

function renderToday() {
  // tâches
  tasksTodayDiv.innerHTML = "";
  state.tasks.forEach(task => {
    const card = document.createElement("div");
    card.className = "card";

    const id = `task_today_${task.id}`;
    const checked = state.doneToday.includes(task.id);

    card.innerHTML = `
      <label>
        <input type="checkbox" id="${id}" ${checked ? "checked" : ""}/>
        ${task.name}
      </label>
    `;
    tasksTodayDiv.appendChild(card);

    const checkbox = card.querySelector("input");
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        if (!state.doneToday.includes(task.id)) {
          state.doneToday.push(task.id);
        }
      } else {
        state.doneToday = state.doneToday.filter(tid => tid !== task.id);
      }
      saveConfig(state);
      renderDevicesActions();
    });
  });

  // actions sur les prises
  renderDevicesActions();
}

function allTasksDone() {
  if (state.tasks.length === 0) return false;
  return state.tasks.every(t => state.doneToday.includes(t.id));
}

function renderDevicesActions() {
  devicesActionsDiv.innerHTML = "";

  const tasksOk = allTasksDone();

  state.devices.forEach(device => {
    const card = document.createElement("div");
    card.className = "card";

    let statusText = "";
    if (device.mode === "reward") {
      statusText = tasksOk
        ? "Tâches OK → TV autorisée"
        : "Tâches incomplètes → TV bloquée";
    } else {
      statusText = tasksOk
        ? "Tâches OK → TV autorisée"
        : "Tâches incomplètes → TV coupée (punition)";
    }

    const deviceName = device.deviceName || "(à configurer)";

    card.innerHTML = `
      <h3>${device.name}</h3>
      <p class="device-status">${statusText}</p>
      <p>Device : <strong>${deviceName}</strong> — mode : ${device.mode}</p>
      <button class="btn-small" data-action="on">Forcer ON</button>
      <button class="btn-small" data-action="off">Forcer OFF</button>
      <button class="btn-small" data-action="logical">Action logique</button>
    `;

    devicesActionsDiv.appendChild(card);

    const [btnOn, btnOff, btnLogical] = card.querySelectorAll("button");

    btnOn.addEventListener("click", () => sendCommand(device, "on"));
    btnOff.addEventListener("click", () => sendCommand(device, "off"));

    btnLogical.addEventListener("click", () => {
      if (device.mode === "reward") {
        if (!tasksOk) {
          alert("Pas de TV : toutes les tâches ne sont pas faites.");
          return;
        }
        sendCommand(device, "on");
      } else if (device.mode === "punishment") {
        if (!tasksOk) {
          sendCommand(device, "off");
        } else {
          sendCommand(device, "on");
        }
      }
    });
  });
}

// --- CLOUD ONLY: envoi de commande au backend, qui publie en MQTT ---
function sendCommand(device, action) {
  if (!device.deviceName) {
    alert("Ce device n'a pas de 'deviceName'. Va dans l'onglet Config et remplis-le (ex: prise_salon).");
    return;
  }

  fetch(`${API_BASE}/api/devices/${encodeURIComponent(device.deviceName)}/command`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action }) // "on" | "off" | "logical"
  })
    .then(async res => {
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      return data;
    })
    .then(data => {
      console.log("Réponse backend:", data);
      alert(`Commande '${action}' envoyée au backend (cloud)`);
    })
    .catch(err => {
      console.error(err);
      alert(`Erreur backend: ${err.message}`);
    });
}


// ----- rendu de la page CONFIG -----

const devicesListDiv = document.getElementById("devices-list");
const tasksListDiv = document.getElementById("tasks-list");

const deviceForm = document.getElementById("device-form");
const deviceIdInput = document.getElementById("device-id");
const deviceNameInput = document.getElementById("device-name");
const deviceIpInput = document.getElementById("device-ip"); // ⚠️ on le réutilise pour deviceName
const deviceModeSelect = document.getElementById("device-mode");

const taskForm = document.getElementById("task-form");
const taskIdInput = document.getElementById("task-id");
const taskNameInput = document.getElementById("task-name");
const taskFrequencySelect = document.getElementById("task-frequency");

function renderConfig() {
  // prises
  devicesListDiv.innerHTML = "";
  state.devices.forEach(dev => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <strong>${dev.name}</strong><br/>
      Device : ${dev.deviceName || "(vide)"} — mode : ${dev.mode}<br/>
      <button class="btn-small" data-action="edit">Éditer</button>
      <button class="btn-small" data-action="delete">Supprimer</button>
    `;
    devicesListDiv.appendChild(card);

    const [btnEdit, btnDelete] = card.querySelectorAll("button");

    btnEdit.addEventListener("click", () => {
      deviceIdInput.value = dev.id;
      deviceNameInput.value = dev.name;

      // ⚠️ champ "device-ip" devient "deviceName" (ex: prise_salon)
      deviceIpInput.value = dev.deviceName || "";

      deviceModeSelect.value = dev.mode;
    });

    btnDelete.addEventListener("click", () => {
      if (confirm("Supprimer cette prise ?")) {
        state.devices = state.devices.filter(d => d.id !== dev.id);
        saveConfig(state);
        renderConfig();
      }
    });
  });

  // tâches
  tasksListDiv.innerHTML = "";
  state.tasks.forEach(task => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <strong>${task.name}</strong> — ${task.frequency}<br/>
      <button class="btn-small" data-action="edit">Éditer</button>
      <button class="btn-small" data-action="delete">Supprimer</button>
    `;
    tasksListDiv.appendChild(card);

    const [btnEdit, btnDelete] = card.querySelectorAll("button");

    btnEdit.addEventListener("click", () => {
      taskIdInput.value = task.id;
      taskNameInput.value = task.name;
      taskFrequencySelect.value = task.frequency;
    });

    btnDelete.addEventListener("click", () => {
      if (confirm("Supprimer cette tâche ?")) {
        state.tasks = state.tasks.filter(t => t.id !== task.id);
        state.doneToday = state.doneToday.filter(id => id !== task.id);
        saveConfig(state);
        renderConfig();
      }
    });
  });
}

// sauvegarde / création prise
deviceForm.addEventListener("submit", e => {
  e.preventDefault();
  const id = deviceIdInput.value || Date.now().toString();
  const existing = state.devices.find(d => d.id === id);

  const dev = {
    id,
    name: deviceNameInput.value.trim(),

    // ⚠️ champ "device-ip" devient "deviceName"
    deviceName: deviceIpInput.value.trim(),

    mode: deviceModeSelect.value
  };

  if (existing) {
    Object.assign(existing, dev);
  } else {
    state.devices.push(dev);
  }
  saveConfig(state);
  deviceForm.reset();
  renderConfig();
});

// sauvegarde / création tâche
taskForm.addEventListener("submit", e => {
  e.preventDefault();
  const id = taskIdInput.value || Date.now().toString();
  const existing = state.tasks.find(t => t.id === id);
  const task = {
    id,
    name: taskNameInput.value.trim(),
    frequency: taskFrequencySelect.value
  };
  if (existing) {
    Object.assign(existing, task);
  } else {
    state.tasks.push(task);
  }
  saveConfig(state);
  taskForm.reset();
  renderConfig();
});

// ----- init -----
showPage("today");
