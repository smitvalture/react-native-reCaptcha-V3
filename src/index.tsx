import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
  useEffect,
  useCallback,
} from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

// Constants
const DEFAULT_ACTION = 'submit';
const INITIALIZATION_TIMEOUT = 30000; // 30 seconds
const TOKEN_REQUEST_TIMEOUT = 15000; // 15 seconds

// Error messages
const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network connection required. Please check your internet connection.',
  INITIALIZATION_TIMEOUT: 'reCAPTCHA initialization timed out. Please check your internet connection.',
  TOKEN_REQUEST_TIMEOUT: 'Token request timed out. Please try again.',
  NOT_READY: 'reCAPTCHA is not ready. Please wait and try again.',
  INVALID_TOKEN: 'Invalid token received from reCAPTCHA.',
} as const;

// Type definitions
export interface ReCaptchaProps {
  siteKey: string;
  baseUrl: string;
  action?: string;
  onVerify?: (token: string) => void;
  onError?: (error: string) => void;
  onLoadStart?: () => void;
  onLoadEnd?: () => void;
  style?: ViewStyle;
  containerStyle?: ViewStyle;
  initializationTimeout?: number;
  tokenRequestTimeout?: number;
  testMode?: boolean;
}

export interface GoogleRecaptchaRefAttributes {
  getToken: (action?: string) => Promise<string>;
  isReady: () => boolean;
  reset: () => Promise<void>;
}

export interface ReCaptchaMessage {
  type: 'VERIFY' | 'ERROR' | 'READY' | 'LOAD_ERROR' | 'DEBUG';
  token?: string;
  error?: string;
  message?: string;
}

interface TokenRequest {
  resolve: (value: string) => void;
  reject: (reason: Error) => void;
  action: string;
  timeoutId?: NodeJS.Timeout;
}

const ReCaptchaV3 = forwardRef<GoogleRecaptchaRefAttributes, ReCaptchaProps>(
  (
    {
      siteKey,
      baseUrl,
      action = DEFAULT_ACTION,
      onVerify,
      onError,
      onLoadStart,
      onLoadEnd,
      containerStyle,
      style,
      initializationTimeout = INITIALIZATION_TIMEOUT,
      tokenRequestTimeout = TOKEN_REQUEST_TIMEOUT,
      testMode = false,
    },
    ref
  ) => {
    const webViewRef = useRef<WebView>(null);
    const [isReady, setIsReady] = useState(false);
    const [hasError, setHasError] = useState(false);
    
    const tokenRequestRef = useRef<TokenRequest | null>(null);
    const initializationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const pendingRequests = useRef<Array<TokenRequest>>([]);
    const prevSiteKeyRef = useRef<string | undefined>(undefined);
    const prevBaseUrlRef = useRef<string | undefined>(undefined);
    const resetPromiseRef = useRef<{ resolve: () => void } | null>(null);

    // Helper for conditional logging
    const log = useCallback((...args: any[]) => {
      if (testMode) console.log(...args);
    }, [testMode]);

    // Cleanup timeouts
    const cleanup = useCallback(() => {
      if (initializationTimeoutRef.current) {
        clearTimeout(initializationTimeoutRef.current);
        initializationTimeoutRef.current = null;
      }
      if (tokenRequestRef.current?.timeoutId) {
        clearTimeout(tokenRequestRef.current.timeoutId);
      }
    }, []);

    // Reset component - returns Promise that resolves when reset is complete
    const reset = useCallback(() => {
      return new Promise<void>((resolve) => {
        cleanup();
        setIsReady(false);
        setHasError(false);
        pendingRequests.current = [];
        tokenRequestRef.current = null;
        
        // Store resolve function to call when WebView finishes loading
        resetPromiseRef.current = { resolve };
        
        // Reload WebView - resolve will be called in handleLoadEnd
        webViewRef.current?.reload();
      });
    }, [cleanup]);

    // Handle errors
    const handleError = useCallback(
      (error: string) => {
        log('[ReCaptcha] Error:', error);
        onError?.(error);
        setHasError(true);

        // Reject current request
        if (tokenRequestRef.current) {
          if (tokenRequestRef.current.timeoutId) {
            clearTimeout(tokenRequestRef.current.timeoutId);
          }
          try {
            tokenRequestRef.current.reject(new Error(error));
          } catch (e) {
            // Already rejected
          }
          tokenRequestRef.current = null;
        }

        // Reject pending requests
        pendingRequests.current.forEach((request) => {
          if (request.timeoutId) clearTimeout(request.timeoutId);
          try {
            request.reject(new Error(error));
          } catch (e) {
            // Already rejected
          }
        });
        pendingRequests.current = [];
      },
      [onError, log]
    );

    // Initialize timeout - also detects if LOAD_ERROR never comes from WebView
    useEffect(() => {
      if (!isReady && !hasError) {
        initializationTimeoutRef.current = setTimeout(() => {
          if (!isReady && !hasError) {
            // If we haven't received READY or LOAD_ERROR after timeout, assume network error
            log('[ReCaptcha] Initialization timeout - no response from WebView, assuming network error');
            handleError(ERROR_MESSAGES.NETWORK_ERROR);
          }
        }, Math.min(initializationTimeout, 8000)); // Max 8 seconds to detect network issues
      }
      return () => {
        if (initializationTimeoutRef.current) {
          clearTimeout(initializationTimeoutRef.current);
          initializationTimeoutRef.current = null;
        }
      };
    }, [isReady, hasError, initializationTimeout, handleError, log]);

    // Reset on prop changes
    useEffect(() => {
      const isFirstMount = prevSiteKeyRef.current === undefined;
      if (isFirstMount) {
        prevSiteKeyRef.current = siteKey;
        prevBaseUrlRef.current = baseUrl;
        return;
      }

      if (prevSiteKeyRef.current !== siteKey || prevBaseUrlRef.current !== baseUrl) {
        reset();
        const timer = setTimeout(() => webViewRef.current?.reload(), 100);
        prevSiteKeyRef.current = siteKey;
        prevBaseUrlRef.current = baseUrl;
        return () => clearTimeout(timer);
      }
      return undefined;
    }, [siteKey, baseUrl, reset]);

    // Execute reCAPTCHA
    const executeReCaptcha = useCallback(
      (
        customAction: string,
        resolve: (value: string) => void,
        reject: (reason: Error) => void
      ) => {
        if (hasError) {
          reject(new Error(ERROR_MESSAGES.NETWORK_ERROR));
          return;
        }

        if (!isReady) {
          reject(new Error(ERROR_MESSAGES.NOT_READY));
          return;
        }

        const request: TokenRequest = {
          resolve: (token: string) => {
            if (request.timeoutId) clearTimeout(request.timeoutId);
            resolve(token);
          },
          reject: (error: Error) => {
            if (request.timeoutId) clearTimeout(request.timeoutId);
            reject(error);
          },
          action: customAction,
        };

        // Set timeout
        request.timeoutId = setTimeout(() => {
          if (tokenRequestRef.current === request) {
            tokenRequestRef.current = null;
          }
          try {
            request.reject(new Error(ERROR_MESSAGES.TOKEN_REQUEST_TIMEOUT));
          } catch (e) {
            // Already rejected
          }
          onError?.(ERROR_MESSAGES.TOKEN_REQUEST_TIMEOUT);
        }, tokenRequestTimeout);

        tokenRequestRef.current = request;

        // Inject JavaScript
        const escapedAction = customAction.replace(/'/g, "\\'");
        const jsCode = `
          (function() {
            try {
              if (window.grecaptcha && window.grecaptcha.execute) {
                window.grecaptcha.execute('${siteKey}', { action: '${escapedAction}' })
                  .then(function(token) {
                    if (token && typeof token === 'string' && token.length > 0) {
                      window.ReactNativeWebView.postMessage(
                        JSON.stringify({ type: 'VERIFY', token: token })
                      );
                    } else {
                      window.ReactNativeWebView.postMessage(
                        JSON.stringify({ type: 'ERROR', error: 'Invalid token received' })
                      );
                    }
                  })
                  .catch(function(error) {
                    window.ReactNativeWebView.postMessage(
                      JSON.stringify({ type: 'ERROR', error: error.message || 'reCAPTCHA execution failed' })
                    );
                  });
              } else {
                window.ReactNativeWebView.postMessage(
                  JSON.stringify({ type: 'ERROR', error: 'reCAPTCHA not ready' })
                );
              }
            } catch (e) {
              window.ReactNativeWebView.postMessage(
                JSON.stringify({ type: 'ERROR', error: 'JavaScript execution error: ' + (e.message || 'Unknown') })
              );
            }
          })();
          true;
        `;

        webViewRef.current?.injectJavaScript(jsCode);
      },
      [isReady, hasError, siteKey, tokenRequestTimeout, onError]
    );

    // Process pending requests when ready
    useEffect(() => {
      if (isReady && pendingRequests.current.length > 0) {
        const requests = [...pendingRequests.current];
        pendingRequests.current = [];
        requests.forEach((request) => {
          executeReCaptcha(request.action, request.resolve, request.reject);
        });
      }
    }, [isReady, executeReCaptcha]);

    // Expose methods
    useImperativeHandle(
      ref,
      () => ({
        getToken: (customAction = action) => {
          return new Promise<string>((resolve, reject) => {
            // If there's an error (e.g., LOAD_ERROR when offline), reject immediately
            if (hasError) {
              reject(new Error(ERROR_MESSAGES.NETWORK_ERROR));
              return;
            }

            if (!isReady) {
              const request: TokenRequest = {
                resolve,
                reject,
                action: customAction,
              };

              request.timeoutId = setTimeout(() => {
                const index = pendingRequests.current.indexOf(request);
                if (index !== -1) {
                  pendingRequests.current.splice(index, 1);
                  request.reject(new Error(ERROR_MESSAGES.INITIALIZATION_TIMEOUT));
                }
              }, initializationTimeout);

              pendingRequests.current.push(request);
              return;
            }

            executeReCaptcha(customAction, resolve, reject);
          });
        },
        isReady: () => isReady && !hasError,
        reset: () => {
          return reset();
        },
      }),
      [action, isReady, hasError, initializationTimeout, executeReCaptcha, reset]
    );

    // HTML content
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <script>
            var testMode = ${testMode};
            var scriptLoadTimeout;
            var checkInterval;
            var scriptStartTime = Date.now();
            var maxLoadTime = 3000; // 3 seconds max for script to load
            var loadErrorSent = false;
            
            function sendMessage(type, data) {
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: type, ...data }));
              }
            }

            function sendLoadError(reason) {
              if (loadErrorSent) return; // Prevent duplicate errors
              loadErrorSent = true;
              
              if (scriptLoadTimeout) clearTimeout(scriptLoadTimeout);
              if (checkInterval) clearInterval(checkInterval);
              if (testMode) {
                sendMessage('DEBUG', { message: '[WebView] ' + reason });
              }
              sendMessage('LOAD_ERROR', { error: 'Failed to load reCAPTCHA script. Please check your internet connection.' });
            }

            function initializeRecaptcha() {
              if (window.grecaptcha && window.grecaptcha.ready) {
                if (testMode) {
                  sendMessage('DEBUG', { message: '[WebView] Calling grecaptcha.ready...' });
                }
                try {
                  // Set a timeout for grecaptcha.ready callback
                  var readyTimeout = setTimeout(function() {
                    if (!loadErrorSent) {
                      sendLoadError('grecaptcha.ready callback timeout');
                    }
                  }, 5000);
                  
                  window.grecaptcha.ready(function() {
                    clearTimeout(readyTimeout);
                    
                    // Verify that execute function exists (means it's actually ready, not just cached)
                    if (window.grecaptcha && window.grecaptcha.execute) {
                      if (scriptLoadTimeout) clearTimeout(scriptLoadTimeout);
                      if (checkInterval) clearInterval(checkInterval);
                      if (testMode) {
                        sendMessage('DEBUG', { message: '[WebView] reCAPTCHA ready callback fired, sending READY message' });
                      }
                      sendMessage('READY', {});
                    } else {
                      // grecaptcha exists but execute doesn't - might be cached/incomplete
                      if (testMode) {
                        sendMessage('DEBUG', { message: '[WebView] grecaptcha.ready fired but execute not available, might be network issue' });
                      }
                      sendLoadError('reCAPTCHA loaded but not fully initialized');
                    }
                  });
                } catch (e) {
                  if (testMode) {
                    sendMessage('DEBUG', { message: '[WebView] Error in grecaptcha.ready: ' + (e.message || 'Unknown') });
                  }
                  sendLoadError('reCAPTCHA initialization failed: ' + (e.message || 'Unknown'));
                }
              }
            }

            // Aggressive periodic check to detect if script never loads
            checkInterval = setInterval(function() {
              if (loadErrorSent) {
                clearInterval(checkInterval);
                return;
              }
              
              var elapsed = Date.now() - scriptStartTime;
              
              // Check if script is still loading after max time
              if (elapsed >= maxLoadTime) {
                if (typeof window.grecaptcha === 'undefined') {
                  sendLoadError('reCAPTCHA script failed to load after ' + (elapsed / 1000) + ' seconds');
                } else if (window.grecaptcha && !window.grecaptcha.execute) {
                  // Try to initialize, and if it fails, send error
                  if (!window.grecaptcha.ready) {
                    sendLoadError('reCAPTCHA script incomplete - ready function missing');
                  } else {
                    // Try initialize once more
                    initializeRecaptcha();
                    // If still not ready after additional 2 seconds, send error
                    setTimeout(function() {
                      if (!loadErrorSent && (!window.grecaptcha || !window.grecaptcha.execute)) {
                        sendLoadError('reCAPTCHA script incomplete after ' + ((elapsed + 2000) / 1000) + ' seconds');
                      }
                    }, 2000);
                  }
                }
              }
            }, 200); // Check every 200ms for faster detection

            // Set a timeout as fallback (longer than periodic checks)
            scriptLoadTimeout = setTimeout(function() {
              if (!loadErrorSent) {
                if (typeof window.grecaptcha === 'undefined') {
                  sendLoadError('reCAPTCHA script load timeout after 10 seconds');
                } else if (window.grecaptcha && !window.grecaptcha.execute) {
                  sendLoadError('reCAPTCHA script incomplete after 10 seconds');
                }
              }
            }, 10000); // 10 seconds timeout for script load

            // Listen for all error events
            window.addEventListener('error', function(e) {
              if (loadErrorSent) return;
              
              // Check if it's a script loading error
              if (e.target && e.target.tagName === 'SCRIPT') {
                sendLoadError('Script load error: ' + (e.message || 'Unknown'));
              } else if (e.filename && e.filename.includes('recaptcha')) {
                // Error related to reCAPTCHA script
                sendLoadError('reCAPTCHA script error: ' + (e.message || 'Unknown'));
              }
            }, true);

            // Listen for unhandled promise rejections (might catch network errors)
            window.addEventListener('unhandledrejection', function(e) {
              if (loadErrorSent) return;
              
              var reason = e.reason || '';
              if (reason.toString && (reason.toString().includes('network') || reason.toString().includes('fetch') || reason.toString().includes('Failed to fetch'))) {
                sendLoadError('Network error detected: ' + reason);
              }
            });

            // Make functions globally available for script onload/onerror handlers
            window.sendMessage = sendMessage;
            window.initializeRecaptcha = initializeRecaptcha;
            window.sendLoadError = sendLoadError;
          </script>
          <script 
            src="https://www.google.com/recaptcha/api.js?render=${siteKey}"
            onerror="if(window.sendLoadError){window.sendLoadError('Script onerror fired - failed to load reCAPTCHA');}else if(window.sendMessage){if(window.scriptLoadTimeout)clearTimeout(window.scriptLoadTimeout);if(window.testMode){window.sendMessage('DEBUG',{message:'[WebView] Script onerror fired - failed to load reCAPTCHA'});}window.sendMessage('LOAD_ERROR', { error: 'Failed to load reCAPTCHA script' });}"
            onload="(function(){if(window.scriptLoadTimeout){clearTimeout(window.scriptLoadTimeout);window.scriptLoadTimeout=null;}if(window.checkInterval){clearInterval(window.checkInterval);window.checkInterval=null;}if(window.testMode){window.sendMessage('DEBUG',{message:'[WebView] Script onload fired - reCAPTCHA script loaded'});}if(window.initializeRecaptcha){setTimeout(function(){window.initializeRecaptcha();},100);}})()"
          ></script>
        </head>
        <body style="background-color: transparent; margin: 0; padding: 0;">
          <div id="recaptcha-container"></div>
        </body>
      </html>
    `;

    // Handle messages
    const handleMessage = useCallback(
      (event: WebViewMessageEvent) => {
        try {
          const data: ReCaptchaMessage = JSON.parse(event.nativeEvent.data);
          log('[ReCaptcha] Message:', data);

          switch (data.type) {
            case 'READY':
              log('[ReCaptcha] ✅ READY message received');
              setIsReady(true);
              setHasError(false);
              if (initializationTimeoutRef.current) {
                clearTimeout(initializationTimeoutRef.current);
                initializationTimeoutRef.current = null;
              }
              onLoadEnd?.();
              break;

            case 'VERIFY':
              if (data.token && data.token.length > 0) {
                onVerify?.(data.token);
                if (tokenRequestRef.current) {
                  if (tokenRequestRef.current.timeoutId) {
                    clearTimeout(tokenRequestRef.current.timeoutId);
                  }
                  tokenRequestRef.current.resolve(data.token);
                  tokenRequestRef.current = null;
                }
              } else {
                handleError(ERROR_MESSAGES.INVALID_TOKEN);
              }
              break;

            case 'DEBUG':
              log('[ReCaptcha] Debug:', data.message);
              break;

            case 'ERROR':
            case 'LOAD_ERROR':
              handleError(
                data.type === 'LOAD_ERROR'
                  ? ERROR_MESSAGES.NETWORK_ERROR
                  : data.error || ERROR_MESSAGES.NETWORK_ERROR
              );
              break;
          }
        } catch (error) {
          log('[ReCaptcha] Failed to parse message:', error);
          handleError('Failed to parse reCAPTCHA response');
        }
      },
      [onVerify, onLoadEnd, handleError, log]
    );

    // Handle WebView errors
    const handleWebViewError = useCallback(() => {
      handleError(ERROR_MESSAGES.NETWORK_ERROR);
    }, [handleError]);

    const handleLoadStart = useCallback(() => {
      setIsReady(false);
      setHasError(false);
      pendingRequests.current = [];
      onLoadStart?.();
    }, [onLoadStart]);

    const handleLoadEnd = useCallback(() => {
      // Resolve reset promise if waiting
      if (resetPromiseRef.current) {
        resetPromiseRef.current.resolve();
        resetPromiseRef.current = null;
      }
      
      // Inject check script to verify reCAPTCHA status and force READY if needed
      if (!isReady && !hasError) {
        setTimeout(() => {
          if (!isReady && !hasError && webViewRef.current) {
            const checkScript = `
              (function() {
                if (window.ReactNativeWebView) {
                  if (window.grecaptcha && window.grecaptcha.execute) {
                    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'READY' }));
                  } else if (window.grecaptcha && window.grecaptcha.ready) {
                    try {
                      window.grecaptcha.ready(function() {
                        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'READY' }));
                      });
                    } catch (e) {
                      // Error already handled
                    }
                  }
                }
              })();
              true;
            `;
            webViewRef.current.injectJavaScript(checkScript);
          }
        }, 1000);
      }
      
      onLoadEnd?.();
    }, [onLoadEnd, isReady, hasError]);

    return (
      <WebView
        ref={webViewRef}
        source={{ html: htmlContent.replace(/\s+/g, ' ').trim(), baseUrl }}
        onMessage={handleMessage}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        originWhitelist={['*']}
        style={[styles.webview, style]}
        mixedContentMode="always"
        containerStyle={[styles.container, containerStyle]}
        onError={handleWebViewError}
        onHttpError={handleWebViewError}
        onLoadStart={handleLoadStart}
        onLoadEnd={handleLoadEnd}
        startInLoadingState={false}
        cacheEnabled={false}
        cacheMode="LOAD_NO_CACHE"
      />
    );
  }
);

ReCaptchaV3.displayName = 'ReCaptchaV3';

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
  },
  webview: {
    backgroundColor: 'transparent',
  },
});

export default ReCaptchaV3;
