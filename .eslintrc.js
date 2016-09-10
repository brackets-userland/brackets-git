module.exports = {
    "parser": "typescript-eslint-parser",
    "parserOptions": {
        "sourceType": "module"
    },
    "extends": "pureprofile",
    "rules": {
        "indent": ["error", 4],
        "max-params": ["error", 6],
        "no-unused-expressions": "off",
        "no-unused-vars": "off",
        "quotes": ["error", "double"],
        "space-infix-ops": "off",
        "sort-imports": "off"
    }
};
