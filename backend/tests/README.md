# Testes para o Backend

Esta diretoria contém testes para os endpoints do backend.

## Estrutura

- `test_utils.py` - Testes para as funções utilitárias (CPF/CNPJ, telefone)
- `test_clientes.py` - Testes para o endpoint de clientes
- `test_veiculos.py` - Testes para o endpoint de veículos
- `test_agendamentos.py` - Testes para o endpoint de agendamentos
- `test_servicos.py` - Testes para o endpoint de serviços
- `test_estoque.py` - Testes para o endpoint de estoque
- `test_kits.py` - Testes para o endpoint de kits

## Como executar os testes

Para executar os testes, você pode usar o Django test runner:

```bash
# Desde a diretoria backend
python manage.py test orders.tests
```

Ou para testar um módulo específico:

```bash
python manage.py test orders.tests.test_clientes
```

## Notas

Estes são testes unitários básicos que focam na validação dos serializers e nas funções utilitárias.
Para testes de integração completos (testando os endpoints HTTP reais), seria necessário
configurar um ambiente de teste com um banco de dados de teste.

Os testes atuais não incluem autenticação para simplificar. Em um ambiente de teste real,
seria necessário criar um usuário de admin e incluir o token de autenticação nas requisições.