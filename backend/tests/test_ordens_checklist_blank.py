from orders.serializers import ChecklistItemSerializer, VeiculoSerializer


def test_checklist_item_aceita_obs_vazia():
    s = ChecklistItemSerializer(data={"status": "ok", "obs": ""})
    assert s.is_valid(), s.errors


def test_veiculo_aceita_opcionais_vazios():
    s = VeiculoSerializer(data={"placa": "ABC1D23", "modelo": "Onix", "ano": "", "cor": "", "chassi": "", "obs_entrada": ""})
    assert s.is_valid(), s.errors
