import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
  useEffect,
} from 'react';
import { StyleSheet } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import type {
  GoogleRecaptchaRefAttributes,
  ReCaptchaMessage,
  ReCaptchaProps,
  WebViewError,
  WebViewHttpError,
} from './types';
export type {
  ReCaptchaProps,
  GoogleRecaptchaRefAttributes,
  ReCaptchaMessage,
} from './types';

const ReCaptchaV3 = forwardRef<GoogleRecaptchaRefAttributes, ReCaptchaProps>(
  (
    {
      siteKey,
      baseUrl = 'https://example.com',
      action = 'submit',
      onVerify,
      onError,
      containerStyle,
      style,
    },
    ref
  ) => {
    // Validate required props
    if (!siteKey) {
      throw new Error('ReCaptchaV3: siteKey prop is required');
    }

    const webViewRef = useRef<WebView>(null);
    const [isReady, setIsReady] = useState(false);
    const tokenPromiseRef = useRef<{
      resolve: (value: string | null) => void;
      reject: (reason?: any) => void;
      action: string;
    } | null>(null);

    // Queue for token requests that come in before the reCAPTCHA is ready
    const pendingRequests = useRef<
      Array<{
        action: string;
        resolve: (value: string | null) => void;
        reject: (reason?: any) => void;
      }>
    >([]);

    // Store timeout IDs for cleanup
    const timeoutIds = useRef<ReturnType<typeof setTimeout>[]>([]);

    const handleError = React.useCallback(
      (error: string) => {
        onError?.(error);
        if (tokenPromiseRef.current) {
          tokenPromiseRef.current.reject(new Error(error));
          tokenPromiseRef.current = null;
        }
      },
      [onError]
    );

    // Function to execute reCAPTCHA and get a token
    const executeReCaptcha = React.useCallback(
      (
        customAction: string,
        resolve: (value: string | null) => void,
        reject: (reason?: any) => void
      ) => {
        if (!isReady) {
          console.warn('reCAPTCHA not ready yet, queueing request');
          pendingRequests.current.push({
            action: customAction,
            resolve,
            reject,
          });
          return;
        }

        tokenPromiseRef.current = { resolve, reject, action: customAction };

        const jsToInject = `
        (function executeReCaptcha() {
          try {
            if (window.grecaptcha && window.grecaptcha.execute) {
              window.grecaptcha.execute('${siteKey}', { action: '${customAction}' })
                .then(function(token) {
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'VERIFY',
                    token: token,
                    action: '${customAction}'
                  }));
                })
                .catch(function(error) {
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'ERROR',
                    error: error.message || 'reCAPTCHA execution failed',
                    action: '${customAction}'
                  }));
                });
            } else {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'ERROR',
                error: 'reCAPTCHA not ready',
                action: '${customAction}'
              }));
            }
          } catch (e) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'ERROR',
              error: 'JavaScript execution error: ' + (e.message || 'Unknown error'),
              action: '${customAction}'
            }));
          }
          return true;
        })();
      `;

        webViewRef.current?.injectJavaScript(jsToInject);
      },
      [siteKey, isReady]
    );

    // Handle the case when reCAPTCHA is ready
    useEffect(() => {
      if (isReady && pendingRequests.current.length > 0) {
        console.log(
          `Processing ${pendingRequests.current.length} pending reCAPTCHA requests`
        );

        // Process all pending requests
        const requests = [...pendingRequests.current];
        pendingRequests.current = [];

        // Process the first request immediately
        const firstRequest = requests.shift();
        if (firstRequest) {
          executeReCaptcha(
            firstRequest.action,
            firstRequest.resolve,
            firstRequest.reject
          );
        }

        // Queue the rest with a small delay to prevent overwhelming the WebView
        requests.forEach((request, index) => {
          const timeoutId = setTimeout(
            () => {
              executeReCaptcha(request.action, request.resolve, request.reject);
            },
            (index + 1) * 500
          ); // Stagger requests by 500ms
          timeoutIds.current.push(timeoutId);
        });
      }

      // Cleanup function: only clear timeouts if component unmounts, not on every dependency change
      return () => {
        // Only clear timeouts if isReady is false (i.e., on unmount)
        if (!isReady) {
          timeoutIds.current.forEach(clearTimeout);
          timeoutIds.current = [];
        }
      };
    }, [isReady, executeReCaptcha]);

    useImperativeHandle(
      ref,
      () => ({
        getToken: (customAction = action) => {
          console.log('🚀 ~ useImperativeHandle ~ customAction:', customAction);
          return new Promise((resolve, reject) => {
            executeReCaptcha(customAction, resolve, reject);
          });
        },

        // Add a new method to check if reCAPTCHA is ready
        isReady: () => {
          return isReady;
        },
      }),
      [siteKey, action, isReady, executeReCaptcha]
    );

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <script>
            // Global error handler
            window.onerror = function(msg, url, lineNo, columnNo, error) {
              if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'ERROR',
                  error: 'Script error: ' + msg
                }));
              }
              return false;
            };
            
            // Function to check if reCAPTCHA is ready and notify the React Native app
            function checkRecaptchaReady() {
              if (window.grecaptcha && window.grecaptcha.ready) {
                window.grecaptcha.ready(function() {
                  if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                      type: 'READY'
                    }));
                  }
                });
              } else {
                setTimeout(checkRecaptchaReady, 500);
              }
            }
            
            // Start checking for reCAPTCHA readiness immediately
            setTimeout(checkRecaptchaReady, 500);
          </script>
        </head>
        <body style="background-color: transparent;">
          <div id="recaptcha-container"></div>
          <script src="https://www.google.com/recaptcha/api.js?render=${siteKey}" async defer></script>
          <script>
            // Also check readiness when DOM is fully loaded
            document.addEventListener('DOMContentLoaded', function() {
              checkRecaptchaReady();
            });
          </script>
        </body>
      </html>
    `;

    const handleMessage = React.useCallback(
      (event: WebViewMessageEvent) => {
        try {
          const data: ReCaptchaMessage = JSON.parse(event.nativeEvent.data);

          if (data.type === 'READY') {
            console.log('reCAPTCHA is ready');
            setIsReady(true);
          } else if (data.type === 'VERIFY' && data.token) {
            console.log('reCAPTCHA token received');
            onVerify?.(data.token);
            if (tokenPromiseRef.current) {
              tokenPromiseRef.current.resolve(data.token);
              tokenPromiseRef.current = null;
            }
          } else if (data.type === 'ERROR') {
            console.warn('reCAPTCHA error:', data.error);
            handleError(data.error || 'reCAPTCHA error');
          }
        } catch (error) {
          console.error('Failed to parse WebView message:', error);
          handleError('Failed to parse reCAPTCHA response');
        }
      },
      [onVerify, handleError]
    );

    const handleWebViewError = React.useCallback(
      (syntheticEvent: { nativeEvent: WebViewError }) => {
        const { nativeEvent } = syntheticEvent;
        console.error('WebView error:', nativeEvent);
        handleError(`WebView error: ${nativeEvent.description}`);
      },
      [handleError]
    );

    const handleWebViewHttpError = React.useCallback(
      (syntheticEvent: { nativeEvent: WebViewHttpError }) => {
        const { nativeEvent } = syntheticEvent;
        console.error('WebView HTTP error:', nativeEvent);
        handleError(`WebView HTTP error: ${nativeEvent.statusCode}`);
      },
      [handleError]
    );

    return (
      <WebView
        ref={webViewRef}
        source={{
          html: htmlContent,
          baseUrl,
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
