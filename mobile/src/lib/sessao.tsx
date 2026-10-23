import NetInfo from '@react-native-community/netinfo';
import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { Alert, AppState } from 'react-native';
import { limparTudo, listarPendentes } from './banco-local';
import { carregarPerfil, sincronizar } from './sincronizar';
import { supabase } from './supabase';
import type { Perfil } from './tipos';

type EstadoSessao = {
  carregando: boolean;
  sessao: Session | null;
  perfil: Perfil | null;
  erroPerfil: string | null;
  sincronizando: boolean;
  // Avança sempre que um envio termina, para as telas recarregarem a lista.
  versao: number;
  sincronizarAgora: () => Promise<void>;
  sair: () => Promise<void>;
};

const Contexto = createContext<EstadoSessao | null>(null);

export function ProvedorSessao({ children }: { children: ReactNode }) {
  const [carregando, setCarregando] = useState(true);
  const [sessao, setSessao] = useState<Session | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [erroPerfil, setErroPerfil] = useState<string | null>(null);
  const [sincronizando, setSincronizando] = useState(false);
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSessao(data.session);
      if (!data.session) setCarregando(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_evento, novaSessao) => setSessao(novaSessao));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!sessao) {
      setPerfil(null);
      return;
    }
    setErroPerfil(null);
    carregarPerfil(sessao.user.id)
      .then(setPerfil)
      .catch((e: Error) => setErroPerfil(e.message))
      .finally(() => setCarregando(false));
  }, [sessao?.user.id]);

  const sincronizarAgora = useCallback(async () => {
    if (!perfil) return;
    setSincronizando(true);
    try {
      await sincronizar(perfil);
    } finally {
      setSincronizando(false);
      setVersao((v) => v + 1);
    }
  }, [perfil]);

  // Envia o que estiver pendente ao abrir o app, ao voltar para ele e quando a internet volta.
  useEffect(() => {
    if (!perfil) return;
    sincronizarAgora();
    const rede = NetInfo.addEventListener((estado) => {
      if (estado.isConnected && estado.isInternetReachable !== false) sincronizarAgora();
    });
    const app = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') sincronizarAgora();
    });
    return () => {
      rede();
      app.remove();
    };
  }, [perfil, sincronizarAgora]);

  const sair = useCallback(async () => {
    const encerrar = async () => {
      await supabase.auth.signOut();
      await limparTudo();
    };
    // Sair apaga o que está no celular: avisa antes se ainda há despesa sem enviar.
    const pendentes = (await listarPendentes()).length;
    if (pendentes === 0) return encerrar();
    Alert.alert(
      'Despesas não enviadas',
      `Você tem ${pendentes} despesa(s) que ainda não foram enviadas. Se sair agora, elas serão apagadas deste celular.`,
      [
        { text: 'Ficar', style: 'cancel' },
        { text: 'Sair e apagar', style: 'destructive', onPress: () => void encerrar() },
      ],
    );
  }, []);

  return (
    <Contexto.Provider
      value={{ carregando, sessao, perfil, erroPerfil, sincronizando, versao, sincronizarAgora, sair }}
    >
      {children}
    </Contexto.Provider>
  );
}

export function useSessao(): EstadoSessao {
  const valor = useContext(Contexto);
  if (!valor) throw new Error('useSessao precisa estar dentro de ProvedorSessao');
  return valor;
}
