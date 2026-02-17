from django.test import TestCase
from .postgres import normalize_query


class NormalizeQueryTests(TestCase):
    def test_normalize_literals(self):
        self.assertEqual(
            normalize_query("SELECT * FROM users WHERE id = 42 AND email = 'x@y.com'"),
            'SELECT * FROM users WHERE id = ? AND email = ?'
        )
