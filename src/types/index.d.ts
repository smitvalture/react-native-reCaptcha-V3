import { ViewStyle } from 'react-native';

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