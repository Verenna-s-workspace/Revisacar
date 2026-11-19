import type { CSSProperties, ReactNode } from 'react';
import { tokens } from '../../../../constants';
import { formatPhoneBR } from '../../../../components/inputs/masks';
import {
  MOTIVOS_FORTES, ROTULO_MOTIVO, rotuloVeiculo,
  type CandidatoCliente,
} from '../../../../utils/cadastro_existente';
import type { Cliente as ClienteCarteira } from '../../../../types/cliente';
import type { VeiculoCadastrado } from '../../../../types/veiculo';

// Painéis do passo "Identificação" que mostram o que JÁ está cadastrado para a pessoa confirmar,
// em vez de o sistema cadastrar de novo. Alvos de toque com 44px+ (mecânico usando o celular com uma mão).

const base: CSSProperties = {
  gridColumn: '1 / -1',
  display: 'flex', flexDirection: 'column', gap: 8,
  padding: '12px 14px',
  borderRadius: tokens.radius.md,
  fontFamily: tokens.fontSans, fontSize: '0.8125rem', lineHeight: 1.4,
};
const painelAtencao: CSSProperties = { ...base, background: tokens.color.warnBg, border: `1px solid ${tokens.color.warnBorder}`, color: tokens.color.text };
const painelOk: CSSProperties = { ...base, background: tokens.color.okBg, border: `1px solid ${tokens.color.okBorder}`, color: tokens.color.text };
const painelNeutro: CSSProperties = { ...base, background: tokens.color.surfaceHigh, border: `1px solid ${tokens.color.border}`, color: tokens.color.textSecond };

const titulo: CSSProperties = { fontWeight: 600, color: tokens.color.text };
const linhaAcoes: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 8 };
const botaoLinha: CSSProperties = {
  minHeight: 44, padding: '8px 12px', textAlign: 'left', cursor: 'pointer',
  background: tokens.color.surface, border: `1px solid ${tokens.color.borderMd}`, borderRadius: tokens.radius.md,
  fontFamily: tokens.fontSans, color: tokens.color.text, display: 'flex', flexDirection: 'column', gap: 2,
};
const botaoTexto: CSSProperties = {
  minHeight: 44, padding: '8px 12px', cursor: 'pointer', background: 'transparent',
  border: `1px solid ${tokens.color.border}`, borderRadius: tokens.radius.md,
  fontFamily: tokens.fontSans, fontSize: '0.8125rem', color: tokens.color.muted,
};
const pequeno: CSSProperties = { fontSize: '0.75rem', color: tokens.color.muted };

function Painel({ estilo, children, role }: { estilo: CSSProperties; children: ReactNode; role?: string }) {
  return <div style={estilo} role={role}>{children}</div>;
}

// ── Cliente ───────────────────────────────────────────────────────────────────

interface PainelClienteProps {
  /** Cadastro escolhido (id gravado na OS). */
  selecionado?: ClienteCarteira;
  candidatos: CandidatoCliente[];
  /** Mostra "será cadastrado como novo" — só quando a lista foi carregada e o cargo pode cadastrar. */
  avisarNovo: boolean;
  onUsar: (c: ClienteCarteira) => void;
  onDesvincular: () => void;
  onNenhum: () => void;
}

export function PainelClienteExistente({ selecionado, candidatos, avisarNovo, onUsar, onDesvincular, onNenhum }: PainelClienteProps) {
  if (selecionado) {
    return (
      <Painel estilo={painelOk}>
        <div><span style={titulo}>Cadastro existente:</span> {selecionado.nome}. Esta OS ficará ligada a ele, sem criar outro.</div>
        <div style={linhaAcoes}>
          <button type="button" style={botaoTexto} onClick={onDesvincular}>Desfazer</button>
        </div>
      </Painel>
    );
  }
  if (candidatos.length > 0) {
    const algumForte = candidatos.some((c) => c.motivos.some((m) => MOTIVOS_FORTES.has(m)));
    return (
      <Painel estilo={painelAtencao} role="group">
        <div style={titulo}>
          {algumForte
            ? 'Esta pessoa já está cadastrada.'
            : candidatos.length === 1 ? 'Já existe um cadastro parecido. É a mesma pessoa?' : 'Já existem cadastros parecidos. É alguma destas pessoas?'}
        </div>
        {candidatos.map(({ cliente, motivos, qtdVeiculos }) => (
          <button key={cliente.id} type="button" style={botaoLinha} onClick={() => onUsar(cliente)}>
            <span style={{ fontWeight: 600 }}>{cliente.nome}</span>
            <span style={pequeno}>
              {[cliente.telefone ? formatPhoneBR(cliente.telefone) : '', qtdVeiculos ? `${qtdVeiculos} veículo${qtdVeiculos > 1 ? 's' : ''}` : '']
                .filter(Boolean).join(' · ') || 'sem telefone cadastrado'}
              {' — '}{motivos.map((m) => ROTULO_MOTIVO[m]).join(', ')}
            </span>
          </button>
        ))}
        {algumForte ? (
          // CPF/CNPJ, e-mail ou nome + telefone iguais: o servidor liga a OS a este cadastro de qualquer jeito.
          <div style={pequeno}>Ao salvar, a OS será ligada a este cadastro, sem criar outro. Toque para preencher os dados dele.</div>
        ) : (
          <>
            <div style={linhaAcoes}>
              <button type="button" style={botaoTexto} onClick={onNenhum}>É outra pessoa</button>
            </div>
            {avisarNovo && <div style={pequeno}>Se for outra pessoa, ela será cadastrada como cliente novo ao salvar.</div>}
          </>
        )}
      </Painel>
    );
  }
  if (avisarNovo) {
    return <Painel estilo={painelNeutro}><span>Cliente novo: será cadastrado ao salvar a OS.</span></Painel>;
  }
  return null;
}

// ── Veículo ───────────────────────────────────────────────────────────────────

interface PainelVeiculoProps {
  /** Veículo cadastrado com a placa digitada (ainda não escolhido). */
  encontrado?: VeiculoCadastrado;
  /** Veículo já escolhido (id gravado na OS). */
  selecionado?: VeiculoCadastrado;
  /** Nome do dono do veículo encontrado, se houver. */
  donoNome?: string;
  /** O que foi digitado em "Cliente" é outra pessoa que não o dono do veículo. */
  clienteDiferenteDoDono: boolean;
  clienteDigitado: string;
  /** Veículos do cliente escolhido, para escolher sem digitar placa. */
  doCliente: VeiculoCadastrado[];
  placaVazia: boolean;
  avisarNovo: boolean;
  semAno: boolean;
  onUsar: (v: VeiculoCadastrado) => void;
  onUsarDono: (v: VeiculoCadastrado) => void;
  onDesvincular: () => void;
}

export function PainelVeiculoExistente(p: PainelVeiculoProps) {
  if (p.selecionado) {
    return (
      <Painel estilo={painelOk}>
        <div><span style={titulo}>Veículo cadastrado:</span> {rotuloVeiculo(p.selecionado)}{p.donoNome ? `, de ${p.donoNome}` : ''}. Sem criar outro.</div>
        <div style={linhaAcoes}>
          <button type="button" style={botaoTexto} onClick={p.onDesvincular}>Desfazer</button>
        </div>
      </Painel>
    );
  }
  if (p.encontrado) {
    return (
      <Painel estilo={painelAtencao} role="group">
        <div style={titulo}>Esta placa já está cadastrada.</div>
        <button type="button" style={botaoLinha} onClick={() => p.onUsar(p.encontrado!)}>
          <span style={{ fontWeight: 600 }}>{rotuloVeiculo(p.encontrado)}</span>
          <span style={pequeno}>{p.donoNome ? `Cliente: ${p.donoNome}` : 'Sem cliente vinculado'} · toque para usar este cadastro</span>
        </button>
        {p.clienteDiferenteDoDono && p.donoNome && (
          <>
            <div style={pequeno}>
              O cliente digitado ({p.clienteDigitado}) não é {p.donoNome}. Se o carro mudou de dono, a OS ficará com {p.clienteDigitado};
              para trocar o dono do veículo, use a tela Veículos.
            </div>
            <div style={linhaAcoes}>
              <button type="button" style={botaoTexto} onClick={() => p.onUsarDono(p.encontrado!)}>Usar {p.donoNome} como cliente</button>
            </div>
          </>
        )}
      </Painel>
    );
  }
  if (p.placaVazia && p.doCliente.length > 0) {
    return (
      <Painel estilo={painelNeutro} role="group">
        <div style={titulo}>Veículos deste cliente</div>
        <div style={linhaAcoes}>
          {p.doCliente.map((v) => (
            <button key={v.id} type="button" style={botaoLinha} onClick={() => p.onUsar(v)}>
              <span style={{ fontWeight: 600 }}>{v.placa}</span>
              <span style={pequeno}>{rotuloVeiculo(v)}</span>
            </button>
          ))}
        </div>
      </Painel>
    );
  }
  if (p.avisarNovo) {
    return (
      <Painel estilo={painelNeutro}>
        <span>Veículo novo: será cadastrado ao salvar a OS.</span>
        {p.semAno && <span style={{ color: tokens.color.warn }}>Informe o ano para que ele entre na frota (o cadastro exige).</span>}
      </Painel>
    );
  }
  return null;
}

// ── Aviso depois de salvar ────────────────────────────────────────────────────

export interface CadastroInfo { clienteCriado: boolean; veiculoCriado: boolean; avisos: string[] }

export function AvisoCadastro({ info, onFechar, px }: { info: CadastroInfo | null; onFechar: () => void; px: number }) {
  if (!info) return null;
  const criados = [info.clienteCriado && 'cliente', info.veiculoCriado && 'veículo'].filter(Boolean) as string[];
  if (!criados.length && !info.avisos.length) return null;
  return (
    <div role="status" style={{
      display: 'flex', alignItems: 'flex-start', gap: 12, padding: `10px ${px}px`,
      background: info.avisos.length ? tokens.color.warnBg : tokens.color.okBg,
      borderBottom: `1px solid ${info.avisos.length ? tokens.color.warnBorder : tokens.color.okBorder}`,
      fontFamily: tokens.fontSans, fontSize: '0.8125rem', color: tokens.color.text,
    }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {criados.length > 0 && <span>{criados.length === 2 ? 'Cliente e veículo cadastrados' : `${criados[0] === 'cliente' ? 'Cliente cadastrado' : 'Veículo cadastrado'}`} automaticamente. Você pode completar os dados nas telas Clientes e Veículos.</span>}
        {info.avisos.map((a) => <span key={a}>{a}</span>)}
      </div>
      <button type="button" onClick={onFechar} aria-label="Fechar aviso"
        style={{ minWidth: 44, minHeight: 44, margin: '-10px -10px -10px 0', background: 'transparent', border: 'none', cursor: 'pointer', color: tokens.color.muted, fontSize: '1.125rem' }}>
        ×
      </button>
    </div>
  );
}
