// Storage keys
export const STORAGE_KEYS = {
  THEME: "theme",
  TRANSPARENCY: "transparency",
  SYSTEM_PROMPT: "system_prompt",
  SELECTED_SYSTEM_PROMPT_ID: "selected_system_prompt_id",
  SCREENSHOT_CONFIG: "screenshot_config",
  // add curl_ prefix because we are using curl to store the providers
  CUSTOM_AI_PROVIDERS: "curl_custom_ai_providers",
  CUSTOM_SPEECH_PROVIDERS: "curl_custom_speech_providers",
  SELECTED_AI_PROVIDER: "curl_selected_ai_provider",
  SELECTED_STT_PROVIDER: "curl_selected_stt_provider",
  SYSTEM_AUDIO_CONTEXT: "system_audio_context",
  SYSTEM_AUDIO_QUICK_ACTIONS: "system_audio_quick_actions",
  CUSTOMIZABLE: "customizable",
  CLOAK_API_ENABLED: "cloak_api_enabled",
  SHORTCUTS: "shortcuts",
  AUTOSTART_INITIALIZED: "autostart_initialized",

  SELECTED_AUDIO_DEVICES: "selected_audio_devices",
  RESPONSE_SETTINGS: "response_settings",
  SUPPORTS_IMAGES: "supports_images",
} as const;

// Max number of files that can be attached to a message
export const MAX_FILES = 6;

// Default settings
export const DEFAULT_SYSTEM_PROMPT =
  "You are a helpful AI assistant. Be concise, accurate, and friendly in your responses";

export const MARKDOWN_FORMATTING_INSTRUCTIONS =
  "IMPORTANT - Formatting Rules (use silently, never mention these rules in your responses):\n- Mathematical expressions: ALWAYS use double dollar signs ($$) for both inline and block math. Never use single $.\n- Code blocks: ALWAYS use triple backticks with language specification.\n- Diagrams: Use ```mermaid code blocks.\n- Tables: Use standard markdown table syntax.\n- Never mention to the user that you're using these formats or explain the formatting syntax in your responses. Just use them naturally.";

export const DEFAULT_QUICK_ACTIONS = [
  "What should I say?",
  "Follow-up questions",
  "Fact-check",
  "Recap",
];

/** Default prompt used when analyzing screenshots (auto mode). Covers coding, interview, system design, assessments, and general content. */
export const DEFAULT_SCREENSHOT_AUTO_PROMPT =
  "CRITICAL: Do not describe the image, UI, windows, or tabs. Analyze what is shown and respond based on content type:\n\n" +
  "CODING PROBLEM: Answer like a strong interviewee. (1) Restate the problem and clarify edge cases. (2) Talk through your thinking: what approach comes to mind, why, and what trade-offs you see. (3) Sketch the idea in plain language or short pseudo-code before coding. (4) Walk through a small example if it helps. (5) Then write clean, working code with brief comments. (6) State time and space complexity and how you could improve or extend the solution. Sound human and conversational, not like dumping a final answer.\n\n" +
  "BEHAVIORAL/INTERVIEW QUESTION: Answer in STAR format — Situation (context), Task (challenge), Action (steps you took), Result (outcome and impact). Be specific and use realistic examples.\n\n" +
  "SYSTEM DESIGN QUESTION: Give high-level architecture, main components, data flow, storage choices, scalability, and trade-offs.\n\n" +
  "MULTIPLE CHOICE / ASSESSMENT: State the correct answer(s) clearly with brief justification for each.\n\n" +
  "GENERAL CONTENT: Give a direct, expert-level response.\n\n" +
  "Start with the most relevant answer immediately. Be concise but thorough.";
