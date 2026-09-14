# -*- coding: utf-8 -*-
from datetime import date, time
from django.test import TestCase, Client
from django.contrib.auth import get_user_model
from django.urls import reverse
from decimal import Decimal
import json

from GO.models import OrdemServico, Unidade, Cliente, RDO, RDOAtividade, RDOMembroEquipe, RdoTanque
from GO.rdo_whatsapp import build_rdo_whatsapp_text

User = get_user_model()


class RDOWhatsAppTextTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='supervisor_test',
            password='password123',
            first_name='Gabriel',
            last_name='Alves'
        )
        self.client = Client()
        self.client.login(username='supervisor_test', password='password123')

        self.cliente = Cliente.objects.create(nome='Petrobras S.A.')
        self.unidade = Unidade.objects.create(nome='P-50')
        self.os = OrdemServico.objects.create(
            numero_os=6048,
            Cliente=self.cliente,
            Unidade=self.unidade,
            servico='LIMPEZA DE TANQUE DE CARGA',
            supervisor=self.user,
            data_inicio=date(2026, 9, 14),
            dias_de_operacao=1,
            pob=4,
            volume_tanque=Decimal('150.00'),
            metodo='Mecanizada',
            tipo_operacao='Offshore',
            solicitante='Petrobras',
        )

        comps = {
            str(i): {'mecanizada': 100 if i >= 8 else (50 if i == 7 else 0), 'fina': 100 if i == 10 else 0}
            for i in range(1, 11)
        }

        self.rdo = RDO.objects.create(
            ordem_servico=self.os,
            rdo='01',
            data=date(2026, 9, 14),
            data_inicio=date(2026, 9, 14),
            turno='Diurno',
            exist_pt=True,
            pt_manha='1234',
            pt_tarde='1235',
            nome_tanque='TQ-01',
            volume_tanque_exec=Decimal('150.00'),
            servico_exec='Limpeza Mecanizada',
            confinado=True,
            h2s_ppm=Decimal('0.00'),
            lel=Decimal('0.00'),
            co_ppm=Decimal('0.00'),
            o2_percent=Decimal('20.90'),
            entrada_confinado_1=time(8, 0),
            saida_confinado_1=time(11, 30),
            entrada_confinado_2=time(13, 0),
            saida_confinado_2=time(17, 0),
            operadores_simultaneos=4,
            observacoes_rdo_pt='Operação realizada com sucesso e dentro dos padrões de segurança.',
            tempo_uso_bomba=None,
            ensacamento=45,
            tambores=12,
            total_solidos=38,
            icamento=45,
            cambagem=45,
            numero_compartimentos=10,
            compartimentos_avanco_json=json.dumps(comps),
            planejamento_pt='Continuidade do jateamento no 7º compartimento e avanço da limpeza fina.',
        )

        # Membros da equipe
        RDOMembroEquipe.objects.create(
            rdo=self.rdo,
            nome='Gabriel Alves',
            funcao='Supervisor',
            ordem=1,
        )
        RDOMembroEquipe.objects.create(
            rdo=self.rdo,
            nome='Carlos Eduardo',
            funcao='Operador',
            ordem=2,
        )

        # Atividades
        RDOAtividade.objects.create(
            rdo=self.rdo,
            ordem=1,
            atividade='dds',
            inicio=time(7, 0),
            fim=time(8, 0),
            comentario_pt='Diálogo Diário de Segurança sobre Espaço Confinado',
        )
        RDOAtividade.objects.create(
            rdo=self.rdo,
            ordem=2,
            atividade='jateamento',
            inicio=time(8, 0),
            fim=time(12, 0),
        )

    def test_build_rdo_whatsapp_text_contains_all_skeleton_sections(self):
        text = build_rdo_whatsapp_text(self.rdo)

        self.assertIn('🛠 STATUS OPERACIONAL – 14/09/2026', text)
        self.assertIn('📄 OS: 6048', text)
        self.assertIn('📍Unidade: P-50', text)
        self.assertIn('🏗 Cliente: Petrobras S.A.', text)
        self.assertIn('📌 Escopo: Limpeza Mecanizada', text)
        self.assertIn('PT : Manhã: 1234 | Tarde: 1235', text)
        self.assertIn('TANQUE : TQ-01', text)
        self.assertIn('VOLUME : 150 m³', text)

        self.assertIn('Permissões de trabalho:', text)
        self.assertIn('• Manhã: 1234', text)
        self.assertIn('• Tarde: 1235', text)

        self.assertIn('🌫 ESPAÇO CONFINADO:(SIM)', text)
        self.assertIn('H₂S: 0 ppm', text)
        self.assertIn('LEL: 0%', text)
        self.assertIn('CO: 0 ppm', text)
        self.assertIn('O₂: 20.9%', text)

        self.assertIn('Intervalo horário 1ª Entrada e 1ª saída: 08:00 às 11:30', text)
        self.assertIn('Intervalo horário 2ª Entrada e 2ª saída: 13:00 às 17:00', text)
        self.assertIn('Operadores simultâneos em espaço confinado: 4', text)

        self.assertIn('👷♂ EQUIPE OPERACIONAL', text)
        self.assertIn('• Gabriel Alves - Supervisor', text)
        self.assertIn('• Carlos Eduardo - Operador', text)

        self.assertIn('⏰ HORÁRIOS E ATIVIDADES', text)
        self.assertIn('• 07:00 às 08:00 - DDS / Work Safety Dialog (Diálogo Diário de Segurança sobre Espaço Confinado)', text)
        self.assertIn('• 08:00 às 12:00 - Jateamento / Blasting', text)

        self.assertIn('📊 OBSERVAÇÕES:\nOperação realizada com sucesso e dentro dos padrões de segurança.', text)

        self.assertIn('⚠ DADOS DA OPERAÇÃO DO DIA', text)
        self.assertIn('• Ensacamento: 45', text)
        self.assertIn('• Tambores : 12', text)
        self.assertIn('• Total de tambores: 38', text)
        self.assertIn('• Sacos içados: 45', text)
        self.assertIn('• Sacos cambados no turno: 45', text)

        self.assertIn('• Compartimentos já jateados/raspados:', text)
        self.assertIn('10º → 100%', text)
        self.assertIn('9º → 100%', text)
        self.assertIn('8º → 100%', text)
        self.assertIn('7º → 50%', text)
        self.assertIn('1º → 0%', text)

        self.assertIn('• Compartimento em limpeza fina:', text)
        self.assertIn('10º → 100%', text)
        self.assertIn('9º → 0%', text)

        self.assertIn('🔮 PREVISÃO PARA O PRÓXIMO TURNO:\nContinuidade do jateamento no 7º compartimento e avanço da limpeza fina.', text)

    def test_build_rdo_whatsapp_text_minimal_rdo(self):
        empty_rdo = RDO.objects.create(rdo='99')
        text = build_rdo_whatsapp_text(empty_rdo)
        self.assertIn('🛠 STATUS OPERACIONAL', text)
        self.assertIn('🌫 ESPAÇO CONFINADO:(NÃO)', text)
        self.assertIn('10º → %', text)
        self.assertIn('1º → %', text)

    def test_rdo_whatsapp_text_api(self):
        url = reverse('api_rdo_whatsapp_text', kwargs={'rdo_id': self.rdo.id})
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data.get('success'))
        self.assertIn('🛠 STATUS OPERACIONAL', data.get('whatsapp_text', ''))
        self.assertIn('6048', data.get('whatsapp_text', ''))
