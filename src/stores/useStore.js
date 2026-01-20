import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useStore = create(
  persist(
    (set, get) => ({
      // API Keys
      apiKeys: { anthropic: '', openai: '', gemini: '' },
      setApiKeys: (keys) => set({ apiKeys: { ...get().apiKeys, ...keys } }),

      // Project Info
      project: {
        brandName: '',
        websiteUrl: '',
        linkedinUrl: '',
        businessModel: 'b2b',
        date: new Date().toISOString().split('T')[0],
      },
      setProject: (data) => set({ project: { ...get().project, ...data } }),

      // Assessments
      assessments: {
        website: { status: 'pending', content: '', steps: {} },
        social: { status: 'pending', content: '', steps: {} },
        aiReputation: { status: 'pending', content: '', responses: {} },
        earnedMedia: { status: 'pending', content: '', steps: {} },
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
        project: { brandName: '', websiteUrl: '', linkedinUrl: '', businessModel: 'b2b', date: new Date().toISOString().split('T')[0] },
        assessments: {
          website: { status: 'pending', content: '', steps: {} },
          social: { status: 'pending', content: '', steps: {} },
          aiReputation: { status: 'pending', content: '', responses: {} },
          earnedMedia: { status: 'pending', content: '', steps: {} },
        },
        scores: null,
        currentStep: 0,
      }),
    }),
    { name: 'conscious-compass-storage' }
  )
);
