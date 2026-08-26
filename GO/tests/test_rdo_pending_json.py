from django.contrib.auth.models import User
from django.test import Client, TestCase


class RdoPendingJsonAuthenticationTest(TestCase):
    def test_unauthenticated_request_returns_json_401_instead_of_login_html(self):
        response = Client().get(
            '/rdo/pending_os_json/',
            HTTP_X_REQUESTED_WITH='XMLHttpRequest',
        )

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response['Content-Type'], 'application/json')
        payload = response.json()
        self.assertFalse(payload['success'])
        self.assertEqual(payload['data'], [])
        self.assertIn('Sessão expirada', payload['error'])

    def test_authenticated_request_returns_json(self):
        client = Client()
        client.force_login(User.objects.create_user('pending-json-user'))

        response = client.get(
            '/rdo/pending_os_json/',
            HTTP_X_REQUESTED_WITH='XMLHttpRequest',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response['Content-Type'], 'application/json')
        self.assertTrue(response.json()['success'])
