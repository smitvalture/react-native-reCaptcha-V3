import { forwardRef, useImperativeHandle, useRef, useState, useEffect, useCallback } from 'react';
import { StyleSheet, ViewStyle, View, Text, ActivityIndicator, Animated, TouchableOpacity } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

// Type definitions
export interface ReCaptchaError {
  code: 'NETWORK_ERROR' | 'TIMEOUT' | 'INVALID_SITE_KEY' | 'WEBVIEW_ERROR' | 'VALIDATION_ERROR' | 'BROWSER_ERROR';
  message: string;
  details?: any;
}

export interface ReCaptchaProps {
  siteKey: string;
  baseUrl: string;
  action?: string;
  onVerify?: (token: string) => void;
  onError?: (error: string) => void;
  style?: ViewStyle;
  containerStyle?: ViewStyle;
  debug?: boolean;
  timeout?: number;
  retryAttempts?: number;
  onLoad?: () => void;
  onTokenGenerated?: (token: string) => void;
  autoExecute?: boolean;
  executeInterval?: number;
  // UI Features
  showLoadingIndicator?: boolean;
  loadingText?: string;
  showErrorDisplay?: boolean;
  errorPosition?: 'top' | 'bottom' | 'inline';
  dismissibleErrors?: boolean;
  showStatusIndicator?: boolean;
  statusPosition?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  animations?: {
    fadeIn?: boolean;
    pulse?: boolean;
  };
  animationDuration?: number;
  // reCAPTCHA Badge Control
  hideBadge?: boolean;
  badgePosition?: 'bottom-right' | 'bottom-left' | 'inline';
  badgeTheme?: 'light' | 'dark';
}

export interface GoogleRecaptchaRefAttributes {
  getToken: (action?: string) => Promise<string | null>;
  isReady: () => boolean;
  getError: () => ReCaptchaError | null;
  clearError: () => void;
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

export type ReCaptchaStatus = 'idle' | 'loading' | 'ready' | 'error' | 'success';

// Utility functions
export const validateSiteKey = (siteKey: string): boolean => {
  return /^[a-zA-Z0-9_-]{40}$/.test(siteKey);
};

export const validateBaseUrl = (baseUrl: string): boolean => {
  try {
    new URL(baseUrl);
    return true;
  } catch {
    return false;
  }
};

export const getErrorMessage = (error: any): string => {
  if (error.message?.includes('browser-error')) {
    return 'Invalid baseUrl or domain not registered in reCAPTCHA console';
  }
  if (error.message?.includes('invalid-input-response')) {
    return 'Token expired or already used. Generate a new token.';
  }
  if (error.message?.includes('network')) {
    return 'Network error. Check your internet connection.';
  }
  return error.message || 'reCAPTCHA verification failed';
};

// Badge control utilities
export const getBadgeStyles = (hideBadge: boolean, position: string, theme: string): string => {
  if (hideBadge) {
    return `
      .grecaptcha-badge {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
        position: absolute !important;
        left: -9999px !important;
        top: -9999px !important;
      }
    `;
  }

  let styles = '';
  
  if (position !== 'bottom-right') {
    styles += `
      .grecaptcha-badge {
        ${position === 'bottom-left' ? 'right: auto !important; left: 4px !important;' : ''}
        ${position === 'inline' ? 'position: relative !important; right: auto !important; left: auto !important; bottom: auto !important; top: auto !important; margin: 4px !important;' : ''}
      }
    `;
  }

  if (theme === 'dark') {
    styles += `
      .grecaptcha-badge {
        filter: invert(1) hue-rotate(180deg) !important;
      }
    `;
  }

  return styles;
};

const ReCaptchaV3 = forwardRef<GoogleRecaptchaRefAttributes, ReCaptchaProps>(
  ({ 
    siteKey = 'dummy-site-key', 
    baseUrl = 'https://example.com', 
    action = 'submit', 
    onVerify, 
    onError, 
    containerStyle, 
    style,
    debug = false,
    timeout = 30000,
    retryAttempts = 3,
    onLoad,
    onTokenGenerated,
    autoExecute = false,
    executeInterval,
    // UI Features
    showLoadingIndicator = false,
    loadingText = 'Verifying security...',
    showErrorDisplay = false,
    errorPosition = 'bottom',
    dismissibleErrors = true,
    showStatusIndicator = false,
    statusPosition = 'top-right',
    animations = { fadeIn: true, pulse: true },
    animationDuration = 300,
    // reCAPTCHA Badge Control
    hideBadge = false,
    badgePosition = 'bottom-right',
    badgeTheme = 'light'
  }, ref) => {
    // Input validation
    useEffect(() => {
      if (debug) {
        if (!validateSiteKey(siteKey)) {
          console.warn('ReCaptchaV3: Invalid siteKey format. Expected 40-character alphanumeric string.');
        }
        if (!validateBaseUrl(baseUrl)) {
          console.warn('ReCaptchaV3: Invalid baseUrl format. Expected valid URL with protocol.');
        }
      }
    }, [siteKey, baseUrl, debug]);

    const webViewRef = useRef<WebView>(null);
    const [isReady, setIsReady] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<ReCaptchaError | null>(null);
    const [status, setStatus] = useState<ReCaptchaStatus>('idle');
    const [showError, setShowError] = useState(false);
    
    // Animation values
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const pulseAnim = useRef(new Animated.Value(1)).current;
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

    // Token cache for performance
    const tokenCache = useRef<Map<string, { token: string; timestamp: number }>>(new Map());
    const CACHE_DURATION = 120000; // 2 minutes

    const handleError = useCallback((errorMessage: string, errorCode: ReCaptchaError['code'] = 'WEBVIEW_ERROR', details?: any) => {
      const enhancedError: ReCaptchaError = {
        code: errorCode,
        message: getErrorMessage({ message: errorMessage }),
        details
      };
      
      setError(enhancedError);
      setShowError(true);
      setStatus('error');
      
      if (debug) {
        console.error('ReCaptchaV3 Error:', enhancedError);
      }
      
      onError?.(errorMessage);
      if (tokenPromiseRef.current) {
        tokenPromiseRef.current.reject(new Error(errorMessage));
        tokenPromiseRef.current = null;
      }
    }, [onError, debug]);

    const clearError = useCallback(() => {
      setError(null);
      setShowError(false);
      setStatus('idle');
    }, []);

    // Animation effects
    useEffect(() => {
      if (animations?.fadeIn) {
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: animationDuration,
          useNativeDriver: true,
        }).start();
      }
      return undefined;
    }, [fadeAnim, animations?.fadeIn, animationDuration]);

    useEffect(() => {
      if (animations?.pulse && isLoading) {
        const pulseAnimation = Animated.loop(
          Animated.sequence([
            Animated.timing(pulseAnim, {
              toValue: 1.1,
              duration: 800,
              useNativeDriver: true,
            }),
            Animated.timing(pulseAnim, {
              toValue: 1,
              duration: 800,
              useNativeDriver: true,
            }),
          ])
        );
        pulseAnimation.start();
        return () => pulseAnimation.stop();
      }
      return undefined;
    }, [pulseAnim, animations?.pulse, isLoading]);


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

    // Auto-execute functionality
    useEffect(() => {
      if (autoExecute && isReady && !isLoading) {
        const executeToken = async () => {
          try {
            const token = await new Promise<string | null>((resolve, reject) => {
              executeReCaptcha(action, resolve, reject);
            });
            if (debug && token) {
              console.log('ReCaptchaV3: Auto-executed token generated');
            }
          } catch (error) {
            if (debug) {
              console.warn('ReCaptchaV3: Auto-execute failed', error);
            }
          }
        };

        executeToken();

        if (executeInterval && executeInterval > 0) {
          const intervalId = setInterval(executeToken, executeInterval);
          return () => clearInterval(intervalId);
        }
      }
      return undefined;
    }, [autoExecute, isReady, action, executeInterval, debug, isLoading]);

    // Small utility to trim excessive whitespace in template strings so we keep
    // readable source while sending compact payloads to the WebView
    const minifyString = (input: string) => input.replace(/\s+/g, ' ').trim();

    // Function to execute reCAPTCHA and get a token
    const executeReCaptcha = (customAction: string, resolve: (value: string | null) => void, reject: (reason?: any) => void) => {
      if (!isReady) {
        pendingRequests.current.push({ action: customAction, resolve, reject });
        return;
      }

      // Check cache first
      const cacheKey = `${siteKey}-${customAction}`;
      const cached = tokenCache.current.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        if (debug) {
          console.log('ReCaptchaV3: Using cached token');
        }
        resolve(cached.token);
        return;
      }
      
      setIsLoading(true);
      setStatus('loading');
      clearError();
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
          const timeoutId = setTimeout(() => {
            handleError('Token generation timeout', 'TIMEOUT');
            reject(new Error('Token generation timeout'));
          }, timeout);

          const wrappedResolve = (token: string | null) => {
            clearTimeout(timeoutId);
            setIsLoading(false);
            if (token) {
              // Cache the token
              const cacheKey = `${siteKey}-${customAction}`;
              tokenCache.current.set(cacheKey, { token, timestamp: Date.now() });
              onTokenGenerated?.(token);
            }
            resolve(token);
          };

          const wrappedReject = (error: any, retryAttempt: number = 1) => {
            clearTimeout(timeoutId);
            setIsLoading(false);
            if (retryAttempt < retryAttempts) {
              if (debug) {
                console.log(`ReCaptchaV3: Retrying token generation (attempt ${retryAttempt + 1}/${retryAttempts})`);
              }
              setTimeout(() => {
                executeReCaptcha(customAction, wrappedResolve, (err) => wrappedReject(err, retryAttempt + 1));
              }, 1000 * retryAttempt); // Exponential backoff
            } else {
              reject(error);
            }
          };

          executeReCaptcha(customAction, wrappedResolve, wrappedReject);
        });
      },
      
      isReady: () => {
        return isReady;
      },

      getError: () => {
        return error;
      },

      clearError: () => {
        clearError();
      }
    }), [siteKey, action, isReady, error, timeout, retryAttempts, debug, onTokenGenerated]);

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <style>
            /* reCAPTCHA Badge Control */
            ${hideBadge ? `
              .grecaptcha-badge {
                display: none !important;
                visibility: hidden !important;
                opacity: 0 !important;
                pointer-events: none !important;
                position: absolute !important;
                left: -9999px !important;
                top: -9999px !important;
              }
            ` : ''}
            
            /* Custom Badge Positioning */
            ${!hideBadge && badgePosition !== 'bottom-right' ? `
              .grecaptcha-badge {
                ${badgePosition === 'bottom-left' ? 'right: auto !important; left: 4px !important;' : ''}
                ${badgePosition === 'inline' ? 'position: relative !important; right: auto !important; left: auto !important; bottom: auto !important; top: auto !important; margin: 4px !important;' : ''}
              }
            ` : ''}
            
            /* Badge Theme */
            ${badgeTheme === 'dark' ? `
              .grecaptcha-badge {
                filter: invert(1) hue-rotate(180deg) !important;
              }
            ` : ''}
          </style>
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

            // Function to hide reCAPTCHA badge after load
            function hideRecaptchaBadge() {
              if (${hideBadge}) {
                const badge = document.querySelector('.grecaptcha-badge');
                if (badge) {
                  badge.style.display = 'none';
                  badge.style.visibility = 'hidden';
                  badge.style.opacity = '0';
                  badge.style.pointerEvents = 'none';
                }
              }
            }

            // Kick off readiness checks
            setTimeout(checkRecaptchaReady, 500);
            
            // Hide badge after a short delay to ensure it's loaded
            setTimeout(hideRecaptchaBadge, 1000);
          </script>
        </head>
        <body style="background-color: transparent;">
          <div id="recaptcha-container"></div>
          <script src="https://www.google.com/recaptcha/api.js?render=${siteKey}&theme=${badgeTheme}" async defer></script>
          <script>
            document.addEventListener('DOMContentLoaded', function() {
              checkRecaptchaReady();
              hideRecaptchaBadge();
            });
            
            // Additional badge hiding on window load
            window.addEventListener('load', function() {
              hideRecaptchaBadge();
            });
          </script>
        </body>
      </html>
    `;

    const handleMessage = useCallback((event: WebViewMessageEvent) => {
      try {
        const data: ReCaptchaMessage = JSON.parse(event.nativeEvent.data);
        
        if (data.type === 'READY') {
          setIsReady(true);
          setStatus('ready');
          setShowError(false);
          onLoad?.();
          if (debug) {
            console.log('ReCaptchaV3: reCAPTCHA is ready');
          }
        } else if (data.type === 'VERIFY' && data.token) {
          setStatus('success');
          onVerify?.(data.token);
          if (tokenPromiseRef.current) {
            tokenPromiseRef.current.resolve(data.token);
            tokenPromiseRef.current = null;
          }
        } else if (data.type === 'ERROR') {
          const errorCode = data.error?.includes('browser-error') ? 'BROWSER_ERROR' : 'WEBVIEW_ERROR';
          handleError(data.error || 'reCAPTCHA error', errorCode);
        }
      } catch (error) {
        handleError('Failed to parse reCAPTCHA response', 'WEBVIEW_ERROR', error);
      }
    }, [onVerify, handleError, onLoad, debug]);

    const handleWebViewError = (syntheticEvent: { nativeEvent: WebViewError }) => {
      const { nativeEvent } = syntheticEvent;
      handleError(`WebView error: ${nativeEvent.description}`, 'WEBVIEW_ERROR', nativeEvent);
    };

    const handleWebViewHttpError = (syntheticEvent: { nativeEvent: WebViewHttpError }) => {
      const { nativeEvent } = syntheticEvent;
      const errorCode = nativeEvent.statusCode >= 500 ? 'NETWORK_ERROR' : 'WEBVIEW_ERROR';
      handleError(`WebView HTTP error: ${nativeEvent.statusCode}`, errorCode, nativeEvent);
    };

    // UI Components
    const LoadingIndicator = () => {
      if (!showLoadingIndicator || !isLoading) return null;
      
      return (
        <Animated.View 
          style={[
            styles.loadingContainer,
            { 
              opacity: fadeAnim,
              transform: [{ scale: pulseAnim }]
            }
          ]}
        >
          <ActivityIndicator size="small" color="#4285f4" />
          <Text style={styles.loadingText}>{loadingText}</Text>
        </Animated.View>
      );
    };

    const ErrorDisplay = () => {
      if (!showErrorDisplay || !showError || !error) return null;
      
      const errorStyle = [
        styles.errorContainer,
        styles[`error${errorPosition.charAt(0).toUpperCase() + errorPosition.slice(1)}` as keyof typeof styles]
      ] as ViewStyle[];

      return (
        <Animated.View 
          style={[
            errorStyle,
            { opacity: fadeAnim }
          ]}
        >
          <View style={styles.errorContent}>
            <Text style={styles.errorText}>{error.message}</Text>
            {dismissibleErrors && (
              <TouchableOpacity onPress={() => setShowError(false)} style={styles.dismissButton}>
                <Text style={styles.dismissText}>×</Text>
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>
      );
    };

    const StatusIndicator = () => {
      if (!showStatusIndicator) return null;
      
      const getStatusColor = () => {
        switch (status) {
          case 'ready': return '#4caf50';
          case 'loading': return '#ff9800';
          case 'error': return '#f44336';
          case 'success': return '#4caf50';
          default: return '#9e9e9e';
        }
      };

      const getStatusText = () => {
        switch (status) {
          case 'ready': return 'Ready';
          case 'loading': return 'Loading...';
          case 'error': return 'Error';
          case 'success': return 'Success';
          default: return 'Idle';
        }
      };

      const statusStyle = [
        styles.statusContainer,
        styles[`status${statusPosition.replace('-', '')}` as keyof typeof styles]
      ] as ViewStyle[];

      return (
        <Animated.View 
          style={[
            statusStyle,
            { opacity: fadeAnim }
          ]}
        >
          <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
          <Text style={styles.statusText}>{getStatusText()}</Text>
        </Animated.View>
      );
    };


    return (
      <Animated.View 
        style={[
          styles.wrapper,
          { opacity: fadeAnim }
        ]}
      >
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
        
        <LoadingIndicator />
        <ErrorDisplay />
        <StatusIndicator />
      </Animated.View>
    );
  }
);

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
  },
  container: {
    justifyContent: 'center',
  },
  webview: {
    backgroundColor: 'transparent',
  },
  // Loading Indicator
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingText: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  // Error Display
  errorContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 1001,
  },
  errorTop: {
    top: 0,
  },
  errorBottom: {
    bottom: 0,
  },
  errorInline: {
    position: 'relative',
    marginTop: 8,
  },
  errorContent: {
    backgroundColor: '#ffebee',
    borderColor: '#f44336',
    borderWidth: 1,
    borderRadius: 4,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  errorText: {
    color: '#c62828',
    fontSize: 14,
    flex: 1,
  },
  dismissButton: {
    marginLeft: 8,
    padding: 4,
  },
  dismissText: {
    color: '#c62828',
    fontSize: 18,
    fontWeight: 'bold',
  },
  // Status Indicator
  statusContainer: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 1002,
  },
  statusTopright: {
    top: 8,
    right: 8,
  },
  statusTopleft: {
    top: 8,
    left: 8,
  },
  statusBottomright: {
    bottom: 8,
    right: 8,
  },
  statusBottomleft: {
    bottom: 8,
    left: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    color: '#333',
    fontWeight: '500',
  },
});

export default ReCaptchaV3;

// Custom hook for easier usage
export const useReCaptcha = () => {
  const recaptchaRef = useRef<GoogleRecaptchaRefAttributes>(null);

  const getToken = useCallback(async (action?: string) => {
    if (!recaptchaRef.current) {
      throw new Error('ReCaptchaV3: Component not mounted');
    }
    return recaptchaRef.current.getToken(action);
  }, []);

  const clearError = useCallback(() => {
    if (recaptchaRef.current) {
      recaptchaRef.current.clearError();
    }
  }, []);

  const getCurrentError = useCallback(() => {
    return recaptchaRef.current?.getError() || null;
  }, []);

  return {
    recaptchaRef,
    getToken,
    clearError,
    getCurrentError
  };
};