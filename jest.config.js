module.exports = {
    preset: 'react-native',
    modulePathIgnorePatterns: [
        '<rootDir>/example/node_modules',
        '<rootDir>/lib/',
    ],
    setupFilesAfterEnv: ['@testing-library/jest-native/extend-expect'],
    transformIgnorePatterns: [
        'node_modules/(?!(react-native|@react-native|react-native-webview)/)',
    ],
};