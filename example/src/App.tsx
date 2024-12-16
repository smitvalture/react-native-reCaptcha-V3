import { useRef, useState } from 'react';
import { StyleSheet, View, Button, Text, SafeAreaView } from 'react-native';
import ReCaptcha, { type GoogleRecaptchaRefAttributes } from '@valture/react-native-google-recaptcha-v3';

export default function App() {
  const recaptchaRef = useRef<GoogleRecaptchaRefAttributes>(null);
  const [token, setToken] = useState<string>('');
  const [error, setError] = useState<string>('');

  const handleVerify = async (action: string = 'submit') => {
    try {
      const captchaToken = await recaptchaRef.current?.getToken(action);
      setToken(captchaToken || '');
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
      setToken('');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ReCaptcha
        ref={recaptchaRef}
        siteKey="your_site_key_here"
        baseUrl="https://your-domain.com"
        onVerify={setToken}
        onError={setError}
      />
      <View style={styles.buttonContainer}>
        <Button title="Verify Login" onPress={() => handleVerify('login')} />
        <Button title="Verify Purchase" onPress={() => handleVerify('purchase')} />
      </View>
      {token ? (
        <Text style={styles.successText}>Token: {token.substring(0, 20)}...</Text>
      ) : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonContainer: {
    marginVertical: 20,
    gap: 10,
  },
  successText: {
    color: 'green',
    marginTop: 10,
  },
  errorText: {
    color: 'red',
    marginTop: 10,
  },
});