## Local Testing Guide

Use this guide to test `@valture/react-native-recaptcha-v3` locally without publishing to npm.

### Method 1: npm pack (Recommended)

Creates a tarball and installs it in your app.

```bash
# In the library repo
cd /Users/smitvalture/Developer/react-native-reCaptcha-V3
npm run clean && npm run prepare
npm pack

# In your app
cd /path/to/your/app
npm install /Users/smitvalture/Developer/react-native-reCaptcha-V3/valture-react-native-recaptcha-v3-2.0.1.tgz
# or
yarn add /Users/smitvalture/Developer/react-native-reCaptcha-V3/valture-react-native-recaptcha-v3-2.0.1.tgz
```

Update flow when you change the library:

```bash
# In the library
npm run clean && npm run prepare
npm pack

# In the app
npm install /Users/smitvalture/Developer/react-native-reCaptcha-V3/valture-react-native-recaptcha-v3-2.0.1.tgz
```

### Method 2: npm link (Alternative)

Symlink the package for rapid iteration.

```bash
# In the library
cd /Users/smitvalture/Developer/react-native-reCaptcha-V3
npm link

# In the app
cd /path/to/your/app
npm link @valture/react-native-recaptcha-v3
```

If Metro bundler has issues with symlinks, consider using `npm pack` instead.

### Method 3: Install from local folder

```bash
cd /path/to/your/app
npm install /Users/smitvalture/Developer/react-native-reCaptcha-V3
# or
yarn add /Users/smitvalture/Developer/react-native-reCaptcha-V3
```

### Ensure peer dependency

```bash
npm install react-native-webview
```

### Minimal usage in your app

```tsx
import React, { useRef } from 'react';
import ReCaptcha, { GoogleRecaptchaRefAttributes } from '@valture/react-native-recaptcha-v3';

export default function Demo() {
  const recaptchaRef = useRef<GoogleRecaptchaRefAttributes>(null);
  return (
    <ReCaptcha
      ref={recaptchaRef}
      siteKey="your-site-key"
      baseUrl="https://your-domain.com"
      onVerify={(token) => console.log('Token', token)}
      onError={(err) => console.log('Error', err)}
    />
  );
}
```

### Tips

- Rebuild the library after changes: `npm run clean && npm run prepare`
- For npm link, restart Metro if resolution fails
- Test both iOS and Android

