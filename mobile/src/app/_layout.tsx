import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { cores } from '../lib/estilos';
import { ProvedorSessao } from '../lib/sessao';

export default function Layout() {
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
        <Stack.Screen name="nova" options={{ title: 'Nova despesa' }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
      </Stack>
    </ProvedorSessao>
  );
}
