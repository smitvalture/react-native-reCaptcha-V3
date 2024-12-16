import { render, fireEvent, waitFor } from '@testing-library/react-native';
import ReCaptchaV3 from '..';

describe('ReCaptcha', () => {
  const mockSiteKey = 'test_site_key';
  const mockBaseUrl = 'https://test.com';
  const mockToken = 'test_token';
  
  it('renders correctly', () => {
    const { getByTestId } = render(
      <ReCaptchaV3
        siteKey={mockSiteKey}
        baseUrl={mockBaseUrl}
        action='submit'
      />
    );
    
    expect(getByTestId('recaptcha-webview')).toBeTruthy();
  });

  it('calls onVerify when token is received', async () => {
    const onVerify = jest.fn();
    const { getByTestId } = render(
      <ReCaptchaV3
        siteKey={mockSiteKey}
        baseUrl={mockBaseUrl}
        onVerify={onVerify}
      />
    );

    const webview = getByTestId('recaptcha-webview');
    fireEvent(webview, 'message', {
      nativeEvent: {
        data: JSON.stringify({ type: 'VERIFY', token: mockToken }),
      },
    });

    await waitFor(() => {
      expect(onVerify).toHaveBeenCalledWith(mockToken);
    });
  });

  it('calls onError when error occurs', async () => {
    const onError = jest.fn();
    const { getByTestId } = render(
      <ReCaptchaV3
        siteKey={mockSiteKey}
        baseUrl={mockBaseUrl}
        onError={onError}
      />
    );

    const webview = getByTestId('recaptcha-webview');
    fireEvent(webview, 'message', {
      nativeEvent: {
        data: JSON.stringify({ type: 'ERROR', error: 'Test error' }),
      },
    });

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith('Test error');
    });
  });
});