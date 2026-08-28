from datetime import date
from decimal import Decimal

from django.contrib.auth.models import User
from django.test import TestCase
from django.test.utils import override_settings
from django.urls import reverse

from GO.models import Cliente, OrdemServico, Unidade


@override_settings(STATICFILES_STORAGE='django.contrib.staticfiles.storage.StaticFilesStorage')
class HomeStatusDatabookFilterTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='home_filter_user',
            password='senha123',
        )
        self.client.force_login(self.user)

        self.cliente = Cliente.objects.create(nome='Cliente Filtro Home')
        self.unidade = Unidade.objects.create(nome='Unidade Filtro Home')
        self.coordenador = next(value for value, _ in OrdemServico.COORDENADORES if value)

    def _create_os(self, numero_os, status_databook, *, coordenador=None, servico='COLETA DE AR'):
        return OrdemServico.objects.create(
            numero_os=numero_os,
            data_inicio=date(2026, 3, 26),
            data_fim=None,
            dias_de_operacao=0,
            servico=servico,
            servicos=servico,
            metodo='Manual',
            pob=1,
            tanque='',
            tanques=None,
            volume_tanque=Decimal('0.00'),
            Cliente=self.cliente,
            Unidade=self.unidade,
            tipo_operacao='Onshore',
            solicitante='Solicitante Teste',
            coordenador=coordenador or self.coordenador,
            status_operacao='Programada',
            status_geral='Programada',
            status_comercial='Em aberto',
            status_planejamento='Pendente',
            status_databook=status_databook,
        )

    def test_home_filters_by_status_databook_and_keeps_active_filter(self):
        os_finalizada = self._create_os(numero_os=92001, status_databook='Finalizado')
        self._create_os(numero_os=92002, status_databook='Em Andamento')

        response = self.client.get(reverse('home'), {'status_databook': 'Finalizado'})

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'id="filter_especificacao"', html=False)
        self.assertContains(response, 'id="filter_status_databook"', html=False)
        self.assertContains(response, 'list="status_databook_datalist"', html=False)
        self.assertEqual(
            [obj.pk for obj in response.context['servicos'].object_list],
            [os_finalizada.pk],
        )
        self.assertEqual(
            response.context['filtros_ativos'].get('Status Databook'),
            'Finalizado',
        )

    def test_lista_servicos_get_filters_by_status_databook(self):
        os_finalizada = self._create_os(numero_os=93001, status_databook='Finalizado')
        self._create_os(numero_os=93002, status_databook='Em Andamento')

        response = self.client.get(reverse('lista_servicos'), {'status_databook': 'Finalizado'})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            [obj.pk for obj in response.context['servicos'].object_list],
            [os_finalizada.pk],
        )

    def test_home_keeps_coordinator_name_as_a_complete_phrase(self):
        os_ivonei = self._create_os(
            numero_os=94001,
            status_databook='Em Andamento',
            coordenador='IVONEI DE SOUZA',
        )
        self._create_os(
            numero_os=94002,
            status_databook='Em Andamento',
            coordenador='RICARDO PIRES DE MOURA JUNIOR',
        )

        response = self.client.get(reverse('home'), {'coordenador': 'IVONEI DE SOUZA'})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            [obj.pk for obj in response.context['servicos'].object_list],
            [os_ivonei.pk],
        )

    def test_home_keeps_other_multiword_filters_as_complete_phrases(self):
        os_em_andamento = self._create_os(
            numero_os=95001,
            status_databook='Em Andamento',
            servico='COLETA DE AR',
        )
        self._create_os(
            numero_os=95002,
            status_databook='Em aberto',
            servico='COLETA DE OLEO',
        )

        status_response = self.client.get(
            reverse('home'),
            {'status_databook': 'Em Andamento'},
        )
        service_response = self.client.get(
            reverse('home'),
            {'servico': 'COLETA DE AR'},
        )

        self.assertEqual(
            [obj.pk for obj in status_response.context['servicos'].object_list],
            [os_em_andamento.pk],
        )
        self.assertEqual(
            [obj.pk for obj in service_response.context['servicos'].object_list],
            [os_em_andamento.pk],
        )

    def test_home_still_accepts_explicit_multiple_values(self):
        os_ivonei = self._create_os(
            numero_os=96001,
            status_databook='Em Andamento',
            coordenador='IVONEI DE SOUZA',
        )
        os_ricardo = self._create_os(
            numero_os=96002,
            status_databook='Em Andamento',
            coordenador='RICARDO PIRES DE MOURA JUNIOR',
        )

        response = self.client.get(
            reverse('home'),
            {'coordenador': 'IVONEI DE SOUZA; RICARDO PIRES DE MOURA JUNIOR'},
        )

        self.assertEqual(
            {obj.pk for obj in response.context['servicos'].object_list},
            {os_ivonei.pk, os_ricardo.pk},
        )
