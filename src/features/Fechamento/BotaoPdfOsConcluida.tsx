import { useState } from 'react';
import type { CSSProperties } from 'react';
import { btnAccent, btnDisabled } from '../../components/ui';
import { useToast } from '../../components/Toast';
import { api } from '../../utils/api';
import { mensagemDoErro } from '../../utils/api_erro';
import { baixarBlob, nomeSeguro } from '../../utils/baixar_arquivo';

/** Mesma mensagem do backend (409 `os_nao_finalizada`): quem tenta antes da hora vê o mesmo texto. */
export const MSG_OS_NAO_FINALIZADA = 'A OS precisa estar finalizada para gerar este documento.';

interface Props {
  ordemId?: string | null;
  osNum?: string | null;
  /** Status atual da OS. Só 'finalizada' libera o botão. */
  status?: string | null;
  /** Ocupa a largura toda (rodapés de modal no celular). */
  bloco?: boolean;
}

/**
 * "Gerar PDF da OS Concluída" — baixa o relatório final em uma página.
 *
 * Fora de 'finalizada' o botão fica com cara de desabilitado e `aria-disabled`, mas continua
 * recebendo o clique: um `disabled` de verdade não dispara nada, e o usuário ficaria sem saber por
 * que não funciona. O clique mostra o aviso (toast) com o motivo.
 */
export function BotaoPdfOsConcluida({ ordemId, osNum, status, bloco }: Props) {
  const toast = useToast();
  const [gerando, setGerando] = useState(false);
  const liberado = status === 'finalizada' && !!ordemId;

  const clicar = async () => {
    if (gerando) return;
    if (!liberado || !ordemId) {
      toast.erro(MSG_OS_NAO_FINALIZADA);
      return;
    }
    setGerando(true);
    try {
      const blob = await api.baixarPdfOsConcluida(ordemId);
      baixarBlob(blob, `os-concluida-${nomeSeguro(osNum || 'OS')}.pdf`);
      toast.ok('PDF da OS concluída gerado.');
    } catch (e) {
      toast.erro(mensagemDoErro(e, 'Não foi possível gerar o PDF da OS concluída.'));
    } finally {
      setGerando(false);
    }
  };

  const estilo: CSSProperties = {
    ...(liberado && !gerando ? btnAccent : btnDisabled),
    ...(bloco ? { width: '100%' } : {}),
    ...(gerando ? { cursor: 'progress' } : {}),
  };

  return (
    <button
      type="button"
      onClick={() => { void clicar(); }}
      aria-disabled={!liberado || gerando}
      aria-busy={gerando}
      title={liberado ? 'Baixar o relatório final da OS em PDF' : MSG_OS_NAO_FINALIZADA}
      style={estilo}
    >
      {gerando ? 'Gerando PDF…' : 'Gerar PDF da OS Concluída'}
    </button>
  );
}
