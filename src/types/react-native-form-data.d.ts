/**
 * No React Native, `FormData.append` aceita um arquivo por referência ({ uri, name, type }),
 * que o runtime envia como multipart sem carregar o conteúdo na memória JS.
 * A lib DOM do TypeScript não conhece essa forma; este merge adiciona a sobrecarga tipada.
 */
interface ReactNativeFile {
  uri: string;
  name: string;
  type: string;
}

interface FormData {
  append(name: string, value: ReactNativeFile): void;
}
