// Store variables and execution state
let variables = {};
let codeLines = [];
let currentLineIndex = 0;
let isWaitingForInput = false;
let currentInputVariable = '';
let indentStack = []; // Stack to track indentation levels
let skipUntilIndent = -1; // Skip execution until we reach this indentation level
let loopStack = []; // Stack to track while loops
let maxIterations = 1000; // Prevent infinite loops

function runCode() {
    const code = document.getElementById("codeEditor").value;
    const output = document.getElementById("output");
    const memoryContainer = document.getElementById("memoryContainer");
    
    if (!code.trim()) {
        output.innerHTML = '<div class="error-text">⚠️ Please write some code first!</div>';
        return;
    }
    
    // Clear screen and reset variables
    output.innerHTML = '';
    memoryContainer.innerHTML = '';
    variables = {};
    isWaitingForInput = false;
    currentInputVariable = '';
    currentLineIndex = 0;
    indentStack = [];
    skipUntilIndent = -1;
    loopStack = [];
    
    // Prepare code lines (preserve original spacing for indentation)
    codeLines = code.split('\n').filter(line => line.trim() !== '' && !line.trim().startsWith('#'));
    
    // Start executing
    executeNext();
}

function executeNext() {
    if (currentLineIndex >= codeLines.length) {
        return; // Execution complete
    }

    const originalLine = codeLines[currentLineIndex];
    const line = originalLine.trim();
    const indentLevel = getIndentLevel(originalLine);
    
    // Handle skipping lines due to false condition
    if (skipUntilIndent >= 0) {
        if (indentLevel > skipUntilIndent) {
            currentLineIndex++;
            setTimeout(() => executeNext(), 50);
            return;
        } else {
            skipUntilIndent = -1; // Reset skip mode
        }
    }
    
    try {
        // Check for for loops
        const forMatch = line.match(/^for\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+in\s+(.+):\s*$/);
        if (forMatch) {
            const loopVar = forMatch[1];
            const iterable = forMatch[2].trim();
            
            try {
                // Evaluate the iterable (range, list, string, etc.)
                const iterableValue = evaluateIterable(iterable);
                
                // Add to loop stack
                loopStack.push({
                    type: 'for',
                    startLine: currentLineIndex,
                    indent: indentLevel,
                    loopVar: loopVar,
                    iterable: iterableValue,
                    currentIndex: 0,
                    iterations: 0
                });
                
                // Check if iterable has items
                if (iterableValue.length === 0) {
                    // Skip the for loop body
                    skipUntilIndent = indentLevel;
                    indentStack.push({
                        type: 'for',
                        indent: indentLevel,
                        condition: false
                    });
                } else {
                    // Set loop variable to first item
                    variables[loopVar] = iterableValue[0];
                    addVariableBox(loopVar, iterableValue[0]);
                    
                    indentStack.push({
                        type: 'for',
                        indent: indentLevel,
                        condition: true
                    });
                }
                
            } catch (e) {
                addErrorMessage(`❌ خطأ في تقييم التكرار: ${iterable}`);
                indentStack.push({
                    type: 'for',
                    indent: indentLevel,
                    condition: false
                });
                skipUntilIndent = indentLevel;
            }
            
            currentLineIndex++;
            setTimeout(() => executeNext(), 50);
            return;
        }

        // Check for while loops
        const whileMatch = line.match(/^while\s+(.+):\s*$/);
        if (whileMatch) {
            const condition = whileMatch[1];
            const conditionResult = evaluateCondition(condition);
            
            // Add to loop stack
            loopStack.push({
                type: 'while',
                startLine: currentLineIndex,
                indent: indentLevel,
                condition: condition,
                iterations: 0
            });
            
            indentStack.push({
                type: 'while',
                indent: indentLevel,
                condition: conditionResult
            });
            
            if (!conditionResult) {
                // Skip the while loop body
                skipUntilIndent = indentLevel;
            }
            
            currentLineIndex++;
            setTimeout(() => executeNext(), 50);
            return;
        }
        
        // Check for if statements
        const ifMatch = line.match(/^if\s+(.+):\s*$/);
        if (ifMatch) {
            const condition = ifMatch[1];
            const conditionResult = evaluateCondition(condition);
            
            indentStack.push({
                type: 'if',
                indent: indentLevel,
                condition: conditionResult
            });
            
            if (!conditionResult) {
                // Skip lines until we find a line with same or less indentation
                skipUntilIndent = indentLevel;
            }
            
            currentLineIndex++;
            setTimeout(() => executeNext(), 50);
            return;
        }
        
        // Check for elif statements
        const elifMatch = line.match(/^elif\s+(.+):\s*$/);
        if (elifMatch) {
            const condition = elifMatch[1];
            
            // Check if we have a matching if block
            let foundMatchingBlock = false;
            for (let i = indentStack.length - 1; i >= 0; i--) {
                if (indentStack[i].type === 'if' && indentStack[i].indent === indentLevel) {
                    foundMatchingBlock = true;
                    // If any previous if/elif in this chain was true, skip this elif
                    if (indentStack[i].condition) {
                        skipUntilIndent = indentLevel;
                    } else {
                        // Evaluate this elif condition
                        const conditionResult = evaluateCondition(condition);
                        indentStack[i].condition = conditionResult;
                        
                        if (!conditionResult) {
                            skipUntilIndent = indentLevel;
                        } else {
                            skipUntilIndent = -1; // Execute this block
                        }
                    }
                    break;
                }
            }
            
            if (!foundMatchingBlock) {
                addErrorMessage(`❌ elif بدون if مطابق`);
            }
            
            currentLineIndex++;
            setTimeout(() => executeNext(), 50);
            return;
        }
        
        // Check for else statements
        const elseMatch = line.match(/^else:\s*$/);
        if (elseMatch) {
            let foundMatchingBlock = false;
            for (let i = indentStack.length - 1; i >= 0; i--) {
                if (indentStack[i].type === 'if' && indentStack[i].indent === indentLevel) {
                    foundMatchingBlock = true;
                    // If any previous if/elif was true, skip else
                    if (indentStack[i].condition) {
                        skipUntilIndent = indentLevel;
                    } else {
                        skipUntilIndent = -1; // Execute else block
                    }
                    break;
                }
            }
            
            if (!foundMatchingBlock) {
                addErrorMessage(`❌ else بدون if مطابق`);
            }
            
            currentLineIndex++;
            setTimeout(() => executeNext(), 50);
            return;
        }
        
        // Clean up indent stack when we exit a block
        while (indentStack.length > 0 && indentStack[indentStack.length - 1].indent >= indentLevel) {
            const poppedBlock = indentStack.pop();
            
            // If we're exiting a for loop, check if we need to loop to next item
            if (poppedBlock.type === 'for' && loopStack.length > 0) {
                const currentLoop = loopStack[loopStack.length - 1];
                
                if (currentLoop.indent === poppedBlock.indent && currentLoop.type === 'for') {
                    currentLoop.iterations++;
                    currentLoop.currentIndex++;
                    
                    // Prevent infinite loops
                    if (currentLoop.iterations > maxIterations) {
                        addErrorMessage('❌ تم إيقاف الحلقة: تجاوزت الحد الأقصى للتكرارات (1000)');
                        loopStack.pop();
                        return;
                    }
                    
                    // Check if there are more items to iterate
                    if (currentLoop.currentIndex < currentLoop.iterable.length) {
                        // Set loop variable to next item
                        variables[currentLoop.loopVar] = currentLoop.iterable[currentLoop.currentIndex];
                        addVariableBox(currentLoop.loopVar, currentLoop.iterable[currentLoop.currentIndex]);
                        
                        // Continue the loop - go back to the line after for
                        currentLineIndex = currentLoop.startLine + 1;
                        indentStack.push({
                            type: 'for',
                            indent: currentLoop.indent,
                            condition: true
                        });
                        setTimeout(() => executeNext(), 50);
                        return;
                    } else {
                        // Exit the loop
                        loopStack.pop();
                    }
                }
            }
            
            // If we're exiting a while loop, check if we need to loop back
            else if (poppedBlock.type === 'while' && loopStack.length > 0) {
                const currentLoop = loopStack[loopStack.length - 1];
                
                if (currentLoop.indent === poppedBlock.indent && currentLoop.type === 'while') {
                    // Check if we should continue the loop
                    currentLoop.iterations++;
                    
                    // Prevent infinite loops
                    if (currentLoop.iterations > maxIterations) {
                        addErrorMessage('❌ تم إيقاف الحلقة: تجاوزت الحد الأقصى للتكرارات (1000)');
                        loopStack.pop();
                        return;
                    }
                    
                    const conditionResult = evaluateCondition(currentLoop.condition);
                    
                    if (conditionResult) {
                        // Continue the loop - go back to the line after while
                        currentLineIndex = currentLoop.startLine + 1;
                        indentStack.push({
                            type: 'while',
                            indent: currentLoop.indent,
                            condition: conditionResult
                        });
                        setTimeout(() => executeNext(), 50);
                        return;
                    } else {
                        // Exit the loop
                        loopStack.pop();
                    }
                }
            }
        }
        
        // Check for variable assignment with input (different types)
        const inputMatch = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(int\(|float\()?input\s*\(\s*(.+?)\s*\)\)?$/);
        if (inputMatch) {
            const varName = inputMatch[1];
            const conversionType = inputMatch[2]; // int( or float( or undefined
            const promptExpr = inputMatch[3];
            
            // Evaluate the prompt expression (could be a variable or string)
            const prompt = evaluateExpression(promptExpr);
            
            // Show input prompt with conversion type
            addInputPrompt(prompt, varName, conversionType);
            currentLineIndex++;
            return; // Wait for user input
        }
        
        // Check for compound assignment operators (+=, -=, *=, /=)
        const compoundMatch = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*([+\-*/])=\s*(.+)$/);
        if (compoundMatch) {
            const varName = compoundMatch[1];
            const operator = compoundMatch[2];
            const expression = compoundMatch[3].trim();
            
            // Check if variable exists
            if (!variables.hasOwnProperty(varName)) {
                addErrorMessage(`❌ خطأ: المتغير '${varName}' غير معرف`);
                currentLineIndex++;
                setTimeout(() => executeNext(), 50);
                return;
            }
            
            try {
                const currentValue = variables[varName];
                const rightValue = evaluateExpression(expression);
                let result;
                
                switch (operator) {
                    case '+':
                        // Handle both numeric addition and string concatenation
                        if (typeof currentValue === 'string' || typeof rightValue === 'string') {
                            result = String(currentValue) + String(rightValue);
                        } else {
                            result = currentValue + rightValue;
                        }
                        break;
                    case '-':
                        result = currentValue - rightValue;
                        break;
                    case '*':
                        // Handle string multiplication
                        if (typeof currentValue === 'string' && typeof rightValue === 'number') {
                            result = currentValue.repeat(rightValue);
                        } else if (typeof currentValue === 'number' && typeof rightValue === 'string') {
                            result = rightValue.repeat(currentValue);
                        } else {
                            result = currentValue * rightValue;
                        }
                        break;
                    case '/':
                        if (rightValue === 0) {
                            addErrorMessage('❌ خطأ: لا يمكن القسمة على صفر');
                            currentLineIndex++;
                            setTimeout(() => executeNext(), 50);
                            return;
                        }
                        result = currentValue / rightValue;
                        break;
                }
                
                variables[varName] = result;
                addVariableBox(varName, result);
                
            } catch (e) {
                addErrorMessage(`❌ خطأ في العملية: ${line}`);
                console.error(e);
            }
        }
        
        // Check for regular variable assignment
        else {
            const varMatch = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(.+)$/);
            if (varMatch) {
                const varName = varMatch[1];
                let varExpression = varMatch[2].trim();
                
                try {
                    // Evaluate the expression (could be string, number, variable, or complex expression)
                    const result = evaluateExpression(varExpression);
                    variables[varName] = result;
                    
                    // Display variable box in memory section
                    addVariableBox(varName, variables[varName]);
                } catch (e) {
                    addErrorMessage(`❌ خطأ في تقييم التعبير: ${varExpression}`);
                    console.error(e);
                }
            }
            
            // Check for print statements
            else if (line.startsWith('print(')) {
                const printContent = line.match(/print\s*\(\s*(.*)\s*\)/);
                if (printContent) {
                    let content = printContent[1];
                    
                    // Handle multiple arguments separated by commas
                    const args = parseArguments(content);
                    let output_text = '';
                    
                    for (let i = 0; i < args.length; i++) {
                        let arg = args[i].trim();
                        
                        try {
                            const result = evaluateExpression(arg);
                            output_text += result;
                        } catch (e) {
                            output_text += arg;
                        }
                        
                        if (i < args.length - 1) {
                            output_text += ' ';
                        }
                    }
                    
                    addOutputText(output_text);
                }
            }
            
            // Check for break statement
            else if (line === 'break') {
                // Find the innermost loop
                let foundLoop = false;
                for (let i = loopStack.length - 1; i >= 0; i--) {
                    if (loopStack[i].type === 'while' || loopStack[i].type === 'for') {
                        // Remove the loop from stack
                        loopStack.splice(i, 1);
                        
                        // Skip to the end of the loop body
                        skipUntilIndent = loopStack.length > 0 ? loopStack[loopStack.length - 1].indent : -1;
                        foundLoop = true;
                        break;
                    }
                }
                
                if (!foundLoop) {
                    addErrorMessage('❌ break خارج حلقة');
                }
            }
            
            // Check for continue statement
            else if (line === 'continue') {
                // Find the innermost loop and jump back to its condition/next iteration
                let foundLoop = false;
                for (let i = loopStack.length - 1; i >= 0; i--) {
                    const currentLoop = loopStack[i];
                    
                    if (currentLoop.type === 'for') {
                        currentLoop.iterations++;
                        currentLoop.currentIndex++;
                        
                        // Prevent infinite loops
                        if (currentLoop.iterations > maxIterations) {
                            addErrorMessage('❌ تم إيقاف الحلقة: تجاوزت الحد الأقصى للتكرارات (1000)');
                            loopStack.splice(i, 1);
                            return;
                        }
                        
                        // Check if there are more items to iterate
                        if (currentLoop.currentIndex < currentLoop.iterable.length) {
                            // Set loop variable to next item
                            variables[currentLoop.loopVar] = currentLoop.iterable[currentLoop.currentIndex];
                            addVariableBox(currentLoop.loopVar, currentLoop.iterable[currentLoop.currentIndex]);
                            
                            // Continue the loop - go back to the line after for
                            currentLineIndex = currentLoop.startLine + 1;
                            setTimeout(() => executeNext(), 50);
                            return;
                        } else {
                            // Exit the loop
                            loopStack.splice(i, 1);
                            skipUntilIndent = i > 0 ? loopStack[i-1].indent : -1;
                        }
                        
                        foundLoop = true;
                        break;
                    }
                    
                    else if (currentLoop.type === 'while') {
                        currentLoop.iterations++;
                        
                        // Prevent infinite loops
                        if (currentLoop.iterations > maxIterations) {
                            addErrorMessage('❌ تم إيقاف الحلقة: تجاوزت الحد الأقصى للتكرارات (1000)');
                            loopStack.splice(i, 1);
                            return;
                        }
                        
                        const conditionResult = evaluateCondition(currentLoop.condition);
                        
                        if (conditionResult) {
                            // Continue the loop - go back to the line after while
                            currentLineIndex = currentLoop.startLine + 1;
                            setTimeout(() => executeNext(), 50);
                            return;
                        } else {
                            // Exit the loop
                            loopStack.splice(i, 1);
                            skipUntilIndent = i > 0 ? loopStack[i-1].indent : -1;
                        }
                        
                        foundLoop = true;
                        break;
                    }
                }
                
                if (!foundLoop) {
                    addErrorMessage('❌ continue خارج حلقة');
                }
            }
            
            // If line doesn't match any pattern, show error
            else {
                addErrorMessage(`⚠️ خطأ في السطر: ${line}`);
            }
        }
        
        currentLineIndex++;
        // Continue with next line
        setTimeout(() => executeNext(), 50);
        
    } catch (err) {
        addErrorMessage('❌ خطأ في الكود');
        console.error(err);
    }
}

function evaluateIterable(iterable) {
    iterable = iterable.trim();
    
    // Handle range() function
    const rangeMatch = iterable.match(/^range\s*\(\s*(.+)\s*\)$/);
    if (rangeMatch) {
        const args = parseArguments(rangeMatch[1]);
        
        if (args.length === 1) {
            // range(stop)
            const stop = evaluateExpression(args[0]);
            if (typeof stop !== 'number' || !Number.isInteger(stop)) {
                throw new Error('range() argument must be an integer');
            }
            return Array.from({length: Math.max(0, stop)}, (_, i) => i);
        }
        
        else if (args.length === 2) {
            // range(start, stop)
            const start = evaluateExpression(args[0]);
            const stop = evaluateExpression(args[1]);
            if (typeof start !== 'number' || !Number.isInteger(start) ||
                typeof stop !== 'number' || !Number.isInteger(stop)) {
                throw new Error('range() arguments must be integers');
            }
            const length = Math.max(0, stop - start);
            return Array.from({length}, (_, i) => start + i);
        }
        
        else if (args.length === 3) {
            // range(start, stop, step)
            const start = evaluateExpression(args[0]);
            const stop = evaluateExpression(args[1]);
            const step = evaluateExpression(args[2]);
            if (typeof start !== 'number' || !Number.isInteger(start) ||
                typeof stop !== 'number' || !Number.isInteger(stop) ||
                typeof step !== 'number' || !Number.isInteger(step)) {
                throw new Error('range() arguments must be integers');
            }
            if (step === 0) {
                throw new Error('range() step argument must not be zero');
            }
            
            const result = [];
            if (step > 0) {
                for (let i = start; i < stop; i += step) {
                    result.push(i);
                }
            } else {
                for (let i = start; i > stop; i += step) {
                    result.push(i);
                }
            }
            return result;
        }
        
        else {
            throw new Error('range() takes 1 to 3 arguments');
        }
    }
    
    // Handle list literals [1, 2, 3]
    if (iterable.startsWith('[') && iterable.endsWith(']')) {
        const listContent = iterable.slice(1, -1).trim();
        if (listContent === '') {
            return []; // Empty list
        }
        
        const items = parseArguments(listContent);
        return items.map(item => evaluateExpression(item.trim()));
    }
    
    // Handle string literals "hello" or 'hello'
    if ((iterable.startsWith('"') && iterable.endsWith('"')) ||
        (iterable.startsWith("'") && iterable.endsWith("'"))) {
        const stringValue = iterable.slice(1, -1);
        return Array.from(stringValue); // Convert string to array of characters
    }
    
    // Handle variable that contains an iterable
    if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(iterable)) {
        if (variables.hasOwnProperty(iterable)) {
            const value = variables[iterable];
            
            // If it's a string, convert to array of characters
            if (typeof value === 'string') {
                return Array.from(value);
            }
            
            // If it's already an array, return it
            if (Array.isArray(value)) {
                return value;
            }
            
            // If it's a number, treat it like range(number)
            if (typeof value === 'number' && Number.isInteger(value)) {
                return Array.from({length: Math.max(0, value)}, (_, i) => i);
            }
            
            throw new Error(`'${iterable}' object is not iterable`);
        } else {
            throw new Error(`Variable '${iterable}' is not defined`);
        }
    }
    
    // Try to evaluate as expression and then make it iterable
    try {
        const value = evaluateExpression(iterable);
        
        if (typeof value === 'string') {
            return Array.from(value);
        }
        
        if (Array.isArray(value)) {
            return value;
        }
        
        if (typeof value === 'number' && Number.isInteger(value)) {
            return Array.from({length: Math.max(0, value)}, (_, i) => i);
        }
        
        throw new Error(`'${typeof value}' object is not iterable`);
    } catch (e) {
        throw new Error(`Cannot evaluate iterable: ${iterable}`);
    }
}

function addInputPrompt(prompt, varName, conversionType) {
    const output = document.getElementById("output");
    
    // Add prompt message
    // Create parent container
const lineContainer = document.createElement('div');
lineContainer.className = 'line-container'; // ممكن تتحكمي فيها بالـ CSS

// Create prompt
const promptDiv = document.createElement('div');
promptDiv.className = 'input-prompt';
promptDiv.textContent = prompt;

// Create input container
const inputContainer = document.createElement('div');
inputContainer.className = 'input-container';

const inputField = document.createElement('input');
inputField.type = 'text';
inputField.className = 'user-input';

// Append input field to its container
inputContainer.appendChild(inputField);

// Append prompt and input to the line container
lineContainer.appendChild(promptDiv);
lineContainer.appendChild(inputContainer);

// Finally, append the line container to the output
output.appendChild(lineContainer);

    
    // Set placeholder based on conversion type
    if (conversionType === 'int(') {
        inputField.placeholder = 'أدخل رقم صحيح (مثل: 5, 10, -3)';
    } else if (conversionType === 'float(') {
        inputField.placeholder = 'أدخل رقم عشري (مثل: 3.14, 2.5)';
    } else {
        inputField.placeholder = 'اكتب إجابتك هنا...';
    }
    
    const submitBtn = document.createElement('button');
    submitBtn.className = 'submit-input';
    submitBtn.textContent = 'إرسال';
    
    inputContainer.appendChild(inputField);
    inputContainer.appendChild(submitBtn);
    output.appendChild(lineContainer);
    
    // Focus on input
    inputField.focus();
    
    // Handle submit
    const handleSubmit = () => {
        const userValue = inputField.value.trim();
        if (userValue) {
            let finalValue = userValue;
            let hasError = false;
            
                    // Apply conversion based on type
            if (conversionType === 'int(') {
                const intValue = parseInt(userValue);
                if (isNaN(intValue)) {
                    addErrorMessage(`❌ خطأ: "${userValue}" ليس رقماً صحيحاً! يجب كتابة رقم صحيح مثل 5 أو -10`);
                    inputField.value = '';
                    inputField.focus();
                    hasError = true;
                } else {
                    finalValue = intValue;
                }
            } else if (conversionType === 'float(') {
                const floatValue = parseFloat(userValue);
                if (isNaN(floatValue)) {
                    addErrorMessage(`❌ خطأ: "${userValue}" ليس رقماً! يجب كتابة رقم مثل 3.14 أو 5`);
                    inputField.value = '';
                    inputField.focus();
                    hasError = true;
                } else {
                    finalValue = floatValue;
                }
            } else {
                // Handle boolean input
                if (userValue.toLowerCase() === 'true') {
                    finalValue = true;
                } else if (userValue.toLowerCase() === 'false') {
                    finalValue = false;
                }
                // Otherwise keep as string (default input behavior)
            }
            
            if (!hasError) {
                // Store the input value in variable
                variables[varName] = finalValue;
                
                // Add variable to memory with type indication
                addVariableBox(varName, finalValue, conversionType);
                
                // Remove input container
                inputContainer.remove();
                
                // Show what user typed
                const userResponse = document.createElement('div');
                userResponse.className = 'output-text';
                userResponse.textContent = userValue;
                userResponse.style.alignSelf = 'flex-end';
               lineContainer.append(userResponse);
                output.appendChild(lineContainer);
                
                // Continue execution
                setTimeout(() => executeNext(), 100);
            }
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

function parseArguments(content) {
    const args = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = '';
    let parenthesesCount = 0;
    
    for (let i = 0; i < content.length; i++) {
        const char = content[i];
        
        if ((char === '"' || char === "'") && !inQuotes) {
            inQuotes = true;
            quoteChar = char;
            current += char;
        } else if (char === quoteChar && inQuotes && content[i-1] !== '\\') {
            inQuotes = false;
            current += char;
        } else if (char === '(' && !inQuotes) {
            parenthesesCount++;
            current += char;
        } else if (char === ')' && !inQuotes) {
            parenthesesCount--;
            current += char;
        } else if (char === ',' && !inQuotes && parenthesesCount === 0) {
            args.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    
    args.push(current.trim());
    return args;
}

function evaluateExpression(expr) {
    if (!expr || typeof expr !== 'string') {
        return expr;
    }
    
    expr = expr.trim();
    
    // Handle string literals with quotes
    if ((expr.startsWith('"') && expr.endsWith('"')) || 
        (expr.startsWith("'") && expr.endsWith("'"))) {
        return processStringLiteral(expr.slice(1, -1));
    }
    
    // Handle int() conversion
    const intMatch = expr.match(/^int\s*\(\s*(.+)\s*\)$/);
    if (intMatch) {
        const innerExpr = evaluateExpression(intMatch[1]);
        const result = parseInt(innerExpr);
        if (isNaN(result)) {
            throw new Error(`Cannot convert "${innerExpr}" to integer`);
        }
        return result;
    }
    
    // Handle float() conversion
    const floatMatch = expr.match(/^float\s*\(\s*(.+)\s*\)$/);
    if (floatMatch) {
        const innerExpr = evaluateExpression(floatMatch[1]);
        const result = parseFloat(innerExpr);
        if (isNaN(result)) {
            throw new Error(`Cannot convert "${innerExpr}" to float`);
        }
        return result;
    }
    
    // Handle str() conversion
    const strMatch = expr.match(/^str\s*\(\s*(.+)\s*\)$/);
    if (strMatch) {
        const innerExpr = evaluateExpression(strMatch[1]);
        return String(innerExpr);
    }
    
    // Handle boolean literals
    if (expr === 'True') {
        return true;
    }
    if (expr === 'False') {
        return false;
    }
    
    // Handle simple variable reference
    if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(expr)) {
        if (variables.hasOwnProperty(expr)) {
            return variables[expr];
        } else {
            throw new Error(`Variable '${expr}' is not defined`);
        }
    }
    
    // Handle numeric literals
    if (/^-?\d+\.?\d*$/.test(expr)) {
        return expr.includes('.') ? parseFloat(expr) : parseInt(expr);
    }
    
    // Handle complex expressions
    return evaluateComplexExpression(expr);
}

function processStringLiteral(str) {
    // Process escape characters
    return str
        .replace(/\\n/g, '\n')
        .replace(/\\t/g, '\t')
        .replace(/\\r/g, '\r')
        .replace(/\\'/g, "'")
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, '\\');
}

function evaluateComplexExpression(expr) {
    // Replace variables with their values
    let processedExpr = expr.replace(/\b(?!True\b|False\b)[a-zA-Z_][a-zA-Z0-9_]*\b/g, (match) => {
        if (variables.hasOwnProperty(match)) {
            const value = variables[match];
            if (typeof value === 'string') {
                return `"${value.replace(/"/g, '\\"')}"`;
            }
            if (typeof value === 'boolean') {
                return value ? 'true' : 'false';
            }
            return value;
        }
        return match;
    });
    
    // Replace Python boolean literals with JavaScript equivalents
    processedExpr = processedExpr.replace(/\bTrue\b/g, 'true').replace(/\bFalse\b/g, 'false');
    
    // Handle string operations
    if (processedExpr.includes('"') || processedExpr.includes("'")) {
        return evaluateStringExpression(processedExpr);
    }
    
    // Handle numeric expressions with modulus operator and boolean operations
    if (/^[\d\s+\-*/%().]+$/.test(processedExpr) || /^(true|false|\d|\s|[+\-*/%()&|!<>=])+$/i.test(processedExpr)) {
        try {
            // Replace % with a custom modulus function to handle edge cases
            processedExpr = processedExpr.replace(/(\d+(?:\.\d+)?)\s*%\s*(\d+(?:\.\d+)?)/g, (match, a, b) => {
                const numA = parseFloat(a);
                const numB = parseFloat(b);
                if (numB === 0) {
                    throw new Error('Division by zero in modulus operation');
                }
                return numA % numB;
            });
            
            return eval(processedExpr);
        } catch (e) {
            throw new Error(`Invalid expression: ${expr}`);
        }
    }
    
    // If nothing else works, return the original expression
    return expr;
}

function getIndentLevel(line) {
    let indent = 0;
    for (let i = 0; i < line.length; i++) {
        if (line[i] === ' ') {
            indent++;
        } else if (line[i] === '\t') {
            indent += 4; // Treat tab as 4 spaces
        } else {
            break;
        }
    }
    return indent;
}

function evaluateCondition(condition) {
    try {
        condition = condition.trim();
        
        // Handle parentheses first
        if (condition.startsWith('(') && condition.endsWith(')')) {
            return evaluateCondition(condition.slice(1, -1));
        }
        
        // Handle logical operators (and, or)
        if (condition.includes(' and ')) {
            const parts = splitLogicalExpression(condition, ' and ');
            return parts.every(part => evaluateCondition(part.trim()));
        }
        
        if (condition.includes(' or ')) {
            const parts = splitLogicalExpression(condition, ' or ');
            return parts.some(part => evaluateCondition(part.trim()));
        }
        
        // Handle not operator
        if (condition.startsWith('not ')) {
            return !evaluateCondition(condition.slice(4).trim());
        }
        
        // Handle comparison operators in order of precedence
        const comparisons = [
            { op: '==', fn: (a, b) => a == b },
            { op: '!=', fn: (a, b) => a != b },
            { op: '<=', fn: (a, b) => a <= b },
            { op: '>=', fn: (a, b) => a >= b },
            { op: '<', fn: (a, b) => a < b },
            { op: '>', fn: (a, b) => a > b }
        ];
        
        for (const comp of comparisons) {
            const opIndex = condition.indexOf(comp.op);
            if (opIndex !== -1) {
                const left = condition.substring(0, opIndex).trim();
                const right = condition.substring(opIndex + comp.op.length).trim();
                
                if (left && right) {
                    const leftValue = evaluateExpression(left);
                    const rightValue = evaluateExpression(right);
                    
                    console.log(`Comparing: ${leftValue} ${comp.op} ${rightValue}`);
                    
                    // Convert values for comparison
                    let leftComp = leftValue;
                    let rightComp = rightValue;
                    
                    // If both are strings that look like numbers, convert them
                    if (typeof leftValue === 'string' && typeof rightValue === 'string' &&
                        !isNaN(leftValue) && !isNaN(rightValue)) {
                        leftComp = parseFloat(leftValue);
                        rightComp = parseFloat(rightValue);
                    }
                    // If one is number and other is string number, convert both
                    else if ((typeof leftValue === 'number' && typeof rightValue === 'string' && !isNaN(rightValue)) ||
                             (typeof rightValue === 'number' && typeof leftValue === 'string' && !isNaN(leftValue))) {
                        leftComp = parseFloat(leftValue);
                        rightComp = parseFloat(rightValue);
                    }
                    
                    const result = comp.fn(leftComp, rightComp);
                    console.log(`Result: ${result}`);
                    return result;
                }
            }
        }
        
        // Handle boolean values and expressions that evaluate to boolean
        let result = evaluateExpression(condition);
        
        // Convert boolean literals
        if (result === 'True') result = true;
        if (result === 'False') result = false;
        
        // Python-like truthiness
        if (result === false || result === 0 || result === '' || result === null || result === undefined) {
            return false;
        }
        return true;
        
    } catch (e) {
        console.error('Error evaluating condition:', condition, e);
        addErrorMessage(`❌ خطأ في تقييم الشرط: ${condition}`);
        return false;
    }
}

function splitLogicalExpression(expr, operator) {
    // Split logical expressions while respecting parentheses
    const parts = [];
    let current = '';
    let parenthesesCount = 0;
    let i = 0;
    
    while (i < expr.length) {
        if (expr[i] === '(') {
            parenthesesCount++;
            current += expr[i];
        } else if (expr[i] === ')') {
            parenthesesCount--;
            current += expr[i];
        } else if (parenthesesCount === 0 && expr.substring(i, i + operator.length) === operator) {
            parts.push(current.trim());
            current = '';
            i += operator.length - 1;
        } else {
            current += expr[i];
        }
        i++;
    }
    
    parts.push(current.trim());
    return parts.filter(part => part.length > 0);
}

function evaluateStringExpression(expr) {
    // Handle string concatenation and multiplication
    try {
        // Simple string concatenation with +
        if (expr.includes('+')) {
            const parts = expr.split('+').map(part => {
                part = part.trim();
                if ((part.startsWith('"') && part.endsWith('"')) || 
                    (part.startsWith("'") && part.endsWith("'"))) {
                    return part.slice(1, -1);
                }
                if (!isNaN(part)) {
                    return part;
                }
                if (variables.hasOwnProperty(part)) {
                    return String(variables[part]);
                }
                return part;
            });
            return parts.join('');
        }
        
        // String multiplication (e.g., "hello" * 3)
        const multiplyMatch = expr.match(/^(.+?)\s*\*\s*(\d+)$|^(\d+)\s*\*\s*(.+?)$/);
        if (multiplyMatch) {
            let stringPart, numberPart;
            if (multiplyMatch[1] && multiplyMatch[2]) {
                stringPart = multiplyMatch[1].trim();
                numberPart = parseInt(multiplyMatch[2]);
            } else {
                numberPart = parseInt(multiplyMatch[3]);
                stringPart = multiplyMatch[4].trim();
            }
            
            // Evaluate the string part
            let stringValue;
            if ((stringPart.startsWith('"') && stringPart.endsWith('"')) || 
                (stringPart.startsWith("'") && stringPart.endsWith("'"))) {
                stringValue = stringPart.slice(1, -1);
            } else if (variables.hasOwnProperty(stringPart)) {
                stringValue = String(variables[stringPart]);
            } else {
                stringValue = stringPart;
            }
            
            return stringValue.repeat(numberPart);
        }
        
        // If it's a simple quoted string, return it
        if ((expr.startsWith('"') && expr.endsWith('"')) || 
            (expr.startsWith("'") && expr.endsWith("'"))) {
            return expr.slice(1, -1);
        }
        
        return expr;
    } catch (e) {
        throw new Error(`Invalid string expression: ${expr}`);
    }
}

function addVariableBox(name, value, conversionType) {
    const memoryContainer = document.getElementById("memoryContainer");
    
    // Check if variable already exists and update it
    const existingBox = memoryContainer.querySelector(`[data-var="${name}"]`);
    if (existingBox) {
        const valueElement = existingBox.querySelector('.variable-value');
        const typeElement = existingBox.querySelector('.variable-type');
        valueElement.textContent = value;
        
        // Update type indicator
        let typeIndicator = '';
        if (conversionType === 'int(' || (typeof value === 'number' && Number.isInteger(value))) {
            typeIndicator = '🔢 integer';
        } else if (conversionType === 'float(' || (typeof value === 'number' && !Number.isInteger(value))) {
            typeIndicator = '🔢 float';
        } else if (typeof value === 'string') {
            typeIndicator = '📝 string';
        } else if (typeof value === 'boolean') {
            typeIndicator = '✅ boolean';
        } else {
            typeIndicator = '🔍 unknown';
        }
        
        typeElement.textContent = typeIndicator;
        
        existingBox.style.animation = 'none';
        setTimeout(() => {
            existingBox.style.animation = 'slideIn 0.3s ease-out';
        }, 10);
        return;
    }
    
    const varBox = document.createElement('div');
    varBox.className = 'variable-box';
    varBox.setAttribute('data-var', name);
    
    // Determine type indicator
    let typeIndicator = '';
    if (conversionType === 'int(' || (typeof value === 'number' && Number.isInteger(value))) {
        typeIndicator = '<div class="variable-type">🔢 integer</div>';
    } else if (conversionType === 'float(' || (typeof value === 'number' && !Number.isInteger(value))) {
        typeIndicator = '<div class="variable-type">🔢 float</div>';
    } else if (typeof value === 'string') {
        typeIndicator = '<div class="variable-type">📝 string</div>';
    } else if (typeof value === 'boolean') {
        typeIndicator = '<div class="variable-type">✅ boolean</div>';
    } else {
        typeIndicator = '<div class="variable-type">🔍 unknown</div>';
    }
    
    varBox.innerHTML = `
        <div class="variable-name">
            📦 ${name}
        </div>
        ${typeIndicator}
        <div class="variable-value">
            ${value}
        </div>
    `;
    
    memoryContainer.appendChild(varBox);
    memoryContainer.scrollTop = memoryContainer.scrollHeight;
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

// Allow Enter key to run code (Ctrl+Enter)
document.getElementById("codeEditor").addEventListener("keydown", function(event) {
    if (event.ctrlKey && event.key === "Enter") {
        event.preventDefault();
        runCode();
    }
});

// Auto-resize textarea
const textarea = document.getElementById("codeEditor");
textarea.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = this.scrollHeight + 'px';
});