import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { api } from '../../utils/api';
import { corpoDoErro } from '../../utils/api_erro';
import { DEVICE_OFICINA_KEY, pedirAberturaComoFuncionario } from '../../utils/acesso_equipe_utils';

interface Props {
  /** Código do link /f/<código> (já normalizado). */
  codigo: string;
  /** O painel normal (AuthProvider + App): só entra depois do aparelho pareado. */
  children: ReactNode;
}

type Estado =
  | { fase: 'pareando' }
  | { fase: 'pronto' }
  | { fase: 'erro'; mensagem: string };

/**
 * Link de acesso da equipe (/f/<código>). Troca o código pela oficina, guarda o CNPJ neste aparelho
 * (a mesma chave que o login de funcionário já lê) e abre o painel de login no lado do funcionário,
 * já com a lista de nomes. Se o link não vale mais, explica e deixa seguir pro login normal.
 */
export default function AcessoEquipePage({ codigo, children }: Props) {
  const [estado, setEstado] = useState<Estado>({ fase: 'pareando' });
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let cancelado = false;
    setEstado({ fase: 'pareando' });
    api.resolverCodigoOficina(codigo)
      .then((oficina: { oficinaDoc?: string }) => {
        if (cancelado) return;
        if (!oficina?.oficinaDoc) throw new Error('resposta sem oficina');
        try {
          localStorage.setItem(DEVICE_OFICINA_KEY, oficina.oficinaDoc);
        } catch {
          // localStorage bloqueado: o login de funcionário pede o código/CNPJ na própria tela
        }
        pedirAberturaComoFuncionario();
        // Tira o código da barra de endereço: o painel segue na raiz e o link não fica no histórico.
        window.history.replaceState(null, '', '/');
        setEstado({ fase: 'pronto' });
      })
      .catch((e: unknown) => {
        if (cancelado) return;
        const detalhe = corpoDoErro<{ detail?: string }>(e)?.detail;
        setEstado({
          fase: 'erro',
          mensagem: detalhe
            ? `${detalhe} Peça um link novo ao dono da oficina.`
            : 'Não foi possível validar o link agora. Verifique a conexão e tente de novo.',
        });
      });
    return () => { cancelado = true; };
  }, [codigo, tentativa]);

  if (estado.fase === 'pronto') return <>{children}</>;

  const erro = estado.fase === 'erro';
  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24, background: 'var(--color-bg, #fff)', color: 'var(--color-text, #111)',
      fontFamily: 'inherit',
    }}>
      <div style={{ maxWidth: 380, width: '100%', textAlign: 'center' }} role={erro ? 'alert' : 'status'}>
        <img src="/Logorevisavermelha.svg" alt="" width={72} height={72} style={{ marginBottom: 16 }} />
        <h1 style={{ fontSize: '1.25rem', margin: '0 0 8px' }}>
          {erro ? 'Link de acesso indisponível' : 'Preparando este aparelho…'}
        </h1>
        <p style={{ margin: '0 0 20px', fontSize: '0.9rem', opacity: 0.75, lineHeight: 1.45 }}>
          {erro ? estado.mensagem : 'Só um instante, já vamos mostrar a lista de funcionários.'}
        </p>
        {erro && (
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setTentativa(t => t + 1)}
              style={{
                padding: '10px 18px', borderRadius: 10, border: '1px solid currentColor',
                background: 'transparent', color: 'inherit', fontWeight: 700, cursor: 'pointer',
              }}
            >
              Tentar de novo
            </button>
            <button
              type="button"
              onClick={() => {
                pedirAberturaComoFuncionario();
                window.history.replaceState(null, '', '/');
                setEstado({ fase: 'pronto' });
              }}
              style={{
                padding: '10px 18px', borderRadius: 10, border: 'none',
                background: 'var(--color-ferrari, #CC1400)', color: '#fff', fontWeight: 700, cursor: 'pointer',
              }}
            >
              Ir para o login
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
