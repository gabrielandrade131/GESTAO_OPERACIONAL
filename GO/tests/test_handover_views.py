from django.contrib.auth import get_user_model
from django.test import TestCase

from GO.models import SupervisorHandover


class HandoverViewsTest(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username='handover-view-user',
            password='test-password',
        )
        self.client.force_login(self.user)

    def test_list_renders_without_supervisor_back_and_create_uses_current_model(self):
        SupervisorHandover.objects.create(
            periodo_data='24/08/2026',
            supervisor_atual=self.user,
        )

        response = self.client.get('/handover/')
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, '—')

        response = self.client.post(
            '/handover/novo/',
            {
                'periodo_data': '24/08/2026',
                'servico_concluido': 'Serviço concluído',
                'servico_em_andamento': 'Sem pendências',
                'orientacoes_observacoes': 'Nenhuma',
            },
        )
        self.assertRedirects(response, '/handover/')
        self.assertEqual(SupervisorHandover.objects.count(), 2)

    def test_latest_api_returns_only_the_authenticated_supervisors_handover(self):
        other_user = get_user_model().objects.create_user(
            username='outro-supervisor',
            password='test-password',
        )
        SupervisorHandover.objects.create(
            periodo_data='23/08/2026',
            supervisor_atual=other_user,
            servico_concluido='Não deve aparecer',
        )
        SupervisorHandover.objects.create(
            periodo_data='24/08/2026',
            supervisor_atual=self.user,
            servico_concluido='Último handover do supervisor atual',
            itens_equipamentos=[
                {'item': 1, 'descricao': 'Container', 'quantidade': '2', 'comentario': 'Convés'},
            ],
        )

        response = self.client.get('/api/handover/ultimo/')

        self.assertEqual(response.status_code, 200)
        handover = response.json().get('handover')
        self.assertEqual(handover.get('servico_concluido'), 'Último handover do supervisor atual')
        self.assertEqual(handover.get('itens_equipamentos')[0]['quantidade'], '2')
