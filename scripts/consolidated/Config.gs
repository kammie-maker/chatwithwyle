// ============================================================
// Config.gs — Shared configuration for all Wyle pipelines
// ============================================================

var CONFIG = {
  // Folder IDs
  KB_OUTPUT_FOLDER: "1CycqtO4_O3KJ09C6r605Z_5j6783rtSv",
  FATHOM_SOURCE_FOLDER: "1nj_D_iknk3qBBNOPh6UEnjBXWpCXIp4U",
  SALES_FOLDER: "11gcctGdz6Suihwshoao-GUgmc6P1R4H3",

  // File IDs
  MASTER_PROMPT_FILE: "1IjtO_gdiK2-lFevZ66E6KRTuzy-J89xp",

  // File names (standardized)
  COMPILED_MASTER: "COMPILED-MasterPrompt.md",
  PERSONA: "Persona-Wyle.md",
  MANUAL_UPDATES: "KB-ManualUpdates.md",
  REWRITE_LOG: "LOG.md",
  PROCESSING_LOG: "LOG.md",
  FEED_BRAND_VOICE: "FEED-BrandVoice.md",
  FEED_STR_INSIGHTS: "FEED-STRInsights.md",

  // KB doc names
  KB_DOCS: {
    fulfillment: "KB-FulfillmentCalls.md",
    sales: "KB-SalesCalls.md",
    training: "KB-TrainingCalls.md",
    unsorted: "KB-UnsortedCalls.md",
    marketIntelligence: "KB-MarketIntelligence.md",
    operations: "KB-Operations.md",
    pricing: "KB-Pricing.md",
    systems: "KB-Systems.md",
    trainingDocs: "KB-Training.md",
    businessContext: "KB-BusinessContext.md",
    caseStudies: "KB-CaseStudies.md",
    manualUpdates: "KB-ManualUpdates.md"
  },

  // Known Freewyld team members
  KNOWN_REPS: ["mariano", "jaydon", "eric", "jasper", "kaye"],

  // Context tags
  CONTEXT_TAGS: [
    "objection-handling", "closing-technique", "talk-track",
    "market-data", "process", "pricing", "guarantee",
    "client-success", "fulfillment", "onboarding",
    "brand-voice", "case-study", "training"
  ],

  // Timing
  SLEEP_MS: 30000,
  MAX_RUN_MS: 270000,

  // Source folders for InsightDocs
  INSIGHT_FOLDERS: [
    { name: "Market Intelligence", id: "13zejUiLfi-eu-5S-jzMm5ixuY2zE7zfp" },
    { name: "Operations & Onboarding", id: "11kMFomi3QnPN0l4MpC_6VgZXWkXtAfDS" },
    { name: "Pricing & Contracts", id: "12f3jchtDySabTcSmarGqwtOgT9auw_N9" },
    { name: "Systems & Processes", id: "1C806YrDrsNCnYExA_6FdDqFYEfdKv331" },
    { name: "Training & Education", id: "1naEmfgMjztcBf0F9yAEFbPLcob0j6rap" }
  ],

  // Podcast
  PODCAST_URL: "https://freewyldfoundry.com/podcast",
  SITE_PAGES: [
    "https://freewyldfoundry.com",
    "https://freewyldfoundry.com/about",
    "https://freewyldfoundry.com/services",
    "https://freewyldfoundry.com/rpm"
  ],

  // Fathom call types
  CALL_TYPES: ["fulfillment", "sales", "training", "unsorted"],

  // KB docs for master prompt compilation
  COMPILE_DOCS: [
    "KB-MarketIntelligence.md",
    "KB-Operations.md",
    "KB-Pricing.md",
    "KB-Systems.md",
    "KB-Training.md",
    "KB-SalesCalls.md",
    "KB-FulfillmentCalls.md",
    "KB-TrainingCalls.md",
    "KB-UnsortedCalls.md"
  ]
};

function getApiKey() {
  var key = PropertiesService.getScriptProperties().getProperty("ANTHROPIC_API_KEY");
  if (!key) throw new Error("ANTHROPIC_API_KEY not set in Script Properties");
  return key;
}

// ============================================================
// MASTER TRIGGER SETUP
// ============================================================

function setupAllTriggers() {
  var functions = [
    "processNewSalesTranscripts",
    "weeklyPodcastSync",
    "buildInsightDocs",
    "buildKnowledgeBase",
    "weeklyAgentUpdate"
  ];

  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (functions.indexOf(triggers[i].getHandlerFunction()) !== -1) {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  // Monday pipeline sequence (UTC)
  // 8 UTC = 1:00 AM PDT
  ScriptApp.newTrigger("processNewSalesTranscripts")
    .timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(8).create();

  // 9 UTC = 2:00 AM PDT
  ScriptApp.newTrigger("weeklyPodcastSync")
    .timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(9).create();

  // 10 UTC = 3:00 AM PDT
  ScriptApp.newTrigger("buildInsightDocs")
    .timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(10).create();

  // 11 UTC = 4:00 AM PDT
  ScriptApp.newTrigger("buildKnowledgeBase")
    .timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(11).create();

  // 12 UTC = 5:00 AM PDT
  ScriptApp.newTrigger("weeklyAgentUpdate")
    .timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(12).create();

  // 13 UTC = 6:00 AM PDT — KB rewrite via Vercel cron (no Apps Script trigger)

  Logger.log("All triggers set. Monday pipeline 1-5 AM PDT (8-12 UTC).");
  Logger.log("KB rewrite runs via Vercel cron Monday 13:00 UTC (6:00 AM PDT).");
}
