
import '/styles/content.css';

export default defineContentScript({
  matches: ['<all_urls>'],
  main() {
    console.log('SipAlotl content script loaded');
    
    let draggedElement: HTMLElement | null = null;
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let offsetX = 0;
    let offsetY = 0;

    // Check if pet should be shown on page load
    chrome.storage.local.get(['petEnabled']).then(result => {
      if (result.petEnabled) {
        injectPet();
      }
    });

    // Listen for messages from popup
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'togglePet') {
        if (request.show) {
          injectPet();
        } else {
          removePet();
        }
        sendResponse({ success: true });
        return true;
      }
    });

    function injectPet() {
      // Check if pet already exists
      if (document.getElementById('sipalotl-pet')) {
        return;
      }

      // Create the pet container
      const petContainer = document.createElement('div');
      petContainer.id = 'sipalotl-pet';

      // Create the animated sprite element
      const spriteElement = document.createElement('div');
      spriteElement.className = 'sipalotl-sprite';
      spriteElement.style.backgroundImage = `url('${chrome.runtime.getURL('sprites/happy_idle_sheet.png')}')`;

      // Add error handling for sprite sheet loading
      const testImage = new Image();
      testImage.src = chrome.runtime.getURL('sprites/happy_idle_sheet.png');
      testImage.onerror = () => {
        console.error('Failed to load SipAlotl sprite sheet');
        // Create a fallback animated emoji pet if sprite fails to load
        spriteElement.className = 'sipalotl-fallback';
        spriteElement.style.backgroundImage = 'none';
        spriteElement.textContent = '🐸';
      };

      petContainer.appendChild(spriteElement);

      // Add drag functionality
      petContainer.addEventListener('mousedown', handleMouseDown);
      petContainer.addEventListener('dragstart', (e) => e.preventDefault());

      // Add to page
      document.body.appendChild(petContainer);

      // Add a subtle bounce animation when first appearing
      petContainer.animate([
        { transform: 'scale(0.8) translateY(10px)', opacity: '0' },
        { transform: 'scale(1.1) translateY(-5px)', opacity: '1' },
        { transform: 'scale(1) translateY(0px)', opacity: '1' }
      ], {
        duration: 400,
        easing: 'ease-out'
      });
    }

    function removePet() {
      const pet = document.getElementById('sipalotl-pet');
      if (pet) {
        // Add fade out animation before removing
        pet.animate([
          { transform: 'scale(1)', opacity: '1' },
          { transform: 'scale(0.8)', opacity: '0' }
        ], {
          duration: 200,
          easing: 'ease-in'
        }).onfinish = () => {
          pet.remove();
        };
      }
    }

    function handleMouseDown(e: MouseEvent) {
      if (e.button !== 0) return; // Only left mouse button

      draggedElement = e.currentTarget as HTMLElement;
      isDragging = true;
      
      const rect = draggedElement.getBoundingClientRect();
      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;
      
      startX = e.clientX;
      startY = e.clientY;

      draggedElement.style.cursor = 'grabbing';
      draggedElement.style.transition = 'none';

      // Add global mouse event listeners
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);

      e.preventDefault();
    }

    function handleMouseMove(e: MouseEvent) {
      if (!isDragging || !draggedElement) return;

      const newX = e.clientX - offsetX;
      const newY = e.clientY - offsetY;

      // Keep within viewport bounds
      const maxX = window.innerWidth - draggedElement.offsetWidth;
      const maxY = window.innerHeight - draggedElement.offsetHeight;
      
      const clampedX = Math.max(0, Math.min(newX, maxX));
      const clampedY = Math.max(0, Math.min(newY, maxY));

      draggedElement.style.left = clampedX + 'px';
      draggedElement.style.top = clampedY + 'px';
      draggedElement.style.right = 'auto';
    }

    function handleMouseUp(e: MouseEvent) {
      if (!isDragging || !draggedElement) return;

      isDragging = false;
      draggedElement.style.cursor = 'grab';
      draggedElement.style.transition = 'transform 0.1s ease';

      // Remove global event listeners
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);

      draggedElement = null;
    }
  },
});
