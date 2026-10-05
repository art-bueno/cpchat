import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useIsOffline } from '../hooks/useConnectivity';
import { colors, spacing } from '../theme';
import type { NotificationRegistrationStatus } from '../types/notification';

/** Faixa exibida enquanto o aparelho estiver sem internet. */
export function OfflineBanner() {
  const offline = useIsOffline();
  if (!offline) return null;
  return (
    <View style={[styles.banner, styles.offline]} accessibilityRole="alert">
      <Text style={styles.offlineText}>Sem conexão. Mensagens novas aparecerão quando a internet voltar.</Text>
    </View>
  );
}

type NotificationBannerProps = { status: NotificationRegistrationStatus; onRetry: () => void };

/** Informa permissão negada, aparelho sem token ou falha no registro de push. */
export function NotificationBanner({ status, onRetry }: NotificationBannerProps) {
  if (status.state === 'denied') {
    return (
      <View style={[styles.banner, styles.warning]}>
        <Text style={styles.warningText}>Notificações desativadas. Você não receberá avisos de novas mensagens.</Text>
        <Pressable onPress={() => void Linking.openSettings()} accessibilityRole="button">
          <Text style={styles.action}>Abrir configurações</Text>
        </Pressable>
      </View>
    );
  }
  if (status.state === 'unavailable' || status.state === 'error') {
    return (
      <View style={[styles.banner, styles.warning]}>
        <Text style={styles.warningText}>{status.state === 'unavailable' ? status.reason : status.message}</Text>
        {status.state === 'error' ? (
          <Pressable onPress={onRetry} accessibilityRole="button">
            <Text style={styles.action}>Tentar novamente</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }
  return null;
}

const styles = StyleSheet.create({
  banner: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, gap: spacing.xs },
  offline: { backgroundColor: colors.text },
  offlineText: { color: '#FFFFFF', fontSize: 13 },
  warning: { backgroundColor: colors.warningSoft },
  warningText: { color: colors.warning, fontSize: 13 },
  action: { color: colors.warning, fontWeight: '700', fontSize: 13 },
});
