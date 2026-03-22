// ═══════════════════════════════════════════════════════════════════
// PodcastSync.gs — Weekly podcast + website scraper for Wyle KB
// Paste into the same Apps Script project as Code.gs
// ═══════════════════════════════════════════════════════════════════

var PODCAST_URL = "https://freewyldfoundry.com/podcast";
var SITE_PAGES = [
  "https://freewyldfoundry.com",
  "https://freewyldfoundry.com/about",
  "https://freewyldfoundry.com/services",
  "https://freewyldfoundry.com/rpm"
];
var KNOWN_SPEAKERS = ["eric", "jasper", "kaye"];
var MAX_FIRST_RUN_EPISODES = 10;

// ═══════════════════════════════════════════════════════════════════
// MAIN ENTRY POINTS
// ═══════════════════════════════════════════════════════════════════

function weeklyPodcastSync() {
  var startTime = new Date();
  logToKb("Podcast sync started: " + startTime.toISOString());

  var stats = { processed: 0, skipped: 0, errors: 0 };

  try {
    // Part 1: Podcast episodes
    var episodeStats = processPodcastEpisodes(false);
    stats.processed += episodeStats.processed;
    stats.skipped += episodeStats.skipped;
    stats.errors += episodeStats.errors;
  } catch (err) {
    logToKb("Podcast scrape error: " + err.message);
    stats.errors++;
  }

  try {
    // Part 2: Website brand voice
    processWebsiteBrandVoice();
  } catch (err) {
    logToKb("Brand voice scrape error: " + err.message);
    stats.errors++;
  }

  // Part 3: Trigger KB rewrite
  try {
    triggerKbRewrite();
  } catch (err) {
    logToKb("KB rewrite trigger failed: " + err.message);
  }

  var summary = "Podcast sync complete: " + stats.processed + " episodes processed, " +
    stats.skipped + " skipped, " + stats.errors + " errors";
  logToKb(summary);
  Logger.log(summary);
}

function manualPodcastSync() {
  logToKb("Manual podcast sync started");
  var stats = { processed: 0, skipped: 0, errors: 0 };

  try {
    stats = processPodcastEpisodes(true);
  } catch (err) {
    logToKb("Manual sync error: " + err.message);
    stats.errors++;
  }

  try {
    processWebsiteBrandVoice();
  } catch (err) {
    logToKb("Brand voice scrape error: " + err.message);
  }

  try {
    triggerKbRewrite();
  } catch (err) {
    logToKb("KB rewrite trigger failed: " + err.message);
  }

  var summary = "Manual sync complete: " + stats.processed + " processed, " +
    stats.skipped + " skipped, " + stats.errors + " errors";
  logToKb(summary);
  Logger.log(summary);
}

function setupWeeklyTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "weeklyPodcastSync") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger("weeklyPodcastSync")
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(6)
    .create();
  Logger.log("Weekly trigger set: Mondays at 6:00 AM");
}

// ═══════════════════════════════════════════════════════════════════
// HISTORICAL SYNC — processes ALL episodes with resume capability
// ═══════════════════════════════════════════════════════════════════

function historicalPodcastSync() {
  var props = PropertiesService.getScriptProperties();

  // Don't run if already completed
  if (isHistoricalSyncComplete()) {
    Logger.log("Historical sync already complete. Delete HISTORICAL_SYNC_COMPLETE property to re-run.");
    return;
  }

  var startTime = Date.now();
  var MAX_RUNTIME_MS = 5 * 60 * 1000; // 5 min safety margin (Apps Script limit is 6)

  // Get or build the full episode list
  var allUrlsJson = props.getProperty("HISTORICAL_SYNC_URLS");
  var allUrls;
  if (allUrlsJson) {
    allUrls = JSON.parse(allUrlsJson);
  } else {
    Logger.log("Scraping all episode URLs...");
    allUrls = scrapePodcastEpisodeUrls();
    if (allUrls.length === 0) {
      Logger.log("No episodes found.");
      return;
    }
    props.setProperty("HISTORICAL_SYNC_URLS", JSON.stringify(allUrls));
    Logger.log("Found " + allUrls.length + " total episodes");
  }

  // Get progress
  var progressJson = props.getProperty("HISTORICAL_SYNC_PROGRESS");
  var progress = progressJson ? JSON.parse(progressJson) : { index: 0, processed: 0, skipped: 0, errors: 0 };

  Logger.log("Resuming from episode " + progress.index + " of " + allUrls.length);

  var batchCount = 0;

  while (progress.index < allUrls.length) {
    // Check time limit
    if (Date.now() - startTime > MAX_RUNTIME_MS) {
      Logger.log("Approaching time limit. Saving progress at episode " + progress.index);
      props.setProperty("HISTORICAL_SYNC_PROGRESS", JSON.stringify(progress));
      logToKb("Historical sync paused at " + progress.index + "/" + allUrls.length +
        " — " + progress.processed + " processed, " + progress.skipped + " skipped, " + progress.errors + " errors. Run again to continue.");
      // Set a trigger to auto-resume in 2 minutes
      setupResumeTrigger();
      return;
    }

    var url = allUrls[progress.index];
    try {
      var result = processEpisode(url);
      if (result) {
        progress.processed++;
      } else {
        progress.skipped++;
      }
    } catch (err) {
      Logger.log("Error processing " + url + ": " + err.message);
      progress.errors++;
    }

    progress.index++;
    batchCount++;

    // Save progress every 3 episodes
    if (batchCount % 3 === 0) {
      props.setProperty("HISTORICAL_SYNC_PROGRESS", JSON.stringify(progress));
      Logger.log("Progress: " + progress.index + "/" + allUrls.length);
    }

    // Pause every 3 episodes for rate limits
    if (batchCount % 3 === 0 && progress.index < allUrls.length) {
      Utilities.sleep(15000);
    }
  }

  // All done
  var summary = "Historical sync COMPLETE: " + progress.processed + " processed, " +
    progress.skipped + " skipped, " + progress.errors + " errors out of " + allUrls.length + " episodes";
  Logger.log(summary);
  logToKb(summary);

  // Mark complete and clean up
  props.setProperty("HISTORICAL_SYNC_COMPLETE", "true");
  props.deleteProperty("HISTORICAL_SYNC_URLS");
  props.deleteProperty("HISTORICAL_SYNC_PROGRESS");

  // Remove resume trigger if exists
  clearResumeTriggers();

  // Process website brand voice
  try {
    processWebsiteBrandVoice();
  } catch (err) {
    Logger.log("Brand voice error: " + err.message);
  }

  // Trigger KB rewrite
  try {
    triggerKbRewrite();
    logToKb("KB rewrite triggered after historical sync");
  } catch (err) {
    Logger.log("KB rewrite failed: " + err.message);
  }
}

function isHistoricalSyncComplete() {
  return PropertiesService.getScriptProperties().getProperty("HISTORICAL_SYNC_COMPLETE") === "true";
}

function resetHistoricalSync() {
  var props = PropertiesService.getScriptProperties();
  props.deleteProperty("HISTORICAL_SYNC_COMPLETE");
  props.deleteProperty("HISTORICAL_SYNC_URLS");
  props.deleteProperty("HISTORICAL_SYNC_PROGRESS");
  clearResumeTriggers();
  Logger.log("Historical sync reset. Run historicalPodcastSync() to start fresh.");
}

function setupResumeTrigger() {
  clearResumeTriggers();
  ScriptApp.newTrigger("historicalPodcastSync")
    .timeBased()
    .after(2 * 60 * 1000) // 2 minutes
    .create();
  Logger.log("Resume trigger set for 2 minutes from now");
}

function clearResumeTriggers() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "historicalPodcastSync") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
// PART 1: PODCAST SCRAPER
// ═══════════════════════════════════════════════════════════════════

function processPodcastEpisodes(isManual) {
  var props = PropertiesService.getScriptProperties();
  var lastScrape = props.getProperty("LAST_PODCAST_SCRAPE");
  var processedList = props.getProperty("PODCAST_EPISODES_PROCESSED") || "";
  var processedUrls = processedList ? processedList.split(",") : [];

  var stats = { processed: 0, skipped: 0, errors: 0 };

  // Fetch podcast page
  var episodeUrls = scrapePodcastEpisodeUrls();
  if (episodeUrls.length === 0) {
    Logger.log("No episode URLs found on podcast page");
    return stats;
  }

  Logger.log("Found " + episodeUrls.length + " episode URLs");

  // Determine which episodes to process
  var toProcess = [];

  if (isManual) {
    // Manual: process 5 most recent regardless
    toProcess = episodeUrls.slice(0, 5);
  } else if (!lastScrape) {
    // First run: process 10 most recent
    toProcess = episodeUrls.slice(0, MAX_FIRST_RUN_EPISODES);
  } else {
    // Weekly: only new episodes not in processed list
    for (var i = 0; i < episodeUrls.length; i++) {
      if (processedUrls.indexOf(episodeUrls[i]) === -1) {
        toProcess.push(episodeUrls[i]);
      }
    }
  }

  Logger.log("Episodes to process: " + toProcess.length);

  for (var j = 0; j < toProcess.length; j++) {
    var url = toProcess[j];
    try {
      var result = processEpisode(url);
      if (result) {
        stats.processed++;
        if (processedUrls.indexOf(url) === -1) {
          processedUrls.push(url);
        }
      } else {
        stats.skipped++;
      }
    } catch (err) {
      Logger.log("Error processing " + url + ": " + err.message);
      stats.errors++;
    }

    // Pause every 3 episodes to avoid rate limits
    if (j > 0 && j % 3 === 0 && j < toProcess.length - 1) {
      Logger.log("Pausing 15s after batch...");
      Utilities.sleep(15000);
    }
  }

  // Update properties
  props.setProperty("LAST_PODCAST_SCRAPE", new Date().toISOString());
  // Keep last 200 processed URLs to avoid property size limits
  if (processedUrls.length > 200) {
    processedUrls = processedUrls.slice(processedUrls.length - 200);
  }
  props.setProperty("PODCAST_EPISODES_PROCESSED", processedUrls.join(","));

  return stats;
}

function scrapePodcastEpisodeUrls() {
  var allUrls = [];

  try {
    var pageUrl = PODCAST_URL;
    var maxPages = 10;

    for (var page = 0; page < maxPages; page++) {
      var html = fetchPage(pageUrl);
      if (!html) break;

      // Extract episode links — look for links to individual episode pages
      // Common patterns: /podcast/episode-slug, /podcast/ep-123, etc.
      var linkPattern = /href=["'](https?:\/\/freewyldfoundry\.com\/podcast\/[^"'#?]+)["']/gi;
      var match;
      while ((match = linkPattern.exec(html)) !== null) {
        var episodeUrl = match[1].replace(/\/$/, "");
        // Skip the main podcast page itself
        if (episodeUrl !== PODCAST_URL && episodeUrl !== PODCAST_URL + "/" && allUrls.indexOf(episodeUrl) === -1) {
          allUrls.push(episodeUrl);
        }
      }

      // Also check for relative links
      var relPattern = /href=["'](\/podcast\/[^"'#?]+)["']/gi;
      while ((match = relPattern.exec(html)) !== null) {
        var fullUrl = "https://freewyldfoundry.com" + match[1].replace(/\/$/, "");
        if (fullUrl !== PODCAST_URL && fullUrl !== PODCAST_URL + "/" && allUrls.indexOf(fullUrl) === -1) {
          allUrls.push(fullUrl);
        }
      }

      // Check for pagination — next page link
      var nextPattern = /href=["']([^"']*[?&]page=\d+[^"']*)["'][^>]*>.*?[Nn]ext/gi;
      var nextMatch = nextPattern.exec(html);
      if (!nextMatch) {
        // Also try common pagination patterns
        var pageNumPattern = /href=["'](\/podcast\/?[?&]page=(\d+))["']/gi;
        var pageMatches = [];
        var pm;
        while ((pm = pageNumPattern.exec(html)) !== null) {
          pageMatches.push({ url: "https://freewyldfoundry.com" + pm[1], num: parseInt(pm[2]) });
        }
        if (pageMatches.length > 0) {
          var currentPage = page + 1;
          var nextPageMatch = pageMatches.find(function(p) { return p.num === currentPage + 1; });
          if (nextPageMatch) {
            pageUrl = nextPageMatch.url;
            continue;
          }
        }
        break;
      } else {
        var nextUrl = nextMatch[1];
        if (nextUrl.indexOf("http") !== 0) {
          nextUrl = "https://freewyldfoundry.com" + nextUrl;
        }
        pageUrl = nextUrl;
      }
    }
  } catch (err) {
    Logger.log("Error scraping episode URLs: " + err.message);
  }

  Logger.log("Total unique episode URLs found: " + allUrls.length);
  return allUrls;
}

function processEpisode(url) {
  Logger.log("Processing episode: " + url);

  var html = fetchPage(url);
  if (!html) {
    Logger.log("Failed to fetch: " + url);
    return false;
  }

  // Extract episode title
  var titleMatch = html.match(/<h1[^>]*>(.*?)<\/h1>/i) || html.match(/<title>(.*?)<\/title>/i);
  var episodeTitle = titleMatch ? stripHtml(titleMatch[1]).trim() : "Unknown Episode";

  // Extract transcript content — look for common transcript containers
  var transcript = extractTranscript(html);
  if (!transcript || transcript.length < 100) {
    Logger.log("No transcript found for: " + episodeTitle);
    return false;
  }

  // Parse transcript into speaker segments
  var segments = parseTranscriptBySpeaker(transcript);
  if (segments.length === 0) {
    Logger.log("Could not parse speakers in: " + episodeTitle);
    // Treat entire transcript as unattributed content
    segments = [{ speaker: "unknown", text: transcript }];
  }

  // Group by speaker
  var grouped = {};
  for (var i = 0; i < segments.length; i++) {
    var speaker = segments[i].speaker.toLowerCase();
    if (!grouped[speaker]) grouped[speaker] = [];
    grouped[speaker].push(segments[i].text);
  }

  // Route to agents
  var ericText = (grouped["eric"] || []).join("\n\n");
  var jasperText = (grouped["jasper"] || []).join("\n\n");

  // Kaye + guest text
  var insightsTexts = [];
  for (var spk in grouped) {
    if (spk !== "eric" && spk !== "jasper") {
      insightsTexts.push(grouped[spk].join("\n\n"));
    }
  }
  var insightsText = insightsTexts.join("\n\n");

  // Process Eric → CEO Agent
  if (ericText.length > 50) {
    try {
      var ceoExtract = callClaude(
        "You are updating the CEO Agent file for Wyle, an AI sales assistant for Freewyld Foundry. " +
        "Below are transcript excerpts where Eric (the CEO/founder) is speaking. Extract:\n" +
        "- Key phrases and language patterns Eric uses\n" +
        "- Vision and mission statements\n" +
        "- Stories or analogies he tells\n" +
        "- How he explains Freewyld's value proposition\n" +
        "- His perspective on the STR industry\n" +
        "Return ONLY a concise markdown section titled '## Recent Voice Patterns \u2014 " + episodeTitle + "' " +
        "with bullet points of extracted insights. Maximum 300 words. No preamble.",
        ericText
      );
      if (ceoExtract && ceoExtract !== "SKIP") {
        appendToKbFile("Agent-CEO.md", "\n\n" + ceoExtract);
      }
    } catch (err) {
      Logger.log("Claude error (CEO): " + err.message);
    }
    Utilities.sleep(3000);

    // Eric → Sales Agent extraction
    try {
      var salesFromEric = callClaude(
        "Extract any language, stories, framings, or talking points from this speaker (Eric, CEO of Freewyld Foundry) " +
        "that would help a salesperson close a deal. Return as a separate markdown section titled " +
        "'## Sales Insights from Eric \u2014 " + episodeTitle + "' with bullet points. Maximum 200 words. " +
        "If nothing sales-relevant was said, return 'SKIP'.",
        ericText
      );
      if (salesFromEric && salesFromEric !== "SKIP") {
        appendToKbFile("Agent-Sales.md", "\n\n" + salesFromEric);
      }
    } catch (err) {
      Logger.log("Claude error (Sales from Eric): " + err.message);
    }
    Utilities.sleep(3000);
  }

  // Process Jasper → Revenue Expert Agent
  if (jasperText.length > 50) {
    try {
      var revExtract = callClaude(
        "You are updating the Revenue Expert Agent file for Wyle, an AI sales assistant for Freewyld Foundry. " +
        "Below are transcript excerpts where Jasper (the revenue management expert) is speaking. Extract:\n" +
        "- Technical revenue management insights\n" +
        "- Specific strategies, tactics, or frameworks he mentions\n" +
        "- Data points or market observations\n" +
        "- How he explains complex concepts simply\n" +
        "Return ONLY a concise markdown section titled '## Recent Insights \u2014 " + episodeTitle + "' " +
        "with bullet points. Maximum 300 words. No preamble.",
        jasperText
      );
      if (revExtract && revExtract !== "SKIP") {
        appendToKbFile("Agent-RevenueExpert.md", "\n\n" + revExtract);
      }
    } catch (err) {
      Logger.log("Claude error (Revenue): " + err.message);
    }
    Utilities.sleep(3000);

    // Jasper → Sales Agent extraction
    try {
      var salesFromJasper = callClaude(
        "Extract any language, stories, framings, or talking points from this speaker (Jasper, revenue management expert at Freewyld Foundry) " +
        "that would help a salesperson close a deal — specifically data-backed talking points, proof points, " +
        "and how he explains value. Return as a markdown section titled " +
        "'## Sales Insights from Jasper \u2014 " + episodeTitle + "' with bullet points. Maximum 200 words. " +
        "If nothing sales-relevant was said, return 'SKIP'.",
        jasperText
      );
      if (salesFromJasper && salesFromJasper !== "SKIP") {
        appendToKbFile("Agent-Sales.md", "\n\n" + salesFromJasper);
      }
    } catch (err) {
      Logger.log("Claude error (Sales from Jasper): " + err.message);
    }
    Utilities.sleep(3000);
  }

  // Process Kaye/guests → STR Insights
  if (insightsText.length > 50) {
    try {
      var insightsExtract = callClaude(
        "Extract any broadly useful STR industry insights, market trends, or host pain points mentioned. " +
        "Return ONLY a concise markdown section titled '## STR Insights \u2014 " + episodeTitle + "' with bullet " +
        "points. Maximum 200 words. No preamble. If there are no broadly useful insights, return the string 'SKIP'.",
        insightsText
      );
      if (insightsExtract && insightsExtract !== "SKIP") {
        appendToKbFile("STR-Insights-Feed.md", "\n\n" + insightsExtract);
      }
    } catch (err) {
      Logger.log("Claude error (Insights): " + err.message);
    }

    // Kaye → Sales Agent extraction (if Kaye spoke)
    var kayeText = (grouped["kaye"] || []).join("\n\n");
    if (kayeText.length > 50) {
      Utilities.sleep(3000);
      try {
        var salesFromKaye = callClaude(
          "Extract any language, stories, framings, or talking points from this speaker (Kaye, from Freewyld Foundry) " +
          "that would help a salesperson close a deal — specifically positioning language, offer framing, and " +
          "marketing angles. Return as a markdown section titled " +
          "'## Sales Insights from Kaye \u2014 " + episodeTitle + "' with bullet points. Maximum 200 words. " +
          "If nothing sales-relevant was said, return 'SKIP'.",
          kayeText
        );
        if (salesFromKaye && salesFromKaye !== "SKIP") {
          appendToKbFile("Agent-Sales.md", "\n\n" + salesFromKaye);
        }
      } catch (err) {
        Logger.log("Claude error (Sales from Kaye): " + err.message);
      }
    }
  }

  Logger.log("Processed: " + episodeTitle);
  return true;
}

function extractTranscript(html) {
  // Try common transcript container patterns
  var patterns = [
    /<div[^>]*class="[^"]*transcript[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*id="[^"]*transcript[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<section[^>]*class="[^"]*transcript[^"]*"[^>]*>([\s\S]*?)<\/section>/i,
    /<div[^>]*class="[^"]*episode-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*class="[^"]*show-notes[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*class="[^"]*entry-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<article[^>]*>([\s\S]*?)<\/article>/i
  ];

  for (var i = 0; i < patterns.length; i++) {
    var match = html.match(patterns[i]);
    if (match && match[1]) {
      var text = stripHtml(match[1]).trim();
      if (text.length > 200) {
        return text;
      }
    }
  }

  // Fallback: look for large blocks of text that look like transcript
  // Speaker pattern: "Name:" or "Name -" at the start of paragraphs
  var bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) {
    var bodyText = stripHtml(bodyMatch[1]).trim();
    // Check if it has speaker labels
    var speakerTest = /(?:Eric|Jasper|Kaye)\s*[:—\-]/i;
    if (speakerTest.test(bodyText) && bodyText.length > 500) {
      return bodyText;
    }
  }

  return null;
}

function parseTranscriptBySpeaker(transcript) {
  var segments = [];
  // Match patterns like "Eric:", "Jasper:", "Eric -", "Eric —", "[Eric]"
  var lines = transcript.split(/\n/);
  var currentSpeaker = "unknown";
  var currentText = [];

  var speakerPattern = /^\s*\[?\s*([\w]+(?:\s+[\w]+)?)\s*\]?\s*[:—\-]\s*/i;

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();
    if (!line) continue;

    var speakerMatch = line.match(speakerPattern);
    if (speakerMatch) {
      // Save previous segment
      if (currentText.length > 0) {
        segments.push({ speaker: currentSpeaker, text: currentText.join(" ") });
        currentText = [];
      }

      var name = speakerMatch[1].toLowerCase();
      // Map to known speakers
      if (name.indexOf("eric") !== -1) currentSpeaker = "eric";
      else if (name.indexOf("jasper") !== -1) currentSpeaker = "jasper";
      else if (name.indexOf("kaye") !== -1) currentSpeaker = "kaye";
      else currentSpeaker = speakerMatch[1]; // guest name as-is

      // Rest of line after speaker label
      var rest = line.replace(speakerPattern, "").trim();
      if (rest) currentText.push(rest);
    } else {
      currentText.push(line);
    }
  }

  // Push last segment
  if (currentText.length > 0) {
    segments.push({ speaker: currentSpeaker, text: currentText.join(" ") });
  }

  return segments;
}

// ═══════════════════════════════════════════════════════════════════
// PART 2: WEBSITE BRAND VOICE SCRAPER
// ═══════════════════════════════════════════════════════════════════

function processWebsiteBrandVoice() {
  var allContent = [];

  for (var i = 0; i < SITE_PAGES.length; i++) {
    try {
      var html = fetchPage(SITE_PAGES[i]);
      if (html) {
        var text = stripHtml(html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
          .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
          .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
          .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")).trim();

        if (text.length > 100) {
          allContent.push("=== PAGE: " + SITE_PAGES[i] + " ===\n" + text.substring(0, 5000));
        }
      }
    } catch (err) {
      Logger.log("Failed to fetch " + SITE_PAGES[i] + ": " + err.message);
    }
  }

  if (allContent.length === 0) {
    Logger.log("No website content fetched");
    return;
  }

  var combined = allContent.join("\n\n");
  var dateStr = new Date().toISOString().split("T")[0];

  try {
    var brandVoice = callClaude(
      "You are maintaining a brand voice reference file for Wyle, an AI sales assistant for Freewyld Foundry. " +
      "Below is the current website content. Extract:\n" +
      "- Current offer names and descriptions\n" +
      "- Key value propositions and claims\n" +
      "- Brand language, taglines, and phrases\n" +
      "- Any pricing or guarantee language mentioned\n" +
      "- Current positioning statements\n" +
      "Return as a clean markdown document titled '# Freewyld Brand Voice \u2014 " + dateStr + "' organized by section. " +
      "Replace outdated information, do not append duplicates. Maximum 500 words.",
      combined
    );

    if (brandVoice && brandVoice.length > 50) {
      overwriteKbFile("Brand-Voice-Current.md", brandVoice);
      Logger.log("Brand voice file updated");
    }
  } catch (err) {
    Logger.log("Claude error (brand voice): " + err.message);
  }
}

// ═══════════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════════

function fetchPage(url) {
  try {
    var response = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      followRedirects: true,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; WyleBot/1.0)"
      }
    });
    var code = response.getResponseCode();
    if (code === 200) {
      return response.getContentText();
    }
    Logger.log("HTTP " + code + " for " + url);
    return null;
  } catch (err) {
    Logger.log("Fetch error for " + url + ": " + err.message);
    return null;
  }
}

function stripHtml(html) {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function callClaude(systemPrompt, userContent) {
  var apiKey = PropertiesService.getScriptProperties().getProperty("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set in Script Properties");

  var payload = {
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: "user", content: userContent.substring(0, 100000) }]
  };

  var response = UrlFetchApp.fetch("https://api.anthropic.com/v1/messages", {
    method: "post",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json"
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  var code = response.getResponseCode();
  var body = response.getContentText();

  if (code !== 200) {
    throw new Error("Claude API " + code + ": " + body.substring(0, 200));
  }

  var data = JSON.parse(body);
  if (data.content && data.content.length > 0 && data.content[0].type === "text") {
    return data.content[0].text.trim();
  }

  return null;
}

function appendToKbFile(fileName, content) {
  var folder = DriveApp.getFolderById(KB_FOLDER_ID);
  var files = folder.getFilesByName(fileName);

  if (files.hasNext()) {
    var file = files.next();
    var existing = file.getBlob().getDataAsString();
    file.setContent(existing + content);
  } else {
    folder.createFile(fileName, content.trim(), "text/markdown");
  }
}

function overwriteKbFile(fileName, content) {
  var folder = DriveApp.getFolderById(KB_FOLDER_ID);
  var files = folder.getFilesByName(fileName);

  if (files.hasNext()) {
    var file = files.next();
    file.setContent(content);
  } else {
    folder.createFile(fileName, content, "text/markdown");
  }
}

function logToKb(message) {
  var folder = DriveApp.getFolderById(KB_FOLDER_ID);
  var files = folder.getFilesByName(LOG_FILE_NAME);
  var timestamp = new Date().toISOString();
  var entry = "Podcast sync: " + timestamp + " \u2014 " + message;

  if (files.hasNext()) {
    var file = files.next();
    var existing = file.getBlob().getDataAsString();
    file.setContent(entry + "\n" + existing);
  } else {
    folder.createFile(LOG_FILE_NAME, entry, "text/plain");
  }
}

function triggerKbRewrite() {
  // Read all sources, compile with Claude, write to master
  var folder = DriveApp.getFolderById(KB_FOLDER_ID);
  var files = folder.getFiles();
  var sources = [];

  while (files.hasNext()) {
    var file = files.next();
    var name = file.getName();
    if (file.getId() !== MASTER_FILE_ID && name !== LOG_FILE_NAME) {
      sources.push("=== SOURCE: " + name + " ===\n\n" + file.getBlob().getDataAsString());
    }
  }

  if (sources.length === 0) return;

  var compiled = sources.join("\n\n");

  var rewritePrompt = "You are compiling a knowledge base for Wyle, an AI assistant for Freewyld Foundry. " +
    "Below are the contents of multiple source documents (transcripts, company docs, manual updates, agent definitions, etc.).\n\n" +
    "Please compile all of these into a single, clean, well-organized knowledge base document in Markdown format that:\n" +
    "- Synthesizes all information from all source documents\n" +
    "- Organizes content by topic with clear headers\n" +
    "- Removes contradictions (prefer information from more recent docs)\n" +
    "- Eliminates duplicates\n" +
    "- Preserves all important facts, processes, and company knowledge\n" +
    "- Never includes customer names, emails, transaction data, or any client-specific information\n" +
    "- Includes a 'Last compiled: [current date]' line at the top\n\n" +
    "Return only the compiled knowledge base document. No preamble, no explanation.";

  var result = callClaude(rewritePrompt, compiled.substring(0, 150000));

  if (result && result.length > 500) {
    var masterFile = DriveApp.getFileById(MASTER_FILE_ID);
    masterFile.setContent(result);

    // Log the rewrite
    var timestamp = new Date().toISOString();
    logToKb("KB rewrite completed after podcast sync \u2014 " + sources.length + " source docs compiled");
    Logger.log("KB rewrite complete: " + result.length + " chars");
  }
}
