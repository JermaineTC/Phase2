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

// ---------------------------------------------------------------
// 2. Application state
// ---------------------------------------------------------------

// Every flagged paste is stored here, keyed by its id ("p1", "p2", ...).
// The <span> in the editor only stores the id (data-id); all other
// information lives in this object.
const pastes = {};
let nextPasteId = 1;

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

  // Remember this paste so the pop-up and counter can use it later.
  const id = "p" + nextPasteId;
  nextPasteId++;
  pastes[id] = {
    id: id,
    text: text,
    citations: citations,
    risk: risk,
    status: "unverified",
    statusBeforeDismiss: null // used by Undo
  };

  insertFlagSpan(createFlagSpan(id, text));
  applyStatusClass(id);
  updateCounter();
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
