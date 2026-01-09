// Background script for handling JIRA API requests (bypasses CORS restrictions)

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'fetchJiraTickets') {
    fetchJiraTickets(request.settings)
      .then(tickets => {
        sendResponse({ success: true, tickets: tickets });
      })
      .catch(error => {
        console.error('Background script error:', error);
        sendResponse({ success: false, error: error.message });
      });
    
    // Return true to indicate we'll send response asynchronously
    return true;
  }
});

async function fetchJiraTickets(settings) {
  const { jiraUrl, jiraEmail, jiraToken, jiraJql } = settings;
  
  if (!jiraUrl || !jiraEmail || !jiraToken) {
    throw new Error('JIRA settings not configured');
  }
  
  const auth = btoa(`${jiraEmail}:${jiraToken}`);
  const jql = jiraJql || 'assignee = currentUser() ORDER BY updated DESC';

  // Normalize jiraUrl: if the user pasted a full API path, reduce to origin
  let baseUrl;
  try {
    baseUrl = new URL(jiraUrl).origin;
  } catch (e) {
    // fallback: strip trailing slash
    baseUrl = jiraUrl.replace(/\/$/, '');
  }
  const primaryUrl = `${baseUrl}/rest/api/3/search/jql`;
  const fallbackUrl = `${baseUrl}/rest/api/3/search`;
  const body = {
    // match the curl ordering: fields first, then jql, then maxResults
    fields: ["key", "summary"],
    jql: jql,
    maxResults: 50
  };
  // Serialize once to ensure exact payload shape (some servers may be sensitive)
  const bodyString = JSON.stringify(body);

  // Helper to perform POST and return {resp, text, json}
  async function postSearch(urlToCall, bodyToSend) {
    const payload = (typeof bodyToSend === 'string') ? bodyToSend : JSON.stringify(bodyToSend);
    console.log('Background: Sending POST with Content-Type application/json, length:', payload.length);
    const resp = await fetch(urlToCall, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: payload
    });
    const text = await resp.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch (e) { /* ignore parse error */ }
    return { resp, text, json };
  }

  // Alternative POST using Blob for the body
  async function postSearchWithBlob(urlToCall, bodyToSend) {
    const jsonString = (typeof bodyToSend === 'string') ? bodyToSend : JSON.stringify(bodyToSend);
    console.log('Background: Sending POST with Blob, length:', jsonString.length);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const resp = await fetch(urlToCall, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json'
      },
      body: blob
    });
    const text = await resp.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch (e) { }
    return { resp, text, json };
  }

  // Alternative POST without Content-Type header (some proxies alter headers)
  async function postSearchWithoutContentType(urlToCall, bodyToSend) {
    const jsonString = (typeof bodyToSend === 'string') ? bodyToSend : JSON.stringify(bodyToSend);
    console.log('Background: Sending POST without Content-Type header, length:', jsonString.length);
    const resp = await fetch(urlToCall, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json'
      },
      body: jsonString
    });
    const text = await resp.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch (e) { }
    return { resp, text, json };
  }

  try {
    console.log('Background: Posting JQL to', primaryUrl, 'payload:', body);

    // Define a list of POST attempt functions to run in order
    const postAttempts = [
      async () => await postSearch(primaryUrl, body),
      async () => await postSearchWithBlob(primaryUrl, body),
      async () => await postSearchWithoutContentType(primaryUrl, body),
      // try 'query' key
      async () => await postSearch(primaryUrl, { query: jql, startAt: 0, maxResults: 50, fields: ["key", "summary"] }),
      async () => await postSearchWithBlob(primaryUrl, { query: jql, startAt: 0, maxResults: 50, fields: ["key", "summary"] }),
      async () => await postSearchWithoutContentType(primaryUrl, { query: jql })
    ];

    let finalResp = null;
    let finalText = null;
    let finalJson = null;
    let usedAttempt = null;

    for (const attemptFn of postAttempts) {
      try {
        const { resp, text, json } = await attemptFn();
        console.log('Background: POST attempt returned', resp.status, text);
        if (resp.ok) {
          finalResp = resp;
          finalText = text;
          finalJson = json;
          usedAttempt = attemptFn;
          break;
        }
        // if 410, API removed — break and let fallback logic handle
        if (resp.status === 410) {
          finalResp = resp;
          finalText = text;
          finalJson = json;
          console.warn('Background: Received 410 from POST attempt');
          break;
        }
        // otherwise continue to next attempt
      } catch (e) {
        console.warn('Background: POST attempt threw error', e);
        continue;
      }
    }

    // If no successful POST, try fallback POST URL once
    if (!finalResp || !finalResp.ok) {
      console.log('Background: Trying fallback POST URL', fallbackUrl);
      const { resp, text, json } = await postSearch(fallbackUrl, body);
      finalResp = resp;
      finalText = text;
      finalJson = json;
      console.log('Background: Fallback POST returned', resp.status, text);
    }

    // If still not ok, try legacy GET fallbacks
    if (!finalResp.ok) {
      console.warn('Background: All POST attempts failed, trying legacy GET fallbacks');

      // Inner legacy GETs use local variables (auth, baseUrl, jql)
      const encoded = encodeURIComponent(jql);
      const candidates = [
        `${baseUrl}/rest/api/3/search?jql=${encoded}&maxResults=50&fields=key,summary`,
        `${baseUrl}/rest/api/2/search?jql=${encoded}&maxResults=50&fields=key,summary`
      ];

      for (const url of candidates) {
        try {
          console.log('Background: Trying legacy GET fallback URL:', url);
          const resp = await fetch(url, {
            method: 'GET',
            headers: {
              'Authorization': `Basic ${auth}`,
              'Accept': 'application/json'
            }
          });

          const text = await resp.text();
          let json = null;
          try { json = text ? JSON.parse(text) : null; } catch (e) { }

          if (!resp.ok) {
            console.warn('Background: Legacy GET returned non-ok', resp.status, text);
            continue;
          }

          const issues = (json && json.issues) ? json.issues : [];
          const tickets = issues.map(issue => ({
            key: issue.key,
            summary: issue.fields && issue.fields.summary ? issue.fields.summary : '',
            display: `${issue.key} ${issue.fields && issue.fields.summary ? issue.fields.summary : ''}`.trim()
          }));

          console.log(`Background: Legacy GET fallback succeeded (${url}) — fetched ${tickets.length} tickets`);
          return tickets;
        } catch (err) {
          console.warn('Background: Legacy GET attempt failed for', url, err);
          continue;
        }
      }

      throw new Error(`JIRA API error: ${finalResp.status} - ${finalText}`);
    }

    // Success path
    const data = finalJson || {};
    const tickets = (data.issues || []).map(issue => ({
      key: issue.key,
      summary: issue.fields && issue.fields.summary ? issue.fields.summary : '',
      display: `${issue.key} ${issue.fields && issue.fields.summary ? issue.fields.summary : ''}`.trim()
    }));

    console.log(`Background: Fetched ${tickets.length} tickets from JIRA`);
    return tickets;

  } catch (error) {
    console.error('Error fetching JIRA tickets:', error);
    if (error.message && error.message.includes('410')) {
      error.message = `${error.message} — the JIRA REST API endpoint may have changed; ensure the extension uses /rest/api/3/search/jql (POST).`;
    }
    throw error;
  }
}
// Note: removed unused tryLegacyGetFallbacks helper to avoid confusion
