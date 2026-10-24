import { Redirect } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { cacheLogo } from '../lib/banco-local';
import { cores, estilos } from '../lib/estilos';
import { emailDoLogin } from '../lib/login';
import { useSessao } from '../lib/sessao';
import { supabase } from '../lib/supabase';

// CPF e senha guardados no cofre do próprio celular, quando o motorista pede para lembrar.
const CHAVE_LOGIN = 'login-salvo';

export default function Login() {
  const { sessao } = useSessao();
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [entrando, setEntrando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [lembrar, setLembrar] = useState(true);
  // Logo da empresa guardada no último acesso (no primeiro acesso ainda não há).
  const [logo, setLogo] = useState<string | null>(null);

  useEffect(() => {
    cacheLogo.ler().then(setLogo).catch(() => undefined);
  }, []);

  useEffect(() => {
    SecureStore.getItemAsync(CHAVE_LOGIN)
      .then((salvo) => {
        if (!salvo) return;
        const dados = JSON.parse(salvo) as { usuario: string; senha: string };
        setUsuario(dados.usuario);
        setSenha(dados.senha);
      })
      .catch(() => undefined);
  }, []);

  if (sessao) return <Redirect href="/" />;

  async function entrar() {
    setErro(null);
    setEntrando(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: emailDoLogin(usuario),
      password: senha,
    });
    setEntrando(false);
    if (error) {
      setErro('CPF ou senha incorretos, ou sem internet.');
      return;
    }
    if (lembrar)
      await SecureStore.setItemAsync(CHAVE_LOGIN, JSON.stringify({ usuario, senha })).catch(() => undefined);
    else await SecureStore.deleteItemAsync(CHAVE_LOGIN).catch(() => undefined);
  }

  return (
    <KeyboardAvoidingView
      style={[estilos.tela, styles.centro]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.caixa}>
        {logo && <Image source={{ uri: logo }} style={styles.logo} resizeMode="contain" />}
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
        <Pressable style={styles.lembrar} onPress={() => setLembrar((l) => !l)} hitSlop={8}>
          <View style={[styles.caixinha, lembrar && styles.caixinhaMarcada]}>
            {lembrar && <Text style={styles.marca}>✓</Text>}
          </View>
          <Text style={styles.lembrarTexto}>Lembrar CPF e senha neste celular</Text>
        </Pressable>
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
  logo: { width: '100%', height: 90 },
  titulo: { fontSize: 26, fontWeight: '700', color: cores.primaria },
  subtitulo: { fontSize: 15, color: cores.suave },
  lembrar: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  caixinha: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: cores.primaria,
    alignItems: 'center',
    justifyContent: 'center',
  },
  caixinhaMarcada: { backgroundColor: cores.primaria },
  marca: { color: '#FFFFFF', fontWeight: '700' },
  lembrarTexto: { fontSize: 15, color: cores.texto },
});
