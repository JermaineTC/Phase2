/*
 * detector.js – finds citations in pasted text and decides whether
 * the paste is worth flagging.
 *
 * Public functions (used by app.js):
 *   extractCitations(text)        -> array of citation objects
 *   riskScore(text, citations)    -> { score, threshold, flagged, reasons }
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
// TODO(me): tune weights and justify in rationale
// ---------------------------------------------------------------
const DETECTOR_CONFIG = {
  weights: {
    // The paste contains at least one citation. This is the core signal:
    // the system is about verifying references, so text without any
    // citations has nothing to check.
    containsCitation: 3,

    // More than one citation: the paste leans on several sources, so
    // there are more chances that one of them is wrong or made up.
    multipleCitations: 1,

    // A long paste (over longPasteChars characters) is more likely to be
    // a generated block of text than a short quote the student chose.
    longPaste: 1,

    // A citation year before earliestYear or after the current year is
    // unusual for this topic and a typical sign of a fabricated reference.
    implausibleYear: 2
  },
  longPasteChars: 300,
  earliestYear: 1950,
  threshold: 3 // flag the paste if score >= threshold
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
 * Adds up simple signals to decide whether a paste should be flagged.
 * Returns the score, the threshold, whether it was flagged, and a list
 * of human-readable reasons (shown in the pop-up for transparency).
 */
function riskScore(text, citations) {
  const weights = DETECTOR_CONFIG.weights;
  const currentYear = new Date().getFullYear();
  let score = 0;
  const reasons = [];

  if (citations.length > 0) {
    score += weights.containsCitation;
    reasons.push("Contains a citation (+" + weights.containsCitation + ")");
  }

  if (citations.length > 1) {
    score += weights.multipleCitations;
    reasons.push("More than one citation (+" + weights.multipleCitations + ")");
  }

  if (text.length > DETECTOR_CONFIG.longPasteChars) {
    score += weights.longPaste;
    reasons.push("Long paste, over " + DETECTOR_CONFIG.longPasteChars + " characters (+" + weights.longPaste + ")");
  }

  const hasImplausibleYear = citations.some(function (citation) {
    return citation.year < DETECTOR_CONFIG.earliestYear || citation.year > currentYear;
  });
  if (hasImplausibleYear) {
    score += weights.implausibleYear;
    reasons.push("Year outside " + DETECTOR_CONFIG.earliestYear + "–" + currentYear + " (+" + weights.implausibleYear + ")");
  }

  return {
    score: score,
    threshold: DETECTOR_CONFIG.threshold,
    flagged: score >= DETECTOR_CONFIG.threshold,
    reasons: reasons
  };
}
