export default defineBackground(() => {
  console.log('SipAlotl background service loaded!', { id: browser.runtime.id });

  // Set up periodic water reminder alarm
  chrome.runtime.onInstalled.addListener(() => {
    // Create alarm for water reminders every 10 minutes
    chrome.alarms.create('waterReminder', {
      delayInMinutes: 10,
      periodInMinutes: 10
    });
  });

  // Handle alarm events
  chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === 'waterReminder') {
      await handleWaterReminder();
    }
  });

  async function handleWaterReminder() {
    const result = await chrome.storage.local.get([
      'notificationsEnabled', 
      'waterIntakeTarget', 
      'waterIntakeCurrent',
      'lastReminderTime',
      'lastResetDate'
    ]);

    // Check if notifications are enabled
    if (!result.notificationsEnabled) return;

    // Check if user has set up their goal
    if (!result.waterIntakeTarget) return;

    // Check daily reset
    const today = new Date().toDateString();
    let currentIntake = result.waterIntakeCurrent || 0;
    
    if (result.lastResetDate !== today) {
      currentIntake = 0;
      await chrome.storage.local.set({
        waterIntakeCurrent: 0,
        lastResetDate: today
      });
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
});
