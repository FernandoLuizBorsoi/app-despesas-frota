import { StyleSheet } from 'react-native';

export const cores = {
  primaria: '#1F5FAD',
  fundo: '#F4F6F9',
  cartao: '#FFFFFF',
  texto: '#1B1F24',
  suave: '#5E6773',
  borda: '#D5DAE1',
  erro: '#B42318',
  sucesso: '#2E7D32',
  aviso: '#B26A00',
};

export const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  conteudo: { padding: 16, gap: 12 },
  rotulo: { fontSize: 14, fontWeight: '600', color: cores.texto, marginBottom: 4 },
  campo: {
    backgroundColor: cores.cartao,
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: cores.texto,
  },
  botao: {
    backgroundColor: cores.primaria,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  botaoSecundario: {
    backgroundColor: cores.cartao,
    borderWidth: 1,
    borderColor: cores.primaria,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  botaoTexto: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  botaoSecundarioTexto: { color: cores.primaria, fontSize: 15, fontWeight: '600' },
  erro: { color: cores.erro, fontSize: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: cores.borda,
    backgroundColor: cores.cartao,
  },
  chipAtivo: { backgroundColor: cores.primaria, borderColor: cores.primaria },
  chipTexto: { fontSize: 14, color: cores.texto },
  chipTextoAtivo: { color: '#FFFFFF', fontWeight: '600' },
});
