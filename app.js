/* ==========================================================================
   Sali Mosque Digital Display JS - Advanced calculations, Calibrations & UI
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
    salahDuration: 15,
    jummahTime1: "12:30 PM",
    jummahTime2: "1:30 PM",
    hijriOffset: 0,
    offsets: {
        fajr: 0,
        sunrise: 0,
        dhuhr: 0,
        asr: 0,
        maghrib: 0,
        isha: 0
    },
    themePreset: "emerald",
    customColors: {
        primary: "#0f766e",
        accent: "#eab308",
        bg: "#022c22"
    },
    bgImageMode: "default",
    customBgUrl: "",
    announcements: "Hadith: Actions are judged by intentions. | Friday Prayer at 1:15 PM. | Quran: Indeed, prayer prohibits immorality and wrongdoing [29:45]. | Please silence your mobile phones in the prayer hall.",
    urgentAlert: "",
    donationUrl: "https://linktr.ee/saliitcare",
    donationText: "Your donations sustain our community. Scan to contribute.",
    classesText: "Join Sali Islamic classes: Tafsir circle every Saturday after Asr."
};

// City presets coordinates and default calculation methods
const CITY_PRESETS = {
    london: { lat: 51.5074, lng: -0.1278, tz: 1, method: "MuslimWorldLeague" },
    mecca: { lat: 21.4225, lng: 39.8262, tz: 3, method: "UmmAlQura" },
    jakarta: { lat: -6.2088, lng: 106.8456, tz: 7, method: "Singapore" },
    newyork: { lat: 40.7128, lng: -74.0060, tz: -4, method: "NorthAmerica" },
    cairo: { lat: 30.0444, lng: 31.2357, tz: 3, method: "Egyptian" }
};

// Application state
let settings = { ...DEFAULT_SETTINGS };
let currentActivePrayer = null;
let weatherCache = { temp: "--", desc: "Loading...", icon: "⛅", lastUpdated: 0 };

// Salah Overlay states
let isSalahOverlayActive = false;
let salahTimerInterval = null;
let salahTimeRemaining = 0; // seconds

// Initialize app when DOM loaded
document.addEventListener("DOMContentLoaded", () => {
    loadSettings();
    initSettingsUI();
    initSlideshow();
    initSalahOverlayDismiss();
    applySettings();
    
    // Start main clock and prayer computation loop
    updateTimeAndPrayers();
    setInterval(updateTimeAndPrayers, 1000);

    // Weather loop: Fetch weather on load, and then hourly
    fetchWeather();
    setInterval(fetchWeather, 3600000);
});

// Load settings from localStorage
function loadSettings() {
    const saved = localStorage.getItem("mosque_display_settings");
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            settings = { ...DEFAULT_SETTINGS, ...parsed };
            // Ensure nested objects preserve default fallbacks
            settings.iqamahOffsets = { ...DEFAULT_SETTINGS.iqamahOffsets, ...parsed.iqamahOffsets };
            settings.offsets = { ...DEFAULT_SETTINGS.offsets, ...parsed.offsets };
            settings.customColors = { ...DEFAULT_SETTINGS.customColors, ...parsed.customColors };
        } catch (e) {
            console.error("Error parsing saved settings, resetting defaults", e);
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
    const body = document.body;
    
    // Clear theme classes
    body.classList.remove(
        "theme-kaaba", "theme-royal", "theme-sunset", 
        "theme-ivory", "theme-amber", "theme-mint"
    );
    
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
            body.classList.add(`theme-${settings.themePreset}`);
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

    // 5. Update Urgent Announcement Banner
    const urgentBar = document.getElementById("urgentAlertBar");
    const urgentTextEl = document.getElementById("urgentAlertText");
    if (settings.urgentAlert && settings.urgentAlert.trim().length > 0) {
        urgentTextEl.textContent = settings.urgentAlert;
        urgentBar.style.display = "flex";
    } else {
        urgentBar.style.display = "none";
    }

    // 6. Update Weather immediately
    updateWeatherUI();
    fetchWeather();

    // 7. Update slide contents dynamically (Donation QR code and weekly classes)
    const donationTextEl = document.getElementById("donationTextDisplay");
    if (donationTextEl) donationTextEl.textContent = settings.donationText;

    const classesTextEl = document.getElementById("classesTextDisplay");
    if (classesTextEl) classesTextEl.textContent = settings.classesText;

    const qrImg = document.getElementById("donationQrImg");
    if (qrImg && settings.donationUrl) {
        qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(settings.donationUrl)}`;
    }

    // Re-calculate prayer times immediately with new settings
    calculatePrayerTimes();
}

// Convert HEX to RGBA helper
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

// Helper to add minutes to date
function addMinutes(date, minutes) {
    return new Date(date.getTime() + minutes * 60000);
}

// Calculate Qibla direction
function getQiblaDirection(lat1, lon1) {
    const lat2 = 21.4225 * (Math.PI / 180);
    const lon2 = 39.8262 * (Math.PI / 180);
    
    const phi1 = lat1 * (Math.PI / 180);
    const phi2 = lat2;
    const deltaLambda = (39.8262 - lon1) * (Math.PI / 180);

    const y = Math.sin(deltaLambda) * Math.cos(phi2);
    const x = Math.cos(phi1) * Math.sin(phi2) - 
              Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);

    let bearing = Math.atan2(y, x) * (180 / Math.PI);
    return (bearing + 360) % 360;
}

// Main Calculation Loop
function calculatePrayerTimes() {
    let lat = parseFloat(settings.latitude);
    let lng = parseFloat(settings.longitude);
    
    // Auto-detect overrides
    if (settings.locationMode && settings.locationMode !== "custom" && settings.locationMode !== "auto") {
        const preset = CITY_PRESETS[settings.locationMode];
        if (preset) {
            lat = preset.lat;
            lng = preset.lng;
        }
    }

    const coordinates = new Coordinates(lat, lng);
    
    // Qibla calculation
    const qiblaHeading = getQiblaDirection(lat, lng);
    const qiblaEl = document.getElementById("qiblaDisplay");
    if (qiblaEl) {
        qiblaEl.textContent = `Qibla: ${qiblaHeading.toFixed(1)}° from North 🧭`;
    }
    
    // Calculation settings parameter
    let params;
    if (settings.locationMode && settings.locationMode !== "custom" && settings.locationMode !== "auto") {
        const preset = CITY_PRESETS[settings.locationMode];
        params = CalculationMethod[preset.method]();
    } else {
        params = CalculationMethod[settings.calcMethod]();
    }

    params.madhab = settings.madhab === "Hanafi" ? Madhab.Hanafi : Madhab.Shafi;

    // Time targeting
    const systemDate = new Date();
    const utcDate = new Date(systemDate.getTime() + systemDate.getTimezoneOffset() * 60000);
    const targetDate = new Date(utcDate.getTime() + (parseFloat(settings.timezone) * 3600000));

    const prayerTimes = new PrayerTimes(coordinates, targetDate, params);
    
    // --- Apply Manual Timings Calibrations/Offsets ---
    const finalPrayers = {
        fajr: addMinutes(prayerTimes.fajr, settings.offsets.fajr),
        sunrise: addMinutes(prayerTimes.sunrise, settings.offsets.sunrise),
        dhuhr: addMinutes(prayerTimes.dhuhr, settings.offsets.dhuhr),
        asr: addMinutes(prayerTimes.asr, settings.offsets.asr),
        maghrib: addMinutes(prayerTimes.maghrib, settings.offsets.maghrib),
        isha: addMinutes(prayerTimes.isha, settings.offsets.isha)
    };

    // Calculate Iqamah times based on offsets
    const iqamahTimes = {
        fajr: addMinutes(finalPrayers.fajr, settings.iqamahOffsets.fajr),
        dhuhr: addMinutes(finalPrayers.dhuhr, settings.iqamahOffsets.dhuhr),
        asr: addMinutes(finalPrayers.asr, settings.iqamahOffsets.asr),
        maghrib: addMinutes(finalPrayers.maghrib, settings.iqamahOffsets.maghrib),
        isha: addMinutes(finalPrayers.isha, settings.iqamahOffsets.isha)
    };

    // --- Friday Jummah Mode adaptations ---
    const isFriday = targetDate.getDay() === 5;
    const dhuhrCard = document.getElementById("card-dhuhr");
    const normalDhuhrIqamahBox = document.getElementById("normalDhuhrIqamahBox");
    const jummahSessionsBox = document.getElementById("jummahSessionsBox");
    const dhuhrTitleEnglish = document.getElementById("dhuhrTitleEnglish");
    const dhuhrTitleArabic = document.getElementById("dhuhrTitleArabic");

    if (isFriday) {
        dhuhrTitleEnglish.textContent = "Jummah";
        dhuhrTitleArabic.textContent = "الجمعة";
        normalDhuhrIqamahBox.style.display = "none";
        
        document.getElementById("jummahSession1Val").textContent = settings.jummahTime1;
        document.getElementById("jummahSession2Val").textContent = settings.jummahTime2;
        jummahSessionsBox.style.display = "flex";
    } else {
        dhuhrTitleEnglish.textContent = "Dhuhr";
        dhuhrTitleArabic.textContent = "الظهر";
        jummahSessionsBox.style.display = "none";
        normalDhuhrIqamahBox.style.display = "flex";
    }

    // Display times inside card items
    updateCardTimes(finalPrayers, iqamahTimes);

    // Determine Active, Next and Iqamah states
    determineActiveAndNextPrayer(finalPrayers, iqamahTimes, targetDate, coordinates, params, isFriday);
}

// Update card elements
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

// Format date to readable clock string
function formatClockTime(date) {
    if (!date) return "--:--";
    let hours = date.getHours();
    let minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${pad(hours)}:${pad(minutes)} ${ampm}`;
}

// Logic flow for active / next prayer and Iqamah timings
function determineActiveAndNextPrayer(prayers, iqamahs, now, coordinates, params, isFriday) {
    const timeList = [
        { name: "fajr", azan: prayers.fajr, iqamah: iqamahs.fajr },
        { name: "sunrise", azan: prayers.sunrise, iqamah: null },
        { name: "dhuhr", azan: prayers.dhuhr, iqamah: isFriday ? null : iqamahs.dhuhr }, // No normal Iqamah on Friday
        { name: "asr", azan: prayers.asr, iqamah: iqamahs.asr },
        { name: "maghrib", azan: prayers.maghrib, iqamah: iqamahs.maghrib },
        { name: "isha", azan: prayers.isha, iqamah: iqamahs.isha }
    ];

    const nowMs = now.getTime();
    
    // Find active card index
    let activeIndex = -1;
    for (let i = 0; i < timeList.length; i++) {
        if (nowMs >= timeList[i].azan.getTime()) {
            activeIndex = i;
        }
    }
    if (activeIndex === -1) {
        activeIndex = timeList.length - 1; // Isha
    }

    const activePrayer = timeList[activeIndex];
    
    // Update active highlight style class in DOM
    if (currentActivePrayer !== activePrayer.name) {
        document.querySelectorAll(".prayer-card").forEach(c => c.classList.remove("active"));
        const card = document.getElementById(`card-${activePrayer.name}`);
        if (card) card.classList.add("active");
        currentActivePrayer = activePrayer.name;
    }

    // Determine target countdown details
    let nextIndex = (activeIndex + 1) % timeList.length;
    let nextPrayer = timeList[nextIndex];
    let actualNextPrayer = (nextPrayer.name === "sunrise") ? timeList[(nextIndex + 1) % timeList.length] : nextPrayer;

    let targetCountdownTime = actualNextPrayer.azan;
    let label = `Next: ${actualNextPrayer.name.toUpperCase()}`;

    // Adjust for next day Fajr countdowns
    let isNextDay = false;
    if (nowMs >= timeList[timeList.length - 1].azan.getTime() || activeIndex === -1) {
        isNextDay = true;
    }

    if (isNextDay && actualNextPrayer.name === "fajr") {
        const tomorrow = new Date(now.getTime() + 24 * 3600 * 1000);
        const tomorrowBase = new PrayerTimes(coordinates, tomorrow, params);
        // Apply offsets to tomorrow's Fajr
        targetCountdownTime = addMinutes(tomorrowBase.fajr, settings.offsets.fajr);
    }

    // --- Special Iqamah Countdown Handling ---
    let inIqamahWindow = false;
    let currentSalahName = "";

    // 1. Normal Iqamah Window
    if (!isFriday || activePrayer.name !== "dhuhr") {
        if (activePrayer.iqamah && nowMs >= activePrayer.azan.getTime() && nowMs < activePrayer.iqamah.getTime()) {
            inIqamahWindow = true;
            targetCountdownTime = activePrayer.iqamah;
            label = `⏳ IQAMAH: ${activePrayer.name.toUpperCase()}`;
            currentSalahName = activePrayer.name;
        }
    } else if (isFriday && activePrayer.name === "dhuhr") {
        // 2. Jummah Friday Mode Sessions Countdown
        // Parse configured Jummah Session times (e.g. "12:30 PM", "1:30 PM")
        const sess1Time = parseTimeString(settings.jummahTime1, now);
        const sess2Time = parseTimeString(settings.jummahTime2, now);
        
        if (sess1Time && nowMs < sess1Time.getTime()) {
            // Counting down to Session 1
            targetCountdownTime = sess1Time;
            label = `🕌 Jummah Session 1`;
        } else if (sess2Time && nowMs < sess2Time.getTime()) {
            // Counting down to Session 2
            targetCountdownTime = sess2Time;
            label = `🕌 Jummah Session 2`;
        }
    }

    let diffMs = targetCountdownTime.getTime() - nowMs;
    if (diffMs < 0) diffMs = 0;

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

    // --- Dimmer Overlay trigger when Iqamah reaches zero ---
    if (inIqamahWindow && diffSecs === 0 && !isSalahOverlayActive) {
        triggerAudioAlert();
        triggerSalahOverlay(currentSalahName);
    }

    // Toggle flash colors during Iqamah active countdown
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

// Convert "12:30 PM" to Date object helper
function parseTimeString(timeStr, baseDate) {
    if (!timeStr) return null;
    try {
        const clean = timeStr.trim().toUpperCase();
        const parts = clean.match(/^(\d+):(\d+)\s*(AM|PM)$/);
        if (!parts) return null;
        
        let hrs = parseInt(parts[1]);
        const mins = parseInt(parts[2]);
        const ampm = parts[3];
        
        if (ampm === "PM" && hrs < 12) hrs += 12;
        if (ampm === "AM" && hrs === 12) hrs = 0;
        
        const date = new Date(baseDate.getTime());
        date.setHours(hrs, mins, 0, 0);
        return date;
    } catch (e) {
        return null;
    }
}

// Audio alert beep sound
function triggerAudioAlert() {
    const beep = document.getElementById("beepAlert");
    if (beep) {
        beep.play().catch(e => console.log("Buzzer blocked", e));
    }
}

// Salah overlay activation
function triggerSalahOverlay(salahName) {
    isSalahOverlayActive = true;
    salahTimeRemaining = (parseInt(settings.salahDuration) || 15) * 60;
    
    const overlay = document.getElementById("salahOverlay");
    overlay.classList.add("open");
    
    updateSalahTimerUI();
    
    salahTimerInterval = setInterval(() => {
        salahTimeRemaining--;
        if (salahTimeRemaining <= 0) {
            closeSalahOverlay();
        } else {
            updateSalahTimerUI();
        }
    }, 1000);
}

// Close Salah Dimmer Overlay
function closeSalahOverlay() {
    isSalahOverlayActive = false;
    clearInterval(salahTimerInterval);
    document.getElementById("salahOverlay").classList.remove("open");
}

// Update Salah duration text inside overlay
function updateSalahTimerUI() {
    const mins = Math.floor(salahTimeRemaining / 60);
    const secs = salahTimeRemaining % 60;
    document.getElementById("salahTimer").textContent = `Salah Ends in: ${pad(mins)}:${pad(secs)}`;
}

// Hook up event listeners for overlay dismissal
function initSalahOverlayDismiss() {
    // 1. Dimmer dismiss button
    document.getElementById("salahDismissBtn").addEventListener("click", closeSalahOverlay);
    
    // 2. Dismiss via Escape key
    window.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && isSalahOverlayActive) {
            closeSalahOverlay();
        }
    });
}

// Live Time, Dates, and Hijri calibration calculations
function updateTimeAndPrayers() {
    const now = new Date();
    
    // Format clock
    let hours = now.getHours();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    
    hours = hours % 12;
    hours = hours ? hours : 12;
    
    document.getElementById("currentTime").textContent = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    document.getElementById("currentAmPm").textContent = ampm;

    // Gregorian Date
    const gregOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById("gregorianDateDisplay").textContent = now.toLocaleDateString('en-US', gregOptions);

    // Calibrated Hijri Calendar Date
    try {
        // Add manual Hijri offset configuration to dates
        const hijriDate = new Date(now.getTime() + (parseInt(settings.hijriOffset) || 0) * 24 * 3600 * 1000);
        const hijriOptions = { calendar: 'islamic-umalqura', day: 'numeric', month: 'long', year: 'numeric' };
        const hijriFormatter = new Intl.DateTimeFormat('en-US-u-ca-islamic-umalqura', hijriOptions);
        document.getElementById("hijriDateDisplay").textContent = hijriFormatter.format(hijriDate);
    } catch (e) {
        document.getElementById("hijriDateDisplay").textContent = "Islamic Calendar Error";
    }

    // Run prayer schedule adjustments
    calculatePrayerTimes();
}

// ==========================================================================
// Weather Query Logic (Open-Meteo Integration)
// ==========================================================================

async function fetchWeather() {
    // Prevent spam queries, throttle queries to once every 10 minutes
    const nowMs = Date.now();
    if (nowMs - weatherCache.lastUpdated < 600000 && weatherCache.temp !== "--") {
        return;
    }

    let lat = parseFloat(settings.latitude);
    let lng = parseFloat(settings.longitude);

    if (settings.locationMode && settings.locationMode !== "custom" && settings.locationMode !== "auto") {
        const preset = CITY_PRESETS[settings.locationMode];
        if (preset) {
            lat = preset.lat;
            lng = preset.lng;
        }
    }

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true`;
    
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error("Weather fetch failed");
        
        const data = await res.json();
        const cw = data.current_weather;
        
        weatherCache.temp = Math.round(cw.temperature);
        weatherCache.lastUpdated = nowMs;
        
        // Map WMO codes to description and emoji
        const wCode = cw.weathercode;
        if (wCode === 0) {
            weatherCache.desc = "Clear";
            weatherCache.icon = "☀️";
        } else if (wCode >= 1 && wCode <= 3) {
            weatherCache.desc = "Partly Cloudy";
            weatherCache.icon = "⛅";
        } else if (wCode >= 45 && wCode <= 48) {
            weatherCache.desc = "Foggy";
            weatherCache.icon = "🌫️";
        } else if (wCode >= 51 && wCode <= 65) {
            weatherCache.desc = "Rainy";
            weatherCache.icon = "🌧️";
        } else if (wCode >= 71 && wCode <= 77) {
            weatherCache.desc = "Snowy";
            weatherCache.icon = "❄️";
        } else if (wCode >= 80 && wCode <= 82) {
            weatherCache.desc = "Showers";
            weatherCache.icon = "🌧️";
        } else if (wCode >= 95 && wCode <= 99) {
            weatherCache.desc = "Stormy";
            weatherCache.icon = "🌩️";
        } else {
            weatherCache.desc = "Cloudy";
            weatherCache.icon = "☁️";
        }
        
        updateWeatherUI();
    } catch (e) {
        console.warn("Unable to fetch weather (offline or API limit):", e);
        // Keep cached version or display offline status
        if (weatherCache.temp === "--") {
            weatherCache.desc = "Offline";
            weatherCache.icon = "⛅";
            updateWeatherUI();
        }
    }
}

// Update weather widgets inside header
function updateWeatherUI() {
    const tempEl = document.querySelector(".weather-temp");
    const descEl = document.querySelector(".weather-desc");
    const iconEl = document.querySelector(".weather-icon");
    
    if (tempEl && descEl && iconEl) {
        iconEl.textContent = weatherCache.icon;
        tempEl.textContent = weatherCache.temp !== "--" ? `${weatherCache.temp}°C` : "";
        descEl.textContent = weatherCache.desc;
    }
}

// ==========================================================================
// Slideshow Panel Cycler
// ==========================================================================

function initSlideshow() {
    let currentSlide = 1;
    const totalSlides = 4;
    setInterval(() => {
        // If Salah Overlay is active, pause slideshow calculations
        if (isSalahOverlayActive) return;

        document.querySelectorAll(".slide").forEach(s => s.classList.remove("active"));
        currentSlide = (currentSlide % totalSlides) + 1;
        const nextSlide = document.getElementById(`slide-${currentSlide}`);
        if (nextSlide) nextSlide.classList.add("active");
    }, 15000); // Rotate slides every 15 seconds
}

// ==========================================================================
// Settings Drawer Form Management
// ==========================================================================

function initSettingsUI() {
    const modal = document.getElementById("settingsModal");
    const openBtn = document.getElementById("settingsBtn");
    const closeBtn = document.getElementById("closeSettingsBtn");
    const saveBtn = document.getElementById("saveSettingsBtn");
    const resetBtn = document.getElementById("resetSettingsBtn");
    
    // Modal drawer opening
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

    // Keyboard Hotkeys: S to toggle settings
    window.addEventListener("keydown", (e) => {
        if (e.key.toLowerCase() === 's' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
            // Ignore if Salah Overlay is active
            if (isSalahOverlayActive) return;

            if (modal.classList.contains("open")) {
                modal.classList.remove("open");
            } else {
                loadSettingsToForm();
                modal.classList.add("open");
            }
        }
    });

    // Tabs switches
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

    // Color theme logic selectors
    const themeSelect = document.getElementById("themePreset");
    const customColorsSec = document.getElementById("customColorsSection");
    themeSelect.addEventListener("change", (e) => {
        customColorsSec.style.display = e.target.value === "custom" ? "block" : "none";
    });

    // Wallpaper Preset logic selectors
    const bgModeSelect = document.getElementById("bgImageMode");
    const customBgSec = document.getElementById("customBgUrlSection");
    bgModeSelect.addEventListener("change", (e) => {
        customBgSec.style.display = e.target.value === "custom" ? "block" : "none";
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
            const city = CITY_PRESETS[val];
            if (city) {
                document.getElementById("latInput").value = city.lat;
                document.getElementById("lngInput").value = city.lng;
                document.getElementById("tzInput").value = city.tz;
                document.getElementById("calcMethod").value = city.method;
            }
        }
    });

    // Live announcements preview
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
        
        // Save Iqamahs
        settings.iqamahOffsets.fajr = parseInt(document.getElementById("fajrIqamah").value) || 0;
        settings.iqamahOffsets.dhuhr = parseInt(document.getElementById("dhuhrIqamah").value) || 0;
        settings.iqamahOffsets.asr = parseInt(document.getElementById("asrIqamah").value) || 0;
        settings.iqamahOffsets.maghrib = parseInt(document.getElementById("maghribIqamah").value) || 0;
        settings.iqamahOffsets.isha = parseInt(document.getElementById("ishaIqamah").value) || 0;

        // Save Salah & Jummah config
        settings.salahDuration = parseInt(document.getElementById("salahDuration").value) || 15;
        settings.jummahTime1 = document.getElementById("jummahTime1").value;
        settings.jummahTime2 = document.getElementById("jummahTime2").value;

        // Save Calibrations
        settings.hijriOffset = parseInt(document.getElementById("hijriOffset").value) || 0;
        settings.offsets.fajr = parseInt(document.getElementById("offsetFajr").value) || 0;
        settings.offsets.sunrise = parseInt(document.getElementById("offsetSunrise").value) || 0;
        settings.offsets.dhuhr = parseInt(document.getElementById("offsetDhuhr").value) || 0;
        settings.offsets.asr = parseInt(document.getElementById("offsetAsr").value) || 0;
        settings.offsets.maghrib = parseInt(document.getElementById("offsetMaghrib").value) || 0;
        settings.offsets.isha = parseInt(document.getElementById("offsetIsha").value) || 0;

        // Save Theme
        settings.themePreset = document.getElementById("themePreset").value;
        settings.customColors.primary = document.getElementById("colorPrimary").value;
        settings.customColors.accent = document.getElementById("colorAccent").value;
        settings.customColors.bg = document.getElementById("colorBg").value;
        
        // Save bg image
        settings.bgImageMode = document.getElementById("bgImageMode").value;
        settings.customBgUrl = document.getElementById("customBgUrl").value;
        settings.announcements = document.getElementById("announcementTicker").value;
        settings.urgentAlert = document.getElementById("urgentAlertField").value;

        // Save slides configurations
        settings.donationUrl = document.getElementById("donationUrlField").value || "https://linktr.ee/saliitcare";
        settings.donationText = document.getElementById("donationTextField").value || "Your donations sustain our community. Scan to contribute.";
        settings.classesText = document.getElementById("classesTextField").value || "Join Sali Islamic classes: Tafsir circle every Saturday after Asr.";

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
    document.getElementById("latInput").value = "";
    document.getElementById("lngInput").value = "";
    
    navigator.geolocation.getCurrentPosition(
        (position) => {
            document.getElementById("latInput").value = position.coords.latitude.toFixed(4);
            document.getElementById("lngInput").value = position.coords.longitude.toFixed(4);
            const offset = -new Date().getTimezoneOffset() / 60;
            document.getElementById("tzInput").value = offset;
        },
        (error) => {
            alert(`Unable to retrieve location: ${error.message}. Defaulting.`);
            document.getElementById("locationMode").value = "custom";
            document.getElementById("latInput").value = DEFAULT_SETTINGS.latitude;
            document.getElementById("lngInput").value = DEFAULT_SETTINGS.longitude;
            document.getElementById("tzInput").value = DEFAULT_SETTINGS.timezone;
        }
    );
}

// Pre-populate settings form inputs on open
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

    // Load Salah & Jummah
    document.getElementById("salahDuration").value = settings.salahDuration;
    document.getElementById("jummahTime1").value = settings.jummahTime1;
    document.getElementById("jummahTime2").value = settings.jummahTime2;

    // Load Calibrations
    document.getElementById("hijriOffset").value = settings.hijriOffset;
    document.getElementById("offsetFajr").value = settings.offsets.fajr;
    document.getElementById("offsetSunrise").value = settings.offsets.sunrise;
    document.getElementById("offsetDhuhr").value = settings.offsets.dhuhr;
    document.getElementById("offsetAsr").value = settings.offsets.asr;
    document.getElementById("offsetMaghrib").value = settings.offsets.maghrib;
    document.getElementById("offsetIsha").value = settings.offsets.isha;

    // Load Theme details
    document.getElementById("themePreset").value = settings.themePreset;
    document.getElementById("colorPrimary").value = settings.customColors.primary;
    document.getElementById("colorAccent").value = settings.customColors.accent;
    document.getElementById("colorBg").value = settings.customColors.bg;

    document.getElementById("bgImageMode").value = settings.bgImageMode;
    document.getElementById("customBgUrl").value = settings.customBgUrl;
    document.getElementById("announcementTicker").value = settings.announcements;
    document.getElementById("urgentAlertField").value = settings.urgentAlert;

    // Load slides configurations
    document.getElementById("donationUrlField").value = settings.donationUrl || "https://linktr.ee/saliitcare";
    document.getElementById("donationTextField").value = settings.donationText || "Your donations sustain our community. Scan to contribute.";
    document.getElementById("classesTextField").value = settings.classesText || "Join Sali Islamic classes: Tafsir circle every Saturday after Asr.";

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
