// ==UserScript==
// @name         FMS Tech Autofill (More rows)
// @match        https://uae.fms-tech.com/BBIS/Fleet/Driver/*NewDriver*
// @match        https://vts.adnocdistribution.ae/VTS/Fleet/Driver/*NewDriver*
// @grant        none
// ==/UserScript==

(function () {
	'use strict';

	/* ==============================
	 UI BUTTONS (IMPROVED)
============================== */

	const pasteBtn = document.createElement("button");
	const clearBtn = document.createElement("button");

	Object.assign(pasteBtn.style, {
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

	Object.assign(clearBtn.style, {
		position: "fixed",
		top: "200px",
		right: "20px",
		zIndex: 999999,
		padding: "10px 16px",
		background: "#dc3545",
		color: "white",
		border: "none",
		borderRadius: "8px",
		cursor: "pointer",
		boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
		display: "none"
	});

	document.body.appendChild(pasteBtn);
	document.body.appendChild(clearBtn);

	/* ==============================
		 HELPERS
	============================== */

	const onlyDigits = s => s.replace(/\D/g, "");
	const isNumeric = s => /^\d+$/.test(s);
	const containsLetters = s => /[A-Za-z]/.test(s);

	function isDateLike(s) {
		return /^(?:\d{1,4}[\/\-.]\d{1,2}[\/\-.]\d{1,4})$/.test(s);
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

	function isSAP(token) {
		return isNumeric(token) && Number(token) >= 2900 && Number(token) <= 3200;
	}

	function isVTS(token) {
		return isNumeric(token) && Number(token) > 100000 && Number(token) < 900000;
	}

	function isName(token) {
		if (!containsLetters(token)) return false;
		if (isDateLike(token)) return false;
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

	function wait(ms) {
		return new Promise(resolve => setTimeout(resolve, ms));
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
		const validOptions = Array.from(selectEl.options).filter(opt => opt.value !== "" && opt.text.toLowerCase() !== "please select");

		// ONLY fill if there is exactly 1 valid option
		if (validOptions.length === 1) {
			selectEl.value = validOptions[0].value;

			// Trigger native events so the UI updates
			selectEl.dispatchEvent(new Event('change', { bubbles: true }));

			// If Bootstrap Select is being stubborn, this manual trigger usually fixes it:
			const btn = selectEl.closest('.bootstrap-select')?.querySelector('button');
			if (btn) {
				const filterText = btn.querySelector('.filter-option-inner-inner');
				if (filterText) filterText.textContent = validOptions[0].text;
			}
			console.log("✅ Auto-selected the only available company:", validOptions[0].text);
		}
	}

	function updateUI() {
		const queue = JSON.parse(localStorage.getItem("fms_fill_queue") || "[]");

		if (queue.length > 0) {
			pasteBtn.textContent = `⏳ Queue: ${queue.length}`;
			pasteBtn.style.background = "#6c757d"; // grey
			pasteBtn.style.pointerEvents = "none"; // disable click

			clearBtn.textContent = "Stop";
			clearBtn.style.display = "block";
		} else {
			pasteBtn.textContent = "📋 Paste Excel Row";
			pasteBtn.style.background = "#007bff";
			pasteBtn.style.pointerEvents = "auto";

			clearBtn.style.display = "none";
		}
	}
	/* ==============================
		 LOGGING LOGIC (UPDATED WITH COMPANY ID)
	============================== */

	function logPasteAction(data) {
		// 1. Get Date for Key (e.g., 01-Mar-26)
		const d = new Date();
		const day = d.getDate().toString().padStart(2, '0');
		const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
		const month = months[d.getMonth()];
		const year = d.getFullYear().toString().slice(-2);
		const storageKey = `${day}-${month}-${year}`;

		// 2. Get Company ID from Cookie "company_1723"
		const getCookie = (name) => {
			const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
			return match ? match[2] : "N/A";
		};
		const companyId = getCookie("company_1723");

		// 3. Scrape Company Name from Header
		let companyName = "Unknown";
		const companyImg = document.querySelector('a.dropdown-toggle img.img-circle');
		const companyBTag = document.querySelector('a.dropdown-toggle b.topheader-right-text');

		if (companyImg && companyImg.getAttribute("oldtitle")) {
			companyName = companyImg.getAttribute("oldtitle").trim();
		} else if (companyBTag) {
			companyName = companyBTag.textContent.trim();
		}

		// 4. Corrected Timestamp (Includes Date)
		const timestamp = d.toLocaleDateString('en-GB') + " " + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

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
		console.warn(`Copy log command: copy(localStorage.getItem("${storageKey}"));`);
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
			const match = options.find(opt => opt.text.trim() === driverId);

			if (match) {
				console.log("✅ Matching access card found:", match.text);

				// Optional: auto-select it (if not already selected)
				selectEl.value = match.value;
				selectEl.dispatchEvent(new Event("change", { bubbles: true }));

				const saveBtn = document.querySelector(
					'button[data-form="form_basicDriver"][data-groupidentifier="DriverInsert"]'
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
		try {
			const raw = await navigator.clipboard.readText();
			if (!raw || raw.trim() === "") return;
			localStorage.removeItem("fms_fill_queue");
			const rows = raw.trim().split(/\r?\n/).filter(r => r.trim() !== "");
			const allRowsData = rows.map(row => parseRow(row));

			// 1. Claim the first row for THIS tab
			const firstRow = allRowsData.shift();

			// 2. Save the remaining rows to the queue
			localStorage.setItem("fms_fill_queue", JSON.stringify(allRowsData));
			updateUI();

			// 3. Process the first row
			processRowData(firstRow);

		} catch (err) {
			console.error("Clipboard Error:", err);
		}
	}

	// Extracted parsing logic to work per row
	function parseRow(rowText) {
		const tokens = rowText.split(/\t/).map(t => t.replace(/\u00A0/g, " ").trim()).filter(Boolean);
		let data = { id: "", name: "", nameOriginal: "", phoneClean: "", phoneOriginal: "", sap: "", vts: "" };

		for (const token of tokens) {
			if (/^(LPO|CPP|Free)$/i.test(token) || /^LPO:/i.test(token)) continue;
			if (!data.id && isId(token)) { data.id = token; continue; }
			if (!data.sap && isSAP(token)) { data.sap = token; continue; }
			if (!data.vts && isVTS(token)) { data.vts = token; continue; }
			if (!data.phoneOriginal && isPhone(token)) {
				data.phoneClean = onlyDigits(token);
				data.phoneOriginal = token;
				continue;
			}
			if (!data.name && isName(token)) { data.name = token; data.nameOriginal = token; continue; }
		}
		if (data.name && (data.phoneOriginal || data.vts)) {
			data.name = `${data.name} - ${data.phoneOriginal || data.vts}`;
		}
		return data;
	}

	// Extracted UI filling logic
	/* ==============================
			UPDATED: PROCESS ROW DATA (OPENS NEXT TAB AT END)
	 ============================== */
	async function processRowData(data) {
		updateUI();
		const idInput = document.querySelector("#basicInfo_code");
		const nameInput = document.querySelector("#basicInfo_name");
		const phoneInput = document.querySelector("#basicInfo_phone1");
		const sapInput = getDynamicInputByLabel("Driver-SAP-ID");
		const emiratesInput = getDynamicInputByLabel("Emirates ID");

		if (idInput) { idInput.value = data.id; dispatchEvents(idInput); }
		if (nameInput) { nameInput.value = data.name; dispatchEvents(nameInput); }
		if (phoneInput) { phoneInput.value = data.phoneClean; dispatchEvents(phoneInput); }
		if (sapInput && data.sap) { sapInput.value = data.sap; dispatchEvents(sapInput); }
		if (emiratesInput) { emiratesInput.value = "xxx"; dispatchEvents(emiratesInput); }

		selectCompanyIfOnlyOne();
		logPasteAction(data);

		// Open "New Access Card"
		const newBtn = [...document.querySelectorAll("a.btn.btn-primary")].find(a => a.getAttribute("onclick")?.includes("DriverHelper.NewAccessCard"));
		if (newBtn) newBtn.click();

		setTimeout(() => {
			const accessInput = document.querySelector("#accessCardCode");
			if (accessInput) { accessInput.value = data.id; dispatchEvents(accessInput); }
		}, 1200);

		// --- SEQUENTIAL STEP: Check for next row after 2 seconds ---
		setTimeout(() => {
			let queue = JSON.parse(localStorage.getItem("fms_fill_queue") || "[]");
			if (queue.length > 0) {
				console.log("Opening next tab for remaining rows:", queue.length);
				window.open(window.location.href, '_blank');
			} else {
				console.log("Queue empty. Sequential processing finished.");
			}
		}, 2000); // Adjust this timing if you want the next tab to wait longer


		// --- AUTO-SAVE after 3 seconds ---
		setTimeout(() => {
			const saveBtn = [...document.querySelectorAll("a.btn.btn-primary")].find(a =>
				(a.textContent.trim() === "Save") &&
				a.getAttribute("onclick")?.includes("AddAccessCard")
			);
			if (saveBtn) {
				saveBtn.click();
				console.log("✅ Form Saved Automatically");
			}
		}, 5000);
		waitForAccessCardMatchAndSave();

	}

	/* ==============================
 IMPROVED: AUTO-FILL ON LOAD (WITH 3s DELAY)
============================== */
	window.addEventListener('load', async () => {
		console.log("⏳ Page loaded, waiting 3 seconds for queue sync...");

		updateUI();
		// 🔴 KEY FIX: Wait 3 seconds BEFORE touching localStorage
		await wait(3000);

		let attempts = 0;
		const maxAttempts = 9999;

		while (attempts < maxAttempts) {
			const queueRaw = localStorage.getItem("fms_fill_queue");
			const queue = queueRaw ? JSON.parse(queueRaw) : [];

			if (queue.length > 0) {
				const rowData = queue.shift();
				localStorage.setItem("fms_fill_queue", JSON.stringify(queue));
				updateUI();

				console.log("📥 Processing queued row:", rowData);

				// Small stabilization delay (reduced since we already waited 3s)
				await wait(400);

				processRowData(rowData);
				return;
			}

			attempts++;
			await wait(400);
		}
		console.warn("⚠️ No queue found after waiting.");
	});

	pasteBtn.addEventListener("click", fillFromClipboard);
	clearBtn.addEventListener("click", () => {
		if (confirm("Clear all queued rows?")) {
			localStorage.removeItem("fms_fill_queue");
			console.log("🗑️ Queue cleared");
			updateUI();
		}
	});
})();