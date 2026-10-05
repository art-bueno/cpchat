import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StyleSheet, View } from 'react-native';
import { EmptyState } from '../components/EmptyState';
import { Loading } from '../components/Loading';
import { NotificationProvider } from '../contexts/NotificationContext';
import { useAuth } from '../hooks/useAuth';
import { ChatScreen } from '../screens/ChatScreen';
import { ConversationsScreen } from '../screens/ConversationsScreen';
import { GroupFormScreen } from '../screens/GroupFormScreen';
import { GroupMembersScreen } from '../screens/GroupMembersScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { UsersScreen } from '../screens/UsersScreen';
import { colors } from '../theme';
import type { AppStackParamList, AuthStackParamList } from '../types/navigation';
import { navigationRef } from './navigationRef';

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const AppStack = createNativeStackNavigator<AppStackParamList>();

const screenOptions = { headerTintColor: colors.primary, contentStyle: { backgroundColor: colors.background } } as const;

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={screenOptions}>
      <AuthStack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
      <AuthStack.Screen name="Register" component={RegisterScreen} options={{ title: 'Criar conta' }} />
    </AuthStack.Navigator>
  );
}

function AppNavigator() {
  return (
    <AppStack.Navigator screenOptions={screenOptions}>
      <AppStack.Screen name="Conversations" component={ConversationsScreen} options={{ title: 'Conversas' }} />
      <AppStack.Screen name="Users" component={UsersScreen} options={{ title: 'Usuários' }} initialParams={{ mode: 'direct' }} />
      <AppStack.Screen name="GroupForm" component={GroupFormScreen} options={{ title: 'Grupo' }} />
      <AppStack.Screen name="Chat" component={ChatScreen} options={{ title: '' }} />
      <AppStack.Screen name="GroupMembers" component={GroupMembersScreen} options={{ title: 'Integrantes' }} />
      <AppStack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Perfil' }} />
    </AppStack.Navigator>
  );
}

/**
 * Troca de árvore conforme a sessão: ao sair, toda a área autenticada é desmontada,
 * o que remove automaticamente os listeners do Firestore/RTDB e do push.
 */
export function RootNavigator() {
  const { state, logout } = useAuth();

  if (state.status === 'loading' || state.status === 'loadingProfile') return <Loading message="Carregando…" />;

  if (state.status === 'profileMissing') {
    return (
      <View style={styles.fill}>
        <EmptyState
          title="Perfil não encontrado"
          description={state.error ?? 'Não foi possível carregar seu cadastro. Entre novamente ou crie uma nova conta.'}
          actionLabel="Sair"
          onAction={() => void logout()}
        />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef}>
      {state.status === 'signedIn' ? (
        <NotificationProvider uid={state.user.uid}>
          <AppNavigator />
        </NotificationProvider>
      ) : (
        <AuthNavigator />
      )}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1, backgroundColor: colors.background } });
