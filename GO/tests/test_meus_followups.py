from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase
from django.urls import reverse

from GO.models import ResponsavelCoordenador
from GO.views_comercial import _user_responsavel_names


class MeusFollowupsTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="teste.daniel.follow@ambipar.com",
            email="teste.daniel.follow@ambipar.com",
            password="senha123",
            is_staff=True,
        )
        ResponsavelCoordenador.objects.create(nome="Teste Daniel Follow", responsavel_comercial=True)
        ResponsavelCoordenador.objects.create(nome="Teste Fernanda Follow", responsavel_comercial=True)

    def test_responsavel_is_resolved_from_authenticated_user_identity(self):
        self.assertEqual(_user_responsavel_names(self.user), ["Teste Daniel Follow"])

    @patch("GO.views_comercial._collect_followup_agenda_items")
    def test_page_only_shows_followups_for_logged_responsavel(self, collect_items):
        collect_items.return_value = [
            {"id": "1", "proposta_id": 1, "numero_proposta": "1", "cliente": "Cliente A", "responsavel": "Teste Daniel Follow", "data": "2026-08-12", "hora": "09:30", "titulo": "Retornar escopo", "comentario": "", "status": "Pendente"},
            {"id": "2", "proposta_id": 2, "numero_proposta": "2", "cliente": "Cliente B", "responsavel": "Teste Fernanda Follow", "data": "2026-08-12", "hora": "14:00", "titulo": "Enviar proposta", "comentario": "", "status": "Pendente"},
        ]
        self.client.force_login(self.user)

        response = self.client.get(reverse("comercial_meus_followups"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Cliente A")
        self.assertNotContains(response, "Cliente B")

    @patch("GO.views_comercial._collect_followup_agenda_items")
    def test_agenda_endpoint_ignores_responsavel_from_query_string(self, collect_items):
        collect_items.return_value = [
            {"id": "1", "proposta_id": 1, "numero_proposta": "1", "cliente": "Cliente A", "responsavel": "Teste Daniel Follow", "data": "2026-08-12", "hora": "09:30", "titulo": "Retornar escopo", "comentario": "", "status": "Pendente"},
            {"id": "2", "proposta_id": 2, "numero_proposta": "2", "cliente": "Cliente B", "responsavel": "Teste Fernanda Follow", "data": "2026-08-12", "hora": "14:00", "titulo": "Enviar proposta", "comentario": "", "status": "Pendente"},
        ]
        self.client.force_login(self.user)

        response = self.client.get(reverse("comercial_agenda_followups"), {"responsavel": "Teste Fernanda Follow"})

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual([item["responsavel"] for item in payload["items"]], ["Teste Daniel Follow"])

    @patch("GO.views_comercial._collect_followup_agenda_items")
    def test_superuser_can_view_all_followups(self, collect_items):
        collect_items.return_value = [
            {"id": "1", "proposta_id": 1, "numero_proposta": "1", "cliente": "Cliente A", "responsavel": "Teste Daniel Follow", "data": "2026-08-12", "hora": "09:30", "titulo": "Retornar escopo", "comentario": "", "status": "Pendente"},
            {"id": "2", "proposta_id": 2, "numero_proposta": "2", "cliente": "Cliente B", "responsavel": "Teste Fernanda Follow", "data": "2026-08-12", "hora": "14:00", "titulo": "Enviar proposta", "comentario": "", "status": "Pendente"},
        ]
        admin = User.objects.create_superuser(
            username="admin_followups",
            email="admin_followups@ambipar.com",
            password="senha123",
        )
        self.client.force_login(admin)

        response = self.client.get(reverse("comercial_agenda_followups"))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["total_all"], 2)
