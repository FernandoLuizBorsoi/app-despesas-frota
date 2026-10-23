import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, Text } from 'react-native';
import { cores } from '../lib/estilos';
import { ProvedorSessao } from '../lib/sessao';

// Seta própria, sempre visível, que volta para a lista mesmo sem tela anterior.
function comSetaDeVoltar(router: ReturnType<typeof useRouter>) {
  return {
    headerBackVisible: false,
    headerLeft: () => (
      <Pressable
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        hitSlop={12}
        style={{ marginRight: 16 }}
      >
        <Text style={{ color: '#FFFFFF', fontSize: 17 }}>← Voltar</Text>
      </Pressable>
    ),
  };
}

export default function Layout() {
  const router = useRouter();
  return (
    <ProvedorSessao>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: cores.primaria },
          headerTintColor: '#FFFFFF',
          contentStyle: { backgroundColor: cores.fundo },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Minhas despesas' }} />
        <Stack.Screen name="nova" options={{ title: 'Nova despesa', ...comSetaDeVoltar(router) }} />
        <Stack.Screen name="despesa" options={{ title: 'Despesa', ...comSetaDeVoltar(router) }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
      </Stack>
    </ProvedorSessao>
  );
}
