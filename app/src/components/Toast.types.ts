export interface ToastProps {
  // Separate from `message` so the component can own its own exit
  // transition: the parent flips this to `false` and can clear `message` in
  // the same render — the implementation is responsible for still showing
  // something sensible while it animates out.
  isOpen: boolean;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss: () => void;
  durationMs?: number;
}
