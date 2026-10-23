import * as Crypto from 'expo-crypto';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { cacheCategorias, cacheVeiculos, listarDespesas, salvarDespesa } from '../lib/banco-local';
import { cores, estilos } from '../lib/estilos';
import { centavosDeTexto, dataIsoDeTexto, hojeTexto, numeroDeTexto } from '../lib/formato';
import { apagarFoto, escolherDaGaleria, fotografarComprovante } from '../lib/fotos';
import { useSessao } from '../lib/sessao';
import { FORMAS_PAGAMENTO, type Categoria, type Veiculo } from '../lib/tipos';

const MAX_FOTOS = 5;

function Chips<T extends string>(props: {
  opcoes: { valor: T; rotulo: string }[];
  selecionado: T | null;
  aoEscolher: (valor: T) => void;
}) {
  return (
    <View style={estilos.chips}>
      {props.opcoes.map((o) => {
        const ativo = o.valor === props.selecionado;
        return (
          <Pressable
            key={o.valor}
            style={[estilos.chip, ativo && estilos.chipAtivo]}
            onPress={() => props.aoEscolher(o.valor)}
          >
            <Text style={[estilos.chipTexto, ativo && estilos.chipTextoAtivo]}>{o.rotulo}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function NovaDespesa() {
  const router = useRouter();
  const { sincronizarAgora } = useSessao();
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);

  const [categoriaId, setCategoriaId] = useState<string | null>(null);
  const [veiculoId, setVeiculoId] = useState<string | null>(null);
  const [valor, setValor] = useState('');
  const [data, setData] = useState(hojeTexto());
  const [km, setKm] = useState('');
  const [litros, setLitros] = useState('');
  const [formaPagamento, setFormaPagamento] = useState<string | null>(null);
  const [observacao, setObservacao] = useState('');
  const [fotos, setFotos] = useState<string[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    Promise.all([cacheVeiculos.ler(), cacheCategorias.ler(), listarDespesas()]).then(([v, c, anteriores]) => {
      setVeiculos(v ?? []);
      setCategorias(c ?? []);
      // O motorista costuma usar sempre o mesmo veículo: já deixa o último selecionado.
      const ultimo = anteriores[0]?.veiculo_id;
      if (ultimo && v?.some((x) => x.id === ultimo)) setVeiculoId(ultimo);
      else if (v?.length === 1) setVeiculoId(v[0].id);
    });
  }, []);

  const categoria = categorias.find((c) => c.id === categoriaId);
  const veiculo = veiculos.find((v) => v.id === veiculoId);

  async function adicionarFotos(origem: 'camera' | 'galeria') {
    try {
      const novas =
        origem === 'camera'
          ? [await fotografarComprovante()].filter((f): f is string => f !== null)
          : await escolherDaGaleria();
      setFotos((atuais) => [...atuais, ...novas].slice(0, MAX_FOTOS));
    } catch (e) {
      Alert.alert('Foto', e instanceof Error ? e.message : 'Não foi possível adicionar a foto.');
    }
  }

  function removerFoto(uri: string) {
    apagarFoto(uri);
    setFotos((atuais) => atuais.filter((f) => f !== uri));
  }

  function validar() {
    if (!categoria) return 'Escolha a categoria.';
    if (!veiculo) return 'Escolha o veículo.';
    const valorCentavos = centavosDeTexto(valor);
    if (valorCentavos === null) return 'Informe o valor, por exemplo 150,90.';
    const dataIso = dataIsoDeTexto(data);
    if (!dataIso) return 'Informe a data no formato DD/MM/AAAA.';
    if (dataIso > new Date().toISOString().slice(0, 10)) return 'A data não pode ser no futuro.';
    const kmNumero = numeroDeTexto(km);
    if (categoria.exige_km && kmNumero === null) return 'Informe o km do odômetro.';
    if (kmNumero !== null && (!Number.isInteger(kmNumero) || kmNumero < 0)) return 'O km deve ser um número inteiro.';
    const litrosNumero = numeroDeTexto(litros);
    if (categoria.exige_litros && (litrosNumero === null || litrosNumero <= 0)) return 'Informe os litros abastecidos.';
    if (fotos.length === 0) return 'Tire pelo menos uma foto do comprovante.';
    return { valorCentavos, dataIso, kmNumero, litrosNumero };
  }

  async function gravar(dados: Exclude<ReturnType<typeof validar>, string>) {
    setSalvando(true);
    try {
      await salvarDespesa({
        id: Crypto.randomUUID(),
        veiculo_id: veiculoId!,
        categoria_id: categoriaId!,
        data: dados.dataIso,
        valor_centavos: dados.valorCentavos,
        km_odometro: dados.kmNumero,
        litros: categoria?.exige_litros ? dados.litrosNumero : null,
        forma_pagamento: formaPagamento,
        observacao: observacao.trim() || null,
        fotos,
        enviada: false,
        erro_envio: null,
        criado_em: new Date().toISOString(),
      });
      sincronizarAgora();
      router.back();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível salvar.');
      setSalvando(false);
    }
  }

  function salvar() {
    setErro(null);
    const dados = validar();
    if (typeof dados === 'string') {
      setErro(dados);
      return;
    }
    if (dados.kmNumero !== null && veiculo && dados.kmNumero < veiculo.km_atual) {
      Alert.alert(
        'Confira o km',
        `O último km registrado para ${veiculo.placa} é ${veiculo.km_atual.toLocaleString('pt-BR')}. Salvar mesmo assim?`,
        [
          { text: 'Corrigir', style: 'cancel' },
          { text: 'Salvar', onPress: () => gravar(dados) },
        ],
      );
      return;
    }
    gravar(dados);
  }

  if (categorias.length === 0 || veiculos.length === 0) {
    return (
      <View style={[estilos.tela, estilos.conteudo]}>
        <Text style={estilos.erro}>
          Ainda não há veículos ou categorias neste celular. Conecte-se à internet e abra o app novamente.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={estilos.tela} contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled">
      <View>
        <Text style={estilos.rotulo}>Comprovante</Text>
        <View style={styles.fotos}>
          {fotos.map((uri) => (
            <Pressable key={uri} onLongPress={() => removerFoto(uri)}>
              <Image source={{ uri }} style={styles.miniatura} />
            </Pressable>
          ))}
        </View>
        {fotos.length > 0 && <Text style={styles.dica}>Segure a foto para remover.</Text>}
        {fotos.length < MAX_FOTOS && (
          <View style={styles.linha}>
            <Pressable style={[estilos.botaoSecundario, { flex: 1 }]} onPress={() => adicionarFotos('camera')}>
              <Text style={estilos.botaoSecundarioTexto}>Tirar foto</Text>
            </Pressable>
            <Pressable style={[estilos.botaoSecundario, { flex: 1 }]} onPress={() => adicionarFotos('galeria')}>
              <Text style={estilos.botaoSecundarioTexto}>Da galeria</Text>
            </Pressable>
          </View>
        )}
      </View>

      <View>
        <Text style={estilos.rotulo}>Categoria</Text>
        <Chips
          opcoes={categorias.map((c) => ({ valor: c.id, rotulo: c.nome }))}
          selecionado={categoriaId}
          aoEscolher={setCategoriaId}
        />
      </View>

      <View>
        <Text style={estilos.rotulo}>Veículo</Text>
        <Chips
          opcoes={veiculos.map((v) => ({ valor: v.id, rotulo: v.placa }))}
          selecionado={veiculoId}
          aoEscolher={setVeiculoId}
        />
      </View>

      <View style={styles.linha}>
        <View style={{ flex: 1 }}>
          <Text style={estilos.rotulo}>Valor (R$)</Text>
          <TextInput
            style={estilos.campo}
            value={valor}
            onChangeText={setValor}
            keyboardType="decimal-pad"
            placeholder="0,00"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={estilos.rotulo}>Data</Text>
          <TextInput
            style={estilos.campo}
            value={data}
            onChangeText={setData}
            keyboardType="numbers-and-punctuation"
            placeholder="DD/MM/AAAA"
          />
        </View>
      </View>

      <View style={styles.linha}>
        <View style={{ flex: 1 }}>
          <Text style={estilos.rotulo}>Km do odômetro{categoria?.exige_km ? '' : ' (opcional)'}</Text>
          <TextInput
            style={estilos.campo}
            value={km}
            onChangeText={setKm}
            keyboardType="number-pad"
            placeholder={veiculo ? `Último: ${veiculo.km_atual.toLocaleString('pt-BR')}` : ''}
          />
        </View>
        {categoria?.exige_litros && (
          <View style={{ flex: 1 }}>
            <Text style={estilos.rotulo}>Litros</Text>
            <TextInput
              style={estilos.campo}
              value={litros}
              onChangeText={setLitros}
              keyboardType="decimal-pad"
              placeholder="0,000"
            />
          </View>
        )}
      </View>

      <View>
        <Text style={estilos.rotulo}>Forma de pagamento</Text>
        <Chips
          opcoes={FORMAS_PAGAMENTO.map((f) => ({ valor: f as string, rotulo: f }))}
          selecionado={formaPagamento}
          aoEscolher={setFormaPagamento}
        />
      </View>

      <View>
        <Text style={estilos.rotulo}>Observação (opcional)</Text>
        <TextInput
          style={[estilos.campo, { minHeight: 70, textAlignVertical: 'top' }]}
          value={observacao}
          onChangeText={setObservacao}
          multiline
        />
      </View>

      {erro && <Text style={estilos.erro}>{erro}</Text>}
      <Pressable style={[estilos.botao, salvando && { opacity: 0.6 }]} onPress={salvar} disabled={salvando}>
        <Text style={estilos.botaoTexto}>{salvando ? 'Salvando...' : 'Salvar despesa'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  linha: { flexDirection: 'row', gap: 12 },
  fotos: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  miniatura: { width: 90, height: 120, borderRadius: 6, backgroundColor: cores.borda },
  dica: { fontSize: 12, color: cores.suave, marginBottom: 8 },
});
