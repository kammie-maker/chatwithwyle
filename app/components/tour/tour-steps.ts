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
    title: "Choose your mode",
    content: "Select Sales, Client Success, Revenue Management, or Onboarding based on what you're working on. Each mode gives Wyle a different lens.",
    placement: "top",
    beforeShow: { setActiveTab: "chat" },
  },
  {
    id: "interaction-toggle",
    target: "interaction-toggle",
    title: "Client Mode vs Strategy Mode",
    content: "Client Mode gives you word-for-word scripts to say to clients. Strategy Mode gives you internal coaching and context to prepare.",
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
    content: "These are the most common questions and objections for your mode. Click any to get an instant answer.",
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
    content: "Click your name to update your default mode, switch between Client and Strategy Mode defaults, and sign out.",
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
