const STORAGE_KEY = "tv_tasks_config_v1";

function loadConfig() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    // config par défaut si rien n'existe
    const defaultConfig = {
      devices: [
        { id: "1", name: "TV salon", ip: "192.168.1.144", mode: "reward" }
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
  return JSON.parse(raw);
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

    card.innerHTML = `
      <h3>${device.name}</h3>
      <p class="device-status">${statusText}</p>
      <p>IP : ${device.ip} — mode : ${device.mode}</p>
      <button class="btn-small" data-action="on">Forcer ON</button>
      <button class="btn-small" data-action="off">Forcer OFF</button>
      <button class="btn-small" data-action="logical">Action logique</button>
    `;

    devicesActionsDiv.appendChild(card);

    const [btnOn, btnOff, btnLogical] = card.querySelectorAll("button");

    // Forcer ON / OFF (bypass logique)
    btnOn.addEventListener("click", () => sendCommand(device, "On"));
    btnOff.addEventListener("click", () => sendCommand(device, "Off"));

    // bouton "logique" (respecte le mode reward/punishment)
    btnLogical.addEventListener("click", () => {
      if (device.mode === "reward") {
        if (!tasksOk) {
          alert("Pas de TV : toutes les tâches ne sont pas faites.");
          return;
        }
        sendCommand(device, "On");
      } else if (device.mode === "punishment") {
        if (!tasksOk) {
          // punition : on coupe
          sendCommand(device, "Off");
        } else {
          // récompense : on laisse allumer
          sendCommand(device, "On");
        }
      }
    });
  });
}

// envoi de la commande HTTP vers la prise
function sendCommand(device, cmd) {
  const url = `http://${device.ip}/cm?cmnd=Power%20${cmd}`;
  console.log("Envoi commande :", url);

  // On envoie la requête mais on n'a pas forcément besoin de lire la réponse
  fetch(url)
    .then(() => {
      alert(`Commande ${cmd} envoyée à ${device.name}`);
    })
    .catch(err => {
      console.error(err);
      alert("Erreur lors de l'envoi de la commande.\nVérifie que ton téléphone/PC est sur le même Wi-Fi que la prise.");
    });
}

// ----- rendu de la page CONFIG -----

const devicesListDiv = document.getElementById("devices-list");
const tasksListDiv = document.getElementById("tasks-list");

const deviceForm = document.getElementById("device-form");
const deviceIdInput = document.getElementById("device-id");
const deviceNameInput = document.getElementById("device-name");
const deviceIpInput = document.getElementById("device-ip");
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
      IP : ${dev.ip} — mode : ${dev.mode}<br/>
      <button class="btn-small" data-action="edit">Éditer</button>
      <button class="btn-small" data-action="delete">Supprimer</button>
    `;
    devicesListDiv.appendChild(card);

    const [btnEdit, btnDelete] = card.querySelectorAll("button");

    btnEdit.addEventListener("click", () => {
      deviceIdInput.value = dev.id;
      deviceNameInput.value = dev.name;
      deviceIpInput.value = dev.ip;
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
    ip: deviceIpInput.value.trim(),
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