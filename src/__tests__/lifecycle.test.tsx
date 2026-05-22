import { createRef } from 'react';
import { act, render } from '@testing-library/react-native';
import ReCaptcha, {
  type GoogleRecaptchaRefAttributes,
} from '../index';
import {
  TEST_BASE_URL,
  TEST_SITE_KEY,
  fireWebViewError,
  getWebView,
  loadAndReady,
  sendWebViewMessage,
} from './helpers';

describe('getToken happy path', () => {
  it('resolves with the token when WebView sends VERIFY', async () => {
    const ref = createRef<GoogleRecaptchaRefAttributes>();
    const onVerify = jest.fn();

    render(
      <ReCaptcha
        ref={ref}
        siteKey={TEST_SITE_KEY}
        baseUrl={TEST_BASE_URL}
        onVerify={onVerify}
      />
    );

    loadAndReady();

    const tokenPromise = ref.current!.getToken('login');
    sendWebViewMessage({ type: 'VERIFY', token: 'abc-token' });

    await expect(tokenPromise).resolves.toBe('abc-token');
    expect(onVerify).toHaveBeenCalledWith('abc-token', 'login');
  });

  it('queues getToken calls made before READY and processes them once ready', async () => {
    const ref = createRef<GoogleRecaptchaRefAttributes>();

    render(
      <ReCaptcha ref={ref} siteKey={TEST_SITE_KEY} baseUrl={TEST_BASE_URL} />
    );

    const tokenPromise = ref.current!.getToken('login');

    loadAndReady();

    sendWebViewMessage({ type: 'VERIFY', token: 'queued-token' });

    await expect(tokenPromise).resolves.toBe('queued-token');
  });

  it('uses the default action when none is passed to getToken', async () => {
    const ref = createRef<GoogleRecaptchaRefAttributes>();
    const onVerify = jest.fn();

    render(
      <ReCaptcha
        ref={ref}
        siteKey={TEST_SITE_KEY}
        baseUrl={TEST_BASE_URL}
        action="default_action"
        onVerify={onVerify}
      />
    );

    loadAndReady();

    const tokenPromise = ref.current!.getToken();
    sendWebViewMessage({ type: 'VERIFY', token: 'tok' });

    await tokenPromise;
    expect(onVerify).toHaveBeenCalledWith('tok', 'default_action');
  });

  it('injects the siteKey and action into the executed script', async () => {
    const ref = createRef<GoogleRecaptchaRefAttributes>();

    render(
      <ReCaptcha ref={ref} siteKey={TEST_SITE_KEY} baseUrl={TEST_BASE_URL} />
    );
    loadAndReady();

    ref.current!.getToken('checkout');

    const wv = getWebView();
    expect(wv.injectJavaScript).toHaveBeenCalled();
    const injected = wv.injectJavaScript.mock.calls.pop()![0] as string;
    expect(injected).toContain(TEST_SITE_KEY);
    expect(injected).toContain("action: 'checkout'");
  });
});

describe('error handling', () => {
  it('rejects getToken with NETWORK_ERROR on WebView LOAD_ERROR', async () => {
    const ref = createRef<GoogleRecaptchaRefAttributes>();
    const onError = jest.fn();

    render(
      <ReCaptcha
        ref={ref}
        siteKey={TEST_SITE_KEY}
        baseUrl={TEST_BASE_URL}
        onError={onError}
      />
    );
    loadAndReady();

    const tokenPromise = ref.current!.getToken('login');
    sendWebViewMessage({ type: 'LOAD_ERROR', error: 'irrelevant' });

    await expect(tokenPromise).rejects.toThrow(/network/i);
    expect(onError).toHaveBeenCalled();
  });

  it('rejects getToken with the WebView ERROR message', async () => {
    const ref = createRef<GoogleRecaptchaRefAttributes>();

    render(
      <ReCaptcha ref={ref} siteKey={TEST_SITE_KEY} baseUrl={TEST_BASE_URL} />
    );
    loadAndReady();

    const tokenPromise = ref.current!.getToken('login');
    sendWebViewMessage({ type: 'ERROR', error: 'invalid-input-response' });

    await expect(tokenPromise).rejects.toThrow('invalid-input-response');
  });

  it('treats WebView native onError as NETWORK_ERROR', async () => {
    const onError = jest.fn();

    render(
      <ReCaptcha
        siteKey={TEST_SITE_KEY}
        baseUrl={TEST_BASE_URL}
        onError={onError}
      />
    );
    loadAndReady();

    fireWebViewError();

    expect(onError).toHaveBeenCalledWith(
      expect.stringMatching(/network connection/i)
    );
  });

  it('rejects an invalid VERIFY (empty token) with INVALID_TOKEN', async () => {
    const ref = createRef<GoogleRecaptchaRefAttributes>();

    render(
      <ReCaptcha ref={ref} siteKey={TEST_SITE_KEY} baseUrl={TEST_BASE_URL} />
    );
    loadAndReady();

    const tokenPromise = ref.current!.getToken('login');
    sendWebViewMessage({ type: 'VERIFY', token: '' });

    await expect(tokenPromise).rejects.toThrow(/invalid token/i);
  });
});

describe('siteKey validation', () => {
  it('surfaces an INVALID_SITE_KEY error for malformed keys', () => {
    const onError = jest.fn();

    render(
      <ReCaptcha
        siteKey={"'; alert('xss'); var x='"}
        baseUrl={TEST_BASE_URL}
        onError={onError}
      />
    );

    expect(onError).toHaveBeenCalledWith(
      expect.stringMatching(/invalid sitekey/i)
    );
  });

  it('accepts a typical reCAPTCHA-shaped key', () => {
    const onError = jest.fn();

    render(
      <ReCaptcha
        siteKey={TEST_SITE_KEY}
        baseUrl={TEST_BASE_URL}
        onError={onError}
      />
    );

    expect(onError).not.toHaveBeenCalled();
  });
});

describe('isReady()', () => {
  it('returns false before READY', () => {
    const ref = createRef<GoogleRecaptchaRefAttributes>();
    render(
      <ReCaptcha ref={ref} siteKey={TEST_SITE_KEY} baseUrl={TEST_BASE_URL} />
    );
    expect(ref.current!.isReady()).toBe(false);
  });

  it('returns true after READY and no error', () => {
    const ref = createRef<GoogleRecaptchaRefAttributes>();
    render(
      <ReCaptcha ref={ref} siteKey={TEST_SITE_KEY} baseUrl={TEST_BASE_URL} />
    );
    loadAndReady();
    expect(ref.current!.isReady()).toBe(true);
  });

  it('returns false after an error, even if previously ready', () => {
    const ref = createRef<GoogleRecaptchaRefAttributes>();
    render(
      <ReCaptcha ref={ref} siteKey={TEST_SITE_KEY} baseUrl={TEST_BASE_URL} />
    );
    loadAndReady();
    sendWebViewMessage({ type: 'LOAD_ERROR' });
    expect(ref.current!.isReady()).toBe(false);
  });
});

describe('prop changes trigger reset', () => {
  it('reloads the WebView when siteKey changes', () => {
    const otherKey = TEST_SITE_KEY.replace('Example00', 'Example99');
    const { rerender } = render(
      <ReCaptcha siteKey={TEST_SITE_KEY} baseUrl={TEST_BASE_URL} />
    );
    loadAndReady();

    const wv = getWebView();
    const reloadCallsBefore = wv.reload.mock.calls.length;

    rerender(<ReCaptcha siteKey={otherKey} baseUrl={TEST_BASE_URL} />);

    expect(wv.reload.mock.calls.length).toBeGreaterThan(reloadCallsBefore);
  });

  it('does not reload on first mount', () => {
    render(<ReCaptcha siteKey={TEST_SITE_KEY} baseUrl={TEST_BASE_URL} />);

    expect(getWebView().reload).not.toHaveBeenCalled();
  });
});

describe('AbortSignal support', () => {
  it('rejects with ABORTED if the signal is already aborted', async () => {
    const ref = createRef<GoogleRecaptchaRefAttributes>();

    render(
      <ReCaptcha ref={ref} siteKey={TEST_SITE_KEY} baseUrl={TEST_BASE_URL} />
    );
    loadAndReady();

    const controller = new AbortController();
    controller.abort();

    await expect(
      ref.current!.getToken('login', { signal: controller.signal })
    ).rejects.toThrow(/aborted/i);
  });

  it('aborts a pending (pre-ready) getToken', async () => {
    const ref = createRef<GoogleRecaptchaRefAttributes>();

    render(
      <ReCaptcha ref={ref} siteKey={TEST_SITE_KEY} baseUrl={TEST_BASE_URL} />
    );

    const controller = new AbortController();
    const tokenPromise = ref.current!.getToken('login', {
      signal: controller.signal,
    });

    act(() => {
      controller.abort();
    });

    await expect(tokenPromise).rejects.toThrow(/aborted/i);
  });

  it('aborts an in-flight getToken', async () => {
    const ref = createRef<GoogleRecaptchaRefAttributes>();

    render(
      <ReCaptcha ref={ref} siteKey={TEST_SITE_KEY} baseUrl={TEST_BASE_URL} />
    );
    loadAndReady();

    const controller = new AbortController();
    const tokenPromise = ref.current!.getToken('login', {
      signal: controller.signal,
    });

    act(() => {
      controller.abort();
    });

    await expect(tokenPromise).rejects.toThrow(/aborted/i);
  });
});

describe('reCAPTCHA Enterprise mode', () => {
  it('uses the enterprise.js script URL when useEnterprise is true', () => {
    render(
      <ReCaptcha
        siteKey={TEST_SITE_KEY}
        baseUrl={TEST_BASE_URL}
        useEnterprise
      />
    );

    const html = getWebView().props as unknown as {
      source: { html: string };
    };
    expect(html.source.html).toContain('enterprise.js');
    expect(html.source.html).not.toContain('api.js?render=');
  });

  it('uses the standard api.js script URL by default', () => {
    render(
      <ReCaptcha siteKey={TEST_SITE_KEY} baseUrl={TEST_BASE_URL} />
    );

    const html = getWebView().props as unknown as {
      source: { html: string };
    };
    expect(html.source.html).toContain('api.js?render=');
    expect(html.source.html).not.toContain('enterprise.js');
  });
});

describe('WebView security defaults', () => {
  it('narrows originWhitelist to Google + baseUrl by default', () => {
    render(<ReCaptcha siteKey={TEST_SITE_KEY} baseUrl={TEST_BASE_URL} />);

    const props = getWebView().props as unknown as {
      originWhitelist: string[];
    };
    expect(props.originWhitelist).toEqual(
      expect.arrayContaining([
        'https://www.google.com',
        'https://www.gstatic.com',
        TEST_BASE_URL,
      ])
    );
    expect(props.originWhitelist).not.toContain('*');
  });

  it('lets consumers opt out with originWhitelist={["*"]}', () => {
    render(
      <ReCaptcha
        siteKey={TEST_SITE_KEY}
        baseUrl={TEST_BASE_URL}
        originWhitelist={['*']}
      />
    );

    const props = getWebView().props as unknown as {
      originWhitelist: string[];
    };
    expect(props.originWhitelist).toEqual(['*']);
  });

  it("defaults mixedContentMode to 'never'", () => {
    render(<ReCaptcha siteKey={TEST_SITE_KEY} baseUrl={TEST_BASE_URL} />);

    const props = getWebView().props as unknown as {
      mixedContentMode: string;
    };
    expect(props.mixedContentMode).toBe('never');
  });
});
