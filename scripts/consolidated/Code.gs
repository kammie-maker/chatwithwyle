// ============================================================
// Code.gs — Webhook handler for Wyle KB
// Uses: Config.gs for file name constants
// ============================================================

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function verifyPassword(data) {
  var password = (data && data.password) || "";
  var expected = PropertiesService.getScriptProperties().getProperty("WYLE_PASSWORD");
  return password === expected;
}

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var action = data.action;

    switch (action) {
      case "read_all_sources":
        return handleReadAllSources(data);
      case "overwrite":
        return handleOverwrite(data);
      case "append_updates":
        return handleAppendUpdates(data);
      case "get_log":
        return handleGetLog(data);
      case "log":
        return handleLog(data);
      case "list_files":
        return handleListFiles(data);
      case "get_file":
        return handleGetFile(data);
      case "update_file":
        return handleUpdateFile(data);
      case "create_file":
        return handleCreateFile(data);
      default:
        return jsonResponse({ error: "Unknown action: " + action });
    }
  } catch (err) {
    return jsonResponse({ error: "doPost error: " + err.message });
  }
}

function handleReadAllSources(data) {
  var folder = DriveApp.getFolderById(CONFIG.KB_OUTPUT_FOLDER);
  var masterFileId = CONFIG.MASTER_PROMPT_FILE;
  var logName = CONFIG.REWRITE_LOG;
  var files = folder.getFiles();
  var sources = [];
  while (files.hasNext()) {
    var file = files.next();
    var name = file.getName();
    if (file.getId() !== masterFileId && name !== logName) {
      sources.push({ name: name, content: file.getBlob().getDataAsString() });
    }
  }
  return jsonResponse({ sources: sources });
}

function handleOverwrite(data) {
  var file = DriveApp.getFileById(CONFIG.MASTER_PROMPT_FILE);
  file.setContent(data.note || "");
  return jsonResponse({ success: true });
}

function handleAppendUpdates(data) {
  var folder = DriveApp.getFolderById(CONFIG.KB_OUTPUT_FOLDER);
  var fileName = CONFIG.MANUAL_UPDATES;
  var files = folder.getFilesByName(fileName);
  if (files.hasNext()) {
    var file = files.next();
    var existing = file.getBlob().getDataAsString();
    file.setContent(existing + "\n" + (data.note || ""));
  } else {
    folder.createFile(fileName, data.note || "", "text/markdown");
  }
  return jsonResponse({ success: true });
}

function handleGetLog(data) {
  var folder = DriveApp.getFolderById(CONFIG.KB_OUTPUT_FOLDER);
  var files = folder.getFilesByName(CONFIG.REWRITE_LOG);
  if (!files.hasNext()) return jsonResponse({ entries: [] });
  var file = files.next();
  var content = file.getBlob().getDataAsString();
  var entries = content.split("\n").filter(function(line) { return line.trim().length > 0; });
  return jsonResponse({ entries: entries });
}

function handleLog(data) {
  var folder = DriveApp.getFolderById(CONFIG.KB_OUTPUT_FOLDER);
  var files = folder.getFilesByName(CONFIG.REWRITE_LOG);
  var timestamp = new Date().toISOString();
  var entry = "Rewrite completed: " + timestamp + " \u2014 " + (data.note || "");
  if (files.hasNext()) {
    var file = files.next();
    var existing = file.getBlob().getDataAsString();
    file.setContent(entry + "\n" + existing);
  } else {
    folder.createFile(CONFIG.REWRITE_LOG, entry, "text/plain");
  }
  return jsonResponse({ success: true });
}

function handleListFiles(data) {
  if (!verifyPassword(data)) return jsonResponse({ error: "Unauthorized" });
  var folder = DriveApp.getFolderById(CONFIG.KB_OUTPUT_FOLDER);
  var masterFileId = CONFIG.MASTER_PROMPT_FILE;
  var hiddenFiles = [CONFIG.REWRITE_LOG, "LOG-Rewrites.md", "LOG-Processing.md", "Wyle Apends & Rewrites Log"];
  var files = folder.getFiles();
  var result = [];
  while (files.hasNext()) {
    var file = files.next();
    var name = file.getName();
    if (file.getId() !== masterFileId && hiddenFiles.indexOf(name) === -1) {
      result.push({ id: file.getId(), name: name, modifiedDate: file.getLastUpdated().toISOString() });
    }
  }
  result.sort(function(a, b) { return a.name.localeCompare(b.name); });
  return jsonResponse({ files: result });
}

function handleGetFile(data) {
  if (!verifyPassword(data)) return jsonResponse({ error: "Unauthorized" });
  if (!data.fileId) return jsonResponse({ error: "fileId is required" });
  try {
    var file = DriveApp.getFileById(data.fileId);
    return jsonResponse({ content: file.getBlob().getDataAsString(), name: file.getName() });
  } catch (err) {
    return jsonResponse({ error: "File not found: " + err.message });
  }
}

function handleUpdateFile(data) {
  if (!verifyPassword(data)) return jsonResponse({ error: "Unauthorized" });
  if (!data.fileId) return jsonResponse({ error: "fileId is required" });
  if (typeof data.content !== "string") return jsonResponse({ error: "content is required" });
  if (data.fileId === CONFIG.MASTER_PROMPT_FILE) return jsonResponse({ error: "Cannot edit master compiled file directly" });
  try {
    DriveApp.getFileById(data.fileId).setContent(data.content);
    return jsonResponse({ success: true });
  } catch (err) {
    return jsonResponse({ error: "Update failed: " + err.message });
  }
}

function handleCreateFile(data) {
  if (!verifyPassword(data)) return jsonResponse({ error: "Unauthorized" });
  if (!data.fileName) return jsonResponse({ error: "fileName is required" });
  try {
    var folder = DriveApp.getFolderById(CONFIG.KB_OUTPUT_FOLDER);
    var existing = folder.getFilesByName(data.fileName);
    if (existing.hasNext()) return jsonResponse({ error: "File already exists: " + data.fileName });
    var file = folder.createFile(data.fileName, data.content || "", "text/markdown");
    return jsonResponse({ success: true, fileId: file.getId(), name: data.fileName });
  } catch (err) {
    return jsonResponse({ error: "Create failed: " + err.message });
  }
}

// ============================================================
// COMPILE MASTER PROMPT — used by SalesTranscripts after run
// ============================================================

function compileMasterPrompt() {
  var folder = DriveApp.getFolderById(CONFIG.KB_OUTPUT_FOLDER);
  var kbContent = "";

  for (var i = 0; i < CONFIG.COMPILE_DOCS.length; i++) {
    var docName = CONFIG.COMPILE_DOCS[i];
    var files = folder.getFilesByName(docName);
    if (!files.hasNext()) {
      Logger.log("WARNING: KB doc not found \u2014 " + docName);
      continue;
    }
    var content = files.next().getBlob().getDataAsString().trim();
    if (content) {
      kbContent += "\n\n============================================================\n## " + docName + "\n============================================================\n\n" + content;
    }
  }

  // Read persona for the system prompt header
  var personaFiles = folder.getFilesByName(CONFIG.PERSONA);
  var persona = "";
  if (personaFiles.hasNext()) {
    persona = personaFiles.next().getBlob().getDataAsString();
  }

  var compiled = persona + "\n\n============================================================\n# KNOWLEDGE BASE\nLast compiled: " + new Date().toISOString() + "\n============================================================" + kbContent;

  DriveApp.getFileById(CONFIG.MASTER_PROMPT_FILE).setContent(compiled);
  Logger.log("Master prompt compiled. Length: " + compiled.length + " chars.");
}
