from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.test import TestCase

from GO.models import (
    AvaliacaoSupervisorMovimentacao,
    Cliente,
    OrdemServico,
    ResponsavelCoordenador,
    Unidade,
)


class AvaliacaoSupervisorMovimentacaoModelTests(TestCase):
    def setUp(self):
        user_model = get_user_model()
        self.coordenador_user = user_model.objects.create_user(
            username='coordenador.avaliador',
            first_name='Carla',
            last_name='Coordenadora',
        )
        self.supervisor = user_model.objects.create_user(
            username='supervisor.avaliado',
            first_name='Sergio',
            last_name='Supervisor',
        )
        self.outro_supervisor = user_model.objects.create_user(
            username='outro.supervisor',
        )
        self.coordenador = ResponsavelCoordenador.objects.create(
            nome='Carla Coordenadora',
            coordenador=True,
            usuario=self.coordenador_user,
        )
        self.cliente = Cliente.objects.create(nome='Cliente Avaliacao Supervisor')
        self.unidade = Unidade.objects.create(nome='Unidade Avaliacao Supervisor')

    def criar_movimentacao(self, supervisor=None):
        return OrdemServico.objects.create(
            numero_os=97001,
            data_inicio=date(2026, 8, 1),
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
            coordenador=self.coordenador.nome,
            coordenador_cadastro=self.coordenador,
            supervisor=supervisor,
            status_operacao='Em Andamento',
            status_geral='Em Andamento',
            status_comercial='Em aberto',
            status_planejamento='Pendente',
        )

    def test_salva_avaliacao_e_preserva_nome_do_supervisor(self):
        movimentacao = self.criar_movimentacao(supervisor=self.supervisor)

        avaliacao = AvaliacaoSupervisorMovimentacao.objects.create(
            ordem_servico=movimentacao,
            supervisor=self.supervisor,
            nota=AvaliacaoSupervisorMovimentacao.AVALIACAO_BOM,
            avaliado_por=self.coordenador_user,
        )

        self.assertEqual(avaliacao.supervisor_nome_snapshot, 'Sergio Supervisor')
        self.assertEqual(movimentacao.avaliacao_supervisor, avaliacao)

    def test_nao_permite_avaliar_movimentacao_sem_supervisor(self):
        movimentacao = self.criar_movimentacao(supervisor=None)

        with self.assertRaises(ValidationError):
            AvaliacaoSupervisorMovimentacao.objects.create(
                ordem_servico=movimentacao,
                supervisor=self.supervisor,
                nota=AvaliacaoSupervisorMovimentacao.AVALIACAO_BOM,
                avaliado_por=self.coordenador_user,
            )

    def test_snapshot_do_nome_nao_muda_apos_renomear_usuario(self):
        movimentacao = self.criar_movimentacao(supervisor=self.supervisor)
        avaliacao = AvaliacaoSupervisorMovimentacao.objects.create(
            ordem_servico=movimentacao,
            supervisor=self.supervisor,
            nota=AvaliacaoSupervisorMovimentacao.AVALIACAO_BOM,
            avaliado_por=self.coordenador_user,
        )

        self.supervisor.first_name = 'Nome'
        self.supervisor.last_name = 'Alterado'
        self.supervisor.save(update_fields=['first_name', 'last_name'])
        avaliacao.nota = AvaliacaoSupervisorMovimentacao.AVALIACAO_OTIMO
        avaliacao.save()

        self.assertEqual(avaliacao.supervisor_nome_snapshot, 'Sergio Supervisor')

    def test_nao_permite_avaliar_supervisor_diferente_do_atual(self):
        movimentacao = self.criar_movimentacao(supervisor=self.supervisor)

        with self.assertRaises(ValidationError):
            AvaliacaoSupervisorMovimentacao.objects.create(
                ordem_servico=movimentacao,
                supervisor=self.outro_supervisor,
                nota=AvaliacaoSupervisorMovimentacao.AVALIACAO_BOM,
                avaliado_por=self.coordenador_user,
            )

    def test_exige_justificativa_para_ruim_e_pessimo(self):
        movimentacao = self.criar_movimentacao(supervisor=self.supervisor)

        with self.assertRaises(ValidationError):
            AvaliacaoSupervisorMovimentacao.objects.create(
                ordem_servico=movimentacao,
                supervisor=self.supervisor,
                nota=AvaliacaoSupervisorMovimentacao.AVALIACAO_RUIM,
                justificativa='   ',
                avaliado_por=self.coordenador_user,
            )

    def test_usuario_so_pode_representar_um_coordenador(self):
        with self.assertRaises(ValidationError):
            ResponsavelCoordenador.objects.create(
                nome='Outra Coordenadora',
                coordenador=True,
                usuario=self.coordenador_user,
            )
