import '/styles/base.css';
import '/styles/components/buttons.css';
import '/styles/components/decorations.css';
import '/styles/components/forms.css';
import '/styles/components/modal.css';
import '/styles/components/pages.css';
import '/styles/components/progress.css';


// Slider functionality
function updateSlider() {
    const slider = document.getElementById("ageSlider") as HTMLInputElement;
    const sliderValue = document.getElementById("sliderValue") as HTMLElement;
    
    if (!slider || !sliderValue) return;
    
    const value = slider.value;
    const min = slider.min;
    const max = slider.max;
    
    // Update the displayed value with "years" text
    sliderValue.textContent = value + ' years';
    
    // Calculate the position percentage
    const percentage = ((parseInt(value) - parseInt(min)) / (parseInt(max) - parseInt(min))) * 100;
    
    // Position the year value below the thumb
    const thumbOffset = (percentage / 100) * (slider.offsetWidth - 24);
    sliderValue.style.left = `${thumbOffset + 12 - (sliderValue.offsetWidth / 2)}px`;
    
    // Position the axolotl image behind the thumb using CSS custom property
    slider.parentElement!.style.setProperty('--thumb-position', `${thumbOffset}px`);
}

// Initialize slider when DOM is loaded
function initializeSlider() {
    const slider = document.getElementById("ageSlider") as HTMLInputElement;
    const sliderValue = document.getElementById("sliderValue") as HTMLElement;
    
    if (slider && sliderValue) {
        updateSlider();
        
        // Update on input (while dragging)
        slider.addEventListener('input', updateSlider);
        
        // Update on change (when released)
        slider.addEventListener('change', updateSlider);
        
        // Update position on window resize
        window.addEventListener('resize', updateSlider);
    }
}

function showMainPage() {
    document.getElementById('welcomePage')!.classList.add('hidden');
    document.getElementById('mainPage')!.classList.add('active');
    document.getElementById('calculator')!.classList.remove('show');
    
    // Update progress bar when showing main page
    setTimeout(updateProgressBar, 100);
}

function showWelcomePage() {
    document.getElementById('welcomePage')!.classList.remove('hidden');
    document.getElementById('mainPage')!.classList.remove('active');
    document.getElementById('calculator')!.classList.remove('show');
}

function showCalculator() {
    document.getElementById('welcomePage')!.classList.add('hidden');
    document.getElementById('mainPage')!.classList.remove('active');
    document.getElementById('calculator')!.classList.add('show');
    
    // Initialize slider when calculator is shown
    setTimeout(initializeSlider, 100); // Small delay to ensure DOM is ready
}

async function submitCalculator() {
    const ageSlider = document.getElementById('ageSlider') as HTMLInputElement;
    const weightInput = document.getElementById('weight') as HTMLInputElement;
    const activityInput = document.querySelector('input[name="activity"]:checked') as HTMLInputElement;
    const genderInput = document.querySelector('input[name="gender"]:checked') as HTMLInputElement;

    const age = ageSlider?.value;
    const weight = weightInput?.value;
    const activity = activityInput?.value;
    const gender = genderInput?.value;

    if (!age || !weight || !activity || !gender) {
        alert('Please fill in all fields');
        return;
    }
    
    console.log(weight);
    let baseWater = parseFloat(weight) * 0.03 * 1000;
    let activityBonus = 0;
    
    if (activity === 'sedentary') {
        activityBonus = 150;
    } else if (activity === 'light') {
        activityBonus = 300;
    } else if (activity === 'moderate') {
        activityBonus = 500;
    } else if (activity === 'active') {
        activityBonus = 900;
    }
    
    baseWater = baseWater + activityBonus;
    await chrome.storage.local.set({
        waterIntakeTarget: baseWater,
        waterIntakeCurrent: 0,
        lastResetDate: new Date().toDateString()
    });
    const result = await chrome.storage.local.get(['waterIntakeTarget', 'waterIntakeCurrent']);
    console.log(result);
    
    // Show main page and update progress
    showMainPage();
    updateProgressBar();
}

async function updateProgressBar() {
    const result = await chrome.storage.local.get(['waterIntakeTarget', 'waterIntakeCurrent', 'lastResetDate']);
    const target = result.waterIntakeTarget || 0;
    let current = result.waterIntakeCurrent || 0;
    
    // Check if we need to reset for a new day
    const today = new Date().toDateString();
    if (result.lastResetDate !== today) {
        await chrome.storage.local.set({
            waterIntakeCurrent: 0,
            lastResetDate: today
        });
        current = 0;
    }
    
    const progressText = document.getElementById('progressText');
    const progressFill = document.getElementById('progressFill');
    
    if (progressText && progressFill) {
        // Convert to liters and format nicely
        const targetL = (target / 1000).toFixed(1);
        const currentL = (current / 1000).toFixed(1);
        
        progressText.textContent = `${currentL}/${targetL}L`;
        
        // Calculate percentage and update progress bar
        const percentage = Math.min((current / target) * 100, 100);
        progressFill.style.width = `${percentage}%`;
    }
}

async function addWater() {
    const result = await chrome.storage.local.get(['waterIntakeTarget', 'waterIntakeCurrent', 'waterIncrement']);
    const current = result.waterIntakeCurrent || 0;
    const target = result.waterIntakeTarget || 0;
    const increment = result.waterIncrement || 250; // Default to 250ml
    
    // Add the custom water increment
    const newCurrent = current + increment;
    
    await chrome.storage.local.set({
        waterIntakeCurrent: Math.min(newCurrent, target * 1.5) // Cap at 150% of target
    });
    
    updateProgressBar();
    
    // Show celebration if goal reached
    if (newCurrent >= target && current < target) {
        showCelebration();
    }
}

function showCelebration() {
    // Simple celebration - could be enhanced with animations
    const progressText = document.getElementById('progressText');
    if (progressText) {
        progressText.style.animation = 'bounce 0.6s ease-in-out';
        setTimeout(() => {
            if (progressText) progressText.style.animation = '';
        }, 600);
    }
}

// Settings modal functions
function showSettings() {
    const modal = document.getElementById('settingsModal');
    const container = document.querySelector('.container');
    
    if (modal && container) {
        modal.classList.add('active');
        container.classList.add('modal-blur');
        loadSettings();
    }
}

function hideSettings() {
    const modal = document.getElementById('settingsModal');
    const container = document.querySelector('.container');
    
    if (modal && container) {
        modal.classList.remove('active');
        container.classList.remove('modal-blur');
    }
}

async function loadSettings() {
    const result = await chrome.storage.local.get(['waterIncrement', 'notificationsEnabled', 'petEnabled']);
    
    const waterAmountSelect = document.getElementById('waterAmount') as HTMLSelectElement;
    const notificationsCheckbox = document.getElementById('notifications') as HTMLInputElement;
    const petCheckbox = document.getElementById('pet') as HTMLInputElement;
    
    if (waterAmountSelect) {
        waterAmountSelect.value = (result.waterIncrement || 250).toString();
    }
    
    if (notificationsCheckbox) {
        notificationsCheckbox.checked = result.notificationsEnabled !== false; // Default to true
    }
    
    if (petCheckbox) {
        petCheckbox.checked = result.petEnabled || false; // Default to false
    }
}

async function saveSettings() {
    const waterAmountSelect = document.getElementById('waterAmount') as HTMLSelectElement;
    const notificationsCheckbox = document.getElementById('notifications') as HTMLInputElement;
    const petCheckbox = document.getElementById('pet') as HTMLInputElement;
    
    const settings = {
        waterIncrement: parseInt(waterAmountSelect?.value || '250'),
        notificationsEnabled: notificationsCheckbox?.checked || false,
        petEnabled: petCheckbox?.checked || false
    };
    
    await chrome.storage.local.set(settings);
    
    // Show save confirmation
    const saveBtn = document.getElementById('saveSettings');
    if (saveBtn) {
        const originalText = saveBtn.textContent;
        saveBtn.textContent = 'Saved! ✓';
        saveBtn.style.background = 'linear-gradient(135deg, #4caf50 0%, #45a049 100%)';
        
        setTimeout(() => {
            if (saveBtn) {
                saveBtn.textContent = originalText;
                saveBtn.style.background = '';
            }
        }, 2000);
    }
    
    // Apply pet toggle to current tab if needed
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab.id) {
            await chrome.tabs.sendMessage(tab.id, {
                action: 'togglePet',
                show: settings.petEnabled
            });
        }
    } catch (error) {
        console.error('Error applying pet settings:', error);
    }
    
    // Close modal after short delay
    setTimeout(hideSettings, 1500);
}

async function resetAllData() {
    const confirmReset = confirm('Are you sure you want to reset all data? This will clear your water intake history and settings.');
    
    if (confirmReset) {
        await chrome.storage.local.clear();
        
        // Remove pet from current tab if visible
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab.id) {
                await chrome.tabs.sendMessage(tab.id, {
                    action: 'togglePet',
                    show: false
                });
            }
        } catch (error) {
            console.error('Error removing pet during reset:', error);
        }
        
        // Reset UI
        showWelcomePage();
        
        // Show confirmation
        alert('All data has been reset. Please set up your water intake goal again.');
    }
}

async function handlePetToggle() {
    const pet = document.getElementById('pet') as HTMLInputElement;
    if (pet) {
        pet.checked = !pet.checked;
        
        // Save the pet state to storage
        await chrome.storage.local.set({ petEnabled: pet.checked });
        
        // Get the active tab and send message to content script
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab.id) {
                await chrome.tabs.sendMessage(tab.id, {
                    action: 'togglePet',
                    show: pet.checked
                });
            }
        } catch (error) {
            console.error('Error communicating with content script:', error);
            // If there's an error (like no permission), revert the checkbox and storage
            pet.checked = !pet.checked;
            await chrome.storage.local.set({ petEnabled: pet.checked });
        }
    }
}

function handleNotificationsToggle() {
    const notificationsCheckbox = document.getElementById('notifications') as HTMLInputElement;
    if (notificationsCheckbox) {
        notificationsCheckbox.checked = !notificationsCheckbox.checked;
    }
}

// Initialize the popup
document.addEventListener('DOMContentLoaded', async function() {
    console.log('Sipalotl popup loaded!');
    const result = await chrome.storage.local.get(['waterIntakeTarget', 'petEnabled']);
    console.log(result);
    
    if (result.waterIntakeTarget) {
        showMainPage();
        updateProgressBar();
    } else {
        showWelcomePage();
    }

    // Load settings including pet state
    await loadSettings();
    
    // If pet was enabled, show it on the current tab
    if (result.petEnabled) {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab.id) {
                await chrome.tabs.sendMessage(tab.id, {
                    action: 'togglePet',
                    show: true
                });
            }
        } catch (error) {
            console.error('Error showing pet on initialization:', error);
        }
    }

    // Add event listeners
    const getStartedBtn = document.getElementById('getStartedBtn');
    const backBtn = document.getElementById('backBtn');
    const calculatorBtn = document.getElementById('calculatorBtn');
    const calcBackBtn = document.getElementById('calcBackBtn');
    const submitCalcBtn = document.getElementById('submitCalc');
    const addWaterBtn = document.getElementById('addWaterBtn');
    const settingsBtn = document.getElementById('settingsBtn');
    const closeSettingsBtn = document.getElementById('closeSettings');
    const saveSettingsBtn = document.getElementById('saveSettings');
    const resetDataBtn = document.getElementById('resetData');
    const settingsModal = document.getElementById('settingsModal');
    const togglePetBox = document.getElementById('pet') as HTMLInputElement;
    const toggleNotificationsBox = document.getElementById('notifications') as HTMLInputElement;



    if (getStartedBtn) getStartedBtn.addEventListener('click', showMainPage);
    if (backBtn) backBtn.addEventListener('click', showWelcomePage);
    if (calculatorBtn) calculatorBtn.addEventListener('click', showCalculator);
    if (calcBackBtn) calcBackBtn.addEventListener('click', showMainPage);
    if (submitCalcBtn) submitCalcBtn.addEventListener('click', submitCalculator);
    if (addWaterBtn) addWaterBtn.addEventListener('click', addWater);
    if (settingsBtn) settingsBtn.addEventListener('click', showSettings);
    if (closeSettingsBtn) closeSettingsBtn.addEventListener('click', hideSettings);
    if (saveSettingsBtn) saveSettingsBtn.addEventListener('click', saveSettings);
    if (resetDataBtn) resetDataBtn.addEventListener('click', resetAllData);
    if (toggleNotificationsBox) {
        const notificationsSpan = toggleNotificationsBox.nextElementSibling as HTMLElement;
        notificationsSpan.addEventListener('click', handleNotificationsToggle);
    }
    if (togglePetBox) {
        const petSpan = togglePetBox.nextElementSibling as HTMLElement;
        petSpan.addEventListener('click', handlePetToggle);
    } 
    // Close modal when clicking outside
    if (settingsModal) {
        settingsModal.addEventListener('click', (e) => {
            if (e.target === settingsModal) {
                hideSettings();
            }
        });
    }
    // Initialize slider if calculator is already visible
    initializeSlider();
});


