import os
from datetime import date, time
from unittest.mock import patch
from django.test import TestCase, override_settings
from django.core.cache import cache
from GO.models import Cliente, Unidade, OrdemServico, RDO, RdoTanque
from .views import CLIENT_NAME

@override_settings(SECURE_SSL_REDIRECT=False)
class ScopeTests(TestCase):
    url = "/api/integrations/dashboard-sbm/"
    def setUp(self):
        cache.clear()
        self.env = patch.dict(os.environ, {"SYNCHRO_API_TOKEN": "test-only"})
        self.env.start()
        self.addCleanup(self.env.stop)
        for index, name in enumerate((CLIENT_NAME, CLIENT_NAME + " OUTRO")):
            client = Cliente.objects.create(nome=name)
            unit = Unidade.objects.create(nome="Unidade " + str(index))
            order = OrdemServico.objects.create(numero_os=9900 + index, Cliente=client, Unidade=unit,
                data_inicio=date(2026,9,1), data_fim=date(2026,9,2), dias_de_operacao=1,
                servico="COLETA DE AR", servicos="COLETA DE AR", metodo="Manual" if index == 0 else "Outro",
                pob=2 if index == 0 else 100, volume_tanque=0,
                status_operacao="Finalizada", tipo_operacao="Onshore", solicitante="Teste")
            rdo = RDO.objects.create(ordem_servico=order, data=date(2026,9,1))
            RDO.objects.filter(pk=rdo.pk).update(entrada_confinado_1=time(8), saida_confinado_1=time(10 if index == 0 else 20),
                                                operadores_simultaneos=1 if index == 0 else 99,
                                                total_solidos=3 if index == 0 else 90)
            RdoTanque.objects.create(rdo=rdo, tanque_codigo="T1", ensacamento_dia=4 if index == 0 else 90,
                                    tambores_dia=5 if index == 0 else 90, total_liquido=6 if index == 0 else 90)
            if index:
                self.other_unit = unit.pk
            else:
                self.own_order = order.pk

    def get(self, **kwargs):
        return self.client.get(self.url, {"start":"2026-09-01","end":"2026-09-02", **kwargs},
                               HTTP_AUTHORIZATION="Bearer test-only")

    def test_only_exact_sbm_before_every_aggregation(self):
        response = self.get()
        self.assertEqual(response.status_code, 200, response.content)
        data = response.json()
        self.assertEqual(data["client"], CLIENT_NAME)
        charts = {c["id"]: c for c in data["data"]["charts"]}
        self.assertEqual(charts["hh_confinado"]["datasets"][0]["data"][0], 2)
        self.assertEqual(charts["pob"]["datasets"][0]["data"], [2, 0])
        for key, expected in (("ensacamento", 4), ("tambores", 5), ("liquido", 6), ("solido", 3)):
            self.assertEqual(charts[key]["datasets"][0]["data"][0], expected)
        self.assertEqual(data["data"]["methods"]["labels"], ["Manual"])
        self.assertEqual(len(data["filters"]["unidade"]), 1)
        self.assertEqual(len(charts), 7)
        self.assertEqual(data["filters"]["os"][0]["value"], str(self.own_order))

    def test_rejects_override_and_foreign_options(self):
        self.assertEqual(self.get(cliente="OUTRO").status_code, 400)
        self.assertEqual(self.get(unidade=str(self.other_unit)).status_code, 400)
        self.assertEqual(self.get(os=str(self.own_order)).status_code, 200)

    def test_tank_summary_separates_tanks_and_merges_movements(self):
        from .tank_summary import tank_operations
        order = OrdemServico.objects.get(pk=self.own_order)
        rdo = RDO.objects.create(ordem_servico=order, data=date(2026, 9, 4))
        RdoTanque.objects.create(rdo=rdo, tanque_codigo='T1', ensacamento_dia=7,
                                tambores_dia=2, numero_compartimentos=1,
                                compartimentos_avanco_json='{"1":{"mecanizada":100,"fina":0}}')
        RdoTanque.objects.create(rdo=rdo, tanque_codigo='T2', ensacamento_dia=90)
        rows = tank_operations(OrdemServico.objects.filter(pk=self.own_order), {})
        self.assertEqual(len(rows), 2)
        first = next(row for row in rows if row['tanque'] == 'T1')
        self.assertEqual(first['total_ensacamento'], 11)
        self.assertEqual(first['total_tambores'], 7)
        self.assertEqual(first['dias_operacao'], 3)
        self.assertEqual(first['avanco'], 85)
        self.assertEqual(first['metodo'], 'Manual')
        self.assertEqual(first['primeiro_rdo'], '2026-09-01')
        self.assertEqual(first['ultimo_rdo'], '2026-09-04')
        filtered = tank_operations(OrdemServico.objects.filter(pk=self.own_order),
                                  {'start':'2026-09-04', 'end':'2026-09-04'})
        self.assertTrue(all(row['dias_operacao'] == 0 for row in filtered))
        self.assertEqual(next(row for row in filtered if row['tanque']=='T1')['total_ensacamento'], 7)

    def test_requires_service_auth_and_get(self):
        self.assertEqual(self.client.get(self.url).status_code, 403)
        self.assertEqual(self.client.post(self.url).status_code, 405)
