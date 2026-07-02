function formatBraceBasedCode(code) {
    const lines = code.replace(/\r\n/g, "\n").split("\n");
    let indentLevel = 0;

    const formatted = lines.map((line) => {
        const trimmed = line.trim();

        if (!trimmed) {
            return "";
        }

        if (trimmed.startsWith("}")) {
            indentLevel = Math.max(indentLevel - 1, 0);
        }

        const formattedLine = `${"  ".repeat(indentLevel)}${trimmed}`;

        const openBraces = (trimmed.match(/\{/g) || []).length;
        const closeBraces = (trimmed.match(/\}/g) || []).length;
        indentLevel = Math.max(indentLevel + openBraces - closeBraces, 0);

        return formattedLine;
    });

    return `${formatted.join("\n").trimEnd()}\n`;
}

function formatPythonCode(code) {
    const lines = code.replace(/\r\n/g, "\n").split("\n");

    return `${lines
        .map((line) => line.replace(/\s+$/g, ""))
        .join("\n")
        .replace(/\n{3,}/g, "\n\n")
        .trimEnd()}\n`;
}

export function formatCode(language, code) {
    if (!code.trim()) {
        return code;
    }

    if (language === "cpp" || language === "javascript") {
        return formatBraceBasedCode(code);
    }

    if (language === "python") {
        return formatPythonCode(code);
    }

    return code;
}
