# React Native reCAPTCHA v3

[![npm version](https://badge.fury.io/js/%40valture%2Freact-native-recaptcha-v3.svg)](https://badge.fury.io/js/%40valture%2Freact-native-recaptcha-v3)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![npm downloads](https://img.shields.io/npm/dm/%40valture%2Freact-native-recaptcha-v3)](https://www.npmjs.com/package/@valture/react-native-recaptcha-v3)

A lightweight React Native component for seamless integration of Google reCAPTCHA v3, providing robust bot protection for mobile applications with minimal setup.

## ✨ Features

- **Invisible Integration**: Embeds Google reCAPTCHA v3 without user interaction.
- **Simple API**: Offers ref-based methods for token retrieval with automatic error handling.
- **Auto-Recovery**: Automatically handles reset and retry when reCAPTCHA is not ready.
- **Network Error Detection**: Comprehensive offline/network error detection with immediate feedback.
- **Custom Actions**: Supports custom action names for fine-grained security policies.
- **WebView-Based**: Leverages `react-native-webview` for reliable reCAPTCHA rendering.
- **TypeScript Support**: Fully typed for better developer experience.
- **Debug Mode**: Optional test mode for detailed logging during development.

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
      // getToken automatically handles reset and readiness checks
      const token = await recaptchaRef.current?.getToken('login');
      if (token) {
        handleVerify(token);
      } else {
        Alert.alert('Token Request Failed', 'No token received.');
      }
    } catch (error) {
      // Errors are automatically handled - network errors, timeouts, etc.
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
        testMode={__DEV__} // Enable debug logs in development
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

| Prop                     | Type                                | Required | Default    | Description                                                                 |
|--------------------------|-------------------------------------|----------|------------|-----------------------------------------------------------------------------|
| `siteKey`                | `string`                            | Yes      |            | Google reCAPTCHA v3 Site Key.                                               |
| `baseUrl`                | `string`                            | Yes      |            | Registered domain for reCAPTCHA (e.g., `https://api.mydomain.com`).         |
| `action`                 | `string`                            | No       | `'submit'` | Default action name for reCAPTCHA requests.                                 |
| `onVerify`               | `(token: string) => void`           | No       |            | Callback triggered on successful token generation.                          |
| `onError`                | `(error: string) => void`           | No       |            | Callback triggered on reCAPTCHA errors.                                     |
| `onLoadStart`            | `() => void`                        | No       |            | Callback triggered when WebView starts loading.                             |
| `onLoadEnd`               | `() => void`                        | No       |            | Callback triggered when WebView finishes loading.                           |
| `style`                  | `ViewStyle`                         | No       |            | Styles for the underlying `WebView`.                                        |
| `containerStyle`         | `ViewStyle`                         | No       |            | Styles for the container wrapping the `WebView`.                            |
| `initializationTimeout`  | `number`                            | No       | `30000`     | Timeout in milliseconds for reCAPTCHA initialization (default: 30s).        |
| `tokenRequestTimeout`    | `number`                            | No       | `15000`     | Timeout in milliseconds for token requests (default: 15s).                  |
| `testMode`               | `boolean`                           | No       | `false`     | Enable debug logging for troubleshooting.                                   |

### Methods

| Method     | Signature                                    | Description                                                       |
|------------|----------------------------------------------|-------------------------------------------------------------------|
| `getToken` | `(action?: string) => Promise<string>`      | Retrieves a reCAPTCHA token. Automatically handles reset and readiness checks. Rejects on network errors or timeouts. |
| `isReady`  | `() => boolean`                              | Returns `true` if reCAPTCHA is ready and no errors occurred.    |
| `reset`    | `() => Promise<void>`                       | Resets the component and reloads the WebView. Returns a Promise that resolves when reset is complete. |

**Example**:

```typescript
const recaptchaRef = useRef<GoogleRecaptchaRefAttributes>(null);

// Check if ready
if (recaptchaRef.current?.isReady()) {
  console.log('reCAPTCHA is ready');
}

// Get token with custom action
const handleCustomAction = async () => {
  try {
    // getToken automatically handles reset and readiness
    const token = await recaptchaRef.current?.getToken('update_profile');
    console.log('Token:', token);
  } catch (error) {
    // Handles: network errors, timeouts, initialization failures
    console.error('Token Error:', error);
  }
};

// Manual reset if needed
const handleReset = async () => {
  await recaptchaRef.current?.reset();
  console.log('reCAPTCHA reset complete');
};
```

## 🛠 How It Works

The component uses a hidden `react-native-webview` to load an HTML page with the Google reCAPTCHA v3 script. It communicates with the WebView via `postMessage` to request and receive tokens or handle errors, ensuring seamless integration.

### Auto-Recovery

When `getToken()` is called:
- If reCAPTCHA is not ready, it automatically resets and waits for initialization
- If there's a network error, it immediately rejects with a clear error message
- All pending requests are queued and processed once ready

### Error Handling

The component provides comprehensive error detection:
- **Network Errors**: Detected when offline or when script fails to load
- **Initialization Timeout**: Triggers if reCAPTCHA doesn't initialize within the timeout period
- **Token Request Timeout**: Triggers if token generation takes too long

All errors are automatically handled and rejected through the `getToken()` Promise.

## ⚠️ Troubleshooting

- **Invalid Site Key**: Verify your `siteKey` matches the one in the Google reCAPTCHA Admin Console.
- **Domain Mismatch**: Ensure `baseUrl` exactly matches a registered domain (including `https://`). Check for typos or missing schemes.
- **WebView Issues**: Confirm `react-native-webview` is properly installed and linked (if using older React Native versions).
- **Network Errors**: The component automatically detects offline state. Ensure the device has internet access to connect to Google's reCAPTCHA services.
- **Not Ready Errors**: If `getToken()` fails with "not ready", the component will automatically reset. If issues persist, check network connectivity.
- **Backend Verification**: Tokens must be verified on your backend using the **Secret Key**. See [Google's verification docs](https://developers.google.com/recaptcha/docs/verify).
- **Error: Invalid domain for site key**: Reconfirm the `baseUrl` in your reCAPTCHA Admin Console matches the component's `baseUrl`.
- **Debug Mode**: Enable `testMode={true}` to see detailed logs about initialization, errors, and token requests.

## 🤝 Contributing

We welcome contributions! Please review our [Contributing Guide](https://github.com/smitvalture/react-native-recaptcha-v3/blob/main/CONTRIBUTING.md) for details on submitting pull requests, coding standards, and the development workflow.

To report bugs or request features, open an [issue](https://github.com/smitvalture/react-native-recaptcha-v3/issues).

## 📜 License

This project is licensed under the MIT License. See the [LICENSE](https://github.com/smitvalture/react-native-recaptcha-v3/blob/main/LICENSE) file for details.