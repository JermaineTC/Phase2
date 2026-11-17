/*
 * app.js – the main controller of the editor.
 *
 * Responsibilities:
 *   1. Intercept paste events and insert the text as PLAIN text.
 *   2. Wrap "flagged" pastes in a highlighted <span class="paste-flag">.
 *   3. Keep each flagged paste's status and the "N references unverified" counter.
 *
 * Status values used for a flagged paste (each maps to a CSS class "flag-<status>"):
 *   "unverified" – flagged, the student has not acted on it yet
 *   "verified"   – the student pressed Verify
 *   "not-found"  – at least one reference was not found (still unverified)
 *   "dismissed"  – the student pressed Dismiss
 *
 * This file is loaded LAST in index.html, because it uses functions and
 * objects defined in the other script files.
 */

// ---------------------------------------------------------------
// 1. Page elements we need to work with
// ---------------------------------------------------------------
const editor = document.getElementById("editor");
const counterEl = document.getElementById("unverified-count");
const popup = document.getElementById("popup");
const toast = document.getElementById("toast");

// ---------------------------------------------------------------
// 2. Application state
// ---------------------------------------------------------------

// Every flagged paste is stored here, keyed by its id ("p1", "p2", ...).
// The <span> in the editor only stores the id (data-id); all other
// information lives in this object.
const pastes = {};
let nextPasteId = 1;

let openPasteId = null;   // id of the paste whose pop-up is open (null = closed)
let undoTimer = null;     // timer that hides the Undo message
const UNDO_SECONDS = 6;   // how long the Undo link stays available

// ---------------------------------------------------------------
// 3. Paste handling
// ---------------------------------------------------------------
editor.addEventListener("paste", handlePaste);

function handlePaste(event) {
  // Stop the browser from inserting the clipboard content itself
  // (it would keep fonts, colours, links etc. from the source).
  event.preventDefault();

  // Take only the plain-text version of whatever was copied.
  const text = event.clipboardData.getData("text/plain");
  if (!text) {
    return;
  }

  // Step 1 + 2: find citations and decide whether to flag (detector.js).
  const citations = extractCitations(text);
  const risk = riskScore(text, citations);

  // Not worth flagging: paste normally, no highlight, no pop-up.
  if (!risk.flagged) {
    insertAtCursor(document.createTextNode(text), false);
    updateCounter();
    return;
  }

  // Step 3 + 4: SIMULATED existence and support checks (lookup.js).
  // The results are stored on each citation object.
  citations.forEach(function (citation) {
    citation.existence = lookupReference(citation);    // "found" / "not_found"
    citation.reference = findReference(citation);      // matched entry or null
    citation.support = checkSupport(citation.claim, citation.reference);
  });

  // Remember this paste so the pop-up and counter can use it later.
  const id = "p" + nextPasteId;
  nextPasteId++;
  pastes[id] = {
    id: id,
    text: text,
    citations: citations,
    risk: risk,
    status: getInitialStatus(citations),
    statusBeforeDismiss: null // used by Undo
  };

  insertFlagSpan(createFlagSpan(id, text));
  applyStatusClass(id);
  updateCounter();

  // Step 5: show the pop-up next to the pasted text.
  openPopup(id);
}

/**
 * Inserts a DOM node (text node or <span>) where the cursor is.
 * If some text is selected, it is replaced (like a normal paste).
 *
 * avoidNesting: when true and the cursor is inside an existing flagged span,
 * the node is inserted AFTER that span so highlights are never nested.
 */
function insertAtCursor(node, avoidNesting) {
  const selection = window.getSelection();
  let range;

  if (selection.rangeCount > 0 && editor.contains(selection.getRangeAt(0).commonAncestorContainer)) {
    range = selection.getRangeAt(0);
    range.deleteContents(); // remove any selected text first
  } else {
    // No cursor in the editor: add to the end of the editor instead.
    range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false); // false = collapse to the end
  }

  if (avoidNesting) {
    const parentFlag = findFlagSpan(range.startContainer);
    if (parentFlag) {
      range.setStartAfter(parentFlag);
      range.collapse(true);
    }
  }

  range.insertNode(node);

  // Move the cursor to just after what we inserted.
  range.setStartAfter(node);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

/**
 * Creates the highlighted <span> for a flagged paste.
 * The CSS class "flag-<status>" is added later by applyStatusClass().
 */
function createFlagSpan(id, text) {
  const span = document.createElement("span");
  span.className = "paste-flag";
  span.dataset.id = id;        // becomes the attribute data-id="p1"
  span.textContent = text;     // textContent = safe, never parsed as HTML
  return span;
}

/**
 * Inserts a flagged span, then a zero-width space after it.
 * Why the zero-width space? Browsers (especially Chrome) tend to put
 * the cursor back INSIDE the span after an insert, so anything the
 * student types next would join the highlight. Having an invisible
 * character after the span gives the cursor somewhere to sit outside it.
 */
function insertFlagSpan(span) {
  insertAtCursor(span, true);
  insertAtCursor(document.createTextNode("​"), false);
}

/**
 * Walks up from any node to the flagged span that contains it (or null).
 */
function findFlagSpan(node) {
  // Text nodes have no .closest(), so start from their parent element.
  const element = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
  return element ? element.closest(".paste-flag") : null;
}

/**
 * Returns all spans in the editor that belong to one paste.
 * (Usually one, but the browser can split a span in two, e.g. when
 * the student presses Enter in the middle of it.)
 */
function getSpansForPaste(id) {
  return editor.querySelectorAll('.paste-flag[data-id="' + id + '"]');
}

// ---------------------------------------------------------------
// 4. Status and counter
// ---------------------------------------------------------------

/** A paste starts as "not-found" if any of its references was not found. */
function getInitialStatus(citations) {
  const anyNotFound = citations.some(function (citation) {
    return citation.existence === "not_found";
  });
  return anyNotFound ? "not-found" : "unverified";
}

/** Changes a paste's status and refreshes its colour and the counter. */
function setStatus(id, newStatus) {
  pastes[id].status = newStatus;
  applyStatusClass(id);
  updateCounter();
}

/** Makes the span's CSS class match the paste's current status. */
function applyStatusClass(id) {
  const status = pastes[id].status;
  getSpansForPaste(id).forEach(function (span) {
    span.className = "paste-flag flag-" + status;
  });
}

/**
 * Counts the references in flagged pastes that are still unverified
 * ("unverified" or "not-found") and shows the number in the status bar.
 * We count from the spans that are actually in the editor, so if the
 * student deletes a highlighted paste it no longer counts.
 */
function updateCounter() {
  const countedIds = {}; // so a split span is only counted once
  let count = 0;

  editor.querySelectorAll(".paste-flag").forEach(function (span) {
    const paste = pastes[span.dataset.id];
    if (!paste || countedIds[paste.id]) {
      return;
    }
    countedIds[paste.id] = true;

    if (paste.status === "unverified" || paste.status === "not-found") {
      count += paste.citations.length;
    }
  });

  counterEl.textContent = count + (count === 1 ? " reference" : " references") + " unverified";
}

// Typing or deleting can remove highlighted text, so recount on every edit.
editor.addEventListener("input", updateCounter);

// ---------------------------------------------------------------
// 5. Pop-up: rendering
// ---------------------------------------------------------------

/**
 * Escapes text before putting it into HTML, so pasted text such as
 * "<script>" is shown as text and never run as code.
 */
function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Chooses the prompting question for one citation:
 * a missing reference is the more serious problem, so it comes first;
 * otherwise use the question for the support result (may be "").
 */
function getQuestion(citation) {
  if (citation.existence === "not_found") {
    return PROMPTS.existence.not_found.question;
  }
  return PROMPTS.support[citation.support].question;
}

/** Builds the HTML for one citation inside the pop-up. */
function renderCitation(citation) {
  let html = '<li class="citation">';
  html += '<div class="citation-raw">' + escapeHtml(citation.raw) + "</div>";

  // Existence result
  const existenceClass = citation.existence === "found" ? "result-ok" : "result-bad";
  html += '<div class="result ' + existenceClass + '">' +
          escapeHtml(PROMPTS.existence[citation.existence].label) + "</div>";

  // If found, show which local entry it matched so the student can check it
  if (citation.reference) {
    html += '<div class="matched-ref">Matched: <em>' + escapeHtml(citation.reference.title) +
            "</em> (" + escapeHtml(citation.reference.venue) + ")</div>";
  }

  // Support result (only meaningful when the reference was found)
  if (citation.existence === "found") {
    html += '<div class="result result-' + citation.support + '">' +
            escapeHtml(PROMPTS.support[citation.support].label) + "</div>";
  }

  // Prompting question, if any
  const question = getQuestion(citation);
  if (question) {
    html += '<p class="question">' + escapeHtml(question) + "</p>";
  }

  html += "</li>";
  return html;
}

/** Builds the complete pop-up HTML for a paste. */
function renderPopup(paste) {
  let html = "";

  html += '<div class="popup-header">';
  html += "<strong>" + escapeHtml(PROMPTS.title) + "</strong>";
  html += '<button class="popup-close" data-action="close" aria-label="Close">&times;</button>';
  html += "</div>";

  html += '<p class="popup-note">' + escapeHtml(PROMPTS.simulatedNote) + "</p>";
  html += '<p class="popup-status">Status: ' + escapeHtml(PROMPTS.status[paste.status]) + "</p>";

  // One list item per detected citation
  if (paste.citations.length === 0) {
    html += "<p>" + escapeHtml(PROMPTS.noCitations) + "</p>";
  } else {
    html += '<ul class="citation-list">';
    paste.citations.forEach(function (citation) {
      html += renderCitation(citation);
    });
    html += "</ul>";
  }

  // Transparency: show why the paste was flagged (the risk score signals)
  html += '<details class="why-flagged"><summary>Why was this flagged?</summary><ul>';
  paste.risk.reasons.forEach(function (reason) {
    html += "<li>" + escapeHtml(reason) + "</li>";
  });
  html += "<li>Score " + paste.risk.score + " (flag at " + paste.risk.threshold + " or more)</li>";
  html += "</ul></details>";

  // Actions: the student decides; nothing is blocked
  html += '<div class="popup-actions">';
  html += '<button type="button" data-action="verify" class="btn btn-primary" title="I have checked the source(s) myself">Verify</button>';
  html += '<button type="button" data-action="edit" class="btn" title="Close this and edit the pasted text">Edit</button>';
  html += '<button type="button" data-action="dismiss" class="btn" title="Hide this check">Dismiss</button>';
  html += "</div>";

  return html;
}

// ---------------------------------------------------------------
// 6. Pop-up: opening, positioning, closing
// ---------------------------------------------------------------

function openPopup(id) {
  const paste = pastes[id];
  if (!paste || getSpansForPaste(id).length === 0) {
    return;
  }
  openPasteId = id;
  popup.innerHTML = renderPopup(paste);
  popup.hidden = false;
  positionPopup();
}

/**
 * Places the pop-up just below the highlighted span.
 * getBoundingClientRect() gives a position relative to the visible window,
 * so we add the scroll offset to get a position on the whole page
 * (the pop-up uses position: absolute).
 */
function positionPopup() {
  if (!openPasteId) {
    return;
  }
  const span = getSpansForPaste(openPasteId)[0];
  const rect = span.getBoundingClientRect();
  const gap = 8;

  let left = rect.left + window.scrollX;
  // Keep the pop-up inside the window on the right-hand side.
  const maxLeft = window.scrollX + document.documentElement.clientWidth - popup.offsetWidth - gap;
  left = Math.max(gap, Math.min(left, maxLeft));

  popup.style.top = (rect.bottom + window.scrollY + gap) + "px";
  popup.style.left = left + "px";
}

function closePopup() {
  popup.hidden = true;
  popup.innerHTML = "";
  openPasteId = null;
}

// Keep the pop-up attached to its span when the window size changes.
window.addEventListener("resize", positionPopup);

// Reopen the pop-up by clicking on a highlighted span.
editor.addEventListener("click", function (event) {
  const span = findFlagSpan(event.target);
  if (span) {
    openPopup(span.dataset.id);
  }
});

// Close on Escape.
document.addEventListener("keydown", function (event) {
  if (event.key === "Escape" && openPasteId) {
    closePopup();
  }
});

// Close when clicking anywhere except the pop-up or a highlighted span.
document.addEventListener("mousedown", function (event) {
  if (!openPasteId) {
    return;
  }
  if (popup.contains(event.target) || findFlagSpan(event.target)) {
    return;
  }
  closePopup();
});

// If the student deletes the highlighted text, close its pop-up too.
editor.addEventListener("input", function () {
  if (openPasteId && getSpansForPaste(openPasteId).length === 0) {
    closePopup();
  }
});

// ---------------------------------------------------------------
// 7. Button actions: Verify, Edit, Dismiss, Undo
// ---------------------------------------------------------------

// One listener for all pop-up buttons; data-action says which one was clicked.
popup.addEventListener("click", function (event) {
  const button = event.target.closest("[data-action]");
  if (!button || !openPasteId) {
    return;
  }
  const id = openPasteId;
  const action = button.dataset.action;

  if (action === "verify") {
    verifyPaste(id);
  } else if (action === "edit") {
    editPaste(id);
  } else if (action === "dismiss") {
    dismissPaste(id);
  } else if (action === "close") {
    closePopup();
  }
});

/** Verify: the student says they have checked the source(s). */
function verifyPaste(id) {
  setStatus(id, "verified");
  logEvent("verify", id);
  closePopup();
}

/** Edit: close the pop-up and put the cursor at the end of the pasted text. */
function editPaste(id) {
  closePopup();
  const spans = getSpansForPaste(id);
  const lastSpan = spans[spans.length - 1];

  editor.focus();
  const range = document.createRange();
  range.selectNodeContents(lastSpan);
  range.collapse(false); // cursor at the end of the span
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
  logEvent("edit", id);
}

/** Dismiss: mark as dismissed and offer Undo for a few seconds. */
function dismissPaste(id) {
  pastes[id].statusBeforeDismiss = pastes[id].status;
  setStatus(id, "dismissed");
  logEvent("dismiss", id);
  closePopup();
  showUndoToast(id);
}

/** Undo a dismiss: put back the status the paste had before. */
function undoDismiss(id) {
  const paste = pastes[id];
  if (paste && paste.status === "dismissed" && paste.statusBeforeDismiss) {
    setStatus(id, paste.statusBeforeDismiss);
    logEvent("undo-dismiss", id);
  }
  hideToast();
}

function showUndoToast(id) {
  clearTimeout(undoTimer); // only one Undo message at a time

  toast.innerHTML = escapeHtml(PROMPTS.dismissedToast) +
                    ' <button class="toast-undo" type="button">Undo</button>';
  toast.querySelector(".toast-undo").addEventListener("click", function () {
    undoDismiss(id);
  });
  toast.hidden = false;

  undoTimer = setTimeout(hideToast, UNDO_SECONDS * 1000);
}

function hideToast() {
  clearTimeout(undoTimer);
  toast.hidden = true;
  toast.innerHTML = "";
}

// ---------------------------------------------------------------
// 8. Simple interaction log (for your own testing / evaluation)
// ---------------------------------------------------------------
// Every action is printed to the browser console (F12 -> Console) and kept in
// the eventLog array. Type eventLog in the console to see all events so far.
const eventLog = [];

function logEvent(action, id) {
  const entry = { time: new Date().toISOString(), action: action, pasteId: id };
  eventLog.push(entry);
  console.log("[event]", entry);
}
