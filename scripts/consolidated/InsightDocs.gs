// ============================================================
// InsightDocs.gs — Company document insight extraction
// Uses: Config.gs, Shared.gs
// ============================================================

function buildInsightDocs() {
  var props = PropertiesService.getScriptProperties();
  var apiKey = getApiKey();
  var output = DriveApp.getFolderById(CONFIG.KB_OUTPUT_FOLDER);
  var startTime = Date.now();

  var lastRunStr = props.getProperty("LAST_RUN_INSIGHT_DOCS");
  var lastRun = lastRunStr ? new Date(lastRunStr) : null;

  var batchDone = new Set(JSON.parse(props.getProperty("ID_BATCH_DONE_IDS") || "[]"));
  var stats = JSON.parse(props.getProperty("ID_BATCH_STATS") || "null") || {
    foldersProcessed: 0, processed: 0, skipped: 0, errored: 0,
    insightsAdded: 0, evergreenInsights: 0, timeSensitiveInsights: 0
  };

  var timedOut = false;
  var foldersWithWork = 0;

  for (var fi = 0; fi < CONFIG.INSIGHT_FOLDERS.length; fi++) {
    if (timedOut) break;
    var folderDef = CONFIG.INSIGHT_FOLDERS[fi];
    var files = [];
    collectAllFiles(DriveApp.getFolderById(folderDef.id), files);

    if (lastRun) {
      files = files.filter(function(f) { return f.created > lastRun || f.modified > lastRun; });
    }
    var remaining = files.filter(function(f) { return !batchDone.has(f.id); });
    if (remaining.length === 0) continue;
    foldersWithWork++;
    Logger.log("[" + folderDef.name + "] " + remaining.length + " files");

    for (var i = 0; i < remaining.length; i++) {
      if (Date.now() - startTime > CONFIG.MAX_RUN_MS) { timedOut = true; break; }

      var f = remaining[i];
      try {
        var text = extractTextFromFile(f);
        if (!text || text.trim().length < 100) { stats.skipped++; batchDone.add(f.id); continue; }

        var hasSpeakers = /^\s*[\w]+(?:\s+[\w]+)?\s*:\s*/m.test(text);
        var speakerContext = hasSpeakers ? "doc-attributed" : "doc";
        var weight = calculateWeight(f.created);

        var insights = extractDocInsights(text, folderDef.name, f.name, weight, speakerContext);
        if (insights) {
          var counts = countInsightTypes(insights);
          stats.evergreenInsights += counts.evergreen;
          stats.timeSensitiveInsights += counts.timeSensitive;

          // Map folder name to KB doc
          var docKey = folderDef.name.toLowerCase();
          var kbDocName = null;
          if (docKey.indexOf("market") !== -1) kbDocName = CONFIG.KB_DOCS.marketIntelligence;
          else if (docKey.indexOf("operations") !== -1 || docKey.indexOf("onboarding") !== -1) kbDocName = CONFIG.KB_DOCS.operations;
          else if (docKey.indexOf("pricing") !== -1 || docKey.indexOf("contracts") !== -1) kbDocName = CONFIG.KB_DOCS.pricing;
          else if (docKey.indexOf("systems") !== -1 || docKey.indexOf("processes") !== -1) kbDocName = CONFIG.KB_DOCS.systems;
          else if (docKey.indexOf("training") !== -1 || docKey.indexOf("education") !== -1) kbDocName = CONFIG.KB_DOCS.trainingDocs;
          else kbDocName = CONFIG.KB_DOCS.unsorted;

          var header = buildMetaHeader(f.name, folderDef.name, f.created, weight, "DOCUMENT");
          appendToKBDoc(output, kbDocName, header + insights);
          stats.insightsAdded++;
          Logger.log("Processed: " + folderDef.name + "/" + f.name);
        } else { stats.skipped++; }

        stats.processed++;
        batchDone.add(f.id);
      } catch (e) {
        Logger.log("ERROR: " + f.name + " \u2014 " + e.message);
        stats.errored++;
        batchDone.add(f.id);
      }

      props.setProperty("ID_BATCH_DONE_IDS", JSON.stringify(Array.from(batchDone)));
      props.setProperty("ID_BATCH_STATS", JSON.stringify(stats));
      Utilities.sleep(CONFIG.SLEEP_MS);
    }
  }

  stats.foldersProcessed += foldersWithWork;

  if (timedOut) {
    props.setProperty("ID_BATCH_DONE_IDS", JSON.stringify(Array.from(batchDone)));
    props.setProperty("ID_BATCH_STATS", JSON.stringify(stats));
    scheduleResume_ID();
  } else {
    finalizeInsightDocsRun(props, stats);
  }
}

function extractDocInsights(content, folderName, fileName, weight, speakerContext) {
  var truncated = content.length > 12000 ? content.substring(0, 12000) + "\n\n[truncated]" : content;
  var tagging = getTaggingInstructions(speakerContext);

  var prompt = "You are building a sales knowledge base for the Freewyld Foundry Sales Intelligence Agent.\n\n" +
    "This content is " + weight + " recency.\nDocument folder: " + folderName + "\nDocument: " + fileName + "\n\n" +
    tagging + "\n" +
    "Extract only insights a Freewyld sales rep needs.\n\nDocument:\n" + truncated + "\n\n" +
    "Return ONLY these sections. Write \"None noted.\" if empty. No preamble.\n\n" +
    "## Key Talking Points & Facts\n## Objection Handling\n## Value Propositions\n" +
    "## Pricing & Contract Knowledge\n## Process & Onboarding Knowledge\n" +
    "## Market & Competitive Context\n## Talk Track Snippets\n## Training & Coaching Notes";

  return callClaude(prompt, 1500);
}

function finalizeInsightDocsRun(props, stats) {
  props.setProperty("LAST_RUN_INSIGHT_DOCS", new Date().toISOString());
  props.deleteProperty("ID_BATCH_DONE_IDS");
  props.deleteProperty("ID_BATCH_STATS");
  clearResumeTriggers_ID();
  ensureWeeklyTrigger_ID();
  Logger.log("InsightDocs done. Processed: " + stats.processed + ", Skipped: " + stats.skipped + ", Errors: " + stats.errored);
  writeAuditLog("buildInsightDocs", stats);
}

function scheduleResume_ID() {
  clearResumeTriggers_ID();
  ScriptApp.newTrigger("buildInsightDocs").timeBased().after(2 * 60 * 1000).create();
  Logger.log("ID resume in 2 min");
}

function clearResumeTriggers_ID() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "buildInsightDocs") {
      try { ScriptApp.deleteTrigger(triggers[i]); } catch (e) {}
    }
  }
}

function ensureWeeklyTrigger_ID() {
  var found = false;
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "buildInsightDocs") { found = true; break; }
  }
  if (!found) {
    ScriptApp.newTrigger("buildInsightDocs").timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(8).create();
  }
}

function setupTrigger_InsightDocs() {
  clearResumeTriggers_ID();
  ScriptApp.newTrigger("buildInsightDocs").timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(8).create();
  Logger.log("Trigger: buildInsightDocs Mon 8 UTC");
}

function resetInsightDocsProgress() {
  var props = PropertiesService.getScriptProperties();
  props.deleteProperty("LAST_RUN_INSIGHT_DOCS");
  props.deleteProperty("ID_BATCH_DONE_IDS");
  props.deleteProperty("ID_BATCH_STATS");
  clearResumeTriggers_ID();
  Logger.log("InsightDocs progress reset.");
}

function checkState_ID() {
  var props = PropertiesService.getScriptProperties();
  Logger.log("LAST_RUN: " + props.getProperty("LAST_RUN_INSIGHT_DOCS"));
  Logger.log("BATCH_DONE: " + (JSON.parse(props.getProperty("ID_BATCH_DONE_IDS") || "[]")).length);
  Logger.log("BATCH_STATS: " + props.getProperty("ID_BATCH_STATS"));
}
