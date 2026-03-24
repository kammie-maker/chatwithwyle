export interface TourStep {
  id: string;
  target: string; // data-tour selector value
  title: string;
  content: string;
  contentHtml?: string; // rich HTML content — renders instead of plain text when present
  placement: "top" | "bottom" | "left" | "right" | "center";
  isModal?: boolean;
  beforeShow?: {
    setActiveTab?: "chat" | "kb" | "guide";
    ensureSidebarOpen?: boolean;
  };
  requiredRole?: "knowledge_manager" | "admin"; // only show if user has this role or higher
}

export const BASE_STEPS: TourStep[] = [
  {
    id: "welcome",
    target: "",
    title: "Welcome to Wyle",
    content: "Wyle is Freewyld Foundry's internal AI tool. It knows our processes, protocols, pricing, and promises \u2014 and helps you communicate them clearly to clients.",
    placement: "center",
    isModal: true,
  },
  {
    id: "mode-selector",
    target: "mode-selector",
    title: "Choose your role",
    content: "Select Sales, Client Success, Revenue Management, or Onboarding based on what you're working on. Each role gives Wyle a different lens.",
    placement: "top",
    beforeShow: { setActiveTab: "chat" },
  },
  {
    id: "interaction-toggle",
    target: "interaction-toggle",
    title: "Lead/Client Mode vs Strategy Mode",
    content: "Lead Mode (Sales) or Client Mode gives you word-for-word scripts to say to leads or clients. Strategy Mode gives you internal coaching and context to prepare.",
    placement: "bottom",
  },
  {
    id: "input-area",
    target: "input-area",
    title: "Ask Wyle anything",
    content: "Type a question, an objection you heard, or a situation you're navigating. Wyle knows Freewyld \u2014 be specific.",
    placement: "top",
  },
  {
    id: "suggested-questions",
    target: "suggested-questions",
    title: "Or start with a common topic",
    content: "These are the most common questions and objections for your role. Click any to get an instant answer.",
    placement: "top",
  },
  {
    id: "limitations",
    target: "",
    title: "What Wyle doesn\u2019t know yet",
    content: "Wyle knows Freewyld\u2019s processes, protocols, pricing, and promises \u2014 but not everything. Right now Wyle does not have access to:\n\n\u2022 Specific client accounts or portfolios\n\u2022 Billing history or invoice details\n\u2022 Revenue data or performance metrics\n\u2022 Commission or payout information\n\u2022 Individual property or market data\n\nFor anything client-specific, check the relevant tools directly. Wyle is here to help you understand and communicate Freewyld \u2014 not to replace your client management systems.",
    placement: "center",
    isModal: true,
  },
  {
    id: "expand-info",
    target: "",
    title: "Go deeper on any response",
    content: "+ More Detail adds context. + Full Script gives you the complete word-for-word version. + Rep Notes shows internal coaching \u2014 just for you.",
    placement: "center",
    isModal: true,
  },
  {
    id: "draft-info",
    target: "",
    title: "Draft a follow-up instantly",
    content: "After any response, draft a text, email, or voicemail based on what Wyle just told you. Ready to send in seconds.",
    placement: "center",
    isModal: true,
  },
  {
    id: "new-chat",
    target: "new-chat",
    title: "Start fresh anytime",
    content: "Every conversation is saved automatically. Start a new chat whenever you switch topics.",
    placement: "right",
    beforeShow: { ensureSidebarOpen: true },
  },
  {
    id: "conversation-list",
    target: "conversation-list",
    title: "Your chat history",
    content: "All past conversations are saved here grouped by date. Search, pin, rename, or delete any conversation.",
    placement: "right",
  },
  {
    id: "profile-row",
    target: "profile-row",
    title: "Your profile and settings",
    content: "Click your name to update your default role, switch between Lead/Client and Strategy Mode defaults, and sign out.",
    placement: "right",
  },
  {
    id: "guide-link",
    target: "guide-link",
    title: "The full guide is always here",
    content: "Everything covered in this tour plus more detail is in the Guide. Access it anytime from the sidebar.",
    placement: "right",
  },
];

export const KB_STEPS: TourStep[] = [
  {
    id: "kb-tab",
    target: "kb-tab",
    title: "You manage Wyle's knowledge",
    content: "As a Knowledge Manager you can view and edit the files that make up Wyle's knowledge base.",
    placement: "bottom",
    requiredRole: "knowledge_manager",
  },
  {
    id: "kb-update-info",
    target: "",
    title: "Wyle also learns automatically",
    content: "Every Monday morning, Wyle processes new call transcripts and source documents and updates itself. You can always trigger a manual update anytime from the Knowledge Base page.",
    placement: "center",
    isModal: true,
    requiredRole: "knowledge_manager",
  },
];

// KB-specific onboarding tour — shown on first KB tab visit
export const KB_ONBOARDING_STEPS: TourStep[] = [
  {
    id: "kb-welcome",
    target: "",
    title: "Welcome to the Knowledge Base",
    content: "This is where you manage the files that power Wyle's responses. When a file here is updated, Wyle's answers change accordingly. This is how the team controls what Wyle knows and how it responds.",
    placement: "center",
    isModal: true,
    beforeShow: { setActiveTab: "kb" },
  },
  {
    id: "kb-source-files",
    target: "kb-source-files",
    title: "Source Files",
    content: "These are Markdown (.md) files that live in a connected Google Drive folder. Changes made in Drive flow into Wyle automatically on the weekly update schedule. You can also edit them directly here.",
    placement: "right",
    beforeShow: { setActiveTab: "kb" },
  },
  {
    id: "kb-how-docs-work",
    target: "",
    title: "How these documents affect chat",
    content: "Wyle's responses are powered by these knowledge base files. Each file covers a specific topic \u2014 objections, pricing, onboarding, etc. When you update a file, Wyle's answers on that topic change after the next rewrite. This is the primary way to teach Wyle new information or correct its responses.",
    contentHtml: "Wyle\u2019s responses are powered by these knowledge base files. Each file covers a specific topic \u2014 objections, pricing, onboarding, etc. When you update a file, Wyle\u2019s answers on that topic change <strong>after the next rewrite</strong>. This is the primary way to teach Wyle new information or correct its responses.",
    placement: "center",
    isModal: true,
  },
  {
    id: "kb-schedule",
    target: "",
    title: "Weekly update schedule",
    content: "The knowledge base is automatically rewritten every Monday.",
    contentHtml: `<div>The knowledge base is automatically rewritten every Monday:</div>
<div style="text-align:left;margin:12px auto;max-width:280px">
\u2022 12:00am PT \u2014 Sales Transcripts<br/>
\u2022 1:00am PT \u2014 Podcast Sync<br/>
\u2022 2:00am PT \u2014 InsightDocs<br/>
\u2022 3:00am PT \u2014 Fathom Transcripts<br/>
\u2022 4:00am PT \u2014 Agent Update<br/>
\u2022 5:00am PT \u2014 Knowledge Base Rewrite
</div>
<div style="margin-bottom:12px">Wyle\u2019s knowledge reflects the most recent completed run.</div>
<div style="text-align:left;background:rgba(180,30,30,0.06);border:1px solid rgba(180,30,30,0.15);border-radius:8px;padding:10px 12px;font-size:13px;line-height:1.5;color:#b91c1c">
\u26A0\uFE0F Editing a file alone won\u2019t update Wyle\u2019s responses. You must click <strong>\u201CUpdate Wyle\u2019s Knowledge\u201D</strong> or wait for the Monday rewrite.
</div>`,
    placement: "center",
    isModal: true,
  },
  {
    id: "kb-chat-to-edit",
    target: "kb-chat-to-edit",
    title: "Chat to Edit",
    content: "Use this to ask Claude to make changes to the selected file directly. Select a file, describe what you want changed, and save. No need to edit the Markdown manually.",
    placement: "right",
    beforeShow: { setActiveTab: "kb" },
  },
  {
    id: "kb-update-button",
    target: "kb-update-button",
    title: "Update Wyle's Knowledge",
    content: "This triggers an immediate out-of-schedule rewrite. Use it when you've made an important change and don't want to wait until Monday. Otherwise the weekly automation handles it.",
    placement: "bottom",
    beforeShow: { setActiveTab: "kb" },
  },
  {
    id: "kb-tour-done",
    target: "",
    title: "You're all set.",
    content: "Edit files, chat to make changes, and update Wyle's knowledge whenever you're ready.",
    placement: "center",
    isModal: true,
  },
];

export const COMPLETION_STEP: TourStep = {
  id: "completion",
  target: "",
  title: "You're all set.",
  content: "Wyle knows Freewyld. Now go use it.",
  placement: "center",
  isModal: true,
};

export function getStepsForRole(role: string): TourStep[] {
  const isKb = role === "admin" || role === "knowledge_manager";
  return [
    ...BASE_STEPS,
    ...(isKb ? KB_STEPS : []),
    COMPLETION_STEP,
  ];
}
