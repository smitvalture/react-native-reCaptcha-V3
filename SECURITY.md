# Security policy

## Supported versions

Only the latest minor release receives security fixes. Older versions are not patched. The current supported line:

| Version | Supported |
|---------|-----------|
| 2.4.x   | ✅        |
| < 2.4   | ❌        |

If you're on an older version, upgrade first; if upgrading is impossible, open a security report and we'll triage on a best-effort basis.

## Reporting a vulnerability

**Please do not report security vulnerabilities through public GitHub issues, discussions, or pull requests.**

Instead, use **GitHub's private vulnerability reporting**:

1. Go to [Security → Advisories](https://github.com/smitvalture/react-native-recaptcha-v3/security/advisories/new) on the repo.
2. Click **"Report a vulnerability"** and fill out the form.

This creates a private advisory only the maintainer can see. If you don't have a GitHub account or the form isn't available to you, email the maintainer directly (the email is in the `author` field of [`package.json`](./package.json)).

## What to include

A useful report includes:

- The version of `@valture/react-native-recaptcha-v3` affected.
- The platform (iOS / Android / both).
- A description of the vulnerability and its impact.
- A minimal proof-of-concept if available — code snippet, URL, or repro steps.
- Your suggested fix, if you have one.

## Triage timeline

- **Acknowledgement**: within 5 business days of report.
- **Initial assessment**: severity rating + planned-fix timeline within 14 days.
- **Fix release**: critical issues within 30 days when feasible; lower severity tracked on the public roadmap once disclosed.

## Scope

In scope:

- **JavaScript / TypeScript bugs** that allow injection of attacker-controlled content into the WebView, leak tokens, or compromise the secure-by-default props (`originWhitelist`, `mixedContentMode`, `siteKey` validation).
- Bugs in this package that cause **tokens to be issued under conditions Google's documentation says they shouldn't be**.

Out of scope:

- Vulnerabilities in `react-native-webview`, `react-native`, or Google's reCAPTCHA service itself. Report those to the respective maintainers.
- General "WebView is less secure than native" concerns — see the [About the WebView approach](./README.md#-about-the-webview-approach) section of the README.
- Issues that require a malicious site key issued by Google — those are the user's configuration problem.

## Disclosure

Once a fix is released, the advisory is published with a CVE if applicable. We will credit the reporter unless they prefer to remain anonymous.
