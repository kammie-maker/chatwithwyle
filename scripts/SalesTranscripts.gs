// ============================================================
// SalesTranscripts.gs — Sales call transcript pipeline
// Paste into Apps Script project alongside Code.gs
// ============================================================

var ANTHROPIC_KEY_ST       = PropertiesService.getScriptProperties().getProperty("ANTHROPIC_API_KEY");
var SALES_FOLDER_ID        = "11gcctGdz6Suihwshoao-GUgmc6P1R4H3";
var KB_OUTPUT_FOLDER_ID_ST = "1CycqtO4_O3KJ09C6r605Z_5j6783rtSv";
var MASTER_PROMPT_FILE_ID_ST = "1IjtO_gdiK2-lFevZ66E6KRTuzy-J89xp";
var SALES_KB_DOC           = "KB - Sales Calls.txt";
var PROCESSING_LOG_FILE    = "LOG-Processing.md";
var SLEEP_MS_ST            = 30000;

var CONTEXT_TAGS = [
  "objection-handling", "closing-technique", "talk-track",
  "market-data", "process", "pricing", "guarantee",
  "client-success", "fulfillment", "onboarding",
  "brand-voice", "case-study", "training"
];

// KB docs for master prompt compilation
var KB_DOCS_ST = [
  "KB - Market Intelligence.txt",
  "KB - Operations & Onboarding.txt",
  "KB - Podcast Transcripts.txt",
  "KB - Pricing & Contracts.txt",
  "KB - Systems & Processes.txt",
  "KB - Training & Education.txt",
  "KB - Sales Calls.txt",
  "KB - Fulfillment Calls.txt",
  "KB - Training Calls.txt",
  "KB - Unsorted Calls.txt"
];

var WYLE_SYSTEM_PROMPT_ST = "You are the Freewyld Foundry Sales Intelligence Agent \u2014 trained to support the sales team in negotiating, educating, and closing high-value RPM (Revenue & Pricing Management) clients generating $1M+ in annual STR revenue.\n\nYour purpose is to act as:\n1. A real-time sales enablement tool\n2. A subject-matter expert in revenue management, STR operations, and Freewyld Foundry\u2019s service\n3. A coaching layer for sales reps during calls and deal cycles\n4. A voice-aligned representative of Freewyld founders Eric Moeller and Jasper Ribbers\n\nVoice & Tone\nRespond as Eric Moeller or Jasper Ribbers: direct, confident, no fluff, hospitality-forward, data-backed where appropriate. Use ellipses instead of dashes for pauses. Never oversell. Never contradict contracts, SOPs, or pricing rules.\n\nResponse Format Rules\nResponse format is defined by the active Skill file for the current chat mode. Always follow the Skill file instructions exactly. Never deviate from the format.\n\nBehavior Rules\n1. Never invent details. If something is missing say: I don\u2019t have the source document for that yet, please upload it to the knowledge base.\n2. Never contradict pricing, guarantees, or terms in uploaded contracts or internal documents.\n3. Follow Freewyld\u2019s negotiation philosophy: lead with value and clarity, use ROI logic, protect fee boundaries, offer concessions only when within documented rules.\n4. When sources conflict, prioritize: Contracts, then SOPs, then Pricing Playbook, then Training Documents, then Transcripts.\n\nSales Philosophy\nWe only work with operators where we are an exceptional fit. Our service produces higher revenue through hands-on expert revenue management, not automation alone. Results typically increase revenue 15 to 50 percent depending on baseline performance and market conditions. The guarantee is fair, apples-to-apples, data-driven, and based on true unit availability. We are a partner in the operator\u2019s financial success, not a software tool.";


// ============================================================
// MAIN
// ============================================================

function processNewSalesTranscripts() {
  var props = PropertiesService.getScriptProperties();
  var apiKey = props.getProperty("ANTHROPIC_API_KEY");
  if (!apiKey) { Logger.log("ERROR: ANTHROPIC_API_KEY not set in Script Properties"); return; }

  var output = DriveApp.getFolderById(KB_OUTPUT_FOLDER_ID_ST);
  var startTime = Date.now();
  var MAX_MS = 270000; // 4.5 min safety cutoff

  // Timestamp-based incremental processing
  var lastRunStr = props.getProperty("LAST_RUN_SALES_TRANSCRIPTS");
  var lastRun = lastRunStr ? new Date(lastRunStr) : null;

  // Load resume state: set of already-processed file IDs from this batch
  var batchDoneJson = props.getProperty("ST_BATCH_DONE_IDS");
  var batchDone = new Set(batchDoneJson ? JSON.parse(batchDoneJson) : []);

  // Load cumulative stats across resumes
  var statsJson = props.getProperty("ST_BATCH_STATS");
  var stats = statsJson ? JSON.parse(statsJson) : {
    processed: 0, skipped: 0, errored: 0, insightsAdded: 0,
    speakerSegments: 0, evergreenInsights: 0, timeSensitiveInsights: 0
  };

  var files = getSalesFiles_v2(lastRun);
  // Filter out already-processed files from this batch
  var remaining = files.filter(function(f) { return !batchDone.has(f.id); });

  Logger.log("Total files: " + files.length + ", Already done this batch: " + batchDone.size + ", Remaining: " + remaining.length);

  if (remaining.length === 0) {
    Logger.log("No remaining files. Finalizing.");
    finalizeSalesRun(props, stats);
    return;
  }

  var timedOut = false;

  for (var i = 0; i < remaining.length; i++) {
    if (Date.now() - startTime > MAX_MS) {
      Logger.log("Time limit reached at " + i + "/" + remaining.length + " remaining. Will auto-resume.");
      timedOut = true;
      break;
    }

    var f = remaining[i];
    try {
      var content = DriveApp.getFileById(f.id).getBlob().getDataAsString();
      if (!content || content.trim().length < 100) {
        Logger.log("Skipping (too short): " + f.name);
        stats.skipped++;
        batchDone.add(f.id);
        continue;
      }

      var segments = parseSpeakerSegments(content);
      stats.speakerSegments += segments.length;

      var weight = calculateWeight(f.created);
      var insights = extractSalesInsights_v2(content, f.name, segments, weight, apiKey);

      if (insights) {
        var evCount = (insights.match(/\[EVERGREEN\]/g) || []).length;
        var tsCount = (insights.match(/\[TIME-SENSITIVE/g) || []).length;
        stats.evergreenInsights += evCount;
        stats.timeSensitiveInsights += tsCount;

        var metaHeader = "---\nSOURCE: " + f.name +
          "\nDATE: " + f.created.toISOString() +
          "\nWEIGHT: " + weight +
          "\nTYPE: TRANSCRIPT\n---\n";

        appendToKBFile_v2(output, SALES_KB_DOC, metaHeader + insights, f.name);
        stats.insightsAdded++;
        Logger.log("Processed: " + f.name);
      } else {
        stats.skipped++;
      }

      stats.processed++;
      batchDone.add(f.id);
    } catch (e) {
      Logger.log("ERROR on " + f.name + ": " + e.message);
      stats.errored++;
      batchDone.add(f.id); // Don't retry failed files in this batch
    }

    // Save progress after each file
    props.setProperty("ST_BATCH_DONE_IDS", JSON.stringify(Array.from(batchDone)));
    props.setProperty("ST_BATCH_STATS", JSON.stringify(stats));

    Utilities.sleep(SLEEP_MS_ST);
  }

  if (timedOut) {
    // Save state and schedule auto-resume in 2 minutes
    props.setProperty("ST_BATCH_DONE_IDS", JSON.stringify(Array.from(batchDone)));
    props.setProperty("ST_BATCH_STATS", JSON.stringify(stats));
    scheduleResume_ST();
    Logger.log("Saved progress (" + batchDone.size + " done). Resume trigger set for 2 minutes.");
  } else {
    // All files processed — finalize
    finalizeSalesRun(props, stats);
  }
}

function finalizeSalesRun(props, stats) {
  // Update last run timestamp
  props.setProperty("LAST_RUN_SALES_TRANSCRIPTS", new Date().toISOString());

  // Clean up batch state
  props.deleteProperty("ST_BATCH_DONE_IDS");
  props.deleteProperty("ST_BATCH_STATS");

  // Clear resume triggers, re-establish weekly
  clearResumeTriggers_ST();
  ensureWeeklyTrigger_ST();

  Logger.log("Done. Processed: " + stats.processed + ", Skipped: " + stats.skipped + ", Errors: " + stats.errored);

  // Write audit log
  writeAuditLog(stats);

  // Recompile master prompt
  Logger.log("Recompiling Wyle Master Prompt...");
  compileWyleMasterPromptST_v2();
  Logger.log("Wyle Master Prompt updated.");
}

function scheduleResume_ST() {
  clearResumeTriggers_ST();
  ScriptApp.newTrigger("processNewSalesTranscripts")
    .timeBased()
    .after(2 * 60 * 1000)
    .create();
  Logger.log("Resume trigger set for 2 minutes from now");
}

function clearResumeTriggers_ST() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    var t = triggers[i];
    if (t.getHandlerFunction() === "processNewSalesTranscripts" && t.getTriggerSource() === ScriptApp.TriggerSource.CLOCK) {
      // Only delete one-shot after() triggers, not the weekly trigger
      // after() triggers have EventType CLOCK, weekly ones also do, but
      // we can check if it's the weekly by seeing if it has a specific day
      // Safest: delete all and let setupTrigger recreate the weekly
      // Actually, let's be safe — only delete triggers that are NOT weekly
      try {
        // after() triggers don't survive a check for getWeekDay, but
        // we can't reliably distinguish. Delete all clock triggers for
        // this function, then re-setup the weekly trigger.
        ScriptApp.deleteTrigger(t);
      } catch (e) {
        // ignore
      }
    }
  }
}

function ensureWeeklyTrigger_ST() {
  // Re-establish the weekly trigger if it was removed during cleanup
  var found = false;
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "processNewSalesTranscripts") {
      found = true;
      break;
    }
  }
  if (!found) {
    ScriptApp.newTrigger("processNewSalesTranscripts")
      .timeBased()
      .onWeekDay(ScriptApp.WeekDay.MONDAY)
      .atHour(10)
      .create();
    Logger.log("Weekly trigger re-established.");
  }
}


// ============================================================
// GET FILES — timestamp-based, no done-IDs
// ============================================================

function getSalesFiles_v2(lastRun) {
  var folder = DriveApp.getFolderById(SALES_FOLDER_ID);
  var results = [];
  collectTxtFiles_v2(folder, results);

  if (lastRun) {
    results = results.filter(function(f) {
      return f.created > lastRun || f.modified > lastRun;
    });
  }

  // Sort oldest first so we process in chronological order
  results.sort(function(a, b) { return a.created - b.created; });
  return results;
}

function collectTxtFiles_v2(folder, results) {
  var files = folder.getFilesByType(MimeType.PLAIN_TEXT);
  while (files.hasNext()) {
    var f = files.next();
    results.push({
      id: f.getId(),
      name: f.getName(),
      created: f.getDateCreated(),
      modified: f.getLastUpdated()
    });
  }
  var subs = folder.getFolders();
  while (subs.hasNext()) collectTxtFiles_v2(subs.next(), results);
}


// ============================================================
// SPEAKER ATTRIBUTION
// ============================================================

function parseSpeakerSegments(content) {
  var segments = [];
  var lines = content.split("\n");
  var currentSpeaker = "UNKNOWN";
  var currentText = [];
  // Match: "Name:" or "Name :" at start of line (word(s) followed by colon)
  var speakerPattern = /^\s*([\w]+(?:\s+[\w]+)?)\s*:\s*/;

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();
    if (!line) continue;

    var match = line.match(speakerPattern);
    if (match) {
      if (currentText.length > 0) {
        segments.push({ speaker: classifySpeaker(currentSpeaker), name: currentSpeaker, text: currentText.join(" ") });
        currentText = [];
      }
      currentSpeaker = match[1];
      var rest = line.replace(speakerPattern, "").trim();
      if (rest) currentText.push(rest);
    } else {
      currentText.push(line);
    }
  }
  if (currentText.length > 0) {
    segments.push({ speaker: classifySpeaker(currentSpeaker), name: currentSpeaker, text: currentText.join(" ") });
  }
  return segments;
}

function classifySpeaker(name) {
  var lower = name.toLowerCase();
  // Known Freewyld team members
  var repNames = ["eric", "jasper", "kaye", "rep", "agent", "sales", "freewyld"];
  var clientNames = ["client", "prospect", "lead", "guest", "customer", "owner", "host"];

  for (var i = 0; i < repNames.length; i++) {
    if (lower.indexOf(repNames[i]) !== -1) return "REP";
  }
  for (var j = 0; j < clientNames.length; j++) {
    if (lower.indexOf(clientNames[j]) !== -1) return "CLIENT";
  }
  return "UNKNOWN";
}


// ============================================================
// RECENCY WEIGHTING
// ============================================================

function calculateWeight(createdDate) {
  var now = new Date();
  var diffMs = now.getTime() - createdDate.getTime();
  var diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays <= 30) return "HIGH";
  if (diffDays <= 90) return "MEDIUM";
  return "LOW";
}


// ============================================================
// EXTRACT INSIGHTS — upgraded prompt
// ============================================================

function extractSalesInsights_v2(content, fileName, segments, weight, apiKey) {
  var truncated = content.length > 12000
    ? content.substring(0, 12000) + "\n\n[truncated]"
    : content;

  // Build speaker summary for prompt
  var speakerSummary = "";
  if (segments.length > 1) {
    var speakers = {};
    for (var i = 0; i < segments.length; i++) {
      var key = segments[i].name + " [" + segments[i].speaker + "]";
      speakers[key] = (speakers[key] || 0) + 1;
    }
    speakerSummary = "\n\nSpeaker segments detected:\n";
    for (var s in speakers) {
      speakerSummary += "- " + s + ": " + speakers[s] + " segments\n";
    }
  }

  var tagList = CONTEXT_TAGS.join(", ");

  var prompt = "You are building a sales knowledge base for Wyle, the Freewyld Foundry Sales Intelligence Agent. Wyle helps reps close high-value STR revenue management clients ($1M+ annual STR revenue).\n\n" +
    "This content is " + weight + " recency. Note this in your extraction \u2014 weight newer insights more heavily than older ones when they conflict.\n\n" +
    "Analyze this sales call transcript and extract structured insights a Freewyld sales rep needs to close deals, handle objections, and follow Freewyld\u2019s sales philosophy." +
    speakerSummary +
    "\n\nIMPORTANT RULES FOR THIS EXTRACTION:\n" +
    "1. SPEAKER ATTRIBUTION: Tag each insight with the speaker role. Use [REP] for Freewyld sales rep lines, [CLIENT] or [PROSPECT] for the other party, [UNKNOWN] if unclear.\n" +
    "2. CONTEXT TAGGING: Tag each insight with the most relevant category from: " + tagList + ". Format: [TAG: category]\n" +
    "3. EVERGREEN vs TIME-SENSITIVE: Classify each insight as [EVERGREEN] if it describes permanent techniques/philosophy, or [TIME-SENSITIVE: review-monthly] for pricing/offers/market data, or [TIME-SENSITIVE: review-quarterly] for seasonal strategies.\n\n" +
    "Transcript filename: " + fileName + "\n\nTranscript:\n" + truncated + "\n\n" +
    "Return ONLY the sections below. Write \"None noted.\" if a section has nothing useful. No preamble, no commentary.\n" +
    "Format each insight line as: [SPEAKER] [TAG: category] [EVERGREEN or TIME-SENSITIVE] insight text\n\n" +
    "## Objections & How They Were Handled\n" +
    "List each objection raised and how it was addressed.\n\n" +
    "## Winning Language & Phrases\n" +
    "Exact or near-exact phrases that moved the conversation forward.\n\n" +
    "## Questions the Lead Asked\n" +
    "Questions the prospect raised revealing concerns and buying criteria.\n\n" +
    "## Buying Signals\n" +
    "Anything indicating genuine interest, intent, or emotional investment.\n\n" +
    "## Hesitation Patterns\n" +
    "Signs of doubt, delay tactics, unresolved concerns.\n\n" +
    "## Key Pain Points Mentioned\n" +
    "Problems the lead is trying to solve.\n\n" +
    "## Follow-Up Triggers\n" +
    "Specific things that should prompt follow-up action.\n\n" +
    "## Talk Track Snippets\n" +
    "Phrasing worth repeating word for word in future calls.\n\n" +
    "## Coaching Notes\n" +
    "1-2 sentences on what went well or could improve.";

  var res = UrlFetchApp.fetch("https://api.anthropic.com/v1/messages", {
    method: "post",
    contentType: "application/json",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    payload: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }]
    }),
    muteHttpExceptions: true
  });

  var data = JSON.parse(res.getContentText());
  if (data.error) throw new Error(data.error.message);
  return (data.content && data.content[0]) ? data.content[0].text : null;
}


// ============================================================
// APPEND TO KB FILE — with metadata header
// ============================================================

function appendToKBFile_v2(outputFolder, docName, entry, sourceFile) {
  var existing = outputFolder.getFilesByName(docName);
  if (existing.hasNext()) {
    var file = existing.next();
    file.setContent(file.getBlob().getDataAsString() + "\n\n" + entry);
  } else {
    outputFolder.createFile(docName, "# " + docName + "\nGenerated: " + new Date().toISOString() + "\n\n" + entry, MimeType.PLAIN_TEXT);
  }
}


// ============================================================
// AUDIT LOG
// ============================================================

function writeAuditLog(stats) {
  var folder = DriveApp.getFolderById(KB_OUTPUT_FOLDER_ID_ST);
  var entry = "---\nRUN: processNewSalesTranscripts\n" +
    "TIMESTAMP: " + new Date().toISOString() + "\n" +
    "FILES_PROCESSED: " + stats.processed + "\n" +
    "FILES_SKIPPED: " + stats.skipped + "\n" +
    "FILES_ERRORED: " + stats.errored + "\n" +
    "NEW_INSIGHTS_ADDED: " + stats.insightsAdded + "\n" +
    "SPEAKER_SEGMENTS_FOUND: " + stats.speakerSegments + "\n" +
    "EVERGREEN_INSIGHTS: " + stats.evergreenInsights + "\n" +
    "TIME_SENSITIVE_INSIGHTS: " + stats.timeSensitiveInsights + "\n" +
    "---";

  var files = folder.getFilesByName(PROCESSING_LOG_FILE);
  if (files.hasNext()) {
    var file = files.next();
    var existing = file.getBlob().getDataAsString();
    file.setContent(entry + "\n\n" + existing);
  } else {
    folder.createFile(PROCESSING_LOG_FILE, "# Processing Audit Log\n\n" + entry, "text/markdown");
  }
}


// ============================================================
// RECOMPILE WYLE MASTER PROMPT
// ============================================================

function compileWyleMasterPromptST_v2() {
  var folder = DriveApp.getFolderById(KB_OUTPUT_FOLDER_ID_ST);
  var kbContent = "";

  for (var i = 0; i < KB_DOCS_ST.length; i++) {
    var docName = KB_DOCS_ST[i];
    var files = folder.getFilesByName(docName);
    if (!files.hasNext()) {
      Logger.log("WARNING: KB doc not found \u2014 " + docName);
      continue;
    }
    var content = files.next().getBlob().getDataAsString().trim();
    if (content) {
      kbContent += "\n\n" + "============================================================" +
        "\n## " + docName +
        "\n============================================================\n\n" + content;
    }
  }

  var compiled = WYLE_SYSTEM_PROMPT_ST +
    "\n\n============================================================\n" +
    "# KNOWLEDGE BASE\nLast compiled: " + new Date().toISOString() +
    "\n============================================================" + kbContent;

  DriveApp.getFileById(MASTER_PROMPT_FILE_ID_ST).setContent(compiled);
  Logger.log("Master prompt compiled. Length: " + compiled.length + " chars.");
}


// ============================================================
// TRIGGER SETUP
// ============================================================

function setupTrigger_SalesTranscripts() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "processNewSalesTranscripts") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger("processNewSalesTranscripts")
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(10)
    .create();
  Logger.log("Trigger set: processNewSalesTranscripts \u2014 Mondays at 10:00 UTC (3:00 AM PDT)");
}


// ============================================================
// RESET — run if you need to reprocess everything
// ============================================================

function resetSTProgress() {
  var props = PropertiesService.getScriptProperties();
  props.deleteProperty("LAST_RUN_SALES_TRANSCRIPTS");
  props.deleteProperty("stDoneIds");
  Logger.log("Progress reset. Run processNewSalesTranscripts() to start fresh.");
}
