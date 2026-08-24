import os
import tempfile
from datetime import date

from django.test import SimpleTestCase

from GO.management.commands.importar_propostas_2026 import (
    HEADERS,
    Command,
    parse_date,
    parse_decimal,
    parse_revision,
)


class ImportarPropostas2026CommandTests(SimpleTestCase):
    def _record(self, number, revision, client="Cliente", local="Local", operation="Offshore", row=5):
        return {
            "excel_row": row,
            "number": number,
            "revision": revision,
            "emission": date(2026, 1, 10),
            "delivery": None,
            "closing": None,
            "forecast": None,
            "request": None,
            "identity": (number, client.casefold(), local.casefold(), operation.casefold()),
            "raw": {},
        }

    def test_parseia_rev_zero_sem_trata_lo_como_vazio(self):
        self.assertEqual(parse_revision(0), 0)
        self.assertEqual(parse_revision("REV 03"), 3)

    def test_parseia_datas_e_valores_brasileiros(self):
        self.assertEqual(parse_date("14/08/2026"), date(2026, 8, 14))
        self.assertEqual(str(parse_decimal("R$ 1.234,56")), "1234.56")
        self.assertIsNone(parse_decimal(""))

    def test_ler_planilha_preserva_rev_zero(self):
        from openpyxl import Workbook

        workbook = Workbook()
        sheet = workbook.active
        sheet.title = "2026"
        headers = list(HEADERS.values())
        sheet.append(headers)
        row = [None] * len(headers)
        row[headers.index(HEADERS["numero"])] = 7001
        row[headers.index(HEADERS["revisao"])] = 0
        row[headers.index(HEADERS["emissao"])] = date(2026, 1, 10)
        sheet.append(row)

        handle = tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False)
        handle.close()
        self.addCleanup(lambda: os.path.exists(handle.name) and os.unlink(handle.name))
        workbook.save(handle.name)

        records = Command()._read_rows(handle.name)
        self.assertEqual(records[0]["number"], 7001)
        self.assertEqual(records[0]["revision"], 0)

    def test_mantem_apenas_a_maior_revisao_da_mesma_oportunidade(self):
        command = Command()
        older = self._record(7002, 0, row=10)
        newer = self._record(7002, 2, row=11)

        selected, reports, summary = command._select_winners([older, newer])

        self.assertEqual(selected, [newer])
        self.assertEqual(summary["discarded_revisions"], 1)
        self.assertEqual(reports[0]["status_importacao"], "REV DESCARTADA")

    def test_desempata_por_emissao_e_linha_da_planilha(self):
        command = Command()
        first = self._record(7003, 1, row=10)
        last = self._record(7003, 1, row=11)
        last["emission"] = date(2026, 2, 1)

        selected, _reports, _summary = command._select_winners([first, last])

        self.assertEqual(selected, [last])

    def test_numero_reutilizado_para_identidades_distintas_nao_bloqueia(self):
        command = Command()
        offshore = self._record(7004, 0, client="Cliente A", row=10)
        onshore = self._record(7004, 0, client="Cliente B", operation="Onshore", row=11)

        selected, reports, summary = command._select_winners([offshore, onshore])

        self.assertEqual(len(selected), 2)
        self.assertEqual(summary["reused_numbers"], 1)
        self.assertFalse([report for report in reports if report["status_importacao"] == "BLOCKER"])
