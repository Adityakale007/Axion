export const LANGUAGE_OPTIONS = {
  cpp: {
    label: "C++",
    /** Shown in <option> next to the language name */
    optionGlyph: "{}",
    judge0Id: 54,
    editorMode: "text/x-c++src",
    starterCode: '#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    cout << "Hello, ForkSpace!";\n    return 0;\n}\n',
  },
  javascript: {
    label: "JavaScript",
    optionGlyph: "JS",
    judge0Id: 63,
    editorMode: "javascript",
    starterCode: 'function main() {\n  console.log("Hello, ForkSpace!");\n}\n\nmain();\n',
  },
  python: {
    label: "Python",
    optionGlyph: "🐍",
    judge0Id: 71,
    editorMode: "python",
    starterCode: 'def main():\n    print("Hello, ForkSpace!")\n\n\nif __name__ == "__main__":\n    main()\n',
  },
};

export const DEFAULT_LANGUAGE = "cpp";
