/* eslint-env jest */
import { act } from '@testing-library/react-native';
import type { WebViewMessageEvent } from 'react-native-webview';

interface MockWebView {
  props: {
    onLoadStart?: () => void;
    onLoadEnd?: () => void;
    onMessage?: (event: WebViewMessageEvent) => void;
    onError?: () => void;
    onHttpError?: () => void;
  };
  injectJavaScript: jest.Mock;
  reload: jest.Mock;
}

declare const __getMockWebView: () => MockWebView | null;

export function getWebView(): MockWebView {
  const wv = __getMockWebView();
  if (!wv) throw new Error('No mock WebView rendered yet');
  return wv;
}

/** Simulate WebView dispatching a message back to the component */
export function sendWebViewMessage(payload: object): void {
  const wv = getWebView();
  act(() => {
    wv.props.onMessage?.({
      nativeEvent: { data: JSON.stringify(payload) },
    } as unknown as WebViewMessageEvent);
  });
}

/** Drive the component through a successful load → ready cycle */
export function loadAndReady(): void {
  const wv = getWebView();
  act(() => {
    wv.props.onLoadStart?.();
  });
  act(() => {
    wv.props.onLoadEnd?.();
  });
  sendWebViewMessage({ type: 'READY' });
}

/** Trigger the WebView's native onError */
export function fireWebViewError(): void {
  const wv = getWebView();
  act(() => {
    wv.props.onError?.();
  });
}

/** A valid 40-char reCAPTCHA-shaped site key for tests */
export const TEST_SITE_KEY = '6LcExampleExampleExampleExampleExample00';
export const TEST_BASE_URL = 'https://example.com';
