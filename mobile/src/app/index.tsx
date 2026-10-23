import { Redirect, Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { cacheCategorias, cacheVeiculos, listarDespesas } from '../lib/banco-local';
import { cores, estilos } from '../lib/estilos';
import { dataTextoDeIso, formatarReais } from '../lib/formato';
import { useSessao } from '../lib/sessao';
import type { DespesaLocal } from '../lib/tipos';

export default function MinhasDespesas() {
  const router = useRouter();
  const { carregando, sessao, perfil, erroPerfil, sincronizando, versao, sincronizarAgora, sair } = useSessao();
  const [despesas, setDespesas] = useState<DespesaLocal[]>([]);
  const [nomes, setNomes] = useState<{ categorias: Map<string, string>; placas: Map<string, string> }>({
    categorias: new Map(),
    placas: new Map(),
  });

  useFocusEffect(
    useCallback(() => {
      if (!perfil) return;
      Promise.all([listarDespesas(), cacheCategorias.ler(), cacheVeiculos.ler()]).then(
        ([lista, categorias, veiculos]) => {
          setDespesas(lista);
          setNomes({
            categorias: new Map((categorias ?? []).map((c) => [c.id, c.nome])),
            placas: new Map((veiculos ?? []).map((v) => [v.id, v.placa])),
          });
        },
      );
    }, [perfil, versao]),
  );

  if (carregando) {
    return (
      <View style={[estilos.tela, styles.centro]}>
        <ActivityIndicator size="large" color={cores.primaria} />
      </View>
    );
  }
  if (!sessao) return <Redirect href="/login" />;
  if (erroPerfil || !perfil) {
    return (
      <View style={[estilos.tela, styles.centro, { gap: 16 }]}>
        <Text style={estilos.erro}>{erroPerfil ?? 'Não foi possível carregar seu cadastro.'}</Text>
        <Pressable style={estilos.botaoSecundario} onPress={sair}>
          <Text style={estilos.botaoSecundarioTexto}>Sair</Text>
        </Pressable>
      </View>
    );
  }

  const pendentes = despesas.filter((d) => !d.enviada).length;

  return (
    <View style={estilos.tela}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable onPress={sair} hitSlop={12}>
              <Text style={styles.sair}>Sair</Text>
            </Pressable>
          ),
        }}
      />
      <View style={styles.cabecalho}>
        <Text style={styles.ola}>Olá, {perfil.nome.split(' ')[0]}</Text>
        <Text style={[styles.status, pendentes > 0 && { color: cores.aviso }]}>
          {sincronizando
            ? 'Enviando...'
            : pendentes > 0
              ? `${pendentes} despesa(s) aguardando internet para enviar`
              : 'Tudo enviado'}
        </Text>
      </View>
      <FlatList
        data={despesas}
        keyExtractor={(d) => d.id}
        contentContainerStyle={[estilos.conteudo, { paddingBottom: 100 }]}
        refreshControl={<RefreshControl refreshing={sincronizando} onRefresh={sincronizarAgora} />}
        ListEmptyComponent={
          <Text style={styles.vazio}>Nenhuma despesa lançada ainda. Toque em "Nova despesa".</Text>
        }
        renderItem={({ item }) => (
          <View style={styles.item}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemTitulo}>{nomes.categorias.get(item.categoria_id) ?? 'Despesa'}</Text>
              <Text style={styles.itemDetalhe}>
                {dataTextoDeIso(item.data)} · {nomes.placas.get(item.veiculo_id) ?? ''}
                {item.km_odometro != null ? ` · ${item.km_odometro.toLocaleString('pt-BR')} km` : ''}
                {` · ${item.fotos.length} foto(s)`}
              </Text>
              {!item.enviada && (
                <Text style={styles.itemPendente}>
                  {item.erro_envio ? 'Erro ao enviar, tentando de novo' : 'Aguardando envio'}
                </Text>
              )}
            </View>
            <Text style={styles.itemValor}>{formatarReais(item.valor_centavos)}</Text>
          </View>
        )}
      />
      <Pressable style={[estilos.botao, styles.flutuante]} onPress={() => router.push('/nova')}>
        <Text style={estilos.botaoTexto}>+ Nova despesa</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  centro: { justifyContent: 'center', alignItems: 'center', padding: 24 },
  sair: { color: '#FFFFFF', fontSize: 15 },
  cabecalho: { paddingHorizontal: 16, paddingTop: 16 },
  ola: { fontSize: 20, fontWeight: '700', color: cores.texto },
  status: { fontSize: 14, color: cores.sucesso, marginTop: 4 },
  vazio: { color: cores.suave, textAlign: 'center', marginTop: 40 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: cores.cartao,
    borderRadius: 8,
    padding: 14,
    gap: 12,
  },
  itemTitulo: { fontSize: 16, fontWeight: '600', color: cores.texto },
  itemDetalhe: { fontSize: 13, color: cores.suave, marginTop: 2 },
  itemPendente: { fontSize: 13, color: cores.aviso, marginTop: 4 },
  itemValor: { fontSize: 16, fontWeight: '700', color: cores.texto },
  flutuante: { position: 'absolute', left: 16, right: 16, bottom: 24 },
});
