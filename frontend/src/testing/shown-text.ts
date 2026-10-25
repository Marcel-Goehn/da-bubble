/**
 * What [element] shows at rest, with whitespace collapsed: a closed ⋮ popover and the hover bars of
 * Messages, which only show on hover or focus, show nothing.
 */
export function shownText(element: HTMLElement): string {
  const shown = element.cloneNode(true) as HTMLElement;
  shown
    .querySelectorAll('[role=menu][hidden], [data-hover-bar]')
    .forEach((hidden) => hidden.remove());
  return shown.textContent.replace(/\s+/g, ' ').trim();
}
