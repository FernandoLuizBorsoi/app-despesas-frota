import * as Crypto from 'expo-crypto';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { cacheCategorias, cachePerfil, cacheVeiculos, listarDespesas, salvarDespesa } from '../lib/banco-local';
import { cores, estilos } from '../lib/estilos';
import { centavosDeTexto, dataIsoDeTexto, dataTextoDeIso, hojeTexto, numeroDeTexto } from '../lib/formato';
import {
  apagarFoto,
  ehPdf,
  escolherDaGaleria,
  escolherPdf,
  fotografarComprovante,
  PREFIXO_REMOTO,
  type FotoNova,
} from '../lib/fotos';
import { lerValorDaFoto } from '../lib/ler-valor';
import { useSessao } from '../lib/sessao';
import { BUCKET_COMPROVANTES, supabase } from '../lib/supabase';
import { FORMAS_PAGAMENTO, type Categoria, type Veiculo } from '../lib/tipos';

const MAX_FOTOS = 5;

function textoDeCentavos(centavos: number): string {
  return (centavos / 100).toFixed(2).replace('.', ',');
}

function textoDeNumero(n: number | null): string {
  return n === null ? '' : String(n).replace('.', ',');
}

type DespesaServidor = {
  id: string;
  veiculo_id: string;
  categoria_id: string;
  data: string;
  valor: number;
  km_odometro: number | null;
  litros: number | null;
  forma_pagamento: string | null;
  observacao: string | null;
  motivo_rejeicao: string | null;
  criado_em: string;
  comprovante: { caminho: string; ordem: number }[];
};

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
  // Com id, é uma despesa que o gestor devolveu para corrigir.
  const { id: idCorrecao } = useLocalSearchParams<{ id?: string }>();
  const { sincronizarAgora } = useSessao();
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);

  const [categoriaId, setCategoriaId] = useState<string | null>(null);
  const [veiculoId, setVeiculoId] = useState<string | null>(null);
  // Placa que o gestor ligou ao motorista: só ela aparece, a não ser que ele peça outra.
  const [veiculoFixo, setVeiculoFixo] = useState<string | null>(null);
  const [verTodosVeiculos, setVerTodosVeiculos] = useState(false);
  const [valor, setValor] = useState('');
  const valorAtual = useRef(valor);
  valorAtual.current = valor;
  const [data, setData] = useState(hojeTexto());
  const [km, setKm] = useState('');
  const [litros, setLitros] = useState('');
  const [formaPagamento, setFormaPagamento] = useState<string | null>(null);
  const [observacao, setObservacao] = useState('');
  const [fotos, setFotos] = useState<string[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  // Valor preenchido pela leitura da foto, que o motorista ainda precisa confirmar.
  const [valorLido, setValorLido] = useState(false);
  const [lendoValor, setLendoValor] = useState(false);
  const [avisoValor, setAvisoValor] = useState<string | null>(null);
  const [motivoRejeicao, setMotivoRejeicao] = useState<string | null>(null);
  const [criadoEm, setCriadoEm] = useState<string | null>(null);
  const [carregandoCorrecao, setCarregandoCorrecao] = useState(Boolean(idCorrecao));
  const [linksRemotos, setLinksRemotos] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    Promise.all([cacheVeiculos.ler(), cacheCategorias.ler(), listarDespesas(), cachePerfil.ler()]).then(
      ([v, c, anteriores, perfil]) => {
        setVeiculos(v ?? []);
        setCategorias(c ?? []);
        const fixo = perfil?.veiculo_id;
        const temFixo = Boolean(fixo && v?.some((x) => x.id === fixo));
        if (temFixo) setVeiculoFixo(fixo!);
        if (idCorrecao) return;
        // Primeiro a placa que o gestor ligou ao motorista; sem ela, a da última despesa.
        const ultimo = anteriores[0]?.veiculo_id;
        if (temFixo) setVeiculoId(fixo!);
        else if (ultimo && v?.some((x) => x.id === ultimo)) setVeiculoId(ultimo);
        else if (v?.length === 1) setVeiculoId(v[0].id);
      },
    );
  }, [idCorrecao]);

  useEffect(() => {
    if (idCorrecao) carregarCorrecao(idCorrecao);
  }, [idCorrecao]);

  async function carregarCorrecao(id: string) {
    const { data, error } = await supabase
      .from('despesa')
      .select(
        'id, veiculo_id, categoria_id, data, valor, km_odometro, litros, forma_pagamento, observacao,' +
          ' motivo_rejeicao, criado_em, comprovante(caminho, ordem)',
      )
      .eq('id', id)
      .single();
    if (error || !data) {
      setErro('Não foi possível abrir a despesa. Confira a internet e tente de novo.');
      setCarregandoCorrecao(false);
      return;
    }
    const d = data as unknown as DespesaServidor;
    const caminhos = [...d.comprovante].sort((a, b) => a.ordem - b.ordem).map((c) => c.caminho);
    setCategoriaId(d.categoria_id);
    setVeiculoId(d.veiculo_id);
    setValor(textoDeCentavos(Math.round(d.valor * 100)));
    setData(dataTextoDeIso(d.data));
    setKm(d.km_odometro === null ? '' : String(d.km_odometro));
    setLitros(textoDeNumero(d.litros));
    setFormaPagamento(d.forma_pagamento);
    setObservacao(d.observacao ?? '');
    setMotivoRejeicao(d.motivo_rejeicao);
    setCriadoEm(d.criado_em);
    setFotos(caminhos.map((c) => PREFIXO_REMOTO + c));
    setCarregandoCorrecao(false);
    if (caminhos.length > 0) {
      const { data: links } = await supabase.storage.from(BUCKET_COMPROVANTES).createSignedUrls(caminhos, 60 * 60);
      setLinksRemotos(
        new Map((links ?? []).map((l, i) => [PREFIXO_REMOTO + caminhos[i], l.signedUrl ?? ''])),
      );
    }
  }

  // Lê o valor da primeira foto, se o motorista ainda não digitou nada.
  async function lerValor(foto: FotoNova) {
    setLendoValor(true);
    setAvisoValor(null);
    const { centavos, motivo } = await lerValorDaFoto(foto.original, foto.uri);
    setLendoValor(false);
    if (centavos === null) {
      setAvisoValor(`Não consegui ler o valor na foto (${motivo}). Digite o valor.`);
      return;
    }
    // O motorista pode ter digitado enquanto a foto era lida: aí vale o que ele digitou.
    if (valorAtual.current.trim()) return;
    setValor(textoDeCentavos(centavos));
    setValorLido(true);
    setAvisoValor('Valor lido da foto. Confira se está certo.');
  }

  const categoria = categorias.find((c) => c.id === categoriaId);
  const veiculo = veiculos.find((v) => v.id === veiculoId);
  // Numa correção com outra placa, mostra todas para não esconder a que já estava escolhida.
  const soVeiculoFixo = Boolean(veiculoFixo) && !verTodosVeiculos && (!veiculoId || veiculoId === veiculoFixo);

  async function adicionarFotos(origem: 'camera' | 'galeria' | 'pdf') {
    try {
      if (origem === 'pdf') {
        const pdf = await escolherPdf();
        if (pdf) setFotos((atuais) => [...atuais, pdf].slice(0, MAX_FOTOS));
        return;
      }
      const novas =
        origem === 'camera'
          ? [await fotografarComprovante()].filter((f): f is FotoNova => f !== null)
          : await escolherDaGaleria();
      setFotos((atuais) => [...atuais, ...novas.map((f) => f.uri)].slice(0, MAX_FOTOS));
      if (novas.length > 0 && !valor.trim()) lerValor(novas[0]);
    } catch (e) {
      Alert.alert('Comprovante', e instanceof Error ? e.message : 'Não foi possível adicionar o comprovante.');
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
    if (kmNumero === null) return 'Informe o km do odômetro.';
    if (!Number.isInteger(kmNumero) || kmNumero < 0) return 'O km deve ser um número inteiro.';
    const litrosNumero = numeroDeTexto(litros);
    if (categoria.exige_litros && (litrosNumero === null || litrosNumero <= 0)) return 'Informe os litros abastecidos.';
    if (fotos.length === 0) return 'Anexe o comprovante: tire uma foto ou escolha o arquivo.';
    return { valorCentavos, dataIso, kmNumero, litrosNumero };
  }

  async function gravar(dados: Exclude<ReturnType<typeof validar>, string>) {
    setSalvando(true);
    try {
      await salvarDespesa({
        id: idCorrecao ?? Crypto.randomUUID(),
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
        criado_em: criadoEm ?? new Date().toISOString(),
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
    if (valorLido) {
      Alert.alert('Confirme o valor', `O valor lido da foto foi R$ ${valor}. Está certo?`, [
        { text: 'Corrigir', style: 'cancel' },
        {
          text: 'Está certo',
          onPress: () => {
            setValorLido(false);
            conferirKm(dados);
          },
        },
      ]);
      return;
    }
    conferirKm(dados);
  }

  function conferirKm(dados: Exclude<ReturnType<typeof validar>, string>) {
    if (veiculo && dados.kmNumero < veiculo.km_atual) {
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

  const titulo = <Stack.Screen options={{ title: idCorrecao ? 'Corrigir despesa' : 'Nova despesa' }} />;

  if (carregandoCorrecao) {
    return (
      <View style={[estilos.tela, estilos.conteudo, { alignItems: 'center' }]}>
        {titulo}
        <ActivityIndicator size="large" color={cores.primaria} />
      </View>
    );
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
      {titulo}
      {motivoRejeicao && (
        <View style={styles.motivo}>
          <Text style={styles.motivoTitulo}>O gestor pediu para corrigir:</Text>
          <Text style={styles.motivoTexto}>{motivoRejeicao}</Text>
        </View>
      )}
      <View>
        <Text style={estilos.rotulo}>Comprovante</Text>
        <View style={styles.fotos}>
          {fotos.map((uri) => (
            <Pressable key={uri} onLongPress={() => removerFoto(uri)}>
              {ehPdf(uri) ? (
                <View style={[styles.miniatura, styles.miniaturaPdf]}>
                  <Text style={styles.pdfTexto}>PDF</Text>
                </View>
              ) : (
                <Image
                  source={{ uri: uri.startsWith(PREFIXO_REMOTO) ? linksRemotos.get(uri) : uri }}
                  style={styles.miniatura}
                />
              )}
            </Pressable>
          ))}
        </View>
        {fotos.length > 0 && <Text style={styles.dica}>Segure o comprovante para remover.</Text>}
        {fotos.length < MAX_FOTOS && (
          <View style={styles.linha}>
            <Pressable style={[estilos.botaoSecundario, { flex: 1 }]} onPress={() => adicionarFotos('camera')}>
              <Text style={estilos.botaoSecundarioTexto}>Tirar foto</Text>
            </Pressable>
            <Pressable style={[estilos.botaoSecundario, { flex: 1 }]} onPress={() => adicionarFotos('galeria')}>
              <Text style={estilos.botaoSecundarioTexto}>Da galeria</Text>
            </Pressable>
            <Pressable style={[estilos.botaoSecundario, { flex: 1 }]} onPress={() => adicionarFotos('pdf')}>
              <Text style={estilos.botaoSecundarioTexto}>Arquivo PDF</Text>
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
          opcoes={(soVeiculoFixo ? veiculos.filter((v) => v.id === veiculoFixo) : veiculos).map((v) => ({
            valor: v.id,
            rotulo: v.placa,
          }))}
          selecionado={veiculoId}
          aoEscolher={setVeiculoId}
        />
        {soVeiculoFixo && veiculos.length > 1 && (
          <Pressable onPress={() => setVerTodosVeiculos(true)}>
            <Text style={styles.outroVeiculo}>Estou em outro veículo</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.linha}>
        <View style={{ flex: 1 }}>
          <Text style={estilos.rotulo}>Valor (R$)</Text>
          <TextInput
            style={[estilos.campo, valorLido && styles.campoLido]}
            value={valor}
            onChangeText={(texto) => {
              setValor(texto);
              setValorLido(false);
              setAvisoValor(null);
            }}
            keyboardType="decimal-pad"
            placeholder={lendoValor ? 'Lendo a foto...' : '0,00'}
          />
          {avisoValor && <Text style={[styles.dica, valorLido && styles.avisoLido]}>{avisoValor}</Text>}
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
          <Text style={estilos.rotulo}>Km do odômetro</Text>
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
        <Text style={estilos.botaoTexto}>
          {salvando ? 'Salvando...' : idCorrecao ? 'Enviar correção' : 'Salvar despesa'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  linha: { flexDirection: 'row', gap: 12 },
  fotos: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  miniatura: { width: 90, height: 120, borderRadius: 6, backgroundColor: cores.borda },
  miniaturaPdf: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: cores.erro },
  pdfTexto: { fontSize: 20, fontWeight: '700', color: cores.erro },
  dica: { fontSize: 12, color: cores.suave, marginBottom: 8 },
  outroVeiculo: { color: cores.primaria, fontSize: 14, marginTop: 6, textDecorationLine: 'underline' },
  campoLido: { borderColor: cores.aviso, borderWidth: 2 },
  avisoLido: { color: cores.aviso, fontWeight: '600', marginTop: 4 },
  motivo: { backgroundColor: '#FDECEA', borderColor: cores.erro, borderWidth: 1, borderRadius: 8, padding: 12 },
  motivoTitulo: { fontSize: 14, fontWeight: '700', color: cores.erro },
  motivoTexto: { fontSize: 15, color: cores.texto, marginTop: 4 },
});
