import { create } from "zustand";

interface ToastState {
  message: string | null;
  actionLabel?: string;
  show: (message: string, actionLabel?: string) => void;
  clear: () => void;
}

// A booking made from ResourceScreen navigates back to ExploreScreen before
// the success toast should appear — plain component state can't survive that
// navigation. Kept intentionally tiny (message + one action) rather than a
// general-purpose notification queue, since that's the only case that needs it.
export const useToastStore = create<ToastState>((set) => ({
  message: null,
  actionLabel: undefined,
  show: (message, actionLabel) => set({ message, actionLabel }),
  clear: () => set({ message: null, actionLabel: undefined }),
}));
