import { forwardRef, useImperativeHandle, useRef, useState, useEffect, useCallback } from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

// Type definitions
export interface ReCaptchaProps {
  siteKey: string;
  baseUrl: string;
  action?: string;
  onVerify?: (token: string) => void;
  onError?: (error: string) => void;
  style?: ViewStyle;
  containerStyle?: ViewStyle;
}

export interface GoogleRecaptchaRefAttributes {
  getToken: (action?: string) => Promise<string | null>;
  isReady: () => boolean;
}

export interface ReCaptchaMessage {
  type: 'VERIFY' | 'ERROR' | 'READY';
  token?: string;
  error?: string;
  action?: string;
}

export interface WebViewError {
  description: string;
  url?: string;
}

export interface WebViewHttpError {
  statusCode: number;
  url?: string;
}

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
    const webViewRef = useRef<WebView>(null);
    const [isReady, setIsReady] = useState(false);
    const tokenPromiseRef = useRef<{
      resolve: (value: string | null) => void;
      reject: (reason?: any) => void;
      action: string;
    } | null>(null);
    
    // Queue for token requests that come in before the reCAPTCHA is ready
    const pendingRequests = useRef<Array<{
      action: string;
      resolve: (value: string | null) => void;
      reject: (reason?: any) => void;
    }>>([]);

    const handleError = useCallback((error: string) => {
      onError?.(error);
      if (tokenPromiseRef.current) {
        tokenPromiseRef.current.reject(new Error(error));
        tokenPromiseRef.current = null;
      }
    }, [onError]);

    // Handle the case when reCAPTCHA is ready
    useEffect(() => {
      if (isReady && pendingRequests.current.length > 0) {
        // Process all pending requests
        const requests = [...pendingRequests.current];
        pendingRequests.current = [];
        
        // Process the first request immediately
        const firstRequest = requests.shift();
        if (firstRequest) {
          executeReCaptcha(firstRequest.action, firstRequest.resolve, firstRequest.reject);
        }
        
        // Queue the rest with a small delay to prevent overwhelming the WebView
        requests.forEach((request, index) => {
          setTimeout(() => {
            executeReCaptcha(request.action, request.resolve, request.reject);
          }, (index + 1) * 500); // Stagger requests by 500ms
        });
      }
    }, [isReady]);

    // Small utility to trim excessive whitespace in template strings so we keep
    // readable source while sending compact payloads to the WebView
    const minifyString = (input: string) => input.replace(/\s+/g, ' ').trim();

    // Function to execute reCAPTCHA and get a token
    const executeReCaptcha = (customAction: string, resolve: (value: string | null) => void, reject: (reason?: any) => void) => {
      if (!isReady) {
        pendingRequests.current.push({ action: customAction, resolve, reject });
        return;
      }
      
      tokenPromiseRef.current = { resolve, reject, action: customAction };
      
      const jsToInject = `
        (function executeReCaptcha() {
          try {
            if (window.grecaptcha && window.grecaptcha.execute) {
              window.grecaptcha
                .execute('${siteKey}', { action: '${customAction}' })
                .then(function (token) {
                  window.ReactNativeWebView.postMessage(
                    JSON.stringify({ type: 'VERIFY', token: token, action: '${customAction}' })
                  );
                })
                .catch(function (error) {
                  window.ReactNativeWebView.postMessage(
                    JSON.stringify({
                      type: 'ERROR',
                      error: error.message || 'reCAPTCHA execution failed',
                      action: '${customAction}',
                    })
                  );
                });
            } else {
              window.ReactNativeWebView.postMessage(
                JSON.stringify({ type: 'ERROR', error: 'reCAPTCHA not ready', action: '${customAction}' })
              );
            }
          } catch (e) {
            window.ReactNativeWebView.postMessage(
              JSON.stringify({
                type: 'ERROR',
                error: 'JavaScript execution error: ' + (e.message || 'Unknown error'),
                action: '${customAction}',
              })
            );
          }
          return true;
        })();
      `;
      
      webViewRef.current?.injectJavaScript(minifyString(jsToInject));
    };

    useImperativeHandle(ref, () => ({
      getToken: (customAction = action) => {
        return new Promise((resolve, reject) => {
          executeReCaptcha(customAction, resolve, reject);
        });
      },
      
      // Add a new method to check if reCAPTCHA is ready
      isReady: () => {
        return isReady;
      }
    }), [siteKey, action, isReady]);

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <script>
            // Minimal error surface forwarded to RN side
            window.onerror = function (msg) {
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(
                  JSON.stringify({ type: 'ERROR', error: 'Script error: ' + msg })
                );
              }
              return false;
            };

            function checkRecaptchaReady() {
              if (window.grecaptcha && window.grecaptcha.ready) {
                window.grecaptcha.ready(function () {
                  if (window.ReactNativeWebView) {
                    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'READY' }));
                  }
                });
              } else {
                setTimeout(checkRecaptchaReady, 500);
              }
            }

            // Kick off readiness checks
            setTimeout(checkRecaptchaReady, 500);
          </script>
        </head>
        <body style="background-color: transparent;">
          <div id="recaptcha-container"></div>
          <script src="https://www.google.com/recaptcha/api.js?render=${siteKey}" async defer></script>
          <script>
            document.addEventListener('DOMContentLoaded', checkRecaptchaReady);
          </script>
        </body>
      </html>
    `;

    const handleMessage = useCallback((event: WebViewMessageEvent) => {
      try {
        const data: ReCaptchaMessage = JSON.parse(event.nativeEvent.data);
        
        if (data.type === 'READY') {
          setIsReady(true);
        } else if (data.type === 'VERIFY' && data.token) {
          onVerify?.(data.token);
          if (tokenPromiseRef.current) {
            tokenPromiseRef.current.resolve(data.token);
            tokenPromiseRef.current = null;
          }
        } else if (data.type === 'ERROR') {
          handleError(data.error || 'reCAPTCHA error');
        }
      } catch (error) {
        handleError('Failed to parse reCAPTCHA response');
      }
    }, [onVerify, handleError]);

    const handleWebViewError = (syntheticEvent: { nativeEvent: WebViewError }) => {
      const { nativeEvent } = syntheticEvent;
      handleError(`WebView error: ${nativeEvent.description}`);
    };

    const handleWebViewHttpError = (syntheticEvent: { nativeEvent: WebViewHttpError }) => {
      const { nativeEvent } = syntheticEvent;
      handleError(`WebView HTTP error: ${nativeEvent.statusCode}`);
    };

    return (
      <WebView
        ref={webViewRef}
        source={{ 
          html: minifyString(htmlContent),
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