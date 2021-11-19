import interact from 'interactjs';

/**
 * @param {HTMLElement} target
 * @param {Interact.DraggableOptions} options
 */
export default function draggable(target, options = {}) {
  const interaction = interact(target).draggable(Object.assign({
    onmove: translate,
    // keep the element within the area of it's parent
    modifiers: [
      interact.modifiers.restrictRect({
        restriction: 'parent'
      })
    ]
  }, options));
  repositionOnOpen(target);
  return interaction;
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
}

function checkForOverlap(target): DOMRect[] {
  const overlapList: DOMRect[] = [];
  const targetRect = target.getBoundingClientRect();
  document.querySelectorAll<HTMLElement>('.ngm-floating-window').forEach(elem => {
    if (!elem.hidden && elem !== target) {
      const checkRect = elem.getBoundingClientRect();
      const overlap = !(targetRect.right < checkRect.left || targetRect.left > checkRect.right);
      if (overlap) overlapList.push(checkRect);
    }
  });
  return overlapList;
}

function moveWindow(target, overlapList, changeSide) {
  overlapList.forEach(checkRect => {
    const targetRect = target.getBoundingClientRect();
    // reset transform from interaction
    if (target.style.transform) {
      target.style.transform = `translate(0px, ${target.getAttribute('data-y')}px)`;
      target.setAttribute('data-x', '0');
    }
    const parentRect = target.parentElement!.getBoundingClientRect();
    const margin = 5;
    // check on which side more space
    let moveLeft = targetRect.left - parentRect.left > parentRect.right - (checkRect.right + targetRect.width + margin);
    // try different size if not first try
    moveLeft = changeSide ? !moveLeft : moveLeft;
    if (moveLeft) {
      // move left
      target.style.left = `${checkRect.left - targetRect.width - margin}px`;
    } else {
      // right
      target.style.left = `${checkRect.right + margin}px`;
    }
    // always set right to auto to have correct window size
    target.style.right = 'auto';
  });
  // reposition window to have it always on map
  target.interaction && target.interaction.reflow({name: 'drag', axis: 'xy'});
}

function repositionOnOpen(target) {
  const observer = new MutationObserver(((mutationsList) => {
    if (mutationsList[0].attributeName === 'hidden' && !target.hidden) {
      let overlapList: DOMRect[] = checkForOverlap(target);
      for (let i = 1; i <= 10; i++) {
        moveWindow(target, overlapList, i % 2 === 0);
        overlapList = checkForOverlap(target);
        if (overlapList.length === 0) break;
      }
    }
  }));
  observer.observe(target, {attributes: true});
}


