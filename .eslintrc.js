module.exports = {
    "parser": "typescript-eslint-parser",
    "parserOptions": {
        "sourceType": "module"
    },
    "extends": "pureprofile",
    "rules": {
        "indent": ["error", 4, { "SwitchCase": 1 }],
        "max-params": ["error", 6],
        "no-extra-parens": "off",
        "no-undef": "off",
        "no-unused-expressions": "off",
        "no-unused-vars": "off",
        "no-use-before-define": "off",
        "quotes": ["error", "double"],
        "space-infix-ops": "off",
        "sort-imports": "off"
    }
};
