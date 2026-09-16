import json

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.test import override_settings
from django.urls import reverse

from GO.models import Cliente, Funcao, OrdemServico, Pessoa


@override_settings(
    SECURE_SSL_REDIRECT=False,
    STORAGES={'staticfiles': {'BACKEND': 'django.contrib.staticfiles.storage.StaticFilesStorage'}}
)
class GerenciarCadastrosTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_superuser(
            username='admin_cadastros', email='admin@example.com', password='secret'
        )
        self.client.force_login(self.user)

    def test_page_and_menu_are_available(self):
        response = self.client.get(reverse('gerenciar_cadastros'))
        self.assertContains(response, 'Gerenciar cadastros')
        self.assertContains(response, 'Gerenciar Cadastros')

    def test_client_can_be_deactivated_and_reactivated_without_deletion(self):
        create = self.client.post(
            reverse('cadastro_master_criar', args=['clientes']),
            data=json.dumps({'nome': 'Cliente Mestre'}), content_type='application/json',
        )
        self.assertEqual(create.status_code, 200)
        client_id = create.json()['item']['id']
        update = self.client.post(
            reverse('cadastro_master_editar', args=['clientes', client_id]),
            data=json.dumps({'nome': 'Cliente Atualizado'}), content_type='application/json',
        )
        self.assertEqual(update.status_code, 200)
        self.assertTrue(Cliente.objects.filter(nome='Cliente Atualizado').exists())
        deactivate = self.client.post(
            reverse('cadastro_master_alterar_status', args=['clientes', client_id]),
            data=json.dumps({'ativo': False}), content_type='application/json',
        )
        self.assertEqual(deactivate.status_code, 200)
        self.assertTrue(Cliente.objects.filter(pk=client_id, ativo=False).exists())
        active_listing = self.client.get(reverse('cadastro_master_listar', args=['clientes']))
        self.assertEqual(active_listing.json()['items'], [])
        inactive_listing = self.client.get(reverse('cadastro_master_listar', args=['clientes']) + '?status=inativos')
        self.assertEqual(inactive_listing.json()['items'][0]['id'], client_id)
        reactivate = self.client.post(
            reverse('cadastro_master_alterar_status', args=['clientes', client_id]),
            data=json.dumps({'ativo': True}), content_type='application/json',
        )
        self.assertEqual(reactivate.status_code, 200)
        self.assertTrue(Cliente.objects.filter(pk=client_id, ativo=True).exists())

    def test_people_api_uses_default_technical_role_and_lists_person(self):
        response = self.client.post(
            reverse('cadastro_master_criar', args=['pessoas']),
            data=json.dumps({'nome': 'Pessoa Mestre'}), content_type='application/json',
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(Pessoa.objects.get(nome='Pessoa Mestre').funcao, 'AJUDANTE')
        listing = self.client.get(reverse('cadastro_master_listar', args=['pessoas']))
        self.assertEqual(listing.status_code, 200)
        self.assertEqual(listing.json()['items'][0]['nome'], 'Pessoa Mestre')

    def test_functions_can_be_created_edited_and_deactivated(self):
        create = self.client.post(
            reverse('cadastro_master_criar', args=['funcoes']),
            data=json.dumps({'nome': 'Funcao nova'}), content_type='application/json',
        )
        self.assertEqual(create.status_code, 200)
        function_id = create.json()['item']['id']
        update = self.client.post(
            reverse('cadastro_master_editar', args=['funcoes', function_id]),
            data=json.dumps({'nome': 'Funcao revisada'}), content_type='application/json',
        )
        self.assertEqual(update.status_code, 200)
        deactivate = self.client.post(
            reverse('cadastro_master_alterar_status', args=['funcoes', function_id]),
            data=json.dumps({'ativo': False}), content_type='application/json',
        )
        self.assertEqual(deactivate.status_code, 200)
        self.assertTrue(Funcao.objects.filter(pk=function_id, nome='Funcao revisada', ativo=False).exists())
        reactivate = self.client.post(
            reverse('cadastro_master_criar', args=['funcoes']),
            data=json.dumps({'nome': 'Funcao revisada'}), content_type='application/json',
        )
        self.assertEqual(reactivate.status_code, 200)
        self.assertTrue(reactivate.json()['reactivated'])
        self.assertTrue(Funcao.objects.filter(pk=function_id, ativo=True).exists())

    def test_listing_is_paginated(self):
        Cliente.objects.bulk_create([Cliente(nome=f'Cliente {index}') for index in range(6)])
        response = self.client.get(reverse('cadastro_master_listar', args=['clientes']), {'page': 2, 'page_size': 5})
        payload = response.json()
        self.assertEqual(payload['total'], 6)
        self.assertEqual(payload['page'], 2)
        self.assertEqual(len(payload['items']), 1)

    def test_read_only_user_cannot_access_management(self):
        readonly = get_user_model().objects.create_user(username='readonly_catalog', password='secret')
        from GO.rdo_access import SYSTEM_READ_ONLY_GROUP_NAME
        from django.contrib.auth.models import Group
        readonly.groups.add(Group.objects.get_or_create(name=SYSTEM_READ_ONLY_GROUP_NAME)[0])
        self.client.force_login(readonly)
        self.assertEqual(self.client.get(reverse('gerenciar_cadastros')).status_code, 403)
        self.assertEqual(self.client.get(reverse('cadastro_master_listar', args=['unidades'])).status_code, 403)

    def test_regular_user_needs_explicit_catalog_permission(self):
        from django.contrib.auth.models import Group
        from GO.rdo_access import CADASTROS_MANAGER_GROUP_NAME, ensure_rdo_access_groups

        user = get_user_model().objects.create_user(username='catalog_user', password='secret')
        self.client.force_login(user)
        self.assertEqual(self.client.get(reverse('gerenciar_cadastros')).status_code, 403)

        ensure_rdo_access_groups()
        user.groups.add(Group.objects.get(name=CADASTROS_MANAGER_GROUP_NAME))
        self.assertEqual(self.client.get(reverse('gerenciar_cadastros')).status_code, 200)
        self.assertEqual(self.client.get(reverse('cadastro_master_listar', args=['clientes'])).status_code, 200)

    def test_catalog_permission_is_available_in_user_permission_screen(self):
        from GO.rdo_access import CADASTROS_MANAGER_GROUP_NAME

        response = self.client.get(reverse('administracao_usuario_permissoes', args=[self.user.id]))
        self.assertEqual(response.status_code, 200)
        self.assertIn(CADASTROS_MANAGER_GROUP_NAME, [item['key'] for item in response.json()['permissions']])
