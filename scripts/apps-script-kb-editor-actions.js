/**
 * Apps Script — KB Editor Actions
 *
 * Add these handlers to your existing doPost(e) function's action switch.
 * These support the KB editor UI in chatwithwyle.
 *
 * Required constants (should already exist in your script):
 *   KB_FOLDER_ID = "1CycqtO4_O3KJ09C6r605Z_5j6783rtSv"
 *   MASTER_FILE_ID = "1IjtO_gdiK2-lFevZ66E6KRTuzy-J89xp"
 *   WYLE_PASSWORD = PropertiesService.getScriptProperties().getProperty("WYLE_PASSWORD")
 */

// ── Add these cases to your doPost(e) switch statement ──

// case "list_files":
//   return handleListFiles(data);

// case "get_file":
//   return handleGetFile(data);

// case "update_file":
//   return handleUpdateFile(data);


/**
 * list_files — Returns all .md files in the KB folder except the master compiled file.
 * Input: { action: "list_files", password: "..." }
 * Output: { files: [{ id, name, modifiedDate }] }
 */
function handleListFiles(data) {
  var password = data.password || "";
  var expected = PropertiesService.getScriptProperties().getProperty("WYLE_PASSWORD");
  if (password !== expected) {
    return ContentService.createTextOutput(JSON.stringify({ error: "Unauthorized" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var folder = DriveApp.getFolderById("1CycqtO4_O3KJ09C6r605Z_5j6783rtSv");
  var masterFileId = "1IjtO_gdiK2-lFevZ66E6KRTuzy-J89xp";
  var files = folder.getFiles();
  var result = [];

  while (files.hasNext()) {
    var file = files.next();
    var name = file.getName();
    // Only include .md files, exclude master compiled file
    if (name.endsWith(".md") && file.getId() !== masterFileId) {
      result.push({
        id: file.getId(),
        name: name,
        modifiedDate: file.getLastUpdated().toISOString()
      });
    }
  }

  // Sort by name
  result.sort(function(a, b) { return a.name.localeCompare(b.name); });

  return ContentService.createTextOutput(JSON.stringify({ files: result }))
    .setMimeType(ContentService.MimeType.JSON);
}


/**
 * get_file — Returns the content of a specific file by ID.
 * Input: { action: "get_file", fileId: "...", password: "..." }
 * Output: { content: "file content as string", name: "filename.md" }
 */
function handleGetFile(data) {
  var password = data.password || "";
  var expected = PropertiesService.getScriptProperties().getProperty("WYLE_PASSWORD");
  if (password !== expected) {
    return ContentService.createTextOutput(JSON.stringify({ error: "Unauthorized" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var fileId = data.fileId;
  if (!fileId) {
    return ContentService.createTextOutput(JSON.stringify({ error: "fileId is required" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  try {
    var file = DriveApp.getFileById(fileId);
    var content = file.getBlob().getDataAsString();
    return ContentService.createTextOutput(JSON.stringify({
      content: content,
      name: file.getName()
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: "File not found: " + err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}


/**
 * update_file — Overwrites a specific file with new content.
 * Input: { action: "update_file", fileId: "...", content: "...", password: "..." }
 * Output: { success: true }
 */
function handleUpdateFile(data) {
  var password = data.password || "";
  var expected = PropertiesService.getScriptProperties().getProperty("WYLE_PASSWORD");
  if (password !== expected) {
    return ContentService.createTextOutput(JSON.stringify({ error: "Unauthorized" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var fileId = data.fileId;
  var content = data.content;

  if (!fileId) {
    return ContentService.createTextOutput(JSON.stringify({ error: "fileId is required" }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  if (typeof content !== "string") {
    return ContentService.createTextOutput(JSON.stringify({ error: "content is required" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // Safety: don't allow overwriting the master compiled file through this action
  var masterFileId = "1IjtO_gdiK2-lFevZ66E6KRTuzy-J89xp";
  if (fileId === masterFileId) {
    return ContentService.createTextOutput(JSON.stringify({ error: "Cannot edit master compiled file directly" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  try {
    var file = DriveApp.getFileById(fileId);
    file.setContent(content);
    return ContentService.createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: "Update failed: " + err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
