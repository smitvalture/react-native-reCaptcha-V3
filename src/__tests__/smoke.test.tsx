import { render } from '@testing-library/react-native';
import ReCaptcha from '../index';

describe('ReCaptcha (smoke)', () => {
  it('renders without crashing', () => {
    const { UNSAFE_root } = render(
      <ReCaptcha
        siteKey="abcdefghij0123456789ABCDEFGHIJ0123456789"
        baseUrl="https://example.com"
      />
    );
    expect(UNSAFE_root).toBeTruthy();
  });

  it('exposes the mocked WebView to tests', () => {
    render(
      <ReCaptcha
        siteKey="abcdefghij0123456789ABCDEFGHIJ0123456789"
        baseUrl="https://example.com"
      />
    );
    const webview = (global as unknown as { __getMockWebView: () => unknown }).__getMockWebView();
    expect(webview).toBeTruthy();
  });
});
