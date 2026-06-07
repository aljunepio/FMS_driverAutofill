// ==UserScript==
// @name         FMS Tech Adnoc static fill
// @match        https://uae.fms-tech.com/ADNOC/Fleet/Driver/Driver*
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  /* ==============================
   UI BUTTON (SHOW ONLY FOR NAME WITH NEW DRIVER INPUT)
============================== */

  function shouldShowPasteButton() {
    const nameInput = document.querySelector("#basicInfo_name");
    if (!nameInput) return false;

    const val = nameInput.value.trim();
    return val.startsWith("New Driver");
  }

  function createPasteButton() {
    if (document.getElementById("fms-adnoc-paste-btn")) return;

    const btn = document.createElement("button");
    btn.id = "fms-adnoc-paste-btn";
    btn.textContent = "📋 Paste Excel Row";

    Object.assign(btn.style, {
      position: "fixed",
      top: "150px",
      right: "20px",
      zIndex: 999999,
      padding: "10px 16px",
      background: "#007bff",
      color: "white",
      border: "none",
      borderRadius: "8px",
      cursor: "pointer",
      boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
    });

    btn.addEventListener("click", fillFromClipboard);
    document.body.appendChild(btn);
  }

  /* Wait until page loads and input exists */
  function initButtonCheck() {
    const interval = setInterval(() => {
      const nameInput = document.querySelector("#basicInfo_name");
      if (!nameInput) return;

      if (shouldShowPasteButton()) {
        createPasteButton();
      }

      clearInterval(interval);
    }, 500);
  }

  initButtonCheck();

  /* ==============================
     HELPERS (UPDATED)
  ============================== */

  const onlyDigits = (s) => s.replace(/\D/g, "");

  function getTokenAt(tokens, index) {
    return (tokens[index] || "").replace(/\u00A0/g, " ").trim();
  }

  const companyIndexMap = {
    "ADNOC GAS": {
      id: 1,
      nameOriginal: 2,
      employeeID: 4,
      extendedID: 9,
      phoneOriginal: 3,
      driverLiceID: 13,
      dlExpiration: 14,
      email: 8,
    },
    "Borouge": {
      id: 1,
      nameOriginal: 2,
      employeeID: 4,
      extendedID: 7,
      phoneOriginal: 3,
      driverLiceID: 10,
      dlExpiration: 11,
      email: 9,
    },
    "ADNOC_HQ": {
      id: 1,
      nameOriginal: 2,
      employeeID: 4,
      extendedID: 7,
      phoneOriginal: 3,
      driverLiceID: 11,
      dlExpiration: 12,
      email: 8,
    },
  };

  function normalizeCompanyKey(value) {
    return (value || "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
  }

  function getCompanyRule(tokens) {
    const label = (tokens[5] || "").trim();
    return companyIndexMap[normalizeCompanyKey(label)] || null;
  }

  function normalizeDate(value) {
    if (!value) return "";

    const months = {
      jan: "01",
      feb: "02",
      mar: "03",
      apr: "04",
      may: "05",
      jun: "06",
      jul: "07",
      aug: "08",
      sep: "09",
      oct: "10",
      nov: "11",
      dec: "12",
    };

    const monthYearMatch = value.match(/^([a-zA-Z]{3})[\/\- ](\d{2,4})$/);
    if (monthYearMatch) {
      const [, monthText, yearText] = monthYearMatch;
      const monthNum = months[monthText.toLowerCase()];
      if (monthNum)
        return `01/${monthNum}/${yearText.length === 2 ? "20" + yearText : yearText}`;
    }

    const alphaMatch = value.match(
      /^(\d{1,2})[\/\- ]([a-zA-Z]{3})[\/\- ](\d{2,4})$/,
    );
    if (alphaMatch) {
      const [, day, monthText, yearText] = alphaMatch;
      const monthNum = months[monthText.toLowerCase()];
      if (monthNum)
        return `${day.padStart(2, "0")}/${monthNum}/${yearText.length === 2 ? "20" + yearText : yearText}`;
    }

    const numericMatch = value.match(/^(\d{1,4})[\/-](\d{1,2})[\/-](\d{1,4})$/);
    if (numericMatch) {
      const [, a, b, c] = numericMatch;
      const [year, month, day] = a.length === 4 ? [a, b, c] : [c, b, a];
      return `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${year.length === 2 ? "20" + year : year}`;
    }

    return value;
  }

  function getDynamicInputByLabel(labelText) {
    const labels = document.querySelectorAll("label");
    for (const label of labels) {
      if (label.textContent.trim() === labelText) {
        const container = label.closest(".form-group");
        if (!container) continue;
        const input = container.querySelector("input.fms-prop");
        if (input) return input;
      }
    }
    return null;
  }

  function dispatchEvents(el) {
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  /* ==============================
     LOGGING LOGIC
  ============================== */

  function logPasteAction(data) {
    const d = new Date();
    const day = d.getDate().toString().padStart(2, "0");
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const month = months[d.getMonth()];
    const year = d.getFullYear().toString().slice(-2);
    const storageKey = `${day}-${month}-${year}`;

    let companyName = "Unknown";
    const companyImg = document.querySelector(
      "a.dropdown-toggle img.img-circle",
    );
    const companyBTag = document.querySelector(
      "a.dropdown-toggle b.topheader-right-text",
    );

    if (companyImg && companyImg.getAttribute("oldtitle")) {
      companyName = companyImg.getAttribute("oldtitle").trim();
    } else if (companyBTag) {
      companyName = companyBTag.textContent.trim();
    }

    const timestamp =
      d.toLocaleDateString("en-GB") +
      " " +
      d.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
    const header = "Company Name\tID\tName\tPhone #\tTimestamp";
    const newEntry = `${companyName}\t${data.id}\t${data.nameOriginal}\t${data.phoneClean}\t${timestamp}`;

    let currentLog = localStorage.getItem(storageKey);
    if (!currentLog) {
      currentLog = header + "\n" + newEntry;
    } else {
      currentLog += "\n" + newEntry;
    }

    localStorage.setItem(storageKey, currentLog);
    console.log(`✅ Logged for ${companyName}`);
  }

  /* ==============================
     MAIN LOGIC (REFINED)
  ============================== */

  async function fillFromClipboard() {
    try {
      const raw = await navigator.clipboard.readText();
      if (!raw) return;

      const tokens = raw
        .split(/\t/)
        .map((t) => t.replace(/\u00A0/g, " ").trim());
      const rule = getCompanyRule(tokens);

      const phoneOriginal = rule
        ? getTokenAt(tokens, rule.phoneOriginal - 1)
        : getTokenAt(tokens, 2);
      const expiryToken = rule ? getTokenAt(tokens, rule.dlExpiration - 1) : "";
      const email = rule ? getTokenAt(tokens, rule.email - 1) : "";
      const nameOriginal = rule
        ? getTokenAt(tokens, rule.nameOriginal - 1)
        : getTokenAt(tokens, 1);
      const employeeID = rule ? getTokenAt(tokens, rule.employeeID - 1) : "";
      const extendedID = rule ? getTokenAt(tokens, rule.extendedID - 1) : "";
      const driverLiceID = rule
        ? getTokenAt(tokens, rule.driverLiceID - 1)
        : "";

      let data = {
        id: rule ? getTokenAt(tokens, rule.id - 1) : getTokenAt(tokens, 0),
        name: `${nameOriginal}${employeeID ? `-${employeeID}` : `-${phoneOriginal}`}`,
        nameOriginal,
        extendedID,
        phoneClean: onlyDigits(phoneOriginal),
        phoneOriginal,
        employeeID,
        driverLiceID,
        email,
        dlExpiration: normalizeDate(expiryToken),
        companyLabel:
          tokens.find((token) => /ADNOC GAS|BOROUGE|ADNOC HQ/i.test(token)) ||
          "",
        mode: getTokenAt(tokens, 12) || getTokenAt(tokens, 15) || "",
      };

      // Mapping to Selectors
      const idInput = document.querySelector("#basicInfo_code");
      const nameInput = document.querySelector("#basicInfo_name");
      const extendInput = document.querySelector("#basicInfo_extendedCode");
      const phoneInput = document.querySelector("#basicInfo_phone1");
      const emailInput = document.querySelector("#basicInfo_email");
      const dlExpireInput = document.querySelector(
        "#basicInfo_licenseExpiration",
      );
      const driverLiceInput = document.querySelector("#basicInfo_licenseCode");
      const notifEmailInput = document.querySelector(
        "#basicInfo_notificationEmails",
      );
      const employeeIDInput = getDynamicInputByLabel("Employee ID");
      const driverMobileInput = getDynamicInputByLabel("Driver Mobile");
      const uIDInput = getDynamicInputByLabel("UID Number");
      const modeInput = getDynamicInputByLabel("Mode");

      if (idInput) {
        idInput.value = data.id;
        dispatchEvents(idInput);
      }
      if (nameInput) {
        nameInput.value =
          data.name + (data.phoneOriginal ? ` - ${data.phoneOriginal}` : "");
        dispatchEvents(nameInput);
      }
      if (extendInput) {
        extendInput.value = data.extendedID;
        dispatchEvents(extendInput);
      }
      if (phoneInput) {
        phoneInput.value = data.phoneClean;
        dispatchEvents(phoneInput);
      }
      if (emailInput) {
        emailInput.value = data.email;
        dispatchEvents(emailInput);
      }
      if (dlExpireInput) {
        dlExpireInput.value = data.dlExpiration;
        dispatchEvents(dlExpireInput);
      }
      if (driverLiceInput && data.driverLiceID) {
        driverLiceInput.value = data.driverLiceID;
        dispatchEvents(driverLiceInput);
      }
      if (notifEmailInput) {
        notifEmailInput.value = data.email;
        dispatchEvents(notifEmailInput);
      }
      if (employeeIDInput) {
        employeeIDInput.value = data.employeeID;
        dispatchEvents(employeeIDInput);
      }
      if (driverMobileInput) {
        driverMobileInput.value = data.phoneClean;
        dispatchEvents(driverMobileInput);
      }
      if (uIDInput) {
        uIDInput.value = data.extendedID;
        dispatchEvents(uIDInput);
      }
      if (modeInput && data.mode) {
        modeInput.value = data.mode;
        dispatchEvents(modeInput);
      }

      logPasteAction(data);

      const newBtn = [...document.querySelectorAll("a.btn.btn-primary")].find(
        (a) =>
          a.getAttribute("onclick")?.includes("DriverHelper.NewAccessCard"),
      );
      if (newBtn) newBtn.click();

      setTimeout(() => {
        const accessInput = document.querySelector("#accessCardCode");
        if (accessInput) {
          accessInput.value = data.id;
          dispatchEvents(accessInput);
        }
      }, 1000);
    } catch (err) {
      console.error("Autofill Error:", err);
    }
  }
})();
