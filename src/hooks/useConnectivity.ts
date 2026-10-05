import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';

/** `true` enquanto não há conexão com a internet. */
export function useIsOffline(): boolean {
  const [offline, setOffline] = useState(false);

  useEffect(
    () =>
      NetInfo.addEventListener((state) => {
        // `isInternetReachable` é null enquanto ainda está sendo medido: não acusamos offline nesse caso.
        setOffline(state.isConnected === false || state.isInternetReachable === false);
      }),
    [],
  );

  return offline;
}
