
/**
 * @param {UIEvent} event
 */
const cancel = event => event.preventDefault();

/**
 * @param {string} dest
 * @param {function(File):void} fn
 */
export function init(dest, fn) {
  const dropzone = document.querySelector(dest);

  dropzone.addEventListener('dragover', cancel, false);
  dropzone.addEventListener('dragenter', cancel, false);

  dropzone.addEventListener('drop', event => {
    for (const file of event.dataTransfer.files) {
      fn(file);
    }
    cancel(event);
  }, false);
}


