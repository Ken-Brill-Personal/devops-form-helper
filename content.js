// Wait for the page to load
function initializeExtension() {
  console.log('Salesforce Devops Form Helper: Initializing...');
  
  // Find the subject input field
  const findSubjectInput = () => {
    return document.querySelector('input[name="sf_devops__Subject__c"]');
  };

  // Try to find the input field with retries
  let retries = 0;
  const maxRetries = 200;
  
  const tryInit = setInterval(() => {
    const subjectInput = findSubjectInput();
    
    if (subjectInput) {
      clearInterval(tryInit);
      console.log('Salesforce Devops Form Helper: Found input field');
      addHelperButton(subjectInput);
    } else if (retries++ > maxRetries) {
      clearInterval(tryInit);
      console.log('Salesforce Devops Form Helper: Could not find subject input field after retries');
    }
  }, 1000);
}

// Add a helper button next to the input field
function addHelperButton(inputElement) {
  // Check if button already exists
  if (document.querySelector('.Salesforce Devops-helper-button')) {
    console.log('Salesforce Devops Form Helper: Button already exists');
    return;
  }
  
  console.log('Salesforce Devops Form Helper: Adding button');
  
  // Create a wrapper div for the button
  const buttonWrapper = document.createElement('div');
  buttonWrapper.className = 'Salesforce Devops-helper-button-wrapper';
  
  // Create button
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'Salesforce Devops-helper-button';
  button.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
    </svg>
  `;
  button.title = 'Fill with guided form';

  
  // Add click handler
  button.addEventListener('click', (e) => {
    console.log('Salesforce Devops Form Helper: Button clicked');
    e.preventDefault();
    e.stopPropagation();
    showFormModal(inputElement);
  });
  
  buttonWrapper.appendChild(button);
  document.body.appendChild(buttonWrapper);
  
  // Position the button next to the input
  function positionButton() {
    const rect = inputElement.getBoundingClientRect();
    buttonWrapper.style.top = `${rect.top + (rect.height - 34) / 2}px`;
    buttonWrapper.style.left = `${rect.right - 44}px`;
  }
  
  // Position initially
  positionButton();
  
  // Reposition on scroll and resize
  window.addEventListener('scroll', positionButton, true);
  window.addEventListener('resize', positionButton);
  
  // Reposition periodically (in case of dynamic layout changes)
  setInterval(positionButton, 1500);
  
  console.log('Salesforce Devops Form Helper: Button added successfully');
}

// Create and show the modal form
async function showFormModal(targetInput) {
  console.log('Salesforce Devops Form Helper: Opening modal');
  
  // Don't create multiple modals
  if (document.querySelector('.Salesforce Devops-form-overlay')) {
    console.log('Salesforce Devops Form Helper: Modal already open');
    return;
  }

  // Load settings from storage
  const settings = await chrome.storage.sync.get([
    'jiraUrl',
    'jiraEmail',
    'jiraToken',
    'jiraJql',
    'teamMembers'
  ]);
  
  console.log('Salesforce Devops Form Helper: Settings loaded', {
    hasJiraUrl: !!settings.jiraUrl,
    hasJiraEmail: !!settings.jiraEmail,
    hasJiraToken: !!settings.jiraToken
  });
  
  // Fetch Jira tickets via background script to avoid CORS
  let projectOptions = '';
  if (settings.jiraUrl && settings.jiraEmail && settings.jiraToken) {
    console.log('Salesforce Devops Form Helper: Requesting Jira tickets from background script...');
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'fetchJiraTickets',
        settings: settings
      });
      
      if (response.success && response.tickets && response.tickets.length > 0) {
        console.log('Salesforce Devops Form Helper: Received', response.tickets.length, 'tickets from background');
        projectOptions = response.tickets.map(ticket => 
          `<option value="${ticket.display}">${ticket.display}</option>`
        ).join('');
        console.log('Salesforce Devops Form Helper: Using Jira tickets for dropdown');
      } else if (!response.success) {
        console.error('Salesforce Devops Form Helper: Error from background:', response.error);
        console.log('Salesforce Devops Form Helper: JIRA connection failed, falling back to defaults. Error:', response.error);
      } else {
        console.log('Salesforce Devops Form Helper: No tickets returned from Jira');
      }
    } catch (error) {
      console.error('Salesforce Devops Form Helper: Failed to fetch Jira tickets:', error);
      console.log('Salesforce Devops Form Helper: JIRA fetch failed, using default options. Make sure:', 
        '1. JIRA URL is correct',
        '2. Email and API token are valid',
        '3. Your JIRA user has API access enabled'
      );
    }
  } else {
    console.log('Salesforce Devops Form Helper: Jira not configured, using defaults');
    console.log('Salesforce Devops Form Helper: To enable JIRA integration, configure settings in the extension options');
  }
  
  // Use default projects if Jira fetch failed or not configured
  if (!projectOptions) {
    console.log('Salesforce Devops Form Helper: Using default project options');
    projectOptions = `
      <option value="SF-1234 New fields in Accounts">SF-1234 New fields in Accounts</option>
      <option value="SF-2156 Contact merge functionality">SF-2156 Contact merge functionality</option>
      <option value="SF-3489 Dashboard performance issues">SF-3489 Dashboard performance issues</option>
      <option value="SFSUPPORT-8742 Can't log in">SFSUPPORT-8742 Can't log in</option>
      <option value="SFSUPPORT-9231 Email sync not working">SFSUPPORT-9231 Email sync not working</option>
      <option value="SFSUPPORT-7654 Report access denied">SFSUPPORT-7654 Report access denied</option>
      <option value="DEV-4521 API integration update">DEV-4521 API integration update</option>
      <option value="DEV-5832 Mobile app crash fix">DEV-5832 Mobile app crash fix</option>
    `;
  }
  
  // Get team members
  let nameOptions = '';
  if (settings.teamMembers) {
    const members = settings.teamMembers.split('\n').filter(m => m.trim());
    nameOptions = members.map(name => 
      `<option value="${name.trim()}">${name.trim()}</option>`
    ).join('');
    console.log('Salesforce Devops Form Helper: Using custom team members:', members.length);
  } else {
    console.log('Salesforce Devops Form Helper: Using default team members');
    // Default names
    nameOptions = `
      <option value="Ken Brill">Ken Brill</option>
    `;
  }

  // Create overlay
  const overlay = document.createElement('div');
  overlay.className = 'Salesforce Devops-form-overlay';
  
  // Create modal
  const modal = document.createElement('div');
  modal.className = 'Salesforce Devops-form-modal';
  
  // Create form HTML
  modal.innerHTML = `
    <div class="Salesforce Devops-form-header">
      <h2 id="Salesforce Devops-form-title">Subject Information</h2>
      <div class="Salesforce Devops-form-hint" aria-hidden="true">Press ESC to close</div>
    </div>
    
    <div class="Salesforce Devops-form-group">
      <label for="Salesforce Devops-project">Project *</label>
      <select id="Salesforce Devops-project" required>
        <option value="">Select a project...</option>
        ${projectOptions}
      </select>
    </div>
    
    <div class="Salesforce Devops-form-group">
      <label for="Salesforce Devops-date">Date *</label>
      <input type="date" id="Salesforce Devops-date" required>
    </div>
    
    <div class="Salesforce Devops-form-group">
      <label for="Salesforce Devops-name">Your Name *</label>
      <select id="Salesforce Devops-name" required>
        <option value="">Select your name...</option>
        ${nameOptions}
      </select>
    </div>
    
    <div class="Salesforce Devops-form-buttons">
      <button class="Salesforce Devops-form-button Salesforce Devops-form-button-cancel" type="button">Cancel</button>
      <button class="Salesforce Devops-form-button Salesforce Devops-form-button-save" type="button">Save</button>
    </div>
  `;
  
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  
  // Accessibility: set ARIA attributes for dialog semantics
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'Salesforce Devops-form-title');
  
  // Store element to restore focus to after closing
  const previouslyFocused = document.activeElement;
  
  // Focusable elements within the modal for trapping focus
  const focusableSelectors = [
    'a[href]',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
  ].join(',');
  
  const getFocusable = () => Array.from(modal.querySelectorAll(focusableSelectors));
  
  // Helper to close modal and restore focus
  function closeModal() {
    overlay.remove();
    if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
      previouslyFocused.focus();
    }
    document.removeEventListener('keydown', onKeydown, true);
  }
  
  // Key handling for ESC close and focus trap (Tab)
  function onKeydown(e) {
    if (!document.body.contains(overlay)) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      closeModal();
      return;
    }
    if (e.key === 'Tab') {
      const focusable = getFocusable();
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (e.shiftKey) {
        if (active === first || !modal.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last || !modal.contains(active)) {
          e.preventDefault();
          first.focus();
        }
      }
    }
  }
  
  // Attach keydown at document level so it captures while focus is within modal
  document.addEventListener('keydown', onKeydown, true);
  
  console.log('Salesforce Devops Form Helper: Modal created');
  
  // Get input elements
  const projectInput = modal.querySelector('#Salesforce Devops-project');
  const dateInput = modal.querySelector('#Salesforce Devops-date');
  const nameInput = modal.querySelector('#Salesforce Devops-name');
  
  // Set today's date as default
  const today = new Date().toISOString().split('T')[0];
  dateInput.value = today;
  
  // No need for keyboard handlers with dropdowns!
  
  // Focus on project dropdown
  setTimeout(() => {
    projectInput.focus();
  }, 100);
  
  // Handle cancel button
  const cancelButton = modal.querySelector('.Salesforce Devops-form-button-cancel');
  cancelButton.addEventListener('click', () => {
    console.log('Salesforce Devops Form Helper: Cancel clicked');
    closeModal();
  });
  
  // Handle save button
  const saveButton = modal.querySelector('.Salesforce Devops-form-button-save');
  saveButton.addEventListener('click', () => {
    console.log('Salesforce Devops Form Helper: Save clicked');
    const project = projectInput.value.trim();
    const date = dateInput.value;
    const name = nameInput.value.trim();
    
    // Validate required fields
    if (!project || !date || !name) {
      alert('Please fill in all required fields');
      return;
    }
    
    // Format the date (MM/DD/YYYY)
    const dateObj = new Date(date);
    const formattedDate = `${String(dateObj.getMonth() + 1).padStart(2, '0')}/${String(dateObj.getDate()).padStart(2, '0')}/${dateObj.getFullYear()}`;
    
    // Create the formatted subject line
    const subjectText = `${project} - ${formattedDate} - ${name}`;
    
    console.log('Salesforce Devops Form Helper: Setting value:', subjectText);
    
    // Set the value in the input field
    targetInput.value = subjectText;
    
    // Trigger input and change events to ensure the form recognizes the change
    targetInput.dispatchEvent(new Event('input', { bubbles: true }));
    targetInput.dispatchEvent(new Event('change', { bubbles: true }));
    targetInput.dispatchEvent(new Event('blur', { bubbles: true }));
    
    // Close the modal
    closeModal();
  });
  
  // Handle clicking outside the modal
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      console.log('Salesforce Devops Form Helper: Clicked outside modal');
      closeModal();
    }
  });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeExtension);
} else {
  initializeExtension();
}

// Re-initialize if the page changes (for single-page applications)
const observer = new MutationObserver(() => {
  const subjectInput = document.querySelector('input[name="sf_devops__Subject__c"]');
  if (subjectInput && !document.querySelector('.Salesforce Devops-helper-button')) {
    console.log('Salesforce Devops Form Helper: Re-initializing after DOM change');
    addHelperButton(subjectInput);
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});