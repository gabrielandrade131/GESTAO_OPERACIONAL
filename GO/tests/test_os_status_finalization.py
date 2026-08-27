from datetime import date
from decimal import Decimal

from django.contrib.auth.models import Group, User
from django.test import Client, TestCase
from django.urls import reverse

from GO.models import (
    AvaliacaoSupervisorMovimentacao,
    Cliente,
    OrdemServico,
    ResponsavelCoordenador,
    Unidade,
)


class OrdemServicoStatusFinalizationTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.cliente = Cliente.objects.create(nome='Cliente Teste')
        self.unidade = Unidade.objects.create(nome='Unidade Teste')
        self.coordenador_obj = ResponsavelCoordenador.objects.create(
            nome='Coordenador Teste Status',
            coordenador=True,
        )
        self.coordenador = self.coordenador_obj.nome
        self.supervisor_group, _ = Group.objects.get_or_create(name='Supervisor')
        self.supervisor = User.objects.create_user(
            username='supervisor_status_os',
            password='senha123',
        )
        self.supervisor_group.user_set.add(self.supervisor)

    def _create_os(self, numero_os, status_operacao='Programada', status_geral='Programada'):
        return OrdemServico.objects.create(
            numero_os=numero_os,
            data_inicio=date(2026, 3, 1),
            data_fim=None,
            dias_de_operacao=0,
            servico='COLETA DE AR',
            servicos='COLETA DE AR',
            metodo='Manual',
            pob=1,
            tanque='',
            tanques=None,
            volume_tanque=Decimal('0.00'),
            Cliente=self.cliente,
            Unidade=self.unidade,
            tipo_operacao='Onshore',
            solicitante='Solicitante Teste',
            coordenador=self.coordenador,
            supervisor=self.supervisor,
            status_operacao=status_operacao,
            status_geral=status_geral,
            status_comercial='Em aberto',
            status_planejamento='Pendente',
        )

    def test_edicao_finalizada_propaga_status_para_todas_as_linhas_da_mesma_os(self):
        os_principal = self._create_os(numero_os=7001, status_operacao='Em Andamento', status_geral='Programada')
        os_mesma_ordem = self._create_os(numero_os=7001, status_operacao='Paralizada', status_geral='Paralizada')
        os_outra_ordem = self._create_os(numero_os=7002, status_operacao='Em Andamento', status_geral='Programada')
        for movimentacao in (os_principal, os_mesma_ordem):
            AvaliacaoSupervisorMovimentacao.objects.create(
                ordem_servico=movimentacao,
                supervisor=self.supervisor,
                nota=AvaliacaoSupervisorMovimentacao.AVALIACAO_BOM,
                avaliado_por=self.supervisor,
            )

        response = self.client.post(
            reverse('editar_os_post'),
            data={
                'os_id': str(os_principal.pk),
                'status_operacao': 'Finalizada',
            },
            HTTP_X_REQUESTED_WITH='XMLHttpRequest',
            HTTP_HOST='localhost',
            secure=True,
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload.get('success'))
        self.assertTrue(payload.get('status_finalizado_em_toda_os'))
        self.assertEqual(payload.get('same_os_status_updates'), 1)

        os_principal.refresh_from_db()
        os_mesma_ordem.refresh_from_db()
        os_outra_ordem.refresh_from_db()

        self.assertEqual(os_principal.status_operacao, 'Finalizada')
        self.assertEqual(os_principal.status_geral, 'Finalizada')
        self.assertEqual(os_mesma_ordem.status_operacao, 'Finalizada')
        self.assertEqual(os_mesma_ordem.status_geral, 'Finalizada')
        self.assertEqual(os_outra_ordem.status_operacao, 'Em Andamento')
        self.assertEqual(os_outra_ordem.status_geral, 'Programada')

    def test_nova_linha_com_supervisor_nao_pode_nascer_finalizada_sem_avaliacao(self):
        os_existente = self._create_os(numero_os=8001, status_operacao='Em Andamento', status_geral='Programada')

        response = self.client.post(
            reverse('lista_servicos'),
            data={
                'box_opcao': 'existente',
                'os_existente': str(os_existente.pk),
                'Cliente': str(self.cliente.pk),
                'Unidade': str(self.unidade.pk),
                'solicitante': 'Solicitante Teste',
                'servico': 'COLETA DE AR',
                'metodo': 'Manual',
                'pob': '1',
                'data_inicio': '2026-03-01',
                'tipo_operacao': 'Onshore',
                'status_operacao': 'Finalizada',
                'status_geral': 'Programada',
                'status_comercial': 'Em aberto',
                'status_planejamento': 'Pendente',
                'coordenador': self.coordenador,
                'supervisor': str(self.supervisor.pk),
                'volume_tanque': '0',
            },
            HTTP_X_REQUESTED_WITH='XMLHttpRequest',
            HTTP_HOST='localhost',
            secure=True,
        )

        self.assertEqual(response.status_code, 400)
        payload = response.json()
        self.assertFalse(payload.get('success'))
        self.assertEqual(payload.get('code'), 'supervisor_evaluation_required')

        linhas_mesma_os = list(OrdemServico.objects.filter(numero_os=8001).order_by('id'))
        self.assertEqual(len(linhas_mesma_os), 1)
        self.assertEqual(linhas_mesma_os[0].status_operacao, 'Em Andamento')

    def test_nova_os_aceita_label_exibido_do_servico(self):
        response = self.client.post(
            reverse('lista_servicos'),
            data={
                'box_opcao': 'nova',
                'os_existente': '',
                'Cliente': str(self.cliente.pk),
                'Unidade': str(self.unidade.pk),
                'solicitante': 'Solicitante Teste',
                'servico': 'ADEQUAÇÃO DE EQUPAMENTOS / EQUIPAMENT ADJUSTMENTS',
                'metodo': 'Manual',
                'pob': '1',
                'data_inicio': '2026-03-01',
                'tipo_operacao': 'Onshore',
                'status_operacao': 'Programada',
                'status_geral': 'Programada',
                'status_comercial': 'Em aberto',
                'status_planejamento': 'Pendente',
                'coordenador': self.coordenador,
                'supervisor': str(self.supervisor.pk),
                'volume_tanque': '0',
            },
            HTTP_X_REQUESTED_WITH='XMLHttpRequest',
            HTTP_HOST='localhost',
            secure=True,
        )

        self.assertEqual(response.status_code, 200)
        criada = OrdemServico.objects.get(pk=response.json()['os']['id'])
        self.assertEqual(criada.servico, 'ADEQUAÇÃO DE EQUIPAMENTOS')

    def test_nova_movimentacao_sem_supervisor_pode_ser_finalizada(self):
        response = self.client.post(
            reverse('lista_servicos'),
            data={
                'box_opcao': 'nova',
                'os_existente': '',
                'numero_os': '8003',
                'Cliente': str(self.cliente.pk),
                'Unidade': str(self.unidade.pk),
                'solicitante': 'Solicitante Teste',
                'servico': 'COLETA DE AR',
                'metodo': 'Manual',
                'pob': '1',
                'data_inicio': '2026-03-01',
                'tipo_operacao': 'Onshore',
                'status_operacao': 'Em Andamento',
                'status_geral': 'Finalizada',
                'status_comercial': 'Em aberto',
                'status_planejamento': 'Pendente',
                'coordenador': self.coordenador,
                'supervisor': '',
                'volume_tanque': '0',
            },
            HTTP_X_REQUESTED_WITH='XMLHttpRequest',
            HTTP_HOST='localhost',
            secure=True,
        )

        self.assertEqual(response.status_code, 200)
        criada = OrdemServico.objects.get(pk=response.json()['os']['id'])
        self.assertIsNone(criada.supervisor_id)
        self.assertEqual(criada.status_geral, 'Finalizada')
