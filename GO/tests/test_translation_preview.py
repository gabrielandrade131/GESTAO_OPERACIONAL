import json
from datetime import date
from decimal import Decimal
from unittest.mock import Mock, patch

from django.contrib.auth.models import User
from django.test import Client, SimpleTestCase, TestCase
from django.urls import reverse

from GO.models import Cliente, OrdemServico, RDO, RDOAtividade, Unidade
from GO.translation_utils import translate_pt_to_en


class TranslationUtilsTest(SimpleTestCase):
    @patch('GO.translation_utils.requests.get')
    def test_uses_google_json_response(self, requests_get):
        response = Mock()
        response.json.return_value = [[['test', 'teste', None, None]]]
        requests_get.return_value = response

        translated = translate_pt_to_en(' teste ', timeout_seconds=2)

        self.assertEqual(translated, 'test')
        response.raise_for_status.assert_called_once_with()
        self.assertEqual(requests_get.call_args.kwargs['timeout'], 2)

    @patch('deep_translator.GoogleTranslator')
    @patch('GO.translation_utils.requests.get')
    def test_falls_back_to_deep_translator(self, requests_get, translator_class):
        requests_get.side_effect = OSError('JSON endpoint unavailable')
        translator_class.return_value.translate.return_value = 'daily report'

        translated = translate_pt_to_en('relatorio diario', timeout_seconds=2)

        self.assertEqual(translated, 'daily report')

    @patch('GO.translation_utils.requests.get')
    def test_uses_mymemory_when_google_is_rate_limited(self, requests_get):
        google_response = Mock()
        google_response.raise_for_status.side_effect = RuntimeError('HTTP 429')
        mymemory_response = Mock()
        mymemory_response.json.return_value = {
            'responseData': {'translatedText': 'test'},
            'responseStatus': 200,
        }
        requests_get.side_effect = [google_response, mymemory_response]

        translated = translate_pt_to_en('teste', timeout_seconds=2)

        self.assertEqual(translated, 'test')
        self.assertIn('mymemory', requests_get.call_args.args[0])


class TranslationPreviewEndpointTest(TestCase):
    def setUp(self):
        self.client = Client()
        self.client.force_login(User.objects.create_user('translation-user'))

    @patch('GO.views_rdo.translate_pt_to_en')
    def test_preserves_original_text_when_translation_is_unavailable(self, translate):
        translate.side_effect = RuntimeError('translators unavailable')

        response = self.client.post(
            '/api/rdo/translate/preview/',
            data=json.dumps({'text': 'teste'}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {
                'success': True,
                'en': 'teste',
                'translated': False,
                'warning': 'Tradução automática indisponível; texto original preservado.',
            },
        )


class RdoTranslationPersistenceTest(TestCase):
    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_superuser(
            username='rdo-translation-persistence',
            email='rdo-translation@example.test',
            password='test-password',
        )
        self.client.force_login(self.user)
        cliente = Cliente.objects.create(nome='Cliente tradução')
        unidade = Unidade.objects.create(nome='Unidade tradução')
        coordenador = next(value for value, _ in OrdemServico.COORDENADORES if value)
        self.os = OrdemServico.objects.create(
            numero_os=990701,
            data_inicio=date(2026, 8, 24),
            data_fim=None,
            dias_de_operacao=0,
            servico='LIMPEZA DE TANQUE',
            servicos='LIMPEZA DE TANQUE',
            metodo='Manual',
            pob=1,
            tanque='',
            tanques=None,
            volume_tanque=Decimal('0.00'),
            Cliente=cliente,
            Unidade=unidade,
            tipo_operacao='Onshore',
            solicitante='Solicitante tradução',
            coordenador=coordenador,
            supervisor=self.user,
            status_operacao='Em andamento',
            status_geral='Em andamento',
            status_comercial='Em aberto',
            status_planejamento='Pendente',
        )
        self.rdo = RDO.objects.create(
            ordem_servico=self.os,
            rdo='1',
            data=date(2026, 8, 24),
            data_inicio=date(2026, 8, 24),
        )

    def _update(self, **extra):
        data = {
            'rdo_id': str(self.rdo.pk),
            'data': '2026-08-24',
        }
        data.update(extra)
        return self.client.post(
            reverse('rdo_update_ajax'),
            data=data,
            HTTP_X_REQUESTED_WITH='XMLHttpRequest',
            HTTP_HOST='localhost',
            secure=True,
        )

    @patch('GO.views_rdo.translate_pt_to_en')
    def test_translates_and_persists_all_pt_fields_when_en_is_missing(self, translate):
        translations = {
            'teste': 'test',
            'planejamento diário': 'daily planning',
            'ciente das observações': 'aware of the observations',
            'acesso liberado': 'access cleared',
        }
        translate.side_effect = lambda text: translations[str(text).strip()]

        response = self._update(
            observacoes='teste',
            planejamento='planejamento diário',
            ciente_observacoes='ciente das observações',
            **{
                'atividade_nome[]': ['acesso ao tanque'],
                'atividade_comentario_pt[]': ['acesso liberado'],
                'atividade_comentario_en[]': [''],
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json().get('success'))
        self.rdo.refresh_from_db()
        self.assertEqual(self.rdo.observacoes_rdo_en, 'test')
        self.assertEqual(self.rdo.planejamento_en, 'daily planning')
        self.assertEqual(self.rdo.ciente_observacoes_en, 'aware of the observations')
        activity = RDOAtividade.objects.get(rdo=self.rdo)
        self.assertEqual(activity.comentario_en, 'access cleared')

    @patch('GO.views_rdo.translate_pt_to_en')
    def test_preserves_pt_in_en_columns_when_every_translator_fails(self, translate):
        translate.side_effect = RuntimeError('translation unavailable')

        response = self._update(
            observacoes='texto de contingência',
            planejamento='planejamento de contingência',
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json().get('success'))
        self.rdo.refresh_from_db()
        self.assertEqual(self.rdo.observacoes_rdo_en, 'texto de contingência')
        self.assertEqual(self.rdo.planejamento_en, 'planejamento de contingência')

    @patch('GO.views_rdo.translate_pt_to_en')
    def test_keeps_translation_sent_by_browser(self, translate):
        response = self._update(
            observacoes='teste',
            observacoes_en='test from browser',
            planejamento='planejamento',
            planejamento_en='planning from browser',
        )

        self.assertEqual(response.status_code, 200)
        self.rdo.refresh_from_db()
        self.assertEqual(self.rdo.observacoes_rdo_en, 'test from browser')
        self.assertEqual(self.rdo.planejamento_en, 'planning from browser')
        translate.assert_not_called()
