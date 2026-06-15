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
    ADNOC_GAS: {
      id: 1,
      nameOriginal: 2,
      employeeID: 4,
      extendedID: 9,
      phoneOriginal: 3,
      driverLiceID: 13,
      dlExpiration: 14,
      email: 8,
      position: 12,
      site: 6,
      division: 5,
      adsdExpiration: 15,
    },
    BOROUGE: {
      id: 1,
      nameOriginal: 2,
      employeeID: 4,
      extendedID: 7,
      phoneOriginal: 3,
      driverLiceID: 10,
      dlExpiration: 11,
      email: 8,
      position: 13,
      site: "",
      division: 5,
      adsdExpiration: 14,
    },
    ADNOC_HQ: {
      id: 1,
      nameOriginal: 2,
      employeeID: 4,
      extendedID: 7,
      phoneOriginal: 3,
      driverLiceID: 11,
      dlExpiration: 12,
      email: 8,
      position: 13,
      site: "",
      division: 6,
      adsdExpiration: 14,
    },
    ADNOC_LNG_OFFSHORE: {
      id: 1,
      nameOriginal: 2,
      employeeID: 4,
      extendedID: 8,
      phoneOriginal: 3,
      driverLiceID: 10,
      dlExpiration: 11,
      email: 12,
      position: 9,
      site: 5,
      division: 6,
      adsdExpiration: 13,
    },
    ADNOC_LOGISTIC_SERVICES: {
      id: 1,
      nameOriginal: 2,
      employeeID: 4,
      extendedID: 11,
      phoneOriginal: 3,
      driverLiceID: 13,
      dlExpiration: 14,
      email: 9,
      position: 12,
      site: 7,
      division: 6,
      adsdExpiration: 15,
    },
    ADNOC_OFFSHORE: {
      id: 1,
      nameOriginal: 2,
      employeeID: 4,
      extendedID: 10,
      phoneOriginal: 3,
      driverLiceID: 12,
      dlExpiration: 13,
      email: 11,
      position: 9,
      site: 8,
      division: 5,
      adsdExpiration: 14,
    },
    ADNOC_REFINING: {
      id: 1,
      nameOriginal: 2,
      employeeID: 4,
      extendedID: 8,
      phoneOriginal: 3,
      driverLiceID: 12,
      dlExpiration: 13,
      email: 10,
      position: 9,
      site: 6,
      division: 5,
      adsdExpiration: 14,
    },
    ADNOC_FERTILE: {
      id: 1,
      nameOriginal: 2,
      employeeID: 4,
      extendedID: 8,
      phoneOriginal: 3,
      driverLiceID: 9,
      dlExpiration: 10,
      email: 11,
      position: 9,
      site: 6,
      division: 6,
      adsdExpiration: 11,
    },
    ADNOC_ONSHORE: {
      id: 1,
      nameOriginal: 2,
      employeeID: 4,
      extendedID: 9,
      phoneOriginal: 3,
      driverLiceID: 11,
      dlExpiration: 12,
      email: 8,
      position: 10,
      site: 6,
      division: 5,
      adsdExpiration: 13,
    },
    ADNOC_GT: {
      id: 0,
      nameOriginal: 1,
      employeeID: 3,
      extendedID: 6,
      phoneOriginal: 2,
      driverLiceID: "",
      dlExpiration: "",
      email: "",
      position: 4,
      site: 4,
      division: 4,
      adsdExpiration: "",
    },
    ADNOC_ATA: {
      id: 1,
      nameOriginal: 2,
      employeeID: 4,
      extendedID: 7,
      phoneOriginal: 3,
      driverLiceID: 12,
      dlExpiration: 13,
      email: "",
      position: 8,
      site: 5,
      division: 5,
      adsdExpiration: "",
    },
    ALDHAFRA_PETROLEUM: {
      id: 1,
      nameOriginal: 2,
      employeeID: 4,
      extendedID: 7,
      phoneOriginal: 3,
      driverLiceID: 12,
      dlExpiration: 13,
      email: 10,
      position: 9,
      site: 5,
      division: 5,
      adsdExpiration: 14,
    },
    ADOC_JAPAN: {
      id: 1,
      nameOriginal: 2,
      employeeID: 4,
      extendedID: 8,
      phoneOriginal: 3,
      driverLiceID: 10,
      dlExpiration: 11,
      email: 9,
      position: 12,
      site: 6,
      division: 5,
      adsdExpiration: 14,
    },
    AL_MARIAH: {
      id: 1,
      nameOriginal: 3,
      employeeID: 4,
      extendedID: 6,
      phoneOriginal: 5,
      driverLiceID: 9,
      dlExpiration: 10,
      email: "",
      position: 8,
      site: 7,
      division: 7,
      adsdExpiration: 11,
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
    const candidateLabels = [tokens[5], tokens[6], tokens[7]].filter(Boolean);
    for (const token of candidateLabels) {
      const key = normalizeCompanyKey(token);
      if (companyIndexMap[key]) {
        return { rule: companyIndexMap[key], companyLabel: token.trim() };
      }
    }

    for (const token of tokens) {
      const key = normalizeCompanyKey(token);
      if (companyIndexMap[key]) {
        return { rule: companyIndexMap[key], companyLabel: token.trim() };
      }
    }

    return { rule: null, companyLabel: tokens[5] ? tokens[5].trim() : "" };
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

    const formatDate = (day, month, year) => {
      const normalizedYear = year.length === 2 ? `20${year}` : year;
      return `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${normalizedYear}`;
    };

    const monthYearMatch = value.match(/^([a-zA-Z]{3})[\/\- ](\d{2,4})$/);
    if (monthYearMatch) {
      const [, monthText, yearText] = monthYearMatch;
      const monthNum = months[monthText.toLowerCase()];
      if (monthNum) {
        return formatDate("01", monthNum, yearText);
      }
    }

    const alphaMatch = value.match(/^(\d{1,2})[\/\- ]([a-zA-Z]{3})[\/\- ](\d{2,4})$/);
    if (alphaMatch) {
      const [, day, monthText, yearText] = alphaMatch;
      const monthNum = months[monthText.toLowerCase()];
      if (monthNum) {
        return formatDate(day, monthNum, yearText);
      }
    }

    const numericMatch = value.match(/^(\d{1,4})[\/-](\d{1,2})[\/-](\d{1,4})$/);
    if (numericMatch) {
      const [, a, b, c] = numericMatch;
      const [year, month, day] = a.length === 4 ? [a, b, c] : [c, b, a];
      return formatDate(day, month, year);
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
      const { rule, companyLabel } = getCompanyRule(tokens);

      const phoneOriginal = rule
        ? getTokenAt(tokens, rule.phoneOriginal)
        : getTokenAt(tokens, 3);
      const expiryDLicense = rule ? getTokenAt(tokens, rule.dlExpiration) : "";
      const email = rule ? getTokenAt(tokens, rule.email) : "";
      const nameOriginal = rule
        ? getTokenAt(tokens, rule.nameOriginal)
        : getTokenAt(tokens, 2);
      const employeeID = rule
        ? getTokenAt(tokens, rule.employeeID)
        : getTokenAt(tokens, 4);
      const extendedID = rule ? getTokenAt(tokens, rule.extendedID) : "";
      const driverLiceID = rule ? getTokenAt(tokens, rule.driverLiceID) : "";
      const position = rule ? getTokenAt(tokens, rule.position) : "";
      const site = rule ? getTokenAt(tokens, rule.site) : "";
      const division = rule ? getTokenAt(tokens, rule.division) : "";
      const adsdExpiration = rule
        ? getTokenAt(tokens, rule.adsdExpiration)
        : "";

      let data = {
        id: rule ? getTokenAt(tokens, rule.id) : getTokenAt(tokens, 1),
        name: `${nameOriginal}${employeeID ? `-${employeeID}` : ""}`,
        nameOriginal,
        extendedID,
        phoneClean: onlyDigits(phoneOriginal),
        phoneOriginal,
        employeeID,
        driverLiceID,
        email,
        dlExpiration: normalizeDate(expiryDLicense),
        companyLabel: companyLabel || "",
        position,
        site,
        division,
        adsdExpiration: normalizeDate(adsdExpiration),
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
      // const notifEmailInput = document.querySelector(
      //   "#basicInfo_notificationEmails",
      // );
      const employeeIDInput = getDynamicInputByLabel("Employee ID");
      const driverMobileInput = getDynamicInputByLabel("Driver Mobile");
      const uIDInput = getDynamicInputByLabel("UID Number");
      const positionInput = getDynamicInputByLabel("Position");
      const siteInput = getDynamicInputByLabel("Site");
      const divisionInput = getDynamicInputByLabel("Division");
      const adsdExpireInput = getDynamicInputByLabel("ADSD expiry date");
      const notiEmailInput = getDynamicInputByLabel("Notification Emails");

      if (idInput) {
        idInput.value = data.id;
        dispatchEvents(idInput);
      }
      if (nameInput) {
        nameInput.value = data.name;
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
      if (notiEmailInput) {
        notiEmailInput.value = data.email;
        dispatchEvents(notiEmailInput);
      }
      if (employeeIDInput) {
        employeeIDInput.value = data.employeeID || "0";
        dispatchEvents(employeeIDInput);
      }
      if (driverMobileInput) {
        driverMobileInput.value = data.phoneClean || "0";
        dispatchEvents(driverMobileInput);
      }
      if (uIDInput) {
        uIDInput.value = data.extendedID;
        dispatchEvents(uIDInput);
      }
      if (positionInput) {
        positionInput.value = data.position || "x";
        dispatchEvents(positionInput);
      }
      if (siteInput && data.site) {
        siteInput.value = data.site;
        dispatchEvents(siteInput);
      }
      if (divisionInput && data.division) {
        divisionInput.value = data.division;
        dispatchEvents(divisionInput);
      }
      if (adsdExpireInput && data.adsdExpiration) {
        adsdExpireInput.value = data.adsdExpiration;
        dispatchEvents(adsdExpireInput);
      }

      alert(`Index[5] value: "${getTokenAt(tokens, 5)}"\nDetected company: "${companyLabel || "Unknown"}"\nID: ${data.id}\nName: ${data.nameOriginal}\nPhone: ${data.phoneOriginal}\nEmail: ${data.email}`);

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
