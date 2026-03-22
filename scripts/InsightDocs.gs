// ============================================================
// InsightDocs.gs — Company document insight extraction pipeline
// Paste into Apps Script project alongside Code.gs
// ============================================================

var ID_OUTPUT_FOLDER = "1CycqtO4_O3KJ09C6r605Z_5j6783rtSv";
var ID_PROCESSING_LOG = "LOG-Processing.md";
var ID_SLEEP_MS = 30000;

var ID_FOLDERS = [
  { name: "Market Intelligence",     id: "13zejUiLfi-eu-5S-jzMm5ixuY2zE7zfp" },
  { name: "Operations & Onboarding", id: "11kMFomi3QnPN0l4MpC_6VgZXWkXtAfDS" },
  { name: "Podcast Transcripts",     id: "1NgzuppgPuIsR46WtaBI1Xs-uKe7njN75" },
  { name: "Pricing & Contracts",     id: "12f3jchtDySabTcSmarGqwtOgT9auw_N9" },
  { name: "Systems & Processes",     id: "1C806YrDrsNCnYExA_6FdDqFYEfdKv331" },
  { name: "Training & Education",    id: "1naEmfgMjztcBf0F9yAEFbPLcob0j6rap" }
];

var ID_SUPPORTED_MIMES = [
  MimeType.GOOGLE_DOCS,
  MimeType.PDF,
  MimeType.PLAIN_TEXT,
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
];

var ID_CONTEXT_TAGS = [
  "objection-handling", "closing-technique", "talk-track",
  "market-data", "process", "pricing", "guarantee",
  "client-success", "fulfillment", "onboarding",
  "brand-voice", "case-study", "training"
];


// ============================================================
// MAIN
// ============================================================

function buildInsightDocs() {
  var props = PropertiesService.getScriptProperties();
  var apiKey = props.getProperty("ANTHROPIC_API_KEY");
  if (!apiKey) { Logger.log("ERROR: ANTHROPIC_API_KEY not set in Script Properties"); return; }

  var output = DriveApp.getFolderById(ID_OUTPUT_FOLDER);
  var startTime = Date.now();
  var MAX_MS = 270000;

  // Timestamp-based incremental processing
  var lastRunStr = props.getProperty("LAST_RUN_INSIGHT_DOCS");
  var lastRun = lastRunStr ? new Date(lastRunStr) : null;

  // Resume state
  var batchDoneJson = props.getProperty("ID_BATCH_DONE_IDS");
  var batchDone = new Set(batchDoneJson ? JSON.parse(batchDoneJson) : []);

  var statsJson = props.getProperty("ID_BATCH_STATS");
  var stats = statsJson ? JSON.parse(statsJson) : {
    foldersProcessed: 0, processed: 0, skipped: 0, errored: 0,
    insightsAdded: 0, evergreenInsights: 0, timeSensitiveInsights: 0
  };

  var timedOut = false;
  var foldersWithWork = 0;

  for (var fi = 0; fi < ID_FOLDERS.length; fi++) {
    if (timedOut) break;

    var folder = ID_FOLDERS[fi];
    var files = getFiles_id(DriveApp.getFolderById(folder.id));

    // Filter by timestamp
    if (lastRun) {
      files = files.filter(function(f) {
        return f.created > lastRun || f.modified > lastRun;
      });
    }

    // Filter out already-done in this batch
    var remaining = files.filter(function(f) { return !batchDone.has(f.id); });

    if (remaining.length === 0) continue;
    foldersWithWork++;
    Logger.log("[" + folder.name + "] " + remaining.length + " files to process");

    for (var i = 0; i < remaining.length; i++) {
      if (Date.now() - startTime > MAX_MS) {
        Logger.log("Time limit reached. Will auto-resume.");
        timedOut = true;
        break;
      }

      var f = remaining[i];
      try {
        var text = extractText_id(f);
        if (!text || text.trim().length < 100) {
          Logger.log("Skipping (too short): " + f.name);
          stats.skipped++;
          batchDone.add(f.id);
          continue;
        }

        // Speaker attribution
        var speakerTag = "[DOC]";
        var speakerPattern = /^\s*[\w]+(?:\s+[\w]+)?\s*:\s*/m;
        if (speakerPattern.test(text)) {
          speakerTag = "[FREEWYLD/EXTERNAL]";
        }

        // Recency weight
        var weight = calculateWeight_id(f.created);

        // Extract insights
        var insights = callClaude_id(text, folder.name, f.name, weight, speakerTag, apiKey);
        if (insights) {
          var evCount = (insights.match(/\[EVERGREEN\]/g) || []).length;
          var tsCount = (insights.match(/\[TIME-SENSITIVE/g) || []).length;
          stats.evergreenInsights += evCount;
          stats.timeSensitiveInsights += tsCount;

          var metaHeader = "---\nSOURCE: " + f.name +
            "\nFOLDER: " + folder.name +
            "\nDATE: " + f.created.toISOString() +
            "\nWEIGHT: " + weight +
            "\nTYPE: DOCUMENT\n---\n";

          appendToDoc_id(output, "KB - " + folder.name + ".txt", metaHeader + insights, f.name);
          stats.insightsAdded++;
          Logger.log("Processed: " + folder.name + " / " + f.name);
        } else {
          stats.skipped++;
        }

        stats.processed++;
        batchDone.add(f.id);
      } catch (e) {
        Logger.log("ERROR: " + f.name + " \u2014 " + e.message);
        stats.errored++;
        batchDone.add(f.id);
      }

      // Save progress after each file
      props.setProperty("ID_BATCH_DONE_IDS", JSON.stringify(Array.from(batchDone)));
      props.setProperty("ID_BATCH_STATS", JSON.stringify(stats));

      Utilities.sleep(ID_SLEEP_MS);
    }
  }

  stats.foldersProcessed += foldersWithWork;

  if (timedOut) {
    props.setProperty("ID_BATCH_DONE_IDS", JSON.stringify(Array.from(batchDone)));
    props.setProperty("ID_BATCH_STATS", JSON.stringify(stats));
    scheduleResume_ID();
    Logger.log("Saved progress (" + batchDone.size + " done). Resume in 2 minutes.");
  } else {
    finalizeInsightRun(props, stats);
  }
}

function finalizeInsightRun(props, stats) {
  props.setProperty("LAST_RUN_INSIGHT_DOCS", new Date().toISOString());
  props.deleteProperty("ID_BATCH_DONE_IDS");
  props.deleteProperty("ID_BATCH_STATS");
  clearResumeTriggers_ID();
  ensureWeeklyTrigger_ID();

  Logger.log("Done. Processed: " + stats.processed + ", Skipped: " + stats.skipped + ", Errors: " + stats.errored);

  writeAuditLog_id(stats);
}

function scheduleResume_ID() {
  clearResumeTriggers_ID();
  ScriptApp.newTrigger("buildInsightDocs")
    .timeBased()
    .after(2 * 60 * 1000)
    .create();
  Logger.log("Resume trigger set for 2 minutes from now");
}

function clearResumeTriggers_ID() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "buildInsightDocs") {
      try { ScriptApp.deleteTrigger(triggers[i]); } catch (e) { /* ignore */ }
    }
  }
}

function ensureWeeklyTrigger_ID() {
  var found = false;
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "buildInsightDocs") {
      found = true;
      break;
    }
  }
  if (!found) {
    ScriptApp.newTrigger("buildInsightDocs")
      .timeBased()
      .onWeekDay(ScriptApp.WeekDay.MONDAY)
      .atHour(8)
      .create();
    Logger.log("Weekly trigger re-established.");
  }
}


// ============================================================
// GET FILES — recursive, all supported types
// ============================================================

function getFiles_id(folder) {
  var results = [];
  var files = folder.getFiles();
  while (files.hasNext()) {
    var f = files.next();
    if (ID_SUPPORTED_MIMES.indexOf(f.getMimeType()) !== -1) {
      results.push({
        id: f.getId(),
        name: f.getName(),
        mime: f.getMimeType(),
        created: f.getDateCreated(),
        modified: f.getLastUpdated()
      });
    }
  }
  var subs = folder.getFolders();
  while (subs.hasNext()) {
    var subFiles = getFiles_id(subs.next());
    for (var i = 0; i < subFiles.length; i++) results.push(subFiles[i]);
  }
  return results;
}


// ============================================================
// EXTRACT TEXT — Google Doc, PDF, .docx, .txt
// ============================================================

function extractText_id(f) {
  var file = DriveApp.getFileById(f.id);
  var token = ScriptApp.getOAuthToken();

  if (f.mime === MimeType.GOOGLE_DOCS) {
    var res = UrlFetchApp.fetch(
      "https://docs.google.com/feeds/download/documents/export/Export?id=" + f.id + "&exportFormat=txt",
      { headers: { Authorization: "Bearer " + token }, muteHttpExceptions: true }
    );
    return res.getContentText();
  }

  if (f.mime === MimeType.PLAIN_TEXT) {
    return file.getBlob().getDataAsString();
  }

  // PDF or .docx — convert via Drive API then trash temp doc
  var converted = Drive.Files.insert(
    { title: f.name, mimeType: MimeType.GOOGLE_DOCS },
    file.getBlob(),
    { convert: true }
  );
  var res2 = UrlFetchApp.fetch(
    "https://docs.google.com/feeds/download/documents/export/Export?id=" + converted.id + "&exportFormat=txt",
    { headers: { Authorization: "Bearer " + token }, muteHttpExceptions: true }
  );
  DriveApp.getFileById(converted.id).setTrashed(true);
  return res2.getContentText();
}


// ============================================================
// RECENCY WEIGHT
// ============================================================

function calculateWeight_id(createdDate) {
  var now = new Date();
  var diffDays = (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays <= 30) return "HIGH";
  if (diffDays <= 90) return "MEDIUM";
  return "LOW";
}


// ============================================================
// CALL CLAUDE — upgraded prompt with all improvements
// ============================================================

function callClaude_id(content, folderName, fileName, weight, speakerTag, apiKey) {
  var truncated = content.length > 12000
    ? content.substring(0, 12000) + "\n\n[truncated]"
    : content;

  var tagList = ID_CONTEXT_TAGS.join(", ");

  var speakerInstructions = "";
  if (speakerTag === "[FREEWYLD/EXTERNAL]") {
    speakerInstructions = "\n\nSPEAKER ATTRIBUTION: This document contains speaker-labeled content. Tag each insight with:\n" +
      "[FREEWYLD] for Freewyld team member content (Eric, Jasper, Kaye, or any rep/team reference)\n" +
      "[EXTERNAL] for guest, client, or external speaker content\n" +
      "If speaker cannot be determined, use [DOC].";
  } else {
    speakerInstructions = "\n\nThis is a reference document without speaker labels. Tag all insights as [DOC].";
  }

  var prompt = "You are building a sales knowledge base for the Freewyld Foundry Sales Intelligence Agent \u2014 an internal AI that helps sales reps close high-value STR revenue management clients ($1M+ annual STR revenue).\n\n" +
    "This content is " + weight + " recency. Weight newer insights more heavily than older ones when they conflict.\n\n" +
    "Document source folder: " + folderName + "\nDocument name: " + fileName +
    speakerInstructions +
    "\n\nCONTEXT TAGGING: Tag each insight with the most relevant category from: " + tagList + ". Format: [TAG: category]\n\n" +
    "EVERGREEN vs TIME-SENSITIVE: Classify each insight as:\n" +
    "[EVERGREEN] if it describes permanent processes, philosophy, techniques that don't change.\n" +
    "[TIME-SENSITIVE: review-monthly] for pricing, current offers, market conditions.\n" +
    "[TIME-SENSITIVE: review-quarterly] for strategies that change seasonally.\n\n" +
    "Extract only insights a Freewyld sales rep needs. Skip anything not relevant to selling, pricing, onboarding, objection handling, or understanding the service.\n\n" +
    "Document:\n" + truncated + "\n\n" +
    "Return ONLY these sections. Write \"None noted.\" if a section has nothing useful. No preamble.\n" +
    "Format each insight line as: [SPEAKER_TAG] [TAG: category] [EVERGREEN or TIME-SENSITIVE] insight text\n\n" +
    "## Key Talking Points & Facts\n(Stats, claims, or framings a rep can use in a pitch or discovery call)\n\n" +
    "## Objection Handling\n(Anything that helps counter pricing, trust, competition, or results objections)\n\n" +
    "## Value Propositions\n(Explicit or implied reasons a property operator should choose Freewyld Foundry)\n\n" +
    "## Pricing & Contract Knowledge\n(Fee structures, negotiation rules, guarantee terms, concession boundaries)\n\n" +
    "## Process & Onboarding Knowledge\n(How the service works, what onboarding looks like, what clients should expect)\n\n" +
    "## Market & Competitive Context\n(Market data, competitor comparisons, STR industry context reps can reference)\n\n" +
    "## Talk Track Snippets\n(Exact or near-exact phrasing worth repeating \u2014 from Eric, Jasper, or effective call moments)\n\n" +
    "## Training & Coaching Notes\n(Lessons, best practices, or rep guidance extracted from this document)";

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
// APPEND TO OUTPUT DOC
// ============================================================

function appendToDoc_id(outputFolder, docName, entry, sourceFile) {
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

function writeAuditLog_id(stats) {
  var folder = DriveApp.getFolderById(ID_OUTPUT_FOLDER);
  var entry = "---\nRUN: buildInsightDocs\n" +
    "TIMESTAMP: " + new Date().toISOString() + "\n" +
    "FOLDERS_PROCESSED: " + stats.foldersProcessed + "\n" +
    "FILES_PROCESSED: " + stats.processed + "\n" +
    "FILES_SKIPPED: " + stats.skipped + "\n" +
    "FILES_ERRORED: " + stats.errored + "\n" +
    "NEW_INSIGHTS_ADDED: " + stats.insightsAdded + "\n" +
    "EVERGREEN_INSIGHTS: " + stats.evergreenInsights + "\n" +
    "TIME_SENSITIVE_INSIGHTS: " + stats.timeSensitiveInsights + "\n" +
    "---";

  var files = folder.getFilesByName(ID_PROCESSING_LOG);
  if (files.hasNext()) {
    var file = files.next();
    var existing = file.getBlob().getDataAsString();
    file.setContent(entry + "\n\n" + existing);
  } else {
    folder.createFile(ID_PROCESSING_LOG, "# Processing Audit Log\n\n" + entry, "text/markdown");
  }
}


// ============================================================
// TRIGGER SETUP
// ============================================================

function setupTrigger_InsightDocs() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "buildInsightDocs") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger("buildInsightDocs")
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(8)
    .create();
  Logger.log("Trigger set: buildInsightDocs \u2014 Mondays at 8:00 UTC (1:00 AM PDT)");
}


// ============================================================
// RESET
// ============================================================

function resetInsightDocsProgress() {
  var props = PropertiesService.getScriptProperties();
  props.deleteProperty("LAST_RUN_INSIGHT_DOCS");
  props.deleteProperty("ID_BATCH_DONE_IDS");
  props.deleteProperty("ID_BATCH_STATS");
  props.deleteProperty("doneIds");
  clearResumeTriggers_ID();
  Logger.log("Progress reset. Run buildInsightDocs() to start fresh.");
}
