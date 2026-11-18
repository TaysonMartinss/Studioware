import { Conteudo } from "../components/MidiaReal";
import { IconeGranulado } from "../components/IconeGranulado";
import { Midia } from "../types";

// O objeto que flutua nas cenas editoriais: um modelo 3D / imagem, ou um ícone ("icone:<nome Lucide>") desenhado
// sólido com sombra interna e grão (estilo Editorial)
export const ObjetoEditorial: React.FC<{ midia: Midia; tamanho: number; cor?: string }> = ({ midia, tamanho, cor }) =>
  midia.arquivo?.startsWith("icone:") ? (
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <IconeGranulado nome={midia.arquivo.slice(6)} tamanho={tamanho} cor={cor} />
    </div>
  ) : (
    <Conteudo midia={midia} estilo={{ width: "100%", height: "100%", objectFit: "contain", background: "none" }} />
  );
