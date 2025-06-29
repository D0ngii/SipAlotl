# SipAlotl

# NOTE FOR ME: need to think of a way to keep track of pacing. --- allow for users to prelog any water theyve had before logging on.  --- store details in local storage, try fetch, if nothing redirect to calculator. 

Recommended Implementation
Initial Setup: When a user first sets up the app, ask them for their hydration goal. On the same screen, include two time pickers:

"What time do you usually wake up?" (Default: 7:00 AM)

"What time do you usually go to bed?" (Default: 11:00 PM)

Explain Why: Briefly explain why you need this info: "This helps us schedule your reminders so they're helpful and never bother you while you're sleeping."

Calculate in the Backend: Your app's logic should then be:

totalWakingHours = bedTime - wakeUpTime

hourlyPace = dailyGoal / totalWakingHours

Conclusion: Don't make a fixed assumption of 10 or 12 hours.