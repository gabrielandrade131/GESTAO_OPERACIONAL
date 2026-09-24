import json
from datetime import date
from decimal import Decimal
from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse

from GO.models import (
    Cliente,
    Financeiro,
    FinanceiroCampo,
    OrdemServico,
    ResponsavelCoordenador,
    Unidade,
)
from GO.views_comercial import _serialize_financeiro


class ComercialAtualizarPropostaTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(username="testuser", password="password123", is_staff=True, is_superuser=True)
        self.client.force_login(self.user)

        self.cliente_db, _ = Cliente.objects.get_or_create(nome="CLIENTE TESTE S/A")
        self.unidade_db, _ = Unidade.objects.get_or_create(nome="UNIDADE TESTE 01")
        self.responsavel = ResponsavelCoordenador.objects.filter(nome__iexact="FERNANDA BRAZ").first()
        if not self.responsavel:
            self.responsavel = ResponsavelCoordenador.objects.create(
                nome="FERNANDA BRAZ",
                responsavel_comercial=True,
                coordenador=False,
                ativo=True,
            )
        self.coordenador = ResponsavelCoordenador.objects.filter(nome__iexact="JONATHAN LIMA").first()
        if not self.coordenador:
            self.coordenador = ResponsavelCoordenador.objects.create(
                nome="JONATHAN LIMA",
                responsavel_comercial=False,
                coordenador=True,
                ativo=True,
            )

        self.os = OrdemServico.objects.create(
            numero_os=1001,
            data_inicio=date(2026, 1, 1),
            dias_de_operacao=1,
            pob=1,
            volume_tanque=Decimal("100.00"),
            servico="Limpeza de Tanque",
            metodo="Mecânico",
            tipo_operacao="Spot",
            solicitante="GILSON AGUIAR",
            Cliente=self.cliente_db,
            Unidade=self.unidade_db,
        )

        self.proposal = Financeiro.objects.create(
            proposta=4035,
            revisao=0,
            data_emissao=date(2026, 9, 15),
            data_solicitacao_proposta=date(2026, 9, 15),
            data_entrega_proposta=date(2026, 9, 15),
            previsao_contratacao=date(2026, 9, 15),
            natureza="Spot",
            heat_map=0,
            motivo_perda="Aguardando retorno do cliente",
            cliente=self.os,
            unidade=self.os,
            cordenador=self.os,
            tipo_operacao=self.os,
            metodo=self.os,
            data_inicio_frente=self.os,
            data_fim=self.os,
            data_fim_frente=self.os,
            responsavel="FERNANDA BRAZ",
            responsavel_cadastro=self.responsavel,
            status_proposta="Em Elaboração",
            ambiente_operacional="Offshore",
            pt_financeiro="Não Aplicável",
            pc_ptc="Pendente",
            uf="RJ",
            fonte_lead="Convite Direto",
            segmento_cliente="Petróleo e Gás",
            analise_critica=False,
            follow_up=json.dumps({
                "summary": "",
                "items": [],
                "history": [],
                "overrides": {
                    "empresa": "SEA1 OFFSHORE",
                    "unidade": "SAAM TORÁ",
                    "embarcacao_local": "SAAM TORÁ",
                }
            }),
        )
        self.url = reverse("comercial_atualizar_proposta", args=[self.proposal.pk])

    def test_update_commercial_data_with_overrides(self):
        payload = {
            "revisao": "00",
            "responsavel": "FERNANDA BRAZ",
            "data_entrega_proposta": "15/09/2026",
            "data_solicitacao_proposta": "15/09/2026",
            "data_fechamento_proposta": "",
            "previsao_contratacao": "15/09/2026",
            "follow_up": "Acompanhamento em andamento",
            "natureza": "Spot",
            "ambiente_operacional": "Offshore",
            "unidade": "NOVA UNIDADE SEM OS",
            "embarcacao_local": "NOVA EMBARCACAO",
            "heat_map": "1",
            "status_proposta": "Em Elaboração",
            "motivo_perda": "Aguardando retorno do cliente",
            "pt_financeiro": "Não Aplicável",
            "pc_ptc": "Pendente",
            "cliente": "NOVO CLIENTE SEM OS",
            "uf": "RJ",
            "solicitante": "GILSON AGUIAR",
            "email_solicitante": "gilson.aguiar@saamtowage.com",
            "telefone_solicitante": "22999999999",
            "po": "PO-123",
            "rfi": "RFI-456",
            "fonte_lead": "Convite Direto",
            "segmento_cliente": "Petróleo e Gás",
            "comentario": "Observação de teste",
        }
        response = self.client.post(self.url, data=json.dumps(payload), content_type="application/json", secure=True)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["success"])
        self.assertEqual(data["proposal"]["empresa"], "NOVO CLIENTE SEM OS")
        self.assertEqual(data["proposal"]["unidade"], "NOVA UNIDADE SEM OS")
        self.assertEqual(data["proposal"]["embarcacaoLocal"], "NOVA EMBARCACAO")

    def test_update_scope_with_tempo_contrato_dias_string(self):
        payload = {
            "servico": "LIMPEZA DE TANQUE DE DIESEL",
            "descricao_proposta": "Serviço completo",
            "estimativo_receita": "R$ 75.000,00",
            "tempo_contrato_dias": "30 dias",
            "campos": [
                {"nome": "SERVICO_LIMPEZA_TANQUES", "preco_unitario": "75000.00", "quantidade": "1"}
            ]
        }
        response = self.client.post(self.url, data=json.dumps(payload), content_type="application/json", secure=True)
        self.assertEqual(response.status_code, 200)
        self.proposal.refresh_from_db()
        self.assertEqual(self.proposal.tempo_contrato_dias, 30)
        self.assertEqual(self.proposal.estimativo_receita, Decimal("75000.00"))
        self.assertEqual(self.proposal.campos.count(), 1)

    def test_update_with_formatted_rev_and_heatmap(self):
        payload = {
            "revisao": "REV 02",
            "heat_map": "2 - Alto",
        }
        response = self.client.post(self.url, data=json.dumps(payload), content_type="application/json", secure=True)
        self.assertEqual(response.status_code, 200)
        self.proposal.refresh_from_db()
        self.assertEqual(self.proposal.revisao, 2)
        self.assertEqual(self.proposal.heat_map, 2)

    def test_update_with_empty_coordenador(self):
        payload = {
            "coordenador": "",
        }
        response = self.client.post(self.url, data=json.dumps(payload), content_type="application/json", secure=True)
        self.assertEqual(response.status_code, 200)
        self.proposal.refresh_from_db()
        self.assertIsNone(self.proposal.coordenador_cadastro)
