import { useState, useEffect, useCallback } from 'react';
import {
  Button, Modal, ModalBody, ModalFields, ModalFooter, ModalHeader, ModalNotice, ModalSection,
} from '../../../components/system';
import { Aviso, EstadoMensagem } from './cfgUi';
import { IcAlerta, IcLixeira, IcMais } from './icones';
import { Input } from '../../../components/inputs/input';
import { Select } from '../../../components/inputs/select';
import { api } from '../../../utils/api';
import { mensagemDoErro } from '../../../utils/api_erro';
import { usePermissions } from '../../../hooks/usePermissions';
import type { Funcionario } from '../../../types';

const CARGO_LABEL: Record<string, string> = {
  gerente: 'Gerente',
  mecanico: 'Mecânico',
  atendente: 'Atendente',
};

const CARGO_OPTIONS = [
  { value: 'atendente', label: CARGO_LABEL.atendente },
  { value: 'mecanico', label: CARGO_LABEL.mecanico },
  { value: 'gerente', label: CARGO_LABEL.gerente },
];

const FORM_INICIAL = { nome: '', email: '', pin: '', cargo: 'atendente' as const };

export function FuncionariosCard() {
  const { can } = usePermissions();
  const podeGerenciar = can('funcionarios.gerenciar');

  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [loading, setLoading] = useState(true);
  // Erro de CARREGAMENTO (bloqueia a lista, mostra retry) — separado do erro
  // de AÇÃO (cargo/ativo/remover), que fica num aviso menor sem esconder a
  // lista que já está na tela.
  const [erro, setErro] = useState('');
  const [erroAcao, setErroAcao] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [novo, setNovo] = useState<{ nome: string; email: string; pin: string; cargo: string }>(FORM_INICIAL);

  const carregar = useCallback(() => {
    setLoading(true);
    setErro('');
    setErroAcao('');
    api.listarFuncionarios()
      .then((data: Funcionario[]) => setFuncionarios(Array.isArray(data) ? data : []))
      .catch((e: unknown) => setErro(mensagemDoErro(e, 'Não foi possível carregar os funcionários.')))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (podeGerenciar) carregar();
  }, [podeGerenciar, carregar]);

  // Esconder a seção inteira é só UX — quem realmente barra o acesso é o
  // require_permission("funcionarios.gerenciar") no backend.
  if (!podeGerenciar) return null;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setErroAcao('');
    setSalvando(true);
    try {
      await api.criarFuncionario(novo);
      setShowModal(false);
      setNovo(FORM_INICIAL);
      carregar();
    } catch (err) {
      setErroAcao(mensagemDoErro(err, 'Não foi possível cadastrar o funcionário agora. Tente de novo.'));
    } finally {
      setSalvando(false);
    }
  };

  const handleCargoChange = async (id: string, cargo: string) => {
    const anterior = funcionarios;
    setFuncionarios(fs => fs.map(f => (f.id === id ? { ...f, cargo: cargo as Funcionario['cargo'] } : f)));
    try {
      await api.atualizarFuncionario(id, { cargo });
    } catch (e) {
      setFuncionarios(anterior);
      setErroAcao(mensagemDoErro(e, 'Não foi possível atualizar o cargo. Tente de novo.'));
    }
  };

  const handleToggleAtivo = async (f: Funcionario) => {
    const anterior = funcionarios;
    setFuncionarios(fs => fs.map(x => (x.id === f.id ? { ...x, ativo: !x.ativo } : x)));
    try {
      await api.atualizarFuncionario(f.id, { ativo: !f.ativo });
    } catch (e) {
      setFuncionarios(anterior);
      setErroAcao(mensagemDoErro(e, 'Não foi possível atualizar o acesso. Tente de novo.'));
    }
  };

  const handleRemover = async (id: string) => {
    if (!window.confirm('Remover o acesso deste funcionário? Essa ação não pode ser desfeita.')) return;
    const anterior = funcionarios;
    setFuncionarios(fs => fs.filter(f => f.id !== id));
    try {
      await api.removerFuncionario(id);
    } catch (e) {
      setFuncionarios(anterior);
      setErroAcao(mensagemDoErro(e, 'Não foi possível remover o funcionário. Tente de novo.'));
    }
  };

  return (
    <>
      <div className="cfg-barra">
        <Button variant="primary" icon={IcMais} onClick={() => setShowModal(true)}>
          Novo funcionário
        </Button>
      </div>

      {/* Erro de ação (cargo/ativo/remover) — a lista continua visível por trás. */}
      {erroAcao && funcionarios.length > 0 && <Aviso tom="crit">{erroAcao}</Aviso>}

      {loading ? (
        <EstadoMensagem>Carregando funcionários…</EstadoMensagem>
      ) : erro ? (
        <EstadoMensagem
          icone={IcAlerta}
          titulo={erro}
          acao={<Button onClick={carregar}>Tentar novamente</Button>}
        >
          Verifique sua conexão e tente novamente.
        </EstadoMensagem>
      ) : funcionarios.length === 0 ? (
        <EstadoMensagem>Nenhum funcionário cadastrado ainda.</EstadoMensagem>
      ) : (
        <ul className="cfg-lista">
          {funcionarios.map(f => (
            <li key={f.id} className={`cfg-lista__item${f.ativo ? '' : ' cfg-lista__item--inativo'}`}>
              <div className="cfg-lista__texto">
                <span className="cfg-lista__nome">{f.nome}</span>
                <span className="cfg-lista__detalhe">{f.email}</span>
              </div>
              <div className="cfg-lista__acoes">
                <div className="cfg-lista__cargo">
                  <Select
                    name={`cargo-${f.id}`}
                    value={f.cargo}
                    options={CARGO_OPTIONS}
                    onChangeValue={v => handleCargoChange(f.id, v)}
                  />
                </div>
                <button
                  type="button"
                  className={`cfg-pilula${f.ativo ? ' cfg-pilula--ok' : ''}`}
                  onClick={() => handleToggleAtivo(f)}
                  title={f.ativo ? 'Clique para desativar o acesso' : 'Clique para reativar o acesso'}
                  aria-pressed={f.ativo}
                >
                  {f.ativo ? 'Ativo' : 'Inativo'}
                </button>
                <Button
                  variant="icon"
                  size="sm"
                  icon={IcLixeira}
                  title="Remover funcionário"
                  aria-label={`Remover ${f.nome}`}
                  onClick={() => handleRemover(f.id)}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      {showModal && (
        <Modal size="md" onClose={() => { if (!salvando) setShowModal(false); }} onSubmit={handleAdd} closeOnBackdrop={!salvando}>
          <ModalHeader
            icon={IcMais}
            title="Novo funcionário"
            description="Cadastre quem vai acessar o sistema da oficina."
          />

          <ModalBody>
            <ModalSection title="Dados do funcionário">
              <Input
                name="nome"
                label="Nome"
                required
                autoFocus
                value={novo.nome}
                onChangeValue={v => setNovo({ ...novo, nome: v })}
              />
              <ModalFields>
                <Input
                  name="email"
                  type="email"
                  label="E-mail de login"
                  required
                  value={novo.email}
                  onChangeValue={v => setNovo({ ...novo, email: v })}
                />
                <Select
                  name="cargo"
                  label="Cargo"
                  value={novo.cargo}
                  options={CARGO_OPTIONS}
                  onChangeValue={v => setNovo({ ...novo, cargo: v })}
                />
              </ModalFields>
            </ModalSection>

            <ModalSection title="Acesso" description="O funcionário usa esse PIN para entrar. Ele pode trocar depois em “Esqueci meu PIN”.">
              <Input
                name="pin"
                type="digits"
                label="PIN inicial (6 dígitos)"
                required
                maxLength={6}
                placeholder="000000"
                value={novo.pin}
                onChangeValue={v => setNovo({ ...novo, pin: v })}
                style={{ letterSpacing: '0.3em', fontVariantNumeric: 'tabular-nums' }}
              />
            </ModalSection>
          </ModalBody>

          <ModalFooter
            hint="* Campos obrigatórios"
            notice={erroAcao ? <ModalNotice tone="error" role="alert">{erroAcao}</ModalNotice> : undefined}
          >
            <Button variant="ghost" onClick={() => setShowModal(false)} disabled={salvando}>Cancelar</Button>
            <Button type="submit" variant="primary" loading={salvando}>
              {salvando ? 'Salvando…' : 'Cadastrar funcionário'}
            </Button>
          </ModalFooter>
        </Modal>
      )}
    </>
  );
}
