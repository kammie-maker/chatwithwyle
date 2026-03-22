// ============================================================
// PodcastSync.gs — Podcast + website scraper
// Uses: Config.gs, Shared.gs
// ============================================================

function weeklyPodcastSync() {
  logToRewriteLog("Podcast sync started");
  var stats = { processed: 0, skipped: 0, errors: 0 };

  try {
    var episodeStats = processPodcastEpisodes(false);
    stats.processed += episodeStats.processed;
    stats.skipped += episodeStats.skipped;
    stats.errors += episodeStats.errors;
  } catch (err) {
    logToRewriteLog("Podcast scrape error: " + err.message);
    stats.errors++;
  }

  try { processWebsiteBrandVoice(); }
  catch (err) { logToRewriteLog("Brand voice error: " + err.message); stats.errors++; }

  try { triggerKbRewrite(); }
  catch (err) { logToRewriteLog("KB rewrite trigger failed: " + err.message); }

  var summary = "Podcast sync: " + stats.processed + " processed, " + stats.skipped + " skipped, " + stats.errors + " errors";
  logToRewriteLog(summary);
  Logger.log(summary);
}

function manualPodcastSync() {
  logToRewriteLog("Manual podcast sync started");
  var stats = { processed: 0, skipped: 0, errors: 0 };

  try { stats = processPodcastEpisodes(true); }
  catch (err) { logToRewriteLog("Manual sync error: " + err.message); stats.errors++; }

  try { processWebsiteBrandVoice(); }
  catch (err) { logToRewriteLog("Brand voice error: " + err.message); }

  try { triggerKbRewrite(); }
  catch (err) { logToRewriteLog("KB rewrite trigger failed: " + err.message); }

  Logger.log("Manual sync: " + stats.processed + " processed, " + stats.skipped + " skipped, " + stats.errors + " errors");
}

// ── Podcast Episodes ──

function processPodcastEpisodes(isManual) {
  var props = PropertiesService.getScriptProperties();
  var lastScrape = props.getProperty("LAST_PODCAST_SCRAPE");
  var processedList = props.getProperty("PODCAST_EPISODES_PROCESSED") || "";
  var processedUrls = processedList ? processedList.split(",") : [];
  var stats = { processed: 0, skipped: 0, errors: 0 };

  var episodeUrls = scrapePodcastEpisodeUrls();
  if (episodeUrls.length === 0) return stats;
  Logger.log("Found " + episodeUrls.length + " episode URLs");

  var toProcess = [];
  if (isManual) { toProcess = episodeUrls.slice(0, 5); }
  else if (!lastScrape) { toProcess = episodeUrls.slice(0, 10); }
  else { for (var i = 0; i < episodeUrls.length; i++) { if (processedUrls.indexOf(episodeUrls[i]) === -1) toProcess.push(episodeUrls[i]); } }

  for (var j = 0; j < toProcess.length; j++) {
    try {
      if (processEpisode(toProcess[j])) {
        stats.processed++;
        if (processedUrls.indexOf(toProcess[j]) === -1) processedUrls.push(toProcess[j]);
      } else { stats.skipped++; }
    } catch (err) { Logger.log("Error: " + toProcess[j] + " \u2014 " + err.message); stats.errors++; }
    if (j > 0 && j % 3 === 0 && j < toProcess.length - 1) Utilities.sleep(15000);
  }

  props.setProperty("LAST_PODCAST_SCRAPE", new Date().toISOString());
  if (processedUrls.length > 200) processedUrls = processedUrls.slice(processedUrls.length - 200);
  props.setProperty("PODCAST_EPISODES_PROCESSED", processedUrls.join(","));
  return stats;
}

function scrapePodcastEpisodeUrls() {
  var allUrls = [];
  try {
    var pageUrl = CONFIG.PODCAST_URL;
    for (var page = 0; page < 10; page++) {
      var html = fetchPage(pageUrl);
      if (!html) break;

      var linkPattern = /href=["'](https?:\/\/freewyldfoundry\.com\/podcast\/[^"'#?]+)["']/gi;
      var match;
      while ((match = linkPattern.exec(html)) !== null) {
        var u = match[1].replace(/\/$/, "");
        if (u !== CONFIG.PODCAST_URL && allUrls.indexOf(u) === -1) allUrls.push(u);
      }
      var relPattern = /href=["'](\/podcast\/[^"'#?]+)["']/gi;
      while ((match = relPattern.exec(html)) !== null) {
        var fu = "https://freewyldfoundry.com" + match[1].replace(/\/$/, "");
        if (fu !== CONFIG.PODCAST_URL && allUrls.indexOf(fu) === -1) allUrls.push(fu);
      }

      var nextPattern = /href=["']([^"']*[?&]page=\d+[^"']*)["'][^>]*>.*?[Nn]ext/gi;
      var nextMatch = nextPattern.exec(html);
      if (!nextMatch) break;
      var nextUrl = nextMatch[1];
      if (nextUrl.indexOf("http") !== 0) nextUrl = "https://freewyldfoundry.com" + nextUrl;
      pageUrl = nextUrl;
    }
  } catch (err) { Logger.log("Error scraping URLs: " + err.message); }
  return allUrls;
}

function processEpisode(url) {
  var html = fetchPage(url);
  if (!html) return false;

  var titleMatch = html.match(/<h1[^>]*>(.*?)<\/h1>/i) || html.match(/<title>(.*?)<\/title>/i);
  var title = titleMatch ? stripHtml(titleMatch[1]).trim() : "Unknown Episode";

  var transcript = extractTranscript(html);
  if (!transcript || transcript.length < 100) return false;

  var segments = parseTranscriptBySpeaker(transcript);
  if (segments.length === 0) segments = [{ speaker: "unknown", text: transcript }];

  var grouped = {};
  for (var i = 0; i < segments.length; i++) {
    var spk = segments[i].speaker.toLowerCase();
    if (!grouped[spk]) grouped[spk] = [];
    grouped[spk].push(segments[i].text);
  }

  var ericText = (grouped["eric"] || []).join("\n\n");
  var jasperText = (grouped["jasper"] || []).join("\n\n");
  var insightsTexts = [];
  for (var s in grouped) { if (s !== "eric" && s !== "jasper") insightsTexts.push(grouped[s].join("\n\n")); }
  var insightsText = insightsTexts.join("\n\n");
  var output = DriveApp.getFolderById(CONFIG.KB_OUTPUT_FOLDER);

  if (ericText.length > 50) {
    try {
      var ceo = callClaude("Extract key phrases, vision statements, stories, and value propositions from Eric (CEO/founder of Freewyld Foundry). Return as '## Recent Voice Patterns \u2014 " + title + "' with bullets. Max 300 words.\n\n" + ericText, 1000);
      if (ceo && ceo !== "SKIP") appendToKBDoc(output, "Agent-CEO.md", "\n\n" + ceo);
    } catch (e) { Logger.log("Claude CEO error: " + e.message); }
    Utilities.sleep(3000);
    try {
      var salesE = callClaude("Extract sales-relevant language from Eric. Return as '## Sales Insights from Eric \u2014 " + title + "'. Max 200 words. If nothing useful, return 'SKIP'.\n\n" + ericText, 800);
      if (salesE && salesE !== "SKIP") appendToKBDoc(output, "Agent-Sales.md", "\n\n" + salesE);
    } catch (e) { Logger.log("Claude Sales/Eric error: " + e.message); }
    Utilities.sleep(3000);
  }

  if (jasperText.length > 50) {
    try {
      var rev = callClaude("Extract technical revenue management insights from Jasper. Return as '## Recent Insights \u2014 " + title + "'. Max 300 words.\n\n" + jasperText, 1000);
      if (rev && rev !== "SKIP") appendToKBDoc(output, "Agent-RevenueExpert.md", "\n\n" + rev);
    } catch (e) { Logger.log("Claude Rev error: " + e.message); }
    Utilities.sleep(3000);
    try {
      var salesJ = callClaude("Extract sales-relevant data points from Jasper. Return as '## Sales Insights from Jasper \u2014 " + title + "'. Max 200 words. If nothing useful, return 'SKIP'.\n\n" + jasperText, 800);
      if (salesJ && salesJ !== "SKIP") appendToKBDoc(output, "Agent-Sales.md", "\n\n" + salesJ);
    } catch (e) { Logger.log("Claude Sales/Jasper error: " + e.message); }
    Utilities.sleep(3000);
  }

  if (insightsText.length > 50) {
    try {
      var ins = callClaude("Extract STR industry insights and trends. Return as '## STR Insights \u2014 " + title + "'. Max 200 words. If nothing useful, return 'SKIP'.\n\n" + insightsText, 800);
      if (ins && ins !== "SKIP") appendToKBDoc(output, CONFIG.FEED_STR_INSIGHTS, "\n\n" + ins);
    } catch (e) { Logger.log("Claude insights error: " + e.message); }

    var kayeText = (grouped["kaye"] || []).join("\n\n");
    if (kayeText.length > 50) {
      Utilities.sleep(3000);
      try {
        var salesK = callClaude("Extract positioning and offer framing from Kaye. Return as '## Sales Insights from Kaye \u2014 " + title + "'. Max 200 words. If nothing useful, return 'SKIP'.\n\n" + kayeText, 800);
        if (salesK && salesK !== "SKIP") appendToKBDoc(output, "Agent-Sales.md", "\n\n" + salesK);
      } catch (e) { Logger.log("Claude Sales/Kaye error: " + e.message); }
    }
  }

  Logger.log("Processed episode: " + title);
  return true;
}

function extractTranscript(html) {
  var patterns = [
    /<div[^>]*class="[^"]*transcript[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*id="[^"]*transcript[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<section[^>]*class="[^"]*transcript[^"]*"[^>]*>([\s\S]*?)<\/section>/i,
    /<div[^>]*class="[^"]*episode-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*class="[^"]*entry-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<article[^>]*>([\s\S]*?)<\/article>/i
  ];
  for (var i = 0; i < patterns.length; i++) {
    var match = html.match(patterns[i]);
    if (match && match[1]) { var text = stripHtml(match[1]).trim(); if (text.length > 200) return text; }
  }
  var bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) {
    var bodyText = stripHtml(bodyMatch[1]).trim();
    if (/(?:Eric|Jasper|Kaye)\s*[:—\-]/i.test(bodyText) && bodyText.length > 500) return bodyText;
  }
  return null;
}

function parseTranscriptBySpeaker(transcript) {
  var segments = [];
  var lines = transcript.split(/\n/);
  var currentSpeaker = "unknown";
  var currentText = [];
  var pattern = /^\s*\[?\s*([\w]+(?:\s+[\w]+)?)\s*\]?\s*[:—\-]\s*/i;

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();
    if (!line) continue;
    var match = line.match(pattern);
    if (match) {
      if (currentText.length > 0) segments.push({ speaker: currentSpeaker, text: currentText.join(" ") });
      currentText = [];
      var name = match[1].toLowerCase();
      if (name.indexOf("eric") !== -1) currentSpeaker = "eric";
      else if (name.indexOf("jasper") !== -1) currentSpeaker = "jasper";
      else if (name.indexOf("kaye") !== -1) currentSpeaker = "kaye";
      else currentSpeaker = match[1];
      var rest = line.replace(pattern, "").trim();
      if (rest) currentText.push(rest);
    } else { currentText.push(line); }
  }
  if (currentText.length > 0) segments.push({ speaker: currentSpeaker, text: currentText.join(" ") });
  return segments;
}

// ── Website Brand Voice ──

function processWebsiteBrandVoice() {
  var allContent = [];
  for (var i = 0; i < CONFIG.SITE_PAGES.length; i++) {
    try {
      var html = fetchPage(CONFIG.SITE_PAGES[i]);
      if (html) {
        var text = stripHtml(html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
          .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
          .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
          .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")).trim();
        if (text.length > 100) allContent.push("=== PAGE: " + CONFIG.SITE_PAGES[i] + " ===\n" + text.substring(0, 5000));
      }
    } catch (err) { Logger.log("Failed: " + CONFIG.SITE_PAGES[i] + " \u2014 " + err.message); }
  }
  if (allContent.length === 0) return;

  var dateStr = new Date().toISOString().split("T")[0];
  try {
    var brandVoice = callClaude(
      "Maintain a brand voice reference for Wyle. Extract current offers, value propositions, brand language, pricing/guarantee language, positioning. Return as '# Freewyld Brand Voice \u2014 " + dateStr + "'. Max 500 words.\n\n" + allContent.join("\n\n"),
      1500
    );
    if (brandVoice && brandVoice.length > 50) {
      overwriteKBDoc(CONFIG.KB_OUTPUT_FOLDER, CONFIG.FEED_BRAND_VOICE, brandVoice);
      Logger.log("Brand voice updated");
    }
  } catch (err) { Logger.log("Brand voice Claude error: " + err.message); }
}

// ── KB Rewrite ──

function triggerKbRewrite() {
  compileMasterPrompt();
  logToRewriteLog("KB rewrite completed after podcast sync");
}

// ── Historical Sync ──

function historicalPodcastSync() {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty("HISTORICAL_SYNC_COMPLETE") === "true") {
    Logger.log("Historical sync already complete.");
    return;
  }

  var startTime = Date.now();
  var MAX_MS = 5 * 60 * 1000;

  var allUrlsJson = props.getProperty("HISTORICAL_SYNC_URLS");
  var allUrls;
  if (allUrlsJson) { allUrls = JSON.parse(allUrlsJson); }
  else {
    allUrls = scrapePodcastEpisodeUrls();
    if (allUrls.length === 0) return;
    props.setProperty("HISTORICAL_SYNC_URLS", JSON.stringify(allUrls));
  }

  var progressJson = props.getProperty("HISTORICAL_SYNC_PROGRESS");
  var progress = progressJson ? JSON.parse(progressJson) : { index: 0, processed: 0, skipped: 0, errors: 0 };

  while (progress.index < allUrls.length) {
    if (Date.now() - startTime > MAX_MS) {
      props.setProperty("HISTORICAL_SYNC_PROGRESS", JSON.stringify(progress));
      var triggers = ScriptApp.getProjectTriggers();
      for (var i = 0; i < triggers.length; i++) { if (triggers[i].getHandlerFunction() === "historicalPodcastSync") ScriptApp.deleteTrigger(triggers[i]); }
      ScriptApp.newTrigger("historicalPodcastSync").timeBased().after(2 * 60 * 1000).create();
      return;
    }

    try {
      if (processEpisode(allUrls[progress.index])) progress.processed++;
      else progress.skipped++;
    } catch (e) { progress.errors++; }
    progress.index++;
    if (progress.index % 3 === 0) { props.setProperty("HISTORICAL_SYNC_PROGRESS", JSON.stringify(progress)); Utilities.sleep(15000); }
  }

  Logger.log("Historical sync complete: " + progress.processed + " processed");
  props.setProperty("HISTORICAL_SYNC_COMPLETE", "true");
  props.deleteProperty("HISTORICAL_SYNC_URLS");
  props.deleteProperty("HISTORICAL_SYNC_PROGRESS");
  try { processWebsiteBrandVoice(); } catch (e) {}
  try { triggerKbRewrite(); } catch (e) {}
}

function resetHistoricalSync() {
  var props = PropertiesService.getScriptProperties();
  props.deleteProperty("HISTORICAL_SYNC_COMPLETE");
  props.deleteProperty("HISTORICAL_SYNC_URLS");
  props.deleteProperty("HISTORICAL_SYNC_PROGRESS");
  Logger.log("Historical sync reset.");
}
