import { Redirect } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { cores, estilos } from '../lib/estilos';
import { emailDoLogin } from '../lib/login';
import { useSessao } from '../lib/sessao';
import { supabase } from '../lib/supabase';

export default function Login() {
  const { sessao } = useSessao();
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [entrando, setEntrando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  if (sessao) return <Redirect href="/" />;

  async function entrar() {
    setErro(null);
    setEntrando(true);
    const { error } = await supabase.auth.signInWithPassword({ email: emailDoLogin(usuario), password: senha });
    setEntrando(false);
    if (error) setErro('CPF ou senha incorretos, ou sem internet.');
  }

  return (
    <KeyboardAvoidingView
      style={[estilos.tela, styles.centro]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.caixa}>
        <Text style={styles.titulo}>Despesas da Frota</Text>
        <Text style={styles.subtitulo}>Entre com o seu CPF e a senha que o gestor passou.</Text>
        <View>
          <Text style={estilos.rotulo}>CPF</Text>
          <TextInput
            style={estilos.campo}
            value={usuario}
            onChangeText={setUsuario}
            autoCapitalize="none"
            autoComplete="username"
            keyboardType="number-pad"
            placeholder="Só os números"
          />
        </View>
        <View>
          <Text style={estilos.rotulo}>Senha</Text>
          <TextInput
            style={estilos.campo}
            value={senha}
            onChangeText={setSenha}
            secureTextEntry
            autoComplete="password"
            onSubmitEditing={entrar}
          />
        </View>
        {erro && <Text style={estilos.erro}>{erro}</Text>}
        <Pressable style={estilos.botao} onPress={entrar} disabled={entrando || !usuario || !senha}>
          {entrando ? <ActivityIndicator color="#FFFFFF" /> : <Text style={estilos.botaoTexto}>Entrar</Text>}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  centro: { justifyContent: 'center', padding: 24 },
  caixa: { gap: 16 },
  titulo: { fontSize: 26, fontWeight: '700', color: cores.primaria },
  subtitulo: { fontSize: 15, color: cores.suave },
});
