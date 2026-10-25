/** Shows or hides the tab, as switching to another tab or back does, and tells the page. */
export function setTabVisible(visible: boolean): void {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => (visible ? 'visible' : 'hidden'),
  });
  document.dispatchEvent(new Event('visibilitychange'));
}

/** Undoes [setTabVisible], back to jsdom's own visibility. */
export function resetTabVisibility(): void {
  Reflect.deleteProperty(document, 'visibilityState');
}
