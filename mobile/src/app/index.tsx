import { Redirect, Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { cacheCategorias, cacheVeiculos, listarDespesas, listarPendentes } from '../lib/banco-local';
import { cores, estilos } from '../lib/estilos';
import { dataTextoDeIso, formatarReais, mesAtual, nomeDoMes, somarMeses } from '../lib/formato';
import { useSessao } from '../lib/sessao';
import { supabase } from '../lib/supabase';

// Despesa como aparece na lista: as do servidor e as que ainda estão só no celular.
type ItemLista = {
  id: string;
  data: string;
  valor_centavos: number;
  categoria_id: string;
  veiculo_id: string;
  km_odometro: number | null;
  fotos: number;
  enviada: boolean;
  erro_envio: string | null;
};

type LinhaServidor = {
  id: string;
  data: string;
  valor: number;
  categoria_id: string;
  veiculo_id: string;
  km_odometro: number | null;
  comprovante: { count: number }[];
};

// Junta as despesas do mês que estão no servidor com as do celular. Sem internet, mostra só as do celular.
async function carregarMes(motoristaId: string, mes: string): Promise<ItemLista[]> {
  const locais = (await listarDespesas()).filter((d) => d.data.startsWith(mes));
  const porId = new Map<string, ItemLista>();

  const { data } = await supabase
    .from('despesa')
    .select('id, data, valor, categoria_id, veiculo_id, km_odometro, comprovante(count)')
    .eq('motorista_id', motoristaId)
    .gte('data', `${mes}-01`)
    .lt('data', `${somarMeses(mes, 1)}-01`);
  for (const d of (data ?? []) as LinhaServidor[]) {
    porId.set(d.id, {
      id: d.id,
      data: d.data,
      valor_centavos: Math.round(d.valor * 100),
      categoria_id: d.categoria_id,
      veiculo_id: d.veiculo_id,
      km_odometro: d.km_odometro,
      fotos: d.comprovante[0]?.count ?? 0,
      enviada: true,
      erro_envio: null,
    });
  }
  for (const d of locais) {
    if (d.enviada && porId.has(d.id)) continue;
    porId.set(d.id, { ...d, fotos: d.fotos.length });
  }
  return [...porId.values()].sort((a, b) => b.data.localeCompare(a.data));
}

export default function MinhasDespesas() {
  const router = useRouter();
  const { carregando, sessao, perfil, erroPerfil, sincronizando, versao, sincronizarAgora, sair } =
    useSessao();
  const [mes, setMes] = useState(mesAtual);
  const [despesas, setDespesas] = useState<ItemLista[]>([]);
  const [pendentes, setPendentes] = useState(0);
  const [nomes, setNomes] = useState<{ categorias: Map<string, string>; placas: Map<string, string> }>({
    categorias: new Map(),
    placas: new Map(),
  });

  useFocusEffect(
    useCallback(() => {
      if (!perfil) return;
      Promise.all([
        carregarMes(perfil.id, mes),
        listarPendentes(),
        cacheCategorias.ler(),
        cacheVeiculos.ler(),
      ]).then(([lista, naoEnviadas, categorias, veiculos]) => {
        setDespesas(lista);
        setPendentes(naoEnviadas.length);
        setNomes({
          categorias: new Map((categorias ?? []).map((c) => [c.id, c.nome])),
          placas: new Map((veiculos ?? []).map((v) => [v.id, v.placa])),
        });
      });
    }, [perfil, versao, mes]),
  );

  // Total do mês e quanto foi em cada tipo de despesa, do maior para o menor.
  const resumo = useMemo(() => {
    const porCategoria = new Map<string, number>();
    let total = 0;
    for (const d of despesas) {
      total += d.valor_centavos;
      porCategoria.set(d.categoria_id, (porCategoria.get(d.categoria_id) ?? 0) + d.valor_centavos);
    }
    const grupos = [...porCategoria.entries()].sort((a, b) => b[1] - a[1]);
    return { total, grupos };
  }, [despesas]);

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

  const ehMesAtual = mes === mesAtual();

  const cabecalho = (
    <View style={{ gap: 12 }}>
      <View>
        <Text style={styles.ola}>Olá, {perfil.nome.split(' ')[0]}</Text>
        <Text style={[styles.status, pendentes > 0 && { color: cores.aviso }]}>
          {sincronizando
            ? 'Enviando...'
            : pendentes > 0
              ? `${pendentes} despesa(s) aguardando internet para enviar`
              : 'Tudo enviado'}
        </Text>
      </View>

      <View style={styles.seletorMes}>
        <Pressable onPress={() => setMes((m) => somarMeses(m, -1))} hitSlop={12} style={styles.seta}>
          <Text style={styles.setaTexto}>‹</Text>
        </Pressable>
        <Text style={styles.mes}>{nomeDoMes(mes)}</Text>
        <Pressable
          onPress={() => setMes((m) => somarMeses(m, 1))}
          hitSlop={12}
          style={[styles.seta, ehMesAtual && { opacity: 0.3 }]}
          disabled={ehMesAtual}
        >
          <Text style={styles.setaTexto}>›</Text>
        </Pressable>
      </View>

      <View style={styles.resumo}>
        <Text style={styles.resumoRotulo}>Total do mês</Text>
        <Text style={styles.resumoTotal}>{formatarReais(resumo.total)}</Text>
        <Text style={styles.resumoRotulo}>{despesas.length} despesa(s)</Text>
        {resumo.grupos.length > 0 && <View style={styles.divisor} />}
        {resumo.grupos.map(([categoriaId, valor]) => (
          <View key={categoriaId} style={styles.grupo}>
            <Text style={styles.grupoNome}>{nomes.categorias.get(categoriaId) ?? 'Outros'}</Text>
            <Text style={styles.grupoValor}>{formatarReais(valor)}</Text>
          </View>
        ))}
      </View>
    </View>
  );

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
      <FlatList
        data={despesas}
        keyExtractor={(d) => d.id}
        ListHeaderComponent={cabecalho}
        contentContainerStyle={[estilos.conteudo, { paddingBottom: 100 }]}
        refreshControl={<RefreshControl refreshing={sincronizando} onRefresh={sincronizarAgora} />}
        ListEmptyComponent={<Text style={styles.vazio}>Nenhuma despesa neste mês.</Text>}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemTitulo}>{nomes.categorias.get(item.categoria_id) ?? 'Despesa'}</Text>
              <Text style={styles.itemDetalhe}>
                {dataTextoDeIso(item.data)} · {nomes.placas.get(item.veiculo_id) ?? ''}
                {item.km_odometro != null ? ` · ${item.km_odometro.toLocaleString('pt-BR')} km` : ''}
                {` · ${item.fotos} foto(s)`}
              </Text>
              {!item.enviada && (
                <Text style={styles.itemPendente}>
                  {item.erro_envio
                    ? `Erro ao enviar, tentando de novo (${item.erro_envio})`
                    : 'Aguardando envio'}
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
  ola: { fontSize: 20, fontWeight: '700', color: cores.texto },
  status: { fontSize: 14, color: cores.sucesso, marginTop: 4 },
  seletorMes: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: cores.cartao,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  seta: { paddingHorizontal: 14, paddingVertical: 2 },
  setaTexto: { fontSize: 28, color: cores.primaria, fontWeight: '700' },
  mes: { fontSize: 17, fontWeight: '600', color: cores.texto },
  resumo: { backgroundColor: cores.cartao, borderRadius: 8, padding: 14, gap: 4 },
  resumoRotulo: { fontSize: 13, color: cores.suave },
  resumoTotal: { fontSize: 26, fontWeight: '700', color: cores.primaria },
  divisor: { height: 1, backgroundColor: cores.borda, marginVertical: 8 },
  grupo: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  grupoNome: { fontSize: 15, color: cores.texto },
  grupoValor: { fontSize: 15, fontWeight: '600', color: cores.texto },
  vazio: { color: cores.suave, textAlign: 'center', marginTop: 24 },
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
