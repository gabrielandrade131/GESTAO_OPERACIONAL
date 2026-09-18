from datetime import date
from decimal import Decimal
from django.test import TestCase
from django.contrib.auth.models import User
from GO.models import Cliente, OrdemServico, Unidade
from GO.forms import OrdemServicoForm


class OrdemServicoNumberingHomologIsolationTests(TestCase):
    def setUp(self):
        self.cliente = Cliente.objects.create(nome='Cliente Teste')
        self.unidade = Unidade.objects.create(nome='Unidade Teste')
        self.user = User.objects.create_user(username='user_test', password='password123')

    def _create_os(self, numero_os):
        return OrdemServico.objects.create(
            numero_os=numero_os,
            data_inicio=date(2026, 9, 16),
            dias_de_operacao=1,
            servico='VISITA TÉCNICA',
            metodo='Manual',
            pob=1,
            tanque='',
            volume_tanque=Decimal('0.00'),
            Cliente=self.cliente,
            Unidade=self.unidade,
            tipo_operacao='Onshore',
            solicitante='Solicitante Teste',
            status_operacao='Programada',
            status_comercial='Em aberto',
        )

    def test_nova_os_ignora_os_de_homologacao_maior_ou_igual_9000(self):
        # Existing production OSs
        self._create_os(numero_os=7141)
        # Existing homologation OS (e.g., 90001)
        self._create_os(numero_os=90001)

        form_data = {
            'box_opcao': OrdemServicoForm.NOVA_OS,
            'servico': 'VISITA TÉCNICA',
            'metodo': 'Manual',
            'pob': 1,
            'solicitante': 'Novo Solicitante',
            'tipo_operacao': 'Onshore',
            'status_operacao': 'Programada',
            'status_comercial': 'Em aberto',
            'data_inicio': '2026-09-16',
            'dias_de_operacao': 1,
            'Cliente': self.cliente.pk,
            'Unidade': self.unidade.pk,
        }

        form = OrdemServicoForm(data=form_data)
        self.assertTrue(form.is_valid(), form.errors)
        os_instance = form.save(commit=True)

        # Should be 7142, NOT 90002
        self.assertEqual(os_instance.numero_os, 7142)

    def test_nova_os_quando_so_existem_os_de_homologacao_inicia_em_1(self):
        # Only homologation OS exists
        self._create_os(numero_os=90001)

        form_data = {
            'box_opcao': OrdemServicoForm.NOVA_OS,
            'servico': 'VISITA TÉCNICA',
            'metodo': 'Manual',
            'pob': 1,
            'solicitante': 'Novo Solicitante',
            'tipo_operacao': 'Onshore',
            'status_operacao': 'Programada',
            'status_comercial': 'Em aberto',
            'data_inicio': '2026-09-16',
            'dias_de_operacao': 1,
            'Cliente': self.cliente.pk,
            'Unidade': self.unidade.pk,
        }

        form = OrdemServicoForm(data=form_data)
        self.assertTrue(form.is_valid(), form.errors)
        os_instance = form.save(commit=True)

        # Should be 1 because no production OS (< 9000) exists
        self.assertEqual(os_instance.numero_os, 1)
