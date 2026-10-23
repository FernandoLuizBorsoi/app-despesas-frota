// Pede ao Android para baixar o leitor de texto do Google (ML Kit) junto com a instalação do app.
// Sem isso, ele só é baixado na primeira leitura, e as primeiras fotos ficam sem o valor.
const { AndroidConfig, withAndroidManifest } = require('expo/config-plugins');

module.exports = function comLeitorDeComprovante(config) {
  return withAndroidManifest(config, (c) => {
    const aplicativo = AndroidConfig.Manifest.getMainApplicationOrThrow(c.modResults);
    AndroidConfig.Manifest.addMetaDataItemToMainApplication(aplicativo, 'com.google.mlkit.vision.DEPENDENCIES', 'ocr');
    return c;
  });
};
