/*
 * detector.js – finds citations in pasted text, scores each one and
 * decides how strongly to interrupt the student.
 *
 * Public functions (used by app.js):
 *   extractCitations(text)                          -> array of citation objects
 *   riskScore(citation, pasteText, citationCount)   -> { score, threshold, reasons }
 *   decideInterruptionLevel(citation, risk)         -> "problem" | "likely-supported" | "quiet"
 *
 * A citation object looks like:
 *   {
 *     raw:     "(Bansal et al., 2021)",   // the exact text that matched
 *     start:   57,                        // position of raw in the pasted text
 *     end:     78,                        // position just after raw
 *     type:    "in-text" or "reference-list",
 *     authors: ["Bansal"],                 // surnames we could read
 *     year:    2021,
 *     title:   "",                         // only for reference-list lines
 *     claim:   "AI explanations ..."       // the sentence it supports ("" for reference-list lines)
 *   }
 */

// ---------------------------------------------------------------
// Risk score configuration – ALL weights and the threshold live here.
// The score is calculated PER CITATION, after the (simulated) lookup and
// support check, so it scores the RESULTS rather than just "has a citation".
// ---------------------------------------------------------------
const DETECTOR_CONFIG = {
  // TODO(me): tune
  weights: {
    // The reference was not found in the local list: it may be made up.
    notFound: 3,

    // The reference was found, but its stored quote does not match the claim.
    notSupported: 3,

    // The stored quote matches only part of the claim (possible overstatement).
    partial: 2,

    // A year before earliestYear or after the current year is unusual for
    // this topic and a typical sign of a fabricated reference.
    implausibleYear: 2,

    // The paste contains more than one citation: it leans on several
    // sources, so there are more chances that one of them is wrong.
    multipleCitations: 1,

    // A long paste (over longPasteChars characters) is more likely to be a
    // generated block of text than a short quote the student chose.
    longPaste: 1,

    // Found and the quote matches: no extra risk.
    foundAndSupported: 0,

    // Found, but support could not be checked (e.g. no keyQuote stored):
    // no extra risk, but it does NOT count as supported either.
    supportUnknown: 0
  },
  longPasteChars: 300,
  earliestYear: 1950,

  // score >= threshold -> "problem" level: the pop-up opens automatically
  threshold: 3
};

// A surname: starts with a capital letter (accents allowed, e.g. "Buçinca"),
// followed by letters, apostrophes or hyphens (e.g. "O'Neil", "Grunde-McLaughlin").
// À-Þ = accented capitals, À-ÿ = accented letters.
const SURNAME = "[A-Z\\u00C0-\\u00DE][A-Za-z\\u00C0-\\u00FF'\\-]+";

// ---------------------------------------------------------------
// Regular expressions
// ---------------------------------------------------------------

// Any bracket group that ends in a 4-digit year, e.g. "(Smith et al., 2021)"
// or "(Smith, 2020; Jones & Lee, 2021)". The group content is captured.
// [^()]* means "any characters except brackets".
const BRACKET_WITH_YEAR = /\(([^()]*\d{4}[a-z]?)\)/g;

// One citation inside a bracket group: "<authors>, <year>".
// Optional "e.g." or "see" at the start is skipped.
// Group 1 = authors text, group 2 = year.
const IN_TEXT_PART = /^\s*(?:e\.g\.,?\s*|see\s+)?(.+?),?\s+(\d{4})[a-z]?\s*$/;

// A reference-list line: "<authors> (<year>). <title>. <venue>."
// Group 1 = authors text, group 2 = year, group 3 = the rest (title + venue).
const REFERENCE_LINE = /^\s*(.+?)\s*\((\d{4})[a-z]?\)\.\s*(.*)$/;

// Inside a reference-list author part, each author is "Surname, I. I."
// e.g. "Skitka, L. J., Mosier, K. L., & Burdick, M."
const SURNAME_WITH_INITIALS = new RegExp("(" + SURNAME + "),\\s+(?:[A-Z]\\.\\s*-?)+", "g");

// ---------------------------------------------------------------
// extractCitations
// ---------------------------------------------------------------
function extractCitations(text) {
  const citations = [];

  // --- 1. In-text citations: (Smith et al., 2021), (Smith & Jones, 2021) ---
  let match;
  BRACKET_WITH_YEAR.lastIndex = 0; // reset, because the regex is global and reused
  while ((match = BRACKET_WITH_YEAR.exec(text)) !== null) {
    const bracketText = match[1];
    const bracketStart = match.index; // position of "("
    const claim = getClaimForPosition(text, bracketStart);

    // A bracket may hold several citations separated by ";"
    const parts = bracketText.split(";");
    let partStart = bracketStart + 1; // first character after "("

    parts.forEach(function (part) {
      const thisPartStart = partStart;
      partStart += part.length + 1; // +1 skips the ";" before the next part

      const partMatch = part.match(IN_TEXT_PART);
      if (!partMatch) {
        return; // e.g. "(2021)" on its own or "(see page 2021)" – not a citation
      }
      const authors = parseInTextAuthors(partMatch[1]);
      if (authors.length === 0) {
        return;
      }

      // Where this citation sits in the pasted text (used to highlight it).
      // A bracket with ONE citation is highlighted including the brackets;
      // with several, each part is highlighted on its own (without spaces).
      let start, end;
      if (parts.length === 1) {
        start = bracketStart;
        end = bracketStart + match[0].length;
      } else {
        start = thisPartStart + (part.length - part.trimStart().length);
        end = thisPartStart + part.trimEnd().length;
      }

      citations.push({
        raw: text.slice(start, end),
        start: start,
        end: end,
        type: "in-text",
        authors: authors,
        year: parseInt(partMatch[2], 10),
        title: "",
        claim: claim
      });
    });
  }

  // --- 2. Reference-list lines: Smith, J. (2021). Title. Venue. ---
  let lineStart = 0; // position of the current line in the whole text
  text.split("\n").forEach(function (line) {
    const thisLineStart = lineStart;
    lineStart += line.length + 1; // +1 for the "\n"

    const lineMatch = line.match(REFERENCE_LINE);
    if (!lineMatch) {
      return;
    }
    const authors = parseReferenceAuthors(lineMatch[1]);
    if (authors.length === 0) {
      return; // no "Surname, I." pattern, so probably an ordinary sentence
    }
    const start = thisLineStart + (line.length - line.trimStart().length);
    const end = thisLineStart + line.trimEnd().length; // trimEnd also drops a Windows "\r"
    citations.push({
      raw: text.slice(start, end),
      start: start,
      end: end,
      type: "reference-list",
      authors: authors,
      year: parseInt(lineMatch[2], 10),
      title: getTitle(lineMatch[3]),
      claim: "" // a reference-list line makes no claim to check
    });
  });

  // Return the citations in the order they appear in the text.
  citations.sort(function (a, b) { return a.start - b.start; });
  return citations;
}

/**
 * "Smith et al." -> ["Smith"]
 * "Smith & Jones" -> ["Smith", "Jones"]
 * "Buçinca, Malaya, & Gajos" -> ["Buçinca", "Malaya", "Gajos"]
 */
function parseInTextAuthors(authorsText) {
  return authorsText
    .replace(/\bet al\.?/g, "")      // drop "et al."
    .split(/,|&|\band\b/)            // split on commas, "&" and "and"
    .map(function (name) { return name.trim(); })
    .filter(function (name) { return new RegExp("^" + SURNAME + "$").test(name); });
}

/** "Skitka, L. J., Mosier, K. L., & Burdick, M." -> ["Skitka", "Mosier", "Burdick"] */
function parseReferenceAuthors(authorsText) {
  const surnames = [];
  let match;
  SURNAME_WITH_INITIALS.lastIndex = 0;
  while ((match = SURNAME_WITH_INITIALS.exec(authorsText)) !== null) {
    surnames.push(match[1]);
  }
  return surnames;
}

/** The title is the text up to the first full stop / question mark / exclamation mark. */
function getTitle(rest) {
  const titleMatch = rest.match(/^(.+?[.?!])(\s|$)/);
  return titleMatch ? titleMatch[1].trim() : rest.trim();
}

/**
 * Finds the sentence that contains position `index` in the text and returns
 * it with all bracketed citations removed. That sentence is the "claim"
 * that the citation is supposed to support.
 *
 * A sentence boundary is ".", "!" or "?" followed by a space and a capital
 * letter, or a line break. ("et al., 2021" is NOT a boundary because "al."
 * is followed by a comma.)
 */
function getClaimForPosition(text, index) {
  const boundary = /[.!?]["')\]]?\s+(?=[A-Z])|\n/g;
  let start = 0;
  let end = text.length;
  let match;

  while ((match = boundary.exec(text)) !== null) {
    const boundaryEnd = match.index + match[0].length;
    if (boundaryEnd <= index) {
      start = boundaryEnd;          // this boundary is before the citation
    } else {
      end = match.index + 1;        // first boundary after the citation
      break;
    }
  }

  return text
    .slice(start, end)
    .replace(/\([^()]*\d{4}[a-z]?\)/g, "") // remove the citations themselves
    .replace(/\s+/g, " ")                  // collapse repeated spaces
    .replace(/\s+([.,;:!?])/g, "$1")       // no space before punctuation
    .trim();
}

// ---------------------------------------------------------------
// riskScore
// ---------------------------------------------------------------

/**
 * Scores ONE citation from its lookup and support results plus two
 * signals about the paste it came from.
 * Must be called AFTER lookupReference() and checkSupport(), because it
 * reads citation.existence and citation.support.
 *
 *   citation       – a citation object with .existence, .support and .year
 *   pasteText      – the whole pasted text (for the long-paste signal)
 *   citationCount  – how many citations were in the same paste
 *
 * Returns { score, threshold, reasons } where reasons lists every signal
 * that fired (shown under "Why was this flagged?" in the pop-up).
 */
function riskScore(citation, pasteText, citationCount) {
  const weights = DETECTOR_CONFIG.weights;
  const currentYear = new Date().getFullYear();
  let score = 0;
  const reasons = [];

  // Small helper: add points and remember why.
  function addSignal(points, description) {
    score += points;
    reasons.push(description + " (+" + points + ")");
  }

  // Result of the existence check
  if (citation.existence === "not_found") {
    addSignal(weights.notFound, "Reference not found in the local list");
  }

  // Result of the support check (only meaningful if the reference was found)
  if (citation.existence === "found") {
    if (citation.support === "not_supported") {
      addSignal(weights.notSupported, "Stored quote does not match the claim");
    } else if (citation.support === "partial") {
      addSignal(weights.partial, "Stored quote only partly matches the claim");
    } else if (citation.support === "supported") {
      addSignal(weights.foundAndSupported, "Found and the stored quote matches the claim");
    } else {
      addSignal(weights.supportUnknown, "Found, but support could not be checked");
    }
  }

  // Implausible year
  if (citation.year < DETECTOR_CONFIG.earliestYear || citation.year > currentYear) {
    addSignal(weights.implausibleYear, "Year outside " + DETECTOR_CONFIG.earliestYear + "–" + currentYear);
  }

  // Signals about the whole paste
  if (citationCount > 1) {
    addSignal(weights.multipleCitations, "More than one citation in this paste");
  }
  if (pasteText.length > DETECTOR_CONFIG.longPasteChars) {
    addSignal(weights.longPaste, "Long paste, over " + DETECTOR_CONFIG.longPasteChars + " characters");
  }

  return {
    score: score,
    threshold: DETECTOR_CONFIG.threshold,
    reasons: reasons
  };
}

/**
 * Decides how strongly to interrupt the student for one citation:
 *   "problem"          – score >= threshold: strong highlight, pop-up opens automatically
 *   "likely-supported" – below threshold AND found AND supported: soft green underline, no pop-up
 *   "quiet"            – anything else below threshold (e.g. support unknown):
 *                        subtle underline, pop-up only if clicked
 * In all three cases the citation still counts as unverified until the
 * student presses Verify.
 */
function decideInterruptionLevel(citation, risk) {
  if (risk.score >= risk.threshold) {
    return "problem";
  }
  if (citation.existence === "found" && citation.support === "supported") {
    return "likely-supported";
  }
  return "quiet";
}
