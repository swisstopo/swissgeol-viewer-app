'use strict';

var tokenizer = require("glsl-tokenizer/string");

module.exports = function(code, option) {
    var tokens, result, i, len, t;

    tokens = tokenizer(code, option);

    result = "";
    len = tokens.length;
    for (i=0;i<len;i++) {
        t = tokens[i];
        if (t.type != "block-comment" && t.type != "line-comment" && t.type != "eof") result += t.data;
    }

    return result;
};