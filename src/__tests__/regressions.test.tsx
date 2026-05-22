/**
 * Regression tests for bugs fixed in the v2.4.0 lifecycle pass.
 * Each describe block names the bug and links to the fix's expected behavior.
 */
import { createRef } from 'react';
import { act, render } from '@testing-library/react-native';
import ReCaptcha, {
  type GoogleRecaptchaRefAttributes,
} from '../index';
import {
  TEST_BASE_URL,
  TEST_SITE_KEY,
  getWebView,
  loadAndReady,
  sendWebViewMessage,
} from './helpers';

describe('Bug #1: onLoadEnd fires exactly once per load cycle', () => {
  it('fires once even after the READY message arrives', () => {
    const onLoadEnd = jest.fn();

    render(
      <ReCaptcha
        siteKey={TEST_SITE_KEY}
        baseUrl={TEST_BASE_URL}
        onLoadEnd={onLoadEnd}
      />
    );

    loadAndReady();

    expect(onLoadEnd).toHaveBeenCalledTimes(1);
  });

  it('fires again after a reset+reload', async () => {
    const onLoadEnd = jest.fn();
    const ref = createRef<GoogleRecaptchaRefAttributes>();

    render(
      <ReCaptcha
        ref={ref}
        siteKey={TEST_SITE_KEY}
        baseUrl={TEST_BASE_URL}
        onLoadEnd={onLoadEnd}
      />
    );

    loadAndReady();
    expect(onLoadEnd).toHaveBeenCalledTimes(1);

    let resetPromise!: Promise<void>;
    act(() => {
      resetPromise = ref.current!.reset();
    });
    loadAndReady(); // simulate reload completing
    await resetPromise;

    expect(onLoadEnd).toHaveBeenCalledTimes(2);
  });
});

describe('Bug #2: concurrent reset() calls do not leak promises', () => {
  it('resolves all concurrent reset() promises', async () => {
    const ref = createRef<GoogleRecaptchaRefAttributes>();

    render(
      <ReCaptcha ref={ref} siteKey={TEST_SITE_KEY} baseUrl={TEST_BASE_URL} />
    );

    loadAndReady();

    let resolved1 = false;
    let resolved2 = false;
    let p1!: Promise<unknown>;
    let p2!: Promise<unknown>;
    act(() => {
      p1 = ref.current!.reset().then(() => {
        resolved1 = true;
      });
      p2 = ref.current!.reset().then(() => {
        resolved2 = true;
      });
    });

    act(() => {
      getWebView().props.onLoadEnd?.();
    });

    await Promise.all([p1, p2]);
    expect(resolved1).toBe(true);
    expect(resolved2).toBe(true);
  });
});

describe('Bug #3: force-READY uses current state, not closure-captured stale', () => {
  // We can't directly observe the closure issue, but we can verify that
  // once READY arrives, subsequent timer-based injections do not flip
  // state back or fire onLoadEnd again.
  it('does not fire onLoadEnd again when force-READY runs after real READY', () => {
    jest.useFakeTimers();
    try {
      const onLoadEnd = jest.fn();

      render(
        <ReCaptcha
          siteKey={TEST_SITE_KEY}
          baseUrl={TEST_BASE_URL}
          onLoadEnd={onLoadEnd}
        />
      );

      act(() => {
        getWebView().props.onLoadStart?.();
      });
      act(() => {
        getWebView().props.onLoadEnd?.();
      });
      sendWebViewMessage({ type: 'READY' });
      expect(onLoadEnd).toHaveBeenCalledTimes(1);

      // Advance past the 1s force-READY timer; it would re-inject and
      // potentially flip things if state were stale.
      act(() => {
        jest.advanceTimersByTime(2000);
      });

      // onLoadEnd should NOT have been called again
      expect(onLoadEnd).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('Bug #4: reset() rejects in-flight and pending token requests', () => {
  it('rejects a pending (pre-ready) getToken with RESET', async () => {
    const ref = createRef<GoogleRecaptchaRefAttributes>();

    render(
      <ReCaptcha ref={ref} siteKey={TEST_SITE_KEY} baseUrl={TEST_BASE_URL} />
    );

    const tokenPromise = ref.current!.getToken('login');
    // Pre-attach a handler so the synchronous rejection during reset()
    // doesn't fire as an unhandled rejection before our expect() runs.
    tokenPromise.catch(() => undefined);

    await act(async () => {
      void ref.current!.reset();
      // Flush microtasks so React processes the state updates from reset()
      // (setIsReady/setHasError) inside this act() block.
      await Promise.resolve();
    });

    await expect(tokenPromise).rejects.toThrow(/reset/i);
  });

  it('rejects an in-flight getToken with RESET', async () => {
    const ref = createRef<GoogleRecaptchaRefAttributes>();

    render(
      <ReCaptcha ref={ref} siteKey={TEST_SITE_KEY} baseUrl={TEST_BASE_URL} />
    );

    loadAndReady();

    const tokenPromise = ref.current!.getToken('login');
    tokenPromise.catch(() => undefined);

    await act(async () => {
      void ref.current!.reset();
      // Flush microtasks so React processes the state updates from reset()
      // (setIsReady/setHasError) inside this act() block.
      await Promise.resolve();
    });

    await expect(tokenPromise).rejects.toThrow(/reset/i);
  });
});

describe('Bug #5: superseded requests get SUPERSEDED, not TOKEN_REQUEST_TIMEOUT', () => {
  it('rejects the older request with SUPERSEDED when a newer one starts', async () => {
    const ref = createRef<GoogleRecaptchaRefAttributes>();

    render(
      <ReCaptcha ref={ref} siteKey={TEST_SITE_KEY} baseUrl={TEST_BASE_URL} />
    );

    loadAndReady();

    const first = ref.current!.getToken('login');
    const second = ref.current!.getToken('signup');

    // Resolve only the second one to ensure first is rejected
    sendWebViewMessage({ type: 'VERIFY', token: 'second-token' });

    await expect(first).rejects.toThrow(/superseded/i);
    await expect(second).resolves.toBe('second-token');
  });
});
