/* eslint-env jest */
// Controllable mock for react-native-webview. The mock factory keeps its
// own state object; tests access it via global.__getMockWebView() to drive
// lifecycle events (onLoadStart, onLoadEnd, onMessage) and inspect
// injectJavaScript / reload calls.
jest.mock('react-native-webview', () => {
  const React = require('react');
  const { View } = require('react-native');

  const state = { instance: null };

  const WebView = React.forwardRef(function MockWebView(props, ref) {
    const inner = React.useRef({
      injectJavaScript: jest.fn(),
      reload: jest.fn(),
    });

    React.useImperativeHandle(ref, () => inner.current);

    state.instance = {
      props,
      injectJavaScript: inner.current.injectJavaScript,
      reload: inner.current.reload,
    };

    return React.createElement(View, { testID: 'mocked-webview' });
  });

  WebView.displayName = 'MockWebView';

  // Expose the live state so tests can grab the latest instance.
  global.__getMockWebView = () => state.instance;
  global.__resetMockWebView = () => {
    state.instance = null;
  };

  return { __esModule: true, WebView, default: WebView };
});
