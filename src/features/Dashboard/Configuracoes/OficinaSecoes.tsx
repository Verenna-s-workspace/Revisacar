import type { ReactNode } from 'react';
import { Button } from '../../../components/system';
import { Input } from '../../../components/inputs/input';
import { Aviso, RodapeAcoes } from './cfgUi';
import type { OficinaConfigState } from './useOficinaConfig';

/**
 * Formulário da oficina: o corpo muda (Dados / Horário), mas o aviso de resultado e o rodapé
 * "Descartar / Salvar alterações" são os mesmos — as duas seções salvam o mesmo conjunto de dados.
 */
function FormularioOficina({ cfg, children }: { cfg: OficinaConfigState; children: ReactNode }) {
  return (
    <form className="cfg-form" onSubmit={cfg.salvar}>
      {children}

      {cfg.salvou && <Aviso tom="ok">Configurações da oficina salvas com sucesso!</Aviso>}
      {cfg.erroSalvar && <Aviso tom="crit">{cfg.erroSalvar}</Aviso>}

      <RodapeAcoes>
        <Button onClick={cfg.descartar} disabled={!cfg.alterado || cfg.salvando}>
          Descartar
        </Button>
        <Button
          type="submit"
          variant="primary"
          loading={cfg.salvando}
          disabled={cfg.carregandoServidor || !cfg.podeEditar}
        >
          {cfg.salvando ? 'Salvando…' : cfg.carregandoServidor ? 'Carregando…' : 'Salvar alterações'}
        </Button>
      </RodapeAcoes>
    </form>
  );
}

export function DadosOficinaSecao({ cfg }: { cfg: OficinaConfigState }) {
  const { workshop: w, atualizar } = cfg;
  return (
    <FormularioOficina cfg={cfg}>
      <div className="cfg-grade">
        <Input
          name="workshop_nome"
          label="Nome comercial"
          required
          value={w.nome}
          onChangeValue={v => atualizar({ nome: v })}
        />
        <Input
          name="workshop_cnpj"
          type="cpf_cnpj"
          label="CNPJ"
          value={w.cnpj}
          disabled
          hint="É o login da conta; não muda por aqui."
        />
        <Input
          name="workshop_telefone"
          type="phone"
          label="Telefone / WhatsApp"
          required
          value={w.telefone}
          onChangeValue={v => atualizar({ telefone: v })}
        />
        <Input
          name="workshop_email"
          type="email"
          label="E-mail de atendimento"
          required
          value={w.email}
          onChangeValue={v => atualizar({ email: v })}
        />
        <div className="cfg-grade__inteira">
          <Input
            name="workshop_endereco"
            label="Endereço"
            required
            value={w.endereco}
            onChangeValue={v => atualizar({ endereco: v })}
          />
        </div>
        <Input
          name="workshop_valor_hora"
          type="currency"
          label="Taxa de mão de obra (R$/hora)"
          required
          hint="Usada para sugerir o preço dos serviços."
          value={w.valorHora ? String(w.valorHora) : ''}
          onChangeValue={v => atualizar({ valorHora: Number(v) || 0 })}
        />
      </div>
    </FormularioOficina>
  );
}

export function HorarioFuncionamentoSecao({ cfg }: { cfg: OficinaConfigState }) {
  const { workshop: w, atualizar } = cfg;
  return (
    <FormularioOficina cfg={cfg}>
      <div className="cfg-grade">
        <Input
          name="workshop_hora_abertura"
          type="time"
          label="Abertura"
          required
          value={w.horaAbertura}
          onChangeValue={v => atualizar({ horaAbertura: v })}
        />
        <Input
          name="workshop_hora_fechamento"
          type="time"
          label="Fechamento"
          required
          value={w.horaFechamento}
          onChangeValue={v => atualizar({ horaFechamento: v })}
          error={cfg.erroFechamento}
        />
      </div>
    </FormularioOficina>
  );
}
