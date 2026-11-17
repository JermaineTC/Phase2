/*
 * app.js – the main controller of the editor.
 *
 * What happens on paste (for EACH citation found):
 *   1. extractCitations()         detector.js – find citations
 *   2. lookupReference()          lookup.js   – does the reference exist? (simulated)
 *   3. checkSupport()             lookup.js   – does its quote match the claim?
 *   4. riskScore()                detector.js – score the results
 *   5. decideInterruptionLevel()  detector.js – "problem" / "likely-supported" / "quiet"
 * Each citation is then wrapped in its own highlight:
 *   <span class="paste-flag level-<level>" data-id="c1">
 * The pop-up opens automatically ONLY for "problem" citations; the
 * others open their pop-up when clicked.
 *
 * Status of each citation: "unverified" | "verified" | "dismissed".
 * Only unverified citations stay highlighted; Verify and Dismiss turn the
 * citation back into normal text (Undo after Dismiss restores it).
 *
 * This file is loaded LAST in index.html, because it uses functions and
 * objects defined in the other script files.
 */

// ---------------------------------------------------------------
// 0. Configuration
// ---------------------------------------------------------------
const APP_CONFIG = {
  undoSeconds: 6,     // how long the Undo link stays available after Dismiss
  messageSeconds: 4,  // how long other short messages stay on screen
  popupGap: 8,        // pixels between the highlight and the pop-up
  flashMs: 1500       // how long text "flashes" when jumped to from the history
};

// ---------------------------------------------------------------
// 1. Page elements we need to work with
// ---------------------------------------------------------------
const editor = document.getElementById("editor");
const summaryEl = document.getElementById("status-summary");
const countUnverifiedEl = document.getElementById("count-unverified");
const countVerifiedEl = document.getElementById("count-verified");
const countDismissedEl = document.getElementById("count-dismissed");
const historyList = document.getElementById("history-list");
const historyEmpty = document.getElementById("history-empty");
const popup = document.getElementById("popup");
const toast = document.getElementById("toast");

// ---------------------------------------------------------------
// 2. Application state
// ---------------------------------------------------------------

// The session history: every citation found this session, in the order it
// was pasted. Each entry is the citation object from extractCitations()
// with the check results, an id ("c1", "c2", ...), status and time added.
// It only lives in memory, so it is lost when the page is reloaded.
// PLANNED: persist history and document across reloads
const records = [];
let nextRecordId = 1;
let nextPasteId = 1;

let openRecordId = null;  // id of the citation whose pop-up is open (null = closed)
let toastTimer = null;    // timer that hides the message at the bottom of the screen

/** Finds a citation record by its id (or null). */
function getRecord(id) {
  for (let i = 0; i < records.length; i++) {
    if (records[i].id === id) {
      return records[i];
    }
  }
  return null;
}

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
  closePopup(); // a new paste replaces any pop-up that was open

  // Step 1: find citations.
  const citations = extractCitations(text);

  // No citations: paste normally, no highlight, no pop-up.
  if (citations.length === 0) {
    insertAtCursor(document.createTextNode(text), false);
    refreshStatus();
    return;
  }

  // Steps 2–5 for every citation. The results are stored on the citation
  // object itself, which then becomes this session's record of it.
  const pasteId = "p" + nextPasteId;
  nextPasteId++;
  const pastedAt = new Date();

  citations.forEach(function (citation) {
    citation.existence = lookupReference(citation);   // "found" / "not_found"
    citation.reference = findReference(citation);     // matched entry or null
    citation.support = checkSupport(citation.claim, citation.reference);
    citation.risk = riskScore(citation, text, citations.length);
    citation.level = decideInterruptionLevel(citation, citation.risk);

    citation.id = "c" + nextRecordId;
    nextRecordId++;
    citation.pasteId = pasteId;
    citation.status = "unverified";
    citation.time = pastedAt;
    records.push(citation);
  });

  insertAtCursor(buildPasteFragment(text, citations), true);
  refreshStatus();

  // Selective interruption: only open the pop-up automatically if a
  // citation in this paste is a "problem". If there are several, the
  // first one opens; the others stay strongly highlighted.
  for (let i = 0; i < citations.length; i++) {
    if (citations[i].level === "problem") {
      openPopup(citations[i].id);
      break;
    }
  }
}

/**
 * Builds the pasted text as a DocumentFragment (a group of nodes that can
 * be inserted in one go): plain text nodes for the text BETWEEN citations
 * and a highlight <span> for each citation.
 * Uses the start/end positions that extractCitations() worked out.
 */
function buildPasteFragment(text, citations) {
  const fragment = document.createDocumentFragment();
  let position = 0;

  citations.forEach(function (citation) {
    if (citation.start > position) {
      fragment.appendChild(document.createTextNode(text.slice(position, citation.start)));
    }
    fragment.appendChild(createCitationSpan(citation));
    position = citation.end;
  });

  if (position < text.length) {
    fragment.appendChild(document.createTextNode(text.slice(position)));
  }

  // If the paste ends with a highlight, add a zero-width space after it.
  // Why? Browsers (especially Chrome) tend to put the cursor back INSIDE
  // the span, so anything typed next would join the highlight.
  if (fragment.lastChild && fragment.lastChild.nodeType === Node.ELEMENT_NODE) {
    fragment.appendChild(document.createTextNode("​"));
  }
  return fragment;
}

/** Creates the highlight <span> for one citation. */
function createCitationSpan(record) {
  const span = document.createElement("span");
  span.dataset.id = record.id;                         // becomes data-id="c1"
  span.title = PROMPTS.levels[record.level].tooltip;   // hover text
  span.textContent = record.raw;                       // textContent = safe, never parsed as HTML
  span.className = getSpanClass(record);
  return span;
}

/**
 * CSS classes for a citation's highlight, based on its interruption level.
 * (Only unverified citations have a highlight; verified and dismissed
 * citations are turned back into plain text.)
 */
function getSpanClass(record) {
  return "paste-flag level-" + record.level;
}

/**
 * Inserts a DOM node (text node, <span> or fragment) where the cursor is.
 * If some text is selected, it is replaced (like a normal paste).
 *
 * avoidNesting: when true and the cursor is inside an existing highlight,
 * the node is inserted AFTER that highlight so highlights are never nested.
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

  // A fragment empties itself when inserted, so remember its last node first.
  const lastNode = node.nodeType === Node.DOCUMENT_FRAGMENT_NODE ? node.lastChild : node;
  range.insertNode(node);

  // Move the cursor to just after what we inserted.
  range.setStartAfter(lastNode);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

/**
 * Walks up from any node to the highlight span that contains it (or null).
 */
function findFlagSpan(node) {
  if (!node) {
    return null;
  }
  // Text nodes have no .closest(), so start from their parent element.
  const element = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
  return element ? element.closest(".paste-flag") : null;
}

/**
 * Returns all spans in the editor that belong to one citation.
 * (Usually one, but the browser can split a span in two, e.g. when
 * the student presses Enter in the middle of it.)
 */
function getSpansForRecord(id) {
  return editor.querySelectorAll('.paste-flag[data-id="' + id + '"]');
}

/** True if the citation's highlighted text is still in the editor. */
function isInEditor(id) {
  return getSpansForRecord(id).length > 0;
}

// ---------------------------------------------------------------
// 4. Status and counter
// ---------------------------------------------------------------

/** Changes a citation's status and refreshes the counter. */
function setStatus(id, newStatus) {
  getRecord(id).status = newStatus;
  refreshStatus();
}

/**
 * Removes a citation's highlight: each of its spans is replaced by a plain
 * text node with the same text, so it becomes normal editor text and new
 * typing can never end up inside an old highlight.
 *
 * The {span, textNode} pairs are saved on the record so that
 *   - Undo (after Dismiss) can swap the span back in, and
 *   - we can still find the text later.
 * We deliberately do NOT call editor.normalize() (which merges neighbouring
 * text nodes), because that would throw away the saved text nodes.
 */
function unwrapHighlight(id) {
  const record = getRecord(id);
  record.unwrapped = [];
  getSpansForRecord(id).forEach(function (span) {
    const textNode = document.createTextNode(span.textContent);
    span.replaceWith(textNode);
    record.unwrapped.push({ span: span, textNode: textNode });
  });
}

/**
 * Puts a citation's highlight back (used by Undo).
 * Only works if the plain text is still in the editor and unchanged.
 * Returns true if at least one span was restored.
 */
function rewrapHighlight(id) {
  const record = getRecord(id);
  let restored = false;
  (record.unwrapped || []).forEach(function (pair) {
    const stillThere = editor.contains(pair.textNode) && pair.textNode.data === pair.span.textContent;
    if (stillThere) {
      pair.span.className = getSpanClass(record); // same level as before
      pair.textNode.replaceWith(pair.span);
      restored = true;
    }
  });
  record.unwrapped = null;
  return restored;
}

/**
 * Recounts Unverified / Verified / Dismissed, updates the status-bar
 * summary and redraws the history list. Called after every change.
 *
 * Unverified = unverified citations whose text is still in the editor
 * (any level – "likely supported" counts too, because only the student's
 * Verify makes a citation verified). If the student deletes an unverified
 * citation, it stays in the history marked "text deleted" but is no longer
 * counted.
 */
function refreshStatus() {
  let unverified = 0;
  let verified = 0;
  let dismissed = 0;

  records.forEach(function (record) {
    if (record.status === "unverified" && isInEditor(record.id)) {
      unverified++;
    } else if (record.status === "verified") {
      verified++;
    } else if (record.status === "dismissed") {
      dismissed++;
    }
  });

  countUnverifiedEl.textContent = unverified;
  countVerifiedEl.textContent = verified;
  countDismissedEl.textContent = dismissed;
  summaryEl.textContent = unverified + " unverified · " + verified + " verified · " + dismissed + " dismissed";

  renderHistory();
}

// Typing or deleting can remove highlighted text, so refresh on every edit.
editor.addEventListener("input", refreshStatus);

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
function getQuestion(record) {
  if (record.existence === "not_found") {
    return PROMPTS.existence.not_found.question;
  }
  return PROMPTS.support[record.support].question;
}

/** Builds the complete pop-up HTML for one citation. */
function renderPopup(record) {
  let html = "";

  html += '<div class="popup-header">';
  html += "<strong>" + escapeHtml(PROMPTS.title) + "</strong>";
  html += '<button type="button" class="popup-close" data-action="close" aria-label="Close">&times;</button>';
  html += "</div>";

  html += '<p class="popup-note">' + escapeHtml(PROMPTS.simulatedNote) + "</p>";
  html += '<p class="popup-status">' +
          '<span class="level-badge badge-' + record.level + '">' + escapeHtml(PROMPTS.levels[record.level].name) + "</span> " +
          escapeHtml(PROMPTS.status[record.status]) + "</p>";

  // The citation and its results
  html += '<div class="citation-raw">' + escapeHtml(record.raw) + "</div>";

  const existenceClass = record.existence === "found" ? "result-ok" : "result-bad";
  html += '<div class="result ' + existenceClass + '">' +
          escapeHtml(PROMPTS.existence[record.existence].label) + "</div>";

  // If found, show which local entry it matched so the student can check it
  if (record.reference) {
    html += '<div class="matched-ref">Matched: <em>' + escapeHtml(record.reference.title) +
            "</em> (" + escapeHtml(record.reference.venue) + ")</div>";
  }

  // Support result (only meaningful when the reference was found)
  if (record.existence === "found") {
    html += '<div class="result result-' + record.support + '">' +
            escapeHtml(PROMPTS.support[record.support].label) + "</div>";
  }

  // Prompting question, if any
  const question = getQuestion(record);
  if (question) {
    html += '<p class="question">' + escapeHtml(question) + "</p>";
  }

  // Transparency: every signal that fired, and the total score.
  // Shown for all three levels.
  html += '<details class="why-flagged"><summary>Why was this flagged?</summary><ul>';
  record.risk.reasons.forEach(function (reason) {
    html += "<li>" + escapeHtml(reason) + "</li>";
  });
  html += "<li><strong>Total score " + record.risk.score + "</strong> " +
          "(the pop-up opens automatically at " + record.risk.threshold + " or more)</li>";
  html += "</ul></details>";

  // Actions – the student decides; nothing is blocked
  html += '<div class="popup-actions">';
  html += '<button type="button" data-action="verify" class="btn btn-primary" title="I have checked the source myself">Verify</button>';
  html += '<button type="button" data-action="edit" class="btn" title="Close this and edit the text">Edit</button>';
  html += '<button type="button" data-action="dismiss" class="btn" title="Hide this check">Dismiss</button>';
  html += "</div>";

  return html;
}

// ---------------------------------------------------------------
// 6. Pop-up: opening, positioning, closing
// ---------------------------------------------------------------

function openPopup(id) {
  const record = getRecord(id);
  if (!record || !isInEditor(id)) {
    return;
  }
  openRecordId = id;
  popup.innerHTML = renderPopup(record);
  popup.hidden = false;
  positionPopup();
}

/**
 * Places the pop-up just below the highlighted citation.
 * getBoundingClientRect() gives a position relative to the visible window,
 * so we add the scroll offset to get a position on the whole page
 * (the pop-up uses position: absolute).
 */
function positionPopup() {
  if (!openRecordId) {
    return;
  }
  const span = getSpansForRecord(openRecordId)[0];
  const rect = span.getBoundingClientRect();
  const gap = APP_CONFIG.popupGap;

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
  openRecordId = null;
}

// Keep the pop-up attached to its highlight when the window size changes.
window.addEventListener("resize", positionPopup);

// Open the pop-up by clicking on a highlight (any level).
editor.addEventListener("click", function (event) {
  const span = findFlagSpan(event.target);
  if (span) {
    openPopup(span.dataset.id);
  }
});

// Close on Escape.
document.addEventListener("keydown", function (event) {
  if (event.key === "Escape" && openRecordId) {
    closePopup();
  }
});

// Close when clicking anywhere except the pop-up or a highlight.
document.addEventListener("mousedown", function (event) {
  if (!openRecordId) {
    return;
  }
  if (popup.contains(event.target) || findFlagSpan(event.target)) {
    return;
  }
  closePopup();
});

// If the student deletes the highlighted text, close its pop-up too.
editor.addEventListener("input", function () {
  if (openRecordId && !isInEditor(openRecordId)) {
    closePopup();
  }
});

// ---------------------------------------------------------------
// 7. Button actions: Verify, Edit, Dismiss, Undo
// ---------------------------------------------------------------

// One listener for all pop-up buttons; data-action says which one was clicked.
popup.addEventListener("click", function (event) {
  const button = event.target.closest("[data-action]");
  if (!button || !openRecordId) {
    return;
  }
  const id = openRecordId;
  const action = button.dataset.action;

  if (action === "verify") {
    verifyRecord(id);
  } else if (action === "edit") {
    editRecord(id);
  } else if (action === "dismiss") {
    dismissRecord(id);
  } else if (action === "close") {
    closePopup();
  }
});

/** Verify: the student says they have checked the source. Highlight is removed. */
function verifyRecord(id) {
  closePopup();
  unwrapHighlight(id);
  setStatus(id, "verified");
  logEvent("verify", id);
}

/** Edit: close the pop-up and put the cursor at the end of the citation. */
function editRecord(id) {
  closePopup();
  const spans = getSpansForRecord(id);
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

/** Dismiss: remove the highlight, mark as dismissed and offer Undo for a few seconds. */
function dismissRecord(id) {
  const record = getRecord(id);
  record.statusBeforeDismiss = record.status;
  closePopup();
  unwrapHighlight(id);
  setStatus(id, "dismissed");
  logEvent("dismiss", id);
  showUndoToast(id);
}

/** Undo a dismiss: restore the highlight (same level) and the previous status. */
function undoDismiss(id) {
  const record = getRecord(id);
  hideToast();
  if (record && record.status === "dismissed") {
    if (rewrapHighlight(id)) {
      setStatus(id, record.statusBeforeDismiss || "unverified");
      logEvent("undo-dismiss", id);
    } else {
      // The text was edited or deleted in the meantime, so there is
      // nothing to put the highlight back on. It stays dismissed.
      showMessage(PROMPTS.history.textGoneMessage);
    }
  }
}

function showUndoToast(id) {
  clearTimeout(toastTimer); // only one Undo message at a time

  toast.innerHTML = escapeHtml(PROMPTS.dismissedToast) +
                    ' <button class="toast-undo" type="button">Undo</button>';
  toast.querySelector(".toast-undo").addEventListener("click", function () {
    undoDismiss(id);
  });
  toast.hidden = false;

  toastTimer = setTimeout(hideToast, APP_CONFIG.undoSeconds * 1000);
}

/** Shows a short message (no buttons) at the bottom of the screen. */
function showMessage(text) {
  clearTimeout(toastTimer);
  toast.textContent = text;
  toast.hidden = false;
  toastTimer = setTimeout(hideToast, APP_CONFIG.messageSeconds * 1000);
}

function hideToast() {
  clearTimeout(toastTimer);
  toast.hidden = true;
  toast.innerHTML = "";
}

// ---------------------------------------------------------------
// 8. Session history panel
// ---------------------------------------------------------------

/** Formats a Date as e.g. "14:05:32". */
function formatTime(date) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

/**
 * Redraws the history list from the records array (newest first).
 * Each entry shows: citation text, status, lookup result, support result,
 * interruption level and the time it was pasted.
 */
function renderHistory() {
  historyEmpty.hidden = records.length > 0;

  let html = "";
  for (let i = records.length - 1; i >= 0; i--) {
    const record = records[i];
    const h = PROMPTS.history;

    let statusText = h.status[record.status];
    if (record.status === "unverified" && !isInEditor(record.id)) {
      statusText += " (" + h.textDeleted + ")";
    }

    // Each entry is a <button> so it can be clicked or used with the keyboard.
    html += '<li><button type="button" class="history-item history-' + record.status + '" data-id="' + record.id + '">';
    html += '<span class="history-raw">' + escapeHtml(record.raw) + "</span>";
    html += '<span class="history-meta">' +
            "<strong>" + escapeHtml(statusText) + "</strong>" +
            " · " + escapeHtml(h.existence[record.existence]) +
            " · " + escapeHtml(h.support[record.support]) +
            " · " + escapeHtml(PROMPTS.levels[record.level].name) +
            " · " + formatTime(record.time) +
            "</span>";
    html += "</button></li>";
  }
  historyList.innerHTML = html;
}

// Clicking a history entry jumps to that citation in the editor.
historyList.addEventListener("click", function (event) {
  const item = event.target.closest(".history-item");
  if (item) {
    goToRecord(item.dataset.id);
  }
});

/**
 * Scrolls to a citation's text in the editor and flashes it briefly.
 * For unverified citations, the pop-up is opened as well.
 * If the text is no longer in the editor, a message says so.
 */
function goToRecord(id) {
  const record = getRecord(id);
  const range = getRangeForRecord(record);
  if (!range) {
    showMessage(PROMPTS.history.textGoneMessage);
    return;
  }

  // Scroll the text into the middle of the window (instant, so that the
  // position we measure for the flash is the final one).
  const element = range.startContainer.nodeType === Node.TEXT_NODE
    ? range.startContainer.parentElement
    : range.startContainer;
  element.scrollIntoView({ block: "center" });

  flashRange(range);
  if (record.status === "unverified") {
    openPopup(id);
  }
}

/**
 * Returns a Range covering the citation's text in the editor, or null.
 *   - Unverified: the text is inside its highlight span(s).
 *   - Verified/dismissed: the highlight was unwrapped, so we use the text
 *     node saved by unwrapHighlight(), if it is still in the editor and
 *     still contains the citation text.
 */
function getRangeForRecord(record) {
  const range = document.createRange();

  const spans = getSpansForRecord(record.id);
  if (spans.length > 0) {
    range.setStartBefore(spans[0]);
    range.setEndAfter(spans[spans.length - 1]);
    return range;
  }

  if (record.unwrapped && record.unwrapped.length > 0) {
    const pair = record.unwrapped[0];
    const originalText = pair.span.textContent;
    const position = pair.textNode.data.indexOf(originalText);
    if (editor.contains(pair.textNode) && position !== -1) {
      range.setStart(pair.textNode, position);
      range.setEnd(pair.textNode, position + originalText.length);
      return range;
    }
  }
  return null; // deleted or changed
}

/**
 * Briefly draws a coloured box over a piece of text. The box is a separate
 * element on top of the page, so the editor's text is never changed.
 */
function flashRange(range) {
  const rect = range.getBoundingClientRect();
  const box = document.createElement("div");
  box.className = "flash-box";
  box.style.top = (rect.top + window.scrollY - 2) + "px";
  box.style.left = (rect.left + window.scrollX - 2) + "px";
  box.style.width = (rect.width + 4) + "px";
  box.style.height = (rect.height + 4) + "px";
  document.body.appendChild(box);
  setTimeout(function () { box.remove(); }, APP_CONFIG.flashMs);
}

// Draw the (empty) history once when the page loads.
refreshStatus();

// ---------------------------------------------------------------
// 9. Simple interaction log (for your own testing / evaluation)
// ---------------------------------------------------------------
// Every action is printed to the browser console (F12 -> Console) and kept in
// the eventLog array. Type eventLog in the console to see all events so far.
const eventLog = [];

function logEvent(action, id) {
  const entry = { time: new Date().toISOString(), action: action, citationId: id };
  eventLog.push(entry);
  console.log("[event]", entry);
}
