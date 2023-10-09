"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const header = '[TSD-JSDoc]';
let isVerbose = false;
function setVerbose(value) {
    isVerbose = value;
}
exports.setVerbose = setVerbose;
function warn(msg, data) {
    if (typeof (console) === 'undefined')
        return;
    let prefix = header;
    if (data && data.meta) {
        const meta = data.meta;
        prefix = `${prefix} ${meta.filename}:${meta.lineno}:${meta.columnno}`;
    }
    console.warn(`${prefix} ${msg}`);
    if (isVerbose && arguments.length > 1) {
        console.warn(data);
    }
}
exports.warn = warn;
//# sourceMappingURL=logger.js.map