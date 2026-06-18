// ==UserScript==
// @name         FMS Vehicle Auto Rename
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Auto rename vehicle records from pasted Excel rows on bbiserp.fms-tech.com vehicle list.
// @match        https://bbiserp.fms-tech.com/web*
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  const QUEUE_KEY = "fms_vehicle_rename_queue";
  const STATUS_KEY = "fms_vehicle_rename_status";
  let failedItems = [];

  function addFloatingPanel() {
    if (document.getElementById("fms-vehicle-rename-panel")) return;

    const panel = document.createElement("div");
    panel.id = "fms-vehicle-rename-panel";
    panel.innerHTML = `
      <div id="fms-vehicle-rename-header" style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;margin:-14px -14px 10px -14px;background:#f1f3f5;border-top-left-radius:12px;border-top-right-radius:12px;">
        <span style="font-weight:700;font-size:14px;">FMS Vehicle Rename</span>
        <button id="fms-vehicle-rename-minimize" style="width:28px;height:28px;border:none;border-radius:6px;background:#6c757d;color:#fff;cursor:pointer;font-size:16px;line-height:1;">−</button>
      </div>
      <div id="fms-vehicle-rename-body" style="font-family: Arial, sans-serif; font-size: 13px; color: #111;">
        <textarea id="fms-vehicle-rename-input" placeholder="Paste Excel rows: serial[TAB]new name" style="width:100%;height:100px;resize:vertical;padding:8px;border:1px solid #ccc;border-radius:6px;font-size:13px;box-sizing:border-box"></textarea>
        <div style="display:flex;gap:8px;margin-top:8px;">
          <button id="fms-vehicle-rename-load" style="flex:1;padding:8px 10px;border:none;border-radius:6px;background:#007bff;color:#fff;cursor:pointer">Load Queue</button>
          <button id="fms-vehicle-rename-start" style="flex:1;padding:8px 10px;border:none;border-radius:6px;background:#28a745;color:#fff;cursor:pointer">Start</button>
        </div>
        <div style="display:flex;gap:8px;margin-top:8px;">
          <button id="fms-vehicle-rename-stop" style="flex:1;padding:8px 10px;border:none;border-radius:6px;background:#dc3545;color:#fff;cursor:pointer;display:none">Stop</button>
          <button id="fms-vehicle-rename-clear" style="flex:1;padding:8px 10px;border:none;border-radius:6px;background:#6c757d;color:#fff;cursor:pointer">Clear</button>
        </div>
        <div style="display:flex;gap:8px;margin-top:8px;">
          <button id="fms-vehicle-rename-copy-fails" style="flex:1;padding:8px 10px;border:none;border-radius:6px;background:#17a2b8;color:#fff;cursor:pointer">Copy Failed</button>
        </div>
        <textarea id="fms-vehicle-rename-fails" readonly placeholder="Failed vehicles will appear here" style="width:100%;height:120px;resize:none;padding:8px;border:1px solid #ccc;border-radius:6px;font-size:13px;box-sizing:border-box;margin-top:8px;background:#fff;"></textarea>
        <div id="fms-vehicle-rename-status" style="margin-top:10px;line-height:1.4;color:#333;white-space:pre-wrap;max-height:120px;overflow:auto;background:#f8f9fa;padding:10px;border:1px solid #e2e3e5;border-radius:6px;font-size:12px"></div>
      </div>
    `;

    Object.assign(panel.style, {
      position: "fixed",
      top: "100px",
      right: "20px",
      width: "320px",
      maxWidth: "calc(100vw - 40px)",
      zIndex: 999999,
      background: "#ffffff",
      border: "1px solid rgba(0,0,0,0.12)",
      borderRadius: "12px",
      boxShadow: "0 10px 30px rgba(0,0,0,0.18)",
      padding: "14px",
      boxSizing: "border-box",
    });

    document.body.appendChild(panel);

    document
      .getElementById("fms-vehicle-rename-load")
      .addEventListener("click", () => loadQueue());
    document
      .getElementById("fms-vehicle-rename-start")
      .addEventListener("click", () => runQueue());
    document
      .getElementById("fms-vehicle-rename-stop")
      .addEventListener("click", stopQueue);
    document
      .getElementById("fms-vehicle-rename-clear")
      .addEventListener("click", clearQueue);
    document
      .getElementById("fms-vehicle-rename-minimize")
      .addEventListener("click", togglePanelMinimize);
    document
      .getElementById("fms-vehicle-rename-copy-fails")
      .addEventListener("click", copyFailedList);

    restoreStatus();
    renderFailedList();
    updateStatus("Ready. Paste tab-delimited rows and press Load Queue.");
  }

  function updateStatus(message, append = false) {
    const statusEl = document.getElementById("fms-vehicle-rename-status");
    if (!statusEl) return;
    if (append) {
      statusEl.textContent = statusEl.textContent
        ? `${statusEl.textContent}\n${message}`
        : message;
    } else {
      statusEl.textContent = message;
    }
    localStorage.setItem(STATUS_KEY, statusEl.textContent);
  }

  function restoreStatus() {
    const status = localStorage.getItem(STATUS_KEY);
    if (status) {
      const statusEl = document.getElementById("fms-vehicle-rename-status");
      if (statusEl) statusEl.textContent = status;
    }
  }

  function parseQueue(text) {
    const rows = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    const queue = [];
    for (const row of rows) {
      const cols = row
        .split(/\t|\s{2,}|,/)
        .map((cell) => cell.trim())
        .filter(Boolean);
      if (cols.length < 2) continue;
      const serial = cols[0].trim();
      const name = cols.slice(1).join(" ").trim();
      if (!serial || !name) continue;
      queue.push({ serial, name });
    }
    return queue;
  }

  function setQueue(queue) {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  }

  function getQueue() {
    try {
      return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
    } catch (err) {
      return [];
    }
  }

  function clearQueue() {
    localStorage.removeItem(QUEUE_KEY);
    updateStatus("Queue cleared.");
    document.getElementById("fms-vehicle-rename-stop").style.display = "none";
  }

  async function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function waitForSelector(selector, timeout = 10000) {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      const el = document.querySelector(selector);
      if (el) return el;
      await wait(1100);
    }
    return null;
  }

  async function waitForCondition(predicate, timeout = 10000) {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      try {
        if (predicate()) return true;
      } catch (err) {
        // ignore
      }
      await wait(1100);
    }
    return false;
  }

  function clickEl(el) {
    if (!el || typeof el.click !== "function") return;
    try {
      el.dispatchEvent(
        new MouseEvent("mousedown", { bubbles: true, cancelable: true }),
      );
      el.dispatchEvent(
        new MouseEvent("mouseup", { bubbles: true, cancelable: true }),
      );
    } catch (err) {
      // ignore non-DOM or read-only elements
    }
    el.click();
  }

  function dispatchInputEvents(input) {
    input.dispatchEvent(new Event("focus", { bubbles: true }));
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        key: "Enter",
      }),
    );
    input.dispatchEvent(
      new KeyboardEvent("keyup", {
        bubbles: true,
        cancelable: true,
        key: "Enter",
      }),
    );
  }

  function dispatchKey(input, key) {
    if (!input) return;
    input.dispatchEvent(
      new KeyboardEvent("keydown", {
        key,
        code: key,
        bubbles: true,
        cancelable: true,
      }),
    );
    input.dispatchEvent(
      new KeyboardEvent("keyup", {
        key,
        code: key,
        bubbles: true,
        cancelable: true,
      }),
    );
  }

  function togglePanelMinimize() {
    const body = document.getElementById("fms-vehicle-rename-body");
    const button = document.getElementById("fms-vehicle-rename-minimize");
    if (!body || !button) return;
    const minimized = body.style.display === "none";
    body.style.display = minimized ? "block" : "none";
    button.textContent = minimized ? "−" : "+";
  }

  function addFailure(item, reason) {
    failedItems.push({ serial: item.serial, name: item.name, reason });
    renderFailedList();
  }

  function renderFailedList() {
    const textarea = document.getElementById("fms-vehicle-rename-fails");
    if (!textarea) return;
    if (!failedItems.length) {
      textarea.value = "No failures yet.";
      return;
    }
    textarea.value = failedItems
      .map((item) => `${item.serial}\t${item.name}\t${item.reason}`)
      .join("\n");
  }

  function copyFailedList() {
    const textarea = document.getElementById("fms-vehicle-rename-fails");
    if (!textarea) return;
    textarea.select();
    document.execCommand("copy");
    updateStatus("Failed list copied to clipboard.", true);
  }

  async function loadQueue() {
    const raw = document.getElementById("fms-vehicle-rename-input").value;
    const queue = parseQueue(raw);
    if (!queue.length) {
      updateStatus(
        "No valid serial/name rows found. Paste tab-delimited rows with serial in the first column and name in the second column.",
      );
      return;
    }
    setQueue(queue);
    updateStatus(`Loaded queue with ${queue.length} rows.`);
  }

  let stopRequested = false;

  function stopQueue() {
    stopRequested = true;
    updateStatus("Stop requested. Finishing current item...");
  }

  async function runQueue() {
    stopRequested = false;
    failedItems = [];
    renderFailedList();

    const queue = getQueue();
    if (!queue.length) {
      updateStatus("Queue is empty. Paste rows and Load Queue first.");
      return;
    }

    document.getElementById("fms-vehicle-rename-stop").style.display =
      "inline-block";
    updateStatus(`Starting rename cycle with ${queue.length} items...`);

    for (let index = 0; index < queue.length; index++) {
      if (stopRequested) {
        updateStatus("Stopped by user.");
        break;
      }

      const item = queue[index];
      updateStatus(
        `(${index + 1}/${queue.length}) Searching ${item.serial} → ${item.name}`,
      );

      const ok = await processItem(item);
      await wait(1500);

      if (!ok) {
        addFailure(item, "No unique result or other issue");
        updateStatus(
          `Skipped ${item.serial}: no unique result or page issue.`,
          true,
        );
        continue;
      }

      updateStatus(`Renamed ${item.serial} → ${item.name}`, true);
      await wait(1400);
    }

    document.getElementById("fms-vehicle-rename-stop").style.display = "none";
    if (!stopRequested) updateStatus("Done processing queue.");
  }
  function findSearchAction(serial) {
    const items = Array.from(
      document.querySelectorAll("li.o_menu_item.dropdown-item"),
    );
    return items.find((item) => {
      const text = item.textContent || "";
      return text.includes("Device Serial No") && text.includes(serial);
    });
  }

  async function processItem(item) {
    const searchInput = await waitForSelector("input.o_searchview_input", 8000);
    if (!searchInput) {
      addFailure(item, "Search input not found");
      updateStatus(
        "Search input not found on this page. Navigate to the vehicle list first.",
      );
      return false;
    }

    searchInput.focus();
    searchInput.value = item.serial;
    dispatchInputEvents(searchInput);
    await wait(1150);

    inputEnter(searchInput);

    await wait(1150);

    const singleRow = await waitForCondition(() => {
      const rows = document.querySelectorAll("tr.o_data_row");
      return rows.length === 1;
    }, 5000);

    if (!singleRow) {
      const rows = document.querySelectorAll("tr.o_data_row");
      addFailure(item, `Result count: ${rows.length}`);
      updateStatus(`Result count: ${rows.length}. Skipping ${item.serial}.`);
      return false;
    }

    const row = document.querySelector("tr.o_data_row");
    if (!row) return false;
    const clickableCell = row.querySelector(
      'td.o_data_cell.cursor-pointer, td[name="name"], td[name="vehicle_name"]',
    );
    if (clickableCell) {
      clickEl(clickableCell);
    } else {
      clickEl(row);
    }

    const nameInput = await waitForSelector(
      'div[name="name"] input.o_input, input#name',
      10000,
    );
    const vehicleNameInput = await waitForSelector(
      'div[name="vehicle_name"] input.o_input, input#vehicle_name',
      10000,
    );

    if (!nameInput && !vehicleNameInput) {
      addFailure(item, "Vehicle fields not found");
      updateStatus("Vehicle fields not found. Could not rename record.");
      return false;
    }

    if (nameInput) {
      nameInput.focus();
      nameInput.value = item.name;
      dispatchInputEvents(nameInput);
    }
    if (vehicleNameInput) {
      vehicleNameInput.focus();
      vehicleNameInput.value = item.name;
      dispatchInputEvents(vehicleNameInput);
    }
    await wait(1150);
    window.history.back();

    await returnToSearchList();
    return true;
  }

  function inputEnter(input) {
    input.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        code: "Enter",
        bubbles: true,
        cancelable: true,
      }),
    );
    input.dispatchEvent(
      new KeyboardEvent("keyup", {
        key: "Enter",
        code: "Enter",
        bubbles: true,
        cancelable: true,
      }),
    );
  }

  async function returnToSearchList() {
    let searchInput = await waitForSelector("input.o_searchview_input", 10000);
    if (searchInput) {
      searchInput.focus();
      dispatchKey(searchInput, "Backspace");
      await wait(1150);
      return true;
    }

    if (window.history.length > 1) {
      window.history.back();
      await wait(1600);
      searchInput = await waitForSelector("input.o_searchview_input", 10000);
      if (searchInput) {
        searchInput.focus();
        dispatchKey(searchInput, "Backspace");
        await wait(1500);
        return true;
      }
    }

    const breadcrumb = document.querySelector(
      "a.o_breadcrumb_anchor, .o_breadcrumb_item a",
    );
    if (breadcrumb) {
      clickEl(breadcrumb);
      await wait(1800);
      searchInput = await waitForSelector("input.o_searchview_input", 5000);
      if (searchInput) {
        searchInput.focus();
        dispatchKey(searchInput, "Backspace");
        await wait(1500);
        return true;
      }
    }

    updateStatus(
      "Could not return to the search list after save. Please navigate back manually and continue.",
      true,
    );
    return false;
  }

  async function init() {
    addFloatingPanel();
  }

  if (
    document.readyState === "complete" ||
    document.readyState === "interactive"
  ) {
    init();
  } else {
    window.addEventListener("DOMContentLoaded", init);
  }
})();
