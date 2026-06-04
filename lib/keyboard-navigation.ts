import type { KeyboardEvent } from 'react';

const FOCUSABLE_SELECTOR = [
  'input:not([type="hidden"]):not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'button:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function isTextArea(element: Element): element is HTMLTextAreaElement {
  return element.tagName.toLowerCase() === 'textarea';
}

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => element.offsetParent !== null
  );
}

export function handleKeyboardFormNavigation(event: KeyboardEvent<HTMLElement>) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  if (isTextArea(target)) return;

  const form = target.closest('form');
  if (!form) return;

  const focusable = getFocusableElements(form);
  const currentIndex = focusable.indexOf(target);
  if (currentIndex === -1) return;

  if (event.key === 'ArrowDown') {
    event.preventDefault();
    focusable[Math.min(currentIndex + 1, focusable.length - 1)]?.focus();
    return;
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault();
    focusable[Math.max(currentIndex - 1, 0)]?.focus();
    return;
  }

  if (event.key === 'Enter') {
    const isSubmitButton = target instanceof HTMLButtonElement && target.type === 'submit';
    const isLastField = currentIndex === focusable.length - 1;

    if (isSubmitButton || isLastField) return;

    event.preventDefault();
    focusable[Math.min(currentIndex + 1, focusable.length - 1)]?.focus();
  }
}

export function moveFocusWithin(container: HTMLElement, direction: 1 | -1) {
  const focusable = getFocusableElements(container);
  if (focusable.length === 0) return;

  const activeElement = document.activeElement;
  const currentIndex =
    activeElement instanceof HTMLElement ? focusable.indexOf(activeElement) : -1;

  const nextIndex =
    currentIndex === -1
      ? 0
      : Math.min(Math.max(currentIndex + direction, 0), focusable.length - 1);

  focusable[nextIndex]?.focus();
}
