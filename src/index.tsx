import React, { forwardRef, useImperativeHandle } from 'react';
import { StyleSheet } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import type { GoogleRecaptchaRefAttributes, ReCaptchaMessage, ReCaptchaProps, WebViewError, WebViewHttpError } from './types';
export type { ReCaptchaProps, GoogleRecaptchaRefAttributes, ReCaptchaMessage } from './types';

const ReCaptchaV3 = forwardRef<GoogleRecaptchaRefAttributes, ReCaptchaProps>(
  ({ 
    siteKey = 'dummy-site-key', 
    baseUrl = 'https://example.com', 
    action = 'submit', 
    onVerify, 
    onError, 
    containerStyle, 
    style 
  }, ref) => {
    const webViewRef = React.useRef<WebView>(null);
    const tokenPromiseRef = React.useRef<{
      resolve: (value: string | null) => void;
      reject: (reason?: any) => void;
    } | null>(null);

    const handleError = React.useCallback((error: string) => {
      onError?.(error);
      tokenPromiseRef.current?.reject(new Error(error));
      tokenPromiseRef.current = null;
    }, [onError]);

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
    }), [siteKey, action]);

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <script src="https://www.google.com/recaptcha/api.js?render=${siteKey}" async defer></script>
          <script>
            window.onerror = function(msg, url, lineNo, columnNo, error) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'ERROR',
                error: 'Script error: ' + msg
              }));
              return false;
            };
          </script>
        </head>
        <body style="background-color: transparent;">
          <script>
            function checkRecaptchaReady() {
              if (window.grecaptcha && window.grecaptcha.ready) {
                window.grecaptcha.ready(() => {
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'READY'
                  }));
                });
              } else {
                setTimeout(checkRecaptchaReady, 100);
              }
            }
            checkRecaptchaReady();
          </script>
        </body>
      </html>
    `;

    const handleMessage = React.useCallback((event: WebViewMessageEvent) => {
      try {
        const data: ReCaptchaMessage = JSON.parse(event.nativeEvent.data);
        if (data.type === 'VERIFY' && data.token) {
          onVerify?.(data.token);
          tokenPromiseRef.current?.resolve(data.token);
        } else if (data.type === 'ERROR') {
          handleError(data.error || 'reCAPTCHA error');
        }
      } catch (error) {
        handleError('Failed to parse reCAPTCHA response');
      }
    }, [onVerify, handleError]);

    const handleWebViewError = React.useCallback((syntheticEvent: { nativeEvent: WebViewError }) => {
      const { nativeEvent } = syntheticEvent;
      handleError(`WebView error: ${nativeEvent.description}`);
    }, [handleError]);

    const handleWebViewHttpError = React.useCallback((syntheticEvent: { nativeEvent: WebViewHttpError }) => {
      const { nativeEvent } = syntheticEvent;
      handleError(`WebView HTTP error: ${nativeEvent.statusCode}`);
    }, [handleError]);

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
        onError={handleWebViewError}
        onHttpError={handleWebViewHttpError}
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
