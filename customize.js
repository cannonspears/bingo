// ===== CUSTOMIZE MODALS =====
function openCustomizeModal(isWork, breakTabKey) {
  let cells, defaults, titleText;

  if (isWork) {
    cells = state.workCells;
    defaults = [];
    titleText = "Today's Tasks";
  } else {
    const tab = breakTabKey || state.activeBreakTab;
    cells = state.breakTabs[tab];
    defaults = DEFAULT_BREAK_TABS[tab];
    breakTabKey = tab;
  }

  const modal = document.getElementById("customize-modal");
  const title = document.getElementById("customize-modal-title");
  const list = document.getElementById("customize-list");
  const saveBtn = document.getElementById("btn-customize-save");
  const instructionsEl = document.querySelector(".customize-instructions");

  if (title) {
    if (isWork) {
      title.textContent = titleText;
    } else {
      const currentName =
        (state.breakTabNames || {})[breakTabKey] || breakTabKey;
      title.innerHTML = `Edit Activities for <input type="text" id="customize-tab-name" class="tab-name-edit" value="${currentName}" maxlength="20" />`;
    }
  }
  if (instructionsEl) {
    instructionsEl.textContent = isWork
      ? "Add or edit your tasks for today. Empty rows are removed on save."
      : "Edit your card name and activities. Blank fields use defaults.";
  }
  list.innerHTML = "";
  saveBtn.dataset.isWork = isWork ? "1" : "0";
  saveBtn.dataset.breakTab = isWork ? "" : breakTabKey || state.activeBreakTab;

  const rowTexts = isWork
    ? [...cells.map((c) => c.text), "", ""]
    : cells.map((c) => c.text);

  if (!isWork) {
    // 2-column grid: 8 rows × 2 inputs = 16 cells
    list.style.display = "grid";
    list.style.gridTemplateColumns = "1fr 1fr";
    list.style.gap = "5px";
    rowTexts.forEach((text, i) => {
      list.appendChild(buildCustomizeCell(i, text, false));
    });
  } else {
    list.style.display = "";
    list.style.gridTemplateColumns = "";
    list.style.gap = "";
    rowTexts.forEach((text, i) => {
      list.appendChild(buildCustomizeRow(i, text, true));
    });

    // Add more button for work
    const addBtn = document.createElement("button");
    addBtn.className = "action-btn";
    addBtn.style.cssText = "width:100%;margin-top:4px;font-size:0.75rem;";
    addBtn.textContent = "+ Add another task";
    addBtn.addEventListener("click", () => {
      const inputs = list.querySelectorAll("input");
      const newIdx = inputs.length;
      list.appendChild(buildCustomizeRow(newIdx, "", true));
      list.querySelectorAll("input")[newIdx]?.focus();
    });
    list.appendChild(addBtn);
  }

  modal.classList.remove("hidden");
  const defaultsBtn = document.getElementById("btn-customize-defaults");
  if (defaultsBtn) defaultsBtn.style.display = isWork ? "none" : "";
  list.querySelectorAll("input")[0]?.focus();
}

function buildCustomizeRow(i, value, isWork) {
  const row = document.createElement("div");
  row.className = "customize-row";
  const num = document.createElement("span");
  num.className = "row-num";
  num.textContent = i + 1;
  const input = document.createElement("input");
  input.type = "text";
  input.maxLength = 60;
  input.placeholder = isWork ? `Task ${i + 1}…` : `Break idea ${i + 1}…`;
  input.value = value || "";
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const inputs = document.querySelectorAll("#customize-list input");
      const next = inputs[i + 1];
      if (next) next.focus();
      else document.getElementById("btn-customize-save").focus();
    }
  });
  row.appendChild(num);
  row.appendChild(input);
  return row;
}

function buildCustomizeCell(i, value, isWork) {
  // Compact single-input cell for 2-col break grid layout
  const cell = document.createElement("div");
  cell.className = "customize-cell";
  const input = document.createElement("input");
  input.type = "text";
  input.maxLength = 40;
  input.placeholder = `Item ${i + 1}…`;
  input.value = value || "";
  input.dataset.cellIdx = i;
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const inputs = document.querySelectorAll("#customize-list input");
      const next = inputs[i + 1];
      if (next) next.focus();
      else document.getElementById("btn-customize-save").focus();
    }
  });
  cell.appendChild(input);
  return cell;
}

function closeCustomizeModal() {
  document.getElementById("customize-modal").classList.add("hidden");
}

function saveCustomize() {
  const saveBtn = document.getElementById("btn-customize-save");
  const isWork = saveBtn.dataset.isWork === "1";
  const inputs = document.querySelectorAll("#customize-list input");
  const texts = Array.from(inputs).map((inp) => inp.value.trim());

  if (isWork) {
    // Filter out empty rows — work list is purely user-defined
    const filled = texts.filter((t) => t.length > 0);
    state.workCells = filled.map((text) => ({ text, count: 0 }));
    exitFocusMode();
    renderWorkTaskList();
  } else {
    const tab = saveBtn.dataset.breakTab || state.activeBreakTab;

    // Save tab name if edited
    const nameInput = document.getElementById("customize-tab-name");
    if (nameInput) {
      const newName = nameInput.value.trim();
      if (!state.breakTabNames) state.breakTabNames = {};
      state.breakTabNames[tab] = newName || state.breakTabNames[tab] || tab;
    }

    const defaults = DEFAULT_BREAK_TABS[tab];
    const filled = texts.map((t, i) => t || defaults[i] || "");
    // shuffle break items
    const shuffled = [...filled];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    state.breakTabs[tab] = shuffled.map((text) => ({ text, count: 0 }));
    state.lineCompletions[tab] = {};
    state.blackoutCompletions[tab] = 0;
    renderBreakGrid();
  }
  state.bingoAcknowledged = false;
  saveState();
  closeCustomizeModal();
}

function loadDefaultsIntoModal() {
  const saveBtn = document.getElementById("btn-customize-save");
  const isWork = saveBtn.dataset.isWork === "1";
  // Work has no defaults — nothing to load
  if (isWork) return;
  const tab = saveBtn.dataset.breakTab || state.activeBreakTab;
  const defaults = DEFAULT_BREAK_TABS[tab];
  const inputs = document.querySelectorAll("#customize-list input");
  defaults.forEach((text, i) => {
    if (inputs[i]) inputs[i].value = text;
  });
}
