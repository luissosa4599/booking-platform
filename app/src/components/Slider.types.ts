export interface SliderProps {
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
  step?: number;
  disabled?: boolean;
  accessibilityLabel: string;
}

export const TRACK_HEIGHT = 4;
export const THUMB_SIZE = 24;
