module.exports = (api) => {
  const isTest = api.env('test');
  api.cache.using(() => (isTest ? 'test' : 'build'));

  if (isTest) {
    // Tests run through jest; use the standard RN babel preset so Flow types
    // in node_modules/react-native are stripped and TS/JSX is handled.
    return {
      presets: ['@react-native/babel-preset'],
    };
  }

  return {
    presets: [
      [
        'module:react-native-builder-bob/babel-preset',
        {
          modules: 'commonjs',
          useESModules: false,
        },
      ],
    ],
    sourceMaps: false,
    plugins: [
      [
        '@babel/plugin-transform-modules-commonjs',
        {
          strict: false,
          strictMode: false,
        },
      ],
      [
        '@babel/plugin-transform-react-jsx',
        {
          runtime: 'classic',
        },
      ],
    ],
  };
};
