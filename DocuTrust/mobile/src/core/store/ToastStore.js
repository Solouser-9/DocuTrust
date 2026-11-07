let seq = 0;
let toasts = [];
const listeners = new Set();

function emit() {
  const snapshot = toasts.slice();
  listeners.forEach((listener) => listener(snapshot));
}

export const ToastStore = {
  getToasts: () => toasts,
  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  show(message, tone = 'info', duration = 2800) {
    const id = ++seq;
    toasts = [...toasts, { id, message, tone }].slice(-3);
    emit();
    setTimeout(() => ToastStore.dismiss(id), duration);
    return id;
  },
  success: (message) => ToastStore.show(message, 'success'),
  error: (message) => ToastStore.show(message, 'error'),
  info: (message) => ToastStore.show(message, 'info'),

  dismiss(id) {
    toasts = toasts.filter((t) => t.id !== id);
    emit();
  },
};
