import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

// Public defaults
const DEFAULT_ACTION = 'submit';
const INITIALIZATION_TIMEOUT = 30000; // 30 seconds
const TOKEN_REQUEST_TIMEOUT = 15000; // 15 seconds

// Internal tuning
const NETWORK_DETECTION_TIMEOUT_MS = 8000;
const FORCE_READY_DELAY_MS = 1000;
const SCRIPT_MAX_LOAD_TIME_MS = 3000;
const SCRIPT_LOAD_TIMEOUT_MS = 10000;
const SCRIPT_READY_TIMEOUT_MS = 5000;
const SCRIPT_CHECK_INTERVAL_MS = 200;

// Site keys are alphanumeric with - and _; reCAPTCHA keys are typically 40 chars
const SITE_KEY_PATTERN = /^[A-Za-z0-9_-]{20,80}$/;

// Error messages
const ERROR_MESSAGES = {
  NETWORK_ERROR:
    'Network connection required. Please check your internet connection.',
  INITIALIZATION_TIMEOUT:
    'reCAPTCHA initialization timed out. Please check your internet connection.',
  TOKEN_REQUEST_TIMEOUT: 'Token request timed out. Please try again.',
  NOT_READY: 'reCAPTCHA is not ready. Please wait and try again.',
  INVALID_TOKEN: 'Invalid token received from reCAPTCHA.',
  SUPERSEDED: 'Token request superseded by a newer request.',
  RESET: 'Token request cancelled: reCAPTCHA was reset.',
  ABORTED: 'Token request was aborted.',
  INVALID_SITE_KEY:
    'Invalid siteKey. Expected a Google reCAPTCHA v3 site key (alphanumeric, dashes, underscores).',
} as const;

// Type definitions
export interface GetTokenOptions {
  /** Optional AbortSignal to cancel an in-flight token request. */
  signal?: AbortSignal;
}

export interface ReCaptchaProps {
  siteKey: string;
  baseUrl: string;
  action?: string;
  onVerify?: (token: string, action: string) => void;
  onError?: (error: string) => void;
  onLoadStart?: () => void;
  onLoadEnd?: () => void;
  style?: ViewStyle;
  containerStyle?: ViewStyle;
  initializationTimeout?: number;
  tokenRequestTimeout?: number;
  testMode?: boolean;
  /**
   * Use reCAPTCHA Enterprise (grecaptcha.enterprise.execute) instead of the
   * standard v3 endpoint. Defaults to false.
   */
  useEnterprise?: boolean;
  /**
   * Origins the WebView is allowed to navigate to. Defaults to a narrow set
   * (Google reCAPTCHA + baseUrl) for safer browsing. Pass `['*']` to opt out.
   */
  originWhitelist?: readonly string[];
  /**
   * Android-only WebView setting controlling mixed (HTTP-in-HTTPS) content.
   * Defaults to 'never' for safer behavior on a security-focused component.
   */
  mixedContentMode?: 'never' | 'always' | 'compatibility';
}

export interface GoogleRecaptchaRefAttributes {
  getToken: (action?: string, options?: GetTokenOptions) => Promise<string>;
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
  timeoutId?: ReturnType<typeof setTimeout>;
  abortHandler?: () => void;
  signal?: AbortSignal;
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
      useEnterprise = false,
      originWhitelist,
      mixedContentMode = 'never',
    },
    ref
  ) => {
    const webViewRef = useRef<WebView>(null);
    const [isReady, setIsReady] = useState(false);
    const [hasError, setHasError] = useState(false);

    const tokenRequestRef = useRef<TokenRequest | null>(null);
    const initializationTimeoutRef = useRef<ReturnType<
      typeof setTimeout
    > | null>(null);
    const pendingRequests = useRef<Array<TokenRequest>>([]);
    const prevSiteKeyRef = useRef<string | undefined>(undefined);
    const prevBaseUrlRef = useRef<string | undefined>(undefined);
    const resetResolvers = useRef<Array<() => void>>([]);
    const hasFiredLoadEndRef = useRef(false);
    const forceReadyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
      null
    );

    // Mirror state into refs so timer callbacks can read the latest value
    // without being captured-stale by their closure (bug fix: force-READY race).
    const isReadyRef = useRef(isReady);
    const hasErrorRef = useRef(hasError);
    useEffect(() => {
      isReadyRef.current = isReady;
    }, [isReady]);
    useEffect(() => {
      hasErrorRef.current = hasError;
    }, [hasError]);

    // Helper for conditional logging
    const log = useCallback(
      (...args: unknown[]) => {
        if (testMode) {
          console.log(...args);
        }
      },
      [testMode]
    );

    // Validate siteKey shape once per change. We don't throw — onError + hasError
    // is the existing error channel, so we surface it that way.
    const siteKeyInvalid = !SITE_KEY_PATTERN.test(siteKey);

    // Detach an AbortSignal listener (no-op if not attached)
    const detachAbortListener = (request: TokenRequest) => {
      if (request.signal && request.abortHandler) {
        request.signal.removeEventListener('abort', request.abortHandler);
      }
    };

    // Safely reject a request once (swallow double-reject)
    const safeReject = (request: TokenRequest, error: Error) => {
      if (request.timeoutId) clearTimeout(request.timeoutId);
      detachAbortListener(request);
      try {
        request.reject(error);
      } catch {
        // already rejected
      }
    };

    // Cleanup timeouts (init + in-flight + queued)
    const cleanup = useCallback(() => {
      if (initializationTimeoutRef.current) {
        clearTimeout(initializationTimeoutRef.current);
        initializationTimeoutRef.current = null;
      }
      if (tokenRequestRef.current?.timeoutId) {
        clearTimeout(tokenRequestRef.current.timeoutId);
      }
      pendingRequests.current.forEach((req) => {
        if (req.timeoutId) clearTimeout(req.timeoutId);
      });
    }, []);

    // Unmount cleanup: clear timers and detach abort listeners so a
    // teardown mid-flight doesn't leak timers or fire late callbacks.
    useEffect(() => {
      return () => {
        if (initializationTimeoutRef.current) {
          clearTimeout(initializationTimeoutRef.current);
          initializationTimeoutRef.current = null;
        }
        if (forceReadyTimerRef.current) {
          clearTimeout(forceReadyTimerRef.current);
          forceReadyTimerRef.current = null;
        }
        if (tokenRequestRef.current) {
          if (tokenRequestRef.current.timeoutId) {
            clearTimeout(tokenRequestRef.current.timeoutId);
          }
          detachAbortListener(tokenRequestRef.current);
          tokenRequestRef.current = null;
        }
        pendingRequests.current.forEach((req) => {
          if (req.timeoutId) clearTimeout(req.timeoutId);
          detachAbortListener(req);
        });
        pendingRequests.current = [];
        resetResolvers.current = [];
      };
    }, []);

    // Reset component - returns Promise that resolves when reset is complete
    const reset = useCallback(() => {
      return new Promise<void>((resolve) => {
        cleanup();
        setIsReady(false);
        setHasError(false);
        hasFiredLoadEndRef.current = false;

        // Reject in-flight requests so callers don't hang until their own
        // timeout fires (bug fix: pending request leak on reset).
        const resetError = new Error(ERROR_MESSAGES.RESET);
        if (tokenRequestRef.current) {
          safeReject(tokenRequestRef.current, resetError);
          tokenRequestRef.current = null;
        }
        const stillPending = pendingRequests.current;
        pendingRequests.current = [];
        stillPending.forEach((req) => safeReject(req, resetError));

        // Queue resolver - all queued resolvers fire on next handleLoadEnd
        // (bug fix: concurrent reset() calls used to leak the first promise).
        resetResolvers.current.push(resolve);

        webViewRef.current?.reload();
      });
    }, [cleanup]);

    // Handle errors
    const handleError = useCallback(
      (error: string) => {
        log('[ReCaptcha] Error:', error);
        onError?.(error);
        setHasError(true);

        if (tokenRequestRef.current) {
          safeReject(tokenRequestRef.current, new Error(error));
          tokenRequestRef.current = null;
        }

        const pending = pendingRequests.current;
        pendingRequests.current = [];
        pending.forEach((request) => safeReject(request, new Error(error)));
      },
      [onError, log]
    );

    // Initialize timeout - also detects if LOAD_ERROR never comes from WebView.
    // Cap detection at NETWORK_DETECTION_TIMEOUT_MS so we fail fast on network
    // issues regardless of the user-supplied initializationTimeout.
    useEffect(() => {
      if (siteKeyInvalid) {
        handleError(ERROR_MESSAGES.INVALID_SITE_KEY);
        return;
      }
      if (!isReady && !hasError) {
        initializationTimeoutRef.current = setTimeout(() => {
          if (!isReadyRef.current && !hasErrorRef.current) {
            log(
              '[ReCaptcha] Initialization timeout - no response from WebView, assuming network error'
            );
            handleError(ERROR_MESSAGES.NETWORK_ERROR);
          }
        }, Math.min(initializationTimeout, NETWORK_DETECTION_TIMEOUT_MS));
      }
      return () => {
        if (initializationTimeoutRef.current) {
          clearTimeout(initializationTimeoutRef.current);
          initializationTimeoutRef.current = null;
        }
      };
    }, [
      isReady,
      hasError,
      initializationTimeout,
      handleError,
      log,
      siteKeyInvalid,
    ]);

    // Reset on prop changes (siteKey or baseUrl)
    useEffect(() => {
      const isFirstMount = prevSiteKeyRef.current === undefined;
      if (isFirstMount) {
        prevSiteKeyRef.current = siteKey;
        prevBaseUrlRef.current = baseUrl;
        return;
      }

      if (
        prevSiteKeyRef.current !== siteKey ||
        prevBaseUrlRef.current !== baseUrl
      ) {
        reset();
        prevSiteKeyRef.current = siteKey;
        prevBaseUrlRef.current = baseUrl;
      }
    }, [siteKey, baseUrl, reset]);

    // Execute reCAPTCHA
    const executeReCaptcha = useCallback(
      (
        customAction: string,
        resolve: (value: string) => void,
        reject: (reason: Error) => void,
        signal?: AbortSignal
      ) => {
        if (hasError) {
          reject(new Error(ERROR_MESSAGES.NETWORK_ERROR));
          return;
        }

        if (!isReady) {
          reject(new Error(ERROR_MESSAGES.NOT_READY));
          return;
        }

        if (signal?.aborted) {
          reject(new Error(ERROR_MESSAGES.ABORTED));
          return;
        }

        const request: TokenRequest = {
          resolve: (token: string) => {
            if (request.timeoutId) clearTimeout(request.timeoutId);
            detachAbortListener(request);
            resolve(token);
          },
          reject: (error: Error) => {
            if (request.timeoutId) clearTimeout(request.timeoutId);
            detachAbortListener(request);
            reject(error);
          },
          action: customAction,
          signal,
        };

        request.timeoutId = setTimeout(() => {
          if (tokenRequestRef.current === request) {
            tokenRequestRef.current = null;
          }
          safeReject(request, new Error(ERROR_MESSAGES.TOKEN_REQUEST_TIMEOUT));
          onError?.(ERROR_MESSAGES.TOKEN_REQUEST_TIMEOUT);
        }, tokenRequestTimeout);

        if (signal) {
          request.abortHandler = () => {
            if (tokenRequestRef.current === request) {
              tokenRequestRef.current = null;
            }
            safeReject(request, new Error(ERROR_MESSAGES.ABORTED));
          };
          signal.addEventListener('abort', request.abortHandler);
        }

        // Supersede any in-flight request with a SUPERSEDED error so the caller
        // gets an accurate reason instead of TOKEN_REQUEST_TIMEOUT.
        const previous = tokenRequestRef.current;
        if (previous) {
          safeReject(previous, new Error(ERROR_MESSAGES.SUPERSEDED));
        }
        tokenRequestRef.current = request;

        // Inject JavaScript. siteKey is regex-validated above, but escape
        // action anyway since it's user-supplied.
        const escapedAction = customAction.replace(/'/g, "\\'");
        const execCall = useEnterprise
          ? 'window.grecaptcha.enterprise.execute'
          : 'window.grecaptcha.execute';
        const execCheck = useEnterprise
          ? 'window.grecaptcha && window.grecaptcha.enterprise && window.grecaptcha.enterprise.execute'
          : 'window.grecaptcha && window.grecaptcha.execute';
        const jsCode = `
          (function() {
            try {
              if (${execCheck}) {
                ${execCall}('${siteKey}', { action: '${escapedAction}' })
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
      [isReady, hasError, siteKey, tokenRequestTimeout, onError, useEnterprise]
    );

    // Process pending requests when ready
    useEffect(() => {
      if (isReady && pendingRequests.current.length > 0) {
        const requests = [...pendingRequests.current];
        pendingRequests.current = [];
        requests.forEach((request) => {
          if (request.timeoutId) clearTimeout(request.timeoutId);
          detachAbortListener(request);
          executeReCaptcha(
            request.action,
            request.resolve,
            request.reject,
            request.signal
          );
        });
      }
    }, [isReady, executeReCaptcha]);

    // Expose methods
    useImperativeHandle(
      ref,
      () => ({
        getToken: (customAction = action, options?: GetTokenOptions) => {
          return new Promise<string>((resolve, reject) => {
            const signal = options?.signal;

            if (signal?.aborted) {
              reject(new Error(ERROR_MESSAGES.ABORTED));
              return;
            }

            if (hasError) {
              reject(new Error(ERROR_MESSAGES.NETWORK_ERROR));
              return;
            }

            if (!isReady) {
              const request: TokenRequest = {
                resolve,
                reject,
                action: customAction,
                signal,
              };

              request.timeoutId = setTimeout(() => {
                const index = pendingRequests.current.indexOf(request);
                if (index !== -1) {
                  pendingRequests.current.splice(index, 1);
                  safeReject(
                    request,
                    new Error(ERROR_MESSAGES.INITIALIZATION_TIMEOUT)
                  );
                }
              }, initializationTimeout);

              if (signal) {
                request.abortHandler = () => {
                  const index = pendingRequests.current.indexOf(request);
                  if (index !== -1) {
                    pendingRequests.current.splice(index, 1);
                  }
                  safeReject(request, new Error(ERROR_MESSAGES.ABORTED));
                };
                signal.addEventListener('abort', request.abortHandler);
              }

              pendingRequests.current.push(request);
              return;
            }

            executeReCaptcha(customAction, resolve, reject, signal);
          });
        },
        isReady: () => isReady && !hasError,
        reset: () => reset(),
      }),
      [action, isReady, hasError, initializationTimeout, executeReCaptcha, reset]
    );

    // HTML content - memoized so it isn't rebuilt on every render.
    const htmlContent = useMemo(() => {
      const scriptUrl = useEnterprise
        ? `https://www.google.com/recaptcha/enterprise.js?render=${siteKey}`
        : `https://www.google.com/recaptcha/api.js?render=${siteKey}`;
      const readyCall = useEnterprise
        ? 'window.grecaptcha.enterprise.ready'
        : 'window.grecaptcha.ready';
      const readyCheck = useEnterprise
        ? 'window.grecaptcha && window.grecaptcha.enterprise && window.grecaptcha.enterprise.ready'
        : 'window.grecaptcha && window.grecaptcha.ready';
      const executeCheck = useEnterprise
        ? 'window.grecaptcha && window.grecaptcha.enterprise && window.grecaptcha.enterprise.execute'
        : 'window.grecaptcha && window.grecaptcha.execute';

      return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <script>
            var testMode = ${testMode};
            var scriptLoadTimeout;
            var checkInterval;
            var scriptStartTime = Date.now();
            var maxLoadTime = ${SCRIPT_MAX_LOAD_TIME_MS};
            var loadErrorSent = false;

            function sendMessage(type, data) {
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: type, ...data }));
              }
            }

            function sendLoadError(reason) {
              if (loadErrorSent) return;
              loadErrorSent = true;

              if (scriptLoadTimeout) clearTimeout(scriptLoadTimeout);
              if (checkInterval) clearInterval(checkInterval);
              if (testMode) {
                sendMessage('DEBUG', { message: '[WebView] ' + reason });
              }
              sendMessage('LOAD_ERROR', { error: 'Failed to load reCAPTCHA script. Please check your internet connection.' });
            }

            function initializeRecaptcha() {
              if (${readyCheck}) {
                if (testMode) {
                  sendMessage('DEBUG', { message: '[WebView] Calling grecaptcha.ready...' });
                }
                try {
                  var readyTimeout = setTimeout(function() {
                    if (!loadErrorSent) {
                      sendLoadError('grecaptcha.ready callback timeout');
                    }
                  }, ${SCRIPT_READY_TIMEOUT_MS});

                  ${readyCall}(function() {
                    clearTimeout(readyTimeout);

                    if (${executeCheck}) {
                      if (scriptLoadTimeout) clearTimeout(scriptLoadTimeout);
                      if (checkInterval) clearInterval(checkInterval);
                      if (testMode) {
                        sendMessage('DEBUG', { message: '[WebView] reCAPTCHA ready callback fired, sending READY message' });
                      }
                      sendMessage('READY', {});
                    } else {
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

            checkInterval = setInterval(function() {
              if (loadErrorSent) {
                clearInterval(checkInterval);
                return;
              }

              var elapsed = Date.now() - scriptStartTime;

              if (elapsed >= maxLoadTime) {
                if (typeof window.grecaptcha === 'undefined') {
                  sendLoadError('reCAPTCHA script failed to load after ' + (elapsed / 1000) + ' seconds');
                } else if (!(${executeCheck})) {
                  if (!(${readyCheck})) {
                    sendLoadError('reCAPTCHA script incomplete - ready function missing');
                  } else {
                    initializeRecaptcha();
                    setTimeout(function() {
                      if (!loadErrorSent && !(${executeCheck})) {
                        sendLoadError('reCAPTCHA script incomplete after ' + ((elapsed + 2000) / 1000) + ' seconds');
                      }
                    }, 2000);
                  }
                }
              }
            }, ${SCRIPT_CHECK_INTERVAL_MS});

            scriptLoadTimeout = setTimeout(function() {
              if (!loadErrorSent) {
                if (typeof window.grecaptcha === 'undefined') {
                  sendLoadError('reCAPTCHA script load timeout after ${SCRIPT_LOAD_TIMEOUT_MS / 1000} seconds');
                } else if (!(${executeCheck})) {
                  sendLoadError('reCAPTCHA script incomplete after ${SCRIPT_LOAD_TIMEOUT_MS / 1000} seconds');
                }
              }
            }, ${SCRIPT_LOAD_TIMEOUT_MS});

            window.addEventListener('error', function(e) {
              if (loadErrorSent) return;

              if (e.target && e.target.tagName === 'SCRIPT') {
                sendLoadError('Script load error: ' + (e.message || 'Unknown'));
              } else if (e.filename && e.filename.indexOf('recaptcha') !== -1) {
                sendLoadError('reCAPTCHA script error: ' + (e.message || 'Unknown'));
              }
            }, true);

            window.addEventListener('unhandledrejection', function(e) {
              if (loadErrorSent) return;

              var reason = e.reason || '';
              if (reason.toString && (reason.toString().indexOf('network') !== -1 || reason.toString().indexOf('fetch') !== -1 || reason.toString().indexOf('Failed to fetch') !== -1)) {
                sendLoadError('Network error detected: ' + reason);
              }
            });

            function handleScriptLoad() {
              if (scriptLoadTimeout) { clearTimeout(scriptLoadTimeout); scriptLoadTimeout = null; }
              if (checkInterval) { clearInterval(checkInterval); checkInterval = null; }
              if (testMode) {
                sendMessage('DEBUG', { message: '[WebView] Script onload fired - reCAPTCHA script loaded' });
              }
              setTimeout(initializeRecaptcha, 100);
            }

            function handleScriptError() {
              sendLoadError('Script onerror fired - failed to load reCAPTCHA');
            }

            window.handleScriptLoad = handleScriptLoad;
            window.handleScriptError = handleScriptError;
          </script>
          <script
            src="${scriptUrl}"
            onload="window.handleScriptLoad()"
            onerror="window.handleScriptError()"
          ></script>
        </head>
        <body style="background-color: transparent; margin: 0; padding: 0;">
          <div id="recaptcha-container"></div>
        </body>
      </html>
    `;
    }, [siteKey, testMode, useEnterprise]);

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
              break;

            case 'VERIFY':
              if (data.token && data.token.length > 0) {
                const verifiedAction =
                  tokenRequestRef.current?.action ?? action;
                onVerify?.(data.token, verifiedAction);
                if (tokenRequestRef.current) {
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
      [onVerify, handleError, log, action]
    );

    // Handle WebView errors
    const handleWebViewError = useCallback(() => {
      handleError(ERROR_MESSAGES.NETWORK_ERROR);
    }, [handleError]);

    const handleLoadStart = useCallback(() => {
      setIsReady(false);
      setHasError(false);
      // Intentionally do NOT clear pendingRequests here: requests the user
      // queued between component mount and the WebView's first onLoadStart
      // would be silently lost. reset() explicitly rejects + clears pendings
      // when a controlled teardown is needed.
      hasFiredLoadEndRef.current = false;
      onLoadStart?.();
    }, [onLoadStart]);

    const handleLoadEnd = useCallback(() => {
      // Resolve all queued reset() promises (handles concurrent reset() calls)
      if (resetResolvers.current.length > 0) {
        const resolvers = resetResolvers.current;
        resetResolvers.current = [];
        resolvers.forEach((r) => r());
      }

      // Fire onLoadEnd at most once per load cycle. handleLoadStart clears
      // this flag on the next reload.
      if (!hasFiredLoadEndRef.current) {
        hasFiredLoadEndRef.current = true;
        onLoadEnd?.();
      }

      // Force-READY safety net: if WebView load ended but the JS hasn't sent
      // READY yet, probe state after a short delay. Use refs so we read the
      // latest isReady/hasError, not closure-captured stale values.
      if (forceReadyTimerRef.current) {
        clearTimeout(forceReadyTimerRef.current);
      }
      if (!isReadyRef.current && !hasErrorRef.current) {
        forceReadyTimerRef.current = setTimeout(() => {
          if (
            !isReadyRef.current &&
            !hasErrorRef.current &&
            webViewRef.current
          ) {
            const readyCheck = useEnterprise
              ? 'window.grecaptcha && window.grecaptcha.enterprise && window.grecaptcha.enterprise.execute'
              : 'window.grecaptcha && window.grecaptcha.execute';
            const readyCallChain = useEnterprise
              ? 'window.grecaptcha.enterprise.ready'
              : 'window.grecaptcha.ready';
            const checkScript = `
              (function() {
                if (window.ReactNativeWebView) {
                  if (${readyCheck}) {
                    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'READY' }));
                  } else if (window.grecaptcha && (window.grecaptcha.ready || (window.grecaptcha.enterprise && window.grecaptcha.enterprise.ready))) {
                    try {
                      ${readyCallChain}(function() {
                        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'READY' }));
                      });
                    } catch (e) {}
                  }
                }
              })();
              true;
            `;
            webViewRef.current.injectJavaScript(checkScript);
          }
        }, FORCE_READY_DELAY_MS);
      }
    }, [onLoadEnd, useEnterprise]);

    const effectiveOriginWhitelist = originWhitelist ?? [
      'https://www.google.com',
      'https://www.gstatic.com',
      baseUrl,
    ];

    return (
      <WebView
        ref={webViewRef}
        source={{ html: htmlContent, baseUrl }}
        onMessage={handleMessage}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        originWhitelist={effectiveOriginWhitelist as string[]}
        style={[styles.webview, style]}
        mixedContentMode={mixedContentMode}
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
