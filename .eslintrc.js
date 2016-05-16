module.exports = {
  plugins: ['react'],
  extends: ['pureprofile', 'plugin:react/recommended'],
  globals: {
    $: false
  },
  rules: {
    'prefer-reflect': 0,
    'react/prop-types': 0
  }
};
