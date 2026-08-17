from django.test import TestCase, Client
from django.contrib.auth.models import User
from django.urls import reverse
from GO.models import UserPasswordChangeStatus
from GO.context_processors import synchro_shell
from django.test.client import RequestFactory

class PasswordChangeMandatoryTestCase(TestCase):
    def setUp(self):
        self.client = Client()
        self.username = 'testuser'
        self.password = 'OldPass123!'
        self.user = User.objects.create_user(username=self.username, password=self.password, email='test@example.com')
        # Setup status
        self.status, _ = UserPasswordChangeStatus.objects.get_or_create(user=self.user)
        self.factory = RequestFactory()

    def test_context_processor_reflects_needs_change(self):
        # 1. Needs password change is True
        request = self.factory.get('/')
        request.user = self.user
        context = synchro_shell(request)
        self.assertTrue(context['password_change_required'])

        # 2. Needs password change is False
        self.status.needs_password_change = False
        self.status.save()
        context = synchro_shell(request)
        self.assertFalse(context['password_change_required'])

    def test_mandatory_change_requires_login(self):
        url = reverse('change_password_mandatory')
        response = self.client.post(url, {
            'current_password': self.password,
            'new_password': 'NewPassword123!',
            'confirm_password': 'NewPassword123!'
        })
        self.assertEqual(response.status_code, 302) # Redirects to login

    def test_mandatory_change_success(self):
        self.client.login(username=self.username, password=self.password)
        url = reverse('change_password_mandatory')
        
        # Valid password change
        new_pass = 'Secr3tPassword!'
        response = self.client.post(url, {
            'current_password': self.password,
            'new_password': new_pass,
            'confirm_password': new_pass
        })
        
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data['success'])

        # Check DB status
        self.status.refresh_from_db()
        self.assertFalse(self.status.needs_password_change)

        # Check login with new password
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(new_pass))

    def test_mandatory_change_validation_errors(self):
        self.client.login(username=self.username, password=self.password)
        url = reverse('change_password_mandatory')

        # 1. Wrong current password
        response = self.client.post(url, {
            'current_password': 'wrongpassword',
            'new_password': 'NewPassword123!',
            'confirm_password': 'NewPassword123!'
        })
        self.assertEqual(response.status_code, 400)
        self.assertIn('Senha atual incorreta.', response.json()['errors'])

        # 2. Too short new password
        response = self.client.post(url, {
            'current_password': self.password,
            'new_password': 'Short',
            'confirm_password': 'Short'
        })
        self.assertEqual(response.status_code, 400)
        self.assertIn('A senha deve ter pelo menos 8 caracteres.', response.json()['errors'])

        # 3. No uppercase
        response = self.client.post(url, {
            'current_password': self.password,
            'new_password': 'nouppercase123!',
            'confirm_password': 'nouppercase123!'
        })
        self.assertEqual(response.status_code, 400)
        self.assertIn('A senha deve conter pelo menos uma letra maiúscula.', response.json()['errors'])

        # 4. No lowercase
        response = self.client.post(url, {
            'current_password': self.password,
            'new_password': 'NOLOWERCASE123!',
            'confirm_password': 'NOLOWERCASE123!'
        })
        self.assertEqual(response.status_code, 400)
        self.assertIn('A senha deve conter pelo menos uma letra minúscula.', response.json()['errors'])

        # 5. No digit
        response = self.client.post(url, {
            'current_password': self.password,
            'new_password': 'NoDigitsHere!',
            'confirm_password': 'NoDigitsHere!'
        })
        self.assertEqual(response.status_code, 400)
        self.assertIn('A senha deve conter pelo menos um número.', response.json()['errors'])

        # 6. No special character
        response = self.client.post(url, {
            'current_password': self.password,
            'new_password': 'NoSpecialChar123',
            'confirm_password': 'NoSpecialChar123'
        })
        self.assertEqual(response.status_code, 400)
        self.assertIn('A senha deve conter pelo menos um caractere especial (ex: @, $, !, %, *, ?, &).', response.json()['errors'])

        # 7. Non-matching passwords
        response = self.client.post(url, {
            'current_password': self.password,
            'new_password': 'ValidPass123!',
            'confirm_password': 'DifferentPass123!'
        })
        self.assertEqual(response.status_code, 400)
        self.assertIn('A nova senha e a confirmação não coincidem.', response.json()['errors'])
