export const TOAST_DURATION_MS = 3600;

export interface ToastScheduler {
  show: (text: string) => void;
  cancel: () => void;
}

export function createToastScheduler(
  setMessage: (text: string) => void,
  duration: number = TOAST_DURATION_MS,
): ToastScheduler {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const cancel = () => {
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
  };

  return {
    show(text) {
      cancel();
      setMessage(text);
      timer = setTimeout(() => {
        timer = undefined;
        setMessage('');
      }, duration);
    },
    cancel,
  };
}
