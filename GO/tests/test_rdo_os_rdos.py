from datetime import date
from decimal import Decimal

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from django.urls import reverse

from GO.models import Cliente, OrdemServico, RDO, Unidade


@override_settings(SECURE_SSL_REDIRECT=False)
class RdoOsRdosEndpointTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='rdo_export_user', password='x')
        self.admin_user = User.objects.create_superuser(
            username='rdo_export_admin',
            password='x',
            email='admin@example.com',
        )
        self.client.force_login(self.user)
        self.cliente = Cliente.objects.create(nome='Cliente PDF RDO')
        self.unidade = Unidade.objects.create(nome='Unidade PDF RDO')

    def _create_os(self, numero_os):
        return OrdemServico.objects.create(
            numero_os=numero_os,
            data_inicio=date.today(),
            dias_de_operacao=1,
            servico='LIMPEZA',
            metodo='Manual',
            pob=1,
            volume_tanque=Decimal('10.00'),
            Cliente=self.cliente,
            Unidade=self.unidade,
            tipo_operacao='Onshore',
            solicitante='Teste',
        )

    def test_returns_rdos_from_every_internal_record_with_same_os_number(self):
        first_os_record = self._create_os(7022)
        second_os_record = self._create_os(7022)
        first_rdo = RDO.objects.create(
            ordem_servico=first_os_record,
            rdo='1',
            data=date(2026, 1, 1),
        )
        last_rdo = RDO.objects.create(
            ordem_servico=second_os_record,
            rdo='29',
            data=date(2026, 1, 29),
        )

        response = self.client.get(
            reverse('api_rdo_os_rdos', args=[second_os_record.id]),
            HTTP_X_REQUESTED_WITH='XMLHttpRequest',
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload['success'])
        self.assertEqual(
            [(item['id'], item['rdo']) for item in payload['rdos']],
            [(first_rdo.id, '1'), (last_rdo.id, '29')],
        )

    def test_all_rows_across_duplicate_os_records_can_open_new_rdo(self):
        first_os_record = self._create_os(7022)
        second_os_record = self._create_os(7022)
        old_rdo = RDO.objects.create(
            ordem_servico=first_os_record,
            rdo='14',
            data=date(2026, 7, 28),
        )
        latest_rdo = RDO.objects.create(
            ordem_servico=second_os_record,
            rdo='29',
            data=date(2026, 8, 12),
        )
        self.client.force_login(self.admin_user)

        response = self.client.get(reverse('rdo'), {'per_page': 100})

        self.assertEqual(response.status_code, 200)
        html = response.content.decode()
        old_row = html.split(f'data-rdo-id="{old_rdo.id}"', 1)[1].split('</tr>', 1)[0]
        latest_row = html.split(f'data-rdo-id="{latest_rdo.id}"', 1)[1].split('</tr>', 1)[0]
        self.assertIn('data-latest-rdo-id="%s"' % latest_rdo.id, old_row)
        self.assertNotIn('disabled aria-disabled="true"', old_row)
        self.assertIn('open-supervisor', old_row)
        self.assertIn('open-supervisor', latest_row)
        self.assertNotIn('Somente o último RDO da OS pode originar', latest_row)

    def test_rdo_os_rdos_filters_by_date_range(self):
        os_record = self._create_os(7030)
        rdo1 = RDO.objects.create(ordem_servico=os_record, rdo='1', data=date(2026, 1, 5), data_inicio=date(2026, 1, 5))
        rdo2 = RDO.objects.create(ordem_servico=os_record, rdo='2', data=date(2026, 1, 15), data_inicio=date(2026, 1, 15))
        rdo3 = RDO.objects.create(ordem_servico=os_record, rdo='3', data=date(2026, 1, 25), data_inicio=date(2026, 1, 25))

        response = self.client.get(
            reverse('api_rdo_os_rdos', args=[os_record.id]),
            {'date_start': '2026-01-10', 'date_end': '2026-01-20'},
            HTTP_X_REQUESTED_WITH='XMLHttpRequest',
        )
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload['success'])
        self.assertEqual([item['id'] for item in payload['rdos']], [rdo2.id])

    def test_rdo_os_rdos_filters_by_service_and_tank(self):
        from GO.models import RdoTanque
        os_record = self._create_os(7031)
        rdo1 = RDO.objects.create(ordem_servico=os_record, rdo='1', servico_exec='LIMPEZA MECANICA', data=date(2026, 2, 1))
        rdo2 = RDO.objects.create(ordem_servico=os_record, rdo='2', servico_exec='HIDROJATO', data=date(2026, 2, 2))
        RdoTanque.objects.create(rdo=rdo2, tanque_codigo='TK-101', nome_tanque='Tanque de Carga')

        # Filtro por serviço
        response_servico = self.client.get(
            reverse('api_rdo_os_rdos', args=[os_record.id]),
            {'servico': 'HIDROJATO'},
            HTTP_X_REQUESTED_WITH='XMLHttpRequest',
        )
        self.assertEqual(response_servico.status_code, 200)
        self.assertEqual([item['id'] for item in response_servico.json()['rdos']], [rdo2.id])

        # Filtro por tanque
        response_tanque = self.client.get(
            reverse('api_rdo_os_rdos', args=[os_record.id]),
            {'tanque': 'TK-101'},
            HTTP_X_REQUESTED_WITH='XMLHttpRequest',
        )
        self.assertEqual(response_tanque.status_code, 200)
        self.assertEqual([item['id'] for item in response_tanque.json()['rdos']], [rdo2.id])

    def test_rdo_os_rdos_os_filter_is_fixed_and_ignores_query_os(self):
        os_record = self._create_os(7032)
        rdo1 = RDO.objects.create(ordem_servico=os_record, rdo='1', data=date(2026, 3, 1))

        # Passar os=9999 na querystring não deve filtrar para fora os RDOs da OS 7032
        response = self.client.get(
            reverse('api_rdo_os_rdos', args=[os_record.id]),
            {'os': '9999'},
            HTTP_X_REQUESTED_WITH='XMLHttpRequest',
        )
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload['success'])
        self.assertEqual([item['id'] for item in payload['rdos']], [rdo1.id])

    def test_rdo_os_rdos_returns_empty_list_when_no_rdo_matches_filter(self):
        os_record = self._create_os(7033)
        RDO.objects.create(ordem_servico=os_record, rdo='1', data=date(2026, 4, 1))

        response = self.client.get(
            reverse('api_rdo_os_rdos', args=[os_record.id]),
            {'date_start': '2027-01-01', 'date_end': '2027-12-31'},
            HTTP_X_REQUESTED_WITH='XMLHttpRequest',
        )
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload['success'])
        self.assertEqual(payload['rdos'], [])
