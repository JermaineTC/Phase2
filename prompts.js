/*
 * prompts.js – all the wording shown in the pop-up, kept in one place
 * so it can be changed without touching the logic in app.js.
 *
 * TODO(me): refine wording
 *
 * "label"    = short result line shown for each citation
 * "question" = prompting question shown under the citation ("" = none)
 */
const PROMPTS = {
  title: "Check the references in this paste",

  // Shown at the top of every pop-up so the student knows the check is not real.
  simulatedNote:
    "Simulated check: references are compared with a small local list, not a live database. " +
    "\"Not found\" does not prove a reference is fake, and \"found\" does not prove it is correct.",

  // Shown when a paste was flagged but no citations were detected
  // (only possible if the risk weights in detector.js are changed).
  noCitations: "No citations were detected, but this paste was flagged by other signals.",

  // Result of lookupReference()
  existence: {
    found: {
      label: "Found in the local reference list (simulated)",
      question: ""
    },
    not_found: {
      label: "Not found in the local reference list (simulated)",
      question: "We couldn't find this reference. Where did it come from – did you open the source yourself?"
    }
  },

  // Result of checkSupport()
  support: {
    supported: {
      label: "The stored quote from this source matches the claim",
      question: ""
    },
    partial: {
      label: "The stored quote only partly matches the claim",
      question: "This source only partly matches the claim. Does it actually say this, or is this your interpretation?"
    },
    not_supported: {
      label: "The stored quote does not match the claim",
      question: "The source doesn't seem to say this. Which part of the paper are you relying on?"
    },
    unknown: {
      label: "Support not checked (no stored quote or no claim to compare)",
      question: ""
    }
  },

  // Human-readable names for each paste status
  status: {
    "unverified": "Not yet verified",
    "not-found": "Not yet verified – a reference was not found",
    "verified": "You marked this as verified",
    "dismissed": "You dismissed this check"
  },

  // Text for the Undo message after Dismiss
  dismissedToast: "Check dismissed."
};
