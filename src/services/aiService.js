// TIRAS CRM — AI Service
// Powered by Google Gemini 1.5 Flash — free tier, no cost at early scale
//
// SETUP REQUIRED:
//   No SDK install needed — uses native fetch to hit Gemini REST endpoint
//   Add to your .env file:
//     REACT_APP_GEMINI_API_KEY=your_gemini_api_key
//
//   Get your free API key at: https://aistudio.google.com/app/apikey
//   Free tier limits: 15 requests/min, 1500 requests/day — more than enough for Phase 1
//
// WHAT THIS FILE DOES:
//   1. generateCallSummary()     — 3-line plain English summary of a sales call
//   2. tagObjection()            — reads summary, tags main objection raised
//   3. suggestNextAction()       — recommends best next step for the agent
//   4. scoreLeadTemperature()    — Hot / Warm / Cold / Dead based on call data
//   5. generateFollowUpMessage() — drafts a WhatsApp follow-up message
//   All results saved back to the call document in Firestore

import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db, COLLECTIONS } from "../firebase";

// ─── Config ──────────────────────────────────────────────────────────────────

const GEMINI_API_KEY = process.env.REACT_APP_GEMINI_API_KEY;
const GEMINI_MODEL = "gemini-1.5-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

// Valid objection tags — must match master doc Section 8 exactly
const VALID_OBJECTION_TAGS = [
  "Price",
  "Timing",
  "Not Interested",
  "Need More Info",
  "Wrong Person",
  "No Objection",
];

// Valid call outcomes for validation
const VALID_OUTCOMES = [
  "Interested",
  "Not Interested",
  "Call Back",
  "No Answer",
  "Wrong Number",
  "Busy",
  "Voicemail",
];

// ─── Core fetch wrapper ───────────────────────────────────────────────────────
// Sends a prompt to Gemini and returns raw text response
// All higher-level functions call this

const callGemini = async (prompt, maxTokens = 400) => {
  if (!GEMINI_API_KEY) {
    throw new Error(
      "REACT_APP_GEMINI_API_KEY is not set. Add it to your .env file. Get a free key at https://aistudio.google.com/app/apikey"
    );
  }

  const requestBody = {
    contents: [
      {
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      maxOutputTokens: maxTokens,
      temperature: 0.3,        // Low temperature = consistent, factual output — not creative
      topP: 0.8,
      topK: 10,
    },
    safetySettings: [
      // Relax safety filters — sales call content is professional, not harmful
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" },
    ],
  };

  const response = await fetch(GEMINI_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${errorBody}`);
  }

  const data = await response.json();

  // Extract text from Gemini response structure
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error("Gemini returned empty response. Check API quota at https://aistudio.google.com");
  }

  return text.trim();
};

// ─── parseJSON (safe) ────────────────────────────────────────────────────────
// Gemini sometimes wraps JSON in markdown fences — strips them before parsing

const parseGeminiJSON = (raw) => {
  try {
    // Remove ```json ... ``` or ``` ... ``` wrappers if present
    const cleaned = raw
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
    return JSON.parse(cleaned);
  } catch (err) {
    console.error("TIRAS AI: Failed to parse Gemini JSON response:", raw);
    return null;
  }
};

// ─── generateCallSummary ──────────────────────────────────────────────────────
// Main function — called after every sales call ends
// Produces 3-line summary, objection tag, and next action recommendation
//
// @param callDocId      string   Firestore call document ID
// @param callNotes      string   Agent's manual notes typed during/after the call
// @param leadName       string   Lead's full name
// @param callDuration   number   Duration in seconds
// @param callOutcome    string   One of VALID_OUTCOMES
// @param companyName    string   Company the lead works at (optional context)
//
// @returns  { summary, objectionTag, suggestedNextAction } | null on error

export const generateCallSummary = async ({
  callDocId,
  callNotes = "",
  leadName = "the lead",
  callDuration = 0,
  callOutcome = "Unknown",
  companyName = "",
}) => {
  if (!callDocId) {
    console.error("TIRAS AI: generateCallSummary requires callDocId");
    return null;
  }

  const durationMinutes = Math.floor(callDuration / 60);
  const durationSeconds = callDuration % 60;
  const durationText =
    callDuration >= 60
      ? `${durationMinutes} minute${durationMinutes !== 1 ? "s" : ""} ${durationSeconds} seconds`
      : `${callDuration} seconds`;

  const prompt = `
You are an AI assistant for TIRAS CRM, a sales CRM used by Indian small and medium businesses.

A sales agent just completed a call with ${leadName}${companyName ? ` from ${companyName}` : ""}.

Call details:
- Duration: ${durationText}
- Outcome tagged by agent: ${callOutcome}
- Agent notes: ${callNotes || "No notes provided by agent"}

Your task: Respond ONLY with a valid JSON object. No explanation, no markdown, no preamble. Just the JSON.

The JSON must have exactly these 3 keys:

{
  "summary": "3 sentences in plain English summarising what happened in this call. Be specific and factual. Do not use filler words. Write as if briefing the sales manager.",
  "objectionTag": "exactly one of: Price, Timing, Not Interested, Need More Info, Wrong Person, No Objection",
  "suggestedNextAction": "one clear, specific action the agent should take next. Example: Schedule a product demo for next Tuesday. Or: Send pricing brochure on WhatsApp today."
}

Rules:
- summary must be exactly 3 sentences, each ending with a period
- objectionTag must be exactly one of the 6 options listed — no variations
- suggestedNextAction must be a single actionable sentence
- If call duration is under 30 seconds, assume the call was not connected or very brief
- Write for an Indian business context
- Do not mention you are an AI
`;

  try {
    const raw = await callGemini(prompt, 300);
    const parsed = parseGeminiJSON(raw);

    if (!parsed || !parsed.summary || !parsed.objectionTag || !parsed.suggestedNextAction) {
      throw new Error("Gemini response missing required fields");
    }

    // Validate objectionTag is one of the allowed values
    const validatedTag = VALID_OBJECTION_TAGS.includes(parsed.objectionTag)
      ? parsed.objectionTag
      : "Need More Info";

    const result = {
      summary: parsed.summary,
      objectionTag: validatedTag,
      suggestedNextAction: parsed.suggestedNextAction,
    };

    // Save to Firestore call document
    await updateDoc(doc(db, COLLECTIONS.CALLS, callDocId), {
      aiSummary: result.summary,
      objectionTag: result.objectionTag,
      suggestedNextAction: result.suggestedNextAction,
      aiSummaryPending: false,
      aiSummaryGeneratedAt: serverTimestamp(),
    });

    console.log("TIRAS AI: Summary generated and saved for call:", callDocId);
    return result;

  } catch (err) {
    console.error("TIRAS AI: generateCallSummary failed:", err);

    // Save error state to Firestore so UI can show fallback
    try {
      await updateDoc(doc(db, COLLECTIONS.CALLS, callDocId), {
        aiSummaryPending: false,
        aiSummaryError: err.message,
      });
    } catch (dbErr) {
      console.error("TIRAS AI: Failed to save error state:", dbErr);
    }

    return null;
  }
};

// ─── scoreLeadTemperature (AI-enhanced) ──────────────────────────────────────
// Phase 1 uses duration-based scoring (done in plivoService)
// This function adds AI context on top — reads notes + outcome for smarter score
// Call this when you want to OVERRIDE the duration-based score with AI judgment
//
// @returns  "Hot" | "Warm" | "Cold" | "Dead"

export const scoreLeadTemperature = async ({
  callDocId,
  callNotes = "",
  callDuration = 0,
  callOutcome = "",
  totalCallAttempts = 1,
  totalAnsweredCalls = 1,
}) => {
  // Rule-based fast path (no API call needed) — master doc rules
  if (callOutcome === "No Answer" && totalCallAttempts >= 3) {
    return "Dead";
  }
  if (callOutcome === "Not Interested" && callDuration < 60) {
    return "Cold";
  }
  if (callOutcome === "Interested") {
    return callDuration >= 180 ? "Hot" : "Warm";
  }

  // If notes exist, use AI for nuanced scoring
  if (callNotes && callNotes.length > 20) {
    const prompt = `
You are a sales lead scoring assistant for an Indian B2B CRM.

Call details:
- Duration: ${callDuration} seconds
- Outcome: ${callOutcome}
- Attempts made: ${totalCallAttempts}
- Calls answered: ${totalAnsweredCalls}
- Agent notes: ${callNotes}

Based on this, assign a temperature score to this lead.
Respond with ONLY one word — exactly one of: Hot, Warm, Cold, Dead
No explanation. No punctuation. Just the one word.

Hot = strong buying signal, long engaged call, asking about pricing or next steps
Warm = some interest shown, willing to talk, needs more info
Cold = short call, no clear interest, said to call later
Dead = no answer multiple times, said not interested, wrong number
`;

    try {
      const raw = await callGemini(prompt, 10);
      const score = raw.trim().replace(/[^A-Za-z]/g, "");

      if (["Hot", "Warm", "Cold", "Dead"].includes(score)) {
        if (callDocId) {
          await updateDoc(doc(db, COLLECTIONS.CALLS, callDocId), {
            temperature: score,
          });
        }
        return score;
      }
    } catch (err) {
      console.error("TIRAS AI: scoreLeadTemperature failed, using rule-based fallback:", err);
    }
  }

  // Duration-based fallback (same as plivoService — always safe)
  if (callDuration >= 180) return "Hot";
  if (callDuration >= 60) return "Warm";
  return "Cold";
};

// ─── generateFollowUpMessage ──────────────────────────────────────────────────
// Drafts a personalised WhatsApp follow-up message for the agent to send
// Agent can edit before sending — this is a draft, not auto-sent
//
// @param leadName       string   Lead's name
// @param callSummary    string   AI summary from generateCallSummary
// @param objectionTag   string   The tagged objection
// @param agentName      string   Agent's name (for sign-off)
// @param templateType   string   "followup" | "introduction" | "payment_reminder" | "thank_you"
//
// @returns  string   The drafted WhatsApp message

export const generateFollowUpMessage = async ({
  leadName = "Sir/Ma'am",
  callSummary = "",
  objectionTag = "",
  agentName = "Team TIRAS",
  templateType = "followup",
}) => {
  const templateInstructions = {
    followup: "Write a polite WhatsApp follow-up message referencing your last conversation.",
    introduction: "Write a brief, professional introduction WhatsApp message for a first contact.",
    payment_reminder: "Write a polite payment reminder WhatsApp message. Be firm but respectful.",
    thank_you: "Write a thank you WhatsApp message after closing a deal.",
  };

  const instruction = templateInstructions[templateType] || templateInstructions.followup;

  const prompt = `
You are a sales assistant writing WhatsApp messages for an Indian sales agent.

Context:
- Lead name: ${leadName}
- Last call summary: ${callSummary || "First contact"}
- Main concern raised: ${objectionTag || "None noted"}
- Agent name: ${agentName}
- Task: ${instruction}

Write a WhatsApp message that:
- Starts with a greeting using the lead's first name
- Is 3–5 sentences maximum — short enough for WhatsApp
- Sounds natural, warm, and professional — not corporate or robotic
- Is written in simple Indian business English (not overly formal)
- Ends with agent's name
- Does NOT use emojis unless they feel natural
- Addresses the objection subtly if one was raised

Return ONLY the message text. No explanation. No label. Just the WhatsApp message.
`;

  try {
    const message = await callGemini(prompt, 200);
    return message;
  } catch (err) {
    console.error("TIRAS AI: generateFollowUpMessage failed:", err);
    // Return a sensible fallback template
    return `Hi ${leadName},\n\nThank you for speaking with us. I wanted to follow up on our recent conversation and answer any questions you may have.\n\nLooking forward to hearing from you.\n\nBest regards,\n${agentName}`;
  }
};

// ─── analyzeBatchCallPatterns ─────────────────────────────────────────────────
// Manager-level feature — analyzes patterns across multiple calls for a lead
// Suggests best time to call based on when lead has answered in the past
//
// @param callHistory  Array of call objects from Firestore
// @param leadName     string
//
// @returns { bestCallTime, pattern, recommendation }

export const analyzeBatchCallPatterns = async (callHistory = [], leadName = "the lead") => {
  if (callHistory.length < 2) {
    return {
      bestCallTime: "Morning (10AM–12PM)",
      pattern: "Not enough call history to detect a pattern",
      recommendation: "Try calling between 10AM–12PM on weekdays",
    };
  }

  // Extract answered calls and their times
  const answeredCalls = callHistory.filter(
    (c) => c.status === "terminated" && c.duration > 10
  );

  if (answeredCalls.length === 0) {
    return {
      bestCallTime: "Morning (10AM–12PM)",
      pattern: "Lead has not answered any calls yet",
      recommendation: "Try a different time — morning calls have highest pickup rates in India",
    };
  }

  // Format call history for prompt
  const callData = callHistory
    .slice(0, 10) // Last 10 calls max — keep prompt short
    .map((c) => {
      const time = c.initiatedAt?.toDate?.()?.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }) || "Unknown time";
      const day = c.initiatedAt?.toDate?.()?.toLocaleDateString("en-IN", {
        weekday: "long",
      }) || "Unknown day";
      return `- ${day} at ${time}: ${c.status === "terminated" && c.duration > 10 ? `Answered (${Math.round(c.duration / 60)} min)` : "Not answered"}`;
    })
    .join("\n");

  const prompt = `
You are analyzing call patterns for a sales CRM to help agents call leads at the best time.

Lead: ${leadName}
Call history (most recent first):
${callData}

Based on this data, respond with ONLY a valid JSON object:
{
  "bestCallTime": "one specific time window e.g. Tuesday and Thursday mornings between 10AM–12PM",
  "pattern": "one sentence describing what pattern you noticed in when this lead answers",
  "recommendation": "one specific, actionable suggestion for the agent"
}

No explanation. No markdown. Just the JSON.
`;

  try {
    const raw = await callGemini(prompt, 200);
    const parsed = parseGeminiJSON(raw);
    if (parsed && parsed.bestCallTime) return parsed;
    throw new Error("Invalid response structure");
  } catch (err) {
    console.error("TIRAS AI: analyzeBatchCallPatterns failed:", err);
    return {
      bestCallTime: "Morning (10AM–12PM)",
      pattern: "Could not analyze pattern at this time",
      recommendation: "Morning calls between 10AM–12PM typically have the best pickup rates",
    };
  }
};

// ─── isAIConfigured ──────────────────────────────────────────────────────────
// Quick check — use in UI to show/hide AI features gracefully if key is missing

export const isAIConfigured = () => {
  return !!(GEMINI_API_KEY && GEMINI_API_KEY.length > 10);
};

export default {
  generateCallSummary,
  scoreLeadTemperature,
  generateFollowUpMessage,
  analyzeBatchCallPatterns,
  isAIConfigured,
};
