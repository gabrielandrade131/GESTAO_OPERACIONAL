import json
from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.test import TestCase
from django.urls import reverse

from GO.forms import OrdemServicoForm
from GO.models import (
    AvaliacaoSupervisorMovimentacao,
    Cliente,
    OrdemServico,
    ResponsavelCoordenador,
    Unidade,
)
from GO.rdo_access import SYSTEM_READ_ONLY_GROUP_NAME


class SupervisorMovementEvaluationApiTests(TestCase):
    def setUp(self):
        user_model = get_user_model()
        self.coordenador_user = user_model.objects.create_user(
            username='coord.api', password='senha123', first_name='Celia', last_name='Coordenadora'
        )
        self.outro_user = user_model.objects.create_user(username='outro.api', password='senha123')
        self.supervisor = user_model.objects.create_user(
            username='supervisor.api', first_name='Samuel', last_name='Supervisor'
        )
        self.outro_supervisor = user_model.objects.create_user(username='supervisor.novo')
        self.coordenador = ResponsavelCoordenador.objects.create(
            nome='Celia Coordenadora', coordenador=True, usuario=self.coordenador_user
        )
        self.cliente = Cliente.objects.create(nome='Cliente API Avaliacao')
        self.unidade = Unidade.objects.create(nome='Unidade API Avaliacao')

    def criar_movimentacao(self, numero_os=98001, supervisor='default', **overrides):
        if supervisor == 'default':
            supervisor = self.supervisor
        values = {
            'numero_os': numero_os,
            'data_inicio': date(2026, 8, 1),
            'data_fim': None,
            'dias_de_operacao': 0,
            'servico': 'COLETA DE AR',
            'servicos': 'COLETA DE AR',
            'metodo': 'Manual',
            'pob': 1,
            'tanque': '',
            'tanques': None,
            'volume_tanque': Decimal('0.00'),
            'Cliente': self.cliente,
            'Unidade': self.unidade,
            'tipo_operacao': 'Onshore',
            'solicitante': 'Solicitante Teste',
            'coordenador': self.coordenador.nome,
            'coordenador_cadastro': self.coordenador,
            'supervisor': supervisor,
            'status_operacao': 'Em Andamento',
            'status_geral': 'Em Andamento',
            'status_comercial': 'Em aberto',
            'status_planejamento': 'Pendente',
        }
        values.update(overrides)
        return OrdemServico.objects.create(**values)

    def salvar_avaliacao(self, movimentacao, nota='BOM', justificativa=''):
        self.client.force_login(self.coordenador_user)
        return self.client.post(
            reverse('api_avaliacao_supervisor_movimentacao', args=[movimentacao.pk]),
            data=json.dumps({'nota': nota, 'justificativa': justificativa}),
            content_type='application/json',
        )

    def test_coordenador_vinculado_salva_e_consulta_avaliacao(self):
        movimentacao = self.criar_movimentacao()
        response = self.salvar_avaliacao(movimentacao)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['evaluation']['nota'], 'BOM')

        consulta = self.client.get(reverse('api_avaliacao_supervisor_movimentacao', args=[movimentacao.pk]))
        self.assertEqual(consulta.status_code, 200)
        self.assertTrue(consulta.json()['can_evaluate'])
        self.assertEqual(consulta.json()['supervisor']['nome'], 'Samuel Supervisor')

    def test_home_renderiza_componente_e_supervisor_e_opcional(self):
        self.client.force_login(self.coordenador_user)

        response = self.client.get(reverse('home'))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'id="supervisor-evaluation-card"', html=False)
        self.assertContains(response, 'id="supervisor-evaluation-save"', html=False)
        self.assertFalse(OrdemServicoForm().fields['supervisor'].required)

    def test_home_exibe_selo_quando_supervisor_ja_foi_avaliado(self):
        movimentacao = self.criar_movimentacao()
        self.assertEqual(self.salvar_avaliacao(movimentacao).status_code, 200)

        response = self.client.get(reverse('home'))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'home-supervisor-eval-badge is-complete', html=False)
        self.assertContains(response, 'Avaliado', html=False)

    def test_usuario_comum_com_acesso_de_edicao_pode_avaliar(self):
        movimentacao = self.criar_movimentacao()
        self.client.force_login(self.outro_user)
        response = self.client.post(
            reverse('api_avaliacao_supervisor_movimentacao', args=[movimentacao.pk]),
            {'nota': 'BOM'},
        )
        self.assertEqual(response.status_code, 200)
        avaliacao = AvaliacaoSupervisorMovimentacao.objects.get(ordem_servico=movimentacao)
        self.assertEqual(avaliacao.avaliado_por_id, self.outro_user.pk)

    def test_usuario_somente_visualizacao_nao_pode_avaliar(self):
        movimentacao = self.criar_movimentacao()
        grupo, _ = Group.objects.get_or_create(name=SYSTEM_READ_ONLY_GROUP_NAME)
        self.outro_user.groups.add(grupo)
        self.client.force_login(self.outro_user)

        consulta = self.client.get(
            reverse('api_avaliacao_supervisor_movimentacao', args=[movimentacao.pk])
        )
        response = self.client.post(
            reverse('api_avaliacao_supervisor_movimentacao', args=[movimentacao.pk]),
            {'nota': 'BOM'},
        )

        self.assertEqual(consulta.status_code, 200)
        self.assertFalse(consulta.json()['can_evaluate'])
        self.assertEqual(response.status_code, 403)
        self.assertFalse(AvaliacaoSupervisorMovimentacao.objects.filter(ordem_servico=movimentacao).exists())

    def test_ruim_exige_justificativa(self):
        movimentacao = self.criar_movimentacao()
        response = self.salvar_avaliacao(movimentacao, nota='RUIM')
        self.assertEqual(response.status_code, 400)
        self.assertIn('justificativa', response.json()['error'].lower())

    def test_finalizacao_com_supervisor_exige_avaliacao(self):
        movimentacao = self.criar_movimentacao()
        self.client.force_login(self.coordenador_user)
        response = self.client.post(
            reverse('editar_os_post'),
            {'os_id': movimentacao.pk, 'status_geral': 'Finalizada'},
            HTTP_X_REQUESTED_WITH='XMLHttpRequest',
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()['code'], 'supervisor_evaluation_required')
        movimentacao.refresh_from_db()
        self.assertEqual(movimentacao.status_geral, 'Em Andamento')

    def test_finalizacao_com_supervisor_e_avaliacao_e_permitida(self):
        movimentacao = self.criar_movimentacao()
        self.assertEqual(self.salvar_avaliacao(movimentacao).status_code, 200)
        response = self.client.post(
            reverse('editar_os_post'),
            {'os_id': movimentacao.pk, 'status_geral': 'Finalizada'},
            HTTP_X_REQUESTED_WITH='XMLHttpRequest',
        )
        self.assertEqual(response.status_code, 200)
        movimentacao.refresh_from_db()
        self.assertEqual(movimentacao.status_geral, 'Finalizada')

    def test_finalizacao_sem_supervisor_e_permitida(self):
        movimentacao = self.criar_movimentacao(supervisor=None)
        self.client.force_login(self.coordenador_user)
        response = self.client.post(
            reverse('editar_os_post'),
            {'os_id': movimentacao.pk, 'status_geral': 'Finalizada'},
            HTTP_X_REQUESTED_WITH='XMLHttpRequest',
        )
        self.assertEqual(response.status_code, 200)
        movimentacao.refresh_from_db()
        self.assertEqual(movimentacao.status_geral, 'Finalizada')

    def test_edicao_de_registro_ja_finalizado_nao_exige_avaliacao_retroativa(self):
        movimentacao = self.criar_movimentacao(status_geral='Finalizada')
        self.client.force_login(self.coordenador_user)
        response = self.client.post(
            reverse('editar_os_post'),
            {'os_id': movimentacao.pk, 'status_comercial': 'Realizada'},
            HTTP_X_REQUESTED_WITH='XMLHttpRequest',
        )
        self.assertEqual(response.status_code, 200)
        movimentacao.refresh_from_db()
        self.assertEqual(movimentacao.status_comercial, 'Realizada')

    def test_avaliacao_existente_impede_troca_do_supervisor(self):
        movimentacao = self.criar_movimentacao()
        self.assertEqual(self.salvar_avaliacao(movimentacao).status_code, 200)
        response = self.client.post(
            reverse('editar_os_post'),
            {'os_id': movimentacao.pk, 'supervisor': self.outro_supervisor.pk},
            HTTP_X_REQUESTED_WITH='XMLHttpRequest',
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()['code'], 'supervisor_evaluation_conflict')
        movimentacao.refresh_from_db()
        self.assertEqual(movimentacao.supervisor_id, self.supervisor.pk)

    def test_finalizacao_da_operacao_exige_avaliacao_das_movimentacoes_propagadas(self):
        principal = self.criar_movimentacao(numero_os=98009, frente='1')
        pendente = self.criar_movimentacao(numero_os=98009, frente='2')
        self.assertEqual(self.salvar_avaliacao(principal).status_code, 200)
        response = self.client.post(
            reverse('editar_os_post'),
            {'os_id': principal.pk, 'status_operacao': 'Finalizada'},
            HTTP_X_REQUESTED_WITH='XMLHttpRequest',
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()['movimentacoes_pendentes'][0]['id'], pendente.pk)
