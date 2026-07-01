/* ==========================================================================
   Mosque Digital Display JS - Time Calculations & Settings Management
   ========================================================================== */
// Destructure classes from the global adhan object (loaded via script tag in index.html)
const { 
    Coordinates, 
    CalculationMethod, 
    PrayerTimes, 
    Madhab 
} = adhan;

// Default configuration settings
const DEFAULT_SETTINGS = {
    mosqueName: "Sali Islamic Center",
    locationMode: "custom", // auto, custom, london, mecca, etc.
    latitude: 30.0444,
    longitude: 31.2357,
    timezone: 2,
    calcMethod: "Egyptian",
    madhab: "Shafi",
    iqamahOffsets: {
        fajr: 20,
        dhuhr: 15,
        asr: 15,
        maghrib: 10,
        isha: 15
    },
    themePreset: "emerald",
    customColors: {
        primary: "#0f766e",
        accent: "#eab308",
        bg: "#022c22"
    },
    bgImageMode: "default",
    customBgUrl: "",
    announcements: "Hadith: Actions are judged by intentions. | Friday Prayer at 1:15 PM. | Quran: Indeed, prayer prohibits immorality and wrongdoing [29:45]. | Please silence your mobile phones in the prayer hall."
};

// City presets coordinates and default calculation methods
const CITY_PRESETS = {
    london: { lat: 51.5074, lng: -0.1278, tz: 1, method: "MuslimWorldLeague" },
    mecca: { lat: 21.4225, lng: 39.8262, tz: 3, method: "UmmAlQura" },
    jakarta: { lat: -6.2088, lng: 106.8456, tz: 7, method: "Singapore" },
    newyork: { lat: 40.7128, lng: -74.0060, tz: -4, method: "NorthAmerica" },
    cairo: { lat: 30.0444, lng: 31.2357, tz: 3, method: "Egyptian" }
};

// State variable
let settings = { ...DEFAULT_SETTINGS };
let currentActivePrayer = null;

// Initialize app when DOM loaded
document.addEventListener("DOMContentLoaded", () => {
    loadSettings();
    initSettingsUI();
    applySettings();
    
    // Start main time and calculation loops
    updateTimeAndPrayers();
    setInterval(updateTimeAndPrayers, 1000);
});

// Load settings from localStorage
function loadSettings() {
    const saved = localStorage.getItem("mosque_display_settings");
    if (saved) {
        try {
            settings = JSON.parse(saved);
            // Ensure any missing properties from updates get default values
            settings = { ...DEFAULT_SETTINGS, ...settings };
            settings.iqamahOffsets = { ...DEFAULT_SETTINGS.iqamahOffsets, ...settings.iqamahOffsets };
            settings.customColors = { ...DEFAULT_SETTINGS.customColors, ...settings.customColors };
        } catch (e) {
            console.error("Error parsing saved settings, resetting to defaults", e);
            settings = { ...DEFAULT_SETTINGS };
        }
    }
}

// Save settings to localStorage
function saveSettings() {
    localStorage.setItem("mosque_display_settings", JSON.stringify(settings));
}

// Apply settings visual changes immediately
function applySettings() {
    // 1. Set Mosque Name
    document.getElementById("mosqueNameDisplay").textContent = settings.mosqueName;

    // 2. Apply theme colors & container class
    const appDisplay = document.getElementById("appDisplay");
    
    // Clear theme classes
    appDisplay.classList.remove("theme-kaaba", "theme-royal", "theme-sunset");
    
    if (settings.themePreset === "custom") {
        document.documentElement.style.setProperty('--primary-color', settings.customColors.primary);
        document.documentElement.style.setProperty('--primary-glow', hexToRgbA(settings.customColors.primary, 0.4));
        document.documentElement.style.setProperty('--accent-color', settings.customColors.accent);
        document.documentElement.style.setProperty('--accent-glow', hexToRgbA(settings.customColors.accent, 0.4));
        document.documentElement.style.setProperty('--bg-dark', settings.customColors.bg);
        document.documentElement.style.setProperty('--bg-gradient', `linear-gradient(135deg, ${settings.customColors.bg} 0%, #1e293b 100%)`);
    } else {
        // Reset custom styles if predefined theme is selected
        document.documentElement.style.removeProperty('--primary-color');
        document.documentElement.style.removeProperty('--primary-glow');
        document.documentElement.style.removeProperty('--accent-color');
        document.documentElement.style.removeProperty('--accent-glow');
        document.documentElement.style.removeProperty('--bg-dark');
        document.documentElement.style.removeProperty('--bg-gradient');
        
        if (settings.themePreset !== "emerald") {
            appDisplay.classList.add(`theme-${settings.themePreset}`);
        }
    }

    // 3. Set Wallpaper Background pattern
    if (settings.bgImageMode === "custom" && settings.customBgUrl) {
        document.documentElement.style.setProperty('--bg-gradient', `url('${settings.customBgUrl}')`);
        document.documentElement.style.setProperty('--bg-pattern', 'none');
    } else if (settings.bgImageMode === "local") {
        document.documentElement.style.setProperty('--bg-gradient', "url('mosque_wallpaper.jpg')");
        document.documentElement.style.setProperty('--bg-pattern', 'none');
    } else {
        document.documentElement.style.setProperty('--bg-pattern', `var(--pattern-${settings.bgImageMode})`);
    }

    // 4. Update announcements ticker
    const tickerContent = document.getElementById("hadithTicker");
    const announcementsList = settings.announcements.split("|").map(t => t.trim()).filter(Boolean);
    tickerContent.innerHTML = "";
    announcementsList.forEach(text => {
        const item = document.createElement("span");
        item.style.marginRight = "100px";
        item.innerHTML = text;
        tickerContent.appendChild(item);
    });

    // Re-calculate prayer times immediately with new settings
    calculatePrayerTimes();
}

// Convert HEX to RGBA for Glow Effects
function hexToRgbA(hex, alpha) {
    let c;
    if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
        c = hex.substring(1).split('');
        if (c.length === 3) {
            c = [c[0], c[0], c[1], c[1], c[2], c[2]];
        }
        c = '0x' + c.join('');
        return `rgba(${[(c >> 16) & 255, (c >> 8) & 255, c & 255].join(',')},${alpha})`;
    }
    return hex;
}

// Helper to pad numbers
const pad = (num, size = 2) => num.toString().padStart(size, '0');

// Main Calculation Loop
function calculatePrayerTimes() {
    // 1. Coordinates and Params
    let lat = parseFloat(settings.latitude);
    let lng = parseFloat(settings.longitude);
    
    // Auto-detect override or presets
    if (settings.locationMode && settings.locationMode !== "custom" && settings.locationMode !== "auto") {
        const preset = CITY_PRESETS[settings.locationMode];
        if (preset) {
            lat = preset.lat;
            lng = preset.lng;
        }
    }

    const coordinates = new Coordinates(lat, lng);
    
    // Get adhan calculation parameters
    let params;
    if (settings.locationMode && settings.locationMode !== "custom" && settings.locationMode !== "auto") {
        const preset = CITY_PRESETS[settings.locationMode];
        params = CalculationMethod[preset.method]();
    } else {
        params = CalculationMethod[settings.calcMethod]();
    }

    // Madhab adjustment
    params.madhab = settings.madhab === "Hanafi" ? Madhab.Hanafi : Madhab.Shafi;

    // 2. Fetch Time for current day (at target offset)
    const systemDate = new Date();
    // Calculate date at targeted timezone to prevent mismatch issues when running on different locale systems
    const utcDate = new Date(systemDate.getTime() + systemDate.getTimezoneOffset() * 60000);
    const targetDate = new Date(utcDate.getTime() + (parseFloat(settings.timezone) * 3600000));

    const prayerTimes = new PrayerTimes(coordinates, targetDate, params);
    
    // Calculate Iqamah times based on offsets
    const iqamahTimes = {
        fajr: addMinutes(prayerTimes.fajr, settings.iqamahOffsets.fajr),
        dhuhr: addMinutes(prayerTimes.dhuhr, settings.iqamahOffsets.dhuhr),
        asr: addMinutes(prayerTimes.asr, settings.iqamahOffsets.asr),
        maghrib: addMinutes(prayerTimes.maghrib, settings.iqamahOffsets.maghrib),
        isha: addMinutes(prayerTimes.isha, settings.iqamahOffsets.isha)
    };

    // 3. Display Times in cards
    updateCardTimes(prayerTimes, iqamahTimes);

    // 4. Find Active & Next Prayer
    determineActiveAndNextPrayer(prayerTimes, iqamahTimes, targetDate, coordinates, params);
}

// Add minutes to a date helper
function addMinutes(date, minutes) {
    return new Date(date.getTime() + minutes * 60000);
}

// Update the DOM cards with values
function updateCardTimes(prayers, iqamahs) {
    document.getElementById("time-fajr").textContent = formatClockTime(prayers.fajr);
    document.getElementById("iqamah-fajr").textContent = formatClockTime(iqamahs.fajr);

    document.getElementById("time-sunrise").textContent = formatClockTime(prayers.sunrise);

    document.getElementById("time-dhuhr").textContent = formatClockTime(prayers.dhuhr);
    document.getElementById("iqamah-dhuhr").textContent = formatClockTime(iqamahs.dhuhr);

    document.getElementById("time-asr").textContent = formatClockTime(prayers.asr);
    document.getElementById("iqamah-asr").textContent = formatClockTime(iqamahs.asr);

    document.getElementById("time-maghrib").textContent = formatClockTime(prayers.maghrib);
    document.getElementById("iqamah-maghrib").textContent = formatClockTime(iqamahs.maghrib);

    document.getElementById("time-isha").textContent = formatClockTime(prayers.isha);
    document.getElementById("iqamah-isha").textContent = formatClockTime(iqamahs.isha);
}

// Format Date object to HH:MM format
function formatClockTime(date) {
    if (!date) return "--:--";
    let hours = date.getHours();
    let minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // 0 becomes 12
    return `${pad(hours)}:${pad(minutes)} ${ampm}`;
}

// Main state logic to determine current active prayer card and set next prayer countdown banner
function determineActiveAndNextPrayer(prayers, iqamahs, now, coordinates, params) {
    const timeList = [
        { name: "fajr", azan: prayers.fajr, iqamah: iqamahs.fajr },
        { name: "sunrise", azan: prayers.sunrise, iqamah: null },
        { name: "dhuhr", azan: prayers.dhuhr, iqamah: iqamahs.dhuhr },
        { name: "asr", azan: prayers.asr, iqamah: iqamahs.asr },
        { name: "maghrib", azan: prayers.maghrib, iqamah: iqamahs.maghrib },
        { name: "isha", azan: prayers.isha, iqamah: iqamahs.isha }
    ];

    const nowMs = now.getTime();
    
    // Find active prayer
    // An active prayer remains highlighted from its Azan time until the next prayer starts
    let activeIndex = -1;
    for (let i = 0; i < timeList.length; i++) {
        if (nowMs >= timeList[i].azan.getTime()) {
            activeIndex = i;
        }
    }
    // If before Fajr, the active prayer is Isha from previous day
    if (activeIndex === -1) {
        activeIndex = timeList.length - 1; // Isha
    }

    // Set highlighted card in DOM
    const activePrayer = timeList[activeIndex];
    if (currentActivePrayer !== activePrayer.name) {
        document.querySelectorAll(".prayer-card").forEach(c => c.classList.remove("active"));
        const card = document.getElementById(`card-${activePrayer.name}`);
        if (card) card.classList.add("active");
        currentActivePrayer = activePrayer.name;
    }

    // Calculate next prayer countdown details
    // Skip Shuruq for next actual prayer countdown list, but show next prayer
    let nextIndex = (activeIndex + 1) % timeList.length;
    let nextPrayer = timeList[nextIndex];
    
    // If next prayer is Sunrise, standard count down to next actual prayer is Dhuhr
    let isSunriseNext = (nextPrayer.name === "sunrise");
    let actualNextPrayer = isSunriseNext ? timeList[(nextIndex + 1) % timeList.length] : nextPrayer;

    let targetCountdownTime = actualNextPrayer.azan;
    let label = `Next: ${actualNextPrayer.name.toUpperCase()}`;

    // Calculate next day offsets if Fajr is next
    let isNextDay = false;
    if (nowMs >= timeList[timeList.length - 1].azan.getTime() || activeIndex === -1) {
        // Now is after Isha, next prayer is Fajr tomorrow
        isNextDay = true;
    }

    if (isNextDay && actualNextPrayer.name === "fajr") {
        // Compute Fajr for tomorrow
        const tomorrow = new Date(now.getTime() + 24 * 3600 * 1000);
        const tomorrowPrayers = new PrayerTimes(coordinates, tomorrow, params);
        targetCountdownTime = tomorrowPrayers.fajr;
    }

    // --- Special Iqamah Countdown Handling ---
    // If current time is AFTER current prayer's Azan, but BEFORE its Iqamah time
    let inIqamahWindow = false;
    let iqamahCountdownVal = 0;
    
    if (activePrayer.iqamah && nowMs >= activePrayer.azan.getTime() && nowMs < activePrayer.iqamah.getTime()) {
        inIqamahWindow = true;
        targetCountdownTime = activePrayer.iqamah;
        label = `⏳ IQAMAH: ${activePrayer.name.toUpperCase()}`;
    }

    // Countdown formatting
    let diffMs = targetCountdownTime.getTime() - nowMs;
    if (diffMs < 0 && !inIqamahWindow) {
        // edge fallback
        diffMs = 0;
    }

    const diffSecs = Math.floor(diffMs / 1000);
    const hrs = Math.floor(diffSecs / 3600);
    const mins = Math.floor((diffSecs % 3600) / 60);
    const secs = diffSecs % 60;

    const countdownStr = `${pad(hrs)}h ${pad(mins)}m ${pad(secs)}s`;
    
    const banner = document.getElementById("countdownCard");
    const labelEl = document.getElementById("countdownLabel");
    const valEl = document.getElementById("countdownValue");

    labelEl.textContent = label;
    valEl.textContent = countdownStr;

    // Audio alarm alert when Iqamah timer hits zero
    if (inIqamahWindow && diffSecs === 0) {
        triggerAudioAlert();
    }

    // Custom styling for active Iqamah countdown to flash/grab attention
    if (inIqamahWindow) {
        banner.style.border = "1px solid var(--accent-color)";
        banner.style.boxShadow = "0 0 25px var(--accent-glow)";
        valEl.style.color = "var(--accent-color)";
    } else {
        banner.style.border = "1px solid var(--card-border)";
        banner.style.boxShadow = "0 12px 40px rgba(0,0,0,0.3)";
        valEl.style.color = "var(--text-main)";
    }
}

// Play audio buzzer for congregational line-up
function triggerAudioAlert() {
    const beep = document.getElementById("beepAlert");
    if (beep) {
        beep.play().catch(e => console.log("Buzzer play blocked by browser autoplay rules. Interaction required.", e));
    }
}

// Live Time & Dates display loop
function updateTimeAndPrayers() {
    // Current local time
    const now = new Date();
    
    // Format Clock Display
    let hours = now.getHours();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    
    hours = hours % 12;
    hours = hours ? hours : 12; // 0 becomes 12
    
    document.getElementById("currentTime").textContent = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    document.getElementById("currentAmPm").textContent = ampm;

    // Gregorian Date
    const gregOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById("gregorianDateDisplay").textContent = now.toLocaleDateString('en-US', gregOptions);

    // Islamic Hijri Date via Intl API
    try {
        const hijriOptions = { calendar: 'islamic-umalqura', day: 'numeric', month: 'long', year: 'numeric' };
        const hijriFormatter = new Intl.DateTimeFormat('en-US-u-ca-islamic-umalqura', hijriOptions);
        document.getElementById("hijriDateDisplay").textContent = hijriFormatter.format(now);
    } catch (e) {
        document.getElementById("hijriDateDisplay").textContent = "Islamic Calendar Error";
    }

    // Recompute prayer calculations every second to keep next countdown smooth
    calculatePrayerTimes();
}

// ==========================================================================
// Settings Dialog & Tab Interaction Logic
// ==========================================================================

function initSettingsUI() {
    const modal = document.getElementById("settingsModal");
    const openBtn = document.getElementById("settingsBtn");
    const closeBtn = document.getElementById("closeSettingsBtn");
    const saveBtn = document.getElementById("saveSettingsBtn");
    const resetBtn = document.getElementById("resetSettingsBtn");
    
    // Modal toggle
    openBtn.addEventListener("click", () => {
        loadSettingsToForm();
        modal.classList.add("open");
    });
    
    closeBtn.addEventListener("click", () => {
        modal.classList.remove("open");
    });

    // Close on outer click
    window.addEventListener("click", (e) => {
        if (e.target === modal) {
            modal.classList.remove("open");
        }
    });

    // Hotkey: Press 'S' to open/close settings
    window.addEventListener("keydown", (e) => {
        if (e.key.toLowerCase() === 's' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
            if (modal.classList.contains("open")) {
                modal.classList.remove("open");
            } else {
                loadSettingsToForm();
                modal.classList.add("open");
            }
        }
    });

    // Settings tabs switcher
    const tabBtns = document.querySelectorAll(".tab-btn");
    const tabPanels = document.querySelectorAll(".tab-panel");
    tabBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            tabBtns.forEach(b => b.classList.remove("active"));
            tabPanels.forEach(p => p.classList.remove("active"));
            
            btn.classList.add("active");
            const tabId = btn.getAttribute("data-tab");
            document.getElementById(tabId).classList.add("active");
        });
    });

    // Theme Preset Selector logic
    const themeSelect = document.getElementById("themePreset");
    const customColorsSec = document.getElementById("customColorsSection");
    themeSelect.addEventListener("change", (e) => {
        if (e.target.value === "custom") {
            customColorsSec.style.display = "block";
        } else {
            customColorsSec.style.display = "none";
        }
    });

    // Wallpaper Preset logic
    const bgModeSelect = document.getElementById("bgImageMode");
    const customBgSec = document.getElementById("customBgUrlSection");
    bgModeSelect.addEventListener("change", (e) => {
        if (e.target.value === "custom") {
            customBgSec.style.display = "block";
        } else {
            customBgSec.style.display = "none";
        }
    });

    // Location mode presets auto fill
    const locModeSelect = document.getElementById("locationMode");
    const coordSec = document.getElementById("manualCoordinatesSection");
    locModeSelect.addEventListener("change", (e) => {
        const val = e.target.value;
        if (val === "custom") {
            coordSec.style.display = "block";
        } else if (val === "auto") {
            coordSec.style.display = "block";
            detectGeoLocation();
        } else {
            coordSec.style.display = "none";
            // Pre-fill coordinate boxes for visual feedback
            const city = CITY_PRESETS[val];
            if (city) {
                document.getElementById("latInput").value = city.lat;
                document.getElementById("lngInput").value = city.lng;
                document.getElementById("tzInput").value = city.tz;
                document.getElementById("calcMethod").value = city.method;
            }
        }
    });

    // Live Announcements Textarea Preview
    const tickerTextarea = document.getElementById("announcementTicker");
    const previewSpan = document.getElementById("tickerPreviewText");
    tickerTextarea.addEventListener("input", (e) => {
        const text = e.target.value || "Loading preview...";
        previewSpan.innerHTML = text.split("|").join(" &nbsp;&nbsp;&nbsp;&nbsp;&bull;&nbsp;&nbsp;&nbsp;&nbsp; ");
    });

    // Reset Defaults Action
    resetBtn.addEventListener("click", () => {
        if (confirm("Reset all settings to default values?")) {
            settings = { ...DEFAULT_SETTINGS };
            saveSettings();
            applySettings();
            modal.classList.remove("open");
        }
    });

    // Save Action
    saveBtn.addEventListener("click", () => {
        settings.mosqueName = document.getElementById("mosqueNameInput").value;
        settings.locationMode = document.getElementById("locationMode").value;
        settings.latitude = parseFloat(document.getElementById("latInput").value);
        settings.longitude = parseFloat(document.getElementById("lngInput").value);
        settings.timezone = parseFloat(document.getElementById("tzInput").value);
        settings.calcMethod = document.getElementById("calcMethod").value;
        settings.madhab = document.getElementById("madhab").value;
        
        settings.iqamahOffsets.fajr = parseInt(document.getElementById("fajrIqamah").value) || 0;
        settings.iqamahOffsets.dhuhr = parseInt(document.getElementById("dhuhrIqamah").value) || 0;
        settings.iqamahOffsets.asr = parseInt(document.getElementById("asrIqamah").value) || 0;
        settings.iqamahOffsets.maghrib = parseInt(document.getElementById("maghribIqamah").value) || 0;
        settings.iqamahOffsets.isha = parseInt(document.getElementById("ishaIqamah").value) || 0;

        settings.themePreset = document.getElementById("themePreset").value;
        settings.customColors.primary = document.getElementById("colorPrimary").value;
        settings.customColors.accent = document.getElementById("colorAccent").value;
        settings.customColors.bg = document.getElementById("colorBg").value;
        
        settings.bgImageMode = document.getElementById("bgImageMode").value;
        settings.customBgUrl = document.getElementById("customBgUrl").value;
        settings.announcements = document.getElementById("announcementTicker").value;

        saveSettings();
        applySettings();
        modal.classList.remove("open");
    });
}

// Auto Geolocate function
function detectGeoLocation() {
    if (!navigator.geolocation) {
        alert("Geolocation is not supported by your browser");
        return;
    }
    
    document.getElementById("locationMode").value = "auto";
    const statusText = "Detecting coordinates...";
    document.getElementById("latInput").value = "";
    document.getElementById("lngInput").value = "";
    
    navigator.geolocation.getCurrentPosition(
        (position) => {
            document.getElementById("latInput").value = position.coords.latitude.toFixed(4);
            document.getElementById("lngInput").value = position.coords.longitude.toFixed(4);
            
            // Auto calculate timezone offset in hours
            const offset = -new Date().getTimezoneOffset() / 60;
            document.getElementById("tzInput").value = offset;
        },
        (error) => {
            alert(`Unable to retrieve location: ${error.message}. Defaulting coordinates.`);
            document.getElementById("locationMode").value = "custom";
            document.getElementById("latInput").value = DEFAULT_SETTINGS.latitude;
            document.getElementById("lngInput").value = DEFAULT_SETTINGS.longitude;
            document.getElementById("tzInput").value = DEFAULT_SETTINGS.timezone;
        }
    );
}

// Pre-populate settings overlay form on open
function loadSettingsToForm() {
    document.getElementById("mosqueNameInput").value = settings.mosqueName;
    document.getElementById("locationMode").value = settings.locationMode;
    document.getElementById("latInput").value = settings.latitude;
    document.getElementById("lngInput").value = settings.longitude;
    document.getElementById("tzInput").value = settings.timezone;
    document.getElementById("calcMethod").value = settings.calcMethod;
    document.getElementById("madhab").value = settings.madhab;

    document.getElementById("fajrIqamah").value = settings.iqamahOffsets.fajr;
    document.getElementById("dhuhrIqamah").value = settings.iqamahOffsets.dhuhr;
    document.getElementById("asrIqamah").value = settings.iqamahOffsets.asr;
    document.getElementById("maghribIqamah").value = settings.iqamahOffsets.maghrib;
    document.getElementById("ishaIqamah").value = settings.iqamahOffsets.isha;

    document.getElementById("themePreset").value = settings.themePreset;
    document.getElementById("colorPrimary").value = settings.customColors.primary;
    document.getElementById("colorAccent").value = settings.customColors.accent;
    document.getElementById("colorBg").value = settings.customColors.bg;

    document.getElementById("bgImageMode").value = settings.bgImageMode;
    document.getElementById("customBgUrl").value = settings.customBgUrl;
    document.getElementById("announcementTicker").value = settings.announcements;

    // Show/hide sections accordingly
    const customColorsSec = document.getElementById("customColorsSection");
    customColorsSec.style.display = settings.themePreset === "custom" ? "block" : "none";

    const customBgSec = document.getElementById("customBgUrlSection");
    customBgSec.style.display = settings.bgImageMode === "custom" ? "block" : "none";

    const coordSec = document.getElementById("manualCoordinatesSection");
    coordSec.style.display = (settings.locationMode === "custom" || settings.locationMode === "auto") ? "block" : "none";

    // Set preview marquee text
    const text = settings.announcements || "Loading preview...";
    document.getElementById("tickerPreviewText").innerHTML = text.split("|").join(" &nbsp;&nbsp;&nbsp;&nbsp;&bull;&nbsp;&nbsp;&nbsp;&nbsp; ");
}
