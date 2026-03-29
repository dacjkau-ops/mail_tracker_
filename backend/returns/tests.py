from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from returns.models import ReturnApplicability, ReturnDefinition, ReturnPeriodEntry
from sections.models import Section, Subsection
from users.models import User


class ReturnsAPITests(APITestCase):
    def setUp(self):
        self.section = Section.objects.create(name='AMG-I')
        self.other_section = Section.objects.create(name='IR')
        self.subsection = Subsection.objects.create(section=self.section, name='AMG-I 1')
        self.other_subsection = Subsection.objects.create(section=self.other_section, name='IR 1')

        self.aao = User.objects.create_user(
            username='aao1',
            password='Password123',
            email='aao1@office.gov',
            full_name='AAO One',
            role='AAO',
            subsection=self.subsection,
        )
        self.srao = User.objects.create_user(
            username='srao1',
            password='Password123',
            email='srao1@office.gov',
            full_name='SrAO One',
            role='SrAO',
            subsection=self.subsection,
        )
        self.dag = User.objects.create_user(
            username='dag1',
            password='Password123',
            email='dag1@office.gov',
            full_name='DAG One',
            role='DAG',
        )
        self.dag.sections.set([self.section, self.other_section])

        monthly = ReturnDefinition.objects.create(
            code='ITA',
            name='ITA Report',
            frequency='monthly',
            active=True,
        )
        quarterly = ReturnDefinition.objects.create(
            code='IRQ',
            name='Quarterly IR Report',
            frequency='quarterly',
            active=True,
        )
        annual = ReturnDefinition.objects.create(
            code='ANN',
            name='Annual Filing',
            frequency='annual',
            active=True,
        )

        ReturnApplicability.objects.create(
            return_definition=monthly,
            section=self.section,
            due_day=7,
            applicable_months=[],
            active=True,
        )
        ReturnApplicability.objects.create(
            return_definition=monthly,
            section=self.other_section,
            due_day=10,
            applicable_months=[],
            active=True,
        )
        ReturnApplicability.objects.create(
            return_definition=quarterly,
            section=self.section,
            due_day=15,
            applicable_months=[3, 6, 9, 12],
            active=True,
        )
        ReturnApplicability.objects.create(
            return_definition=annual,
            section=self.section,
            due_day=20,
            applicable_months=[4],
            active=True,
        )

    def test_dashboard_generates_only_matching_period_entries(self):
        self.client.force_authenticate(self.aao)
        response = self.client.get(reverse('return-entry-list'), {'year': 2026, 'month': 3})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        codes = {entry['report_code_snapshot'] for entry in response.data['entries']}
        self.assertEqual(codes, {'ITA', 'IRQ'})
        self.assertFalse('ANN' in codes)
        self.assertEqual(ReturnPeriodEntry.objects.filter(year=2026, month=3).count(), 2)

    def test_aao_can_submit_but_srao_cannot(self):
        self.client.force_authenticate(self.aao)
        dashboard_response = self.client.get(reverse('return-entry-list'), {'year': 2026, 'month': 3})
        entry_id = dashboard_response.data['entries'][0]['id']

        submit_response = self.client.post(reverse('return-entry-submit', args=[entry_id]))
        self.assertEqual(submit_response.status_code, status.HTTP_200_OK)

        entry = ReturnPeriodEntry.objects.get(id=entry_id)
        self.assertEqual(entry.status, ReturnPeriodEntry.STATUS_SUBMITTED)
        self.assertEqual(entry.submitted_by, self.aao)

        second_entry = ReturnPeriodEntry.objects.exclude(id=entry_id).get()
        self.client.force_authenticate(self.srao)
        forbidden_response = self.client.post(reverse('return-entry-submit', args=[second_entry.id]))
        self.assertEqual(forbidden_response.status_code, status.HTTP_403_FORBIDDEN)

    def test_dag_receives_section_overview(self):
        self.client.force_authenticate(self.dag)
        response = self.client.get(reverse('return-entry-list'), {'year': 2026, 'month': 3})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        section_names = {item['section_name'] for item in response.data['section_overview']}
        self.assertIn('AMG-I', section_names)
        self.assertIn('IR', section_names)

    def test_dashboard_scopes_section_overview_to_selected_section(self):
        self.client.force_authenticate(self.dag)
        response = self.client.get(
            reverse('return-entry-list'),
            {'year': 2026, 'month': 3, 'section': self.other_section.id},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            [item['section_name'] for item in response.data['section_overview']],
            ['IR'],
        )
        self.assertTrue(all(entry['section_name'] == 'IR' for entry in response.data['entries']))
