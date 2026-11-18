/*
 * lookup.js
 * SIMULATED: checks against local data, not a live database
 *
 * Public functions (used by app.js):
 *   findReference(citation)            -> the matching entry from REFERENCES, or null
 *   findByAuthorYear(citation)         -> match on first author + year only (or null)
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
  minWordLength: 3,        // ignore very short words like "ai", "is"

  // Title fallback: proportion of a stored title's main words that must
  // appear in a reference-list line for it to count as the same paper.
  titleMatchThreshold: 0.6
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
 * Finds the matching entry in REFERENCES, or null.
 *   1. First try: same FIRST author and same year.
 *   2. Fallback (reference-list lines only): enough of the stored title's
 *      main words appear in the cited title (see findByTitle).
 * TODO(me): improve matching
 *   (e.g. allow small typos, handle two different papers by the same
 *    first author in the same year)
 */
function findReference(citation) {
  return findByAuthorYear(citation) || findByTitle(citation);
}

/** Step 1: same first author (ignoring case and accents) and same year. */
function findByAuthorYear(citation) {
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

/**
 * Step 2 (fallback): only for reference-list lines, which include a title.
 * For each stored reference, take the main words of its title (keywords,
 * see extractKeywords) and work out what proportion of them appear in the
 * cited line's title + venue text. The best match at or above
 * LOOKUP_CONFIG.titleMatchThreshold is returned.
 * We search the title AND venue text because our simple title extraction
 * stops at the first "?" or ".", which cuts titles like
 * "Does the whole exceed its parts? The effect of ..." in half.
 */
function findByTitle(citation) {
  if (citation.type !== "reference-list" || !citation.titleAndVenue) {
    return null;
  }
  const citedWords = extractKeywords(citation.titleAndVenue);

  let bestReference = null;
  let bestProportion = 0;
  REFERENCES.forEach(function (reference) {
    const titleWords = extractKeywords(reference.title);
    if (titleWords.length === 0) {
      return;
    }
    const matched = titleWords.filter(function (word) {
      return citedWords.indexOf(word) !== -1;
    });
    const proportion = matched.length / titleWords.length;
    if (proportion >= LOOKUP_CONFIG.titleMatchThreshold && proportion > bestProportion) {
      bestReference = reference;
      bestProportion = proportion;
    }
  });
  return bestReference;
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
 * Very simple stemming, so that e.g. "explanations" and "explanation" are
 * compared as the same word:
 *   - words of 3 letters or fewer are left alone ("has", "bus")
 *   - "es" is only stripped after s, x, ch or sh ("processes" -> "process",
 *     "boxes" -> "box", "approaches" -> "approach")
 *   - otherwise a single "s" is stripped ("makes" -> "make",
 *     "reduces" -> "reduce"), but not from words ending in "ss"
 *     ("process" stays "process")
 *
 * This is DELIBERATELY simple: it does not know English grammar, so some
 * words are still cut oddly (e.g. "analysis" -> "analysi"). That is
 * harmless as long as both sides are cut the same way.
 * PLANNED: proper stemming (e.g. the Porter stemmer) or semantic / LLM-based
 * matching of the claim against the source.
 */
function stemWord(w) {
  if (w.length <= 3) return w;
  if (/(s|x|ch|sh)es$/.test(w)) return w.slice(0, -2); // processes → process
  if (w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1); // makes → make
  return w; // process stays process
}

/** Stems a list of keywords and removes duplicates created by stemming. */
function stemKeywords(words) {
  const stems = [];
  words.forEach(function (word) {
    const stem = stemWord(word);
    if (stems.indexOf(stem) === -1) {
      stems.push(stem);
    }
  });
  return stems;
}

/**
 * Estimates whether the reference's keyQuote supports the claim by
 * measuring what proportion of the claim's keywords also appear in the quote.
 * Both sides are stemmed first (see stemWord).
 * Returns "unknown" when there is nothing to compare.
 */
function checkSupport(claimText, reference) {
  if (!reference || !reference.keyQuote) {
    return "unknown"; // reference not found, or no keyQuote stored yet
  }

  const claimWords = stemKeywords(extractKeywords(claimText || ""));
  if (claimWords.length === 0) {
    return "unknown"; // e.g. a reference-list line with no claim attached
  }

  const quoteWords = stemKeywords(extractKeywords(reference.keyQuote));
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
