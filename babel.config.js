module.exports = {
  presets: [
    ['module:react-native-builder-bob/babel-preset', { 
      modules: 'commonjs',
      useESModules: false
    }],
  ],
  sourceMaps: false,
  plugins: [
    ['@babel/plugin-transform-modules-commonjs', {
      strict: false,
      strictMode: false
    }],
    ['@babel/plugin-transform-react-jsx', {
      runtime: 'classic'
    }]
  ]
};
