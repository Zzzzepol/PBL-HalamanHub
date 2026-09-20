import { useEffect, useRef } from 'react';

const CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID;

// Renders Google's own button (styled by Google, not us — that's
// intentional, it's what keeps users' trust in the "Sign in with Google"
// pattern). onCredential receives the raw ID token string; the caller
// decides what to do with it (send to /api/shop/auth/google).
const GoogleSignInButton = ({ onCredential, onError }) => {
  const divRef = useRef(null);

  useEffect(() => {
    if (!window.google || !CLIENT_ID) return;

    window.google.accounts.id.initialize({
      client_id: CLIENT_ID,
      callback: (response) => {
        if (response?.credential) onCredential(response.credential);
        else onError?.('No credential received from Google.');
      },
    });

    if (divRef.current) {
      window.google.accounts.id.renderButton(divRef.current, {
        theme: 'outline',
        size: 'large',
        width: 320,
        text: 'continue_with',
      });
    }
  }, [onCredential, onError]);

  if (!CLIENT_ID) return null; // fails quietly if the env var isn't set yet

  return <div ref={divRef} className="flex justify-center" />;
};

export default GoogleSignInButton;