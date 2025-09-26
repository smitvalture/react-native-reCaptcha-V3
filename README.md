# React Native reCAPTCHA v3

[![npm version](https://badge.fury.io/js/%40valture%2Freact-native-recaptcha-v3.svg)](https://badge.fury.io/js/%40valture%2Freact-native-recaptcha-v3)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![npm downloads](https://img.shields.io/npm/dm/%40valture%2Freact-native-recaptcha-v3)](https://www.npmjs.com/package/@valture/react-native-recaptcha-v3)

A lightweight React Native component for seamless integration of Google reCAPTCHA v3, providing robust bot protection for mobile applications with minimal setup.

> **v2.0.1** - Now with comprehensive UI features, enhanced error handling, performance optimizations, debug mode, utility functions, and badge control while maintaining full backward compatibility!

## ✨ Features

- **Invisible Integration**: Embeds Google reCAPTCHA v3 without user interaction
- **TypeScript Support**: Fully typed for better developer experience
- **UI Features**: Loading states, error display, and status indicators
- **Performance Optimized**: Token caching, retry logic, and timeout handling
- **Badge Control**: Complete control over reCAPTCHA badge visibility and positioning
- **Debug Mode**: Comprehensive logging for development and troubleshooting


## 📦 Installation

```bash
# Install the package
npm install @valture/react-native-recaptcha-v3

# Ensure react-native-webview is installed
npm install react-native-webview
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

### Basic Usage

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

### Enhanced Usage

```typescript
import React, { useRef } from 'react';
import { Button, View, Alert } from 'react-native';
import ReCaptcha, { GoogleRecaptchaRefAttributes } from '@valture/react-native-recaptcha-v3';

const SITE_KEY = 'your_site_key_here';
const BASE_URL = 'https://api.mydomain.com';

const EnhancedApp = () => {
  const recaptchaRef = useRef<GoogleRecaptchaRefAttributes>(null);

  const handleVerify = (token: string) => {
    console.log('reCAPTCHA Token:', token);
    Alert.alert('Verification Success', `Token: ${token}`);
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
      }
    } catch (error) {
      Alert.alert('Token Request Error', String(error));
    }
  };

  return (
    <View>
      <ReCaptcha
        ref={recaptchaRef}
        siteKey={SITE_KEY}
        baseUrl={BASE_URL}
        onVerify={handleVerify}
        onError={handleError}
        showLoadingIndicator={true}
        showErrorDisplay={true}
        showStatusIndicator={true}
        hideBadge={false}
      />
      <Button title="Verify" onPress={handleSubmit} />
    </View>
  );
};

export default EnhancedApp;
```

### Using the Custom Hook

```typescript
import React from 'react';
import { Button, View, Alert } from 'react-native';
import { useReCaptcha } from '@valture/react-native-recaptcha-v3';

const HookExample = () => {
  const { recaptchaRef, getToken, clearError, getCurrentError } = useReCaptcha();

  const handleSubmit = async () => {
    try {
      const token = await getToken('login');
      if (token) {
        Alert.alert('Success', `Token: ${token}`);
      }
    } catch (error) {
      const currentError = getCurrentError();
      Alert.alert('Error', currentError?.message || String(error));
    }
  };

  return (
    <View>
      <Button title="Get Token" onPress={handleSubmit} />
      <Button title="Clear Errors" onPress={clearError} />
    </View>
  );
};
```


## ⚙️ API Reference

### Props

| Prop                 | Type                                | Required | Default    | Description                                                                 |
|----------------------|-------------------------------------|----------|------------|-----------------------------------------------------------------------------|
| `siteKey`            | `string`                            | Yes      |            | Google reCAPTCHA v3 Site Key.                                               |
| `baseUrl`            | `string`                            | Yes      |            | Registered domain for reCAPTCHA (e.g., `https://api.mydomain.com`).         |
| `action`             | `string`                            | No       | `'submit'` | Default action name for reCAPTCHA requests.                                 |
| `onVerify`           | `(token: string) => void`           | No       |            | Callback triggered on successful token generation.                          |
| `onError`            | `(error: string) => void`           | No       |            | Callback triggered on reCAPTCHA errors.                                     |
| `style`              | `ViewStyle`                         | No       |            | Styles for the underlying `WebView`.                                        |
| `containerStyle`     | `ViewStyle`                         | No       |            | Styles for the container wrapping the `WebView`.                            |
| `debug`              | `boolean`                           | No       | `false`    | Enable debug logging for development.                                       |
| `timeout`            | `number`                            | No       | `30000`    | Token generation timeout in milliseconds.                                   |
| `retryAttempts`      | `number`                            | No       | `3`        | Number of retry attempts on failure.                                        |
| `onLoad`             | `() => void`                        | No       |            | Callback triggered when reCAPTCHA is ready.                                 |
| `onTokenGenerated`   | `(token: string) => void`           | No       |            | Callback triggered when a new token is generated.                           |
| `autoExecute`        | `boolean`                           | No       | `false`    | Automatically generate tokens on component mount.                            |
| `executeInterval`    | `number`                            | No       |            | Auto-refresh interval in milliseconds (requires `autoExecute`).             |
| `showLoadingIndicator` | `boolean`                          | No       | `false`    | Show loading indicator during token generation.                             |
| `loadingText`        | `string`                            | No       | `'Verifying security...'` | Text to display in loading indicator.                    |
| `showErrorDisplay`   | `boolean`                           | No       | `false`    | Show error messages in UI.                                                 |
| `errorPosition`      | `'top' \| 'bottom' \| 'inline'`     | No       | `'bottom'` | Position of error messages.                                                |
| `dismissibleErrors`  | `boolean`                           | No       | `true`     | Allow users to dismiss error messages.                                     |
| `showStatusIndicator` | `boolean`                          | No       | `false`    | Show status indicator (ready, loading, error, success).                     |
| `statusPosition`     | `'top-right' \| 'top-left' \| 'bottom-right' \| 'bottom-left'` | No | `'top-right'` | Position of status indicator. |
| `animations`         | `object`                            | No       | `{...}`    | Animation configuration object.                                            |
| `animations.fadeIn`  | `boolean`                           | No       | `true`     | Enable fade-in animation.                                                  |
| `animations.pulse`   | `boolean`                           | No       | `true`     | Enable pulse animation during loading.                                     |
| `animationDuration`  | `number`                            | No       | `300`      | Duration of animations in milliseconds.                                    |
| `hideBadge`          | `boolean`                           | No       | `false`    | Hide the reCAPTCHA badge completely.                                       |
| `badgePosition`      | `'bottom-right' \| 'bottom-left' \| 'inline'` | No | `'bottom-right'` | Position of the reCAPTCHA badge. |
| `badgeTheme`         | `'light' \| 'dark'`                 | No       | `'light'`  | Theme of the reCAPTCHA badge.                                              |

### Methods

| Method       | Signature                               | Description                                                       |
|--------------|-----------------------------------------|-------------------------------------------------------------------|
| `getToken`   | `(action?: string) => Promise<string>` | Retrieves a reCAPTCHA token, optionally with a custom action name. |
| `isReady`    | `() => boolean`                         | Returns whether reCAPTCHA is ready to generate tokens.            |
| `getError`   | `() => ReCaptchaError \| null`          | Returns the current error state, if any.                          |
| `clearError` | `() => void`                            | Clears the current error state.                                   |

### Types

```typescript
interface ReCaptchaError {
  code: 'NETWORK_ERROR' | 'TIMEOUT' | 'INVALID_SITE_KEY' | 'WEBVIEW_ERROR' | 'VALIDATION_ERROR' | 'BROWSER_ERROR';
  message: string;
  details?: any;
}

interface GoogleRecaptchaRefAttributes {
  getToken: (action?: string) => Promise<string | null>;
  isReady: () => boolean;
  getError: () => ReCaptchaError | null;
  clearError: () => void;
}
```

### Utility Functions

- `validateSiteKey(siteKey: string)` - Validates site key format
- `validateBaseUrl(baseUrl: string)` - Validates base URL format  
- `getErrorMessage(error: any)` - Returns human-readable error messages

### Custom Hook

```typescript
const useReCaptcha = () => {
  return {
    recaptchaRef: RefObject<GoogleRecaptchaRefAttributes>;
    getToken: (action?: string) => Promise<string | null>;
    clearError: () => void;
    getCurrentError: () => ReCaptchaError | null;
  };
};
```

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

- **Invalid Site Key**: Verify your `siteKey` matches the one in the Google reCAPTCHA Admin Console
- **Domain Mismatch**: Ensure `baseUrl` exactly matches a registered domain (including `https://`)
- **WebView Issues**: Confirm `react-native-webview` is properly installed
- **Network Errors**: Ensure the device has internet access
- **Backend Verification**: Tokens must be verified on your backend using the **Secret Key**

Enable debug mode for detailed logging:

```typescript
<ReCaptcha debug={true} />
```

## 🔄 Migration

The v2.x release is **fully backward compatible**. Your existing code will continue to work without any changes. New features are optional and can be added gradually.

## 🤝 Contributing

We welcome contributions! Please review our [Contributing Guide](https://github.com/smitvalture/react-native-recaptcha-v3/blob/main/CONTRIBUTING.md) for details on submitting pull requests, coding standards, and the development workflow.

To report bugs or request features, open an [issue](https://github.com/smitvalture/react-native-recaptcha-v3/issues).

## 📜 License

This project is licensed under the MIT License. See the [LICENSE](https://github.com/smitvalture/react-native-recaptcha-v3/blob/main/LICENSE) file for details.