// ============================================================
// FathomTranscripts.gs — Fathom call transcript pipeline
// Paste into Apps Script project alongside Code.gs
// ============================================================

var FT_ROOT_SOURCE_FOLDER = "1nj_D_iknk3qBBNOPh6UEnjBXWpCXIp4U";
var FT_OUTPUT_FOLDER      = "1CycqtO4_O3KJ09C6r605Z_5j6783rtSv";
var FT_PROCESSING_LOG     = "LOG-Processing.md";
var FT_SLEEP_MS           = 30000;

var FT_CALL_TYPES = ["fulfillment", "sales", "training", "unsorted"];

var FT_KB_DOC_NAMES = {
  fulfillment: "KB - Fulfillment Calls.txt",
  sales:       "KB - Sales Calls.txt",
  training:    "KB - Training Calls.txt",
  unsorted:    "KB - Unsorted Calls.txt"
};

var FT_KNOWN_REPS = ["mariano", "jaydon", "eric", "jasper", "kaye"];

var FT_CONTEXT_TAGS = [
  "objection-handling", "closing-technique", "talk-track",
  "market-data", "process", "pricing", "guarantee",
  "client-success", "fulfillment", "onboarding",
  "brand-voice", "case-study", "training"
];


// ============================================================
// MAIN
// ============================================================

function buildKnowledgeBase() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    Logger.log("Another run is still in progress \u2014 skipping.");
    return;
  }

  var props = PropertiesService.getScriptProperties();
  var apiKey = props.getProperty("ANTHROPIC_API_KEY");
  if (!apiKey) { Logger.log("ERROR: ANTHROPIC_API_KEY not set in Script Properties"); lock.releaseLock(); return; }

  var startTime = Date.now();
  var MAX_MS = 270000;

  var sourceRoot = DriveApp.getFolderById(FT_ROOT_SOURCE_FOLDER);
  var outputRoot = DriveApp.getFolderById(FT_OUTPUT_FOLDER);

  // Timestamp-based incremental processing
  var lastRunStr = props.getProperty("LAST_RUN_FATHOM_TRANSCRIPTS");
  var lastRun = lastRunStr ? new Date(lastRunStr) : null;

  // Resume state
  var batchDoneJson = props.getProperty("FT_BATCH_DONE_IDS");
  var batchDone = new Set(batchDoneJson ? JSON.parse(batchDoneJson) : []);

  var statsJson = props.getProperty("FT_BATCH_STATS");
  var stats = statsJson ? JSON.parse(statsJson) : {
    subfoldersProcessed: 0, processed: 0, skipped: 0, errored: 0,
    insightsAdded: 0, speakerSegments: 0, evergreenInsights: 0, timeSensitiveInsights: 0
  };

  var timedOut = false;
  var subfoldersWithWork = 0;

  for (var ci = 0; ci < FT_CALL_TYPES.length; ci++) {
    if (timedOut) break;

    var callType = FT_CALL_TYPES[ci];
    var folders = sourceRoot.getFoldersByName(callType);
    if (!folders.hasNext()) {
      Logger.log("WARNING: Subfolder \"" + callType + "\" not found \u2014 skipping.");
      continue;
    }

    var folder = folders.next();
    var files = [];
    var fileIter = folder.getFilesByType(MimeType.PLAIN_TEXT);
    while (fileIter.hasNext()) {
      var f = fileIter.next();
      files.push({
        id: f.getId(),
        name: f.getName(),
        callType: callType,
        created: f.getDateCreated(),
        modified: f.getLastUpdated()
      });
    }

    // Filter by timestamp
    if (lastRun) {
      files = files.filter(function(f) {
        return f.created > lastRun || f.modified > lastRun;
      });
    }

    // Filter out already-done in this batch
    var remaining = files.filter(function(f) { return !batchDone.has(f.id); });

    if (remaining.length === 0) continue;
    subfoldersWithWork++;
    Logger.log("[" + callType + "] " + remaining.length + " files to process");

    for (var i = 0; i < remaining.length; i++) {
      if (Date.now() - startTime > MAX_MS) {
        Logger.log("Time limit reached. Will auto-resume.");
        timedOut = true;
        break;
      }

      var item = remaining[i];
      try {
        var content = DriveApp.getFileById(item.id).getBlob().getDataAsString();
        if (!content || content.trim().length < 100) {
          Logger.log("Skipping (too short): " + item.name);
          stats.skipped++;
          batchDone.add(item.id);
          continue;
        }

        // Speaker attribution
        var segments = parseSpeakerSegments_ft(content);
        stats.speakerSegments += segments.length;

        // Recency weight
        var weight = calculateWeight_ft(item.created);

        // Extract insights
        var insights = extractInsights_ft(content, item.callType, item.name, segments, weight, apiKey);
        if (insights) {
          var evCount = (insights.match(/\[EVERGREEN\]/g) || []).length;
          var tsCount = (insights.match(/\[TIME-SENSITIVE/g) || []).length;
          stats.evergreenInsights += evCount;
          stats.timeSensitiveInsights += tsCount;

          var metaHeader = "---\nSOURCE: " + item.name +
            "\nSUBFOLDER: " + item.callType +
            "\nDATE: " + item.created.toISOString() +
            "\nWEIGHT: " + weight +
            "\nTYPE: FATHOM_TRANSCRIPT\n---\n";

          appendToKBDoc_ft(outputRoot, FT_KB_DOC_NAMES[item.callType], metaHeader + insights, item.name);
          stats.insightsAdded++;
          Logger.log("Processed: " + item.callType + " / " + item.name);
        } else {
          stats.skipped++;
        }

        stats.processed++;
        batchDone.add(item.id);
      } catch (e) {
        Logger.log("ERROR on " + item.name + ": " + e.message);
        stats.errored++;
        batchDone.add(item.id);
      }

      // Save progress after each file
      props.setProperty("FT_BATCH_DONE_IDS", JSON.stringify(Array.from(batchDone)));
      props.setProperty("FT_BATCH_STATS", JSON.stringify(stats));

      Utilities.sleep(FT_SLEEP_MS);
    }
  }

  stats.subfoldersProcessed += subfoldersWithWork;

  if (timedOut) {
    props.setProperty("FT_BATCH_DONE_IDS", JSON.stringify(Array.from(batchDone)));
    props.setProperty("FT_BATCH_STATS", JSON.stringify(stats));
    scheduleResume_FT();
    Logger.log("Saved progress (" + batchDone.size + " done). Resume in 2 minutes.");
  } else {
    finalizeFathomRun(props, stats);
  }

  lock.releaseLock();
}

function finalizeFathomRun(props, stats) {
  props.setProperty("LAST_RUN_FATHOM_TRANSCRIPTS", new Date().toISOString());
  props.deleteProperty("FT_BATCH_DONE_IDS");
  props.deleteProperty("FT_BATCH_STATS");
  clearResumeTriggers_FT();
  ensureWeeklyTrigger_FT();

  Logger.log("Done. Processed: " + stats.processed + ", Skipped: " + stats.skipped + ", Errors: " + stats.errored);
  writeAuditLog_ft(stats);
}

function scheduleResume_FT() {
  clearResumeTriggers_FT();
  ScriptApp.newTrigger("buildKnowledgeBase")
    .timeBased()
    .after(2 * 60 * 1000)
    .create();
  Logger.log("Resume trigger set for 2 minutes from now");
}

function clearResumeTriggers_FT() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "buildKnowledgeBase") {
      try { ScriptApp.deleteTrigger(triggers[i]); } catch (e) { /* ignore */ }
    }
  }
}

function ensureWeeklyTrigger_FT() {
  var found = false;
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "buildKnowledgeBase") {
      found = true;
      break;
    }
  }
  if (!found) {
    ScriptApp.newTrigger("buildKnowledgeBase")
      .timeBased()
      .onWeekDay(ScriptApp.WeekDay.MONDAY)
      .atHour(9)
      .create();
    Logger.log("Weekly trigger re-established.");
  }
}


// ============================================================
// SPEAKER ATTRIBUTION
// ============================================================

function parseSpeakerSegments_ft(content) {
  var segments = [];
  var lines = content.split("\n");
  var currentSpeaker = "UNKNOWN";
  var currentText = [];
  var speakerPattern = /^\s*([\w]+(?:\s+[\w]+)?)\s*:\s*/;

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();
    if (!line) continue;

    var match = line.match(speakerPattern);
    if (match) {
      if (currentText.length > 0) {
        segments.push({ speaker: classifySpeaker_ft(currentSpeaker), name: currentSpeaker, text: currentText.join(" ") });
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
    segments.push({ speaker: classifySpeaker_ft(currentSpeaker), name: currentSpeaker, text: currentText.join(" ") });
  }
  return segments;
}

function classifySpeaker_ft(name) {
  var lower = name.toLowerCase();
  for (var i = 0; i < FT_KNOWN_REPS.length; i++) {
    if (lower.indexOf(FT_KNOWN_REPS[i]) !== -1) return "REP";
  }
  var clientWords = ["client", "prospect", "lead", "guest", "customer", "owner", "host"];
  for (var j = 0; j < clientWords.length; j++) {
    if (lower.indexOf(clientWords[j]) !== -1) return "CLIENT";
  }
  return "UNKNOWN";
}


// ============================================================
// RECENCY WEIGHT
// ============================================================

function calculateWeight_ft(createdDate) {
  var diffDays = (new Date().getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays <= 30) return "HIGH";
  if (diffDays <= 90) return "MEDIUM";
  return "LOW";
}


// ============================================================
// EXTRACT INSIGHTS — upgraded prompt
// ============================================================

function extractInsights_ft(content, callType, fileName, segments, weight, apiKey) {
  var truncated = content.length > 12000
    ? content.substring(0, 12000) + "\n\n[transcript truncated]"
    : content;

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

  var tagList = FT_CONTEXT_TAGS.join(", ");

  var prompt = "You are analyzing a " + callType + " call transcript for Freewyld, a short-term rental revenue management company. Extract structured insights that will help the sales team close more deals.\n\n" +
    "This content is " + weight + " recency. Weight newer insights more heavily than older ones when they conflict.\n\n" +
    "Transcript filename: " + fileName +
    speakerSummary +
    "\n\nIMPORTANT RULES FOR THIS EXTRACTION:\n" +
    "1. SPEAKER ATTRIBUTION: Tag each insight with the speaker role. Use [REP] for Freewyld team member lines (Mariano, Jaydon, Eric, Jasper, Kaye, or any rep), [CLIENT] for existing client lines, [PROSPECT] for sales prospect lines, [UNKNOWN] if unclear.\n" +
    "2. CONTEXT TAGGING: Tag each insight with the most relevant category from: " + tagList + ". Format: [TAG: category]\n" +
    "3. EVERGREEN vs TIME-SENSITIVE: Classify each insight as:\n" +
    "   [EVERGREEN] if it describes permanent techniques, philosophy, processes.\n" +
    "   [TIME-SENSITIVE: review-monthly] for pricing, current offers, market conditions.\n" +
    "   [TIME-SENSITIVE: review-quarterly] for seasonal strategies.\n\n" +
    "Transcript:\n" + truncated + "\n\n" +
    "Return ONLY the following sections. If a section has nothing relevant, write \"None noted.\" No preamble, no commentary.\n" +
    "Format each insight line as: [SPEAKER] [TAG: category] [EVERGREEN or TIME-SENSITIVE] insight text\n\n" +
    "## Objections & How They Were Handled\n(List each objection raised and how it was addressed)\n\n" +
    "## Winning Language & Phrases\n(Exact phrases or framings that moved the conversation forward)\n\n" +
    "## Questions Leads Asked\n(Questions the prospect/lead asked revealing real concerns)\n\n" +
    "## Buying Signals\n(Anything indicating genuine interest or intent)\n\n" +
    "## Hesitation Patterns\n(Signs of doubt, delay tactics, unresolved concerns)\n\n" +
    "## Key Pain Points Mentioned\n(Problems the lead is trying to solve)\n\n" +
    "## Follow-Up Triggers\n(Specific things that should prompt follow-up action)\n\n" +
    "## Coaching Notes\n(1-2 sentences on what went well or could be improved)";

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
  if (data.error) throw new Error("Claude API error: " + data.error.message);
  return (data.content && data.content[0]) ? data.content[0].text : null;
}


// ============================================================
// APPEND TO KB DOC
// ============================================================

function appendToKBDoc_ft(outputRoot, docName, entry, sourceFileName) {
  var existing = outputRoot.getFilesByName(docName);
  if (existing.hasNext()) {
    var file = existing.next();
    file.setContent(file.getBlob().getDataAsString() + "\n\n" + entry);
  } else {
    outputRoot.createFile(docName, "# " + docName + "\nGenerated by Wyle Knowledge Base Builder\nLast updated: " + new Date().toISOString() + "\n\n" + entry, MimeType.PLAIN_TEXT);
  }
}


// ============================================================
// AUDIT LOG
// ============================================================

function writeAuditLog_ft(stats) {
  var folder = DriveApp.getFolderById(FT_OUTPUT_FOLDER);
  var entry = "---\nRUN: buildKnowledgeBase\n" +
    "TIMESTAMP: " + new Date().toISOString() + "\n" +
    "SUBFOLDERS_PROCESSED: " + stats.subfoldersProcessed + "\n" +
    "FILES_PROCESSED: " + stats.processed + "\n" +
    "FILES_SKIPPED: " + stats.skipped + "\n" +
    "FILES_ERRORED: " + stats.errored + "\n" +
    "NEW_INSIGHTS_ADDED: " + stats.insightsAdded + "\n" +
    "SPEAKER_SEGMENTS_FOUND: " + stats.speakerSegments + "\n" +
    "EVERGREEN_INSIGHTS: " + stats.evergreenInsights + "\n" +
    "TIME_SENSITIVE_INSIGHTS: " + stats.timeSensitiveInsights + "\n" +
    "---";

  var files = folder.getFilesByName(FT_PROCESSING_LOG);
  if (files.hasNext()) {
    var file = files.next();
    var existing = file.getBlob().getDataAsString();
    file.setContent(entry + "\n\n" + existing);
  } else {
    folder.createFile(FT_PROCESSING_LOG, "# Processing Audit Log\n\n" + entry, "text/markdown");
  }
}


// ============================================================
// TRIGGER SETUP
// ============================================================

function setupTrigger_FathomTranscripts() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "buildKnowledgeBase") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger("buildKnowledgeBase")
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(9)
    .create();
  Logger.log("Trigger set: buildKnowledgeBase \u2014 Mondays at 9:00 UTC (2:00 AM PDT)");
}


// ============================================================
// RESET
// ============================================================

function resetFathomProgress() {
  var props = PropertiesService.getScriptProperties();
  props.deleteProperty("LAST_RUN_FATHOM_TRANSCRIPTS");
  props.deleteProperty("FT_BATCH_DONE_IDS");
  props.deleteProperty("FT_BATCH_STATS");
  props.deleteProperty("fileQueue");
  props.deleteProperty("cursor");
  props.deleteProperty("processedIds");
  clearResumeTriggers_FT();
  Logger.log("Progress reset. Run buildKnowledgeBase() to start fresh.");
}
