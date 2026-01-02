// Content script that runs on LLM sites
// Fills in the text and optionally submits

// LLM URLs for tossing
const LLM_URLS = {
  claude: { name: "Claude", url: "https://claude.ai/new" },
  chatgpt: { name: "ChatGPT", url: "https://chatgpt.com/" },
  gemini: { name: "Gemini", url: "https://gemini.google.com/app" },
  grok: { name: "Grok", url: "https://grok.com/" },
  perplexity: { name: "Perplexity", url: "https://www.perplexity.ai/" }
};

// Set up copy button interception
setupCopyButtonToss();

// Listen for "do-toss" message from background script (for tab reuse)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "do-toss" && message.toss) {
    const hostname = window.location.hostname;
    // Clear pending toss from storage since we're handling it now
    chrome.storage.local.remove("pendingToss");
    // Wait for page to be ready, then fill and submit
    waitForInputReady(hostname).then(() => {
      fillAndSubmit(hostname, message.toss.text);
    });
  }
});

// Wait for input element to be ready (not disabled, not during response)
function waitForInputReady(hostname) {
  return new Promise((resolve) => {
    const maxWait = 10000;
    const startTime = Date.now();

    const checkReady = () => {
      const input = findInputElement(hostname);

      // Check if input exists and is usable
      if (input) {
        const isDisabled = input.disabled || input.getAttribute('aria-disabled') === 'true';
        const isReadOnly = input.readOnly;

        if (!isDisabled && !isReadOnly) {
          resolve();
          return;
        }
      }

      if (Date.now() - startTime > maxWait) {
        resolve(); // Timeout, try anyway
        return;
      }

      setTimeout(checkReady, 200);
    };

    checkReady();
  });
}

(async function() {
  // Check if we have a pending toss
  const response = await chrome.runtime.sendMessage({ type: "content-ready" });

  if (!response || !response.toss) {
    return; // No pending toss
  }

  const { text } = response.toss;
  const hostname = window.location.hostname;

  // Wait for the page to be ready, then fill
  await waitForPageReady(hostname);
  await fillAndSubmit(hostname, text);
})();

function waitForPageReady(hostname) {
  return new Promise((resolve) => {
    const maxWait = 10000; // 10 seconds max
    const startTime = Date.now();

    const checkReady = () => {
      const input = findInputElement(hostname);

      if (input) {
        resolve();
        return;
      }

      if (Date.now() - startTime > maxWait) {
        resolve();
        return;
      }

      setTimeout(checkReady, 200);
    };

    // Initial delay to let page hydrate (longer for slow SPAs)
    setTimeout(checkReady, 1000);
  });
}

function findInputElement(hostname) {
  // Claude
  if (hostname.includes("claude.ai")) {
    return document.querySelector('[contenteditable="true"]') ||
           document.querySelector('div[data-placeholder]') ||
           document.querySelector('.ProseMirror');
  }

  // ChatGPT
  if (hostname.includes("chat.openai.com") || hostname.includes("chatgpt.com")) {
    return document.querySelector('#prompt-textarea') ||
           document.querySelector('textarea[data-id="root"]') ||
           document.querySelector('textarea');
  }

  // Gemini
  if (hostname.includes("gemini.google.com")) {
    return document.querySelector('.ql-editor') ||
           document.querySelector('[contenteditable="true"]') ||
           document.querySelector('rich-textarea textarea');
  }

  // Perplexity - multiple possible selectors
  if (hostname.includes("perplexity.ai")) {
    return document.querySelector('textarea[placeholder*="Ask"]') ||
           document.querySelector('textarea[placeholder*="ask"]') ||
           document.querySelector('textarea[placeholder*="Search"]') ||
           document.querySelector('textarea[placeholder*="search"]') ||
           document.querySelector('[contenteditable="true"]') ||
           document.querySelector('textarea');
  }

  // Grok
  if (hostname.includes("grok.com")) {
    return document.querySelector('textarea') ||
           document.querySelector('[contenteditable="true"]') ||
           document.querySelector('input[type="text"]');
  }

  return null;
}

function findSubmitButton(hostname) {
  // Claude - look for the send button more broadly
  if (hostname.includes("claude.ai")) {
    // Try multiple selectors for Claude's send button
    const buttons = document.querySelectorAll('button');
    for (const btn of buttons) {
      const ariaLabel = btn.getAttribute('aria-label')?.toLowerCase() || '';
      const text = btn.textContent?.toLowerCase() || '';
      if (ariaLabel.includes('send') || text.includes('send')) {
        return btn;
      }
    }
    // Look for button near the input area
    return document.querySelector('fieldset button') ||
           document.querySelector('[data-testid="send-button"]') ||
           document.querySelector('form button[type="button"]');
  }

  // ChatGPT - return special marker to skip auto-submit entirely
  if (hostname.includes("chat.openai.com") || hostname.includes("chatgpt.com")) {
    return "SKIP_SUBMIT";
  }

  // Gemini - use Enter key (more reliable, avoids hitting stop button)
  if (hostname.includes("gemini.google.com")) {
    return null;
  }

  // Perplexity - use Enter key (more reliable)
  if (hostname.includes("perplexity.ai")) {
    return null;
  }

  // Grok - use Enter key instead of button (more reliable)
  if (hostname.includes("grok.com")) {
    // Return null to force Enter key submission
    return null;
  }

  return null;
}

async function fillAndSubmit(hostname, text) {
  const input = findInputElement(hostname);

  if (!input) {
    // Fallback: copy to clipboard
    await navigator.clipboard.writeText(text);
    showNotification("Text copied - paste with Cmd+V");
    return;
  }

  // Focus and fill the input
  input.focus();

  if (input.tagName === "TEXTAREA" || input.tagName === "INPUT") {
    // Clear any existing text first
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      input.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype,
      'value'
    ).set;
    nativeInputValueSetter.call(input, '');
    input.dispatchEvent(new Event('input', { bubbles: true }));

    // Small delay after clearing
    await sleep(50);

    // Set the new value
    nativeInputValueSetter.call(input, text);

    // Dispatch multiple event types for maximum compatibility with React
    input.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      cancelable: true,
      inputType: 'insertText',
      data: text
    }));
    input.dispatchEvent(new Event('change', { bubbles: true }));

    // Also try triggering a keyup to help React recognize the change
    input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
  } else if (input.getAttribute('contenteditable') === 'true' || input.classList.contains('ProseMirror')) {
    // ContentEditable (Claude, some others)
    input.focus();

    // Try using execCommand first (more compatible)
    document.execCommand('selectAll', false, null);
    document.execCommand('insertText', false, text);

    // Fallback: direct innerHTML/textContent
    if (!input.textContent || input.textContent.length < text.length / 2) {
      input.textContent = text;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  // Delay to let React/frameworks process the input
  await sleep(300);

  let submitButton = findSubmitButton(hostname);

  // ChatGPT: skip auto-submit entirely (causes blank responses)
  if (submitButton === "SKIP_SUBMIT") {
    showNotification("Text filled - press Enter to send");
    return;
  }

  // If we found a button, wait for it to be enabled
  if (submitButton && submitButton.disabled) {
    const buttonWaitStart = Date.now();
    while (submitButton.disabled && Date.now() - buttonWaitStart < 3000) {
      await sleep(100);
      submitButton = findSubmitButton(hostname);
      if (!submitButton) break;
    }
  }

  if (submitButton && !submitButton.disabled) {
    // Single click - multiple clicks can cause rendering issues
    submitButton.focus();
    await sleep(50);
    submitButton.click();
    showNotification("Sent!");
  } else {
    // Try pressing Enter as fallback
    try {
      input.focus();
      await sleep(100);

      // Create Enter event with all properties React might check
      const enterEvent = new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        charCode: 13,
        bubbles: true,
        cancelable: true,
        composed: true,
        view: window
      });

      input.dispatchEvent(enterEvent);
      await sleep(50);

      // Also dispatch on the form if there is one
      const form = input.closest('form');
      if (form) {
        form.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Enter',
          code: 'Enter',
          keyCode: 13,
          which: 13,
          bubbles: true,
          cancelable: true,
          composed: true,
          view: window
        }));
        await sleep(50);
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      }

      showNotification("Sent!");
    } catch (e) {
      showNotification("Text filled - press Enter to send");
    }
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function showNotification(message) {
  // Add animation style once
  if (!document.getElementById('toss-notification-style')) {
    const style = document.createElement('style');
    style.id = 'toss-notification-style';
    style.textContent = `
      @keyframes toss-fade-in {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
      }
    `;
    document.head.appendChild(style);
  }

  // Create a small toast notification
  const toast = document.createElement('div');
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: linear-gradient(135deg, #8B5CF6, #06B6D4);
    color: #fff;
    padding: 12px 20px;
    border-radius: 8px;
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 14px;
    font-weight: 500;
    z-index: 999999;
    box-shadow: 0 4px 12px rgba(139,92,246,0.3);
    animation: toss-fade-in 0.2s ease-out;
  `;
  document.body.appendChild(toast);

  // Remove after 2 seconds
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.2s';
    setTimeout(() => toast.remove(), 200);
  }, 2000);
}

// Get the content associated with a copy button
function getContentForCopyButton(button) {
  const hostname = window.location.hostname;

  // Claude-specific: action bar is sibling to message content
  if (hostname.includes("claude.ai")) {
    // The button is in an action bar, content is in a sibling or parent's child
    const actionBar = button.closest('[class*="action"]') || button.closest('[data-testid*="action"]');
    if (actionBar) {
      const parent = actionBar.parentElement;
      if (parent) {
        // Find the message content div (usually has markdown content)
        const contentDiv = parent.querySelector('[class*="markdown"]') ||
                          parent.querySelector('[class*="prose"]') ||
                          parent.querySelector('[class*="message-content"]');
        if (contentDiv) {
          return contentDiv.textContent?.trim() || '';
        }
        // Fallback: get all text except the action bar
        const clone = parent.cloneNode(true);
        clone.querySelectorAll('button').forEach(b => b.remove());
        clone.querySelectorAll('[class*="action"]').forEach(a => a.remove());
        return clone.textContent?.trim() || '';
      }
    }
  }

  // Try to find the message content near the button
  // Most LLMs have the copy button inside or near the message container
  let container = button.closest('[data-message-id]') ||
                  button.closest('[data-testid*="message"]') ||
                  button.closest('.message') ||
                  button.closest('article') ||
                  button.closest('[class*="message"]') ||
                  button.closest('[class*="response"]') ||
                  button.closest('[class*="turn"]');

  if (container) {
    // Try to get text content, excluding button text
    const clone = container.cloneNode(true);
    clone.querySelectorAll('button').forEach(b => b.remove());
    return clone.textContent?.trim() || '';
  }

  // Fallback: look for code blocks if this is a code copy button
  const codeBlock = button.closest('pre') || button.closest('[class*="code"]');
  if (codeBlock) {
    const code = codeBlock.querySelector('code') || codeBlock;
    return code.textContent?.trim() || '';
  }

  // Last resort: go up a few levels and grab text
  let parent = button.parentElement;
  for (let i = 0; i < 5 && parent; i++) {
    const text = parent.textContent?.trim() || '';
    if (text.length > 50) {
      const clone = parent.cloneNode(true);
      clone.querySelectorAll('button').forEach(b => b.remove());
      return clone.textContent?.trim() || '';
    }
    parent = parent.parentElement;
  }

  return '';
}

// Show toss menu near the button
function showTossMenu(button, content) {
  // Remove any existing menu
  document.querySelectorAll('.toss-menu').forEach(m => m.remove());

  const rect = button.getBoundingClientRect();
  const menu = document.createElement('div');
  menu.className = 'toss-menu';
  menu.style.cssText = `
    position: fixed;
    top: ${rect.bottom + 5}px;
    left: ${rect.left}px;
    background: #1a1a1a;
    border: 1px solid #8B5CF6;
    border-radius: 8px;
    padding: 4px;
    z-index: 999999;
    box-shadow: 0 4px 12px rgba(139,92,246,0.3);
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
  `;

  // Get current site to exclude from menu
  const hostname = window.location.hostname;

  Object.entries(LLM_URLS).forEach(([key, llm]) => {
    // Skip current site
    if (hostname.includes(key) ||
        (key === 'chatgpt' && (hostname.includes('openai') || hostname.includes('chatgpt')))) {
      return;
    }

    const item = document.createElement('button');
    item.textContent = `Toss to ${llm.name}`;
    item.style.cssText = `
      display: block;
      width: 100%;
      padding: 8px 12px;
      background: transparent;
      border: none;
      color: #fafafa;
      font-size: 13px;
      text-align: left;
      cursor: pointer;
      border-radius: 4px;
      white-space: nowrap;
    `;
    item.addEventListener('mouseenter', () => {
      item.style.background = 'linear-gradient(135deg, rgba(139,92,246,0.2), rgba(6,182,212,0.2))';
    });
    item.addEventListener('mouseleave', () => {
      item.style.background = 'transparent';
    });
    item.addEventListener('click', async (e) => {
      e.stopPropagation();
      menu.remove();

      // Store the toss data and open via background script (reuses existing tabs)
      await chrome.storage.local.set({
        pendingToss: {
          text: content,
          llm: key,
          timestamp: Date.now()
        },
        lastToss: {
          text: content.substring(0, 100) + (content.length > 100 ? "..." : ""),
          llm: llm.name,
          timestamp: Date.now()
        }
      });

      // Ask background script to open (reuses existing tabs)
      chrome.runtime.sendMessage({ type: "open-llm", url: llm.url });
    });
    menu.appendChild(item);
  });

  document.body.appendChild(menu);

  // Close menu when clicking outside
  const closeMenu = (e) => {
    if (!menu.contains(e.target)) {
      menu.remove();
      document.removeEventListener('click', closeMenu);
    }
  };
  setTimeout(() => document.addEventListener('click', closeMenu), 0);
}

// Check if a button is a copy button
function isCopyButton(button) {
  if (!button) return false;

  const ariaLabel = (button.getAttribute('aria-label') || '').toLowerCase();
  const title = (button.getAttribute('title') || '').toLowerCase();
  const testId = (button.getAttribute('data-testid') || '').toLowerCase();
  const className = (button.className || '').toLowerCase();
  const text = (button.textContent || '').toLowerCase().trim();

  // Check various attributes for "copy"
  if (ariaLabel.includes('copy')) return true;
  if (title.includes('copy')) return true;
  if (testId.includes('copy')) return true;
  if (className.includes('copy')) return true;
  if (text === 'copy') return true;

  return false;
}

// Set up copy button interception
function setupCopyButtonToss() {
  // Use event delegation for dynamically added buttons
  document.addEventListener('click', (e) => {
    // Find the clicked button
    const button = e.target.closest('button');

    if (button && isCopyButton(button)) {
      // Get the content first
      const content = getContentForCopyButton(button);

      if (content) {
        // Show toss menu after a tiny delay (let the copy happen first)
        setTimeout(() => showTossMenu(button, content), 150);
      }
    }
  }, true);
}
