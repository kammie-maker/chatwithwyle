var KB_FOLDER_ID   = "1CycqtO4_O3KJ09C6r605Z_5j6783rtSv";
var MASTER_FILE_ID = "1IjtO_gdiK2-lFevZ66E6KRTuzy-J89xp";
var LOG_FILE_NAME  = "kb-rewrite-log.md";

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
      default:
        return jsonResponse({ error: "Unknown action: " + action });
    }
  } catch (err) {
    return jsonResponse({ error: "doPost error: " + err.message });
  }
}

function handleReadAllSources(data) {
  var folder = DriveApp.getFolderById(KB_FOLDER_ID);
  var files = folder.getFiles();
  var sources = [];
  while (files.hasNext()) {
    var file = files.next();
    var name = file.getName();
    if (name.endsWith(".md") && file.getId() !== MASTER_FILE_ID) {
      sources.push({
        name: name,
        content: file.getBlob().getDataAsString()
      });
    }
  }
  return jsonResponse({ sources: sources });
}

function handleOverwrite(data) {
  var file = DriveApp.getFileById(MASTER_FILE_ID);
  file.setContent(data.note || "");
  return jsonResponse({ success: true });
}

function handleAppendUpdates(data) {
  var folder = DriveApp.getFolderById(KB_FOLDER_ID);
  var fileName = "Wyle Manual Updates.md";
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
  var folder = DriveApp.getFolderById(KB_FOLDER_ID);
  var files = folder.getFilesByName(LOG_FILE_NAME);
  if (!files.hasNext()) {
    return jsonResponse({ entries: [] });
  }
  var file = files.next();
  var content = file.getBlob().getDataAsString();
  var entries = content.split("\n").filter(function(line) {
    return line.trim().length > 0;
  });
  return jsonResponse({ entries: entries });
}

function handleLog(data) {
  var folder = DriveApp.getFolderById(KB_FOLDER_ID);
  var files = folder.getFilesByName(LOG_FILE_NAME);
  var timestamp = new Date().toISOString();
  var entry = "Rewrite completed: " + timestamp + " \u2014 " + (data.note || "");
  if (files.hasNext()) {
    var file = files.next();
    var existing = file.getBlob().getDataAsString();
    file.setContent(entry + "\n" + existing);
  } else {
    folder.createFile(LOG_FILE_NAME, entry, "text/plain");
  }
  return jsonResponse({ success: true });
}

function handleListFiles(data) {
  if (!verifyPassword(data)) {
    return jsonResponse({ error: "Unauthorized" });
  }
  var folder = DriveApp.getFolderById(KB_FOLDER_ID);
  var files = folder.getFiles();
  var result = [];
  while (files.hasNext()) {
    var file = files.next();
    var name = file.getName();
    if (name.endsWith(".md") && file.getId() !== MASTER_FILE_ID) {
      result.push({
        id: file.getId(),
        name: name,
        modifiedDate: file.getLastUpdated().toISOString()
      });
    }
  }
  result.sort(function(a, b) { return a.name.localeCompare(b.name); });
  return jsonResponse({ files: result });
}

function handleGetFile(data) {
  if (!verifyPassword(data)) {
    return jsonResponse({ error: "Unauthorized" });
  }
  var fileId = data.fileId;
  if (!fileId) {
    return jsonResponse({ error: "fileId is required" });
  }
  try {
    var file = DriveApp.getFileById(fileId);
    return jsonResponse({
      content: file.getBlob().getDataAsString(),
      name: file.getName()
    });
  } catch (err) {
    return jsonResponse({ error: "File not found: " + err.message });
  }
}

function handleUpdateFile(data) {
  if (!verifyPassword(data)) {
    return jsonResponse({ error: "Unauthorized" });
  }
  var fileId = data.fileId;
  var content = data.content;
  if (!fileId) {
    return jsonResponse({ error: "fileId is required" });
  }
  if (typeof content !== "string") {
    return jsonResponse({ error: "content is required" });
  }
  if (fileId === MASTER_FILE_ID) {
    return jsonResponse({ error: "Cannot edit master compiled file directly" });
  }
  try {
    var file = DriveApp.getFileById(fileId);
    file.setContent(content);
    return jsonResponse({ success: true });
  } catch (err) {
    return jsonResponse({ error: "Update failed: " + err.message });
  }
}
