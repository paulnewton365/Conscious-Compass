import { create } from 'zustand';

export const useStore = create((set, get) => ({
  // API Keys
  apiKeys: { anthropic: '', openai: '', gemini: '' },
  setApiKeys: (keys) => set({ apiKeys: { ...get().apiKeys, ...keys } }),

  // Project Info
  project: {
    brandName: '',
    websiteUrl: '',
    linkedinUrl: '',
    businessModel: 'b2b',
    assessmentDate: new Date().toISOString().split('T')[0],
  },
  setProject: (data) => set({ project: { ...get().project, ...data } }),

  // Assessment Documents
  assessments: {
    website: { content: '', steps: [], isComplete: false },
    social: { content: '', steps: [], isComplete: false },
    aiReputation: { content: '', responses: {}, isComplete: false },
    earnedMedia: { content: '', steps: [], isComplete: false },
  },
  updateAssessment: (type, data) => set({
    assessments: { ...get().assessments, [type]: { ...get().assessments[type], ...data } }
  }),

  // Scoring Results
  scores: null,
  setScores: (scores) => set({ scores }),

  // Current Step
  currentStep: 0,
  setCurrentStep: (step) => set({ currentStep: step }),

  // Reset
  reset: () => set({
    project: {
      brandName: '',
      websiteUrl: '',
      linkedinUrl: '',
      businessModel: 'b2b',
      assessmentDate: new Date().toISOString().split('T')[0],
    },
    assessments: {
      website: { content: '', steps: [], isComplete: false },
      social: { content: '', steps: [], isComplete: false },
      aiReputation: { content: '', responses: {}, isComplete: false },
      earnedMedia: { content: '', steps: [], isComplete: false },
    },
    scores: null,
    currentStep: 0,
  }),
}));
