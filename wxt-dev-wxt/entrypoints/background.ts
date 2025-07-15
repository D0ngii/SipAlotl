export default defineBackground(() => {
  console.log('SipAlotl background service loaded!', { id: browser.runtime.id });

  // Enhanced day tracking configuration
  const DAY_TRACKING_CONFIG = {
    // When the "day" starts for water tracking (24-hour format)
    dayStartHour: 6, // 6 AM default
    dayStartMinute: 0,
    // How often to check for day transitions (minutes)
    dayCheckInterval: 30,
    // Timezone handling
    useLocalTime: true
  };

  // Set up periodic water reminder alarm
  chrome.runtime.onInstalled.addListener(() => {
    // Create alarm for water reminders every 10 minutes
    chrome.alarms.create('waterReminder', {
      delayInMinutes: 10,
      periodInMinutes: 10
    });

    // Create alarm for day transition checks
    chrome.alarms.create('dayTransitionCheck', {
      delayInMinutes: DAY_TRACKING_CONFIG.dayCheckInterval,
      periodInMinutes: DAY_TRACKING_CONFIG.dayCheckInterval
    });

    // Initialize day tracking on first install
    initializeDayTracking();
  });

  // Handle alarm events
  chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === 'waterReminder') {
      await handleWaterReminder();
    } else if (alarm.name === 'dayTransitionCheck') {
      await handleDayTransition();
    }
  });

  async function initializeDayTracking() {
    const result = await chrome.storage.local.get(['dayTrackingConfig', 'currentDayId', 'dayStartTime', 'dayStartHour']);
    
    // Set default configuration if not exists
    if (!result.dayTrackingConfig) {
      await chrome.storage.local.set({
        dayTrackingConfig: DAY_TRACKING_CONFIG,
        dayStartHour: DAY_TRACKING_CONFIG.dayStartHour
      });
    }

    // Initialize current day if not set
    if (!result.currentDayId) {
      const currentDayId = getCurrentDayId(result.dayStartHour || DAY_TRACKING_CONFIG.dayStartHour);
      await chrome.storage.local.set({
        currentDayId: currentDayId,
        dayStartTime: getDayStartTime(result.dayStartHour || DAY_TRACKING_CONFIG.dayStartHour)
      });
    }
  }

  function getCurrentDayId(dayStartHour: number = DAY_TRACKING_CONFIG.dayStartHour): string {
    const now = new Date();
    
    // Calculate the actual "day start" time
    const dayStart = new Date(now);
    dayStart.setHours(dayStartHour, 0, 0, 0);
    
    // If current time is before day start, consider it the previous day
    const effectiveDate = now < dayStart 
      ? new Date(now.getTime() - 24 * 60 * 60 * 1000)
      : now;
    
    // Return YYYY-MM-DD format for the effective day
    return effectiveDate.toISOString().split('T')[0];
  }

  function getDayStartTime(dayStartHour: number = DAY_TRACKING_CONFIG.dayStartHour): number {
    const now = new Date();
    
    const dayStart = new Date(now);
    dayStart.setHours(dayStartHour, 0, 0, 0);
    
    // If we've passed today's start time, next start is tomorrow
    if (now >= dayStart) {
      dayStart.setDate(dayStart.getDate() + 1);
    }
    
    return dayStart.getTime();
  }

  async function handleDayTransition() {
    const result = await chrome.storage.local.get([
      'currentDayId', 
      'dayStartTime',
      'waterIntakeCurrent',
      'waterIntakeTarget',
      'dailyHistory',
      'dayStartHour'
    ]);

    const dayStartHour = result.dayStartHour || DAY_TRACKING_CONFIG.dayStartHour;
    const currentDayId = getCurrentDayId(dayStartHour);
    const storedDayId = result.currentDayId;

    // Check if we've transitioned to a new day
    if (currentDayId !== storedDayId) {
      console.log(`Day transition detected: ${storedDayId} → ${currentDayId}`);
      
      // Archive previous day's data
      await archivePreviousDay(result);
      
      // Reset current day data
      await resetCurrentDay(currentDayId, dayStartHour);
      
      // Send notification about day transition (optional)
      await notifyDayTransition();
    }
  }

  async function archivePreviousDay(previousData: any) {
    const { currentDayId, waterIntakeCurrent, waterIntakeTarget } = previousData;
    
    if (!currentDayId || waterIntakeCurrent === undefined) return;

    // Get existing daily history
    const result = await chrome.storage.local.get(['dailyHistory']);
    const dailyHistory = result.dailyHistory || {};

    // Archive the completed day
    dailyHistory[currentDayId] = {
      date: currentDayId,
      totalIntake: waterIntakeCurrent || 0,
      target: waterIntakeTarget || 0,
      completedAt: Date.now(),
      goalReached: (waterIntakeCurrent || 0) >= (waterIntakeTarget || 0)
    };

    // Keep only last 30 days of history to manage storage
    const sortedDates = Object.keys(dailyHistory).sort();
    if (sortedDates.length > 30) {
      const toDelete = sortedDates.slice(0, sortedDates.length - 30);
      toDelete.forEach(date => delete dailyHistory[date]);
    }

    await chrome.storage.local.set({ dailyHistory });
  }

  async function resetCurrentDay(newDayId: string, dayStartHour: number) {
    await chrome.storage.local.set({
      currentDayId: newDayId,
      waterIntakeCurrent: 0,
      dayStartTime: getDayStartTime(dayStartHour),
      lastResetDate: new Date().toDateString() // Keep for backwards compatibility
    });
  }

  async function notifyDayTransition() {
    // Optional: Notify user about new day starting
    const result = await chrome.storage.local.get(['notificationsEnabled', 'waterIntakeTarget']);
    
    if (result.notificationsEnabled && result.waterIntakeTarget) {
      const targetL = (result.waterIntakeTarget / 1000).toFixed(1);
      
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon/mascot.png',
        title: '🌅 New Day Started!',
        message: `Ready for a fresh start? Your goal today is ${targetL}L!`
      });
    }
  }

  async function handleWaterReminder() {
    const result = await chrome.storage.local.get([
      'notificationsEnabled', 
      'waterIntakeTarget', 
      'waterIntakeCurrent',
      'lastReminderTime',
      'currentDayId',
      'dayStartHour'
    ]);

    // Check if notifications are enabled
    if (!result.notificationsEnabled) return;

    // Check if user has set up their goal
    if (!result.waterIntakeTarget) return;

    // Ensure we're tracking the current day properly
    const dayStartHour = result.dayStartHour || DAY_TRACKING_CONFIG.dayStartHour;
    const currentDayId = getCurrentDayId(dayStartHour);
    let currentIntake = result.waterIntakeCurrent || 0;
    
    if (result.currentDayId !== currentDayId) {
      // Day transition detected during reminder check
      await handleDayTransition();
      currentIntake = 0; // Reset for new day
    }

    // Don't spam if recently reminded (within 8 minutes)
    const now = Date.now();
    const lastReminder = result.lastReminderTime || 0;
    if (now - lastReminder < 8 * 60 * 1000) return;

    // Calculate progress
    const progress = (currentIntake / result.waterIntakeTarget) * 100;
    const remainingL = ((result.waterIntakeTarget - currentIntake) / 1000).toFixed(1);

    // Create contextual notification based on progress
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

    // Show notification
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icon/mascot.png',
      title: title,
      message: message
    });

    // Update last reminder time
    await chrome.storage.local.set({
      lastReminderTime: now
    });
  }

  // Handle notification clicks - open popup
  chrome.notifications.onClicked.addListener(() => {
    chrome.action.openPopup();
  });

  // API for other parts of extension to get day tracking info
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getDayInfo') {
      chrome.storage.local.get(['dayStartHour']).then(result => {
        const dayStartHour = result.dayStartHour || DAY_TRACKING_CONFIG.dayStartHour;
        const dayInfo = {
          currentDayId: getCurrentDayId(dayStartHour),
          dayStartTime: getDayStartTime(dayStartHour),
          dayStartHour: dayStartHour,
          config: DAY_TRACKING_CONFIG
        };
        sendResponse(dayInfo);
      });
      return true;
    }
    
    if (request.action === 'updateDayStartHour') {
      chrome.storage.local.set({ dayStartHour: request.hour }).then(() => {
        sendResponse({ success: true });
      });
      return true;
    }
  });
});
