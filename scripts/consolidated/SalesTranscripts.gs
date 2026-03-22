// ============================================================
// SalesTranscripts.gs — Sales call transcript pipeline
// Uses: Config.gs, Shared.gs
// ============================================================

function processNewSalesTranscripts() {
  var props = PropertiesService.getScriptProperties();
  var apiKey = getApiKey();
  var output = DriveApp.getFolderById(CONFIG.KB_OUTPUT_FOLDER);
  var startTime = Date.now();

  var lastRunStr = props.getProperty("LAST_RUN_SALES_TRANSCRIPTS");
  var lastRun = lastRunStr ? new Date(lastRunStr) : null;

  var batchDone = new Set(JSON.parse(props.getProperty("ST_BATCH_DONE_IDS") || "[]"));
  var stats = JSON.parse(props.getProperty("ST_BATCH_STATS") || "null") || {
    processed: 0, skipped: 0, errored: 0, insightsAdded: 0,
    speakerSegments: 0, evergreenInsights: 0, timeSensitiveInsights: 0
  };

  var files = getSalesFiles(lastRun);
  var remaining = files.filter(function(f) { return !batchDone.has(f.id); });

  Logger.log("Total: " + files.length + ", Done: " + batchDone.size + ", Remaining: " + remaining.length);

  if (remaining.length === 0) { finalizeSalesRun(props, stats); return; }

  var timedOut = false;

  for (var i = 0; i < remaining.length; i++) {
    if (Date.now() - startTime > CONFIG.MAX_RUN_MS) { timedOut = true; break; }

    var f = remaining[i];
    try {
      var content = DriveApp.getFileById(f.id).getBlob().getDataAsString();
      if (!content || content.trim().length < 100) { stats.skipped++; batchDone.add(f.id); continue; }

      var segments = parseSpeakerSegments(content);
      stats.speakerSegments += segments.length;
      var weight = calculateWeight(f.created);
      var insights = extractSalesInsights(content, f.name, segments, weight);

      if (insights) {
        var counts = countInsightTypes(insights);
        stats.evergreenInsights += counts.evergreen;
        stats.timeSensitiveInsights += counts.timeSensitive;
        var header = buildMetaHeader(f.name, "sales", f.created, weight, "TRANSCRIPT");
        appendToKBDoc(output, CONFIG.KB_DOCS.sales, header + insights);
        stats.insightsAdded++;
        Logger.log("Processed: " + f.name);
      } else { stats.skipped++; }

      stats.processed++;
      batchDone.add(f.id);
    } catch (e) {
      Logger.log("ERROR: " + f.name + " \u2014 " + e.message);
      stats.errored++;
      batchDone.add(f.id);
    }

    props.setProperty("ST_BATCH_DONE_IDS", JSON.stringify(Array.from(batchDone)));
    props.setProperty("ST_BATCH_STATS", JSON.stringify(stats));
    Utilities.sleep(CONFIG.SLEEP_MS);
  }

  if (timedOut) {
    props.setProperty("ST_BATCH_DONE_IDS", JSON.stringify(Array.from(batchDone)));
    props.setProperty("ST_BATCH_STATS", JSON.stringify(stats));
    scheduleResume_ST();
  } else {
    finalizeSalesRun(props, stats);
  }
}

function getSalesFiles(lastRun) {
  var folder = DriveApp.getFolderById(CONFIG.SALES_FOLDER);
  var results = [];
  collectTxtFiles(folder, results);
  if (lastRun) {
    results = results.filter(function(f) { return f.created > lastRun || f.modified > lastRun; });
  }
  results.sort(function(a, b) { return a.created - b.created; });
  return results;
}

function extractSalesInsights(content, fileName, segments, weight) {
  var truncated = content.length > 12000 ? content.substring(0, 12000) + "\n\n[truncated]" : content;
  var speakerSummary = buildSpeakerSummary(segments);
  var tagging = getTaggingInstructions("sales");

  var prompt = "You are building a sales knowledge base for Wyle, the Freewyld Foundry Sales Intelligence Agent.\n\n" +
    "This content is " + weight + " recency." + speakerSummary + "\n\n" + tagging + "\n" +
    "Transcript: " + fileName + "\n\n" + truncated + "\n\n" +
    "Return ONLY these sections. Write \"None noted.\" if empty. No preamble.\n\n" +
    "## Objections & How They Were Handled\n## Winning Language & Phrases\n## Questions the Lead Asked\n" +
    "## Buying Signals\n## Hesitation Patterns\n## Key Pain Points Mentioned\n" +
    "## Follow-Up Triggers\n## Talk Track Snippets\n## Coaching Notes";

  return callClaude(prompt, 1500);
}

function finalizeSalesRun(props, stats) {
  props.setProperty("LAST_RUN_SALES_TRANSCRIPTS", new Date().toISOString());
  props.deleteProperty("ST_BATCH_DONE_IDS");
  props.deleteProperty("ST_BATCH_STATS");
  clearResumeTriggers_ST();
  ensureWeeklyTrigger_ST();
  Logger.log("Sales done. Processed: " + stats.processed + ", Skipped: " + stats.skipped + ", Errors: " + stats.errored);
  writeAuditLog("processNewSalesTranscripts", stats);
  compileMasterPrompt();
}

function scheduleResume_ST() {
  clearResumeTriggers_ST();
  ScriptApp.newTrigger("processNewSalesTranscripts").timeBased().after(2 * 60 * 1000).create();
  Logger.log("ST resume in 2 min");
}

function clearResumeTriggers_ST() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "processNewSalesTranscripts") {
      try { ScriptApp.deleteTrigger(triggers[i]); } catch (e) {}
    }
  }
}

function ensureWeeklyTrigger_ST() {
  var found = false;
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "processNewSalesTranscripts") { found = true; break; }
  }
  if (!found) {
    ScriptApp.newTrigger("processNewSalesTranscripts").timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(10).create();
  }
}

function setupTrigger_SalesTranscripts() {
  clearResumeTriggers_ST();
  ScriptApp.newTrigger("processNewSalesTranscripts").timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(10).create();
  Logger.log("Trigger: processNewSalesTranscripts Mon 10 UTC");
}

function resetSTProgress() {
  var props = PropertiesService.getScriptProperties();
  props.deleteProperty("LAST_RUN_SALES_TRANSCRIPTS");
  props.deleteProperty("ST_BATCH_DONE_IDS");
  props.deleteProperty("ST_BATCH_STATS");
  clearResumeTriggers_ST();
  Logger.log("Sales transcript progress reset.");
}

function checkState_ST() {
  var props = PropertiesService.getScriptProperties();
  Logger.log("LAST_RUN: " + props.getProperty("LAST_RUN_SALES_TRANSCRIPTS"));
  Logger.log("BATCH_DONE: " + (JSON.parse(props.getProperty("ST_BATCH_DONE_IDS") || "[]")).length + " files");
  Logger.log("BATCH_STATS: " + props.getProperty("ST_BATCH_STATS"));
}
