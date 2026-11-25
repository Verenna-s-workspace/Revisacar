import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Button, Modal, ModalBody, ModalFooter, ModalHeader, ModalNotice, ModalSection } from '../../../components/system';
import { Aviso, RodapeAcoes } from './cfgUi';
import { IcAlerta, IcCheck } from './icones';
import { Input } from '../../../components/inputs/input';
import { useAuth } from '../../../context/AuthContext';
import { api } from '../../../utils/api';
import { mensagemDoErro } from '../../../utils/api_erro';
import {
  NOME_CONTA_MAX, PALAVRA_CONFIRMACAO, confirmacaoCorreta, limparDadosLocaisDaOficina,
  normalizarNome, problemaNoNome,
} from '../../../utils/conta_utils';

const ROTULO_CARGO: Record<string, string> = {
  dono: 'Dono', gerente: 'Gerente', mecanico: 'Mecânico', atendente: 'Atendente',
};

/** Linha de apoio do painel: "Dono · CNPJ …" ou "Cargo · e-mail". */
export function detalheDaConta(user: { tipo?: string; doc?: string; cargo?: string; email?: string } | null | undefined): string {
  if (!user) return '';
  return user.tipo !== 'funcionario'
    ? (user.doc ? `Dono · CNPJ ${user.doc}` : 'Dono')
    : `${ROTULO_CARGO[user.cargo ?? ''] ?? 'Funcionário'}${user.email ? ` · ${user.email}` : ''}`;
}

/**
 * Minha conta — vale para qualquer pessoa logada (dono, gerente, mecânico, atendente), sem permissão
 * especial: cada um mexe só na PRÓPRIA conta (o servidor usa o token, nunca um id enviado daqui).
 *  • Seu nome: o da pessoa, que aparece no topo e nos registros. NÃO é o nome da oficina (esse fica em
 *    "Dados da Oficina", acima).
 *  • Excluir minha conta: dono apaga a oficina inteira (confirma com a senha); funcionário apaga só o
 *    próprio cadastro (confirma com o PIN). Nos dois casos é preciso digitar EXCLUIR.
 */
export function MinhaContaCard() {
  const { user, atualizarNome, logout } = useAuth();
  const ehDono = user?.tipo !== 'funcionario';

  const [nome, setNome] = useState(user?.nome ?? '');
  const [salvando, setSalvando] = useState(false);
  const [erroNome, setErroNome] = useState('');
  const [nomeSalvo, setNomeSalvo] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  // Se o nome mudar por fora (outra renovação de sessão), o campo acompanha — sem pisar no que a pessoa digita.
  const nomeDaConta = user?.nome ?? '';
  useEffect(() => { setNome(nomeDaConta); }, [nomeDaConta]);

  if (!user) return null;

  const normalizado = normalizarNome(nome);
  const problema = nome.length > 0 ? problemaNoNome(nome) : null;
  const mudou = normalizado !== nomeDaConta;
  const podeSalvar = mudou && !problemaNoNome(nome) && !salvando;

  const salvarNome = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!podeSalvar) return;
    setSalvando(true);
    setErroNome('');
    setNomeSalvo(false);
    try {
      const r: { nome: string; accessToken: string } = await api.atualizarMeuNome(normalizado);
      atualizarNome(r.nome, r.accessToken);
      setNomeSalvo(true);
      window.setTimeout(() => setNomeSalvo(false), 3000);
    } catch (err) {
      setErroNome(mensagemDoErro(err, 'Não foi possível salvar o seu nome.'));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <>
      <form className="cfg-form" onSubmit={salvarNome}>
        {erroNome && <Aviso tom="crit">{erroNome}</Aviso>}
        <Input
          name="meu-nome"
          label="Seu nome"
          value={nome}
          maxLength={NOME_CONTA_MAX}
          error={problema ?? undefined}
          hint={ehDono
            ? 'É o seu nome de usuário, que aparece no topo e nos registros. O nome da oficina fica em "Dados da oficina".'
            : 'Aparece no topo e nos registros que você faz (ordens, lançamentos).'}
          onChangeValue={v => { setNome(v); setNomeSalvo(false); setErroNome(''); }}
        />
        <RodapeAcoes>
          <Button type="submit" variant="primary" disabled={!podeSalvar} loading={salvando}>
            {salvando ? 'Salvando…' : nomeSalvo ? <>{IcCheck} Salvo</> : 'Salvar nome'}
          </Button>
        </RodapeAcoes>
      </form>

      <div className="cfg-risco">
        <div className="cfg-risco__texto">
          <div className="cfg-risco__titulo">Excluir minha conta</div>
          <p className="cfg-risco__descricao">
            {ehDono
              ? 'Apaga a oficina inteira: ordens, orçamentos, estoque, financeiro, agenda, clientes cadastrados por você e o acesso de todos os funcionários. Não dá para desfazer.'
              : 'Remove o seu cadastro e o seu acesso à oficina. Os registros que você já fez continuam com o seu nome. Não dá para desfazer.'}
          </p>
        </div>
        <Button className="cfg-btn--risco" onClick={() => setExcluindo(true)}>Excluir conta</Button>
      </div>

      {excluindo && (
        <ExcluirContaModal
          ehDono={ehDono}
          onCancelar={() => setExcluindo(false)}
          onExcluida={() => {
            // A conta (e, para o dono, a oficina) já não existe: sai da sessão e esquece a cópia local.
            if (ehDono) limparDadosLocaisDaOficina();
            logout();
          }}
        />
      )}
    </>
  );
}

function ExcluirContaModal({ ehDono, onCancelar, onExcluida }: {
  ehDono: boolean; onCancelar: () => void; onExcluida: () => void;
}) {
  const [segredo, setSegredo] = useState('');          // senha do dono ou PIN do funcionário
  const [palavra, setPalavra] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');

  const segredoOk = ehDono ? segredo.length > 0 : /^\d{6}$/.test(segredo);
  const pode = segredoOk && confirmacaoCorreta(palavra) && !ocupado;

  const confirmar = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!pode) return;
    setOcupado(true);
    setErro('');
    try {
      await api.excluirMinhaConta({
        confirmacao: PALAVRA_CONFIRMACAO,
        ...(ehDono ? { senha: segredo } : { pin: segredo }),
      });
      onExcluida();
    } catch (err) {
      setErro(mensagemDoErro(err, 'Não foi possível excluir a conta.'));
      setOcupado(false);
    }
  };

  // Esc e clique fora cancelam — menos no meio do envio, quando a exclusão já está a caminho.
  return (
    <Modal
      size="md"
      role="alertdialog"
      onClose={() => { if (!ocupado) onCancelar(); }}
      onSubmit={confirmar}
      closeOnBackdrop={!ocupado}
    >
      <ModalHeader
        icon={IcAlerta}
        iconTone="error"
        title={ehDono ? 'Excluir a oficina e a sua conta?' : 'Excluir a sua conta?'}
        description="Esta ação não pode ser desfeita."
      />

      <ModalBody>
        <ModalNotice tone="error" title={ehDono ? 'Isto apaga tudo da oficina, para sempre:' : undefined}>
          {ehDono ? (
            <>
              <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                <li>ordens de serviço, fotos e orçamentos;</li>
                <li>estoque, catálogo de serviços e financeiro;</li>
                <li>agenda, clientes e veículos cadastrados pela oficina;</li>
                <li>todos os funcionários (eles perdem o acesso).</li>
              </ul>
              <p style={{ margin: '10px 0 0' }}>
                A conta de cliente que usa o aplicativo não é apagada — só deixa de estar ligada à oficina.
              </p>
            </>
          ) : (
            <>
              O seu cadastro e o seu acesso à oficina serão removidos. Os registros que você já fez
              (ordens, lançamentos) continuam, com o seu nome. A oficina e os outros funcionários não são afetados.
            </>
          )}
        </ModalNotice>

        <ModalSection title="Confirmação" description="Confirme que é você mesmo antes de excluir.">
          <Input
            name="excluir-segredo"
            type={ehDono ? 'password' : 'digits'}
            label={ehDono ? 'Sua senha' : 'Seu PIN (6 números)'}
            maxLength={ehDono ? undefined : 6}
            autoFocus
            value={segredo}
            onChangeValue={v => { setSegredo(v); setErro(''); }}
          />
          <Input
            name="excluir-palavra"
            label={`Para confirmar, digite ${PALAVRA_CONFIRMACAO}`}
            placeholder={PALAVRA_CONFIRMACAO}
            value={palavra}
            onChangeValue={setPalavra}
          />
        </ModalSection>
      </ModalBody>

      <ModalFooter notice={erro ? <ModalNotice tone="error" role="alert">{erro}</ModalNotice> : undefined}>
        <Button variant="ghost" onClick={onCancelar} disabled={ocupado}>Cancelar</Button>
        <Button type="submit" variant="danger" className="sys-btn--solid" disabled={!pode} loading={ocupado}>
          {ocupado ? 'Excluindo…' : ehDono ? 'Excluir tudo definitivamente' : 'Excluir minha conta'}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
