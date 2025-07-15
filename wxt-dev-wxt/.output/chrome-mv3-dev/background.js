var background = function() {
  "use strict";
  var _a, _b;
  function defineBackground(arg) {
    if (arg == null || typeof arg === "function") return { main: arg };
    return arg;
  }
  const browser$1 = ((_b = (_a = globalThis.browser) == null ? void 0 : _a.runtime) == null ? void 0 : _b.id) ? globalThis.browser : globalThis.chrome;
  const browser = browser$1;
  const definition = defineBackground(() => {
    console.log("SipAlotl background service loaded!", { id: browser.runtime.id });
    const DAY_TRACKING_CONFIG = {
      // When the "day" starts for water tracking (24-hour format)
      dayStartHour: 6,
      // 6 AM default
      dayStartMinute: 0,
      // How often to check for day transitions (minutes)
      dayCheckInterval: 30,
      // Timezone handling
      useLocalTime: true
    };
    chrome.runtime.onInstalled.addListener(() => {
      chrome.alarms.create("waterReminder", {
        delayInMinutes: 10,
        periodInMinutes: 10
      });
      chrome.alarms.create("dayTransitionCheck", {
        delayInMinutes: DAY_TRACKING_CONFIG.dayCheckInterval,
        periodInMinutes: DAY_TRACKING_CONFIG.dayCheckInterval
      });
      initializeDayTracking();
    });
    chrome.alarms.onAlarm.addListener(async (alarm) => {
      if (alarm.name === "waterReminder") {
        await handleWaterReminder();
      } else if (alarm.name === "dayTransitionCheck") {
        await handleDayTransition();
      }
    });
    async function initializeDayTracking() {
      const result2 = await chrome.storage.local.get(["dayTrackingConfig", "currentDayId", "dayStartTime", "dayStartHour"]);
      if (!result2.dayTrackingConfig) {
        await chrome.storage.local.set({
          dayTrackingConfig: DAY_TRACKING_CONFIG,
          dayStartHour: DAY_TRACKING_CONFIG.dayStartHour
        });
      }
      if (!result2.currentDayId) {
        const currentDayId = getCurrentDayId(result2.dayStartHour || DAY_TRACKING_CONFIG.dayStartHour);
        await chrome.storage.local.set({
          currentDayId,
          dayStartTime: getDayStartTime(result2.dayStartHour || DAY_TRACKING_CONFIG.dayStartHour)
        });
      }
    }
    function getCurrentDayId(dayStartHour = DAY_TRACKING_CONFIG.dayStartHour) {
      const now = /* @__PURE__ */ new Date();
      const dayStart = new Date(now);
      dayStart.setHours(dayStartHour, 0, 0, 0);
      const effectiveDate = now < dayStart ? new Date(now.getTime() - 24 * 60 * 60 * 1e3) : now;
      return effectiveDate.toISOString().split("T")[0];
    }
    function getDayStartTime(dayStartHour = DAY_TRACKING_CONFIG.dayStartHour) {
      const now = /* @__PURE__ */ new Date();
      const dayStart = new Date(now);
      dayStart.setHours(dayStartHour, 0, 0, 0);
      if (now >= dayStart) {
        dayStart.setDate(dayStart.getDate() + 1);
      }
      return dayStart.getTime();
    }
    async function handleDayTransition() {
      const result2 = await chrome.storage.local.get([
        "currentDayId",
        "dayStartTime",
        "waterIntakeCurrent",
        "waterIntakeTarget",
        "dailyHistory",
        "dayStartHour"
      ]);
      const dayStartHour = result2.dayStartHour || DAY_TRACKING_CONFIG.dayStartHour;
      const currentDayId = getCurrentDayId(dayStartHour);
      const storedDayId = result2.currentDayId;
      if (currentDayId !== storedDayId) {
        console.log(`Day transition detected: ${storedDayId} → ${currentDayId}`);
        await archivePreviousDay(result2);
        await resetCurrentDay(currentDayId, dayStartHour);
        await notifyDayTransition();
      }
    }
    async function archivePreviousDay(previousData) {
      const { currentDayId, waterIntakeCurrent, waterIntakeTarget } = previousData;
      if (!currentDayId || waterIntakeCurrent === void 0) return;
      const result2 = await chrome.storage.local.get(["dailyHistory"]);
      const dailyHistory = result2.dailyHistory || {};
      dailyHistory[currentDayId] = {
        date: currentDayId,
        totalIntake: waterIntakeCurrent || 0,
        target: waterIntakeTarget || 0,
        completedAt: Date.now(),
        goalReached: (waterIntakeCurrent || 0) >= (waterIntakeTarget || 0)
      };
      const sortedDates = Object.keys(dailyHistory).sort();
      if (sortedDates.length > 30) {
        const toDelete = sortedDates.slice(0, sortedDates.length - 30);
        toDelete.forEach((date) => delete dailyHistory[date]);
      }
      await chrome.storage.local.set({ dailyHistory });
    }
    async function resetCurrentDay(newDayId, dayStartHour) {
      await chrome.storage.local.set({
        currentDayId: newDayId,
        waterIntakeCurrent: 0,
        dayStartTime: getDayStartTime(dayStartHour),
        lastResetDate: (/* @__PURE__ */ new Date()).toDateString()
        // Keep for backwards compatibility
      });
    }
    async function notifyDayTransition() {
      const result2 = await chrome.storage.local.get(["notificationsEnabled", "waterIntakeTarget"]);
      if (result2.notificationsEnabled && result2.waterIntakeTarget) {
        const targetL = (result2.waterIntakeTarget / 1e3).toFixed(1);
        chrome.notifications.create({
          type: "basic",
          iconUrl: "icon/mascot.png",
          title: "🌅 New Day Started!",
          message: `Ready for a fresh start? Your goal today is ${targetL}L!`
        });
      }
    }
    async function handleWaterReminder() {
      const result2 = await chrome.storage.local.get([
        "notificationsEnabled",
        "waterIntakeTarget",
        "waterIntakeCurrent",
        "lastReminderTime",
        "currentDayId",
        "dayStartHour"
      ]);
      if (!result2.notificationsEnabled) return;
      if (!result2.waterIntakeTarget) return;
      const dayStartHour = result2.dayStartHour || DAY_TRACKING_CONFIG.dayStartHour;
      const currentDayId = getCurrentDayId(dayStartHour);
      let currentIntake = result2.waterIntakeCurrent || 0;
      if (result2.currentDayId !== currentDayId) {
        await handleDayTransition();
        currentIntake = 0;
      }
      const now = Date.now();
      const lastReminder = result2.lastReminderTime || 0;
      if (now - lastReminder < 8 * 60 * 1e3) return;
      const progress = currentIntake / result2.waterIntakeTarget * 100;
      const remainingL = ((result2.waterIntakeTarget - currentIntake) / 1e3).toFixed(1);
      let title, message;
      if (progress >= 100) {
        title = "🎉 Goal Complete!";
        message = "Amazing work! You've reached your daily hydration goal!";
      } else if (progress >= 75) {
        title = "💧 Almost There!";
        message = `You're ${progress.toFixed(0)}% there! Just ${remainingL}L to go!`;
      } else if (progress >= 50) {
        title = "🐸 Halfway Mark!";
        message = `Great progress! Keep it up - ${remainingL}L remaining.`;
      } else if (progress >= 25) {
        title = "💦 Getting Started!";
        message = `Don't forget to hydrate! ${remainingL}L left for today.`;
      } else {
        title = "🚰 Hydration Reminder";
        message = `Your axolotl is thirsty! ${remainingL}L needed today.`;
      }
      chrome.notifications.create({
        type: "basic",
        iconUrl: "icon/mascot.png",
        title,
        message
      });
      await chrome.storage.local.set({
        lastReminderTime: now
      });
    }
    chrome.notifications.onClicked.addListener(() => {
      chrome.action.openPopup();
    });
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === "getDayInfo") {
        chrome.storage.local.get(["dayStartHour"]).then((result2) => {
          const dayStartHour = result2.dayStartHour || DAY_TRACKING_CONFIG.dayStartHour;
          const dayInfo = {
            currentDayId: getCurrentDayId(dayStartHour),
            dayStartTime: getDayStartTime(dayStartHour),
            dayStartHour,
            config: DAY_TRACKING_CONFIG
          };
          sendResponse(dayInfo);
        });
        return true;
      }
      if (request.action === "updateDayStartHour") {
        chrome.storage.local.set({ dayStartHour: request.hour }).then(() => {
          sendResponse({ success: true });
        });
        return true;
      }
    });
  });
  background;
  function initPlugins() {
  }
  var _MatchPattern = class {
    constructor(matchPattern) {
      if (matchPattern === "<all_urls>") {
        this.isAllUrls = true;
        this.protocolMatches = [..._MatchPattern.PROTOCOLS];
        this.hostnameMatch = "*";
        this.pathnameMatch = "*";
      } else {
        const groups = /(.*):\/\/(.*?)(\/.*)/.exec(matchPattern);
        if (groups == null)
          throw new InvalidMatchPattern(matchPattern, "Incorrect format");
        const [_, protocol, hostname, pathname] = groups;
        validateProtocol(matchPattern, protocol);
        validateHostname(matchPattern, hostname);
        this.protocolMatches = protocol === "*" ? ["http", "https"] : [protocol];
        this.hostnameMatch = hostname;
        this.pathnameMatch = pathname;
      }
    }
    includes(url) {
      if (this.isAllUrls)
        return true;
      const u = typeof url === "string" ? new URL(url) : url instanceof Location ? new URL(url.href) : url;
      return !!this.protocolMatches.find((protocol) => {
        if (protocol === "http")
          return this.isHttpMatch(u);
        if (protocol === "https")
          return this.isHttpsMatch(u);
        if (protocol === "file")
          return this.isFileMatch(u);
        if (protocol === "ftp")
          return this.isFtpMatch(u);
        if (protocol === "urn")
          return this.isUrnMatch(u);
      });
    }
    isHttpMatch(url) {
      return url.protocol === "http:" && this.isHostPathMatch(url);
    }
    isHttpsMatch(url) {
      return url.protocol === "https:" && this.isHostPathMatch(url);
    }
    isHostPathMatch(url) {
      if (!this.hostnameMatch || !this.pathnameMatch)
        return false;
      const hostnameMatchRegexs = [
        this.convertPatternToRegex(this.hostnameMatch),
        this.convertPatternToRegex(this.hostnameMatch.replace(/^\*\./, ""))
      ];
      const pathnameMatchRegex = this.convertPatternToRegex(this.pathnameMatch);
      return !!hostnameMatchRegexs.find((regex) => regex.test(url.hostname)) && pathnameMatchRegex.test(url.pathname);
    }
    isFileMatch(url) {
      throw Error("Not implemented: file:// pattern matching. Open a PR to add support");
    }
    isFtpMatch(url) {
      throw Error("Not implemented: ftp:// pattern matching. Open a PR to add support");
    }
    isUrnMatch(url) {
      throw Error("Not implemented: urn:// pattern matching. Open a PR to add support");
    }
    convertPatternToRegex(pattern) {
      const escaped = this.escapeForRegex(pattern);
      const starsReplaced = escaped.replace(/\\\*/g, ".*");
      return RegExp(`^${starsReplaced}$`);
    }
    escapeForRegex(string) {
      return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
  };
  var MatchPattern = _MatchPattern;
  MatchPattern.PROTOCOLS = ["http", "https", "file", "ftp", "urn"];
  var InvalidMatchPattern = class extends Error {
    constructor(matchPattern, reason) {
      super(`Invalid match pattern "${matchPattern}": ${reason}`);
    }
  };
  function validateProtocol(matchPattern, protocol) {
    if (!MatchPattern.PROTOCOLS.includes(protocol) && protocol !== "*")
      throw new InvalidMatchPattern(
        matchPattern,
        `${protocol} not a valid protocol (${MatchPattern.PROTOCOLS.join(", ")})`
      );
  }
  function validateHostname(matchPattern, hostname) {
    if (hostname.includes(":"))
      throw new InvalidMatchPattern(matchPattern, `Hostname cannot include a port`);
    if (hostname.includes("*") && hostname.length > 1 && !hostname.startsWith("*."))
      throw new InvalidMatchPattern(
        matchPattern,
        `If using a wildcard (*), it must go at the start of the hostname`
      );
  }
  function print(method, ...args) {
    if (typeof args[0] === "string") {
      const message = args.shift();
      method(`[wxt] ${message}`, ...args);
    } else {
      method("[wxt]", ...args);
    }
  }
  const logger = {
    debug: (...args) => print(console.debug, ...args),
    log: (...args) => print(console.log, ...args),
    warn: (...args) => print(console.warn, ...args),
    error: (...args) => print(console.error, ...args)
  };
  let ws;
  function getDevServerWebSocket() {
    if (ws == null) {
      const serverUrl = "http://localhost:3000";
      logger.debug("Connecting to dev server @", serverUrl);
      ws = new WebSocket(serverUrl, "vite-hmr");
      ws.addWxtEventListener = ws.addEventListener.bind(ws);
      ws.sendCustom = (event, payload) => ws == null ? void 0 : ws.send(JSON.stringify({ type: "custom", event, payload }));
      ws.addEventListener("open", () => {
        logger.debug("Connected to dev server");
      });
      ws.addEventListener("close", () => {
        logger.debug("Disconnected from dev server");
      });
      ws.addEventListener("error", (event) => {
        logger.error("Failed to connect to dev server", event);
      });
      ws.addEventListener("message", (e) => {
        try {
          const message = JSON.parse(e.data);
          if (message.type === "custom") {
            ws == null ? void 0 : ws.dispatchEvent(
              new CustomEvent(message.event, { detail: message.data })
            );
          }
        } catch (err) {
          logger.error("Failed to handle message", err);
        }
      });
    }
    return ws;
  }
  function keepServiceWorkerAlive() {
    setInterval(async () => {
      await browser.runtime.getPlatformInfo();
    }, 5e3);
  }
  function reloadContentScript(payload) {
    const manifest = browser.runtime.getManifest();
    if (manifest.manifest_version == 2) {
      void reloadContentScriptMv2();
    } else {
      void reloadContentScriptMv3(payload);
    }
  }
  async function reloadContentScriptMv3({
    registration,
    contentScript
  }) {
    if (registration === "runtime") {
      await reloadRuntimeContentScriptMv3(contentScript);
    } else {
      await reloadManifestContentScriptMv3(contentScript);
    }
  }
  async function reloadManifestContentScriptMv3(contentScript) {
    const id = `wxt:${contentScript.js[0]}`;
    logger.log("Reloading content script:", contentScript);
    const registered = await browser.scripting.getRegisteredContentScripts();
    logger.debug("Existing scripts:", registered);
    const existing = registered.find((cs) => cs.id === id);
    if (existing) {
      logger.debug("Updating content script", existing);
      await browser.scripting.updateContentScripts([{ ...contentScript, id }]);
    } else {
      logger.debug("Registering new content script...");
      await browser.scripting.registerContentScripts([{ ...contentScript, id }]);
    }
    await reloadTabsForContentScript(contentScript);
  }
  async function reloadRuntimeContentScriptMv3(contentScript) {
    logger.log("Reloading content script:", contentScript);
    const registered = await browser.scripting.getRegisteredContentScripts();
    logger.debug("Existing scripts:", registered);
    const matches = registered.filter((cs) => {
      var _a2, _b2;
      const hasJs = (_a2 = contentScript.js) == null ? void 0 : _a2.find((js) => {
        var _a3;
        return (_a3 = cs.js) == null ? void 0 : _a3.includes(js);
      });
      const hasCss = (_b2 = contentScript.css) == null ? void 0 : _b2.find((css) => {
        var _a3;
        return (_a3 = cs.css) == null ? void 0 : _a3.includes(css);
      });
      return hasJs || hasCss;
    });
    if (matches.length === 0) {
      logger.log(
        "Content script is not registered yet, nothing to reload",
        contentScript
      );
      return;
    }
    await browser.scripting.updateContentScripts(matches);
    await reloadTabsForContentScript(contentScript);
  }
  async function reloadTabsForContentScript(contentScript) {
    const allTabs = await browser.tabs.query({});
    const matchPatterns = contentScript.matches.map(
      (match) => new MatchPattern(match)
    );
    const matchingTabs = allTabs.filter((tab) => {
      const url = tab.url;
      if (!url) return false;
      return !!matchPatterns.find((pattern) => pattern.includes(url));
    });
    await Promise.all(
      matchingTabs.map(async (tab) => {
        try {
          await browser.tabs.reload(tab.id);
        } catch (err) {
          logger.warn("Failed to reload tab:", err);
        }
      })
    );
  }
  async function reloadContentScriptMv2(_payload) {
    throw Error("TODO: reloadContentScriptMv2");
  }
  {
    try {
      const ws2 = getDevServerWebSocket();
      ws2.addWxtEventListener("wxt:reload-extension", () => {
        browser.runtime.reload();
      });
      ws2.addWxtEventListener("wxt:reload-content-script", (event) => {
        reloadContentScript(event.detail);
      });
      if (true) {
        ws2.addEventListener(
          "open",
          () => ws2.sendCustom("wxt:background-initialized")
        );
        keepServiceWorkerAlive();
      }
    } catch (err) {
      logger.error("Failed to setup web socket connection with dev server", err);
    }
    browser.commands.onCommand.addListener((command) => {
      if (command === "wxt:reload-extension") {
        browser.runtime.reload();
      }
    });
  }
  let result;
  try {
    initPlugins();
    result = definition.main();
    if (result instanceof Promise) {
      console.warn(
        "The background's main() function return a promise, but it must be synchronous"
      );
    }
  } catch (err) {
    logger.error("The background crashed on startup!");
    throw err;
  }
  const result$1 = result;
  return result$1;
}();
background;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFja2dyb3VuZC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vbm9kZV9tb2R1bGVzL3d4dC9kaXN0L3V0aWxzL2RlZmluZS1iYWNrZ3JvdW5kLm1qcyIsIi4uLy4uL25vZGVfbW9kdWxlcy9Ad3h0LWRldi9icm93c2VyL3NyYy9pbmRleC5tanMiLCIuLi8uLi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvYnJvd3Nlci5tanMiLCIuLi8uLi9lbnRyeXBvaW50cy9iYWNrZ3JvdW5kLnRzIiwiLi4vLi4vbm9kZV9tb2R1bGVzL0B3ZWJleHQtY29yZS9tYXRjaC1wYXR0ZXJucy9saWIvaW5kZXguanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGZ1bmN0aW9uIGRlZmluZUJhY2tncm91bmQoYXJnKSB7XG4gIGlmIChhcmcgPT0gbnVsbCB8fCB0eXBlb2YgYXJnID09PSBcImZ1bmN0aW9uXCIpIHJldHVybiB7IG1haW46IGFyZyB9O1xuICByZXR1cm4gYXJnO1xufVxuIiwiLy8gI3JlZ2lvbiBzbmlwcGV0XHJcbmV4cG9ydCBjb25zdCBicm93c2VyID0gZ2xvYmFsVGhpcy5icm93c2VyPy5ydW50aW1lPy5pZFxyXG4gID8gZ2xvYmFsVGhpcy5icm93c2VyXHJcbiAgOiBnbG9iYWxUaGlzLmNocm9tZTtcclxuLy8gI2VuZHJlZ2lvbiBzbmlwcGV0XHJcbiIsImltcG9ydCB7IGJyb3dzZXIgYXMgX2Jyb3dzZXIgfSBmcm9tIFwiQHd4dC1kZXYvYnJvd3NlclwiO1xuZXhwb3J0IGNvbnN0IGJyb3dzZXIgPSBfYnJvd3NlcjtcbmV4cG9ydCB7fTtcbiIsImV4cG9ydCBkZWZhdWx0IGRlZmluZUJhY2tncm91bmQoKCkgPT4ge1xyXG4gIGNvbnNvbGUubG9nKCdTaXBBbG90bCBiYWNrZ3JvdW5kIHNlcnZpY2UgbG9hZGVkIScsIHsgaWQ6IGJyb3dzZXIucnVudGltZS5pZCB9KTtcclxuXHJcbiAgLy8gRW5oYW5jZWQgZGF5IHRyYWNraW5nIGNvbmZpZ3VyYXRpb25cclxuICBjb25zdCBEQVlfVFJBQ0tJTkdfQ09ORklHID0ge1xyXG4gICAgLy8gV2hlbiB0aGUgXCJkYXlcIiBzdGFydHMgZm9yIHdhdGVyIHRyYWNraW5nICgyNC1ob3VyIGZvcm1hdClcclxuICAgIGRheVN0YXJ0SG91cjogNiwgLy8gNiBBTSBkZWZhdWx0XHJcbiAgICBkYXlTdGFydE1pbnV0ZTogMCxcclxuICAgIC8vIEhvdyBvZnRlbiB0byBjaGVjayBmb3IgZGF5IHRyYW5zaXRpb25zIChtaW51dGVzKVxyXG4gICAgZGF5Q2hlY2tJbnRlcnZhbDogMzAsXHJcbiAgICAvLyBUaW1lem9uZSBoYW5kbGluZ1xyXG4gICAgdXNlTG9jYWxUaW1lOiB0cnVlXHJcbiAgfTtcclxuXHJcbiAgLy8gU2V0IHVwIHBlcmlvZGljIHdhdGVyIHJlbWluZGVyIGFsYXJtXHJcbiAgY2hyb21lLnJ1bnRpbWUub25JbnN0YWxsZWQuYWRkTGlzdGVuZXIoKCkgPT4ge1xyXG4gICAgLy8gQ3JlYXRlIGFsYXJtIGZvciB3YXRlciByZW1pbmRlcnMgZXZlcnkgMTAgbWludXRlc1xyXG4gICAgY2hyb21lLmFsYXJtcy5jcmVhdGUoJ3dhdGVyUmVtaW5kZXInLCB7XHJcbiAgICAgIGRlbGF5SW5NaW51dGVzOiAxMCxcclxuICAgICAgcGVyaW9kSW5NaW51dGVzOiAxMFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gQ3JlYXRlIGFsYXJtIGZvciBkYXkgdHJhbnNpdGlvbiBjaGVja3NcclxuICAgIGNocm9tZS5hbGFybXMuY3JlYXRlKCdkYXlUcmFuc2l0aW9uQ2hlY2snLCB7XHJcbiAgICAgIGRlbGF5SW5NaW51dGVzOiBEQVlfVFJBQ0tJTkdfQ09ORklHLmRheUNoZWNrSW50ZXJ2YWwsXHJcbiAgICAgIHBlcmlvZEluTWludXRlczogREFZX1RSQUNLSU5HX0NPTkZJRy5kYXlDaGVja0ludGVydmFsXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBJbml0aWFsaXplIGRheSB0cmFja2luZyBvbiBmaXJzdCBpbnN0YWxsXHJcbiAgICBpbml0aWFsaXplRGF5VHJhY2tpbmcoKTtcclxuICB9KTtcclxuXHJcbiAgLy8gSGFuZGxlIGFsYXJtIGV2ZW50c1xyXG4gIGNocm9tZS5hbGFybXMub25BbGFybS5hZGRMaXN0ZW5lcihhc3luYyAoYWxhcm0pID0+IHtcclxuICAgIGlmIChhbGFybS5uYW1lID09PSAnd2F0ZXJSZW1pbmRlcicpIHtcclxuICAgICAgYXdhaXQgaGFuZGxlV2F0ZXJSZW1pbmRlcigpO1xyXG4gICAgfSBlbHNlIGlmIChhbGFybS5uYW1lID09PSAnZGF5VHJhbnNpdGlvbkNoZWNrJykge1xyXG4gICAgICBhd2FpdCBoYW5kbGVEYXlUcmFuc2l0aW9uKCk7XHJcbiAgICB9XHJcbiAgfSk7XHJcblxyXG4gIGFzeW5jIGZ1bmN0aW9uIGluaXRpYWxpemVEYXlUcmFja2luZygpIHtcclxuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGNocm9tZS5zdG9yYWdlLmxvY2FsLmdldChbJ2RheVRyYWNraW5nQ29uZmlnJywgJ2N1cnJlbnREYXlJZCcsICdkYXlTdGFydFRpbWUnLCAnZGF5U3RhcnRIb3VyJ10pO1xyXG4gICAgXHJcbiAgICAvLyBTZXQgZGVmYXVsdCBjb25maWd1cmF0aW9uIGlmIG5vdCBleGlzdHNcclxuICAgIGlmICghcmVzdWx0LmRheVRyYWNraW5nQ29uZmlnKSB7XHJcbiAgICAgIGF3YWl0IGNocm9tZS5zdG9yYWdlLmxvY2FsLnNldCh7XHJcbiAgICAgICAgZGF5VHJhY2tpbmdDb25maWc6IERBWV9UUkFDS0lOR19DT05GSUcsXHJcbiAgICAgICAgZGF5U3RhcnRIb3VyOiBEQVlfVFJBQ0tJTkdfQ09ORklHLmRheVN0YXJ0SG91clxyXG4gICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICAvLyBJbml0aWFsaXplIGN1cnJlbnQgZGF5IGlmIG5vdCBzZXRcclxuICAgIGlmICghcmVzdWx0LmN1cnJlbnREYXlJZCkge1xyXG4gICAgICBjb25zdCBjdXJyZW50RGF5SWQgPSBnZXRDdXJyZW50RGF5SWQocmVzdWx0LmRheVN0YXJ0SG91ciB8fCBEQVlfVFJBQ0tJTkdfQ09ORklHLmRheVN0YXJ0SG91cik7XHJcbiAgICAgIGF3YWl0IGNocm9tZS5zdG9yYWdlLmxvY2FsLnNldCh7XHJcbiAgICAgICAgY3VycmVudERheUlkOiBjdXJyZW50RGF5SWQsXHJcbiAgICAgICAgZGF5U3RhcnRUaW1lOiBnZXREYXlTdGFydFRpbWUocmVzdWx0LmRheVN0YXJ0SG91ciB8fCBEQVlfVFJBQ0tJTkdfQ09ORklHLmRheVN0YXJ0SG91cilcclxuICAgICAgfSk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBmdW5jdGlvbiBnZXRDdXJyZW50RGF5SWQoZGF5U3RhcnRIb3VyOiBudW1iZXIgPSBEQVlfVFJBQ0tJTkdfQ09ORklHLmRheVN0YXJ0SG91cik6IHN0cmluZyB7XHJcbiAgICBjb25zdCBub3cgPSBuZXcgRGF0ZSgpO1xyXG4gICAgXHJcbiAgICAvLyBDYWxjdWxhdGUgdGhlIGFjdHVhbCBcImRheSBzdGFydFwiIHRpbWVcclxuICAgIGNvbnN0IGRheVN0YXJ0ID0gbmV3IERhdGUobm93KTtcclxuICAgIGRheVN0YXJ0LnNldEhvdXJzKGRheVN0YXJ0SG91ciwgMCwgMCwgMCk7XHJcbiAgICBcclxuICAgIC8vIElmIGN1cnJlbnQgdGltZSBpcyBiZWZvcmUgZGF5IHN0YXJ0LCBjb25zaWRlciBpdCB0aGUgcHJldmlvdXMgZGF5XHJcbiAgICBjb25zdCBlZmZlY3RpdmVEYXRlID0gbm93IDwgZGF5U3RhcnQgXHJcbiAgICAgID8gbmV3IERhdGUobm93LmdldFRpbWUoKSAtIDI0ICogNjAgKiA2MCAqIDEwMDApXHJcbiAgICAgIDogbm93O1xyXG4gICAgXHJcbiAgICAvLyBSZXR1cm4gWVlZWS1NTS1ERCBmb3JtYXQgZm9yIHRoZSBlZmZlY3RpdmUgZGF5XHJcbiAgICByZXR1cm4gZWZmZWN0aXZlRGF0ZS50b0lTT1N0cmluZygpLnNwbGl0KCdUJylbMF07XHJcbiAgfVxyXG5cclxuICBmdW5jdGlvbiBnZXREYXlTdGFydFRpbWUoZGF5U3RhcnRIb3VyOiBudW1iZXIgPSBEQVlfVFJBQ0tJTkdfQ09ORklHLmRheVN0YXJ0SG91cik6IG51bWJlciB7XHJcbiAgICBjb25zdCBub3cgPSBuZXcgRGF0ZSgpO1xyXG4gICAgXHJcbiAgICBjb25zdCBkYXlTdGFydCA9IG5ldyBEYXRlKG5vdyk7XHJcbiAgICBkYXlTdGFydC5zZXRIb3VycyhkYXlTdGFydEhvdXIsIDAsIDAsIDApO1xyXG4gICAgXHJcbiAgICAvLyBJZiB3ZSd2ZSBwYXNzZWQgdG9kYXkncyBzdGFydCB0aW1lLCBuZXh0IHN0YXJ0IGlzIHRvbW9ycm93XHJcbiAgICBpZiAobm93ID49IGRheVN0YXJ0KSB7XHJcbiAgICAgIGRheVN0YXJ0LnNldERhdGUoZGF5U3RhcnQuZ2V0RGF0ZSgpICsgMSk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIHJldHVybiBkYXlTdGFydC5nZXRUaW1lKCk7XHJcbiAgfVxyXG5cclxuICBhc3luYyBmdW5jdGlvbiBoYW5kbGVEYXlUcmFuc2l0aW9uKCkge1xyXG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgY2hyb21lLnN0b3JhZ2UubG9jYWwuZ2V0KFtcclxuICAgICAgJ2N1cnJlbnREYXlJZCcsIFxyXG4gICAgICAnZGF5U3RhcnRUaW1lJyxcclxuICAgICAgJ3dhdGVySW50YWtlQ3VycmVudCcsXHJcbiAgICAgICd3YXRlckludGFrZVRhcmdldCcsXHJcbiAgICAgICdkYWlseUhpc3RvcnknLFxyXG4gICAgICAnZGF5U3RhcnRIb3VyJ1xyXG4gICAgXSk7XHJcblxyXG4gICAgY29uc3QgZGF5U3RhcnRIb3VyID0gcmVzdWx0LmRheVN0YXJ0SG91ciB8fCBEQVlfVFJBQ0tJTkdfQ09ORklHLmRheVN0YXJ0SG91cjtcclxuICAgIGNvbnN0IGN1cnJlbnREYXlJZCA9IGdldEN1cnJlbnREYXlJZChkYXlTdGFydEhvdXIpO1xyXG4gICAgY29uc3Qgc3RvcmVkRGF5SWQgPSByZXN1bHQuY3VycmVudERheUlkO1xyXG5cclxuICAgIC8vIENoZWNrIGlmIHdlJ3ZlIHRyYW5zaXRpb25lZCB0byBhIG5ldyBkYXlcclxuICAgIGlmIChjdXJyZW50RGF5SWQgIT09IHN0b3JlZERheUlkKSB7XHJcbiAgICAgIGNvbnNvbGUubG9nKGBEYXkgdHJhbnNpdGlvbiBkZXRlY3RlZDogJHtzdG9yZWREYXlJZH0g4oaSICR7Y3VycmVudERheUlkfWApO1xyXG4gICAgICBcclxuICAgICAgLy8gQXJjaGl2ZSBwcmV2aW91cyBkYXkncyBkYXRhXHJcbiAgICAgIGF3YWl0IGFyY2hpdmVQcmV2aW91c0RheShyZXN1bHQpO1xyXG4gICAgICBcclxuICAgICAgLy8gUmVzZXQgY3VycmVudCBkYXkgZGF0YVxyXG4gICAgICBhd2FpdCByZXNldEN1cnJlbnREYXkoY3VycmVudERheUlkLCBkYXlTdGFydEhvdXIpO1xyXG4gICAgICBcclxuICAgICAgLy8gU2VuZCBub3RpZmljYXRpb24gYWJvdXQgZGF5IHRyYW5zaXRpb24gKG9wdGlvbmFsKVxyXG4gICAgICBhd2FpdCBub3RpZnlEYXlUcmFuc2l0aW9uKCk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBhc3luYyBmdW5jdGlvbiBhcmNoaXZlUHJldmlvdXNEYXkocHJldmlvdXNEYXRhOiBhbnkpIHtcclxuICAgIGNvbnN0IHsgY3VycmVudERheUlkLCB3YXRlckludGFrZUN1cnJlbnQsIHdhdGVySW50YWtlVGFyZ2V0IH0gPSBwcmV2aW91c0RhdGE7XHJcbiAgICBcclxuICAgIGlmICghY3VycmVudERheUlkIHx8IHdhdGVySW50YWtlQ3VycmVudCA9PT0gdW5kZWZpbmVkKSByZXR1cm47XHJcblxyXG4gICAgLy8gR2V0IGV4aXN0aW5nIGRhaWx5IGhpc3RvcnlcclxuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGNocm9tZS5zdG9yYWdlLmxvY2FsLmdldChbJ2RhaWx5SGlzdG9yeSddKTtcclxuICAgIGNvbnN0IGRhaWx5SGlzdG9yeSA9IHJlc3VsdC5kYWlseUhpc3RvcnkgfHwge307XHJcblxyXG4gICAgLy8gQXJjaGl2ZSB0aGUgY29tcGxldGVkIGRheVxyXG4gICAgZGFpbHlIaXN0b3J5W2N1cnJlbnREYXlJZF0gPSB7XHJcbiAgICAgIGRhdGU6IGN1cnJlbnREYXlJZCxcclxuICAgICAgdG90YWxJbnRha2U6IHdhdGVySW50YWtlQ3VycmVudCB8fCAwLFxyXG4gICAgICB0YXJnZXQ6IHdhdGVySW50YWtlVGFyZ2V0IHx8IDAsXHJcbiAgICAgIGNvbXBsZXRlZEF0OiBEYXRlLm5vdygpLFxyXG4gICAgICBnb2FsUmVhY2hlZDogKHdhdGVySW50YWtlQ3VycmVudCB8fCAwKSA+PSAod2F0ZXJJbnRha2VUYXJnZXQgfHwgMClcclxuICAgIH07XHJcblxyXG4gICAgLy8gS2VlcCBvbmx5IGxhc3QgMzAgZGF5cyBvZiBoaXN0b3J5IHRvIG1hbmFnZSBzdG9yYWdlXHJcbiAgICBjb25zdCBzb3J0ZWREYXRlcyA9IE9iamVjdC5rZXlzKGRhaWx5SGlzdG9yeSkuc29ydCgpO1xyXG4gICAgaWYgKHNvcnRlZERhdGVzLmxlbmd0aCA+IDMwKSB7XHJcbiAgICAgIGNvbnN0IHRvRGVsZXRlID0gc29ydGVkRGF0ZXMuc2xpY2UoMCwgc29ydGVkRGF0ZXMubGVuZ3RoIC0gMzApO1xyXG4gICAgICB0b0RlbGV0ZS5mb3JFYWNoKGRhdGUgPT4gZGVsZXRlIGRhaWx5SGlzdG9yeVtkYXRlXSk7XHJcbiAgICB9XHJcblxyXG4gICAgYXdhaXQgY2hyb21lLnN0b3JhZ2UubG9jYWwuc2V0KHsgZGFpbHlIaXN0b3J5IH0pO1xyXG4gIH1cclxuXHJcbiAgYXN5bmMgZnVuY3Rpb24gcmVzZXRDdXJyZW50RGF5KG5ld0RheUlkOiBzdHJpbmcsIGRheVN0YXJ0SG91cjogbnVtYmVyKSB7XHJcbiAgICBhd2FpdCBjaHJvbWUuc3RvcmFnZS5sb2NhbC5zZXQoe1xyXG4gICAgICBjdXJyZW50RGF5SWQ6IG5ld0RheUlkLFxyXG4gICAgICB3YXRlckludGFrZUN1cnJlbnQ6IDAsXHJcbiAgICAgIGRheVN0YXJ0VGltZTogZ2V0RGF5U3RhcnRUaW1lKGRheVN0YXJ0SG91ciksXHJcbiAgICAgIGxhc3RSZXNldERhdGU6IG5ldyBEYXRlKCkudG9EYXRlU3RyaW5nKCkgLy8gS2VlcCBmb3IgYmFja3dhcmRzIGNvbXBhdGliaWxpdHlcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgYXN5bmMgZnVuY3Rpb24gbm90aWZ5RGF5VHJhbnNpdGlvbigpIHtcclxuICAgIC8vIE9wdGlvbmFsOiBOb3RpZnkgdXNlciBhYm91dCBuZXcgZGF5IHN0YXJ0aW5nXHJcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBjaHJvbWUuc3RvcmFnZS5sb2NhbC5nZXQoWydub3RpZmljYXRpb25zRW5hYmxlZCcsICd3YXRlckludGFrZVRhcmdldCddKTtcclxuICAgIFxyXG4gICAgaWYgKHJlc3VsdC5ub3RpZmljYXRpb25zRW5hYmxlZCAmJiByZXN1bHQud2F0ZXJJbnRha2VUYXJnZXQpIHtcclxuICAgICAgY29uc3QgdGFyZ2V0TCA9IChyZXN1bHQud2F0ZXJJbnRha2VUYXJnZXQgLyAxMDAwKS50b0ZpeGVkKDEpO1xyXG4gICAgICBcclxuICAgICAgY2hyb21lLm5vdGlmaWNhdGlvbnMuY3JlYXRlKHtcclxuICAgICAgICB0eXBlOiAnYmFzaWMnLFxyXG4gICAgICAgIGljb25Vcmw6ICdpY29uL21hc2NvdC5wbmcnLFxyXG4gICAgICAgIHRpdGxlOiAn8J+MhSBOZXcgRGF5IFN0YXJ0ZWQhJyxcclxuICAgICAgICBtZXNzYWdlOiBgUmVhZHkgZm9yIGEgZnJlc2ggc3RhcnQ/IFlvdXIgZ29hbCB0b2RheSBpcyAke3RhcmdldEx9TCFgXHJcbiAgICAgIH0pO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgYXN5bmMgZnVuY3Rpb24gaGFuZGxlV2F0ZXJSZW1pbmRlcigpIHtcclxuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGNocm9tZS5zdG9yYWdlLmxvY2FsLmdldChbXHJcbiAgICAgICdub3RpZmljYXRpb25zRW5hYmxlZCcsIFxyXG4gICAgICAnd2F0ZXJJbnRha2VUYXJnZXQnLCBcclxuICAgICAgJ3dhdGVySW50YWtlQ3VycmVudCcsXHJcbiAgICAgICdsYXN0UmVtaW5kZXJUaW1lJyxcclxuICAgICAgJ2N1cnJlbnREYXlJZCcsXHJcbiAgICAgICdkYXlTdGFydEhvdXInXHJcbiAgICBdKTtcclxuXHJcbiAgICAvLyBDaGVjayBpZiBub3RpZmljYXRpb25zIGFyZSBlbmFibGVkXHJcbiAgICBpZiAoIXJlc3VsdC5ub3RpZmljYXRpb25zRW5hYmxlZCkgcmV0dXJuO1xyXG5cclxuICAgIC8vIENoZWNrIGlmIHVzZXIgaGFzIHNldCB1cCB0aGVpciBnb2FsXHJcbiAgICBpZiAoIXJlc3VsdC53YXRlckludGFrZVRhcmdldCkgcmV0dXJuO1xyXG5cclxuICAgIC8vIEVuc3VyZSB3ZSdyZSB0cmFja2luZyB0aGUgY3VycmVudCBkYXkgcHJvcGVybHlcclxuICAgIGNvbnN0IGRheVN0YXJ0SG91ciA9IHJlc3VsdC5kYXlTdGFydEhvdXIgfHwgREFZX1RSQUNLSU5HX0NPTkZJRy5kYXlTdGFydEhvdXI7XHJcbiAgICBjb25zdCBjdXJyZW50RGF5SWQgPSBnZXRDdXJyZW50RGF5SWQoZGF5U3RhcnRIb3VyKTtcclxuICAgIGxldCBjdXJyZW50SW50YWtlID0gcmVzdWx0LndhdGVySW50YWtlQ3VycmVudCB8fCAwO1xyXG4gICAgXHJcbiAgICBpZiAocmVzdWx0LmN1cnJlbnREYXlJZCAhPT0gY3VycmVudERheUlkKSB7XHJcbiAgICAgIC8vIERheSB0cmFuc2l0aW9uIGRldGVjdGVkIGR1cmluZyByZW1pbmRlciBjaGVja1xyXG4gICAgICBhd2FpdCBoYW5kbGVEYXlUcmFuc2l0aW9uKCk7XHJcbiAgICAgIGN1cnJlbnRJbnRha2UgPSAwOyAvLyBSZXNldCBmb3IgbmV3IGRheVxyXG4gICAgfVxyXG5cclxuICAgIC8vIERvbid0IHNwYW0gaWYgcmVjZW50bHkgcmVtaW5kZWQgKHdpdGhpbiA4IG1pbnV0ZXMpXHJcbiAgICBjb25zdCBub3cgPSBEYXRlLm5vdygpO1xyXG4gICAgY29uc3QgbGFzdFJlbWluZGVyID0gcmVzdWx0Lmxhc3RSZW1pbmRlclRpbWUgfHwgMDtcclxuICAgIGlmIChub3cgLSBsYXN0UmVtaW5kZXIgPCA4ICogNjAgKiAxMDAwKSByZXR1cm47XHJcblxyXG4gICAgLy8gQ2FsY3VsYXRlIHByb2dyZXNzXHJcbiAgICBjb25zdCBwcm9ncmVzcyA9IChjdXJyZW50SW50YWtlIC8gcmVzdWx0LndhdGVySW50YWtlVGFyZ2V0KSAqIDEwMDtcclxuICAgIGNvbnN0IHJlbWFpbmluZ0wgPSAoKHJlc3VsdC53YXRlckludGFrZVRhcmdldCAtIGN1cnJlbnRJbnRha2UpIC8gMTAwMCkudG9GaXhlZCgxKTtcclxuXHJcbiAgICAvLyBDcmVhdGUgY29udGV4dHVhbCBub3RpZmljYXRpb24gYmFzZWQgb24gcHJvZ3Jlc3NcclxuICAgIGxldCB0aXRsZSwgbWVzc2FnZTtcclxuICAgIFxyXG4gICAgaWYgKHByb2dyZXNzID49IDEwMCkge1xyXG4gICAgICB0aXRsZSA9IFwi8J+OiSBHb2FsIENvbXBsZXRlIVwiO1xyXG4gICAgICBtZXNzYWdlID0gXCJBbWF6aW5nIHdvcmshIFlvdSd2ZSByZWFjaGVkIHlvdXIgZGFpbHkgaHlkcmF0aW9uIGdvYWwhXCI7XHJcbiAgICB9IGVsc2UgaWYgKHByb2dyZXNzID49IDc1KSB7XHJcbiAgICAgIHRpdGxlID0gXCLwn5KnIEFsbW9zdCBUaGVyZSFcIjtcclxuICAgICAgbWVzc2FnZSA9IGBZb3UncmUgJHtwcm9ncmVzcy50b0ZpeGVkKDApfSUgdGhlcmUhIEp1c3QgJHtyZW1haW5pbmdMfUwgdG8gZ28hYDtcclxuICAgIH0gZWxzZSBpZiAocHJvZ3Jlc3MgPj0gNTApIHtcclxuICAgICAgdGl0bGUgPSBcIvCfkLggSGFsZndheSBNYXJrIVwiO1xyXG4gICAgICBtZXNzYWdlID0gYEdyZWF0IHByb2dyZXNzISBLZWVwIGl0IHVwIC0gJHtyZW1haW5pbmdMfUwgcmVtYWluaW5nLmA7XHJcbiAgICB9IGVsc2UgaWYgKHByb2dyZXNzID49IDI1KSB7XHJcbiAgICAgIHRpdGxlID0gXCLwn5KmIEdldHRpbmcgU3RhcnRlZCFcIjtcclxuICAgICAgbWVzc2FnZSA9IGBEb24ndCBmb3JnZXQgdG8gaHlkcmF0ZSEgJHtyZW1haW5pbmdMfUwgbGVmdCBmb3IgdG9kYXkuYDtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHRpdGxlID0gXCLwn5qwIEh5ZHJhdGlvbiBSZW1pbmRlclwiO1xyXG4gICAgICBtZXNzYWdlID0gYFlvdXIgYXhvbG90bCBpcyB0aGlyc3R5ISAke3JlbWFpbmluZ0x9TCBuZWVkZWQgdG9kYXkuYDtcclxuICAgIH1cclxuXHJcbiAgICAvLyBTaG93IG5vdGlmaWNhdGlvblxyXG4gICAgY2hyb21lLm5vdGlmaWNhdGlvbnMuY3JlYXRlKHtcclxuICAgICAgdHlwZTogJ2Jhc2ljJyxcclxuICAgICAgaWNvblVybDogJ2ljb24vbWFzY290LnBuZycsXHJcbiAgICAgIHRpdGxlOiB0aXRsZSxcclxuICAgICAgbWVzc2FnZTogbWVzc2FnZVxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gVXBkYXRlIGxhc3QgcmVtaW5kZXIgdGltZVxyXG4gICAgYXdhaXQgY2hyb21lLnN0b3JhZ2UubG9jYWwuc2V0KHtcclxuICAgICAgbGFzdFJlbWluZGVyVGltZTogbm93XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8vIEhhbmRsZSBub3RpZmljYXRpb24gY2xpY2tzIC0gb3BlbiBwb3B1cFxyXG4gIGNocm9tZS5ub3RpZmljYXRpb25zLm9uQ2xpY2tlZC5hZGRMaXN0ZW5lcigoKSA9PiB7XHJcbiAgICBjaHJvbWUuYWN0aW9uLm9wZW5Qb3B1cCgpO1xyXG4gIH0pO1xyXG5cclxuICAvLyBBUEkgZm9yIG90aGVyIHBhcnRzIG9mIGV4dGVuc2lvbiB0byBnZXQgZGF5IHRyYWNraW5nIGluZm9cclxuICBjaHJvbWUucnVudGltZS5vbk1lc3NhZ2UuYWRkTGlzdGVuZXIoKHJlcXVlc3QsIHNlbmRlciwgc2VuZFJlc3BvbnNlKSA9PiB7XHJcbiAgICBpZiAocmVxdWVzdC5hY3Rpb24gPT09ICdnZXREYXlJbmZvJykge1xyXG4gICAgICBjaHJvbWUuc3RvcmFnZS5sb2NhbC5nZXQoWydkYXlTdGFydEhvdXInXSkudGhlbihyZXN1bHQgPT4ge1xyXG4gICAgICAgIGNvbnN0IGRheVN0YXJ0SG91ciA9IHJlc3VsdC5kYXlTdGFydEhvdXIgfHwgREFZX1RSQUNLSU5HX0NPTkZJRy5kYXlTdGFydEhvdXI7XHJcbiAgICAgICAgY29uc3QgZGF5SW5mbyA9IHtcclxuICAgICAgICAgIGN1cnJlbnREYXlJZDogZ2V0Q3VycmVudERheUlkKGRheVN0YXJ0SG91ciksXHJcbiAgICAgICAgICBkYXlTdGFydFRpbWU6IGdldERheVN0YXJ0VGltZShkYXlTdGFydEhvdXIpLFxyXG4gICAgICAgICAgZGF5U3RhcnRIb3VyOiBkYXlTdGFydEhvdXIsXHJcbiAgICAgICAgICBjb25maWc6IERBWV9UUkFDS0lOR19DT05GSUdcclxuICAgICAgICB9O1xyXG4gICAgICAgIHNlbmRSZXNwb25zZShkYXlJbmZvKTtcclxuICAgICAgfSk7XHJcbiAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICBpZiAocmVxdWVzdC5hY3Rpb24gPT09ICd1cGRhdGVEYXlTdGFydEhvdXInKSB7XHJcbiAgICAgIGNocm9tZS5zdG9yYWdlLmxvY2FsLnNldCh7IGRheVN0YXJ0SG91cjogcmVxdWVzdC5ob3VyIH0pLnRoZW4oKCkgPT4ge1xyXG4gICAgICAgIHNlbmRSZXNwb25zZSh7IHN1Y2Nlc3M6IHRydWUgfSk7XHJcbiAgICAgIH0pO1xyXG4gICAgICByZXR1cm4gdHJ1ZTtcclxuICAgIH1cclxuICB9KTtcclxufSk7XHJcbiIsIi8vIHNyYy9pbmRleC50c1xyXG52YXIgX01hdGNoUGF0dGVybiA9IGNsYXNzIHtcclxuICBjb25zdHJ1Y3RvcihtYXRjaFBhdHRlcm4pIHtcclxuICAgIGlmIChtYXRjaFBhdHRlcm4gPT09IFwiPGFsbF91cmxzPlwiKSB7XHJcbiAgICAgIHRoaXMuaXNBbGxVcmxzID0gdHJ1ZTtcclxuICAgICAgdGhpcy5wcm90b2NvbE1hdGNoZXMgPSBbLi4uX01hdGNoUGF0dGVybi5QUk9UT0NPTFNdO1xyXG4gICAgICB0aGlzLmhvc3RuYW1lTWF0Y2ggPSBcIipcIjtcclxuICAgICAgdGhpcy5wYXRobmFtZU1hdGNoID0gXCIqXCI7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICBjb25zdCBncm91cHMgPSAvKC4qKTpcXC9cXC8oLio/KShcXC8uKikvLmV4ZWMobWF0Y2hQYXR0ZXJuKTtcclxuICAgICAgaWYgKGdyb3VwcyA9PSBudWxsKVxyXG4gICAgICAgIHRocm93IG5ldyBJbnZhbGlkTWF0Y2hQYXR0ZXJuKG1hdGNoUGF0dGVybiwgXCJJbmNvcnJlY3QgZm9ybWF0XCIpO1xyXG4gICAgICBjb25zdCBbXywgcHJvdG9jb2wsIGhvc3RuYW1lLCBwYXRobmFtZV0gPSBncm91cHM7XHJcbiAgICAgIHZhbGlkYXRlUHJvdG9jb2wobWF0Y2hQYXR0ZXJuLCBwcm90b2NvbCk7XHJcbiAgICAgIHZhbGlkYXRlSG9zdG5hbWUobWF0Y2hQYXR0ZXJuLCBob3N0bmFtZSk7XHJcbiAgICAgIHZhbGlkYXRlUGF0aG5hbWUobWF0Y2hQYXR0ZXJuLCBwYXRobmFtZSk7XHJcbiAgICAgIHRoaXMucHJvdG9jb2xNYXRjaGVzID0gcHJvdG9jb2wgPT09IFwiKlwiID8gW1wiaHR0cFwiLCBcImh0dHBzXCJdIDogW3Byb3RvY29sXTtcclxuICAgICAgdGhpcy5ob3N0bmFtZU1hdGNoID0gaG9zdG5hbWU7XHJcbiAgICAgIHRoaXMucGF0aG5hbWVNYXRjaCA9IHBhdGhuYW1lO1xyXG4gICAgfVxyXG4gIH1cclxuICBpbmNsdWRlcyh1cmwpIHtcclxuICAgIGlmICh0aGlzLmlzQWxsVXJscylcclxuICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICBjb25zdCB1ID0gdHlwZW9mIHVybCA9PT0gXCJzdHJpbmdcIiA/IG5ldyBVUkwodXJsKSA6IHVybCBpbnN0YW5jZW9mIExvY2F0aW9uID8gbmV3IFVSTCh1cmwuaHJlZikgOiB1cmw7XHJcbiAgICByZXR1cm4gISF0aGlzLnByb3RvY29sTWF0Y2hlcy5maW5kKChwcm90b2NvbCkgPT4ge1xyXG4gICAgICBpZiAocHJvdG9jb2wgPT09IFwiaHR0cFwiKVxyXG4gICAgICAgIHJldHVybiB0aGlzLmlzSHR0cE1hdGNoKHUpO1xyXG4gICAgICBpZiAocHJvdG9jb2wgPT09IFwiaHR0cHNcIilcclxuICAgICAgICByZXR1cm4gdGhpcy5pc0h0dHBzTWF0Y2godSk7XHJcbiAgICAgIGlmIChwcm90b2NvbCA9PT0gXCJmaWxlXCIpXHJcbiAgICAgICAgcmV0dXJuIHRoaXMuaXNGaWxlTWF0Y2godSk7XHJcbiAgICAgIGlmIChwcm90b2NvbCA9PT0gXCJmdHBcIilcclxuICAgICAgICByZXR1cm4gdGhpcy5pc0Z0cE1hdGNoKHUpO1xyXG4gICAgICBpZiAocHJvdG9jb2wgPT09IFwidXJuXCIpXHJcbiAgICAgICAgcmV0dXJuIHRoaXMuaXNVcm5NYXRjaCh1KTtcclxuICAgIH0pO1xyXG4gIH1cclxuICBpc0h0dHBNYXRjaCh1cmwpIHtcclxuICAgIHJldHVybiB1cmwucHJvdG9jb2wgPT09IFwiaHR0cDpcIiAmJiB0aGlzLmlzSG9zdFBhdGhNYXRjaCh1cmwpO1xyXG4gIH1cclxuICBpc0h0dHBzTWF0Y2godXJsKSB7XHJcbiAgICByZXR1cm4gdXJsLnByb3RvY29sID09PSBcImh0dHBzOlwiICYmIHRoaXMuaXNIb3N0UGF0aE1hdGNoKHVybCk7XHJcbiAgfVxyXG4gIGlzSG9zdFBhdGhNYXRjaCh1cmwpIHtcclxuICAgIGlmICghdGhpcy5ob3N0bmFtZU1hdGNoIHx8ICF0aGlzLnBhdGhuYW1lTWF0Y2gpXHJcbiAgICAgIHJldHVybiBmYWxzZTtcclxuICAgIGNvbnN0IGhvc3RuYW1lTWF0Y2hSZWdleHMgPSBbXHJcbiAgICAgIHRoaXMuY29udmVydFBhdHRlcm5Ub1JlZ2V4KHRoaXMuaG9zdG5hbWVNYXRjaCksXHJcbiAgICAgIHRoaXMuY29udmVydFBhdHRlcm5Ub1JlZ2V4KHRoaXMuaG9zdG5hbWVNYXRjaC5yZXBsYWNlKC9eXFwqXFwuLywgXCJcIikpXHJcbiAgICBdO1xyXG4gICAgY29uc3QgcGF0aG5hbWVNYXRjaFJlZ2V4ID0gdGhpcy5jb252ZXJ0UGF0dGVyblRvUmVnZXgodGhpcy5wYXRobmFtZU1hdGNoKTtcclxuICAgIHJldHVybiAhIWhvc3RuYW1lTWF0Y2hSZWdleHMuZmluZCgocmVnZXgpID0+IHJlZ2V4LnRlc3QodXJsLmhvc3RuYW1lKSkgJiYgcGF0aG5hbWVNYXRjaFJlZ2V4LnRlc3QodXJsLnBhdGhuYW1lKTtcclxuICB9XHJcbiAgaXNGaWxlTWF0Y2godXJsKSB7XHJcbiAgICB0aHJvdyBFcnJvcihcIk5vdCBpbXBsZW1lbnRlZDogZmlsZTovLyBwYXR0ZXJuIG1hdGNoaW5nLiBPcGVuIGEgUFIgdG8gYWRkIHN1cHBvcnRcIik7XHJcbiAgfVxyXG4gIGlzRnRwTWF0Y2godXJsKSB7XHJcbiAgICB0aHJvdyBFcnJvcihcIk5vdCBpbXBsZW1lbnRlZDogZnRwOi8vIHBhdHRlcm4gbWF0Y2hpbmcuIE9wZW4gYSBQUiB0byBhZGQgc3VwcG9ydFwiKTtcclxuICB9XHJcbiAgaXNVcm5NYXRjaCh1cmwpIHtcclxuICAgIHRocm93IEVycm9yKFwiTm90IGltcGxlbWVudGVkOiB1cm46Ly8gcGF0dGVybiBtYXRjaGluZy4gT3BlbiBhIFBSIHRvIGFkZCBzdXBwb3J0XCIpO1xyXG4gIH1cclxuICBjb252ZXJ0UGF0dGVyblRvUmVnZXgocGF0dGVybikge1xyXG4gICAgY29uc3QgZXNjYXBlZCA9IHRoaXMuZXNjYXBlRm9yUmVnZXgocGF0dGVybik7XHJcbiAgICBjb25zdCBzdGFyc1JlcGxhY2VkID0gZXNjYXBlZC5yZXBsYWNlKC9cXFxcXFwqL2csIFwiLipcIik7XHJcbiAgICByZXR1cm4gUmVnRXhwKGBeJHtzdGFyc1JlcGxhY2VkfSRgKTtcclxuICB9XHJcbiAgZXNjYXBlRm9yUmVnZXgoc3RyaW5nKSB7XHJcbiAgICByZXR1cm4gc3RyaW5nLnJlcGxhY2UoL1suKis/XiR7fSgpfFtcXF1cXFxcXS9nLCBcIlxcXFwkJlwiKTtcclxuICB9XHJcbn07XHJcbnZhciBNYXRjaFBhdHRlcm4gPSBfTWF0Y2hQYXR0ZXJuO1xyXG5NYXRjaFBhdHRlcm4uUFJPVE9DT0xTID0gW1wiaHR0cFwiLCBcImh0dHBzXCIsIFwiZmlsZVwiLCBcImZ0cFwiLCBcInVyblwiXTtcclxudmFyIEludmFsaWRNYXRjaFBhdHRlcm4gPSBjbGFzcyBleHRlbmRzIEVycm9yIHtcclxuICBjb25zdHJ1Y3RvcihtYXRjaFBhdHRlcm4sIHJlYXNvbikge1xyXG4gICAgc3VwZXIoYEludmFsaWQgbWF0Y2ggcGF0dGVybiBcIiR7bWF0Y2hQYXR0ZXJufVwiOiAke3JlYXNvbn1gKTtcclxuICB9XHJcbn07XHJcbmZ1bmN0aW9uIHZhbGlkYXRlUHJvdG9jb2wobWF0Y2hQYXR0ZXJuLCBwcm90b2NvbCkge1xyXG4gIGlmICghTWF0Y2hQYXR0ZXJuLlBST1RPQ09MUy5pbmNsdWRlcyhwcm90b2NvbCkgJiYgcHJvdG9jb2wgIT09IFwiKlwiKVxyXG4gICAgdGhyb3cgbmV3IEludmFsaWRNYXRjaFBhdHRlcm4oXHJcbiAgICAgIG1hdGNoUGF0dGVybixcclxuICAgICAgYCR7cHJvdG9jb2x9IG5vdCBhIHZhbGlkIHByb3RvY29sICgke01hdGNoUGF0dGVybi5QUk9UT0NPTFMuam9pbihcIiwgXCIpfSlgXHJcbiAgICApO1xyXG59XHJcbmZ1bmN0aW9uIHZhbGlkYXRlSG9zdG5hbWUobWF0Y2hQYXR0ZXJuLCBob3N0bmFtZSkge1xyXG4gIGlmIChob3N0bmFtZS5pbmNsdWRlcyhcIjpcIikpXHJcbiAgICB0aHJvdyBuZXcgSW52YWxpZE1hdGNoUGF0dGVybihtYXRjaFBhdHRlcm4sIGBIb3N0bmFtZSBjYW5ub3QgaW5jbHVkZSBhIHBvcnRgKTtcclxuICBpZiAoaG9zdG5hbWUuaW5jbHVkZXMoXCIqXCIpICYmIGhvc3RuYW1lLmxlbmd0aCA+IDEgJiYgIWhvc3RuYW1lLnN0YXJ0c1dpdGgoXCIqLlwiKSlcclxuICAgIHRocm93IG5ldyBJbnZhbGlkTWF0Y2hQYXR0ZXJuKFxyXG4gICAgICBtYXRjaFBhdHRlcm4sXHJcbiAgICAgIGBJZiB1c2luZyBhIHdpbGRjYXJkICgqKSwgaXQgbXVzdCBnbyBhdCB0aGUgc3RhcnQgb2YgdGhlIGhvc3RuYW1lYFxyXG4gICAgKTtcclxufVxyXG5mdW5jdGlvbiB2YWxpZGF0ZVBhdGhuYW1lKG1hdGNoUGF0dGVybiwgcGF0aG5hbWUpIHtcclxuICByZXR1cm47XHJcbn1cclxuZXhwb3J0IHtcclxuICBJbnZhbGlkTWF0Y2hQYXR0ZXJuLFxyXG4gIE1hdGNoUGF0dGVyblxyXG59O1xyXG4iXSwibmFtZXMiOlsiYnJvd3NlciIsIl9icm93c2VyIiwicmVzdWx0Il0sIm1hcHBpbmdzIjoiOzs7QUFBTyxXQUFTLGlCQUFpQixLQUFLO0FBQ3BDLFFBQUksT0FBTyxRQUFRLE9BQU8sUUFBUSxXQUFZLFFBQU8sRUFBRSxNQUFNLElBQUc7QUFDaEUsV0FBTztBQUFBLEVBQ1Q7QUNGTyxRQUFNQSxjQUFVLHNCQUFXLFlBQVgsbUJBQW9CLFlBQXBCLG1CQUE2QixNQUNoRCxXQUFXLFVBQ1gsV0FBVztBQ0ZSLFFBQU0sVUFBVUM7QUNEdkIsUUFBQSxhQUFBLGlCQUFBLE1BQUE7QUFDRSxZQUFBLElBQUEsdUNBQUEsRUFBQSxJQUFBLFFBQUEsUUFBQSxJQUFBO0FBR0EsVUFBQSxzQkFBQTtBQUFBO0FBQUEsTUFBNEIsY0FBQTtBQUFBO0FBQUEsTUFFWixnQkFBQTtBQUFBO0FBQUEsTUFDRSxrQkFBQTtBQUFBO0FBQUEsTUFFRSxjQUFBO0FBQUEsSUFFSjtBQUloQixXQUFBLFFBQUEsWUFBQSxZQUFBLE1BQUE7QUFFRSxhQUFBLE9BQUEsT0FBQSxpQkFBQTtBQUFBLFFBQXNDLGdCQUFBO0FBQUEsUUFDcEIsaUJBQUE7QUFBQSxNQUNDLENBQUE7QUFJbkIsYUFBQSxPQUFBLE9BQUEsc0JBQUE7QUFBQSxRQUEyQyxnQkFBQSxvQkFBQTtBQUFBLFFBQ0ws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O0FBQUEsSUFDRSxZQUFZLEtBQUs7QUFDZixZQUFNLE1BQU0scUVBQXFFO0FBQUEsSUFDckY7QUFBQSxJQUNFLFdBQVcsS0FBSztBQUNkLFlBQU0sTUFBTSxvRUFBb0U7QUFBQSxJQUNwRjtBQUFBLElBQ0UsV0FBVyxLQUFLO0FBQ2QsWUFBTSxNQUFNLG9FQUFvRTtBQUFBLElBQ3BGO0FBQUEsSUFDRSxzQkFBc0IsU0FBUztBQUM3QixZQUFNLFVBQVUsS0FBSyxlQUFlLE9BQU87QUFDM0MsWUFBTSxnQkFBZ0IsUUFBUSxRQUFRLFNBQVMsSUFBSTtBQUNuRCxhQUFPLE9BQU8sSUFBSSxhQUFhLEdBQUc7QUFBQSxJQUN0QztBQUFBLElBQ0UsZUFBZSxRQUFRO0FBQ3JCLGFBQU8sT0FBTyxRQUFRLHVCQUF1QixNQUFNO0FBQUEsSUFDdkQ7QUFBQSxFQUNBO0FBQ0EsTUFBSSxlQUFlO0FBQ25CLGVBQWEsWUFBWSxDQUFDLFFBQVEsU0FBUyxRQUFRLE9BQU8sS0FBSztBQUMvRCxNQUFJLHNCQUFzQixjQUFjLE1BQU07QUFBQSxJQUM1QyxZQUFZLGNBQWMsUUFBUTtBQUNoQyxZQUFNLDBCQUEwQixZQUFZLE1BQU0sTUFBTSxFQUFFO0FBQUEsSUFDOUQ7QUFBQSxFQUNBO0FBQ0EsV0FBUyxpQkFBaUIsY0FBYyxVQUFVO0FBQ2hELFFBQUksQ0FBQyxhQUFhLFVBQVUsU0FBUyxRQUFRLEtBQUssYUFBYTtBQUM3RCxZQUFNLElBQUk7QUFBQSxRQUNSO0FBQUEsUUFDQSxHQUFHLFFBQVEsMEJBQTBCLGFBQWEsVUFBVSxLQUFLLElBQUksQ0FBQztBQUFBLE1BQzVFO0FBQUEsRUFDQTtBQUNBLFdBQVMsaUJBQWlCLGNBQWMsVUFBVTtBQUNoRCxRQUFJLFNBQVMsU0FBUyxHQUFHO0FBQ3ZCLFlBQU0sSUFBSSxvQkFBb0IsY0FBYyxnQ0FBZ0M7QUFDOUUsUUFBSSxTQUFTLFNBQVMsR0FBRyxLQUFLLFNBQVMsU0FBUyxLQUFLLENBQUMsU0FBUyxXQUFXLElBQUk7QUFDNUUsWUFBTSxJQUFJO0FBQUEsUUFDUjtBQUFBLFFBQ0E7QUFBQSxNQUNOO0FBQUEsRUFDQTs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OzsiLCJ4X2dvb2dsZV9pZ25vcmVMaXN0IjpbMCwxLDIsNF19
