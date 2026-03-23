export interface TourStep {
  id: string;
  target: string; // data-tour selector value
  title: string;
  content: string;
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
    content: "This is where you manage the files that power Wyle's responses. Let's walk through the key areas.",
    placement: "center",
    isModal: true,
    beforeShow: { setActiveTab: "kb" },
  },
  {
    id: "kb-source-files",
    target: "kb-source-files",
    title: "Source Files",
    content: "All of Wyle's source documents are listed here. Click any file to view and edit it.",
    placement: "right",
    beforeShow: { setActiveTab: "kb" },
  },
  {
    id: "kb-file-viewer",
    target: "kb-file-viewer",
    title: "File Viewer",
    content: "When you select a file, its contents appear here. You can edit the text directly or use Chat to Edit for AI-assisted changes.",
    placement: "left",
    beforeShow: { setActiveTab: "kb" },
  },
  {
    id: "kb-chat-to-edit",
    target: "kb-chat-to-edit",
    title: "Chat to Edit",
    content: "Describe the change you want and Claude will suggest edits with a diff view. Review, then accept or reject.",
    placement: "right",
    beforeShow: { setActiveTab: "kb" },
  },
  {
    id: "kb-update-button",
    target: "kb-update-button",
    title: "Update Wyle's Knowledge",
    content: "After editing source files, click here to recompile Wyle's knowledge base. Changes take effect immediately after the rewrite completes.",
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
