/**
 * Stands in for the browser's IntersectionObserver, which jsdom lacks. Tests tell an observed element it
 * scrolled into or out of view with [FakeIntersectionObserver.scrollIntoView].
 */
export class FakeIntersectionObserver implements IntersectionObserver {
  private static readonly observers = new Set<FakeIntersectionObserver>();

  readonly root = null;
  readonly rootMargin = '0px';
  readonly thresholds = [0];
  readonly scrollMargin = '0px';
  private readonly targets = new Set<Element>();

  constructor(private readonly callback: IntersectionObserverCallback) {
    FakeIntersectionObserver.observers.add(this);
  }

  /** Reports [target] as visible (or no longer visible) to every observer watching it. */
  static scrollIntoView(target: Element, isIntersecting = true): void {
    for (const observer of FakeIntersectionObserver.observers) {
      if (observer.targets.has(target)) {
        const entry = { target, isIntersecting } as IntersectionObserverEntry;
        observer.callback([entry], observer);
      }
    }
  }

  observe(target: Element): void {
    this.targets.add(target);
  }

  unobserve(target: Element): void {
    this.targets.delete(target);
  }

  disconnect(): void {
    this.targets.clear();
    FakeIntersectionObserver.observers.delete(this);
  }

  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}
