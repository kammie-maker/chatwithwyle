// ============================================================
// ReorganizeKB.gs — Run reorganizeKBFolder() once, then delete this file
// ============================================================

function reorganizeKBFolder() {
  var folder = DriveApp.getFolderById("1CycqtO4_O3KJ09C6r605Z_5j6783rtSv");
  var masterFileId = "1IjtO_gdiK2-lFevZ66E6KRTuzy-J89xp";

  var deleted = 0, renamed = 0, created = 0, warnings = 0;

  // Build lookup: name -> file
  var fileMap = {};
  var iter = folder.getFiles();
  while (iter.hasNext()) {
    var f = iter.next();
    fileMap[f.getName()] = f;
  }
  // Also get the master file directly (it may be excluded from iteration if it's the master)
  try {
    var masterFile = DriveApp.getFileById(masterFileId);
    fileMap[masterFile.getName()] = masterFile;
  } catch (e) { /* ignore */ }

  Logger.log("Found " + Object.keys(fileMap).length + " files in folder");

  // ── Step 1: Delete files ──
  var toDelete = ["KB - Podcast Transcripts.txt", "KB - Master (All Calls).txt"];
  for (var d = 0; d < toDelete.length; d++) {
    var name = toDelete[d];
    if (fileMap[name]) {
      fileMap[name].setTrashed(true);
      Logger.log("Deleted: " + name);
      deleted++;
      delete fileMap[name];
    } else {
      Logger.log("WARNING: File not found for deletion \u2014 " + name);
      warnings++;
    }
  }

  // ── Step 2: Rename files ──
  var renames = [
    ["Wyle-Persona.md", "Persona-Wyle.md"],
    ["KB - Sales Calls.txt", "KB-SalesCalls.md"],
    ["KB - Training & Education.txt", "KB-Training.md"],
    ["KB - Systems & Processes.txt", "KB-Systems.md"],
    ["KB - Pricing & Contracts.txt", "KB-Pricing.md"],
    ["KB - Operations & Onboarding.txt", "KB-Operations.md"],
    ["KB - Market Intelligence.txt", "KB-MarketIntelligence.md"],
    ["KB - Fulfillment Calls.txt", "KB-FulfillmentCalls.md"],
    ["KB - Training Calls.txt", "KB-TrainingCalls.md"],
    ["KB - Unsorted Calls.txt", "KB-UnsortedCalls.md"],
    ["overall_business_context.md", "KB-BusinessContext.md"],
    ["client-case-studies.md", "KB-CaseStudies.md"],
    ["Brand-Voice-Current.md", "FEED-BrandVoice.md"],
    ["STR-Insights-Feed.md", "FEED-STRInsights.md"],
    ["Wyle Manual Updates.md", "KB-ManualUpdates.md"],
    ["kb-rewrite-log.md", "LOG-Rewrites.md"]
  ];

  // Also rename the master file
  var masterRename = ["Wyle Master Prompt.md", "COMPILED-MasterPrompt.md"];
  // The master file might have a different name; try by ID
  try {
    var mf = DriveApp.getFileById(masterFileId);
    var currentMasterName = mf.getName();
    if (currentMasterName !== "COMPILED-MasterPrompt.md") {
      mf.setName("COMPILED-MasterPrompt.md");
      Logger.log("Renamed: " + currentMasterName + " \u2192 COMPILED-MasterPrompt.md");
      renamed++;
    }
  } catch (e) {
    Logger.log("WARNING: Could not rename master file \u2014 " + e.message);
    warnings++;
  }

  for (var r = 0; r < renames.length; r++) {
    var oldName = renames[r][0];
    var newName = renames[r][1];
    if (fileMap[oldName]) {
      fileMap[oldName].setName(newName);
      Logger.log("Renamed: " + oldName + " \u2192 " + newName);
      renamed++;
    } else {
      Logger.log("WARNING: File not found \u2014 " + oldName);
      warnings++;
    }
  }

  // ── Step 3: Create System-Assembly.md ──
  var assemblyContent = "# System Prompt Assembly \u2014 Wyle\n\n" +
    "## Purpose\n" +
    "This file defines the order in which source files are assembled into the system prompt for each Wyle chat session.\n" +
    "Edit this file to change assembly order or add/remove layers.\n" +
    "The buildSystemPrompt(mode) function in the chatwithwyle app reads and follows these instructions.\n\n" +
    "## Assembly Order\n" +
    "Every chat session assembles the system prompt in this exact order:\n\n" +
    "1. Persona-Wyle.md\n" +
    "   Identity, voice, what Wyle never does, response rules\n\n" +
    "2. Agent-Sales.md\n" +
    "   Sales knowledge, objections, closing techniques\n\n" +
    "3. Agent-CEO.md\n" +
    "   Eric's voice, vision, origin story, brand\n\n" +
    "4. Agent-RevenueExpert.md\n" +
    "   Jasper's voice, MPI, pricing, technical STR knowledge\n\n" +
    "5. [Mode Skill file \u2014 selected based on active chat mode]\n" +
    "   Skill-Sales.md OR Skill-ClientSuccess.md OR Skill-Fulfillment.md OR Skill-Onboarding.md\n\n" +
    "6. COMPILED-MasterPrompt.md\n" +
    "   All KB knowledge compiled into one file\n\n" +
    "## Notes\n" +
    "- All three agent files are always included regardless of which chat mode is active\n" +
    "- The Skill file determines which agent leads responses\n" +
    "- KB content always comes last so it never overrides behavioral instructions from persona, agents, or skills\n" +
    "- COMPILED-MasterPrompt.md is an output file \u2014 never edit it directly. It is regenerated every Sunday at 6:00 AM PDT by the weekly rewrite pipeline.\n\n" +
    "## Output Files (never edit directly)\n" +
    "These files are generated automatically by scripts:\n" +
    "- COMPILED-MasterPrompt.md \u2014 weekly rewrite output\n" +
    "- FEED-BrandVoice.md \u2014 weekly website scrape output\n" +
    "- FEED-STRInsights.md \u2014 weekly podcast guest insights\n\n" +
    "## Log Files\n" +
    "- LOG-Rewrites.md \u2014 rewrite history\n" +
    "- LOG-Processing.md \u2014 pipeline run history\n";

  // Check if it already exists
  var existingAssembly = folder.getFilesByName("System-Assembly.md");
  if (existingAssembly.hasNext()) {
    existingAssembly.next().setContent(assemblyContent);
    Logger.log("Updated existing System-Assembly.md");
  } else {
    folder.createFile("System-Assembly.md", assemblyContent, "text/markdown");
    Logger.log("Created: System-Assembly.md");
    created++;
  }

  Logger.log("\nReorganization complete. Deleted: " + deleted + ", Renamed: " + renamed + ", Created: " + created + ", Warnings: " + warnings);
}
