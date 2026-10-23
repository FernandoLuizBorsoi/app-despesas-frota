// Página pública para o motorista baixar o app no celular Android.
// O APK fica em public/despesas-frota.apk. Ao gerar uma versão nova na Expo, troque esse arquivo.
const LINK_APK = "/despesas-frota.apk";

export const metadata = { title: "Baixar o app - Despesas da Frota" };

export default function BaixarApp() {
  return (
    <div className="baixar">
      <h1>Despesas da Frota</h1>
      <p>App para lançar as despesas da viagem com a foto do comprovante.</p>
      <a className="botao-grande" href={LINK_APK} download>
        Baixar o app
      </a>
      <ol>
        <li>Toque em <b>Baixar o app</b>. Se o celular avisar sobre o arquivo, toque em <b>Baixar mesmo assim</b>.</li>
        <li>Quando terminar, toque em <b>Abrir</b>.</li>
        <li>Se aparecer <b>Instalar apps desconhecidos</b>, toque em <b>Configurações</b>, ligue <b>Permitir desta fonte</b> e volte.</li>
        <li>Toque em <b>Instalar</b>.</li>
        <li>Abra o app <b>Despesas Frota</b> e entre com o seu CPF e a senha que o gestor passou.</li>
      </ol>
      <p className="rotulo-suave">Funciona só em celular Android.</p>
    </div>
  );
}
