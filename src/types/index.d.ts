export declare interface ReCaptchaProps {
    siteKey: string;
    baseUrl: string;
    action?: string;
    onVerify?: (token: string) => void;
    onError?: (error: string) => void;
    style?: any;
    containerStyle?: any;
}

export declare interface GoogleRecaptchaRefAttributes {
    getToken: (action?: string) => Promise<string | null>;
}

export declare interface ReCaptchaMessage {
    type: 'VERIFY' | 'ERROR' | 'READY';
    token?: string;
    error?: string;
}