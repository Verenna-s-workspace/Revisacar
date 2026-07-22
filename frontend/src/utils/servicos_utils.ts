// ── Catálogo de Serviços: utilitários e dados de demonstração ────────────────

import type { ServicoItem } from '../types/servico';

export function formatPreco(preco: number): string {
  return preco.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Reaproveita os 6 serviços que já existiam no mock (MOCK_SERVICOS) e
 * completa com mais alguns pra cobrir as categorias que faltavam em relação
 * às chaves de SVC_PRECO (utils/relatorios.ts) — Motor, Transmissão, Pneus,
 * Elétrica, Funilaria — só pra o catálogo de demonstração ficar mais
 * representativo. Preços seguem a mesma ordem de grandeza relativa que já
 * existe em SVC_PRECO, mas os dois catálogos são independentes de propósito
 * (ver nota em utils/relatorios.ts sobre não conectar isso ao faturamento).
 */
export function buildSeedServicos(): ServicoItem[] {
  const base: Omit<ServicoItem, 'ativo' | 'createdAt'>[] = [
    { id: '1', nome: 'Troca de Óleo e Filtro', categoria: 'Lubrificantes', preco: 180.0, duracao: '45 min', descricao: 'Substituição do óleo do motor e do respectivo filtro de óleo.' },
    { id: '2', nome: 'Revisão do Sistema de Freio', categoria: 'Freios', preco: 320.0, duracao: '1h 30min', descricao: 'Inspeção de pastilhas, discos, fluido, sapatas e tubulação.' },
    { id: '3', nome: 'Alinhamento 3D + Balanceamento', categoria: 'Suspensão', preco: 150.0, duracao: '1h', descricao: 'Ajuste de convergência/divergência e balanceamento das 4 rodas.' },
    { id: '4', nome: 'Higienização de Ar Condicionado', categoria: 'Climatização', preco: 280.0, duracao: '1h', descricao: 'Limpeza dos dutos, troca do filtro de cabine e aplicação de bactericida.' },
    { id: '5', nome: 'Diagnóstico por Scanner Injeção', categoria: 'Eletrônica', preco: 200.0, duracao: '45 min', descricao: 'Leitura de códigos de falha e parâmetros de sensores por scanner OBD2.' },
    { id: '6', nome: 'Revisão Geral Preventiva', categoria: 'Geral', preco: 800.0, duracao: '3h', descricao: 'Checklist completo de mais de 60 itens de motor, suspensão, freios e elétrica.' },
    { id: '7', nome: 'Troca de Correia Dentada', categoria: 'Motor', preco: 650.0, duracao: '2h 30min', descricao: 'Substituição preventiva da correia dentada, tensor e polia, conforme quilometragem do fabricante.' },
    { id: '8', nome: 'Troca de Óleo da Transmissão', categoria: 'Transmissão', preco: 250.0, duracao: '1h', descricao: 'Drenagem e substituição do fluido de câmbio manual ou automático.' },
    { id: '9', nome: 'Rodízio e Calibragem de Pneus', categoria: 'Pneus', preco: 60.0, duracao: '30 min', descricao: 'Rodízio conforme desgaste, calibragem nas 4 rodas e no estepe.' },
    { id: '10', nome: 'Troca de Bateria e Teste de Alternador', categoria: 'Elétrica', preco: 220.0, duracao: '40 min', descricao: 'Substituição da bateria e teste de carga do sistema de recarga.' },
    { id: '11', nome: 'Reparo de Amassados e Pintura Localizada', categoria: 'Funilaria', preco: 450.0, duracao: '4h', descricao: 'Martelinho de ouro ou pintura localizada, conforme extensão do dano.' },
  ];

  return base.map((item, i) => ({
    ...item,
    ativo: true,
    createdAt: new Date(Date.now() - (base.length - i) * 6 * 60 * 60 * 1000).toISOString(),
  }));
}
