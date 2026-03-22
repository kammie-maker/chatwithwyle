// ============================================================
// Shared.gs — Helper functions used by all pipelines
// ============================================================

// ── Speaker Attribution ──

function parseSpeakerSegments(content) {
  var segments = [];
  var lines = content.split("\n");
  var currentSpeaker = "UNKNOWN";
  var currentText = [];
  var pattern = /^\s*([\w]+(?:\s+[\w]+)?)\s*:\s*/;

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();
    if (!line) continue;

    var match = line.match(pattern);
    if (match) {
      if (currentText.length > 0) {
        segments.push({ speaker: classifySpeaker(currentSpeaker), name: currentSpeaker, text: currentText.join(" ") });
        currentText = [];
      }
      currentSpeaker = match[1];
      var rest = line.replace(pattern, "").trim();
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
  for (var i = 0; i < CONFIG.KNOWN_REPS.length; i++) {
    if (lower.indexOf(CONFIG.KNOWN_REPS[i]) !== -1) return "REP";
  }
  var clientWords = ["client", "prospect", "lead", "guest", "customer", "owner", "host"];
  for (var j = 0; j < clientWords.length; j++) {
    if (lower.indexOf(clientWords[j]) !== -1) return "CLIENT";
  }
  return "UNKNOWN";
}

function buildSpeakerSummary(segments) {
  if (segments.length <= 1) return "";
  var speakers = {};
  for (var i = 0; i < segments.length; i++) {
    var key = segments[i].name + " [" + segments[i].speaker + "]";
    speakers[key] = (speakers[key] || 0) + 1;
  }
  var summary = "\n\nSpeaker segments detected:\n";
  for (var s in speakers) {
    summary += "- " + s + ": " + speakers[s] + " segments\n";
  }
  return summary;
}

// ── Recency Weighting ──

function calculateWeight(createdDate) {
  var diffDays = (new Date().getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays <= 30) return "HIGH";
  if (diffDays <= 90) return "MEDIUM";
  return "LOW";
}

function buildMetaHeader(fileName, folderOrType, createdDate, weight, docType) {
  return "---\nSOURCE: " + fileName +
    "\n" + (docType === "FATHOM_TRANSCRIPT" ? "SUBFOLDER" : "FOLDER") + ": " + folderOrType +
    "\nDATE: " + createdDate.toISOString() +
    "\nWEIGHT: " + weight +
    "\nTYPE: " + docType + "\n---\n";
}

// ── File Operations ──

function appendToKBDoc(folderOrId, docName, entry) {
  var folder = typeof folderOrId === "string" ? DriveApp.getFolderById(folderOrId) : folderOrId;
  var existing = folder.getFilesByName(docName);
  if (existing.hasNext()) {
    var file = existing.next();
    file.setContent(file.getBlob().getDataAsString() + "\n\n" + entry);
  } else {
    folder.createFile(docName, "# " + docName + "\nGenerated: " + new Date().toISOString() + "\n\n" + entry, MimeType.PLAIN_TEXT);
  }
}

function overwriteKBDoc(folderOrId, docName, content) {
  var folder = typeof folderOrId === "string" ? DriveApp.getFolderById(folderOrId) : folderOrId;
  var existing = folder.getFilesByName(docName);
  if (existing.hasNext()) {
    existing.next().setContent(content);
  } else {
    folder.createFile(docName, content, "text/markdown");
  }
}

function writeAuditLog(scriptName, stats) {
  var folder = DriveApp.getFolderById(CONFIG.KB_OUTPUT_FOLDER);
  var parts = ["---", "RUN: " + scriptName, "TIMESTAMP: " + new Date().toISOString()];

  for (var key in stats) {
    parts.push(key.toUpperCase() + ": " + stats[key]);
  }
  parts.push("---");
  var entry = parts.join("\n");

  var files = folder.getFilesByName(CONFIG.PROCESSING_LOG);
  if (files.hasNext()) {
    var file = files.next();
    file.setContent(entry + "\n\n" + file.getBlob().getDataAsString());
  } else {
    folder.createFile(CONFIG.PROCESSING_LOG, "# Processing Audit Log\n\n" + entry, "text/markdown");
  }
}

function logToRewriteLog(message) {
  var folder = DriveApp.getFolderById(CONFIG.KB_OUTPUT_FOLDER);
  var files = folder.getFilesByName(CONFIG.REWRITE_LOG);
  var timestamp = new Date().toISOString();
  var entry = timestamp + " \u2014 " + message;

  if (files.hasNext()) {
    var file = files.next();
    file.setContent(entry + "\n" + file.getBlob().getDataAsString());
  } else {
    folder.createFile(CONFIG.REWRITE_LOG, entry, "text/plain");
  }
}

// ── Collect Files ──

function collectTxtFiles(folder, results) {
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
  while (subs.hasNext()) collectTxtFiles(subs.next(), results);
}

var SUPPORTED_MIMES = [
  MimeType.GOOGLE_DOCS, MimeType.PDF, MimeType.PLAIN_TEXT,
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
];

function collectAllFiles(folder, results) {
  var files = folder.getFiles();
  while (files.hasNext()) {
    var f = files.next();
    if (SUPPORTED_MIMES.indexOf(f.getMimeType()) !== -1) {
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
  while (subs.hasNext()) collectAllFiles(subs.next(), results);
}

function extractTextFromFile(f) {
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

  // PDF or .docx
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

// ── Claude API ──

function callClaude(prompt, maxTokens) {
  var apiKey = getApiKey();
  var res = UrlFetchApp.fetch("https://api.anthropic.com/v1/messages", {
    method: "post",
    contentType: "application/json",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    payload: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: maxTokens || 1500,
      messages: [{ role: "user", content: prompt }]
    }),
    muteHttpExceptions: true
  });

  var data = JSON.parse(res.getContentText());
  if (data.error) throw new Error("Claude API: " + data.error.message);
  return (data.content && data.content[0]) ? data.content[0].text : null;
}

function callClaudeWithSystem(systemPrompt, userContent, maxTokens) {
  var apiKey = getApiKey();
  var res = UrlFetchApp.fetch("https://api.anthropic.com/v1/messages", {
    method: "post",
    contentType: "application/json",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    payload: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: maxTokens || 1500,
      system: systemPrompt,
      messages: [{ role: "user", content: userContent }]
    }),
    muteHttpExceptions: true
  });

  var data = JSON.parse(res.getContentText());
  if (data.error) throw new Error("Claude API: " + data.error.message);
  return (data.content && data.content[0]) ? data.content[0].text : null;
}

// ── Insight Counting ──

function countInsightTypes(text) {
  return {
    evergreen: (text.match(/\[EVERGREEN\]/g) || []).length,
    timeSensitive: (text.match(/\[TIME-SENSITIVE/g) || []).length
  };
}

// ── Standard tagging instructions for Claude prompts ──

function getTaggingInstructions(speakerContext) {
  var tagList = CONFIG.CONTEXT_TAGS.join(", ");
  var instructions = "";

  if (speakerContext === "sales") {
    instructions += "SPEAKER ATTRIBUTION: Tag each insight with [REP] for Freewyld sales rep, [CLIENT] or [PROSPECT] for the other party, [UNKNOWN] if unclear.\n";
  } else if (speakerContext === "fathom") {
    instructions += "SPEAKER ATTRIBUTION: Tag each insight with [REP] for Freewyld team (Mariano, Jaydon, Eric, Jasper, Kaye), [CLIENT] for existing client, [PROSPECT] for prospect, [UNKNOWN] if unclear.\n";
  } else if (speakerContext === "doc-attributed") {
    instructions += "SPEAKER ATTRIBUTION: Tag each insight with [FREEWYLD] for team content, [EXTERNAL] for guest/external content.\n";
  } else {
    instructions += "Tag all insights as [DOC].\n";
  }

  instructions += "CONTEXT TAGGING: Tag each insight with [TAG: category] from: " + tagList + "\n";
  instructions += "EVERGREEN vs TIME-SENSITIVE: Classify as [EVERGREEN] for permanent knowledge, [TIME-SENSITIVE: review-monthly] for pricing/offers, [TIME-SENSITIVE: review-quarterly] for seasonal strategies.\n";
  instructions += "Format each line as: [SPEAKER] [TAG: category] [EVERGREEN or TIME-SENSITIVE] insight text\n";

  return instructions;
}

// ── Fetch page (for podcast/website scraping) ──

function fetchPage(url) {
  try {
    var response = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true, followRedirects: true,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; WyleBot/1.0)" }
    });
    if (response.getResponseCode() === 200) return response.getContentText();
    Logger.log("HTTP " + response.getResponseCode() + " for " + url);
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
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n").trim();
}
