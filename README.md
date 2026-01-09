# Salesforce Devops Form Helper

A Chrome extension that streamlines creating standardized Salesforce subject lines. It overlays a helper button next to the `sf_devops__Subject__c` field on Salesforce Lightning pages, opens a guided modal, optionally fetches Jira tickets, and formats the subject as `KEY Summary - MM/DD/YYYY - Your Name`.

## Features
- Helper button appears beside the Salesforce subject field
- Guided modal collects Project, Date, and Your Name
- Jira integration via background service worker (avoids CORS)
- Fallback project and team member lists when Jira isn't configured
- Accessibility (focus trap, ESC to close) and smart positioning
- Works on dynamic pages (MutationObserver re-initializes when DOM changes)

## Files
- `manifest.json`: Chrome extension manifest (MV3), declares permissions, background, options page, and content script
- `background.js`: Handles Jira API calls securely via `chrome.runtime.sendMessage`
- `content.js`: Injects the helper button and modal; fills the Salesforce subject field
- `settings.html`: Extension options page UI
- `settings.js`: Saves settings to `chrome.storage.sync`; tests Jira connection and JQL via background
- `styles.css`: Minimal styles for the injected button and modal

## Installation
1. Build not required — this is a plain MV3 extension.
2. In Chrome, open `chrome://extensions`.
3. Enable "Developer mode" (top right).
4. Click "Load unpacked" and select this folder.

## Usage
1. Navigate to a Salesforce Lightning page containing the subject field `sf_devops__Subject__c`.
2. Click the pencil helper button that appears to the right of the field.
3. In the modal, choose a project, date, and your name.
4. Click Save — the field is filled and change events are dispatched.

## Jira Integration
- Configure Jira in the extension’s Options page (`settings.html`):
  - Jira URL: `https://yourcompany.atlassian.net`
  - Email: your Jira account email
  - API Token: create at https://id.atlassian.com/manage-profile/security/api-tokens
  - JQL (optional): defaults to `assignee = currentUser() ORDER BY updated DESC`
- The background script tries multiple request shapes and fallbacks (POST primary/fallback endpoints, then legacy GET) to maximize compatibility.
- If Jira isn’t configured or fails, default project options are used.

## Permissions
- `activeTab`, `storage`: for reading page state and saving settings
- Host permissions: `https://*.atlassian.net/*` for Jira API access via background

## Development Notes
- Content script targets `https://*.lightning.force.com/*` pages and injects `styles.css`.
- Modal includes accessibility features: `role="dialog"`, `aria-modal`, `aria-labelledby`, and keyboard handling.
- Positioning is maintained on scroll/resize and periodically to adapt to dynamic layouts.

## Troubleshooting
- Helper button doesn’t appear:
  - Ensure the page includes an input named `sf_devops__Subject__c`.
  - Wait up to a few seconds; the script retries and also listens for DOM changes.
- Jira tickets don’t load:
  - Verify Jira URL, email, and API token in Options.
  - Use the Options page’s "Test Connection" and "Test JQL Query (raw)" buttons.
  - Check Chrome DevTools console logs for background/content script messages.

## License
No explicit license specified. Consult repository owner for usage terms.
