import interact from 'interactjs';

const MARGIN_BETWEEN_WINDOWS = 5;
const TARGET_WINDOW_Z = '4';
const DEFAULT_WINDOW_Z = '1';

/**
 * @param {HTMLElement} target
 * @param {Interact.DraggableOptions} options
 */
export default function draggable(target, options = {}) {
  target.interaction = interact(target).draggable(
    Object.assign(
      {
        onmove: translate,
        // keep the element within the area of it's parent
        modifiers: [
          interact.modifiers.restrictRect({
            restriction: 'parent',
          }),
        ],
      },
      options,
    ),
  );
  repositionOnOpen(target);
}

/**
 * @param {Interact.InteractEvent} event
 */
function translate(event) {
  const target = event.target;
  // keep the dragged position in the data-x/data-y attributes
  const x = (parseFloat(target.getAttribute('data-x')) || 0) + event.dx;
  const y = (parseFloat(target.getAttribute('data-y')) || 0) + event.dy;
  target.style.transform = `translate(${x}px, ${y}px)`;
  // update the position attributes
  target.setAttribute('data-x', x);
  target.setAttribute('data-y', y);
  // show target window above other windows
  if (!target.style.zIndex || target.style.zIndex === DEFAULT_WINDOW_Z) {
    document
      .querySelectorAll<HTMLElement>('.ngm-floating-window')
      .forEach((elem) => (elem.style.zIndex = DEFAULT_WINDOW_Z));
    target.style.zIndex = TARGET_WINDOW_Z;
  }
}

function updateZIndex(target) {
  target.style.zIndex = TARGET_WINDOW_Z;
  document
    .querySelectorAll<HTMLElement>('.ngm-floating-window')
    .forEach((elem) => {
      if (elem !== target) elem.style.zIndex = DEFAULT_WINDOW_Z;
    });
}

function checkForOverlap(target): DOMRect[] {
  const overlapList: DOMRect[] = [];
  const targetRect = target.getBoundingClientRect();
  document
    .querySelectorAll<HTMLElement>('.ngm-floating-window')
    .forEach((elem) => {
      if (!elem.hidden && elem !== target) {
        const checkRect = elem.getBoundingClientRect();
        const doesOverlapH = !(
          targetRect.right < checkRect.left || targetRect.left > checkRect.right
        );
        const doesOverlapV = !(
          targetRect.bottom < checkRect.top || targetRect.top > checkRect.bottom
        );
        if (doesOverlapH && doesOverlapV) overlapList.push(checkRect);
      }
    });
  return overlapList;
}

function moveWindow(target, moveLeft) {
  const rectsForCheck = Array.from(
    document.querySelectorAll<HTMLElement>('.ngm-floating-window'),
  )
    .filter((el) => el !== target && !el.hidden)
    .map((el) => el.getBoundingClientRect())
    .sort((el1, el2) => (moveLeft ? el2.left - el1.left : el1.left - el2.left));
  const parentRect = target.parentElement!.getBoundingClientRect();

  for (let i = 0; i < rectsForCheck.length; i++) {
    const checkRect = rectsForCheck[i];
    const targetRect = target.getBoundingClientRect();
    // reset transform from interaction
    if (target.style.transform) {
      target.style.transform = 'translate(0px, 0px)';
      target.setAttribute('data-y', '0');
      target.setAttribute('data-x', '0');
    }
    // move left/right
    target.style.left = moveLeft
      ? `${checkRect.left - targetRect.width - parentRect.x - MARGIN_BETWEEN_WINDOWS}px`
      : `${checkRect.right + MARGIN_BETWEEN_WINDOWS}px`;
    // always set right to auto to have correct window size
    target.style.right = 'auto';
    // reposition window to have it always on map
    target.interaction.reflow({ name: 'drag', axis: 'xy' });
    const overlapList = checkForOverlap(target);
    // stops moving if no overlap or try to place top/bottom of next window if overlap
    if (!overlapList.length) break;
    else if (
      rectsForCheck[i + 1] &&
      !(
        // checks if enough space between checked window and next one
        (
          (moveLeft &&
            rectsForCheck[i].left - rectsForCheck[i + 1].right >
              targetRect.width + MARGIN_BETWEEN_WINDOWS) ||
          (!moveLeft &&
            rectsForCheck[i + 1].left - rectsForCheck[i].right >
              targetRect.width + MARGIN_BETWEEN_WINDOWS)
        )
      )
    ) {
      // saves a backup of style to restore if window anyway overlap another one after move top/bottom
      const styleBackup = target.style;
      const topPosition =
        rectsForCheck[i + 1].top - (targetRect.height + MARGIN_BETWEEN_WINDOWS);
      const bottomPosition =
        rectsForCheck[i + 1].bottom - parentRect.y + MARGIN_BETWEEN_WINDOWS;
      // tries to place the window on the bottom of the next window or on top
      if (
        targetRect.top < rectsForCheck[i + 1].bottom &&
        bottomPosition + targetRect.height < parentRect.height
      ) {
        target.style.top = `${bottomPosition}px`;
      } else if (
        targetRect.bottom > rectsForCheck[i + 1].top &&
        topPosition > parentRect.top
      ) {
        target.style.top = `${topPosition}px`;
      }
      // always set bottom to auto to have correct window size
      target.style.bottom = 'auto';
      const overlapList = checkForOverlap(target);
      // stops moving if no overlap or restore top/bottom styles
      if (!overlapList.length) break;
      else target.style = styleBackup;
    }
  }
}

function repositionOnOpen(target) {
  const observer = new MutationObserver((mutationsList) => {
    if (mutationsList[0].attributeName === 'hidden' && !target.hidden) {
      // always show last opened window above others
      updateZIndex(target);
      let overlapList: DOMRect[] = checkForOverlap(target);
      if (!overlapList.length) return;

      const parentRect = target.parentElement!.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      // starts moving the window to the left if enough space or to the right otherwise
      const shouldMoveLeft =
        targetRect.left - parentRect.left >
        targetRect.width + MARGIN_BETWEEN_WINDOWS;
      // moves in the first side
      moveWindow(target, shouldMoveLeft);
      overlapList = checkForOverlap(target);
      if (!overlapList.length) return;
      // moves in another side if still overlap
      moveWindow(target, !shouldMoveLeft);
    }
  });
  observer.observe(target, { attributes: true });
}
