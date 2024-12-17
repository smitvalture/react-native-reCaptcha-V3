# **react-native-recaptcha-v3**

A React Native component for seamless integration of Google reCAPTCHA v3 into React Native applications.

## **Installation**

### Prerequisites  
This library depends on `react-native-webview`. Ensure it’s already installed in your project. If not, install it along with the package:

```bash
# Install both packages if WebView is not installed
npm install @valture/react-native-recaptcha-v3 react-native-webview
# or
yarn add @valture/react-native-recaptcha-v3 react-native-webview
```

If `react-native-webview` is already installed:  
```bash
npm install @valture/react-native-recaptcha-v3
# or
yarn add @valture/react-native-recaptcha-v3
```

---

## **Usage**

```typescript
import ReCaptcha, { GoogleRecaptchaRefAttributes } from '@valture/react-native-recaptcha-v3';
import React, { useRef } from 'react';

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

---

## **Props**

| **Prop**       | **Type**   | **Required** | **Description**                                      |
|-----------------|------------|--------------|------------------------------------------------------|
| `siteKey`      | `string`   | **Yes**      | Your Google reCAPTCHA v3 site key.                  |
| `baseUrl`      | `string`   | **Yes**      | Your domain URL (must match reCAPTCHA configuration).|
| `action`       | `string`   | No           | Custom action name (default: `'submit'`).           |
| `onVerify`     | `function` | No           | Callback function when verification succeeds.       |
| `onError`      | `function` | No           | Callback function when verification fails.          |
| `style`        | `ViewStyle`| No           | Custom styles for the WebView.                      |
| `containerStyle`| `ViewStyle`| No          | Custom styles for the container.                    |

---

## **Methods**

### **`getToken(action?: string): Promise<string | null>`**

Retrieves a new reCAPTCHA token for the given action.  
Returns a Promise that resolves with the token string.

**Example:**

```typescript
const token = await recaptchaRef.current?.getToken('custom_action');
console.log('Token:', token);
```

---

## **Full Example**

```typescript
import React, { useRef } from 'react';
import { Button, View } from 'react-native';
import ReCaptcha, { GoogleRecaptchaRefAttributes } from '@valture/react-native-recaptcha-v3';

const App = () => {
  const recaptchaRef = useRef<GoogleRecaptchaRefAttributes>(null);

  const handleSubmit = async () => {
    try {
      const token = await recaptchaRef.current?.getToken('login');
      console.log('Token:', token);
      // Send token to your backend
    } catch (error) {
      console.error('reCAPTCHA error:', error);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <ReCaptcha
        ref={recaptchaRef}
        siteKey="your_site_key_here"
        baseUrl="https://your-domain.com"
        onVerify={(token) => console.log('Verified:', token)}
        onError={(error) => console.error('Error:', error)}
      />
      <Button title="Submit" onPress={handleSubmit} />
    </View>
  );
};

export default App;
```

---

## **Troubleshooting**

- Ensure your `siteKey` matches the key configured on the Google reCAPTCHA Admin Console.
- `baseUrl` should correspond to the domain registered with Google reCAPTCHA.

---

## **License**

This project is licensed under the **MIT License**.

---

## **Contributing**

We welcome contributions! Follow our [contributing guide](CONTRIBUTING.md) for instructions on how to contribute to this project.
