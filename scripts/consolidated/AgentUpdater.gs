// ============================================================
// AgentUpdater.gs — Rewrites and maintains agent + skill files
// Uses: Config.gs, Shared.gs
// ============================================================

var AGENT_UPDATER_FILES = [
  "Agent-Sales.md",
  "Agent-CEO.md",
  "Agent-RevenueExpert.md",
  "Skill-Sales.md",
  "Skill-ClientSuccess.md",
  "Skill-Fulfillment.md",
  "Skill-Onboarding.md"
];

var USAGE_CONTEXT = {
  "Agent-Sales.md": "SALES CHAT (Mariano and Jaydon):\n- Closing high-value STR revenue management clients\n- On live sales calls handling objections in real time\n- Following up after calls via text, email, voicemail\n- Need word-for-word scripts they can say immediately\n- Main objections: fee too high, already have someone, need to think about it, timing, tried it before\n- Main FAQs: fee calculation, guarantee, inclusions, results timeline, onboarding process",

  "Agent-CEO.md": "ALL MODES (Eric's voice across every interaction):\n- Provides vision, mission, brand story, and founder perspective\n- Used when sales needs to humanize the brand or share the origin story\n- Used when client success needs to reinforce partnership and aligned incentives\n- Used when onboarding needs to set tone and build trust\n- Speaks to why Freewyld exists, what makes us different, and the bigger picture\n- Eric built his own portfolio, consulted for others, saw the pattern of operators leaving 20-30% on the table",

  "Agent-RevenueExpert.md": "REVENUE MANAGEMENT CHAT + SALES CHAT (Revenue managers + sales support):\n- Revenue managers use this to communicate strategy and results to clients\n- Getting client buy-in on pricing decisions (MNS, rates, OTA strategy)\n- Explaining monthly performance reports with data and context\n- Handling client pushback on recommendations with authority\n- Sales reps draw on this for data-backed justifications during pitches\n- Technical depth on MPI, orphan nights, dynamic pricing, OTA algorithms",

  "Skill-Sales.md": "SALES CHAT (Mariano and Jaydon):\n- On live sales calls handling objections in real time\n- Following up after calls via text, email, voicemail\n- Need word-for-word scripts they can say immediately\n- SIMPLE must be a talk track they read aloud to a prospect\n- DEEPER expands with additional client-facing sentences\n- Draft actions: Text, Email, Voicemail\n- Client Interaction mode: everything is client-facing\n- Internal Research mode: coaching and strategy for the rep",

  "Skill-ClientSuccess.md": "CLIENT SUCCESS CHAT (Felipe):\n- Managing existing client relationships day to day\n- Primarily communicates via Slack and email, not phone\n- Handles: billing questions, invoice disputes, frustrated clients, rate concerns, unreasonable hospitality requests, competitor comparisons\n- Goal: keep clients calm, confident, and retained\n- Never over-promises, never offers extra labor, always warm and firm\n- Draft actions: Slack Message, Email\n- SIMPLE must be a script Felipe sends directly to the client",

  "Skill-Fulfillment.md": "REVENUE MANAGEMENT CHAT (Revenue managers):\n- Communicating strategy and results to clients\n- Getting client buy-in on pricing decisions\n- Explaining MNS, orphan nights, OTA optimization to clients\n- Presenting monthly performance reports\n- Handling client pushback on recommendations\n- Building long-term client confidence in our approach\n- STRATEGY section is internal, ANSWER TO CLIENT is what they send\n- Draft actions: Slack Message, Email",

  "Skill-Onboarding.md": "ONBOARDING CHAT (Felipe):\n- Walking new clients through the onboarding process\n- Setting expectations on fees, billing, timeline\n- Pre-empting common objections before they arise\n- Explaining what access is needed and why\n- Making the first 30 days smooth and trust-building\n- Clients are brand new and need hand-holding and reassurance\n- Draft actions: Slack Message, Email\n- SIMPLE must be warm, educational, and confidence-building"
};


// ============================================================
// FULL REWRITE — run once to deeply improve all files
// ============================================================

function rewriteAgentsAndSkills() {
  var apiKey = getApiKey();
  var folder = DriveApp.getFolderById(CONFIG.KB_OUTPUT_FOLDER);
  var rewritten = 0;

  for (var i = 0; i < AGENT_UPDATER_FILES.length; i++) {
    var fileName = AGENT_UPDATER_FILES[i];
    var context = USAGE_CONTEXT[fileName] || "";
    var isSkill = fileName.startsWith("Skill-");

    try {
      // Fetch current content
      var files = folder.getFilesByName(fileName);
      if (!files.hasNext()) { Logger.log("WARNING: File not found \u2014 " + fileName); continue; }
      var file = files.next();
      var currentContent = file.getBlob().getDataAsString();

      // Build rewrite prompt
      var prompt;
      if (isSkill) {
        prompt = "You are updating a skill/mode definition file for Wyle, an internal sales intelligence tool for Freewyld Foundry. " +
          "Here is the current file content and the context for how this mode is actually used.\n\n" +
          "Current file: " + fileName + "\n\n" +
          "Current content:\n" + currentContent.substring(0, 8000) + "\n\n" +
          "Usage context:\n" + context + "\n\n" +
          "Rewrite this skill file to be:\n" +
          "- Tailored specifically to the team member who uses this mode (see usage context)\n" +
          "- Reflect their actual day-to-day communication needs (Slack, email, live call, follow-up)\n" +
          "- Include specific guidance for their role\n" +
          "- Keep the same SIMPLE/DEEPER/DEEPEST/INTERNAL structure and all formatting rules\n" +
          "- Make the tone and examples Freewyld-specific\n\n" +
          "Return ONLY the complete rewritten file content. No preamble, no explanation.";
      } else {
        prompt = "You are updating an AI agent definition file for Wyle, an internal sales intelligence tool for Freewyld Foundry. " +
          "Here is the current file content and the context for how it is actually used.\n\n" +
          "Current file: " + fileName + "\n\n" +
          "Current content:\n" + currentContent.substring(0, 8000) + "\n\n" +
          "Usage context:\n" + context + "\n\n" +
          "Rewrite this agent file to be:\n" +
          "- Deeply specific to Freewyld Foundry, not generic\n" +
          "- Aligned with how this agent is actually used in day-to-day operations\n" +
          "- Filled with Freewyld-specific language, phrases, and approaches drawn from the current content\n" +
          "- Clear about what this agent leads on vs supports\n" +
          "- Practical and immediately useful to the team member\n\n" +
          "Keep the same structure and headers as the current file. Improve the content, do not reduce it.\n" +
          "Return ONLY the complete rewritten file content. No preamble, no explanation.";
      }

      // Call Claude
      var res = UrlFetchApp.fetch("https://api.anthropic.com/v1/messages", {
        method: "post",
        contentType: "application/json",
        headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        payload: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 4000,
          messages: [{ role: "user", content: prompt }]
        }),
        muteHttpExceptions: true
      });

      var data = JSON.parse(res.getContentText());
      if (data.error) { Logger.log("ERROR on " + fileName + ": " + data.error.message); continue; }

      var newContent = (data.content && data.content[0]) ? data.content[0].text : null;
      if (!newContent || newContent.length < 200) { Logger.log("WARNING: Empty or too short response for " + fileName); continue; }

      // Overwrite file
      file.setContent(newContent);
      Logger.log("Rewrote: " + fileName + " \u2014 " + newContent.length + " chars");
      rewritten++;

    } catch (err) {
      Logger.log("ERROR on " + fileName + ": " + err.message);
    }

    // Sleep between files
    if (i < AGENT_UPDATER_FILES.length - 1) {
      Utilities.sleep(5000);
    }
  }

  Logger.log("Rewrite complete. " + rewritten + " of " + AGENT_UPDATER_FILES.length + " files updated.");

  // Trigger KB rewrite
  try {
    compileMasterPrompt();
    Logger.log("Master prompt recompiled after agent update.");
  } catch (err) {
    Logger.log("Master prompt recompile failed: " + err.message);
  }

  logToRewriteLog("Agent/Skill rewrite: " + rewritten + " files updated");
}


// ============================================================
// WEEKLY INCREMENTAL UPDATE
// ============================================================

function weeklyAgentUpdate() {
  var apiKey = getApiKey();
  var folder = DriveApp.getFolderById(CONFIG.KB_OUTPUT_FOLDER);
  var updated = 0;
  var unchanged = 0;

  logToRewriteLog("Weekly agent update started");

  for (var i = 0; i < AGENT_UPDATER_FILES.length; i++) {
    var fileName = AGENT_UPDATER_FILES[i];
    var context = USAGE_CONTEXT[fileName] || "";

    try {
      var files = folder.getFilesByName(fileName);
      if (!files.hasNext()) { Logger.log("WARNING: File not found \u2014 " + fileName); continue; }
      var file = files.next();
      var currentContent = file.getBlob().getDataAsString();
      var originalLength = currentContent.length;

      var prompt = "You are maintaining an AI agent/skill file for Wyle, an internal tool for Freewyld Foundry.\n\n" +
        "Current file: " + fileName + "\n\n" +
        "Current content:\n" + currentContent.substring(0, 8000) + "\n\n" +
        "Usage context:\n" + context + "\n\n" +
        "New insights from this week's transcripts and KB updates are now available. " +
        "Review the current file and make targeted improvements:\n" +
        "- Add any new objections, phrases, or approaches from recent calls that aren't already covered\n" +
        "- Update any outdated information\n" +
        "- Remove anything that contradicts recent practice\n" +
        "- Do not restructure or reduce existing content\n\n" +
        "If no updates are needed, return the current content unchanged.\n" +
        "Return ONLY the complete updated file content.";

      var res = UrlFetchApp.fetch("https://api.anthropic.com/v1/messages", {
        method: "post",
        contentType: "application/json",
        headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        payload: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 4000,
          messages: [{ role: "user", content: prompt }]
        }),
        muteHttpExceptions: true
      });

      var data = JSON.parse(res.getContentText());
      if (data.error) { Logger.log("ERROR on " + fileName + ": " + data.error.message); continue; }

      var newContent = (data.content && data.content[0]) ? data.content[0].text : null;
      if (!newContent || newContent.length < 200) { Logger.log("WARNING: Empty response for " + fileName); continue; }

      // Check if content actually changed (simple length + first 500 chars comparison)
      if (Math.abs(newContent.length - originalLength) < 50 && newContent.substring(0, 500) === currentContent.substring(0, 500)) {
        Logger.log("Unchanged: " + fileName);
        unchanged++;
      } else {
        file.setContent(newContent);
        Logger.log("Updated: " + fileName + " \u2014 " + originalLength + " \u2192 " + newContent.length + " chars");
        updated++;
      }

    } catch (err) {
      Logger.log("ERROR on " + fileName + ": " + err.message);
    }

    if (i < AGENT_UPDATER_FILES.length - 1) {
      Utilities.sleep(5000);
    }
  }

  var summary = "Weekly agent update: " + updated + " updated, " + unchanged + " unchanged";
  Logger.log(summary);
  logToRewriteLog(summary);

  // Recompile master prompt if anything changed
  if (updated > 0) {
    try {
      compileMasterPrompt();
      Logger.log("Master prompt recompiled.");
    } catch (err) {
      Logger.log("Recompile failed: " + err.message);
    }
  }
}


// ============================================================
// TRIGGER SETUP
// ============================================================

function setupTrigger_AgentUpdate() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "weeklyAgentUpdate") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger("weeklyAgentUpdate")
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(12)
    .nearMinute(30)
    .create();
  Logger.log("Trigger set: weeklyAgentUpdate \u2014 Mondays at 12:30 UTC (5:30 AM PDT)");
}
