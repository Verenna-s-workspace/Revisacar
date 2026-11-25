import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { donoDaCopiaLocal } from '../utils/oficina_config';
import { HORARIO_ATUALIZADO_EVENTO } from '../utils/horario_funcionamento';

// Nome comercial da oficina, definido em Configurações. Vive no blob
// 'oficina_config' do localStorage (o mesmo que ConfiguracoesPage grava e que
// sincronizarOficinaConfig atualiza com o servidor). Toda gravação por
// salvarOficinaConfig dispara HORARIO_ATUALIZADO_EVENTO, então a sidebar já
// montada mostra o nome novo sem precisar recarregar.
//
// Atenção: essa cópia é do NAVEGADOR, não da conta. Num computador compartilhado
// ela pode ser de outra oficina até a sincronização terminar (ou pra sempre, se
// estiver offline). Pro dono, que traz o CNPJ da conta no login, a cópia de outra
// oficina é ignorada — a mesma regra que ConfiguracoesPage usa. O login do
// funcionário não traz o CNPJ, então ali não dá pra conferir no front: vale a
// cópia local, e a sincronização do painel troca a de outra oficina.

const CHAVE = 'oficina_config';

function ler(docDaConta: string | undefined): string {
  try {
    const salvo = localStorage.getItem(CHAVE);
    const local = salvo ? JSON.parse(salvo) : null;
    if (!local || typeof local !== 'object') return '';
    if (docDaConta && donoDaCopiaLocal(local, docDaConta) === 'outra') return '';
    return typeof local.nome === 'string' ? local.nome.trim() : '';
  } catch {
    return ''; // sem localStorage ou JSON corrompido
  }
}

export function useNomeOficina(): string {
  const { user } = useAuth();
  const docDaConta = user?.tipo === 'dono' ? user.doc : undefined;
  const [nome, setNome] = useState<string>(() => ler(docDaConta));

  useEffect(() => {
    const atualizar = () => setNome(ler(docDaConta));
    atualizar(); // a sincronização com o servidor pode ter gravado entre o render e o efeito
    window.addEventListener(HORARIO_ATUALIZADO_EVENTO, atualizar);
    window.addEventListener('storage', atualizar); // outra aba
    return () => {
      window.removeEventListener(HORARIO_ATUALIZADO_EVENTO, atualizar);
      window.removeEventListener('storage', atualizar);
    };
  }, [docDaConta]);

  return nome;
}