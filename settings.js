// Load saved settings when page loads
document.addEventListener('DOMContentLoaded', async () => {
  const settings = await chrome.storage.sync.get([
    'jiraUrl',
    'jiraEmail',
    'jiraToken',
    'jiraJql',
    'teamMembers'
  ]);
  
  if (settings.jiraUrl) document.getElementById('jira-url').value = settings.jiraUrl;
  if (settings.jiraEmail) document.getElementById('jira-email').value = settings.jiraEmail;
  if (settings.jiraToken) document.getElementById('jira-token').value = settings.jiraToken;
  if (settings.jiraJql) document.getElementById('jira-jql').value = settings.jiraJql;
  if (settings.teamMembers) document.getElementById('team-members').value = settings.teamMembers;
});

// Save Jira settings
document.getElementById('save-settings').addEventListener('click', async () => {
  const jiraUrl = document.getElementById('jira-url').value.trim();
  const jiraEmail = document.getElementById('jira-email').value.trim();
  const jiraToken = document.getElementById('jira-token').value.trim();
  const jiraJql = document.getElementById('jira-jql').value.trim();
  
  if (!jiraUrl || !jiraEmail || !jiraToken) {
    showStatus('Please fill in all required fields', 'error');
    return;
  }
  
  // Validate URL
  try {
    new URL(jiraUrl);
  } catch (e) {
    showStatus('Invalid Jira URL format', 'error');
    return;
  }
  
  await chrome.storage.sync.set({
    jiraUrl,
    jiraEmail,
    jiraToken,
    jiraJql
  });
  
  showStatus('Settings saved successfully!', 'success');
});

// Test Jira connection
document.getElementById('test-connection').addEventListener('click', async () => {
  const jiraUrl = document.getElementById('jira-url').value.trim();
  const jiraEmail = document.getElementById('jira-email').value.trim();
  const jiraToken = document.getElementById('jira-token').value.trim();
  
  if (!jiraUrl || !jiraEmail || !jiraToken) {
    showStatus('Please fill in all required fields first', 'error');
    return;
  }
  
  showStatus('Testing connection...', 'info');
  
  try {
    const auth = btoa(`${jiraEmail}:${jiraToken}`);
    const response = await fetch(`${jiraUrl}/rest/api/3/myself`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json'
      }
    });
    
    if (response.ok) {
      const user = await response.json();
      showStatus(`Connection successful! Logged in as: ${user.displayName}`, 'success');
    } else {
      const error = await response.text();
      showStatus(`Connection failed: ${response.status} - ${error}`, 'error');
    }
  } catch (error) {
    showStatus(`Connection error: ${error.message}`, 'error');
  }
});

// Fetch tickets

// Test JQL via background and show raw response
document.getElementById('test-jira-query').addEventListener('click', async () => {
  const settings = await chrome.storage.sync.get([
    'jiraUrl',
    'jiraEmail',
    'jiraToken',
    'jiraJql'
  ]);

  if (!settings.jiraUrl || !settings.jiraEmail || !settings.jiraToken) {
    showStatus('Please save your Jira settings first', 'error');
    return;
  }

  showStatus('Running JQL test via background...', 'info');
  const rawPre = document.getElementById('jira-raw-response');
  rawPre.style.display = 'none';

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'fetchJiraTickets',
      settings: settings
    });

    if (response && response.success) {
      rawPre.textContent = JSON.stringify(response.tickets, null, 2);
      rawPre.style.display = 'block';
      showStatus(`JQL test successful — ${response.tickets.length} tickets returned`, 'success');
    } else {
      const err = response && response.error ? response.error : 'Unknown error';
      rawPre.textContent = `Error: ${err}`;
      rawPre.style.display = 'block';
      showStatus('JQL test failed (see raw response)', 'error');
    }
  } catch (error) {
    rawPre.textContent = `Exception: ${error && error.message ? error.message : error}`;
    rawPre.style.display = 'block';
    showStatus('JQL test error (see raw response)', 'error');
  }
});

// Save team members
document.getElementById('save-members').addEventListener('click', async () => {
  const teamMembers = document.getElementById('team-members').value;
  
  await chrome.storage.sync.set({ teamMembers });
  
  showMembersStatus('Team members saved successfully!', 'success');
});

// Helper function to show status messages
function showStatus(message, type) {
  const statusDiv = document.getElementById('status');
  statusDiv.textContent = message;
  statusDiv.className = `status ${type}`;
  statusDiv.style.display = 'block';
  
  if (type === 'success') {
    setTimeout(() => {
      statusDiv.style.display = 'none';
    }, 3000);
  }
}

// Helper function to show members status
function showMembersStatus(message, type) {
  const statusDiv = document.getElementById('members-status');
  statusDiv.textContent = message;
  statusDiv.className = `status ${type}`;
  statusDiv.style.display = 'block';
  
  setTimeout(() => {
    statusDiv.style.display = 'none';
  }, 3000);
}

// (Removed fetch-tickets UI and displayTickets as they are not present in settings.html)