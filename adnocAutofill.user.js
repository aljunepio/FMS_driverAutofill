// ==UserScript==
// @name         FMS Tech Autofill (Optimized from bbis)
// @match        https://uae.fms-tech.com/ADNOC/Fleet/Driver/Driver*
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

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
    boxShadow: "0 2px 6px rgba(0,0,0,0.25)"
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

  const onlyDigits = s => s.replace(/\D/g, "");
  const isNumeric = s => /^\d+$/.test(s);
  const containsLetters = s => /[A-Za-z]/.test(s);
  const containsNumbers = s => /\d/.test(s); // New helper for Name check

  function getTokenAt(tokens, index) {
    return (tokens[index] || "").replace(/\u00A0/g, " ").trim();
  }

  function getCompanyLabel(tokens) {
    return tokens.find(token => /ADNOC HQ|ADNOC REFINING|BOROUGE/i.test(token)) || "";
  }

  function getDriverLicenseIndex(tokens) {
    const company = getCompanyLabel(tokens);
    if (/ADNOC HQ/i.test(company)) return 10;
    if (/ADNOC REFINING/i.test(company)) return 14;
    if (/BOROUGE/i.test(company)) return 10;
    return null;
  }

  function normalizeDate(value) {
    if (!value) return "";

    const months = {
      jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
      jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12"
    };

    const monthYearMatch = value.match(/^([a-zA-Z]{3})[\/\- ](\d{2,4})$/);
    if (monthYearMatch) {
      const [, monthText, yearText] = monthYearMatch;
      const monthNum = months[monthText.toLowerCase()];
      if (monthNum) return `01/${monthNum}/${yearText.length === 2 ? "20" + yearText : yearText}`;
    }

    const alphaMatch = value.match(/^(\d{1,2})[\/\- ]([a-zA-Z]{3})[\/\- ](\d{2,4})$/);
    if (alphaMatch) {
      const [, day, monthText, yearText] = alphaMatch;
      const monthNum = months[monthText.toLowerCase()];
      if (monthNum) return `${day.padStart(2, "0")}/${monthNum}/${yearText.length === 2 ? "20" + yearText : yearText}`;
    }

    const numericMatch = value.match(/^(\d{1,4})[\/-](\d{1,2})[\/-](\d{1,4})$/);
    if (numericMatch) {
      const [, a, b, c] = numericMatch;
      const [year, month, day] = a.length === 4 ? [a, b, c] : [c, b, a];
      return `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${year.length === 2 ? "20" + year : year}`;
    }

    return value;
  }

  // Updated to accept both dd-mm-yy and dd-mm-yyyy
  function isDateLike(s) {
    return /^\d{1,2}[\/\-.]\d{1,2}[\/\-.](?:\d{2}|\d{4})$/.test(s);
  }

  function isFutureDate(s) {
      if (!isDateLike(s)) return false;
      const parts = s.split(/[\/\-.]/);
      let day = parseInt(parts[0]);
      let month = parseInt(parts[1]) - 1;
      let year = parseInt(parts[2]);

      // Convert 2-digit year to 4-digit (e.g., 27 -> 2027)
      if (year < 100) year += 2000;

      const dateObj = new Date(year, month, day);
      return dateObj > new Date();
  }

  function isEmail(token) {
      return token.includes("@");
  }

  function isPhone(token) {
    if (/LPO/i.test(token)) return false;
    const digits = onlyDigits(token);
    if (/^05\d{8}$/.test(digits)) return true;
    if (/^9715\d{8}$/.test(digits)) return true;
    if (/^0\d{9}$/.test(digits)) return true;
    return false;
  }

  function isId(token) {
    return isNumeric(token) && Number(token) > 17000 && Number(token) < 19000;
  }

  function isDriverLiceID(token) {
    return isNumeric(token) && Number(token) >= 400000 && Number(token) <= 1900000;
  }

  function isEmployeeID(token) {
    return isNumeric(token) && Number(token) > 100000 && Number(token) < 900000;
  }

  function isExtendedID(token) {
    return isNumeric(token) && Number(token) > 3000000000 && Number(token) < 5000000000;
  }

  function isName(token) {
    if (!containsLetters(token)) return false;
    if (containsNumbers(token)) return false; // Fixed: No numbers allowed in name
    if (isDateLike(token)) return false;
    if (isEmail(token)) return false;
    return token.trim().length > 3;
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
    const day = d.getDate().toString().padStart(2, '0');
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = months[d.getMonth()];
    const year = d.getFullYear().toString().slice(-2);
    const storageKey = `${day}-${month}-${year}`;

    let companyName = "Unknown";
    const companyImg = document.querySelector('a.dropdown-toggle img.img-circle');
    const companyBTag = document.querySelector('a.dropdown-toggle b.topheader-right-text');

    if (companyImg && companyImg.getAttribute("oldtitle")) {
        companyName = companyImg.getAttribute("oldtitle").trim();
    } else if (companyBTag) {
        companyName = companyBTag.textContent.trim();
    }

    const timestamp = d.toLocaleDateString('en-GB') + " " + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
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

      const tokens = raw.split(/\t/).map(t => t.replace(/\u00A0/g, " ").trim());
      const phoneOriginal = getTokenAt(tokens, 2);
      const expiryToken = getTokenAt(tokens, 11) || getTokenAt(tokens, 13) || tokens.find(token => isFutureDate(token)) || "";
      const staticDriverLicenseIndex = getDriverLicenseIndex(tokens);

      let data = {
        id: getTokenAt(tokens, 0),
        name: getTokenAt(tokens, 1),
        nameOriginal: getTokenAt(tokens, 1),
        extendedID: getTokenAt(tokens, 3) || tokens.find(token => isExtendedID(token)) || "",
        phoneClean: onlyDigits(phoneOriginal),
        phoneOriginal,
        employeeID: tokens.find(token => isEmployeeID(token)) || "",
        driverLiceID: staticDriverLicenseIndex !== null ? getTokenAt(tokens, staticDriverLicenseIndex) : tokens.find(token => isDriverLiceID(token)) || "",
        email: tokens.find(token => isEmail(token)) || "",
        dlExpiration: normalizeDate(expiryToken),
        companyLabel: getCompanyLabel(tokens),
        mode: getTokenAt(tokens, 12) || getTokenAt(tokens, 15) || ""
      };

      if (!data.id) {
        const fallbackId = tokens.find(token => isId(token));
        if (fallbackId) data.id = fallbackId;
      }

      if (!data.name || !isName(data.name)) {
        const fallbackName = tokens.find(token => isName(token));
        data.name = fallbackName || data.name;
        data.nameOriginal = fallbackName || data.nameOriginal;
      }

      if (!data.phoneOriginal) {
        const fallbackPhone = tokens.find(token => isPhone(token));
        data.phoneOriginal = fallbackPhone || "";
        data.phoneClean = onlyDigits(data.phoneOriginal);
      }

      // Mapping to Selectors
      const idInput = document.querySelector("#basicInfo_code");
      const nameInput = document.querySelector("#basicInfo_name");
      const extendInput = document.querySelector("#basicInfo_extendedCode");
      const phoneInput = document.querySelector("#basicInfo_phone1");
      const emailInput = document.querySelector("#basicInfo_email");
      const dlExpireInput = document.querySelector("#basicInfo_licenseExpiration");
      const driverLiceInput = document.querySelector("#basicInfo_licenseCode");
      const notifEmailInput = document.querySelector("#basicInfo_notificationEmails");
      const employeeIDInput = getDynamicInputByLabel("Employee ID");
      const driverMobileInput = getDynamicInputByLabel("Driver Mobile");
      const uIDInput = getDynamicInputByLabel("UID Number");
      const modeInput = getDynamicInputByLabel("Mode");

      if (idInput) { idInput.value = data.id; dispatchEvents(idInput); }
      if (nameInput) { nameInput.value = data.name + (data.phoneOriginal ? ` - ${data.phoneOriginal}` : ""); dispatchEvents(nameInput); }
      if (extendInput) { extendInput.value = data.extendedID; dispatchEvents(extendInput); }
      if (phoneInput) { phoneInput.value = data.phoneClean; dispatchEvents(phoneInput); }
      if (emailInput) { emailInput.value = data.email; dispatchEvents(emailInput); }
      if (dlExpireInput) { dlExpireInput.value = data.dlExpiration; dispatchEvents(dlExpireInput); }
      if (driverLiceInput && data.driverLiceID) { driverLiceInput.value = data.driverLiceID; dispatchEvents(driverLiceInput); }
      if (notifEmailInput) { notifEmailInput.value = data.email; dispatchEvents(notifEmailInput); }
      if (employeeIDInput) { employeeIDInput.value = data.employeeID; dispatchEvents(employeeIDInput); }
      if (driverMobileInput) { driverMobileInput.value = data.phoneClean; dispatchEvents(driverMobileInput); }
      if (uIDInput) { uIDInput.value = data.extendedID; dispatchEvents(uIDInput); }
      if (modeInput && data.mode) { modeInput.value = data.mode; dispatchEvents(modeInput); }

      logPasteAction(data);

      const newBtn = [...document.querySelectorAll("a.btn.btn-primary")].find(a => a.getAttribute("onclick")?.includes("DriverHelper.NewAccessCard"));
      if (newBtn) newBtn.click();

      setTimeout(() => {
          const accessInput = document.querySelector("#accessCardCode");
          if (accessInput) { accessInput.value = data.id; dispatchEvents(accessInput); }
      }, 1000);

    } catch (err) {
      console.error("Autofill Error:", err);
    }
  }

})();
