import React, { forwardRef, useImperativeHandle } from 'react';
import { StyleSheet } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import type { GoogleRecaptchaRefAttributes, ReCaptchaMessage, ReCaptchaProps } from './types';

const ReCaptchaV3 = forwardRef<GoogleRecaptchaRefAttributes, ReCaptchaProps>(
  ({ siteKey = 'dummy-site-key', baseUrl = 'https://example.com', action = 'submit', onVerify, onError, containerStyle, style }, ref) => {
    const webViewRef = React.useRef<WebView>(null);
    const tokenPromiseRef = React.useRef<{
      resolve: (value: string | null) => void;
      reject: (reason?: any) => void;
    } | null>(null);

    useImperativeHandle(ref, () => ({
      getToken: (customAction = action) => {
        return new Promise((resolve, reject) => {
          tokenPromiseRef.current = { resolve, reject };
          const jsToInject = `
            (function executeReCaptcha() {
              if (window.grecaptcha) {
                window.grecaptcha.execute('${siteKey}', { action: '${customAction}' })
                  .then(token => {
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                      type: 'VERIFY',
                      token: token
                    }));
                  })
                  .catch(error => {
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                      type: 'ERROR',
                      error: error.message || 'reCAPTCHA execution failed'
                    }));
                  });
              } else {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'ERROR',
                  error: 'reCAPTCHA not ready'
                }));
              }
            })();
            true;
          `;
          webViewRef.current?.injectJavaScript(jsToInject);
        });
      },
    }));

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <script src="https://www.google.com/recaptcha/api.js?render=${siteKey}"></script>
        </head>
        <body style="background-color: transparent;">
          <script>
            window.grecaptcha.ready(() => {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'READY'
              }));
            });
          </script>
        </body>
      </html>
    `;

    const handleMessage = (event: WebViewMessageEvent) => {
      try {
        const data: ReCaptchaMessage = JSON.parse(event.nativeEvent.data);
        if (data.type === 'VERIFY' && data.token) {
          onVerify?.(data.token);
          tokenPromiseRef.current?.resolve(data.token);
        } else if (data.type === 'ERROR') {
          const errorMessage = data.error || 'reCAPTCHA error';
          onError?.(errorMessage);
          tokenPromiseRef.current?.reject(new Error(errorMessage));
        }
      } catch (error) {
        const errorMessage = 'Failed to parse reCAPTCHA response';
        onError?.(errorMessage);
        tokenPromiseRef.current?.reject(error);
      } finally {
        tokenPromiseRef.current = null; // Clean up promise reference
      }
    };

    return (
      <WebView
        ref={webViewRef}
        source={{ 
          html: htmlContent,
          baseUrl
        }}
        onMessage={handleMessage}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        originWhitelist={['*']}
        style={[styles.webview, style]}
        automaticallyAdjustContentInsets={true}
        mixedContentMode={'always'}
        containerStyle={[styles.container, containerStyle]}
      />
    );
  }
);

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
  },
  webview: {
    backgroundColor: 'transparent',
  },
});

export default ReCaptchaV3;
