// ==UserScript==
// @name         FMS Tech Autofill (More rows 2 BBIS 26/4/26)
// @match        https://uae.fms-tech.com/BBIS/Fleet/Driver/*NewDriver*
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  /* ==============================
     UI BUTTON
  ============================== */

  const btn = document.createElement("button");
  btn.textContent = "📋 Paste Excel Row";
  btn.id = "pasteRow";
  let pasteInProgress = false;

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

  document.body.appendChild(btn);

  /* ==============================
     HELPERS
  ============================== */

  const onlyDigits = (s) => s.replace(/\D/g, "");
  const isNumeric = (s) => /^\d+$/.test(s);
  const containsLetters = (s) => /[A-Za-z]/.test(s);

  function isDateLike(s) {
    return /^(?:\d{1,4}[\/\-.]\d{1,2}[\/\-.]\d{1,4})$/.test(s);
  }

  function sanitizeCell(value) {
    if (value === null || value === undefined) return "";

    return String(value)
      .replace(/</g, "")
      .replace(/>/g, "")
      .replace(/\r?\n|\r/g, " / ")
      .replace(/\s{2,}/g, " ")
      .trim();
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
    return isNumeric(token) && Number(token) > 0 && Number(token) < 70000;
  }

  function isName(token) {
    if (!containsLetters(token)) return false;
    if (isDateLike(token)) return false;
    return token.trim().length > 3;
  }

  function normalizeDate(s) {
    if (!s) return s;

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

    // 1. Handle Month-Year format (e.g., Sep-25) -> Defaults to 01/MM/YYYY
    const monthYearMatch = s.match(/^([a-zA-Z]{3})[\/\-. ](\d{2,4})$/);
    if (monthYearMatch) {
      let [_, m, y] = monthYearMatch;
      let monthNum = months[m.toLowerCase()];
      if (monthNum) {
        y = y.length === 2 ? "20" + y : y;
        return `01/${monthNum}/${y}`;
      }
    }

    // 2. Handle Day-Month-Year alpha format (e.g., 01-Oct-25)
    const alphaMatch = s.match(
      /^(\d{1,2})[\/\-. ]([a-zA-Z]{3})[\/\-. ](\d{2,4})$/,
    );
    if (alphaMatch) {
      let [_, d, m, y] = alphaMatch;
      let monthNum = months[m.toLowerCase()];
      if (monthNum) {
        y = y.length === 2 ? "20" + y : y;
        return `${d.padStart(2, "0")}/${monthNum}/${y}`;
      }
    }

    // 3. Handle Numeric format (e.g., 2025/10/01 or 01/10/25)
    const numMatch = s.match(/^(\d{1,4})[\/\-.](\d{1,2})[\/\-.](\d{1,4})$/);
    if (numMatch) {
      let [_, a, b, c] = numMatch;
      let day, month, year;

      if (a.length === 4) {
        [year, month, day] = [a, b, c];
      } else {
        [day, month, year] = [a, b, c];
      }

      year = year.length === 2 ? "20" + year : year;
      return `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${year}`;
    }

    return s;
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

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function waitForSelector(selector, retries = 20) {
    for (let i = 0; i < retries; i++) {
      const el = document.querySelector(selector);
      if (el) return el;
      await wait(300);
    }
    return null;
  }

  function selectCompanyIfOnlyOne() {
    const selectEl = document.querySelector("#basicInfo_customerId");
    if (!selectEl) return;

    // Filter out empty/placeholder options
    const validOptions = Array.from(selectEl.options).filter(
      (opt) => opt.value !== "" && opt.text.toLowerCase() !== "please select",
    );

    // ONLY fill if there is exactly 1 valid option
    if (validOptions.length === 1) {
      selectEl.value = validOptions[0].value;

      // Trigger native events so the UI updates
      selectEl.dispatchEvent(new Event("change", { bubbles: true }));

      // If Bootstrap Select is being stubborn, this manual trigger usually fixes it:
      const btn = selectEl
        .closest(".bootstrap-select")
        ?.querySelector("button");
      if (btn) {
        const filterText = btn.querySelector(".filter-option-inner-inner");
        if (filterText) filterText.textContent = validOptions[0].text;
      }
      console.log(
        "✅ Auto-selected the only available company:",
        validOptions[0].text,
      );
    }
  }
  /* ==============================
     LOGGING LOGIC (UPDATED WITH COMPANY ID)
  ============================== */

  function logPasteAction(data) {
    // 1. Get Date for Key (e.g., 01-Mar-26)
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

    // 2. Get Company ID from Cookie "company_1723"
    const getCookie = (name) => {
      const match = document.cookie.match(
        new RegExp("(^| )" + name + "=([^;]+)"),
      );
      return match ? match[2] : "N/A";
    };
    const companyId = getCookie("company_1723");

    // 3. Scrape Company Name from Header
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

    // 4. Corrected Timestamp (Includes Date)
    const timestamp =
      d.toLocaleDateString("en-GB") +
      " " +
      d.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });

    // 5. Construct Row: CompanyID | Company Name | ID | Name | Phone # | Timestamp
    const header = "CompanyID\tCompany Name\tID\tName\tPhone #\tTimestamp";
    const newEntry = `${companyId}\t${companyName}\t${data.id}\t${data.nameOriginal}\t${data.phoneClean}\t${timestamp}`;

    // 6. Update LocalStorage
    let currentLog = localStorage.getItem(storageKey);

    if (!currentLog) {
      currentLog = header + "\n" + newEntry;
    } else {
      currentLog += "\n" + newEntry;
    }

    localStorage.setItem(storageKey, currentLog);

    // 7. Console Helper
    console.log(`✅ Logged for ${companyName} (ID: ${companyId})`);
    console.warn(
      `Copy log command: copy(localStorage.getItem("${storageKey}"));`,
    );
  }

  function waitForAccessCardMatchAndSave() {
    const interval = setInterval(() => {
      const selectEl = document.querySelector("#basicInfo_accesscard");
      const idInput = document.querySelector("#basicInfo_code");

      if (!selectEl || !idInput) return;

      const driverId = idInput.value?.trim();
      if (!driverId) return;

      const options = [...selectEl.options];

      // Check if any option text matches the driver ID
      const match = options.find((opt) => opt.text.trim() === driverId);

      if (match) {
        console.log("✅ Matching access card found:", match.text);

        // Optional: auto-select it (if not already selected)
        selectEl.value = match.value;
        selectEl.dispatchEvent(new Event("change", { bubbles: true }));

        const saveBtn = document.querySelector(
          'button[data-form="form_basicDriver"][data-groupidentifier="DriverInsert"]',
        );

        if (saveBtn) {
          setTimeout(() => {
            saveBtn.click();
            console.log("💾 Final Save clicked after match");
          }, 300);
        } else {
          console.warn("⚠️ Save button not found");
        }

        clearInterval(interval);
      }
    }, 500); // check every 0.5s
  }

  /* ==============================
     UPDATED MAIN LOGIC
  ============================== */
  async function fillFromClipboard() {
    if (pasteInProgress) return;

    pasteInProgress = true;
    btn.disabled = true;
    btn.style.opacity = "0.65";
    btn.style.cursor = "not-allowed";

    try {
      const raw = await navigator.clipboard.readText();
      if (!raw || raw.trim() === "") return;

      const firstRow = raw
        .trim()
        .split(/\r?\n/)
        .find((r) => r.trim() !== "");

      if (!firstRow) return;

      processRowData(parseRow(firstRow));
    } catch (err) {
      console.error("Clipboard Error:", err);
    } finally {
      setTimeout(() => {
        pasteInProgress = false;
        btn.disabled = false;
        btn.style.opacity = "1";
        btn.style.cursor = "pointer";
      }, 2000);
    }
  }

  // Extracted parsing logic to work per row
  function parseRow(rowText) {
    const tokens = rowText
      .split(/\t/)
      .map((t) => sanitizeCell(t.replace(/\u00A0/g, " ").trim()));

    // 🔥 Find "~" marker
    const tildeIndex = tokens.findIndex((t) => t === "~");

    let mainTokens = tokens;
    let adnocTokens = [];

    if (tildeIndex !== -1) {
      mainTokens = tokens.slice(0, tildeIndex);
      adnocTokens = tokens.slice(tildeIndex + 1); // next index after "~"
    }

    // Normalize ADNOC dates
    adnocTokens = adnocTokens.map((t) => normalizeDate(t));

    let data = {
      id: "",
      name: "",
      nameOriginal: "",
      phoneClean: "",
      phoneOriginal: "",
      adnoc: adnocTokens,
    };

    for (const token of mainTokens) {
      if (/^(LPO|CPP|Free)$/i.test(token) || /^LPO:/i.test(token)) continue;

      if (!data.id && isId(token)) {
        data.id = token;
        continue;
      }

      if (!data.phoneOriginal && isPhone(token)) {
        data.phoneClean = onlyDigits(token);
        data.phoneOriginal = token;
        continue;
      }

      if (!data.name && isName(token)) {
        data.name = token;
        data.nameOriginal = token;
        continue;
      }
    }

    if (data.name && data.phoneOriginal) {
      data.name = `${data.name} - ${data.phoneOriginal}`;
    }

    return data;
  }

  // Extracted UI filling logic
  /* ==============================
     UPDATED: PROCESS ROW DATA (OPENS NEXT TAB AT END)
  ============================== */
  async function processRowData(data) {
    const idInput = document.querySelector("#basicInfo_code");
    const nameInput = document.querySelector("#basicInfo_name");
    const phoneInput = document.querySelector("#basicInfo_phone1");

    const siteLocation = getDynamicInputByLabel("Site");
    const adsdStart = getDynamicInputByLabel("ADSD Issue date");
    const adsdExp = getDynamicInputByLabel("ADSD expiry date");
    const adsdNum = getDynamicInputByLabel("ADSD Number");
    const adnocAdminName = getDynamicInputByLabel(
      "ADNOC ONSHORE Contract Administrator Name",
    );
    const adnocAdminPhone = getDynamicInputByLabel(
      "ADNOC ONSHORE Contract Administrator Mobile",
    );
    const adnocAdminEmail = getDynamicInputByLabel(
      "ADNOC ONSHORE Contract Administrator Email",
    );
    const hseNum = getDynamicInputByLabel("HSE passport number");
    const hseFocalPointName = getDynamicInputByLabel("HSE Focal Point Name");
    const hseFocalPointEmail = getDynamicInputByLabel("HSE Focal Point Email");
    const supervisorName = getDynamicInputByLabel("Supervisor Name");
    const supervisorEmail = getDynamicInputByLabel("Supervisor Email");

    if (idInput) {
      idInput.value = data.id;
      dispatchEvents(idInput);
    }
    if (nameInput) {
      nameInput.value = data.name;
      dispatchEvents(nameInput);
    }
    if (phoneInput) {
      phoneInput.value = data.phoneClean;
      dispatchEvents(phoneInput);
    }
    if (siteLocation) {
      siteLocation.value = data.adnoc[2] || "";
      dispatchEvents(siteLocation);
    }
    if (adsdStart) {
      adsdStart.value = data.adnoc[3] || "";
      dispatchEvents(adsdStart);
    }
    if (adsdExp) {
      adsdExp.value = data.adnoc[4] || "";
      dispatchEvents(adsdExp);
    }
    if (adsdNum) {
      adsdNum.value = data.adsdNum || "";
      dispatchEvents(adsdNum);
    }
    if (adnocAdminName) {
      adnocAdminName.value = data.adnoc[5] || "";
      dispatchEvents(adnocAdminName);
    }
    if (adnocAdminPhone) {
      adnocAdminPhone.value = data.adnoc[6] || "";
      dispatchEvents(adnocAdminPhone);
    }
    if (adnocAdminEmail) {
      adnocAdminEmail.value = data.adnoc[7] || "";
      dispatchEvents(adnocAdminEmail);
    }
    if (hseNum) {
      hseNum.value = data.adnoc[14] || "";
      dispatchEvents(hseNum);
    }
    if (hseFocalPointName) {
      hseFocalPointName.value = data.adnoc[15] || "";
      dispatchEvents(hseFocalPointName);
    }
    if (hseFocalPointEmail) {
      hseFocalPointEmail.value = data.adnoc[data.adnoc.length - 3] || "";
      dispatchEvents(hseFocalPointEmail);
    }
    if (supervisorName) {
      supervisorName.value = data.adnoc[data.adnoc.length - 2] || "";
      dispatchEvents(supervisorName);
    }
    if (supervisorEmail) {
      supervisorEmail.value = data.adnoc[data.adnoc.length - 1] || "";
      dispatchEvents(supervisorEmail);
    }
    selectCompanyIfOnlyOne();
    logPasteAction(data);

    // Open "New Access Card"
    const newBtn = [...document.querySelectorAll("a.btn.btn-primary")].find(
      (a) => a.getAttribute("onclick")?.includes("DriverHelper.NewAccessCard"),
    );
    if (newBtn) newBtn.click();

    setTimeout(() => {
      const accessInput = document.querySelector("#accessCardCode");
      if (accessInput) {
        accessInput.value = data.id;
        dispatchEvents(accessInput);
      }
    }, 1200);

    // --- AUTO-SAVE after 3 seconds ---
    setTimeout(() => {
      const saveBtn = [...document.querySelectorAll("a.btn.btn-primary")].find(
        (a) =>
          a.textContent.trim() === "Save" &&
          a.getAttribute("onclick")?.includes("AddAccessCard"),
      );
      if (saveBtn) {
        saveBtn.click();
        console.log("✅ Form Saved Automatically");
      }
    }, 5000);
    waitForAccessCardMatchAndSave();
  }

  btn.addEventListener("click", fillFromClipboard);
})();
