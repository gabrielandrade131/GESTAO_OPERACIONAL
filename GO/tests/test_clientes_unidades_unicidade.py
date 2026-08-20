import json

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.test import TestCase
from django.urls import reverse

from GO.models import (
    Cliente,
    ItemEquipamentoComercial,
    MetodoOperacional,
    SegmentoClienteComercial,
    ServicoComercial,
    Unidade,
)


class ClientesUnidadesUnicidadeTests(TestCase):
    def setUp(self):
        self.staff = get_user_model().objects.create_user(
            username='comercial_uniqueness',
            password='secret',
            is_staff=True,
        )

    def test_cliente_blocks_case_and_whitespace_duplicates(self):
        Cliente.objects.create(nome='Modec')
        with self.assertRaises(ValidationError):
            Cliente.objects.create(nome='  MODEC  ')

    def test_unidade_blocks_case_and_whitespace_duplicates(self):
        Unidade.objects.create(nome='Unidade P-74')
        with self.assertRaises(ValidationError):
            Unidade.objects.create(nome='  UNIDADE p-74  ')

    def test_cadastro_cliente_page_blocks_case_insensitive_duplicate(self):
        Cliente.objects.create(nome='Modec')
        response = self.client.post(reverse('cadastrar_cliente'), {'nome': 'MODEC'})
        self.assertContains(response, 'Ja existe um cliente com este nome.')
        self.assertEqual(Cliente.objects.filter(nome__iexact='modec').count(), 1)

    def test_comercial_quick_client_returns_conflict_for_existing_name(self):
        Cliente.objects.create(nome='Modec')
        self.client.force_login(self.staff)
        response = self.client.post(
            reverse('comercial_criar_cliente'),
            data=json.dumps({'nome': 'MODEC'}),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()['errors']['nome'], 'Ja existe um cliente cadastrado com este nome.')

    def test_comercial_quick_unit_returns_conflict_for_existing_name(self):
        Unidade.objects.create(nome='P-74')
        self.client.force_login(self.staff)
        response = self.client.post(
            reverse('comercial_criar_unidade'),
            data=json.dumps({'nome': 'p-74'}),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()['errors']['nome'], 'Ja existe uma unidade cadastrada com este nome.')

    def test_commercial_quick_catalogues_persist_and_are_reloaded_from_backend(self):
        self.client.force_login(self.staff)
        entries = [
            ('comercial_criar_cliente', 'Cliente Persistente', Cliente, 'cliente', 'clientes'),
            ('comercial_criar_unidade', 'Unidade Persistente', Unidade, 'unidade', 'unidades'),
            ('comercial_criar_metodo', 'Metodo Persistente', MetodoOperacional, 'metodo', 'metodoOptions'),
            ('comercial_criar_servico', 'Servico Persistente', ServicoComercial, 'servico', 'servicos'),
            ('comercial_criar_item_equipamento', 'Item Persistente', ItemEquipamentoComercial, 'item', 'financeiroCampoChoices'),
            ('comercial_criar_segmento', 'Segmento Persistente', SegmentoClienteComercial, 'segmento', 'segmentoOptions'),
        ]

        for route_name, name, model_class, response_key, metadata_key in entries:
            with self.subTest(route=route_name):
                response = self.client.post(
                    reverse(route_name),
                    data=json.dumps({'nome': name}),
                    content_type='application/json',
                )
                self.assertEqual(response.status_code, 200)
                self.assertTrue(model_class.objects.filter(nome=name).exists())
                self.assertEqual(response.json()[response_key]['value'], name)

        response = self.client.get(reverse('comercial_catalogos'))
        self.assertEqual(response.status_code, 200)
        metadata = response.json()['metadata']
        self.assertIn('Cliente Persistente', metadata['clientes'])
        self.assertIn('Unidade Persistente', metadata['unidades'])
        self.assertIn('Metodo Persistente', metadata['metodoOptions'])
        self.assertIn('Servico Persistente', metadata['servicos'])
        self.assertIn('Segmento Persistente', metadata['segmentoOptions'])
        self.assertTrue(any(item['value'] == 'Item Persistente' for item in metadata['financeiroCampoChoices']))
