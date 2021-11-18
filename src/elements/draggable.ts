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
  document.querySelectorAll<HTMLElement>('.ngm-floating-window').forEach(elem => {
    if (!elem.hidden && elem !== target) {
      const targetRect = target.getBoundingClientRect();
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
    if (target.style.transform) {
      target.style.transform = `translate(0px, ${target.getAttribute('data-y')}px)`;
      target.setAttribute('data-x', '0');
    }
    const parentRect = target.parentElement!.getBoundingClientRect();
    const margin = 5;
    let moveLeft = targetRect.left - parentRect.left > parentRect.right - (checkRect.right + targetRect.width + margin);
    moveLeft = changeSide ? !moveLeft : moveLeft;
    if (moveLeft) {
      target.style.left = `${checkRect.left - targetRect.width - margin}px`;
    } else {
      target.style.left = `${checkRect.right + margin}px`;
    }
    target.style.right = 'auto';
  });
  target.interaction && target.interaction.reflow({name: 'drag', axis: 'xy'});
}

function repositionOnOpen(target) {
  const observer = new MutationObserver(((mutationsList) => {
    if (mutationsList[0].attributeName === 'hidden' && !target.hidden) {
      let overlapList: DOMRect[] = checkForOverlap(target);
      let counter = 0;
      while (overlapList.length !== 0) {
        counter++;
        moveWindow(target, overlapList, counter % 2 === 0);
        overlapList = checkForOverlap(target);
        if (counter === 10) break;
      }
    }
  }));
  observer.observe(target, {attributes: true});
}


