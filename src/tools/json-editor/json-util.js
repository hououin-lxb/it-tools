
var escapedChars = {
    'b': '\b',
    'f': '\f',
    'n': '\n',
    'r': '\r',
    't': '\t',
    '"': '"',
    '/': '/',
    '\\': '\\'
};

var A_CODE = 'a'.charCodeAt();

var ESC_0 = /~/g;
var ESC_1 = /\//g;
function escapeJsonPointer(str) {
    return str.replace(ESC_0, '~0').replace(ESC_1, '~1');
}

/**
 * 返回值说明:
 * 
 * data 为 json 对象
 * 
 * pointers 为各节点路径所在位置信息, 如 '{ "foo": "bar" }' 解析为:
 * {
 *   '': {
 *     value: { line: 0, column: 0, pos: 0 },
       valueEnd: { line: 0, column: 16, pos: 16 }
 *   },
 *   '/foo': {
 *     key: { line: 0, column: 2, pos: 2 },
 *     keyEnd: { line: 0, column: 7, pos: 7 },
 *     value: { line: 0, column: 9, pos: 9 },
 *     valueEnd: { line: 0, column: 14, pos: 14 }
 *   }
 * }
 */
export function parseJson(source, _, options) {
    var pointers = {};
    var line = 0;
    var column = 0;
    var pos = 0;
    var bigint = options && options.bigint && typeof BigInt != 'undefined';
    return {
        data: _parse('', true),
        pointers: pointers
    };

    function _parse(ptr, topLevel) {
        whitespace();
        var data;
        map(ptr, 'value');
        var char = getChar();
        switch (char) {
            case 't': read('rue'); data = true; break;
            case 'f': read('alse'); data = false; break;
            case 'n': read('ull'); data = null; break;
            case '"': data = parseString(); break;
            case '[': data = parseArray(ptr); break;
            case '{': data = parseObject(ptr); break;
            default:
                backChar();
                if ('-0123456789'.indexOf(char) >= 0)
                    data = parseNumber();
                else
                    unexpectedToken();
        }
        map(ptr, 'valueEnd');
        whitespace();
        if (topLevel && pos < source.length) unexpectedToken();
        return data;
    }

    function whitespace() {
        loop:
        while (pos < source.length) {
            switch (source[pos]) {
                case ' ': column++; break;
                case '\t': column += 4; break;
                case '\r': column = 0; break;
                case '\n': column = 0; line++; break;
                default: break loop;
            }
            pos++;
        }
    }

    function parseString() {
        var str = '';
        var char;
        while (true) {
            char = getChar();
            if (char == '"') {
                break;
            } else if (char == '\\') {
                char = getChar();
                if (char in escapedChars)
                    str += escapedChars[char];
                else if (char == 'u')
                    str += getCharCode();
                else
                    wasUnexpectedToken();
            } else {
                str += char;
            }
        }
        return str;
    }

    function parseNumber() {
        var numStr = '';
        var integer = true;
        if (source[pos] == '-') numStr += getChar();

        numStr += source[pos] == '0'
            ? getChar()
            : getDigits();

        if (source[pos] == '.') {
            numStr += getChar() + getDigits();
            integer = false;
        }

        if (source[pos] == 'e' || source[pos] == 'E') {
            numStr += getChar();
            if (source[pos] == '+' || source[pos] == '-') numStr += getChar();
            numStr += getDigits();
            integer = false;
        }

        var result = +numStr;
        return bigint && integer && (result > Number.MAX_SAFE_INTEGER || result < Number.MIN_SAFE_INTEGER)
            ? BigInt(numStr)
            : result;
    }

    function parseArray(ptr) {
        whitespace();
        var arr = [];
        var i = 0;
        if (getChar() == ']') return arr;
        backChar();

        while (true) {
            var itemPtr = ptr + '/' + i;
            arr.push(_parse(itemPtr));
            whitespace();
            var char = getChar();
            if (char == ']') break;
            if (char != ',') wasUnexpectedToken();
            whitespace();
            i++;
        }
        return arr;
    }

    function parseObject(ptr) {
        whitespace();
        var obj = {};
        if (getChar() == '}') return obj;
        backChar();

        while (true) {
            var loc = getLoc();
            if (getChar() != '"') wasUnexpectedToken();
            var key = parseString();
            var propPtr = ptr + '/' + escapeJsonPointer(key);
            mapLoc(propPtr, 'key', loc);
            map(propPtr, 'keyEnd');
            whitespace();
            if (getChar() != ':') wasUnexpectedToken();
            whitespace();
            obj[key] = _parse(propPtr);
            whitespace();
            var char = getChar();
            if (char == '}') break;
            if (char != ',') wasUnexpectedToken();
            whitespace();
        }
        return obj;
    }

    function read(str) {
        for (var i = 0; i < str.length; i++)
            if (getChar() !== str[i]) wasUnexpectedToken();
    }

    function getChar() {
        checkUnexpectedEnd();
        var char = source[pos];
        pos++;
        column++; // new line?
        return char;
    }

    function backChar() {
        pos--;
        column--;
    }

    function getCharCode() {
        var count = 4;
        var code = 0;
        while (count--) {
            code <<= 4;
            var char = getChar().toLowerCase();
            if (char >= 'a' && char <= 'f')
                code += char.charCodeAt() - A_CODE + 10;
            else if (char >= '0' && char <= '9')
                code += +char;
            else
                wasUnexpectedToken();
        }
        return String.fromCharCode(code);
    }

    function getDigits() {
        var digits = '';
        while (source[pos] >= '0' && source[pos] <= '9')
            digits += getChar();

        if (digits.length) return digits;
        checkUnexpectedEnd();
        unexpectedToken();
    }

    function map(ptr, prop) {
        mapLoc(ptr, prop, getLoc());
    }

    function mapLoc(ptr, prop, loc) {
        pointers[ptr] = pointers[ptr] || {};
        pointers[ptr][prop] = loc;
    }

    function getLoc() {
        return {
            line: line,
            column: column,
            pos: pos
        };
    }

    function unexpectedToken() {
        throw new SyntaxError('Unexpected token ' + source[pos] + ' in JSON at position ' + pos);
    }

    function wasUnexpectedToken() {
        backChar();
        unexpectedToken();
    }

    function checkUnexpectedEnd() {
        if (pos >= source.length)
            throw new SyntaxError('Unexpected end of JSON input');
    }
}

/**
 * 从字符串中提取出所有有效的json串
 */
export function extractAllValidJson(str) {
    const results = [];
    const stack = [];
    const openers = { '{': '}', '[': ']' };
    const closers = { '}': '{', ']': '[' };

    let start = -1;

    for (let i = 0; i < str.length; i++) {
        const ch = str[i];

        // 遇到 { 或 [
        if (ch in openers) {
            if (stack.length === 0) start = i;
            stack.push(ch);
        }

        // 遇到 } 或 ]
        else if (ch in closers) {
            if (stack.length === 0) continue; // 非法
            const last = stack[stack.length - 1];

            if (last === closers[ch]) {
                stack.pop();
                // 栈清空 -> 找到一个 JSON 区间
                if (stack.length === 0 && start !== -1) {
                    let jsonStr = str.slice(start, i + 1);

                    // 尝试解析原始字符串
                    try {
                        JSON.parse(jsonStr)
                        results.push(jsonStr);
                    } catch {
                        // 尝试去掉尾逗号（常见日志问题）
                        const fixed = jsonStr.replace(/,(\s*[\]}])/g, '$1');
                        try {
                            JSON.parse(fixed)
                            results.push(fixed);
                        } catch {
                            // 无效，跳过
                        }
                    }
                }
            } else {
                // 括号不配对，丢弃当前块
                stack.length = 0;
                start = -1;
            }
        }
    }

    return results;
}