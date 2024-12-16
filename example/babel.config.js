module.exports = {
    presets: ['module:metro-react-native-babel-preset'],
    plugins: [
        [
            'module-resolver',
            {
                alias: {
                    'react-native-google-recaptcha-v3': '../src/index'
                }
            }
        ]
    ]
};
