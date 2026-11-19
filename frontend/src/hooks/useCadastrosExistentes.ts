import { useEffect, useState } from 'react';
import { api } from '../utils/api';
import type { Cliente as ClienteCarteira } from '../types/cliente';
import type { VeiculoCadastrado } from '../types/veiculo';

/**
 * Carteira de clientes e veículos da oficina, só para o checklist SUGERIR o que já existe (evitar cadastro
 * duplicado). Falha em silêncio: sem a lista o checklist funciona igual e o servidor continua conferindo
 * tudo ao salvar. `carregado` só fica true com as duas listas em mãos — sem elas a tela não promete nada
 * ("será cadastrado como novo") para não dizer algo que não sabe.
 */
export function useCadastrosExistentes() {
  const [clientes, setClientes] = useState<ClienteCarteira[]>([]);
  const [veiculos, setVeiculos] = useState<VeiculoCadastrado[]>([]);
  const [carregado, setCarregado] = useState(false);

  useEffect(() => {
    let vivo = true;
    Promise.all([api.listarClientes(), api.listarVeiculos()])
      .then(([c, v]) => {
        if (!vivo) return;
        setClientes(Array.isArray(c) ? c : c?.clientes ?? []);
        setVeiculos(Array.isArray(v) ? v : v?.veiculos ?? []);
        setCarregado(true);
      })
      .catch(() => { /* sem permissão ou sem rede: o checklist segue sem sugestões */ });
    return () => { vivo = false; };
  }, []);

  return { clientes, veiculos, carregado };
}
