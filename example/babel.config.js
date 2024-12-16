module.exports = {
    presets: ['module:metro-react-native-babel-preset'],
    plugins: [
        [
            'module-resolver',
            {
                alias: {
                    '@valture/react-native-recaptcha-v3': '../src/index'
                }
            }
        ]
    ]
};
