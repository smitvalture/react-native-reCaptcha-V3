# react-native-google-recaptcha-v3

A React Native component that provides easy integration with Google reCAPTCHA v3 for React Native applications.

## Installation

```bash
npm install @valture/react-native-google-recaptcha-v3 react-native-webview
# or
yarn add @valture/react-native-google-recaptcha-v3 react-native-webview
```

## Usage

```typescript
import ReCaptcha, { GoogleRecaptchaRefAttributes } from '@valture/react-native-google-recaptcha-v3';
import { useRef } from 'react';

const YourComponent = () => {
  const recaptchaRef = useRef<GoogleRecaptchaRefAttributes>(null);

  const handleVerify = async () => {
    try {
      const token = await recaptchaRef.current?.getToken('your_action');
      console.log('reCAPTCHA token:', token);
      // Send token to your backend for verification
    } catch (error) {
      console.error('reCAPTCHA error:', error);
    }
  };

  return (
    <ReCaptcha
      ref={recaptchaRef}
      siteKey="your_site_key_here"
      baseUrl="your_domain_here"
      onVerify={(token) => console.log('Verified:', token)}
      onError={(error) => console.error('Error:', error)}
    />
  );
};
```

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| siteKey | string | Yes | Your Google reCAPTCHA v3 site key |
| baseUrl | string | Yes | Your domain URL (must match reCAPTCHA configuration) |
| action | string | No | Custom action name (default: 'submit') |
| onVerify | function | No | Callback function when verification succeeds |
| onError | function | No | Callback function when verification fails |
| style | ViewStyle | No | Custom styles for the WebView |
| containerStyle | ViewStyle | No | Custom styles for the container |

## Methods

### getToken(action?: string)

Get a new reCAPTCHA token. Returns a Promise that resolves with the token string.

```typescript
const token = await recaptchaRef.current?.getToken('custom_action');
```

## Example

```typescript
import React, { useRef } from 'react';
import { Button, View } from 'react-native';
import ReCaptcha, { GoogleRecaptchaRefAttributes } from 'react-native-google-recaptcha-v3';

const App = () => {
  const recaptchaRef = useRef<GoogleRecaptchaRefAttributes>(null);

  const handleSubmit = async () => {
    try {
      const token = await recaptchaRef.current?.getToken('login');
      // Send token to your backend
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <ReCaptcha
        ref={recaptchaRef}
        siteKey="your_site_key_here"
        baseUrl="https://your-domain.com"
        onVerify={token => console.log('Verified:', token)}
        onError={error => console.error('Error:', error)}
      />
      <Button title="Submit" onPress={handleSubmit} />
    </View>
  );
};

export default App;
```

## License

MIT

## Contributing

See the [contributing guide](CONTRIBUTING.md) to learn how to contribute to the repository and the development workflow.