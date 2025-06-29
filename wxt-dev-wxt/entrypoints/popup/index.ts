import './style.css';

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

function submitCalculator() {
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
    console.log(baseWater);
}

// Initialize the popup
document.addEventListener('DOMContentLoaded', function() {
    console.log('Sipalotl popup loaded!');
    
    // Add event listeners
    const getStartedBtn = document.getElementById('getStartedBtn');
    const backBtn = document.getElementById('backBtn');
    const calculatorBtn = document.getElementById('calculatorBtn');
    const calcBackBtn = document.getElementById('calcBackBtn');
    const submitCalcBtn = document.getElementById('submitCalc');
    
    if (getStartedBtn) getStartedBtn.addEventListener('click', showMainPage);
    if (backBtn) backBtn.addEventListener('click', showWelcomePage);
    if (calculatorBtn) calculatorBtn.addEventListener('click', showCalculator);
    if (calcBackBtn) calcBackBtn.addEventListener('click', showMainPage);
    if (submitCalcBtn) submitCalcBtn.addEventListener('click', submitCalculator);
    
    // Initialize slider if calculator is already visible
    initializeSlider();
});
