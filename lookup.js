/*
 * lookup.js
 * SIMULATED: checks against local data, not a live database
 *
 * Public functions (used by app.js):
 *   findReference(citation)            -> the matching entry from REFERENCES, or null
 *   lookupReference(citation)          -> "found" | "not_found"
 *   checkSupport(claimText, reference) -> "supported" | "partial" | "not_supported" | "unknown"
 *
 * Depends on REFERENCES from references.js (must be loaded first).
 */

// ---------------------------------------------------------------
// Configuration for the support check
// ---------------------------------------------------------------
const LOOKUP_CONFIG = {
  // Proportion of the claim's keywords that must appear in the keyQuote.
  supportedThreshold: 0.6, // 60% or more -> "supported"
  partialThreshold: 0.3,   // 30% to 59%  -> "partial", below -> "not_supported"
  minWordLength: 3         // ignore very short words like "ai", "is"
};

// Common words that carry little meaning, so they are ignored when
// comparing a claim with a quote.
const STOPWORDS = [
  "the", "and", "for", "are", "was", "were", "with", "that", "this", "these",
  "those", "from", "into", "than", "then", "they", "their", "them", "there",
  "have", "has", "had", "not", "but", "can", "could", "would", "should", "may",
  "might", "will", "also", "such", "which", "who", "whom", "what", "when",
  "where", "while", "how", "all", "any", "each", "both", "more", "most",
  "other", "some", "its", "our", "your", "his", "her", "been", "being",
  "does", "did", "doing", "very", "only", "over", "under", "about", "between",
  "through", "using", "used", "use", "one", "two", "found", "show", "shows",
  "showed", "study", "studies", "paper", "authors", "et", "al"
];

// ---------------------------------------------------------------
// Existence check
// ---------------------------------------------------------------

/**
 * Makes surnames comparable: lowercase and without accents,
 * so "Buçinca" and "Bucinca" are treated as the same name.
 */
function normaliseName(name) {
  return name
    .normalize("NFD")                 // split "ç" into "c" + accent mark
    .replace(/[\u0300-\u036f]/g, "")  // remove the accent marks
    .toLowerCase()
    .trim();
}

/**
 * Finds the entry in REFERENCES whose FIRST author and year match the citation.
 * TODO(me): improve matching
 *   (e.g. also compare titles for reference-list lines, allow small typos,
 *    handle two different papers by the same first author in the same year)
 */
function findReference(citation) {
  if (!citation.authors || citation.authors.length === 0) {
    return null;
  }
  const citedFirstAuthor = normaliseName(citation.authors[0]);

  for (let i = 0; i < REFERENCES.length; i++) {
    const reference = REFERENCES[i];
    const sameYear = reference.year === citation.year;
    const sameFirstAuthor = normaliseName(reference.authors[0]) === citedFirstAuthor;
    if (sameYear && sameFirstAuthor) {
      return reference;
    }
  }
  return null;
}

/** "found" if the citation matches an entry in the local list, otherwise "not_found". */
function lookupReference(citation) {
  return findReference(citation) ? "found" : "not_found";
}

// ---------------------------------------------------------------
// Support check (keyword overlap)
// ---------------------------------------------------------------

/**
 * Turns text into a list of unique, meaningful lowercase words.
 * "AI explanations improve team performance." ->
 *   ["explanations", "improve", "team", "performance"]
 */
function extractKeywords(text) {
  const words = text
    .toLowerCase()
    .split(/[^a-z0-9\u00e0-\u00ff]+/); // split on anything that is not a letter/digit

  const keywords = [];
  words.forEach(function (word) {
    const longEnough = word.length >= LOOKUP_CONFIG.minWordLength;
    const isStopword = STOPWORDS.indexOf(word) !== -1;
    const alreadyAdded = keywords.indexOf(word) !== -1;
    if (longEnough && !isStopword && !alreadyAdded) {
      keywords.push(word);
    }
  });
  return keywords;
}

/**
 * Estimates whether the reference's keyQuote supports the claim by
 * measuring what proportion of the claim's keywords also appear in the quote.
 * Returns "unknown" when there is nothing to compare.
 */
function checkSupport(claimText, reference) {
  if (!reference || !reference.keyQuote) {
    return "unknown"; // reference not found, or no keyQuote stored yet
  }

  const claimWords = extractKeywords(claimText || "");
  if (claimWords.length === 0) {
    return "unknown"; // e.g. a reference-list line with no claim attached
  }

  const quoteWords = extractKeywords(reference.keyQuote);
  const matchedWords = claimWords.filter(function (word) {
    return quoteWords.indexOf(word) !== -1;
  });
  const overlap = matchedWords.length / claimWords.length;

  if (overlap >= LOOKUP_CONFIG.supportedThreshold) {
    return "supported";
  }
  if (overlap >= LOOKUP_CONFIG.partialThreshold) {
    return "partial";
  }
  return "not_supported";
}
