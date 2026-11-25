import { useState } from 'react';
import type { FormEvent } from 'react';
import { Input } from '../../components/inputs/input';
import { DEFAULT_HORA_ABERTURA, DEFAULT_HORA_FECHAMENTO } from '../../utils/agenda';
import { salvarOficinaConfig, validarOficinaForm } from '../../utils/oficina_config';
import type { OficinaFormValues } from '../../utils/oficina_config';

interface OficinaStepProps {
  /** CNPJ e e-mail digitados na etapa 1 — vão junto pra Configurações, então
   * a tela de Configurações nunca fica com os dados de exemplo. */
  cnpj: string;
  email: string;
  /** Chamado depois que os dados foram gravados em Configurações. */
  onConcluir: () => void;
}

/**
 * Etapa 2 do cadastro do dono: "Cadastre as informações da sua oficina".
 *
 * Roda depois que a conta foi criada (etapa 1) e grava no mesmo lugar que a
 * tela de Configurações lê (ver utils/oficina_config.ts). O layout (painel da
 * marca com o quadrado 2 aceso) é do AuthShell — aqui só o lado do formulário.
 */
export function OficinaStep({ cnpj, email, onConcluir }: OficinaStepProps) {
  const [values, setValues] = useState<OficinaFormValues>({
    nome: '',
    telefone: '',
    endereco: '',
    valorHora: '',
    horaAbertura: DEFAULT_HORA_ABERTURA,
    horaFechamento: DEFAULT_HORA_FECHAMENTO,
  });
  // Só mostra os erros depois da primeira tentativa de continuar — não
  // reclama de campo vazio enquanto a pessoa ainda está preenchendo.
  const [tentou, setTentou] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof OficinaFormValues>(campo: K) => (v: string) =>
    setValues((prev) => ({ ...prev, [campo]: v }));

  const erros = validarOficinaForm(values);
  const mostrar = (campo: keyof OficinaFormValues) => (tentou ? erros[campo] : undefined);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setTentou(true);
    if (Object.keys(erros).length > 0) return;

    try {
      salvarOficinaConfig({
        nome: values.nome.trim(),
        cnpj,
        telefone: values.telefone,
        email,
        endereco: values.endereco.trim(),
        valorHora: Number(values.valorHora),
        horaAbertura: values.horaAbertura,
        horaFechamento: values.horaFechamento,
      });
    } catch {
      setError('Não foi possível salvar os dados da oficina neste navegador. Tente de novo.');
      return;
    }
    onConcluir();
  };

  return (
    <form className="auth-view" onSubmit={handleSubmit} noValidate>
      <h1 className="auth-title">Sua oficina</h1>
      <p className="auth-subtitle">
        Cadastre as informações da oficina. Elas ficam em Configurações e você pode alterar quando quiser.
      </p>

      {error && <div className="auth-alert auth-alert--error" role="alert">{error}</div>}

      <div className="auth-fields">
        <Input
          name="oficina_nome"
          label="Nome da oficina"
          value={values.nome}
          onChangeValue={set('nome')}
          placeholder="Ex.: Auto Center Silva"
          error={mostrar('nome')}
          autoComplete="organization"
          autoFocus
        />

        <Input
          name="oficina_telefone"
          type="phone"
          label="Telefone / WhatsApp"
          value={values.telefone}
          onChangeValue={set('telefone')}
          placeholder="(00) 00000-0000"
          error={mostrar('telefone')}
        />

        <Input
          name="oficina_endereco"
          label="Endereço"
          value={values.endereco}
          onChangeValue={set('endereco')}
          placeholder="Rua, número, bairro, cidade - UF"
          error={mostrar('endereco')}
          autoComplete="street-address"
        />

        <Input
          name="oficina_valor_hora"
          type="currency"
          label="Taxa de mão de obra (R$/hora)"
          value={values.valorHora}
          onChangeValue={set('valorHora')}
          placeholder="R$ 0,00"
          error={mostrar('valorHora')}
        />

        <div className="auth-row">
          <Input
            name="oficina_hora_abertura"
            type="time"
            label="Abre às"
            value={values.horaAbertura}
            onChangeValue={set('horaAbertura')}
            error={mostrar('horaAbertura')}
          />
          <Input
            name="oficina_hora_fechamento"
            type="time"
            label="Fecha às"
            value={values.horaFechamento}
            onChangeValue={set('horaFechamento')}
            error={mostrar('horaFechamento')}
          />
        </div>
      </div>

      <button type="submit" className="auth-btn">Continuar</button>
    </form>
  );
}
