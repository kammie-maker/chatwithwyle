// ============================================================
// FathomTranscripts.gs — Fathom call transcript pipeline
// Uses: Config.gs, Shared.gs
// ============================================================

function buildKnowledgeBase() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) { Logger.log("Another run in progress."); return; }

  var props = PropertiesService.getScriptProperties();
  var apiKey = getApiKey();
  var sourceRoot = DriveApp.getFolderById(CONFIG.FATHOM_SOURCE_FOLDER);
  var outputRoot = DriveApp.getFolderById(CONFIG.KB_OUTPUT_FOLDER);
  var startTime = Date.now();

  var lastRunStr = props.getProperty("LAST_RUN_FATHOM_TRANSCRIPTS");
  var lastRun = lastRunStr ? new Date(lastRunStr) : null;

  var batchDone = new Set(JSON.parse(props.getProperty("FT_BATCH_DONE_IDS") || "[]"));
  var stats = JSON.parse(props.getProperty("FT_BATCH_STATS") || "null") || {
    subfoldersProcessed: 0, processed: 0, skipped: 0, errored: 0,
    insightsAdded: 0, speakerSegments: 0, evergreenInsights: 0, timeSensitiveInsights: 0
  };

  var timedOut = false;
  var subfoldersWithWork = 0;

  for (var ci = 0; ci < CONFIG.CALL_TYPES.length; ci++) {
    if (timedOut) break;
    var callType = CONFIG.CALL_TYPES[ci];
    var folders = sourceRoot.getFoldersByName(callType);
    if (!folders.hasNext()) { Logger.log("WARNING: Subfolder \"" + callType + "\" not found."); continue; }

    var folder = folders.next();
    var files = [];
    var fileIter = folder.getFilesByType(MimeType.PLAIN_TEXT);
    while (fileIter.hasNext()) {
      var f = fileIter.next();
      files.push({ id: f.getId(), name: f.getName(), callType: callType, created: f.getDateCreated(), modified: f.getLastUpdated() });
    }

    if (lastRun) { files = files.filter(function(f) { return f.created > lastRun || f.modified > lastRun; }); }
    var remaining = files.filter(function(f) { return !batchDone.has(f.id); });
    if (remaining.length === 0) continue;
    subfoldersWithWork++;
    Logger.log("[" + callType + "] " + remaining.length + " files");

    for (var i = 0; i < remaining.length; i++) {
      if (Date.now() - startTime > CONFIG.MAX_RUN_MS) { timedOut = true; break; }

      var item = remaining[i];
      try {
        var content = DriveApp.getFileById(item.id).getBlob().getDataAsString();
        if (!content || content.trim().length < 100) { stats.skipped++; batchDone.add(item.id); continue; }

        var segments = parseSpeakerSegments(content);
        stats.speakerSegments += segments.length;
        var weight = calculateWeight(item.created);
        var insights = extractInsights_ft(content, item.callType, item.name, segments, weight);

        if (insights) {
          var counts = countInsightTypes(insights);
          stats.evergreenInsights += counts.evergreen;
          stats.timeSensitiveInsights += counts.timeSensitive;
          var header = buildMetaHeader(item.name, item.callType, item.created, weight, "FATHOM_TRANSCRIPT");
          var docName = CONFIG.KB_DOCS[item.callType] || CONFIG.KB_DOCS.unsorted;
          appendToKBDoc(outputRoot, docName, header + insights);
          stats.insightsAdded++;
          Logger.log("Processed: " + item.callType + "/" + item.name);
        } else { stats.skipped++; }

        stats.processed++;
        batchDone.add(item.id);
      } catch (e) {
        Logger.log("ERROR: " + item.name + " \u2014 " + e.message);
        stats.errored++;
        batchDone.add(item.id);
      }

      props.setProperty("FT_BATCH_DONE_IDS", JSON.stringify(Array.from(batchDone)));
      props.setProperty("FT_BATCH_STATS", JSON.stringify(stats));
      Utilities.sleep(CONFIG.SLEEP_MS);
    }
  }

  stats.subfoldersProcessed += subfoldersWithWork;

  if (timedOut) {
    props.setProperty("FT_BATCH_DONE_IDS", JSON.stringify(Array.from(batchDone)));
    props.setProperty("FT_BATCH_STATS", JSON.stringify(stats));
    scheduleResume_FT();
  } else {
    finalizeFathomRun(props, stats);
  }
  lock.releaseLock();
}

function extractInsights_ft(content, callType, fileName, segments, weight) {
  var truncated = content.length > 12000 ? content.substring(0, 12000) + "\n\n[truncated]" : content;
  var speakerSummary = buildSpeakerSummary(segments);
  var tagging = getTaggingInstructions("fathom");

  var prompt = "You are analyzing a " + callType + " call transcript for Freewyld, a short-term rental revenue management company.\n\n" +
    "This content is " + weight + " recency." + speakerSummary + "\n\n" + tagging + "\n" +
    "Transcript: " + fileName + "\n\n" + truncated + "\n\n" +
    "Return ONLY these sections. Write \"None noted.\" if empty. No preamble.\n\n" +
    "## Objections & How They Were Handled\n## Winning Language & Phrases\n## Questions Leads Asked\n" +
    "## Buying Signals\n## Hesitation Patterns\n## Key Pain Points Mentioned\n" +
    "## Follow-Up Triggers\n## Coaching Notes";

  return callClaude(prompt, 1500);
}

function finalizeFathomRun(props, stats) {
  props.setProperty("LAST_RUN_FATHOM_TRANSCRIPTS", new Date().toISOString());
  props.deleteProperty("FT_BATCH_DONE_IDS");
  props.deleteProperty("FT_BATCH_STATS");
  clearResumeTriggers_FT();
  ensureWeeklyTrigger_FT();
  Logger.log("Fathom done. Processed: " + stats.processed + ", Skipped: " + stats.skipped + ", Errors: " + stats.errored);
  writeAuditLog("buildKnowledgeBase", stats);
}

function scheduleResume_FT() {
  clearResumeTriggers_FT();
  ScriptApp.newTrigger("buildKnowledgeBase").timeBased().after(2 * 60 * 1000).create();
  Logger.log("FT resume in 2 min");
}

function clearResumeTriggers_FT() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "buildKnowledgeBase") {
      try { ScriptApp.deleteTrigger(triggers[i]); } catch (e) {}
    }
  }
}

function ensureWeeklyTrigger_FT() {
  var found = false;
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "buildKnowledgeBase") { found = true; break; }
  }
  if (!found) {
    ScriptApp.newTrigger("buildKnowledgeBase").timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(9).create();
  }
}

function setupTrigger_FathomTranscripts() {
  clearResumeTriggers_FT();
  ScriptApp.newTrigger("buildKnowledgeBase").timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(9).create();
  Logger.log("Trigger: buildKnowledgeBase Mon 9 UTC");
}

function resetFathomProgress() {
  var props = PropertiesService.getScriptProperties();
  props.deleteProperty("LAST_RUN_FATHOM_TRANSCRIPTS");
  props.deleteProperty("FT_BATCH_DONE_IDS");
  props.deleteProperty("FT_BATCH_STATS");
  clearResumeTriggers_FT();
  Logger.log("Fathom progress reset.");
}

function checkState_FT() {
  var props = PropertiesService.getScriptProperties();
  Logger.log("LAST_RUN: " + props.getProperty("LAST_RUN_FATHOM_TRANSCRIPTS"));
  Logger.log("BATCH_DONE: " + (JSON.parse(props.getProperty("FT_BATCH_DONE_IDS") || "[]")).length);
  Logger.log("BATCH_STATS: " + props.getProperty("FT_BATCH_STATS"));
}

function verifyAllProcessed_FT() {
  var sourceRoot = DriveApp.getFolderById(CONFIG.FATHOM_SOURCE_FOLDER);
  var total = 0;
  for (var ci = 0; ci < CONFIG.CALL_TYPES.length; ci++) {
    var folders = sourceRoot.getFoldersByName(CONFIG.CALL_TYPES[ci]);
    if (!folders.hasNext()) continue;
    var count = 0;
    var files = folders.next().getFilesByType(MimeType.PLAIN_TEXT);
    while (files.hasNext()) { files.next(); count++; }
    Logger.log(CONFIG.CALL_TYPES[ci] + ": " + count + " files");
    total += count;
  }
  Logger.log("Total Fathom files: " + total);
}
