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
  /**
   * Native only: lift the toast to clear the TabBar. Set it when the toast is
   * rendered *inside* a tabbed screen (e.g. the Reservas undo toast). The
   * global success toast renders above the navigator (root `_layout`), so it
   * sits at the normal bottom offset and leaves this off.
   */
  raised?: boolean;
}
