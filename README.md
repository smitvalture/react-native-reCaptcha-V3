# React Native reCAPTCHA v3

[![npm version](https://badge.fury.io/js/%40valture%2Freact-native-recaptcha-v3.svg)](https://www.npmjs.com/package/@valture/react-native-recaptcha-v3)
[![npm downloads](https://img.shields.io/npm/dm/%40valture%2Freact-native-recaptcha-v3)](https://www.npmjs.com/package/@valture/react-native-recaptcha-v3)
[![CI](https://github.com/smitvalture/react-native-recaptcha-v3/actions/workflows/ci.yml/badge.svg)](https://github.com/smitvalture/react-native-recaptcha-v3/actions/workflows/ci.yml)
[![types](https://img.shields.io/npm/types/%40valture%2Freact-native-recaptcha-v3)](https://www.npmjs.com/package/@valture/react-native-recaptcha-v3)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A lightweight, **actively maintained** React Native component for **Google reCAPTCHA v3 (score-based, invisible)**. Zero user interaction, ref-based API, full TypeScript types, supports reCAPTCHA Enterprise and `AbortSignal`.

> **Are you sure you want v3?** v3 returns a score (0.0–1.0) silently in the background — no challenge, no modal, no checkbox. If you need a visible "I'm not a robot" challenge or a modal puzzle, you want **v2** instead — see [Picking the right package](#-picking-the-right-package) below.

## 📋 Table of contents

- [Picking the right package](#-picking-the-right-package)
- [Features](#-features)
- [Installation](#-installation)
- [Obtaining reCAPTCHA keys](#-obtaining-recaptcha-keys)
- [Usage](#-usage)
- [API Reference](#️-api-reference)
- [Advanced usage](#-advanced-usage)
- [How it works](#-how-it-works)
- [About the WebView approach](#-about-the-webview-approach)
- [FAQ](#-faq)
- [Troubleshooting](#️-troubleshooting)

## 🎯 Picking the right package

reCAPTCHA has several variants and the React Native ecosystem has a package per variant. Use this table to land on the right one:

| You want… | Use |
|----------|-----|
| **v3 score-based** (invisible, score 0–1, no UI ever) | **`@valture/react-native-recaptcha-v3`** ← this package |
| **v3 score-based with abandoned legacy code** | `react-native-recaptcha-v3` (last updated 2018 — avoid for new code) |
| **v2 checkbox** ("I'm not a robot") or **v2 invisible** (modal challenge) | [`react-native-recaptcha-that-works`](https://github.com/douglasjunior/react-native-recaptcha-that-works) |
| **reCAPTCHA Enterprise** score-based | This package, with `useEnterprise` prop |
| **reCAPTCHA Enterprise** challenge-based | [`react-native-recaptcha-that-works`](https://github.com/douglasjunior/react-native-recaptcha-that-works) |
| **hCaptcha** | [`@hcaptcha/react-native-hcaptcha`](https://www.npmjs.com/package/@hcaptcha/react-native-hcaptcha) |

> **Tip:** v3 score-based and v2/hCaptcha challenges complement each other well. A common production pattern is "v3 first, fall back to a visible challenge if the score is low." This package and `that-works`/`hcaptcha` can be used together.

## ✨ Features

- **Invisible**: pure reCAPTCHA v3 — no UI, no friction
- **Ref-based API**: `getToken(action, { signal })`, `isReady()`, `reset()`
- **AbortSignal support**: cancel in-flight token requests with the standard browser API
- **reCAPTCHA Enterprise**: opt in with `useEnterprise`
- **Secure defaults**: narrow `originWhitelist`, `mixedContentMode='never'`, `siteKey` shape validation
- **Auto-recovery**: queues pre-ready calls, handles reload + retry
- **Network error detection**: comprehensive offline/timeout handling with clear errors
- **First-class TypeScript**: types ship with the package, no `@types/*` needed
- **Tested**: 32 unit tests with controllable WebView mock; CI on every PR

## 📦 Installation

```bash
# Yarn
yarn add @valture/react-native-recaptcha-v3 react-native-webview

# npm
npm install @valture/react-native-recaptcha-v3 react-native-webview
```

### Peer dependencies

| Peer | Minimum | Tested |
|------|---------|--------|
| `react` | `>=16.8.0` | 18.3 |
| `react-native` | `>=0.60.0` | 0.76 |
| `react-native-webview` | `>=11.0.0` | 13.16 |

If you support older RN versions in your app, run a quick smoke test — the bundled CI matrix only validates the tested column.

## 🔑 Obtaining reCAPTCHA keys

You need a **Site Key** and a **registered domain (`baseUrl`)** from the Google reCAPTCHA Admin console.

1. Go to [https://www.google.com/recaptcha/admin/create](https://www.google.com/recaptcha/admin/create)
2. **reCAPTCHA Type**: choose **reCAPTCHA v3** (this package does not work with v2 keys)
3. **Domains**: enter the domain you control on your backend (e.g. `api.mydomain.com`). This must match the `baseUrl` prop in the component.
4. Copy the **Site Key** into the `siteKey` prop. Store the **Secret Key** on your backend — never include it in your app.

For reCAPTCHA Enterprise, follow [Google Cloud's setup guide](https://cloud.google.com/recaptcha/docs/setup-mobile) and pass `useEnterprise` to the component.

## 🚀 Usage

```tsx
import React, { useRef } from 'react';
import { Button, View, StyleSheet, Alert } from 'react-native';
import ReCaptcha, {
  type GoogleRecaptchaRefAttributes,
} from '@valture/react-native-recaptcha-v3';

const SITE_KEY = 'your_site_key_here';
const BASE_URL = 'https://api.mydomain.com'; // must match the domain registered in reCAPTCHA Admin

const App = () => {
  const recaptchaRef = useRef<GoogleRecaptchaRefAttributes>(null);

  const handleSubmit = async () => {
    try {
      const token = await recaptchaRef.current?.getToken('login');
      if (token) {
        // POST `token` to your backend, which calls Google's siteverify API
        // with your Secret Key to get the score.
        console.log('reCAPTCHA Token:', token);
      }
    } catch (error) {
      Alert.alert('reCAPTCHA error', String(error));
    }
  };

  return (
    <View style={styles.container}>
      <ReCaptcha
        ref={recaptchaRef}
        siteKey={SITE_KEY}
        baseUrl={BASE_URL}
        action="homepage"
        onVerify={(token, action) => console.log('Verified', { action, token })}
        onError={(error) => console.error('reCAPTCHA error:', error)}
        containerStyle={styles.recaptchaContainer}
        testMode={__DEV__}
      />
      <Button title="Submit" onPress={handleSubmit} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  recaptchaContainer: { position: 'absolute', width: 0, height: 0, opacity: 0, zIndex: -1 },
});

export default App;
```

## ⚙️ API Reference

### Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `siteKey` | `string` | Yes | — | Google reCAPTCHA v3 Site Key. Validated against `/^[A-Za-z0-9_-]{20,80}$/` at mount; malformed keys surface via `onError`. |
| `baseUrl` | `string` | Yes | — | Domain registered with reCAPTCHA Admin (e.g. `https://api.mydomain.com`). |
| `action` | `string` | No | `'submit'` | Default action name. Can be overridden per `getToken()` call. |
| `onVerify` | `(token, action) => void` | No | — | Fires on successful token generation. Receives the resolved action. |
| `onError` | `(error: string) => void` | No | — | Fires on any reCAPTCHA error. |
| `onLoadStart` | `() => void` | No | — | Fires when the WebView starts loading. |
| `onLoadEnd` | `() => void` | No | — | Fires **once per load cycle** when the WebView finishes loading. |
| `style` | `ViewStyle` | No | — | Style for the underlying `WebView`. |
| `containerStyle` | `ViewStyle` | No | — | Style for the wrapping container. |
| `initializationTimeout` | `number` | No | `30000` | Timeout (ms) for queued pre-ready `getToken()` calls. |
| `tokenRequestTimeout` | `number` | No | `15000` | Timeout (ms) for in-flight token requests. |
| `testMode` | `boolean` | No | `false` | Enable verbose `console.log` for debugging. |
| `useEnterprise` | `boolean` | No | `false` | Use the reCAPTCHA Enterprise endpoint. |
| `originWhitelist` | `readonly string[]` | No | `[google.com, gstatic.com, baseUrl]` | Origins the WebView can navigate to. Pass `['*']` to opt out. |
| `mixedContentMode` | `'never' \| 'always' \| 'compatibility'` | No | `'never'` | Android WebView mixed-content policy. |

### Methods (via `ref`)

| Method | Signature | Description |
|--------|-----------|-------------|
| `getToken` | `(action?: string, options?: { signal?: AbortSignal }) => Promise<string>` | Fetches a token. Queues if pre-ready. Pass `options.signal` to cancel. |
| `isReady` | `() => boolean` | `true` if reCAPTCHA initialized successfully and no error is set. |
| `reset` | `() => Promise<void>` | Reloads the underlying WebView. Rejects any in-flight or queued `getToken()` promises with a clear `RESET` error. Resolves once the reload completes. |

### Error messages

The component rejects `getToken()` promises with `Error` objects whose `.message` is one of:

| Message | When |
|---------|------|
| `'Network connection required. Please check your internet connection.'` | Offline, script load failure, init timeout |
| `'reCAPTCHA initialization timed out. Please check your internet connection.'` | Queued request waited longer than `initializationTimeout` |
| `'Token request timed out. Please try again.'` | In-flight request exceeded `tokenRequestTimeout` |
| `'reCAPTCHA is not ready. Please wait and try again.'` | Called synchronously before initialization |
| `'Invalid token received from reCAPTCHA.'` | Empty/malformed VERIFY payload |
| `'Token request superseded by a newer request.'` | A newer `getToken()` started while this one was in-flight |
| `'Token request cancelled: reCAPTCHA was reset.'` | `reset()` was called while this request was pending |
| `'Token request was aborted.'` | Caller aborted via `AbortSignal` |
| `'Invalid siteKey. …'` | `siteKey` failed shape validation |

## 🧰 Advanced usage

### Cancel a token request with `AbortSignal`

```tsx
const controller = new AbortController();

const tokenPromise = recaptchaRef.current?.getToken('checkout', {
  signal: controller.signal,
});

// User navigates away, modal closes, etc.
controller.abort();

try {
  await tokenPromise;
} catch (err) {
  // err.message === 'Token request was aborted.'
}
```

### reCAPTCHA Enterprise

```tsx
<ReCaptcha
  ref={recaptchaRef}
  siteKey={ENTERPRISE_SITE_KEY}
  baseUrl={BASE_URL}
  useEnterprise
  action="checkout"
/>
```

Uses `https://www.google.com/recaptcha/enterprise.js` and `grecaptcha.enterprise.execute` under the hood.

### Combine with a visible fallback (production pattern)

```tsx
// Pseudo-code: try v3 first, fall back to a visible challenge on low score
try {
  const token = await recaptchaRef.current?.getToken('signup');
  const { score, success } = await verifyOnBackend(token);
  if (success && score >= 0.5) {
    proceed();
  } else {
    // Score too low — present hCaptcha or v2 modal challenge
    hCaptchaRef.current?.show();
  }
} catch (e) {
  // v3 failed entirely — fall back to challenge
  hCaptchaRef.current?.show();
}
```

## 🛠 How it works

The component renders a hidden `react-native-webview` that loads an HTML page containing the Google reCAPTCHA v3 script. When you call `getToken()`, the component injects JavaScript into the WebView that calls `grecaptcha.execute()` and posts the result back via `postMessage`.

Lifecycle:

1. **Mount** → WebView begins loading; component state is `not ready, no error`.
2. **WebView `onLoadStart`** → React state cleared; `onLoadStart?.()` fires.
3. **Page loads, reCAPTCHA script downloads from Google** → JS calls `grecaptcha.ready()`.
4. **`READY` message posted to RN** → component sets `isReady = true`; queued `getToken()` calls drain.
5. **`getToken()`** → JS injection calls `grecaptcha.execute(siteKey, { action })` → token comes back via `VERIFY` message → promise resolves.
6. **Error at any step** → `ERROR` / `LOAD_ERROR` message → `onError?.()` fires and all in-flight + queued promises reject.

All timers (init, force-READY safety net, per-request timeouts, abort listeners) are cleared on unmount.

## 📱 About the WebView approach

Google's [official guidance for reCAPTCHA on mobile](https://developers.google.com/recaptcha/docs/android) recommends their first-party iOS / Android SDKs over WebView-based solutions, citing higher rates of high-risk traffic from WebView origins.

**Every React Native reCAPTCHA package on npm uses WebView** — including this one. A native turbo-module wrapping Google's mobile SDKs doesn't currently exist in the open-source RN ecosystem.

What this means for you:

- ✅ **WebView is fine for most apps.** Google still issues valid tokens from WebView origins; verification still works on your backend.
- ⚠️ **High-risk traffic may score lower from WebView origins.** If your app handles particularly sensitive flows (banking, identity), score thresholds may need to be tuned downward, or you may want to layer hCaptcha / v2-modal as a visible fallback.
- ✅ **This package follows reCAPTCHA's WebView best practices**: narrow `originWhitelist`, no mixed content, validated site keys.

If a native turbo-module is critical for you, that's its own (significant) project and not on the roadmap for this package. PRs welcome if you'd like to build one.

## ❓ FAQ

### How is this different from `react-native-recaptcha-that-works`?

That package is **v2 / Enterprise challenge-based** (modal, "I'm not a robot," sometimes shows challenges). This package is **v3 score-based** (invisible, returns a score, no UI). They solve different problems and are commonly used together.

### How is this different from `react-native-recaptcha-v3` (chocolatemilkv2)?

That package was last updated in 2018 and uses class components, no TypeScript types, and predates `forwardRef`. This package is a modern rewrite with the same goal: TypeScript-first, hooks-based, tested, actively maintained.

### Why is the `siteKey` validated with a regex?

Defense in depth. The site key is interpolated into the WebView's injected JS and script URL. A malformed key (containing quotes or HTML) could in theory break out of the injection context. Real Google site keys are alphanumeric with `-` and `_`, so the regex is permissive enough for any real key and tight enough to refuse obvious nonsense.

### Why doesn't `onLoadEnd` fire when reCAPTCHA becomes ready?

`onLoadEnd` follows the WebView's documented semantic ("page finished loading") and fires exactly once per load cycle. To know when reCAPTCHA is actually ready to issue tokens, call `isReady()` or rely on `getToken()` queueing for you (it does, automatically).

### How do I verify the token on my backend?

Send the token to Google's [siteverify](https://developers.google.com/recaptcha/docs/verify) endpoint along with your Secret Key. Google returns `{ success, score, action, ... }`. Reject if `success === false` or `score` is too low for your risk threshold.

## ⚠️ Troubleshooting

- **`onError: 'Invalid siteKey...'`** — your `siteKey` prop is malformed. Real keys are 40 characters of `[A-Za-z0-9_-]`.
- **`onError: 'Network connection required...'` immediately** — the device is offline, or the WebView can't reach `https://www.google.com/recaptcha/api.js`. Check the `originWhitelist` prop if you've customized it.
- **`Error: Invalid domain for site key`** — the `baseUrl` doesn't match a domain registered in your reCAPTCHA Admin console. Re-check the exact string (including scheme).
- **`getToken()` rejects with `NOT_READY`** — you called `getToken()` synchronously before the WebView initialized. Either await `isReady()` becoming true, or let `getToken()` queue automatically (it will be processed once ready).
- **HTTP content on Android fails to load** — `mixedContentMode` defaults to `'never'`. Pass `mixedContentMode="compatibility"` if you genuinely need to mix HTTP into the HTTPS WebView (not recommended for a security component).
- **Set `testMode={true}`** to log every WebView message to the console.

## 🤝 Contributing

Contributions welcome — see [CONTRIBUTING.md](./CONTRIBUTING.md). Bug reports and feature requests go in [Issues](https://github.com/smitvalture/react-native-recaptcha-v3/issues).

For security vulnerabilities, please follow [SECURITY.md](./SECURITY.md) rather than opening a public issue.

## 📜 License

[MIT](./LICENSE)
