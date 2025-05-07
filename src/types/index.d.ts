import { ViewStyle } from 'react-native';

export declare interface ReCaptchaProps {
    siteKey: string;
    baseUrl: string;
    action?: string;
    onVerify?: (token: string) => void;
    onError?: (error: string) => void;
    style?: ViewStyle;
    containerStyle?: ViewStyle;
}

export declare interface GoogleRecaptchaRefAttributes {
    getToken: (action?: string) => Promise<string | null>;
}

export declare interface ReCaptchaMessage {
    type: 'VERIFY' | 'ERROR' | 'READY';
    token?: string;
    error?: string;
}

export declare interface WebViewError {
    description: string;
    url?: string;
}

export declare interface WebViewHttpError {
    statusCode: number;
    url?: string;
}