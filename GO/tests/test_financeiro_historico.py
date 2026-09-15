from datetime import date

from django.test import TestCase

from GO.models import AnexoPropostaComercial, Cliente, Financeiro, FinanceiroCampo, OrdemServico, RDO, RdoTanque, Unidade
from GO.views_comercial import _serialize_financeiro, _serialize_proposta_anexo


class FinanceiroHistoricoIdentityTests(TestCase):
    def setUp(self):
        cliente = Cliente.objects.create(nome="Cliente de apoio")
        unidade = Unidade.objects.create(nome="Unidade de apoio")
        self.ordem = OrdemServico.objects.create(
            numero_os=900001,
            data_inicio=date(2026, 1, 1),
            dias_de_operacao=1,
            servico="LIMPEZA DE TANQUE DE OLEO",
            metodo="Manual",
            pob=1,
            volume_tanque=1,
            tipo_operacao="Offshore",
            solicitante="Teste",
            Cliente=cliente,
            Unidade=unidade,
        )
        self.tanque = RdoTanque.objects.create(rdo=RDO.objects.create())

    def _proposal(self, cliente):
        return Financeiro.objects.create(
            proposta=2992,
            revisao=0,
            importado_historico=True,
            data_emissao=date(2026, 1, 10),
            data_solicitacao_proposta=date(2026, 1, 10),
            previsao_contratacao=date(2026, 1, 10),
            follow_up=(
                '{"overrides": {"empresa": "' + cliente
                + '", "tipo_operacao": "Offshore"}, "items": []}'
            ),
            natureza=None,
            heat_map=0,
            cliente=None,
            unidade=self.ordem,
            tipo_operacao=self.ordem,
            metodo=self.ordem,
            data_inicio_frente=self.ordem,
            data_fim=self.ordem,
            data_fim_frente=self.ordem,
            cordenador=self.ordem,
            volume_tanque_exec=self.tanque,
            status_proposta=None,
            responsavel="Responsavel Historico",
            treinamentos="",
            ajuste_operacional="",
            analise_critica=False,
            pt_financeiro="Pendente",
            pc_ptc="Pendente",
            uf=None,
            estimativo_receita=None,
            fonte_lead=None,
            segmento_cliente=None,
        )

    def test_numero_comercial_reutilizado_tem_ids_e_relacoes_independentes(self):
        cliente_a = self._proposal("Cliente A")
        cliente_b = self._proposal("Cliente B")
        FinanceiroCampo.objects.create(
            financeiro=cliente_a,
            nome="Bomba Pneumatica",
            preco_unitario=10,
            quantidade=1,
        )

        self.assertNotEqual(cliente_a.pk, cliente_b.pk)
        self.assertEqual(Financeiro.objects.filter(proposta=2992).count(), 2)
        self.assertEqual(cliente_a.campos.count(), 1)
        self.assertEqual(cliente_b.campos.count(), 0)

    def test_campos_historicos_ausentes_nao_sao_convertidos_em_receita_zero(self):
        proposal = self._proposal("Cliente Historico")

        serialized = _serialize_financeiro(proposal)

        self.assertEqual(serialized["empresa"], "Cliente Historico")
        self.assertEqual(serialized["estimativaReceita"], "")
        self.assertIsNone(serialized["estimativaReceitaValor"])
        self.assertEqual(serialized["statusProposta"], "")

    def test_anexo_com_arquivo_ausente_nao_impede_serializacao(self):
        proposal = self._proposal("Cliente Historico")
        anexo = AnexoPropostaComercial.objects.create(
            financeiro=proposal,
            arquivo="comercial/proposta_999999/arquivo_inexistente.pdf",
            nome_original="arquivo_inexistente.pdf",
        )

        serialized = _serialize_proposta_anexo(anexo)

        self.assertEqual(serialized["tamanho"], 0)
