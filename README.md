# React Native reCAPTCHA v3

[![npm version](https://badge.fury.io/js/%40valture%2Freact-native-recaptcha-v3.svg)](https://badge.fury.io/js/%40valture%2Freact-native-recaptcha-v3)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![npm downloads](https://img.shields.io/npm/dm/%40valture%2Freact-native-recaptcha-v3)](https://www.npmjs.com/package/@valture/react-native-recaptcha-v3)

A lightweight React Native component for seamless integration of Google reCAPTCHA v3, providing robust bot protection for mobile applications with minimal setup.

## ✨ Features

- **Invisible Integration**: Embeds Google reCAPTCHA v3 without user interaction.
- **Simple API**: Offers hook and ref-based methods for token retrieval.
- **Custom Actions**: Supports custom action names for fine-grained security policies.
- **WebView-Based**: Leverages `react-native-webview` for reliable reCAPTCHA rendering.
- **TypeScript Support**: Fully typed for better developer experience.

## 📦 Installation

### Prerequisites

Ensure `react-native-webview` is installed in your project:

```bash
# Using Yarn
yarn add react-native-webview

# Using npm
npm install react-native-webview
```

### Install the Package

```bash
# Using Yarn
yarn add @valture/react-native-recaptcha-v3

# Using npm
npm install @valture/react-native-recaptcha-v3
```

## 🔑 Obtaining reCAPTCHA Keys

To use this component, you need a **Site Key** and a registered **domain (`baseUrl`)** from Google reCAPTCHA.

1. **Visit the Google reCAPTCHA Admin Console**: Go to [https://www.google.com/recaptcha/admin/create](https://www.google.com/recaptcha/admin/create).
2. **Sign In**: Use your Google account to log in.
3. **Register a New Site**:
   - **Label**: Name your site (e.g., "My React Native App").
   - **reCAPTCHA Type**: Choose **reCAPTCHA v3** for background verification.
   - **Domains**: Enter the domain associated with your backend server (e.g., `api.mydomain.com`). This must match the `baseUrl` prop in the component. **Note**: Avoid using `localhost` unless explicitly configured for testing.
   - **Owner**: Confirm your email address.
   - **Accept Terms**: Agree to the reCAPTCHA Terms of Service.
   - **Submit**: Click "Submit" to register.
4. **Retrieve Keys**:
   - **Site Key**: Use this in the `siteKey` prop.
   - **Secret Key**: Securely store this for backend token verification. **Do not** include it in your app.

## 🚀 Usage

Below is an example of using the `ReCaptcha` component in a React Native app:

```typescript
import React, { useRef } from 'react';
import { Button, View, StyleSheet, Alert } from 'react-native';
import ReCaptcha, { GoogleRecaptchaRefAttributes } from '@valture/react-native-recaptcha-v3';

// Replace with your Site Key and Base URL from Google reCAPTCHA Admin
const SITE_KEY = 'your_site_key_here';
const BASE_URL = 'https://api.mydomain.com'; // Must match registered domain

const App = () => {
  const recaptchaRef = useRef<GoogleRecaptchaRefAttributes>(null);

  const handleVerify = (token: string) => {
    console.log('reCAPTCHA Token:', token);
    Alert.alert('Verification Success', `Token: ${token}`);
    // Send token to your backend for verification
  };

  const handleError = (error: string) => {
    console.error('reCAPTCHA Error:', error);
    Alert.alert('Verification Error', error);
  };

  const handleSubmit = async () => {
    try {
      const token = await recaptchaRef.current?.getToken('login');
      if (token) {
        handleVerify(token);
      } else {
        Alert.alert('Token Request Failed', 'No token received.');
      }
    } catch (error) {
      Alert.alert('Token Request Error', String(error));
    }
  };

  return (
    <View style={styles.container}>
      <ReCaptcha
        ref={recaptchaRef}
        siteKey={SITE_KEY}
        baseUrl={BASE_URL}
        action="homepage"
        onVerify={handleVerify}
        onError={handleError}
        containerStyle={styles.recaptchaContainer}
      />
      <Button title="Verify (e.g., Login)" onPress={handleSubmit} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  recaptchaContainer: {
    position: 'absolute',
    width: 0,
    height: 0,
    opacity: 0,
    zIndex: -1,
  },
});

export default App;
```

## ⚙️ API Reference

### Props

| Prop             | Type                                | Required | Default    | Description                                                                 |
|------------------|-------------------------------------|----------|------------|-----------------------------------------------------------------------------|
| `siteKey`        | `string`                            | Yes      |            | Google reCAPTCHA v3 Site Key.                                               |
| `baseUrl`        | `string`                            | Yes      |            | Registered domain for reCAPTCHA (e.g., `https://api.mydomain.com`).         |
| `action`         | `string`                            | No       | `'submit'` | Default action name for reCAPTCHA requests.                                 |
| `onVerify`       | `(token: string) => void`           | No       |            | Callback triggered on successful token generation.                          |
| `onError`        | `(error: string) => void`           | No       |            | Callback triggered on reCAPTCHA errors.                                     |
| `style`          | `ViewStyle`                         | No       |            | Styles for the underlying `WebView`.                                        |
| `containerStyle` | `ViewStyle`                         | No       |            | Styles for the container wrapping the `WebView`.                            |

### Methods

| Method     | Signature                               | Description                                                       |
|------------|-----------------------------------------|-------------------------------------------------------------------|
| `getToken` | `(action?: string) => Promise<string>` | Retrieves a reCAPTCHA token, optionally with a custom action name. |

**Example**:

```typescript
const recaptchaRef = useRef<GoogleRecaptchaRefAttributes>(null);

const handleCustomAction = async () => {
  try {
    const token = await recaptchaRef.current?.getToken('update_profile');
    console.log('Token:', token);
  } catch (error) {
    console.error('Token Error:', error);
  }
};
```

## 🛠 How It Works

The component uses a hidden `react-native-webview` to load an HTML page with the Google reCAPTCHA v3 script. It communicates with the WebView via `postMessage` to request and receive tokens or handle errors, ensuring seamless integration.

## ⚠️ Troubleshooting

- **Invalid Site Key**: Verify your `siteKey` matches the one in the Google reCAPTCHA Admin Console.
- **Domain Mismatch**: Ensure `baseUrl` exactly matches a registered domain (including `https://`). Check for typos or missing schemes.
- **WebView Issues**: Confirm `react-native-webview` is properly installed and linked (if using older React Native versions).
- **Network Errors**: Ensure the device has internet access to connect to Google’s reCAPTCHA services.
- **Backend Verification**: Tokens must be verified on your backend using the **Secret Key**. See [Google’s verification docs](https://developers.google.com/recaptcha/docs/verify).
- **Error: Invalid domain for site key**: Reconfirm the `baseUrl` in your reCAPTCHA Admin Console matches the component’s `baseUrl`.

## 🤝 Contributing

We welcome contributions! Please review our [Contributing Guide](https://github.com/smitvalture/react-native-recaptcha-v3/blob/main/CONTRIBUTING.md) for details on submitting pull requests, coding standards, and the development workflow.

To report bugs or request features, open an [issue](https://github.com/smitvalture/react-native-recaptcha-v3/issues).

## 📜 License

This project is licensed under the MIT License. See the [LICENSE](https://github.com/smitvalture/react-native-recaptcha-v3/blob/main/LICENSE) file for details.