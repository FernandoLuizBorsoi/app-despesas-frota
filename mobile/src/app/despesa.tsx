// Detalhes de uma despesa já lançada, com as fotos do comprovante.
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { cacheCategorias, cacheVeiculos, listarDespesas } from '../lib/banco-local';
import { cores, estilos } from '../lib/estilos';
import { dataTextoDeIso, formatarReais } from '../lib/formato';
import { PREFIXO_REMOTO } from '../lib/fotos';
import { BUCKET_COMPROVANTES, supabase } from '../lib/supabase';
import type { Situacao } from '../lib/tipos';

type Detalhe = {
  categoria_id: string;
  veiculo_id: string;
  data: string;
  valor_centavos: number;
  km_odometro: number | null;
  litros: number | null;
  forma_pagamento: string | null;
  observacao: string | null;
  situacao: Situacao | null; // null enquanto não foi enviada
  motivo_rejeicao: string | null;
  fotos: string[]; // endereços prontos para mostrar
};

type LinhaServidor = {
  categoria_id: string;
  veiculo_id: string;
  data: string;
  valor: number;
  km_odometro: number | null;
  litros: number | null;
  forma_pagamento: string | null;
  observacao: string | null;
  situacao: Situacao;
  motivo_rejeicao: string | null;
  comprovante: { caminho: string; ordem: number }[];
};

const TEXTO_SITUACAO: Record<Situacao, string> = {
  pendente: 'Aguardando aprovação',
  aprovada: 'Aprovada ✓',
  rejeitada: 'Precisa de ajuste',
};

async function linksAssinados(caminhos: string[]): Promise<string[]> {
  if (caminhos.length === 0) return [];
  const { data } = await supabase.storage.from(BUCKET_COMPROVANTES).createSignedUrls(caminhos, 60 * 60);
  return (data ?? []).map((l) => l.signedUrl ?? '').filter(Boolean);
}

// Despesa ainda só no celular: mostra o que está guardado nele. Já enviada: busca no servidor,
// e sem internet usa a cópia do celular, se houver.
async function carregar(id: string): Promise<Detalhe | null> {
  const local = (await listarDespesas()).find((d) => d.id === id);
  if (!local || local.enviada) {
    const { data } = await supabase
      .from('despesa')
      .select(
        'categoria_id, veiculo_id, data, valor, km_odometro, litros, forma_pagamento, observacao,' +
          ' situacao, motivo_rejeicao, comprovante(caminho, ordem)',
      )
      .eq('id', id)
      .maybeSingle();
    if (data) {
      const d = data as unknown as LinhaServidor;
      const caminhos = [...d.comprovante].sort((a, b) => a.ordem - b.ordem).map((c) => c.caminho);
      return {
        ...d,
        valor_centavos: Math.round(d.valor * 100),
        fotos: await linksAssinados(caminhos),
      };
    }
  }
  if (!local) return null;
  const remotas = local.fotos
    .filter((f) => f.startsWith(PREFIXO_REMOTO))
    .map((f) => f.slice(PREFIXO_REMOTO.length));
  const links = await linksAssinados(remotas).catch(() => []);
  let r = 0;
  return {
    ...local,
    situacao: null,
    motivo_rejeicao: null,
    fotos: local.fotos.map((f) => (f.startsWith(PREFIXO_REMOTO) ? (links[r++] ?? '') : f)).filter(Boolean),
  };
}

export default function DetalheDespesa() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [detalhe, setDetalhe] = useState<Detalhe | null | undefined>(undefined);
  const [nomes, setNomes] = useState<{ categoria: string; placa: string }>({ categoria: '', placa: '' });
  const [ampliada, setAmpliada] = useState<string | null>(null);

  useEffect(() => {
    carregar(id)
      .catch(() => null)
      .then(async (d) => {
        setDetalhe(d);
        if (!d) return;
        const [categorias, veiculos] = await Promise.all([cacheCategorias.ler(), cacheVeiculos.ler()]);
        setNomes({
          categoria: categorias?.find((c) => c.id === d.categoria_id)?.nome ?? 'Despesa',
          placa: veiculos?.find((v) => v.id === d.veiculo_id)?.placa ?? '',
        });
      });
  }, [id]);

  if (detalhe === undefined) {
    return (
      <View style={[estilos.tela, estilos.conteudo, { alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={cores.primaria} />
      </View>
    );
  }
  if (detalhe === null) {
    return (
      <View style={[estilos.tela, estilos.conteudo]}>
        <Text style={estilos.erro}>
          Não foi possível abrir a despesa. Confira a internet e tente de novo.
        </Text>
      </View>
    );
  }

  const linhas: [string, string][] = [
    ['Data', dataTextoDeIso(detalhe.data)],
    ['Veículo', nomes.placa],
  ];
  if (detalhe.km_odometro !== null) linhas.push(['Km', detalhe.km_odometro.toLocaleString('pt-BR')]);
  if (detalhe.litros !== null) linhas.push(['Litros', detalhe.litros.toLocaleString('pt-BR')]);
  if (detalhe.forma_pagamento) linhas.push(['Pagamento', detalhe.forma_pagamento]);
  if (detalhe.observacao) linhas.push(['Observação', detalhe.observacao]);

  return (
    <ScrollView style={estilos.tela} contentContainerStyle={estilos.conteudo}>
      <Stack.Screen options={{ title: nomes.categoria || 'Despesa' }} />
      <View style={styles.cartao}>
        <Text style={styles.valor}>{formatarReais(detalhe.valor_centavos)}</Text>
        <Text style={[styles.situacao, detalhe.situacao && styles[detalhe.situacao]]}>
          {detalhe.situacao ? TEXTO_SITUACAO[detalhe.situacao] : 'Aguardando envio'}
        </Text>
        {detalhe.situacao === 'rejeitada' && detalhe.motivo_rejeicao && (
          <Text style={styles.motivo}>Gestor: {detalhe.motivo_rejeicao}</Text>
        )}
        <View style={styles.divisor} />
        {linhas.map(([rotulo, valor]) => (
          <View key={rotulo} style={styles.linha}>
            <Text style={styles.rotulo}>{rotulo}</Text>
            <Text style={styles.texto}>{valor}</Text>
          </View>
        ))}
      </View>

      {detalhe.situacao === 'rejeitada' && (
        <Pressable
          style={estilos.botao}
          onPress={() => router.replace({ pathname: '/nova', params: { id } })}
        >
          <Text style={estilos.botaoTexto}>Corrigir esta despesa</Text>
        </Pressable>
      )}

      <Text style={estilos.rotulo}>Comprovante</Text>
      {detalhe.fotos.length === 0 && <Text style={styles.rotulo}>Sem fotos.</Text>}
      {detalhe.fotos.map((uri) => (
        <Pressable key={uri} onPress={() => setAmpliada(uri)}>
          <Image source={{ uri }} style={styles.foto} resizeMode="contain" />
        </Pressable>
      ))}
      {detalhe.fotos.length > 0 && <Text style={styles.dica}>Toque na foto para ampliar.</Text>}

      <Modal visible={ampliada !== null} transparent={false} onRequestClose={() => setAmpliada(null)}>
        <Pressable style={styles.fundoAmpliada} onPress={() => setAmpliada(null)}>
          {ampliada && <Image source={{ uri: ampliada }} style={styles.ampliada} resizeMode="contain" />}
          <Text style={styles.fechar}>Toque para fechar</Text>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  cartao: { backgroundColor: cores.cartao, borderRadius: 8, padding: 14, gap: 6 },
  valor: { fontSize: 26, fontWeight: '700', color: cores.primaria },
  situacao: { fontSize: 15, color: cores.aviso, fontWeight: '600' },
  pendente: { color: cores.suave },
  aprovada: { color: cores.sucesso },
  rejeitada: { color: cores.erro },
  motivo: { fontSize: 15, color: cores.texto },
  divisor: { height: 1, backgroundColor: cores.borda, marginVertical: 6 },
  linha: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  rotulo: { fontSize: 14, color: cores.suave },
  texto: { fontSize: 15, color: cores.texto, flexShrink: 1, textAlign: 'right' },
  foto: { width: '100%', height: 420, borderRadius: 8, backgroundColor: cores.borda },
  dica: { fontSize: 12, color: cores.suave, textAlign: 'center' },
  fundoAmpliada: { flex: 1, backgroundColor: '#000000', justifyContent: 'center' },
  ampliada: { width: '100%', height: '90%' },
  fechar: { color: '#FFFFFF', textAlign: 'center', marginTop: 8 },
});
