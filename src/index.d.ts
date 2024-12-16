declare interface ReCaptchaProps {
    siteKey: string;
    baseUrl: string;
    action?: string;
    onVerify?: (token: string) => void;
    onError?: (error: string) => void;
    style?: any;
    containerStyle?: any;
}

declare interface GoogleRecaptchaRefAttributes {
    getToken: (action?: string) => Promise<string | null>;
}

declare interface ReCaptchaMessage {
    type: 'VERIFY' | 'ERROR' | 'READY';
    token?: string;
    error?: string;
}