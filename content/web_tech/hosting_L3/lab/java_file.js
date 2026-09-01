// ============================
// JS Educational Interpreter (line-by-line, brace-based blocks)
// Drop-in replacement — keeps the same element ids / class names:
// #codeEditor, #output, #memoryContainer,
// .line-container .input-prompt .input-container .user-input .submit-input
// .output-text .error-text .variable-box .variable-name .variable-type .variable-value
// ============================

let variables = {};
let codeLines = [];          // [{ text, depth }]
let currentLineIndex = 0;
let indentStack = [];        // block stack: { type: 'if'|'while'|'for'|'cfor', indent, condition }
let skipUntilIndent = -1;
let loopStack = [];          // active loops: { type, startLine, indent, ... }
let maxIterations = 5000;

// ---------- Helper available inside evaluated expressions ----------
function range(a, b, c) {
    let start = 0, stop, step = 1;
    if (b === undefined) {
        stop = a;
    } else {
        start = a;
        stop = b;
        if (c !== undefined) step = c;
    }
    const result = [];
    if (step > 0) {
        for (let i = start; i < stop; i += step) result.push(i);
    } else if (step < 0) {
        for (let i = start; i > stop; i += step) result.push(i);
    }
    return result;
}

// ---------- Entry point ----------
function runCode() {
    const code = document.getElementById("codeEditor").value;
    const output = document.getElementById("output");
    const memoryContainer = document.getElementById("memoryContainer");

    if (!code.trim()) {
        output.innerHTML = '<div class="error-text">⚠️ من فضلك اكتبي كود أولاً!</div>';
        return;
    }

    output.innerHTML = '';
    memoryContainer.innerHTML = '';
    variables = {};
    currentLineIndex = 0;
    indentStack = [];
    skipUntilIndent = -1;
    loopStack = [];

    codeLines = tokenize(code);
    executeNext();
}

// ---------- Tokenizer: strip comments, split lines, compute brace depth ----------
function tokenize(code) {
    code = code.replace(/\/\*[\s\S]*?\*\//g, ''); // block comments

    const rawLines = code.split('\n');
    let depth = 0;
    const lines = [];

    for (const raw of rawLines) {
        const line = stripLineComment(raw).trim();
        if (line === '') continue;

        let scan = line;
        let leadingCloses = 0;
        while (scan.startsWith('}')) {
            leadingCloses++;
            scan = scan.slice(1).trim();
        }
        let lineDepth = depth - leadingCloses;
        if (lineDepth < 0) lineDepth = 0;

        lines.push({ text: line, depth: lineDepth });

        const opens = (scan.match(/\{/g) || []).length;
        const closes = (scan.match(/\}/g) || []).length;
        depth = lineDepth + opens - closes;
        if (depth < 0) depth = 0;
    }

    return lines;
}

function stripLineComment(raw) {
    let result = '';
    let inString = false;
    let quoteChar = '';
    for (let i = 0; i < raw.length; i++) {
        const c = raw[i];
        if (inString) {
            result += c;
            if (c === quoteChar && raw[i - 1] !== '\\') inString = false;
        } else if (c === '"' || c === "'" || c === '`') {
            inString = true;
            quoteChar = c;
            result += c;
        } else if (c === '/' && raw[i + 1] === '/') {
            break;
        } else {
            result += c;
        }
    }
    return result;
}

// ---------- Main execution loop ----------
function executeNext() {
    if (currentLineIndex >= codeLines.length) return;

    const { text: line, depth } = codeLines[currentLineIndex];

    if (skipUntilIndent >= 0) {
        if (depth > skipUntilIndent) {
            currentLineIndex++;
            setTimeout(executeNext, 30);
            return;
        } else {
            skipUntilIndent = -1;
        }
    }

    try {
        // ---- if ----
        let m = line.match(/^if\s*\((.+)\)\s*\{$/);
        if (m) {
            const result = evaluateCondition(m[1]);
            indentStack.push({ type: 'if', indent: depth, condition: result });
            if (!result) skipUntilIndent = depth;
            currentLineIndex++;
            setTimeout(executeNext, 30);
            return;
        }

        // ---- else if ----
        m = line.match(/^\}\s*else\s+if\s*\((.+)\)\s*\{$/);
        if (m) {
            let found = false;
            for (let i = indentStack.length - 1; i >= 0; i--) {
                if (indentStack[i].type === 'if' && indentStack[i].indent === depth) {
                    found = true;
                    if (indentStack[i].condition) {
                        skipUntilIndent = depth;
                    } else {
                        const result = evaluateCondition(m[1]);
                        indentStack[i].condition = result;
                        skipUntilIndent = result ? -1 : depth;
                    }
                    break;
                }
            }
            if (!found) addErrorMessage('❌ else if بدون if مطابق');
            currentLineIndex++;
            setTimeout(executeNext, 30);
            return;
        }

        // ---- else ----
        m = line.match(/^\}\s*else\s*\{$/);
        if (m) {
            let found = false;
            for (let i = indentStack.length - 1; i >= 0; i--) {
                if (indentStack[i].type === 'if' && indentStack[i].indent === depth) {
                    found = true;
                    skipUntilIndent = indentStack[i].condition ? depth : -1;
                    break;
                }
            }
            if (!found) addErrorMessage('❌ else بدون if مطابق');
            currentLineIndex++;
            setTimeout(executeNext, 30);
            return;
        }

        // ---- while ----
        m = line.match(/^while\s*\((.+)\)\s*\{$/);
        if (m) {
            const condition = m[1];
            const result = evaluateCondition(condition);
            loopStack.push({ type: 'while', startLine: currentLineIndex, indent: depth, condition, iterations: 0 });
            indentStack.push({ type: 'while', indent: depth, condition: result });
            if (!result) skipUntilIndent = depth;
            currentLineIndex++;
            setTimeout(executeNext, 30);
            return;
        }

        // ---- C-style for ----
        m = line.match(/^for\s*\(\s*(.+?)\s*;\s*(.+?)\s*;\s*(.+?)\s*\)\s*\{$/);
        if (m) {
            const [, initStr, condition, updateStr] = m;
            try { execAssignLike(initStr); } catch (e) {
                addErrorMessage(`❌ خطأ في بداية الحلقة: ${initStr}`);
            }
            const result = evaluateCondition(condition);
            loopStack.push({ type: 'cfor', startLine: currentLineIndex, indent: depth, condition, updateStr, iterations: 0 });
            indentStack.push({ type: 'cfor', indent: depth, condition: result });
            if (!result) skipUntilIndent = depth;
            currentLineIndex++;
            setTimeout(executeNext, 30);
            return;
        }

        // ---- for...of ----
        m = line.match(/^for\s*\(\s*(?:let|const|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s+of\s+(.+)\)\s*\{$/);
        if (m) {
            const loopVar = m[1];
            const iterableExpr = m[2];
            let iterableValue = [];
            try { iterableValue = toIterable(evaluateExpression(iterableExpr)); }
            catch (e) { addErrorMessage(`❌ خطأ في التكرار: ${iterableExpr}`); }

            loopStack.push({ type: 'for', startLine: currentLineIndex, indent: depth, loopVar, iterable: iterableValue, currentIndex: 0, iterations: 0 });

            if (iterableValue.length === 0) {
                indentStack.push({ type: 'for', indent: depth, condition: false });
                skipUntilIndent = depth;
            } else {
                variables[loopVar] = iterableValue[0];
                addVariableBox(loopVar, iterableValue[0]);
                indentStack.push({ type: 'for', indent: depth, condition: true });
            }
            currentLineIndex++;
            setTimeout(executeNext, 30);
            return;
        }

        // ---- standalone closing brace ----
        if (line === '}') {
            const jumped = closeBlock(depth);
            if (jumped) return;
            currentLineIndex++;
            setTimeout(executeNext, 30);
            return;
        }

        // ---- break ----
        if (/^break\s*;?$/.test(line)) {
            if (loopStack.length === 0) {
                addErrorMessage('❌ break خارج حلقة');
            } else {
                const loop = loopStack.pop();
                while (indentStack.length > 0 && indentStack[indentStack.length - 1].indent >= loop.indent) {
                    indentStack.pop();
                }
                skipUntilIndent = loop.indent;
            }
            currentLineIndex++;
            setTimeout(executeNext, 30);
            return;
        }

        // ---- continue ----
        if (/^continue\s*;?$/.test(line)) {
            if (loopStack.length === 0) {
                addErrorMessage('❌ continue خارج حلقة');
                currentLineIndex++;
                setTimeout(executeNext, 30);
                return;
            }
            const loop = loopStack[loopStack.length - 1];
            while (indentStack.length > 0 && indentStack[indentStack.length - 1].indent > loop.indent) {
                indentStack.pop();
            }
            skipUntilIndent = loop.indent;
            currentLineIndex++;
            setTimeout(executeNext, 30);
            return;
        }

        // ---- input assignment: let x = input("..."), parseInt(input(...)), etc. ----
        m = line.match(/^(?:let|const|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(parseInt\(|parseFloat\(|Number\(|Boolean\(|)?input\s*\(\s*(.*?)\s*\)\s*\)?\s*;?$/);
        if (m) {
            const varName = m[1];
            const conversionType = m[2];
            const promptExpr = m[3];
            let prompt = '';
            try { prompt = promptExpr ? evaluateExpression(promptExpr) : ''; } catch (e) { prompt = promptExpr; }
            addInputPrompt(prompt, varName, conversionType);
            currentLineIndex++;
            return; // wait for user input
        }

        // ---- console.log ----
        m = line.match(/^console\.log\s*\((.*)\)\s*;?$/);
        if (m) {
            const argsStr = m[1].trim();
            const args = argsStr === '' ? [] : parseArguments(argsStr);
            const parts = args.map(a => {
                try { return stringifyValue(evaluateExpression(a)); }
                catch (e) { return a; }
            });
            addOutputText(parts.join(' '));
            currentLineIndex++;
            setTimeout(executeNext, 30);
            return;
        }

        // ---- declaration / assignment / compound / increment ----
        try {
            execAssignLike(line);
        } catch (e) {
            addErrorMessage(`⚠️ خطأ في السطر: ${line}`);
        }

        currentLineIndex++;
        setTimeout(executeNext, 30);

    } catch (err) {
        addErrorMessage('❌ خطأ في الكود');
        console.error(err);
        currentLineIndex++;
        setTimeout(executeNext, 30);
    }
}

// ---------- Close a `}` block, handling loop continuation ----------
function closeBlock(depth) {
    while (indentStack.length > 0 && indentStack[indentStack.length - 1].indent >= depth) {
        const popped = indentStack.pop();

        if ((popped.type === 'for' || popped.type === 'cfor' || popped.type === 'while') && loopStack.length > 0) {
            const loop = loopStack[loopStack.length - 1];
            if (loop.indent === popped.indent && loop.type === popped.type) {
                loop.iterations++;
                if (loop.iterations > maxIterations) {
                    addErrorMessage('❌ تم إيقاف الحلقة: تجاوزت الحد الأقصى للتكرارات');
                    loopStack.pop();
                    return false;
                }

                if (popped.type === 'for') {
                    loop.currentIndex++;
                    if (loop.currentIndex < loop.iterable.length) {
                        variables[loop.loopVar] = loop.iterable[loop.currentIndex];
                        addVariableBox(loop.loopVar, loop.iterable[loop.currentIndex]);
                        currentLineIndex = loop.startLine + 1;
                        indentStack.push({ type: 'for', indent: loop.indent, condition: true });
                        setTimeout(executeNext, 30);
                        return true;
                    }
                    loopStack.pop();
                } else if (popped.type === 'cfor') {
                    try { execAssignLike(loop.updateStr); } catch (e) {}
                    const result = evaluateCondition(loop.condition);
                    if (result) {
                        currentLineIndex = loop.startLine + 1;
                        indentStack.push({ type: 'cfor', indent: loop.indent, condition: true });
                        setTimeout(executeNext, 30);
                        return true;
                    }
                    loopStack.pop();
                } else if (popped.type === 'while') {
                    const result = evaluateCondition(loop.condition);
                    if (result) {
                        currentLineIndex = loop.startLine + 1;
                        indentStack.push({ type: 'while', indent: loop.indent, condition: true });
                        setTimeout(executeNext, 30);
                        return true;
                    }
                    loopStack.pop();
                }
            }
        }
    }
    return false;
}

// ---------- Declaration / assignment / compound / increment ----------
function execAssignLike(line) {
    line = line.trim().replace(/;$/, '');

    let m = line.match(/^(?:let|const|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(.+)$/);
    if (m) {
        const value = evaluateExpression(m[2]);
        variables[m[1]] = value;
        addVariableBox(m[1], value);
        return;
    }

    m = line.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)\s*([+\-*/%])=\s*(.+)$/);
    if (m) {
        const [, varName, op, expr] = m;
        if (!variables.hasOwnProperty(varName)) throw new Error(`المتغير '${varName}' غير معرف`);
        const value = evaluateExpression(`(${varName}) ${op} (${expr})`);
        variables[varName] = value;
        addVariableBox(varName, value);
        return;
    }

    m = line.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)\s*(\+\+|--)$/);
    if (m) {
        const [, varName, op] = m;
        if (!variables.hasOwnProperty(varName)) throw new Error(`المتغير '${varName}' غير معرف`);
        variables[varName] = evaluateExpression(`(${varName}) ${op === '++' ? '+' : '-'} 1`);
        addVariableBox(varName, variables[varName]);
        return;
    }

    m = line.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=(?!=)\s*(.+)$/);
    if (m) {
        const value = evaluateExpression(m[2]);
        variables[m[1]] = value;
        addVariableBox(m[1], value);
        return;
    }

    throw new Error(`Unrecognized statement: ${line}`);
}

// ---------- Expression / condition evaluation (real JS semantics) ----------
function evaluateExpression(expr) {
    if (expr === undefined || expr === null) return expr;
    expr = String(expr).trim();
    if (expr === '') return undefined;
    const fn = new Function('vars', 'range', `with (vars) { return (${expr}); }`);
    return fn(variables, range);
}

function evaluateCondition(expr) {
    try {
        return Boolean(evaluateExpression(expr));
    } catch (e) {
        addErrorMessage(`❌ خطأ في تقييم الشرط: ${expr}`);
        return false;
    }
}

function toIterable(value) {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') return Array.from(value);
    if (value && typeof value === 'object') return Object.values(value);
    throw new Error('Value is not iterable');
}

function stringifyValue(v) {
    if (v === undefined) return 'undefined';
    if (v === null) return 'null';
    if (typeof v === 'object') {
        try { return JSON.stringify(v); } catch (e) { return String(v); }
    }
    return String(v);
}

// ---------- Argument splitting (respects strings & nested parens/brackets) ----------
function parseArguments(content) {
    const args = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = '';
    let depthCount = 0;

    for (let i = 0; i < content.length; i++) {
        const char = content[i];

        if ((char === '"' || char === "'" || char === '`') && !inQuotes) {
            inQuotes = true;
            quoteChar = char;
            current += char;
        } else if (char === quoteChar && inQuotes && content[i - 1] !== '\\') {
            inQuotes = false;
            current += char;
        } else if (!inQuotes && (char === '(' || char === '[' || char === '{')) {
            depthCount++;
            current += char;
        } else if (!inQuotes && (char === ')' || char === ']' || char === '}')) {
            depthCount--;
            current += char;
        } else if (char === ',' && !inQuotes && depthCount === 0) {
            args.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    if (current.trim() !== '') args.push(current.trim());
    return args;
}

// ---------- Input UI ----------
function addInputPrompt(prompt, varName, conversionType) {
    const output = document.getElementById("output");

    const lineContainer = document.createElement('div');
    lineContainer.className = 'line-container';

    const promptDiv = document.createElement('div');
    promptDiv.className = 'input-prompt';
    promptDiv.textContent = prompt;

    const inputContainer = document.createElement('div');
    inputContainer.className = 'input-container';

    const inputField = document.createElement('input');
    inputField.type = 'text';
    inputField.className = 'user-input';

    if (conversionType === 'parseInt(') {
        inputField.placeholder = 'أدخل رقم صحيح (مثل: 5, 10, -3)';
    } else if (conversionType === 'parseFloat(' || conversionType === 'Number(') {
        inputField.placeholder = 'أدخل رقم (مثل: 3.14, 5)';
    } else if (conversionType === 'Boolean(') {
        inputField.placeholder = 'true أو false';
    } else {
        inputField.placeholder = 'اكتب إجابتك هنا...';
    }

    const submitBtn = document.createElement('button');
    submitBtn.className = 'submit-input';
    submitBtn.textContent = 'إرسال';

    inputContainer.appendChild(inputField);
    inputContainer.appendChild(submitBtn);
    lineContainer.appendChild(promptDiv);
    lineContainer.appendChild(inputContainer);
    output.appendChild(lineContainer);
    inputField.focus();

    const handleSubmit = () => {
        const userValue = inputField.value.trim();
        if (!userValue) return;

        let finalValue = userValue;
        let hasError = false;

        if (conversionType === 'parseInt(') {
            const n = parseInt(userValue, 10);
            if (isNaN(n)) {
                addErrorMessage(`❌ خطأ: "${userValue}" ليس رقماً صحيحاً!`);
                inputField.value = '';
                inputField.focus();
                hasError = true;
            } else finalValue = n;
        } else if (conversionType === 'parseFloat(' || conversionType === 'Number(') {
            const n = parseFloat(userValue);
            if (isNaN(n)) {
                addErrorMessage(`❌ خطأ: "${userValue}" ليس رقماً!`);
                inputField.value = '';
                inputField.focus();
                hasError = true;
            } else finalValue = n;
        } else if (conversionType === 'Boolean(') {
            finalValue = userValue.toLowerCase() === 'true' || userValue === '1';
        }

        if (!hasError) {
            variables[varName] = finalValue;
            addVariableBox(varName, finalValue, conversionType);
            inputContainer.remove();

            const userResponse = document.createElement('div');
            userResponse.className = 'output-text';
            userResponse.textContent = userValue;
            userResponse.style.alignSelf = 'flex-end';
            lineContainer.appendChild(userResponse);

            setTimeout(executeNext, 60);
        }
    };

    submitBtn.addEventListener('click', handleSubmit);
    inputField.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSubmit();
        }
    });

    output.scrollTop = output.scrollHeight;
}

// ---------- Memory / output panels ----------
function addVariableBox(name, value, conversionType) {
    const memoryContainer = document.getElementById("memoryContainer");
    const typeLabel = describeType(value, conversionType);
    const displayValue = Array.isArray(value) || (value && typeof value === 'object')
        ? JSON.stringify(value)
        : String(value);

    const existingBox = memoryContainer.querySelector(`[data-var="${name}"]`);
    if (existingBox) {
        existingBox.querySelector('.variable-value').textContent = displayValue;
        existingBox.querySelector('.variable-type').textContent = typeLabel;
        existingBox.style.animation = 'none';
        setTimeout(() => { existingBox.style.animation = 'slideIn 0.3s ease-out'; }, 10);
        return;
    }

    const varBox = document.createElement('div');
    varBox.className = 'variable-box';
    varBox.setAttribute('data-var', name);
    varBox.innerHTML = `
        <div class="variable-name">📦 ${name}</div>
        <div class="variable-type">${typeLabel}</div>
        <div class="variable-value">${displayValue}</div>
    `;
    memoryContainer.appendChild(varBox);
    memoryContainer.scrollTop = memoryContainer.scrollHeight;
}

function describeType(value, conversionType) {
    if (conversionType === 'parseInt(') return '🔢 integer';
    if (conversionType === 'parseFloat(' || conversionType === 'Number(') return '🔢 number';
    if (conversionType === 'Boolean(') return '✅ boolean';
    if (Array.isArray(value)) return '📚 array';
    if (typeof value === 'number') return Number.isInteger(value) ? '🔢 integer' : '🔢 float';
    if (typeof value === 'string') return '📝 string';
    if (typeof value === 'boolean') return '✅ boolean';
    if (value && typeof value === 'object') return '🗂️ object';
    return '🔍 unknown';
}

function addOutputText(text) {
    const output = document.getElementById("output");
    const textDiv = document.createElement('div');
    textDiv.className = 'output-text';
    textDiv.textContent = text;
    output.appendChild(textDiv);
    output.scrollTop = output.scrollHeight;
}

function addErrorMessage(text) {
    const output = document.getElementById("output");
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-text';
    errorDiv.textContent = text;
    output.appendChild(errorDiv);
    output.scrollTop = output.scrollHeight;
}

function loadExample(code) {
    document.getElementById("codeEditor").value = code.replace(/\\n/g, '\n');
}

// ---------- UI wiring ----------
const codeEditorEl = document.getElementById("codeEditor");
if (codeEditorEl) {
    codeEditorEl.addEventListener("keydown", function (event) {
        if (event.ctrlKey && event.key === "Enter") {
            event.preventDefault();
            runCode();
        }
    });
    codeEditorEl.addEventListener('input', function () {
        this.style.height = 'auto';
        this.style.height = this.scrollHeight + 'px';
    });
}